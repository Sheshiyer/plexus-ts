import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, Input, Modal, PageHeader, Select, Skeleton, Textarea } from './ui';
import {
  IconCamera,
  IconCheck,
  IconClock,
  IconClose,
  IconCloud,
  IconKeyboard,
  IconMic,
  IconPaperclip,
  IconScreen,
  IconSpeaker,
  IconSync,
  IconUsers,
} from './Icons';
import {
  DegradedStatePanel,
  EmptyStatePanel,
  InstrumentPanel,
  StatusChip,
} from './PlexusUI';
import type {
  CoWorkingRingState,
  FloorPresence,
  RealtimeJoinResponse,
  RealtimeMeetingRecord,
  RealtimeRoom,
  RealtimeRoomType,
} from '../../shared/types';
import { RealtimeSession, type RemoteStream } from '../lib/RealtimeSession';

/* ------------------------------------------------------------------
 * Plexus Co-working surface
 * ------------------------------------------------------------------
 * Replaces RealtimeCapturePanel. Three vertical sections:
 *   §01 · TODAY'S FLOOR    – ambient presence grid (FloorPresence tiles)
 *   §02 · PROJECT ROOMS    – anchored by project · drop-in CTAs
 *   §03 · AMBIENT LOUNGE   – persistent voice strip + controls
 *
 * Visual contract:        docs/design/screen-references/co-working.png
 * Composition spec:       docs/design/screen-references/co-working.prompt.txt
 * Brand contract:         FORMA system (theme.css tokens)
 *
 * Data wiring:
 *   – window.plexus.coworkingFloor()      → §01 grid (Phase C)
 *   – window.plexus.coworkingLounge()     → §03 lounge room handle (Phase C)
 *   – window.plexus.realtimeRooms()       → §02 project room cards (existing)
 *   – RealtimeSession (lib/RealtimeSession.ts) for lounge audio publish/subscribe
 *
 * Refresh cadence: 15s polling for floor + rooms.
 * ------------------------------------------------------------------ */

const REFRESH_INTERVAL_MS = 15000;

type DeviceChoice = {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
};

const SYSTEM_DEVICE_ID = 'system-default';

type AudioSinkElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

function newLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sinkIdForDevice(deviceId: string): string {
  return deviceId === SYSTEM_DEVICE_ID ? '' : deviceId;
}

/* ============================================================
 * §01 · AvatarTile (presence grid cell)
 * ============================================================ */

function AvatarTile({
  presence,
  onActivate,
}: {
  presence: FloorPresence;
  onActivate?: (presence: FloorPresence) => void;
}) {
  const clickable = Boolean(presence.roomId && onActivate);
  const handleClick = () => {
    if (clickable) onActivate?.(presence);
  };
  return (
    <button
      type="button"
      className={`px-avatar-tile ${presence.ringState}${clickable ? '' : ' static'}`}
      onClick={handleClick}
      disabled={!clickable}
      aria-label={`${presence.displayName} — ${presence.ringState}${presence.roomName ? ` in ${presence.roomName}` : ''}`}
    >
      <span className="px-avatar-circle">
        <span className="px-avatar-initials">{presence.initials}</span>
        {presence.isSpeaking && <span className="px-avatar-mic" aria-hidden="true" />}
      </span>
      <span className="px-avatar-name">{presence.displayName}</span>
      <span className="px-avatar-tag px-lbl">{presence.projectTag ?? '—'}</span>
    </button>
  );
}

/* ============================================================
 * §02 · RoomCard
 * ============================================================ */

type RoomStateBadge = 'active' | 'quiet' | 'in_call' | 'empty';
type ActiveJoinScope = 'lounge' | 'project_room';

type ActiveJoin = {
  scope: ActiveJoinScope;
  roomId: string;
  roomName: string;
  roomType: RealtimeRoomType;
  joined: RealtimeJoinResponse;
  hasSession: boolean;
};

type ActiveJoinMap = Record<string, ActiveJoin>;

function deriveRoomStateBadge(room: RealtimeRoom): RoomStateBadge {
  if (room.activeCallId) return 'in_call';
  const count = room.presence.participants;
  if (count === 0) return 'empty';
  if (count >= 2) return 'active';
  return 'quiet';
}

function roomStateLabel(state: RoomStateBadge): string {
  if (state === 'in_call') return 'IN CALL';
  if (state === 'active') return 'ACTIVE';
  if (state === 'quiet') return 'QUIET';
  return 'EMPTY';
}

function shouldClearLocalAfterLeaveFailure(message?: string): boolean {
  return /already|ended|left|not found|removed/i.test(message ?? '');
}

function splitCloseoutLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

function defaultCloseoutTitle(entry: ActiveJoin): string {
  return `${entry.roomName} closeout ${new Date().toISOString().slice(0, 10)}`;
}

function paperclipStatusCopy(meeting?: RealtimeMeetingRecord, requested?: boolean): string {
  if (!requested) return 'Paperclip not requested';
  if (!meeting) return 'Paperclip handoff requested';
  if (meeting.paperclipStatus === 'queued') return 'Paperclip queued';
  if (meeting.paperclipStatus === 'sent') return 'Paperclip sent';
  if (meeting.paperclipStatus === 'failed') return 'Paperclip failed';
  return 'Paperclip not requested';
}

/* Stable per-room avatar colors via slug hash → swatch token cycle. */
const SWATCH_TOKENS: Array<'accent' | 'mint' | 'violet' | 'rose'> = ['accent', 'mint', 'violet', 'rose'];
function swatchTokenFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  const key = SWATCH_TOKENS[h % SWATCH_TOKENS.length];
  if (key === 'accent') return 'var(--accent)';
  if (key === 'mint') return 'var(--mint)';
  if (key === 'violet') return 'var(--violet-2)';
  return 'var(--rose)';
}

/* Cluster of small (32px) avatar circles for room cards. Derives initials
 * from the floor data so it reflects "who's actually here right now"
 * rather than a stale roster. */
function MiniAvatarCluster({
  members,
  cap = 3,
}: {
  members: FloorPresence[];
  cap?: number;
}) {
  const visible = members.slice(0, cap);
  const overflow = Math.max(0, members.length - visible.length);
  if (!visible.length) {
    return <span className="px-mini-cluster empty" />;
  }
  return (
    <span className="px-mini-cluster" aria-hidden="true">
      {visible.map((member, idx) => (
        <span key={member.participantId} className={`px-mini-avatar ${member.ringState}`} style={{ zIndex: visible.length - idx }}>
          {member.initials}
        </span>
      ))}
      {overflow > 0 && <span className="px-mini-avatar overflow">+{overflow}</span>}
    </span>
  );
}

function RoomCard({
  room,
  floor,
  onDropIn,
  onLeave,
  onCloseout,
  pending,
  activeJoin,
}: {
  room: RealtimeRoom;
  floor: FloorPresence[];
  onDropIn: (room: RealtimeRoom) => void;
  onLeave: (room: RealtimeRoom) => void;
  onCloseout: (entry: ActiveJoin) => void;
  pending: boolean;
  activeJoin?: ActiveJoin;
}) {
  const stateBadge = deriveRoomStateBadge(room);
  const localActive = Boolean(activeJoin);
  const members = floor.filter((presence) => presence.roomId === room.id);
  const inCall = stateBadge === 'in_call';
  const isEmpty = stateBadge === 'empty';
  const swatch = swatchTokenFor(room.slug || room.id);

  const memberSummary = members.length
    ? `${members.slice(0, 3).map((m) => m.displayName.split(' ')[0]).join(', ')}${members.length > 3 ? ` +${members.length - 3}` : ''}`
    : 'No-one in this room today';

  const lastActivity = room.lastActivityAt ? new Date(room.lastActivityAt) : null;
  const lastActivityCopy = lastActivity ? `last activity ${formatRelative(lastActivity)}` : 'idle';
  const liveCopy = inCall ? `${members.length || 0} on voice` : memberSummary;
  const subtitle = localActive ? `You are here · ${lastActivityCopy}` : isEmpty ? memberSummary : `${liveCopy} · ${lastActivityCopy}`;

  return (
    <article className={`px-room-card ${stateBadge}${localActive ? ' joined' : ''}`}>
      <header className="px-room-head">
        <div className="px-room-title-group">
          <span className="px-room-swatch" style={{ background: swatch }} aria-hidden="true" />
          <span className="px-room-title">{room.name}</span>
        </div>
        <span className={`px-room-state-badge ${localActive ? 'active' : stateBadge}`}>
          {localActive ? 'IN ROOM' : roomStateLabel(stateBadge)}
        </span>
      </header>

      <div className="px-room-body">
        <MiniAvatarCluster members={members} cap={4} />
        <div className="px-room-meta px-lbl">{subtitle}</div>
      </div>

      <div className="px-room-foot">
        {localActive && activeJoin && (
          <Button
            variant="ghost"
            className="px-room-cta closeout"
            disabled={pending}
            onClick={() => onCloseout(activeJoin)}
          >
            <IconPaperclip s={12} /> CLOSEOUT
          </Button>
        )}
        <Button
          variant="ghost"
          className={`px-room-cta${localActive ? ' leave' : ''}`}
          disabled={pending}
          onClick={() => (localActive ? onLeave(room) : onDropIn(room))}
        >
          {localActive ? (
            <>
              <IconClose s={12} /> {pending ? 'LEAVING' : 'LEAVE'}
            </>
          ) : inCall ? (
            <>
              <IconMic s={12} /> {pending ? 'JOINING' : '+ JOIN VOICE'}
            </>
          ) : (
            <>
              <IconUsers s={12} /> {pending ? 'JOINING' : '+ DROP IN'}
            </>
          )}
        </Button>
      </div>
    </article>
  );
}

function formatRelative(then: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ============================================================
 * §03 · Lounge — waveform + controls
 * ============================================================ */

const WAVEFORM_BARS = 24;

function useLoungeWaveform(active: boolean): number[] {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: WAVEFORM_BARS }, () => 0.2));
  useEffect(() => {
    if (!active) {
      setBars(Array.from({ length: WAVEFORM_BARS }, () => 0.18));
      return;
    }
    const id = window.setInterval(() => {
      // Calm pseudo-random amplitudes; real audio analyser comes in Phase D.
      setBars((prev) => prev.map((_, idx) => {
        const base = 0.22 + Math.random() * 0.7;
        const calm = idx % 5 === 0 ? base * 0.5 : base;
        return Math.min(1, calm);
      }));
    }, 220);
    return () => window.clearInterval(id);
  }, [active]);
  return bars;
}

function LoungeWaveform({ active }: { active: boolean }) {
  const bars = useLoungeWaveform(active);
  return (
    <svg className={`px-waveform${active ? ' live' : ''}`} viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((amp, idx) => {
        const w = 120 / WAVEFORM_BARS;
        const h = Math.max(2, amp * 28);
        const x = idx * w + 1;
        const y = (32 - h) / 2;
        return <rect key={idx} x={x} y={y} width={w - 2} height={h} rx={1} />;
      })}
    </svg>
  );
}

function RemoteAudioSink({
  remote,
  outputDeviceId,
  onError,
}: {
  remote: RemoteStream;
  outputDeviceId: string;
  onError: (message: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = remote.stream;
    void audio.play().catch((err: any) => {
      onError(`Remote lounge audio could not start: ${err?.message ?? String(err)}`);
    });
    return () => {
      if (audio.srcObject === remote.stream) audio.srcObject = null;
    };
  }, [onError, remote.stream]);

  useEffect(() => {
    const audio = audioRef.current as AudioSinkElement | null;
    if (!audio) return;
    const sinkId = sinkIdForDevice(outputDeviceId);
    if (!audio.setSinkId) {
      if (sinkId) onError('Speaker output selection is not supported in this renderer.');
      return;
    }
    void audio.setSinkId(sinkId).catch((err: any) => {
      onError(`Could not route lounge audio to the selected speaker: ${err?.message ?? String(err)}`);
    });
  }, [onError, outputDeviceId]);

  return <audio ref={audioRef} className="px-remote-audio" autoPlay aria-hidden="true" />;
}

/* ============================================================
 * Main component
 * ============================================================ */

type BusyKey = 'lounge_join' | 'lounge_leave' | 'mic' | 'camera' | 'screen' | 'drop_in' | null;
type CoWorkingBusyKey = BusyKey | 'room_leave';

export default function CoWorkingPanel() {
  // §01 floor presence
  const [floor, setFloor] = useState<FloorPresence[]>([]);
  const [floorError, setFloorError] = useState<string | null>(null);
  const [floorLoading, setFloorLoading] = useState(true);

  // §02 project rooms
  const [rooms, setRooms] = useState<RealtimeRoom[]>([]);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomActionTargetId, setRoomActionTargetId] = useState<string | null>(null);
  const [activeJoins, setActiveJoins] = useState<ActiveJoinMap>({});

  // §03 lounge
  const [loungeRoom, setLoungeRoom] = useState<RealtimeRoom | null>(null);
  const [loungeError, setLoungeError] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [screenActive, setScreenActive] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [audioInputs, setAudioInputs] = useState<DeviceChoice[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<DeviceChoice[]>([]);
  const [videoInputs, setVideoInputs] = useState<DeviceChoice[]>([]);
  const [selectedMicId, setSelectedMicId] = useState(SYSTEM_DEVICE_ID);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(SYSTEM_DEVICE_ID);
  const [selectedCameraId, setSelectedCameraId] = useState(SYSTEM_DEVICE_ID);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [busy, setBusy] = useState<CoWorkingBusyKey>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [closeoutTarget, setCloseoutTarget] = useState<ActiveJoin | null>(null);
  const [closeoutTitle, setCloseoutTitle] = useState('');
  const [closeoutNotes, setCloseoutNotes] = useState('');
  const [closeoutDecisions, setCloseoutDecisions] = useState('');
  const [closeoutActions, setCloseoutActions] = useState('');
  const [sendToPaperclip, setSendToPaperclip] = useState(true);
  const [closeoutBusy, setCloseoutBusy] = useState(false);
  const [closeoutError, setCloseoutError] = useState<string | null>(null);

  // Realtime wiring (lounge audio)
  const sessionRef = useRef<RealtimeSession | null>(null);
  const localMicRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const localCamRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const localScreenRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const remoteStreamsRef = useRef<RemoteStream[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const clientInstanceId = useRef(newLocalId('coworking'));
  const activeJoinsRef = useRef<ActiveJoinMap>({});

  const loadMediaDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDeviceError('System media device list is unavailable in this renderer.');
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextAudio = devices
        .filter((device) => device.kind === 'audioinput')
        .map((device, index): DeviceChoice => ({
          id: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
          kind: 'audioinput',
        }));
      const nextOutputs = devices
        .filter((device) => device.kind === 'audiooutput')
        .map((device, index): DeviceChoice => ({
          id: device.deviceId,
          label: device.label || `Speaker ${index + 1}`,
          kind: 'audiooutput',
        }));
      const nextVideo = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index): DeviceChoice => ({
          id: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
          kind: 'videoinput',
        }));
      setAudioInputs(nextAudio);
      setAudioOutputs(nextOutputs);
      setVideoInputs(nextVideo);
      setSelectedMicId((current) => (
        current === SYSTEM_DEVICE_ID || nextAudio.some((device) => device.id === current)
          ? current
          : SYSTEM_DEVICE_ID
      ));
      setSelectedSpeakerId((current) => (
        current === SYSTEM_DEVICE_ID || nextOutputs.some((device) => device.id === current)
          ? current
          : SYSTEM_DEVICE_ID
      ));
      setSelectedCameraId((current) => (
        current === SYSTEM_DEVICE_ID || nextVideo.some((device) => device.id === current)
          ? current
          : SYSTEM_DEVICE_ID
      ));
      setDeviceError(null);
    } catch (err: any) {
      setDeviceError(err?.message ?? String(err));
    }
  }, []);

  const replaceActiveJoins = useCallback((updater: (current: ActiveJoinMap) => ActiveJoinMap) => {
    setActiveJoins((current) => {
      const next = updater(current);
      activeJoinsRef.current = next;
      return next;
    });
  }, []);

  const addActiveJoin = useCallback((entry: ActiveJoin) => {
    replaceActiveJoins((current) => ({ ...current, [entry.roomId]: entry }));
  }, [replaceActiveJoins]);

  const clearActiveJoin = useCallback((roomId: string) => {
    setCloseoutTarget((current) => (current?.roomId === roomId ? null : current));
    replaceActiveJoins((current) => {
      if (!current[roomId]) return current;
      const { [roomId]: _removed, ...next } = current;
      return next;
    });
  }, [replaceActiveJoins]);

  /* ---------------- loaders ---------------- */

  const loadFloor = useCallback(async () => {
    try {
      const result = await window.plexus.coworkingFloor();
      if (!result.ok) {
        setFloor([]);
        setFloorError(result.message ?? 'Floor presence unavailable.');
        return;
      }
      setFloor(result.floor ?? []);
      setFloorError(null);
    } catch (err: any) {
      setFloor([]);
      setFloorError(err?.message ?? String(err));
    } finally {
      setFloorLoading(false);
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const result = await window.plexus.realtimeRooms();
      if (!result.ok) {
        setRooms([]);
        setRoomsError(result.message ?? 'Project rooms unavailable.');
        return;
      }
      setRooms(result.rooms ?? []);
      setRoomsError(null);
    } catch (err: any) {
      setRooms([]);
      setRoomsError(err?.message ?? String(err));
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  const loadLounge = useCallback(async () => {
    try {
      const result = await window.plexus.coworkingLounge();
      if (!result.ok) {
        setLoungeError(result.message ?? 'Lounge unavailable.');
        return;
      }
      setLoungeRoom(result.room ?? null);
      setLoungeError(null);
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadFloor(), loadRooms(), loadLounge()]);
  }, [loadFloor, loadLounge, loadRooms]);

  useEffect(() => {
    refreshAll();
    const id = window.setInterval(refreshAll, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refreshAll]);

  useEffect(() => {
    loadMediaDevices();
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    mediaDevices.addEventListener('devicechange', loadMediaDevices);
    return () => mediaDevices.removeEventListener('devicechange', loadMediaDevices);
  }, [loadMediaDevices]);

  /* ---------------- lounge actions ---------------- */

  const stopLocalTracks = useCallback(() => {
    [localMicRef.current, localCamRef.current, localScreenRef.current].forEach((track) => {
      if (track) track.stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
    });
    localMicRef.current = null;
    localCamRef.current = null;
    localScreenRef.current = null;
    setMicActive(false);
    setCameraActive(false);
    setScreenActive(false);
  }, []);

  const clearRemoteStreams = useCallback(() => {
    remoteStreamsRef.current = [];
    setRemoteStreams([]);
  }, []);

  const leaveLounge = useCallback(async () => {
    const entry = Object.values(activeJoinsRef.current).find((join) => join.scope === 'lounge');
    if (!entry) return;
    setBusy('lounge_leave');
    try {
      stopLocalTracks();
      await sessionRef.current?.close();
      sessionRef.current = null;
      clearRemoteStreams();
      const result = await window.plexus.realtimeLeaveCall(entry.joined.call.id, entry.joined.participant.id);
      if (!result.ok && !shouldClearLocalAfterLeaveFailure(result.message)) {
        throw new Error(result.message ?? 'Could not leave lounge.');
      }
      clearActiveJoin(entry.roomId);
      setInfo('Left the lounge.');
      await Promise.all([loadRooms(), loadFloor()]);
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [clearActiveJoin, clearRemoteStreams, loadFloor, loadRooms, stopLocalTracks]);

  const leaveActiveJoin = useCallback(async (
    entry: ActiveJoin,
    options: { refresh?: boolean; silent?: boolean } = {},
  ) => {
    if (entry.scope === 'lounge' || entry.hasSession) {
      stopLocalTracks();
      await sessionRef.current?.close();
      sessionRef.current = null;
      clearRemoteStreams();
    }
    const result = await window.plexus.realtimeLeaveCall(entry.joined.call.id, entry.joined.participant.id);
    if (!result.ok && !shouldClearLocalAfterLeaveFailure(result.message)) {
      throw new Error(result.message ?? `Could not leave ${entry.roomName}.`);
    }
    clearActiveJoin(entry.roomId);
    if (!options.silent) setInfo(`Left ${entry.roomName}.`);
    if (options.refresh !== false) await Promise.all([loadRooms(), loadFloor()]);
  }, [clearActiveJoin, clearRemoteStreams, loadFloor, loadRooms, stopLocalTracks]);

  const leaveOtherActiveJoins = useCallback(async (targetRoomId: string) => {
    const others = Object.values(activeJoinsRef.current).filter((entry) => entry.roomId !== targetRoomId);
    for (const entry of others) {
      await leaveActiveJoin(entry, { refresh: false, silent: true });
    }
  }, [leaveActiveJoin]);

  const teardownActiveJoins = useCallback(() => {
    const entries = Object.values(activeJoinsRef.current);
    stopLocalTracks();
    sessionRef.current?.close();
    sessionRef.current = null;
    clearRemoteStreams();
    activeJoinsRef.current = {};
    replaceActiveJoins(() => ({}));
    entries.forEach((entry) => {
      void window.plexus.realtimeLeaveCall(entry.joined.call.id, entry.joined.participant.id);
    });
  }, [clearRemoteStreams, replaceActiveJoins, stopLocalTracks]);

  const joinLounge = useCallback(async () => {
    if (!loungeRoom) {
      setLoungeError('No lounge room available.');
      return;
    }
    if (activeJoinsRef.current[loungeRoom.id]) return;
    setBusy('lounge_join');
    setLoungeError(null);
    setInfo(null);
    let joined: RealtimeJoinResponse | null = null;
    try {
      await leaveOtherActiveJoins(loungeRoom.id);
      const result = await window.plexus.realtimeJoinRoom(loungeRoom.id, {
        clientInstanceId: clientInstanceId.current,
        intent: 'media',
        media: { audio: false, video: false, screen: false },
      });
      if (!result.ok || !result.joined) {
        setLoungeError(result.message ?? 'Could not join lounge.');
        return;
      }
      joined = result.joined;

      const session = new RealtimeSession(result.joined, {
        onRemoteTrack: (remote) => {
          const nextStreams = [
            ...remoteStreamsRef.current.filter((existing) => existing.trackId !== remote.trackId),
            remote,
          ];
          remoteStreamsRef.current = nextStreams;
          setRemoteStreams(nextStreams);
        },
        onRemoteTrackEnded: (trackId) => {
          const nextStreams = remoteStreamsRef.current.filter((existing) => existing.trackId !== trackId);
          remoteStreamsRef.current = nextStreams;
          setRemoteStreams(nextStreams);
        },
        onConnectionStateChange: () => {
          // Surfacing this in the UI is a later polish — for now we just log.
        },
        onError: (msg) => setLoungeError(msg),
      });
      await session.init();
      sessionRef.current = session;
      addActiveJoin({
        scope: 'lounge',
        roomId: loungeRoom.id,
        roomName: loungeRoom.name,
        roomType: loungeRoom.roomType,
        joined: result.joined,
        hasSession: true,
      });
      setInfo(result.joined.cloudflare.configured
        ? 'Joined lounge · media controls ready.'
        : 'Joined lounge · realtime provider not configured, so media intent is recorded without live tracks.');
      await Promise.all([loadRooms(), loadFloor()]);
    } catch (err: any) {
      if (joined) {
        await window.plexus.realtimeLeaveCall(joined.call.id, joined.participant.id);
      }
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [addActiveJoin, leaveOtherActiveJoins, loadFloor, loadRooms, loungeRoom]);

  const activeJoinList = useMemo(() => Object.values(activeJoins), [activeJoins]);
  const activeLoungeJoin = activeJoinList.find((entry) => entry.scope === 'lounge') ?? null;
  const loungeJoin = activeLoungeJoin?.joined ?? null;
  const closeoutOpen = Boolean(closeoutTarget);

  const openCloseout = useCallback((entry: ActiveJoin) => {
    setCloseoutTarget(entry);
    setCloseoutTitle(defaultCloseoutTitle(entry));
    setCloseoutNotes('');
    setCloseoutDecisions('');
    setCloseoutActions('');
    setSendToPaperclip(true);
    setCloseoutError(null);
  }, []);

  const closeCloseout = useCallback(() => {
    if (closeoutBusy) return;
    setCloseoutTarget(null);
    setCloseoutError(null);
  }, [closeoutBusy]);

  const saveCloseout = useCallback(async () => {
    if (!closeoutTarget) return;
    const manualNotes = closeoutNotes.trim();
    const decisions = splitCloseoutLines(closeoutDecisions);
    const actionItems = splitCloseoutLines(closeoutActions);
    if (!manualNotes && !decisions.length && !actionItems.length) {
      setCloseoutError('Add notes, a decision, or an action item before saving.');
      return;
    }
    setCloseoutBusy(true);
    setCloseoutError(null);
    try {
      const result = await window.plexus.realtimeCloseout(closeoutTarget.joined.call.id, {
        title: closeoutTitle.trim() || defaultCloseoutTitle(closeoutTarget),
        manualNotes,
        decisions,
        actionItems,
        linkedTimeEntryIds: [],
        linkedIssueIds: [],
        timeEntryId: null,
        sendToPaperclip,
      });
      if (!result.ok) {
        throw new Error(result.message ?? 'Could not save closeout.');
      }
      setInfo(`Closeout saved · ${paperclipStatusCopy(result.meeting, sendToPaperclip)}.`);
      setCloseoutTarget(null);
      setCloseoutTitle('');
      setCloseoutNotes('');
      setCloseoutDecisions('');
      setCloseoutActions('');
    } catch (err: any) {
      setCloseoutError(err?.message ?? String(err));
    } finally {
      setCloseoutBusy(false);
    }
  }, [closeoutActions, closeoutDecisions, closeoutNotes, closeoutTarget, closeoutTitle, sendToPaperclip]);

  const toggleMic = useCallback(async () => {
    if (!loungeJoin) return;
    if (micActive && localMicRef.current) {
      const track = localMicRef.current;
      track.stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      await sessionRef.current?.unpublishLocal(track.id);
      localMicRef.current = null;
      setMicActive(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setLoungeError('Microphone capture is unavailable in this renderer.');
      return;
    }
    setBusy('mic');
    try {
      const audio: boolean | MediaTrackConstraints = selectedMicId === SYSTEM_DEVICE_ID
        ? true
        : { deviceId: { exact: selectedMicId } };
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      const id = newLocalId('mic');
      localMicRef.current = { id, stream };
      const publishedTrackId = await sessionRef.current?.publishLocal(id, stream, 'audio', `${loungeJoin.participant.displayName} lounge mic`);
      if (!publishedTrackId) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        localMicRef.current = null;
        setMicActive(false);
        return;
      }
      setMicActive(true);
      await loadMediaDevices();
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [loadMediaDevices, loungeJoin, micActive, selectedMicId]);

  const toggleCamera = useCallback(async () => {
    if (!loungeJoin) return;
    if (cameraActive && localCamRef.current) {
      const track = localCamRef.current;
      track.stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      await sessionRef.current?.unpublishLocal(track.id);
      localCamRef.current = null;
      setCameraActive(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setLoungeError('Camera capture is unavailable in this renderer.');
      return;
    }
    setBusy('camera');
    try {
      const video: boolean | MediaTrackConstraints = selectedCameraId === SYSTEM_DEVICE_ID
        ? true
        : { deviceId: { exact: selectedCameraId } };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      const id = newLocalId('cam');
      localCamRef.current = { id, stream };
      const publishedTrackId = await sessionRef.current?.publishLocal(id, stream, 'camera', `${loungeJoin.participant.displayName} lounge camera`);
      if (!publishedTrackId) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        localCamRef.current = null;
        setCameraActive(false);
        return;
      }
      setCameraActive(true);
      await loadMediaDevices();
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [cameraActive, loadMediaDevices, loungeJoin, selectedCameraId]);

  const toggleScreen = useCallback(async () => {
    if (!loungeJoin) return;
    if (screenActive && localScreenRef.current) {
      const track = localScreenRef.current;
      track.stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      await sessionRef.current?.unpublishLocal(track.id);
      localScreenRef.current = null;
      setScreenActive(false);
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setLoungeError('Screen sharing is unavailable in this renderer. Check Screen Recording permission and restart Plexus if macOS has just granted it.');
      return;
    }
    setBusy('screen');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const id = newLocalId('screen');
      localScreenRef.current = { id, stream };
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          void sessionRef.current?.unpublishLocal(id);
          localScreenRef.current = null;
          setScreenActive(false);
        };
      });
      const publishedTrackId = await sessionRef.current?.publishLocal(id, stream, 'screen', `${loungeJoin.participant.displayName} screen share`);
      if (!publishedTrackId) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        localScreenRef.current = null;
        setScreenActive(false);
        return;
      }
      setScreenActive(true);
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [loungeJoin, screenActive]);

  /* ---------------- room actions ---------------- */

  const dropInToRoom = useCallback(async (room: RealtimeRoom) => {
    if (activeJoinsRef.current[room.id]) return;
    setRoomActionTargetId(room.id);
    setBusy('drop_in');
    setRoomsError(null);
    setInfo(null);
    try {
      await leaveOtherActiveJoins(room.id);
      const result = await window.plexus.realtimeJoinRoom(room.id, {
        clientInstanceId: clientInstanceId.current,
        intent: room.activeCallId ? 'media' : 'presence_only',
        media: { audio: Boolean(room.activeCallId), video: false, screen: false },
      });
      if (!result.ok || !result.joined) {
        setRoomsError(result.message ?? 'Could not drop into room.');
      } else {
        addActiveJoin({
          scope: 'project_room',
          roomId: room.id,
          roomName: room.name,
          roomType: room.roomType,
          joined: result.joined,
          hasSession: false,
        });
        setInfo(`Dropped into ${room.name}.`);
        await loadRooms();
        await loadFloor();
      }
    } catch (err: any) {
      setRoomsError(err?.message ?? String(err));
    } finally {
      setBusy(null);
      setRoomActionTargetId(null);
    }
  }, [addActiveJoin, leaveOtherActiveJoins, loadFloor, loadRooms]);

  const leaveProjectRoom = useCallback(async (room: RealtimeRoom) => {
    const entry = activeJoinsRef.current[room.id];
    if (!entry) return;
    setRoomActionTargetId(room.id);
    setBusy('room_leave');
    setRoomsError(null);
    try {
      await leaveActiveJoin(entry, { silent: true });
      setInfo(`Left ${room.name}.`);
    } catch (err: any) {
      setRoomsError(err?.message ?? String(err));
    } finally {
      setBusy(null);
      setRoomActionTargetId(null);
    }
  }, [leaveActiveJoin]);

  /* ---------------- cleanup on unmount ---------------- */

  useEffect(() => {
    return () => {
      teardownActiveJoins();
    };
  }, [teardownActiveJoins]);

  useEffect(() => {
    window.addEventListener('plexus:session-teardown', teardownActiveJoins);
    return () => window.removeEventListener('plexus:session-teardown', teardownActiveJoins);
  }, [teardownActiveJoins]);

  /* ---------------- derived: counts for headers ---------------- */

  const floorCounts = useMemo(() => {
    const counts: Record<CoWorkingRingState, number> = { timing: 0, online: 0, lounge: 0, idle: 0 };
    for (const presence of floor) counts[presence.ringState] += 1;
    return counts;
  }, [floor]);

  const onlineCount = floorCounts.timing + floorCounts.online + floorCounts.lounge;
  const floorSubtitle = floor.length
    ? `${floorCounts.timing} timing · ${floorCounts.online} online · ${floorCounts.idle} idle`
    : 'no presence data yet';

  const loungeMembers = floor.filter((presence) => presence.ringState === 'lounge');
  const loungeSpeakerNames = loungeMembers.slice(0, 3).map((m) => m.displayName.split(' ')[0]).join(' + ');
  const loungeStrapline = loungeMembers.length
    ? `${loungeSpeakerNames || 'In lounge'} · ambient · ${loungeMembers.length} ${loungeMembers.length === 1 ? 'voice' : 'voices'}`
    : 'lounge is calm · drop in to break the silence';
  const inLounge = Boolean(activeLoungeJoin);
  const remoteAudioStreams = useMemo(
    () => remoteStreams.filter((remote) => remote.trackKind === 'audio'),
    [remoteStreams],
  );
  const localScreenPublisher = screenActive && loungeJoin ? loungeJoin.participant.displayName : null;
  const handleRemoteAudioError = useCallback((message: string) => {
    setDeviceError(message);
  }, []);

  /* ---------------- floor activation ---------------- */

  const focusRoomFromFloor = useCallback((presence: FloorPresence) => {
    if (!presence.roomId) return;
    const room = rooms.find((candidate) => candidate.id === presence.roomId);
    if (room) {
      // Same UX as clicking the "+ DROP IN" CTA on a room card — keeps the
      // floor tile a meaningful affordance instead of dead decoration.
      dropInToRoom(room);
    }
  }, [dropInToRoom, rooms]);

  /* ============================================================
   * Render
   * ============================================================ */
  return (
    <div className="px-fadein">
      <PageHeader
        title="Co-working"
        sub="ambient presence · project rooms · drop-in lounge"
        right={
          inLounge ? (
            <Button variant="stop" onClick={leaveLounge} disabled={busy === 'lounge_leave'}>
              <IconClose s={14} /> {busy === 'lounge_leave' ? 'LEAVING' : 'LEAVE LOUNGE'}
            </Button>
          ) : (
            <Button variant="accent" onClick={joinLounge} disabled={!loungeRoom || busy === 'lounge_join'}>
              <IconMic s={14} /> {busy === 'lounge_join' ? 'JOINING' : 'JOIN LOUNGE'}
            </Button>
          )
        }
      />

      {/* ============================================================
        * §01 · TODAY'S FLOOR
        * ============================================================ */}
      <InstrumentPanel
        label="01 · today's floor"
        title="Ambient presence"
        note={floorSubtitle}
        actions={<StatusChip tone={onlineCount ? 'accent' : 'idle'}>{onlineCount} present</StatusChip>}
        className="px-coworking-section"
        trace
      >

        {floorError && (
          <DegradedStatePanel title="Floor offline" message={floorError} tone="error" />
        )}

        {floorLoading && !floor.length && !floorError && (
          <Skeleton lines={3} widths={['80%', '65%', '90%']} />
        )}

        {!floorLoading && !floor.length && !floorError && (
          <EmptyStatePanel
            icon={<IconUsers s={24} />}
            title="No-one on the floor yet today"
            message="Presence appears here when members open Plexus or join rooms."
          />
        )}

        {floor.length > 0 && (
          <div className="px-floor-grid">
            {floor.map((presence) => (
              <AvatarTile
                key={presence.participantId}
                presence={presence}
                onActivate={focusRoomFromFloor}
              />
            ))}
          </div>
        )}
      </InstrumentPanel>

      {/* ============================================================
        * §02 · PROJECT ROOMS
        * ============================================================ */}
      <InstrumentPanel
        label="02 · project rooms"
        title="Project co-working rooms"
        note="Anchored by project · drop in to co-work."
        actions={<StatusChip tone={rooms.length ? 'accent' : 'idle'}>{rooms.length} rooms</StatusChip>}
        className="px-coworking-section"
      >

        {roomsError && (
          <DegradedStatePanel title="Rooms offline" message={roomsError} tone="error" />
        )}

        {roomsLoading && !rooms.length && !roomsError && (
          <Skeleton lines={4} widths={['70%', '55%', '80%', '60%']} />
        )}

        {!roomsLoading && !rooms.length && !roomsError && (
          <EmptyStatePanel
            icon={<IconCloud s={24} />}
            title="No project rooms configured yet"
            message="Workspace rooms appear once project room state is available."
          />
        )}

        {rooms.length > 0 && (
          <div className="px-room-grid">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                floor={floor}
                onDropIn={dropInToRoom}
                onLeave={leaveProjectRoom}
                onCloseout={openCloseout}
                activeJoin={activeJoins[room.id]}
                pending={(busy === 'drop_in' || busy === 'room_leave') && roomActionTargetId === room.id}
              />
            ))}
          </div>
        )}
      </InstrumentPanel>

      {/* ============================================================
        * §03 · AMBIENT LOUNGE
        * ============================================================ */}
      <InstrumentPanel
        label="03 · ambient lounge"
        title="Drop-in lounge"
        note={loungeStrapline}
        actions={inLounge ? (
          <span className="px-lounge-pill live">
            <span className="px-dot pulse" /> IN LOUNGE
          </span>
        ) : (
          <StatusChip tone={loungeMembers.length ? 'accent' : 'idle'}>
            {loungeMembers.length ? `${loungeMembers.length} ambient` : 'calm'}
          </StatusChip>
        )}
        className="px-coworking-section px-lounge-strip"
      >

        {loungeError && (
          <DegradedStatePanel title="Lounge error" message={loungeError} tone="error" />
        )}

        {!inLounge && (
          <div className="px-lounge-idle">
            <div className="px-lounge-idle-copy">
              <span className="px-lbl">drop in for ambient co-presence — open mic, no agenda.</span>
            </div>
            <Button variant="accent" onClick={joinLounge} disabled={!loungeRoom || busy === 'lounge_join'}>
              <IconMic s={14} /> {busy === 'lounge_join' ? 'JOINING' : 'JOIN LOUNGE'}
            </Button>
          </div>
        )}

        {inLounge && (
          <div className="px-lounge-active">
            <div className="px-lounge-left">
              <MiniAvatarCluster members={loungeMembers} cap={5} />
            </div>

            <div className="px-lounge-center">
              <LoungeWaveform active={loungeMembers.some((m) => m.isSpeaking)} />
              <div className="px-lounge-center-copy">
                <span className="px-lbl px-lounge-strapline">{loungeStrapline}</span>
                <div className="px-lounge-signal-row" aria-label="Lounge privacy and media state">
                  <span className="px-lounge-live-chip"><IconCheck s={10} /> AUDIT</span>
                  <span className="px-lounge-live-chip muted">NO REC</span>
                  <span className="px-lounge-live-chip muted">NO TRANSCRIPT</span>
                  {localScreenPublisher && (
                    <span className="px-lounge-live-chip screen"><IconScreen s={10} /> {localScreenPublisher}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-lounge-devices" aria-label="System media device choices">
              <label>
                <span>mic</span>
                <Select
                  value={selectedMicId}
                  onChange={(event) => setSelectedMicId(event.target.value)}
                  disabled={micActive || busy === 'mic'}
                  aria-label="Choose microphone"
                  title={micActive ? 'Turn the microphone off before changing input.' : 'Choose the system microphone for this lounge.'}
                >
                  <option value={SYSTEM_DEVICE_ID}>System microphone</option>
                  {audioInputs.map((device) => (
                    <option key={device.id} value={device.id}>{device.label}</option>
                  ))}
                </Select>
              </label>
              <label>
                <span><IconSpeaker s={9} /> speaker</span>
                <Select
                  value={selectedSpeakerId}
                  onChange={(event) => setSelectedSpeakerId(event.target.value)}
                  aria-label="Choose speaker"
                  title="Choose the system speaker for lounge audio."
                >
                  <option value={SYSTEM_DEVICE_ID}>System speaker</option>
                  {audioOutputs.map((device) => (
                    <option key={device.id} value={device.id}>{device.label}</option>
                  ))}
                </Select>
              </label>
              <label>
                <span>camera</span>
                <Select
                  value={selectedCameraId}
                  onChange={(event) => setSelectedCameraId(event.target.value)}
                  disabled={cameraActive || busy === 'camera'}
                  aria-label="Choose camera"
                  title={cameraActive ? 'Turn the camera off before changing input.' : 'Choose the system camera for this lounge.'}
                >
                  <option value={SYSTEM_DEVICE_ID}>System camera</option>
                  {videoInputs.map((device) => (
                    <option key={device.id} value={device.id}>{device.label}</option>
                  ))}
                </Select>
              </label>
              <button
                type="button"
                className="px-lounge-device-refresh"
                onClick={loadMediaDevices}
                aria-label="Refresh media devices"
                title="Refresh microphone, speaker, and camera choices from the operating system"
              >
                <IconSync s={12} />
              </button>
            </div>

            <div className="px-lounge-controls">
              <button
                type="button"
                className={`px-lounge-ctl${micActive ? ' on' : ''}`}
                onClick={toggleMic}
                disabled={busy === 'mic'}
                aria-label={micActive ? 'Mute microphone' : 'Unmute microphone'}
                aria-pressed={micActive}
              >
                <IconMic s={14} />
              </button>
              <button
                type="button"
                className={`px-lounge-ctl${cameraActive ? ' on' : ''}`}
                onClick={toggleCamera}
                disabled={busy === 'camera'}
                aria-label={cameraActive ? 'Disable camera' : 'Enable camera'}
                aria-pressed={cameraActive}
              >
                <IconCamera s={14} />
              </button>
              <button
                type="button"
                className={`px-lounge-ctl${screenActive ? ' on' : ''}`}
                onClick={toggleScreen}
                disabled={busy === 'screen'}
                aria-label={screenActive ? 'Stop screen sharing' : 'Share screen'}
                aria-pressed={screenActive}
                title="Open the native screen picker"
              >
                <IconScreen s={14} />
              </button>
              <button
                type="button"
                className={`px-lounge-ctl${captionsOn ? ' on' : ''}`}
                onClick={() => setCaptionsOn((current) => !current)}
                aria-label={captionsOn ? 'Hide captions' : 'Show captions'}
                aria-pressed={captionsOn}
                title="Captions"
              >
                <IconKeyboard s={14} />
              </button>
              <button
                type="button"
                className="px-lounge-ctl closeout"
                onClick={() => activeLoungeJoin && openCloseout(activeLoungeJoin)}
                disabled={!activeLoungeJoin || closeoutBusy}
                aria-label="Save lounge closeout"
                title="Save meeting memory"
              >
                <IconPaperclip s={14} />
              </button>
              <button
                type="button"
                className="px-lounge-ctl danger"
                onClick={leaveLounge}
                disabled={busy === 'lounge_leave'}
                aria-label="Leave lounge"
              >
                <IconClose s={14} />
              </button>
            </div>
            <div className="px-lounge-remote-audio" aria-hidden="true">
              {remoteAudioStreams.map((remote) => (
                <RemoteAudioSink
                  key={remote.trackId}
                  remote={remote}
                  outputDeviceId={selectedSpeakerId}
                  onError={handleRemoteAudioError}
                />
              ))}
            </div>
            {deviceError && (
              <div className="px-lounge-device-error" role="alert">
                {deviceError}
              </div>
            )}
          </div>
        )}
      </InstrumentPanel>

      {closeoutOpen && closeoutTarget && (
        <Modal title={`Closeout - ${closeoutTarget.roomName}`} onClose={closeCloseout} width={560}>
          <div className="px-closeout-form">
            <Field label="Title">
              <Input
                value={closeoutTitle}
                onChange={(event) => setCloseoutTitle(event.target.value)}
                disabled={closeoutBusy}
              />
            </Field>
            <Field label="Notes">
              <Textarea
                value={closeoutNotes}
                onChange={(event) => setCloseoutNotes(event.target.value)}
                disabled={closeoutBusy}
              />
            </Field>
            <Field label="Decisions - one per line">
              <Textarea
                value={closeoutDecisions}
                onChange={(event) => setCloseoutDecisions(event.target.value)}
                disabled={closeoutBusy}
              />
            </Field>
            <Field label="Action items - one per line">
              <Textarea
                value={closeoutActions}
                onChange={(event) => setCloseoutActions(event.target.value)}
                disabled={closeoutBusy}
              />
            </Field>
            <label className="px-closeout-check">
              <input
                type="checkbox"
                checked={sendToPaperclip}
                onChange={(event) => setSendToPaperclip(event.target.checked)}
                disabled={closeoutBusy}
              />
              <span>Paperclip handoff</span>
            </label>
            {closeoutError && (
              <DegradedStatePanel title="Closeout blocked" message={closeoutError} tone="error" />
            )}
            <div className="px-closeout-actions">
              <Button type="button" variant="ghost" onClick={closeCloseout} disabled={closeoutBusy}>
                CANCEL
              </Button>
              <Button type="button" onClick={saveCloseout} disabled={closeoutBusy}>
                <IconPaperclip s={14} /> {closeoutBusy ? 'SAVING' : 'SAVE CLOSEOUT'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {info && (
        <div className="px-coworking-info" role="status">
          <StatusChip tone="accent"><IconCheck s={11} /> {info}</StatusChip>
          <span className="px-lbl">
            <IconClock s={11} /> refreshes every {Math.round(REFRESH_INTERVAL_MS / 1000)}s
          </span>
        </div>
      )}
    </div>
  );
}
