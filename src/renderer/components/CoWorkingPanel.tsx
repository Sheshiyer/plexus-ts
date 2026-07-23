import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, Input, Modal, PageHeader, Select, Skeleton, Textarea } from './ui';
import {
  IconCheck,
  IconClock,
  IconCloud,
  IconPaperclip,
  IconSpeaker,
  IconSync,
} from './Icons';
import MediaDock from './coworking/MediaDock';
import LoungeStrip from './coworking/LoungeStrip';
import StudioStage from './coworking/StudioStage';
import TeamBenchRail, { isConnectionError } from './coworking/TeamBenchRail';
import FloorTelemetryBar from './coworking/FloorTelemetryBar';
import {
  DegradedStatePanel,
  EmptyStatePanel,
  StatusChip,
} from './PlexusUI';
import type {
  CoWorkingRingState,
  FloorPresence,
  RealtimeMeetingRecord,
  RealtimeRoom,
  RealtimeRoomDetail,
} from '../../shared/types';
import type { RemoteStream } from '../lib/RealtimeSession';
import {
  deriveFocusedZone,
  deriveScreenWall,
  listProjectRoomOptions,
} from '../lib/coworkingModel';
import { deriveDockState } from '../lib/dock-model';
import {
  newLocalId,
  SYSTEM_DEVICE_ID,
  useRealtimeMedia,
  type ActiveJoin,
} from '../lib/useRealtimeMedia';

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

type AudioSinkElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

function sinkIdForDevice(deviceId: string): string {
  return deviceId === SYSTEM_DEVICE_ID ? '' : deviceId;
}

/* ============================================================
 * §01 · Focused room and media shell
 * ============================================================ */

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

/* ============================================================
 * §03 · Lounge — remote audio sink
 * ============================================================ */

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

export interface CoWorkingPanelProps {
  onOpenSettings?: () => void;
}

export default function CoWorkingPanel({ onOpenSettings }: CoWorkingPanelProps = {}) {
  // §01 floor presence
  const [floor, setFloor] = useState<FloorPresence[]>([]);
  const [floorError, setFloorError] = useState<string | null>(null);
  const [floorLoading, setFloorLoading] = useState(true);
  const [rhythmState, setRhythmState] = useState<'loading' | 'enabled' | 'paused' | 'unavailable'>('loading');

  // §02 project rooms
  const [rooms, setRooms] = useState<RealtimeRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
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
  const [closeoutTarget, setCloseoutTarget] = useState<ActiveJoin | null>(null);
  const [closeoutTitle, setCloseoutTitle] = useState('');
  const [closeoutNotes, setCloseoutNotes] = useState('');
  const [closeoutDecisions, setCloseoutDecisions] = useState('');
  const [closeoutActions, setCloseoutActions] = useState('');
  const [sendToPaperclip, setSendToPaperclip] = useState(true);
  const [closeoutBusy, setCloseoutBusy] = useState(false);
  const [closeoutError, setCloseoutError] = useState<string | null>(null);

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

  const onRefresh = useCallback(async () => {
    await Promise.all([loadRooms(), loadFloor()]);
  }, [loadFloor, loadRooms]);

  const {
    activeJoins,
    activeJoinList,
    activeLoungeJoin,
    activeMediaEntry,
    micActive,
    cameraActive,
    screenActive,
    busy,
    setBusy,
    remoteStreams,
    loungeError,
    setLoungeError,
    roomsError,
    setRoomsError,
    deviceError,
    setDeviceError,
    info,
    setInfo,
    roomActionTargetId,
    audioInputs,
    audioOutputs,
    videoInputs,
    selectedMicId,
    setSelectedMicId,
    selectedSpeakerId,
    setSelectedSpeakerId,
    selectedCameraId,
    setSelectedCameraId,
    joinLounge,
    leaveLounge,
    dropInToRoom,
    leaveActiveJoin,
    toggleMic,
    toggleCamera,
    toggleScreen,
    loadMediaDevices,
  } = useRealtimeMedia({
    loungeRoom,
    clientInstanceId,
    onRefresh,
    onJoinCleared: useCallback((roomId: string) => {
      setCloseoutTarget((current) => (current?.roomId === roomId ? null : current));
    }, []),
  });

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
  }, [closeoutActions, closeoutDecisions, closeoutNotes, closeoutTarget, closeoutTitle, sendToPaperclip, setInfo]);

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

  // Single source of truth for "the worker is unreachable" across the floor,
  // rooms, and lounge fetches — collapses three redundant per-section panels
  // into one telemetry-bar chip (see isConnectionError, imported from
  // coworking/TeamBenchRail).
  const floorOffline = isConnectionError(floorError) || isConnectionError(roomsError) || isConnectionError(loungeError);

  const loungeMembers = floor.filter((presence) => presence.ringState === 'lounge');
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
    <div className={`px-fadein px-coworking-studio${floorOffline ? ' px-floor-quiet' : ''}`}>
      <PageHeader title="Co-working" sub="my studio · focus stage · ambient team presence" />

      <FloorTelemetryBar
        onlineCount={onlineCount}
        floorCounts={floorCounts}
        floorState={floorState}
        rhythmLabel={rhythmLabel}
        floorOffline={floorOffline}
        onOpenSettings={onOpenSettings}
        inLounge={inLounge}
        busy={busy}
        loungeRoom={loungeRoom}
        leaveLounge={leaveLounge}
        joinLounge={joinLounge}
      />

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

          {roomsError && !isConnectionError(roomsError) && (
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
            <StudioStage
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

        <TeamBenchRail
          floor={floor}
          floorError={floorError}
          floorLoading={floorLoading}
          floorOffline={floorOffline}
          onlineCount={onlineCount}
          floorSubtitle={floorSubtitle}
          onActivate={focusRoomFromFloor}
        />
      </div>

      <LoungeStrip
        presentCount={loungeMembers.length}
        presentInitials={loungeMembers.map((member) => member.initials)}
        joined={inLounge}
        busy={busy === 'lounge_join'}
        error={loungeError}
        onJoin={joinLounge}
      />

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
        onLeave={async () => {
          if (!activeMediaEntry) return;
          setBusy(activeMediaEntry.scope === 'lounge' ? 'lounge_leave' : 'room_leave');
          try {
            await leaveActiveJoin(activeMediaEntry, {});
          } finally {
            setBusy(null);
          }
        }}
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
