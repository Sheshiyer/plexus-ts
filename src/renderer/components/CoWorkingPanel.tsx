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
import MediaDock from './coworking/MediaDock';
import { defaultAvatarDataUri } from '../lib/defaultAvatar';
import {
  DegradedStatePanel,
  EmptyStatePanel,
  StatusChip,
} from './PlexusUI';
import type {
  CoWorkingRingState,
  FloorPresence,
  RealtimeJoinResponse,
  RealtimeMeetingRecord,
  RealtimeRoom,
  RealtimeRoomDetail,
  RealtimeRoomType,
} from '../../shared/types';
import { RealtimeSession, type RemoteStream } from '../lib/RealtimeSession';
import {
  buildProjectRoomJoinRequest,
  deriveFocusedZone,
  deriveLoungeLayer,
  deriveScreenWall,
  listProjectRoomOptions,
  type CoWorkingScreenWall,
} from '../lib/coworkingModel';
import { deriveDockState } from '../lib/dock-model';

/* ------------------------------------------------------------------
 * Plexus Co-working surface
 * ------------------------------------------------------------------
 * Replaces RealtimeCapturePanel with one personal studio:
 *   §01 · MY BENCH         – one selected project stage
 *   §02 · TEAM BENCHES     – ambient, compact presence rail
 *   §03 · AMBIENT LOUNGE   – integrated voice strip + controls
 *
 * Visual contract:        docs/design/screen-references/co-working-my-studio-page-v1.png
 * Component contract:     docs/design/screen-references/co-working-my-studio-components-v1.png
 * Brand contract:         FORMA system (theme.css tokens)
 *
 * Data wiring:
 *   – window.plexus.coworkingFloor()      → §02 bench rail (Phase C)
 *   – window.plexus.coworkingLounge()     → §03 lounge room handle (Phase C)
 *   – window.plexus.realtimeRooms()       → §01 project selector + stage
 *   – RealtimeSession (lib/RealtimeSession.ts) for lounge audio publish/subscribe
 *
 * Refresh cadence: 15s polling for floor + rooms.
 * ------------------------------------------------------------------ */

const REFRESH_INTERVAL_MS = 15000;

// Project-room media publishing is wired through the same RealtimeSession the
// Ambient Lounge uses (see dropInToRoom). Actual readiness is derived at
// runtime from the join response's `cloudflare.configured` — until the Worker
// has SFU credentials the controls stay disabled, then activate automatically.
// This constant is only a code-level kill switch.
const PROJECT_MEDIA_WIRING_ENABLED = true;

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
 * §02 · Team bench (ambient presence cell)
 * ============================================================ */

function TeamBench({
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
  const stateLabel = presence.ringState === 'timing'
    ? 'FOCUSED'
    : presence.ringState === 'online'
      ? 'AVAILABLE'
      : presence.ringState === 'lounge'
        ? 'IN LOUNGE'
        : 'AWAY';
  return (
    <button
      type="button"
      className={`px-bench-tile ${presence.ringState}${clickable ? '' : ' static'}`}
      onClick={handleClick}
      disabled={!clickable}
      aria-label={`${presence.displayName} — ${presence.ringState}${presence.roomName ? ` in ${presence.roomName}` : ''}`}
    >
      <span className="px-bench-monogram">
        <span>{presence.initials}</span>
        <img className="px-bench-photo" src={defaultAvatarDataUri(presence.participantId)} alt="" aria-hidden="true" />
      </span>
      <span className="px-bench-copy">
        <span className="px-bench-name">{presence.displayName}</span>
        <span className="px-bench-project">{presence.projectTag ?? presence.roomName ?? 'Unassigned'}</span>
      </span>
      <span className="px-bench-state">
        <span>{presence.isSpeaking ? 'SPEAKING' : stateLabel}</span>
        <span className="px-bench-signal" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
    </button>
  );
}

/* ============================================================
 * §01 · Focused room and media shell
 * ============================================================ */

type ActiveJoinScope = 'lounge' | 'project_room';

type ActiveJoin = {
  scope: ActiveJoinScope;
  roomId: string;
  roomName: string;
  roomType: RealtimeRoomType;
  joined: RealtimeJoinResponse;
  hasSession: boolean;
  joinedAt: string;
};

type ActiveJoinMap = Record<string, ActiveJoin>;

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

/* Cluster of small (32px) identities for room and lounge context. Derives initials
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
          <span className="px-mini-initials">{member.initials}</span>
          <img className="px-avatar-photo" src={defaultAvatarDataUri(member.participantId)} alt="" aria-hidden="true" />
        </span>
      ))}
      {overflow > 0 && <span className="px-mini-avatar overflow">+{overflow}</span>}
    </span>
  );
}

function ScreenWall({
  wall,
  onPin,
}: {
  wall: CoWorkingScreenWall;
  onPin: (trackId: string | null) => void;
}) {
  if (!wall.tiles.length) {
    return (
      <div className="px-screen-wall-empty">
        <IconScreen s={30} />
        <strong>No screen shares in this project room</strong>
        <span>When someone shares, this stage becomes the room wall. Native screen picking stays unchanged.</span>
      </div>
    );
  }

  return (
    <div className={`px-screen-wall-grid ${wall.mode}`}>
      {wall.tiles.map((tile) => (
        <button
          key={tile.trackId}
          type="button"
          className={`px-screen-wall-tile${tile.pinned ? ' pinned' : ''}`}
          onClick={() => onPin(tile.pinned ? null : tile.trackId)}
          aria-pressed={tile.pinned}
        >
          <span className="px-screen-wall-preview">
            <IconScreen s={34} />
          </span>
          <span className="px-screen-wall-meta">
            <strong>{tile.label}</strong>
            <small>{tile.pinned ? 'Pinned screen' : 'Click to pin'}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function FocusedRoomStage({
  zone,
  wall,
  roomDetailError,
  fullscreen,
  activeJoin,
  pending,
  onDropIn,
  onPin,
  onToggleFullscreen,
}: {
  zone: ReturnType<typeof deriveFocusedZone>;
  wall: CoWorkingScreenWall;
  roomDetailError: string | null;
  fullscreen: boolean;
  activeJoin?: ActiveJoin;
  pending: boolean;
  onDropIn: (room: RealtimeRoom) => void;
  onPin: (trackId: string | null) => void;
  onToggleFullscreen: () => void;
}) {
  const room = zone.room;
  return (
    <section className={`px-room-stage${fullscreen ? ' fullscreen' : ''}`} aria-label="Project stage · My bench">
      <header className="px-room-stage-head">
        <div>
          <span className="px-lbl">My bench</span>
          <h3>{zone.projectName || 'Select a project room'}</h3>
          <p>
            {zone.joinState === 'presence_only' ? 'presence-only room' : 'not joined'} · {zone.members.length} people · {wall.tiles.length} screens
            {!activeJoin && ' · drop in — presence-only until you enable media'}
          </p>
        </div>
        <div className="px-room-stage-actions">
          <Button variant="ghost" onClick={onToggleFullscreen} disabled={!room}>
            <IconScreen s={13} /> {fullscreen ? 'Exit stage' : 'Fullscreen'}
          </Button>
          {room && !activeJoin && (
            <Button variant="accent" onClick={() => onDropIn(room)} disabled={pending}>
              <IconUsers s={12} /> {pending ? 'Joining' : 'Join'}
            </Button>
          )}
          {room && activeJoin && (
            <span className="px-stage-joined-chip"><span className="px-dot pulse" /> Joined · controls in the dock below</span>
          )}
        </div>
      </header>

      {roomDetailError && <DegradedStatePanel title="Room detail unavailable" message={roomDetailError} tone="warning" />}

      <div className="px-room-stage-body">
        <div className="px-screen-wall">
          <div className="px-screen-wall-head" aria-label="Screen wall">
            <span className="px-lbl">Current focus</span>
            <StatusChip tone={wall.tiles.length ? 'accent' : 'idle'}>{wall.mode}</StatusChip>
          </div>
          <ScreenWall wall={wall} onPin={onPin} />
        </div>

        <aside className="px-room-member-strip" aria-label="People in focused room">
          <span className="px-lbl">People</span>
          {zone.members.length ? (
            zone.members.map((member) => (
              <div key={member.participantId} className="px-room-member-pill">
                <span className="px-mini-avatar">
                  <span className="px-mini-initials">{member.initials}</span>
                  <img className="px-avatar-photo" src={defaultAvatarDataUri(member.participantId)} alt="" aria-hidden="true" />
                </span>
                <span>
                  <strong>{member.displayName}</strong>
                  <small>{member.isSpeaking ? 'speaking' : member.ringState}</small>
                </span>
              </div>
            ))
          ) : (
            <div className="px-room-member-empty">No one is present in this room yet.</div>
          )}
        </aside>
      </div>
    </section>
  );
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
  const [rhythmState, setRhythmState] = useState<'loading' | 'enabled' | 'paused' | 'unavailable'>('loading');

  // §02 project rooms
  const [rooms, setRooms] = useState<RealtimeRoom[]>([]);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomActionTargetId, setRoomActionTargetId] = useState<string | null>(null);
  const [activeJoins, setActiveJoins] = useState<ActiveJoinMap>({});
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomDetails, setRoomDetails] = useState<Record<string, RealtimeRoomDetail>>({});
  const [roomDetailError, setRoomDetailError] = useState<string | null>(null);
  const [pinnedTrackId, setPinnedTrackId] = useState<string | null>(null);
  const [stageFullscreen, setStageFullscreen] = useState(false);
  const stageFullscreenReturnRef = useRef<HTMLElement | null>(null);
  const toggleStageFullscreen = useCallback(() => {
    setStageFullscreen((current) => {
      if (!current) {
        // Entering fullscreen: remember the trigger so focus returns on exit.
        stageFullscreenReturnRef.current = document.activeElement as HTMLElement | null;
      }
      return !current;
    });
  }, []);
  // Escape closes the fullscreen stage without hiding leave/stop controls.
  // If a modal (e.g. closeout) is open it owns Escape, so leave the stage alone.
  useEffect(() => {
    if (!stageFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.px-modal')) return;
      setStageFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stageFullscreen]);
  // Restore focus to the fullscreen trigger when the stage collapses.
  useEffect(() => {
    if (stageFullscreen) return;
    const trigger = stageFullscreenReturnRef.current;
    if (trigger && typeof trigger.focus === 'function') {
      trigger.focus();
    }
    stageFullscreenReturnRef.current = null;
  }, [stageFullscreen]);

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

  useEffect(() => {
    let disposed = false;
    window.plexus.settingsGet()
      .then((settings) => {
        if (!disposed) setRhythmState(settings.rhythmProfile.enabled ? 'enabled' : 'paused');
      })
      .catch(() => {
        if (!disposed) setRhythmState('unavailable');
      });
    return () => {
      disposed = true;
    };
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
        joinedAt: new Date().toISOString(),
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
  // Only one media-capable join exists at a time (lounge XOR one project
  // room — enforced by leaveOtherActiveJoins), so the toggles operate on
  // whichever join owns the shared sessionRef.
  const activeMediaEntry = activeJoinList.find((entry) => entry.hasSession) ?? null;
  const activeMediaJoin = activeMediaEntry?.joined ?? null;
  const activeMediaScopeLabel = activeMediaEntry?.scope === 'lounge' ? 'lounge' : 'project';
  const closeoutOpen = Boolean(closeoutTarget);

  const dockState = useMemo(() => deriveDockState({
    joins: activeJoinList.map((entry) => ({
      scope: entry.scope === 'lounge' ? 'lounge' as const : 'project_room' as const,
      roomId: entry.roomId,
      roomName: entry.scope === 'lounge' ? 'Ambient Lounge' : entry.roomName,
      hasSession: entry.hasSession,
      cloudflareConfigured: Boolean(entry.joined.cloudflare.configured),
      participantCount: remoteStreams.length + 1,
      joinedAt: entry.joinedAt,
    })),
    busy,
    wiringEnabled: PROJECT_MEDIA_WIRING_ENABLED,
  }), [activeJoinList, busy, remoteStreams.length]);

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
    if (!activeMediaJoin) return;
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
      const publishedTrackId = await sessionRef.current?.publishLocal(id, stream, 'audio', `${activeMediaJoin.participant.displayName} ${activeMediaScopeLabel} mic`);
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
  }, [activeMediaJoin, activeMediaScopeLabel, loadMediaDevices, micActive, selectedMicId]);

  const toggleCamera = useCallback(async () => {
    if (!activeMediaJoin) return;
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
      const publishedTrackId = await sessionRef.current?.publishLocal(id, stream, 'camera', `${activeMediaJoin.participant.displayName} ${activeMediaScopeLabel} camera`);
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
  }, [activeMediaJoin, activeMediaScopeLabel, cameraActive, loadMediaDevices, selectedCameraId]);

  const toggleScreen = useCallback(async () => {
    if (!activeMediaJoin) return;
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
      const publishedTrackId = await sessionRef.current?.publishLocal(id, stream, 'screen', `${activeMediaJoin.participant.displayName} screen share`);
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
  }, [activeMediaJoin, screenActive]);

  /* ---------------- room actions ---------------- */

  const dropInToRoom = useCallback(async (room: RealtimeRoom) => {
    if (activeJoinsRef.current[room.id]) return;
    setRoomActionTargetId(room.id);
    setBusy('drop_in');
    setRoomsError(null);
    setInfo(null);
    let joined: RealtimeJoinResponse | null = null;
    try {
      await leaveOtherActiveJoins(room.id);
      const result = await window.plexus.realtimeJoinRoom(
        room.id,
        buildProjectRoomJoinRequest(room, clientInstanceId.current),
      );
      if (!result.ok || !result.joined) {
        setRoomsError(result.message ?? 'Could not drop into room.');
      } else {
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
          onConnectionStateChange: () => {},
          onError: (msg) => setRoomsError(msg),
        });
        await session.init();
        sessionRef.current = session;
        addActiveJoin({
          scope: 'project_room',
          roomId: room.id,
          roomName: room.name,
          roomType: room.roomType,
          joined: result.joined,
          hasSession: true,
          joinedAt: new Date().toISOString(),
        });
        setInfo(`Dropped into ${room.name}.`);
        await loadRooms();
        await loadFloor();
      }
    } catch (err: any) {
      if (joined) {
        await window.plexus.realtimeLeaveCall(joined.call.id, joined.participant.id);
      }
      setRoomsError(err?.message ?? String(err));
    } finally {
      setBusy(null);
      setRoomActionTargetId(null);
    }
  }, [addActiveJoin, leaveOtherActiveJoins, loadFloor, loadRooms]);

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
    ? `${floorCounts.lounge} lounge · ${floorCounts.timing} focused · ${floorCounts.online} available`
    : 'no live app sessions yet';
  const floorState = onlineCount === 0
    ? 'QUIET'
    : floorCounts.lounge >= Math.max(3, floorCounts.timing)
      ? 'SOCIAL'
      : floorCounts.timing >= Math.max(2, floorCounts.online)
        ? 'FOCUSED'
        : 'CALM';
  const rhythmLabel = `PRIVATE RHYTHM · ${rhythmState.toUpperCase()}`;
  const visibleBenchMembers = floor.slice(0, 6);
  const hiddenBenchCount = Math.max(0, floor.length - visibleBenchMembers.length);

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
  const projectRoomTracks = useMemo(
    () => Object.values(roomDetails).flatMap((detail) => detail.tracks),
    [roomDetails],
  );
  const roomOptions = useMemo(
    () => listProjectRoomOptions(rooms, floor, projectRoomTracks),
    [floor, projectRoomTracks, rooms],
  );
  const selectedProjectRoom = useMemo(() => (
    roomOptions.find((option) => option.roomId === selectedRoomId)?.room
    ?? roomOptions[0]?.room
    ?? null
  ), [roomOptions, selectedRoomId]);
  const selectedRoomDetail = selectedProjectRoom ? roomDetails[selectedProjectRoom.id] ?? null : null;
  const activeProjectJoin = selectedProjectRoom ? activeJoins[selectedProjectRoom.id] : undefined;
  const focusedZone = useMemo(() => deriveFocusedZone({
    selectedRoom: selectedProjectRoom,
    activeRoomId: activeProjectJoin?.roomId ?? null,
    floor,
    tracks: selectedRoomDetail?.tracks ?? [],
    pinnedTrackId,
  }), [activeProjectJoin?.roomId, floor, pinnedTrackId, selectedProjectRoom, selectedRoomDetail?.tracks]);
  const screenWall = useMemo(
    () => deriveScreenWall(focusedZone.screenTracks, focusedZone.pinnedTrackId),
    [focusedZone.pinnedTrackId, focusedZone.screenTracks],
  );
  const loungeLayer = useMemo(() => deriveLoungeLayer({
    loungeRoom,
    floor,
    projectZoneActive: Boolean(selectedProjectRoom),
  }), [floor, loungeRoom, selectedProjectRoom]);
  const localScreenPublisher = screenActive && loungeJoin ? loungeJoin.participant.displayName : null;
  const handleRemoteAudioError = useCallback((message: string) => {
    setDeviceError(message);
  }, []);
  const dockParticipants = useMemo(() => (
    activeMediaEntry?.scope === 'lounge'
      ? loungeMembers.map((p) => ({ id: p.participantId, initials: p.initials }))
      : focusedZone.members.map((m) => ({ id: m.participantId, initials: m.initials }))
  ), [activeMediaEntry?.scope, loungeMembers, focusedZone.members]);
  const deviceControlsNode = (
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
  );

  /* ---------------- floor activation ---------------- */

  const focusRoomFromFloor = useCallback((presence: FloorPresence) => {
    if (!presence.roomId) return;
    const room = rooms.find((candidate) => candidate.id === presence.roomId);
    if (room) {
      setSelectedRoomId(room.id);
    }
  }, [rooms]);

  useEffect(() => {
    if (!roomOptions.length) {
      setSelectedRoomId(null);
      return;
    }
    if (!selectedRoomId || !roomOptions.some((option) => option.roomId === selectedRoomId)) {
      setSelectedRoomId(roomOptions[0].roomId);
    }
  }, [roomOptions, selectedRoomId]);

  useEffect(() => {
    if (!selectedProjectRoom) {
      setRoomDetailError(null);
      return undefined;
    }
    let disposed = false;
    window.plexus.realtimeRoomDetail(selectedProjectRoom.id)
      .then((result) => {
        if (disposed) return;
        if (!result.ok || !result.detail) {
          setRoomDetailError(result.message ?? 'Room detail unavailable.');
          return;
        }
        setRoomDetails((current) => ({ ...current, [selectedProjectRoom.id]: result.detail! }));
        setRoomDetailError(null);
      })
      .catch((err: any) => {
        if (!disposed) setRoomDetailError(err?.message ?? String(err));
      });
    return () => {
      disposed = true;
    };
  }, [selectedProjectRoom]);

  /* ============================================================
   * Render
   * ============================================================ */
  return (
    <div className="px-fadein px-coworking-studio">
      <PageHeader title="Co-working" sub="my studio · focus stage · ambient team presence" />

      <section className="px-coworking-telemetry" aria-label="Coworking telemetry">
        <div className="px-studio-telemetry-cell">
          <strong className="px-studio-telemetry-main">{onlineCount}</strong>
          <span className="px-studio-telemetry-sub">ONLINE</span>
        </div>
        <div className="px-studio-telemetry-cell">
          <strong className="px-studio-telemetry-main">{floorCounts.timing}</strong>
          <span className="px-studio-telemetry-sub">FOCUSED</span>
        </div>
        <div className="px-studio-telemetry-cell">
          <strong className="px-studio-telemetry-main">{floorCounts.lounge}</strong>
          <span className="px-studio-telemetry-sub">IN LOUNGE</span>
        </div>
        <div className="px-studio-telemetry-cell">
          <strong className="px-studio-telemetry-main">FLOOR</strong>
          <span className="px-studio-telemetry-sub">{floorState}</span>
        </div>
        <div className="px-studio-telemetry-cell px-studio-telemetry-rhythm">
          <span>
            <strong className="px-studio-telemetry-main">{rhythmLabel}</strong>
            <span className="px-studio-telemetry-sub">LOCAL · PRIVATE</span>
          </span>
          <span className="px-studio-rhythm-trace" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="px-studio-telemetry-cell">
          {inLounge ? (
            <Button variant="stop" onClick={leaveLounge} disabled={busy === 'lounge_leave'}>
              <IconClose s={14} /> {busy === 'lounge_leave' ? 'LEAVING' : 'LEAVE LOUNGE'}
            </Button>
          ) : (
            <Button variant="accent" onClick={joinLounge} disabled={!loungeRoom || busy === 'lounge_join'}>
              <IconMic s={14} /> {busy === 'lounge_join' ? 'JOINING' : 'JOIN LOUNGE'}
            </Button>
          )}
        </div>
      </section>

      <div className="px-studio-layout">
        <section className="px-studio-workbench" aria-label="Focus stage">
          <header className="px-studio-workbench-head">
            <div>
              <span className="px-lbl">My bench</span>
              <h2>{selectedProjectRoom?.projectName ?? selectedProjectRoom?.name ?? 'Choose a focus project'}</h2>
              <p>One working context · focus-only until you drop in</p>
            </div>
            <label className="px-studio-project-picker">
              <span className="px-lbl">Focus project</span>
              <Select
                value={selectedProjectRoom?.id ?? ''}
                onChange={(event) => setSelectedRoomId(event.target.value)}
                disabled={!roomOptions.length}
                aria-label="Choose focus project"
              >
                {!roomOptions.length && <option value="">No project rooms</option>}
                {roomOptions.map((option) => (
                  <option key={option.roomId} value={option.roomId}>
                    {option.label} · {option.activeMemberCount} present
                  </option>
                ))}
              </Select>
            </label>
          </header>

          {roomsError && (
            <DegradedStatePanel title="Rooms offline" message={roomsError} tone="error" />
          )}

          {roomsLoading && !roomOptions.length && !roomsError && (
            <Skeleton lines={4} widths={['70%', '55%', '80%', '60%']} />
          )}

          {!roomsLoading && !roomOptions.length && !roomsError && (
            <EmptyStatePanel
              icon={<IconCloud s={24} />}
              title="No project rooms configured yet"
              message="Workspace rooms appear once project room state is available."
            />
          )}

          {selectedProjectRoom && (
            <FocusedRoomStage
              zone={focusedZone}
              wall={screenWall}
              roomDetailError={roomDetailError}
              fullscreen={stageFullscreen}
              activeJoin={activeProjectJoin}
              pending={busy === 'drop_in' && roomActionTargetId === selectedProjectRoom.id}
              onDropIn={dropInToRoom}
              onPin={setPinnedTrackId}
              onToggleFullscreen={toggleStageFullscreen}
            />
          )}
        </section>

        <aside className="px-studio-bench-rail" aria-label="Team benches">
          <header className="px-studio-workbench-head">
            <div>
              <span className="px-lbl">Team benches</span>
              <h2>Present now</h2>
              <p>{floorSubtitle}</p>
            </div>
            <StatusChip tone={onlineCount ? 'accent' : 'idle'}>{onlineCount} live</StatusChip>
          </header>

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
              message="Benches appear while team sessions or room membership are fresh."
            />
          )}

          {visibleBenchMembers.length > 0 && (
            <div className="px-studio-bench-list">
              {visibleBenchMembers.map((presence) => (
                <TeamBench
                  key={presence.participantId}
                  presence={presence}
                  onActivate={focusRoomFromFloor}
                />
              ))}
            </div>
          )}

          {hiddenBenchCount > 0 && (
            <div className="px-coworking-info">{hiddenBenchCount} more present · use project focus to narrow context</div>
          )}
        </aside>
      </div>

      <section className="px-studio-lounge" aria-label="Ambient lounge">
        <header className="px-studio-lounge-head">
          <div>
            <span className="px-lbl">Ambient lounge</span>
            <strong>{loungeMembers.length} in lounge</strong>
            <small>{loungeStrapline} · project audio priority: {loungeLayer.audioPriority}</small>
          </div>
          {inLounge ? (
            <span className="px-lounge-pill live">IN LOUNGE</span>
          ) : (
            <StatusChip tone={loungeMembers.length ? 'accent' : 'idle'}>
              {loungeMembers.length ? `${loungeMembers.length} ambient` : 'calm'}
            </StatusChip>
          )}
        </header>

        {loungeError && (
          <DegradedStatePanel title="Lounge error" message={loungeError} tone="error" />
        )}

        {!inLounge && (
          <div className="px-lounge-idle">
            <div className="px-lounge-idle-copy">
              <span className="px-lbl">drop in for ambient co-presence — open mic, no agenda.</span>
            </div>
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

            {deviceControlsNode}

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
      </section>

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

      <MediaDock
        dock={dockState}
        micActive={micActive}
        cameraActive={cameraActive}
        screenActive={screenActive}
        participants={dockParticipants}
        deviceControls={deviceControlsNode}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreen={toggleScreen}
        onCloseout={() => { if (activeMediaEntry) openCloseout(activeMediaEntry); }}
        onLeave={() => { if (activeMediaEntry) void leaveActiveJoin(activeMediaEntry, {}); }}
        leaving={busy === 'lounge_leave' || busy === 'room_leave'}
        message={deviceError}
      />

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
