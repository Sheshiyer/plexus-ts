import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, EmptyState, PageHeader, Panel, SectionLabel, Skeleton } from './ui';
import {
  IconCamera,
  IconCheck,
  IconClock,
  IconClose,
  IconCloud,
  IconKeyboard,
  IconMic,
  IconUsers,
} from './Icons';
import type {
  CoWorkingRingState,
  FloorPresence,
  RealtimeJoinResponse,
  RealtimeRoom,
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

function newLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
  pending,
}: {
  room: RealtimeRoom;
  floor: FloorPresence[];
  onDropIn: (room: RealtimeRoom) => void;
  pending: boolean;
}) {
  const stateBadge = deriveRoomStateBadge(room);
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
  const subtitle = isEmpty ? memberSummary : `${liveCopy} · ${lastActivityCopy}`;

  return (
    <article className={`px-room-card ${stateBadge}`}>
      <header className="px-room-head">
        <div className="px-room-title-group">
          <span className="px-room-swatch" style={{ background: swatch }} aria-hidden="true" />
          <span className="px-room-title">{room.name}</span>
        </div>
        <span className={`px-room-state-badge ${stateBadge}`}>{roomStateLabel(stateBadge)}</span>
      </header>

      <div className="px-room-body">
        <MiniAvatarCluster members={members} cap={4} />
        <div className="px-room-meta px-lbl">{subtitle}</div>
      </div>

      <div className="px-room-foot">
        <Button
          variant="ghost"
          className="px-room-cta"
          disabled={pending}
          onClick={() => onDropIn(room)}
        >
          {inCall ? (
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

/* ============================================================
 * Main component
 * ============================================================ */

type BusyKey = 'lounge_join' | 'lounge_leave' | 'mic' | 'camera' | 'drop_in' | null;

export default function CoWorkingPanel() {
  // §01 floor presence
  const [floor, setFloor] = useState<FloorPresence[]>([]);
  const [floorError, setFloorError] = useState<string | null>(null);
  const [floorLoading, setFloorLoading] = useState(true);

  // §02 project rooms
  const [rooms, setRooms] = useState<RealtimeRoom[]>([]);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [dropInTargetId, setDropInTargetId] = useState<string | null>(null);

  // §03 lounge
  const [loungeRoom, setLoungeRoom] = useState<RealtimeRoom | null>(null);
  const [loungeError, setLoungeError] = useState<string | null>(null);
  const [loungeJoin, setLoungeJoin] = useState<RealtimeJoinResponse | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Realtime wiring (lounge audio)
  const sessionRef = useRef<RealtimeSession | null>(null);
  const localMicRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const localCamRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const remoteStreamsRef = useRef<RemoteStream[]>([]);
  const clientInstanceId = useRef(newLocalId('coworking'));

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

  /* ---------------- lounge actions ---------------- */

  const stopLocalTracks = useCallback(() => {
    [localMicRef.current, localCamRef.current].forEach((track) => {
      if (track) track.stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
    });
    localMicRef.current = null;
    localCamRef.current = null;
    setMicActive(false);
    setCameraActive(false);
  }, []);

  const leaveLounge = useCallback(async () => {
    if (!loungeJoin) return;
    setBusy('lounge_leave');
    try {
      stopLocalTracks();
      await sessionRef.current?.close();
      sessionRef.current = null;
      remoteStreamsRef.current = [];
      await window.plexus.realtimeLeaveCall(loungeJoin.call.id, loungeJoin.participant.id);
      setLoungeJoin(null);
      setInfo('Left the lounge.');
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [loungeJoin, stopLocalTracks]);

  const joinLounge = useCallback(async () => {
    if (!loungeRoom) {
      setLoungeError('No lounge room available.');
      return;
    }
    setBusy('lounge_join');
    setLoungeError(null);
    setInfo(null);
    try {
      const result = await window.plexus.realtimeJoinRoom(loungeRoom.id, {
        clientInstanceId: clientInstanceId.current,
        intent: 'media',
        media: { audio: false, video: false, screen: false },
      });
      if (!result.ok || !result.joined) {
        setLoungeError(result.message ?? 'Could not join lounge.');
        return;
      }
      setLoungeJoin(result.joined);

      const session = new RealtimeSession(result.joined, {
        onRemoteTrack: (remote) => {
          remoteStreamsRef.current = [
            ...remoteStreamsRef.current.filter((existing) => existing.trackId !== remote.trackId),
            remote,
          ];
        },
        onRemoteTrackEnded: (trackId) => {
          remoteStreamsRef.current = remoteStreamsRef.current.filter((existing) => existing.trackId !== trackId);
        },
        onConnectionStateChange: () => {
          // Surfacing this in the UI is a later polish — for now we just log.
        },
        onError: (msg) => setLoungeError(msg),
      });
      await session.init();
      sessionRef.current = session;
      setInfo(result.joined.cloudflare.configured ? 'Joined lounge · audio standby.' : 'Joined lounge (metadata-only mode).');
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [loungeRoom]);

  const toggleMic = useCallback(async () => {
    if (!loungeJoin) return;
    if (micActive && localMicRef.current) {
      const track = localMicRef.current;
      track.stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      sessionRef.current?.unpublishLocal(track.id);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const id = newLocalId('mic');
      localMicRef.current = { id, stream };
      await sessionRef.current?.publishLocal(id, stream, 'audio', 'Lounge mic');
      setMicActive(true);
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [loungeJoin, micActive]);

  const toggleCamera = useCallback(async () => {
    if (!loungeJoin) return;
    if (cameraActive && localCamRef.current) {
      const track = localCamRef.current;
      track.stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      sessionRef.current?.unpublishLocal(track.id);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      const id = newLocalId('cam');
      localCamRef.current = { id, stream };
      await sessionRef.current?.publishLocal(id, stream, 'camera', 'Lounge camera');
      setCameraActive(true);
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [cameraActive, loungeJoin]);

  /* ---------------- room actions ---------------- */

  const dropInToRoom = useCallback(async (room: RealtimeRoom) => {
    setDropInTargetId(room.id);
    setBusy('drop_in');
    setRoomsError(null);
    try {
      const result = await window.plexus.realtimeJoinRoom(room.id, {
        clientInstanceId: clientInstanceId.current,
        intent: room.activeCallId ? 'media' : 'presence_only',
        media: { audio: Boolean(room.activeCallId), video: false, screen: false },
      });
      if (!result.ok) {
        setRoomsError(result.message ?? 'Could not drop into room.');
      } else {
        setInfo(`Dropped into ${room.name}.`);
        await loadRooms();
        await loadFloor();
      }
    } catch (err: any) {
      setRoomsError(err?.message ?? String(err));
    } finally {
      setBusy(null);
      setDropInTargetId(null);
    }
  }, [loadFloor, loadRooms]);

  /* ---------------- cleanup on unmount ---------------- */

  useEffect(() => {
    return () => {
      stopLocalTracks();
      sessionRef.current?.close();
      sessionRef.current = null;
    };
    // Run-once teardown; tracked refs are mutable so the cleanup doesn't
    // need them in the deps list and re-running would defeat the purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const lougeMembers = floor.filter((presence) => presence.ringState === 'lounge');
  const loungeSpeakerNames = lougeMembers.slice(0, 3).map((m) => m.displayName.split(' ')[0]).join(' + ');
  const loungeStrapline = lougeMembers.length
    ? `${loungeSpeakerNames || 'In lounge'} · ambient · ${lougeMembers.length} ${lougeMembers.length === 1 ? 'voice' : 'voices'}`
    : 'lounge is calm · drop in to break the silence';
  const inLounge = Boolean(loungeJoin);

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
      <Panel raised pad crosshairs className="px-coworking-section">
        <div className="px-section-head">
          <div>
            <SectionLabel>01 · today&apos;s floor</SectionLabel>
            <div className="px-section-note">{floorSubtitle}</div>
          </div>
          <Badge tone={onlineCount ? 'mint' : undefined}>{onlineCount} present</Badge>
        </div>

        {floorError && (
          <div className="px-coworking-error" role="alert">
            <Badge tone="rose">floor offline</Badge>
            <span className="px-mono sm">{floorError}</span>
          </div>
        )}

        {floorLoading && !floor.length && !floorError && (
          <Skeleton lines={3} widths={['80%', '65%', '90%']} />
        )}

        {!floorLoading && !floor.length && !floorError && (
          <EmptyState icon={<IconUsers s={24} />}>No-one on the floor yet today.</EmptyState>
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
      </Panel>

      {/* ============================================================
        * §02 · PROJECT ROOMS
        * ============================================================ */}
      <Panel raised pad crosshairs className="px-coworking-section" style={{ marginTop: 18 }}>
        <div className="px-section-head">
          <div>
            <SectionLabel>02 · project rooms</SectionLabel>
            <div className="px-section-note">anchored by project · drop in to co-work</div>
          </div>
          <Badge tone={rooms.length ? 'mint' : undefined}>{rooms.length}</Badge>
        </div>

        {roomsError && (
          <div className="px-coworking-error" role="alert">
            <Badge tone="rose">rooms offline</Badge>
            <span className="px-mono sm">{roomsError}</span>
          </div>
        )}

        {roomsLoading && !rooms.length && !roomsError && (
          <Skeleton lines={4} widths={['70%', '55%', '80%', '60%']} />
        )}

        {!roomsLoading && !rooms.length && !roomsError && (
          <EmptyState icon={<IconCloud s={24} />}>No project rooms configured yet.</EmptyState>
        )}

        {rooms.length > 0 && (
          <div className="px-room-grid">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                floor={floor}
                onDropIn={dropInToRoom}
                pending={busy === 'drop_in' && dropInTargetId === room.id}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* ============================================================
        * §03 · AMBIENT LOUNGE
        * ============================================================ */}
      <Panel raised pad crosshairs className="px-coworking-section px-lounge-strip" style={{ marginTop: 18 }}>
        <div className="px-section-head">
          <div>
            <SectionLabel>03 · ambient lounge</SectionLabel>
            <div className="px-section-note">{loungeStrapline}</div>
          </div>
          {inLounge ? (
            <span className="px-lounge-pill live">
              <span className="px-dot pulse" /> IN LOUNGE
            </span>
          ) : (
            <Badge tone={lougeMembers.length ? 'mint' : undefined}>
              {lougeMembers.length ? `${lougeMembers.length} ambient` : 'calm'}
            </Badge>
          )}
        </div>

        {loungeError && (
          <div className="px-coworking-error" role="alert">
            <Badge tone="rose">lounge error</Badge>
            <span className="px-mono sm">{loungeError}</span>
          </div>
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
              <MiniAvatarCluster members={lougeMembers} cap={5} />
            </div>

            <div className="px-lounge-center">
              <LoungeWaveform active={lougeMembers.some((m) => m.isSpeaking)} />
              <span className="px-lbl px-lounge-strapline">{loungeStrapline}</span>
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
                className={`px-lounge-ctl${captionsOn ? ' on' : ''}`}
                onClick={() => setCaptionsOn((current) => !current)}
                aria-label={captionsOn ? 'Hide captions' : 'Show captions'}
                aria-pressed={captionsOn}
                title="Captions (preview)"
              >
                <IconKeyboard s={14} />
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
          </div>
        )}
      </Panel>

      {info && (
        <div className="px-coworking-info" role="status">
          <Badge tone="mint"><IconCheck s={11} /> {info}</Badge>
          <span className="px-lbl">
            <IconClock s={11} /> refreshes every {Math.round(REFRESH_INTERVAL_MS / 1000)}s
          </span>
        </div>
      )}
    </div>
  );
}
