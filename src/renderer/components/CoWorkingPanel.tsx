import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, PageHeader, Select, Skeleton } from './ui';
import {
  IconCheck,
  IconClock,
  IconCloud,
  IconScreen,
} from './Icons';
import MediaDock from './coworking/MediaDock';
import LoungeStrip from './coworking/LoungeStrip';
import StudioStage from './coworking/StudioStage';
import TeamBenchRail, { isConnectionError } from './coworking/TeamBenchRail';
import FloorTelemetryBar from './coworking/FloorTelemetryBar';
import { IndependentDegradedStatesPanel } from './coworking/CoWorkingStage';
import { CoWorkingCompanion } from './coworking/CoWorkingCompanion';
import { CoWorkingCloseoutModal } from './coworking/CoWorkingCloseoutModal';
import { RemoteAudioSinks } from './coworking/CoWorkingLoungeSection';
import DeviceControls from './coworking/DeviceControls';
import {
  DegradedStatePanel,
  EmptyStatePanel,
  StatusChip,
} from './PlexusUI';
import type {
  AppWindowMode,
  AppWindowModeState,
  CoWorkingRingState,
  FloorPresence,
  MediaCaptureStatus,
  RealtimeMeetingRecord,
  RealtimeRoom,
  RealtimeRoomDetail,
  TimerState,
} from '../../shared/types';
import {
  deriveCoWorkingDegradedStates,
  deriveCoWorkingMeetingMemoryPolicy,
  deriveCoWorkingPrivacyPermissionAudit,
  deriveCoWorkingRoomAuditEventPlan,
  deriveCoWorkingTranscriptionBoundary,
  deriveFocusedZone,
  deriveProjectMediaHonesty,
  deriveScreenWall,
  listProjectRoomOptions,
} from '../lib/coworkingModel';
import { deriveDockState } from '../lib/dock-model';
import {
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
 *   §03 · AMBIENT LOUNGE   – presence strip + join action; once joined,
 *                            all media controls live in the MediaDock
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

// Wire fields (sendToPaperclip, meeting.paperclipStatus) survive; copy now reflects Hermes/Telegram delivery.
function paperclipStatusCopy(meeting?: RealtimeMeetingRecord, requested?: boolean): string {
  if (!requested) return 'Channel handoff not requested';
  if (!meeting) return 'Channel handoff requested';
  if (meeting.paperclipStatus === 'queued') return 'Channel handoff queued';
  if (meeting.paperclipStatus === 'sent') return 'Channel handoff sent';
  if (meeting.paperclipStatus === 'failed') return 'Channel handoff failed';
  return 'Channel handoff not requested';
}

/* ============================================================
 * Main component
 * ============================================================ */

export interface CoWorkingPanelProps {
  windowMode: AppWindowMode;
  timerState: TimerState;
  onWindowModeChange(mode: AppWindowMode): Promise<AppWindowModeState>;
  onOpenSettings?: () => void;
}

export default function CoWorkingPanel({ windowMode, timerState, onWindowModeChange, onOpenSettings }: CoWorkingPanelProps) {
  const [windowModeBusy, setWindowModeBusy] = useState(false);
  const [windowModeError, setWindowModeError] = useState<string | null>(null);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [mediaCaptureStatus, setMediaCaptureStatus] = useState<MediaCaptureStatus | null>(null);
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
  // Escape leaves compact cast mode unless a modal owns the key.
  useEffect(() => {
    if (windowMode !== 'compact') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.px-modal')) return;
      void onWindowModeChange('standard').catch((error: any) => {
        setWindowModeError(error?.message ?? String(error));
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onWindowModeChange, windowMode]);
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
  const [sendToPaperclip, setSendToPaperclip] = useState(false);
  const [closeoutBusy, setCloseoutBusy] = useState(false);
  const [closeoutError, setCloseoutError] = useState<string | null>(null);

  // Surfaced on the MediaDock: set when leaving a live join fails (the dock
  // stays visible and LIVE, so the failure must be visible there rather than
  // silently swallowed). Cleared on a successful leave and whenever a new
  // join is started (see handleJoinLounge / handleDropIn below).
  const [dockMessage, setDockMessage] = useState<string | null>(null);

  /* ---------------- loaders ---------------- */

  const loadFloor = useCallback(async () => {
    try {
      const result = await window.plexus.coworkingFloor();
      if (!result.ok) {
        // Keep the last authoritative floor while a refresh is unavailable.
        setFloorError(result.message ?? 'Floor presence unavailable.');
        return;
      }
      setFloor(result.floor ?? []);
      setFloorError(null);
    } catch (err: any) {
      // Keep the last authoritative floor while a refresh is unavailable.
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

  useEffect(() => {
    let disposed = false;
    window.plexus.mediaCaptureStatus()
      .then((status) => { if (!disposed) setMediaCaptureStatus(status); })
      .catch(() => { if (!disposed) setMediaCaptureStatus(null); });
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
    dropInToRoom,
    leaveActiveJoin,
    toggleMic,
    toggleCamera,
    toggleScreen,
    loadMediaDevices,
  } = useRealtimeMedia({
    loungeRoom,
    onRefresh,
    onJoinCleared: useCallback((roomId: string) => {
      setCloseoutTarget((current) => (current?.roomId === roomId ? null : current));
    }, []),
  });

  const closeoutOpen = Boolean(closeoutTarget);

  // Wrapped join entry points: clear any stale dock message left over from a
  // previous failed leave before starting a new join.
  const handleJoinLounge = useCallback(() => {
    setDockMessage(null);
    return joinLounge();
  }, [joinLounge]);
  const handleDropIn = useCallback((room: RealtimeRoom) => {
    setDockMessage(null);
    return dropInToRoom(room);
  }, [dropInToRoom]);
  // Named alias for the room-audit contract: leaving a project room writes a
  // participant-left audit row (see deriveCoWorkingRoomAuditEventPlan).
  const leaveProjectRoom = useCallback((room: RealtimeRoom) => {
    const entry = activeJoins[room.id];
    if (!entry) return Promise.resolve();
    return leaveActiveJoin(entry, {});
  }, [activeJoins, leaveActiveJoin]);
  void leaveProjectRoom;

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
    setSendToPaperclip(false);
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

  // Project-room media transport is deferred until the SFU is wired; honesty,
  // degraded-state, meeting-memory, permission, room-audit, and transcription
  // surfaces are derived from the merged coworking model so the Studio Floor
  // never implies live media, saved transcripts, or hidden side effects
  // (origin/main feature slate grafted onto the reviewed decomposition).
  const mediaTransportState = focusedZone.joinState === 'presence_only'
    ? (activeProjectJoin?.joined.cloudflare.configured ? 'ready' : 'unavailable')
    : 'deferred';
  const projectMediaHonesty = useMemo(() => deriveProjectMediaHonesty({
    activeProjectJoin: Boolean(activeProjectJoin),
    transportState: mediaTransportState,
  }), [activeProjectJoin, mediaTransportState]);
  const degradedStates = useMemo(() => deriveCoWorkingDegradedStates({
    floorError,
    roomsError,
    roomDetailError,
    deviceError,
    loungeError,
    transportState: mediaTransportState,
  }), [deviceError, floorError, loungeError, mediaTransportState, roomDetailError, roomsError]);
  const meetingMemory = useMemo(() => deriveCoWorkingMeetingMemoryPolicy({ focusedZone }), [focusedZone]);
  const privacyPermissionAudit = useMemo(() => deriveCoWorkingPrivacyPermissionAudit({
    status: mediaCaptureStatus,
    deviceError,
  }), [deviceError, mediaCaptureStatus]);
  const roomAuditPlan = useMemo(() => deriveCoWorkingRoomAuditEventPlan({
    focusedZone,
    activeProjectJoin: Boolean(activeProjectJoin),
    transportState: mediaTransportState,
  }), [activeProjectJoin, focusedZone, mediaTransportState]);
  const transcriptionBoundary = useMemo(() => deriveCoWorkingTranscriptionBoundary(), []);
  const stageEvidence = useMemo(() => ({
    mediaHonesty: projectMediaHonesty,
    meetingMemory,
    privacyPermissionAudit,
    roomAuditPlan,
    transcriptionBoundary,
  }), [projectMediaHonesty, meetingMemory, privacyPermissionAudit, roomAuditPlan, transcriptionBoundary]);

  const handleRemoteAudioError = useCallback((message: string) => {
    setDeviceError(message);
  }, [setDeviceError]);
  const remoteAudioLayer = (
    <RemoteAudioSinks streams={remoteAudioStreams} outputDeviceId={selectedSpeakerId} onError={handleRemoteAudioError} />
  );

  const changeWindowMode = useCallback(async (mode: AppWindowMode) => {
    if (windowModeBusy || mode === windowMode) return;
    setWindowModeBusy(true);
    setWindowModeError(null);
    if (mode === 'compact') setStageFullscreen(false);
    try {
      await onWindowModeChange(mode);
    } catch (error: any) {
      setWindowModeError(error?.message ?? String(error));
    } finally {
      setWindowModeBusy(false);
    }
  }, [onWindowModeChange, windowMode, windowModeBusy]);
  const dockParticipants = useMemo(() => (
    activeMediaEntry?.scope === 'lounge'
      ? loungeMembers.map((p) => ({ id: p.participantId ?? p.identityId, initials: p.initials }))
      : focusedZone.members.map((m) => ({ id: m.participantId ?? m.identityId, initials: m.initials }))
  ), [activeMediaEntry?.scope, loungeMembers, focusedZone.members]);
  const deviceControlsNode = (
    <DeviceControls
      micActive={micActive}
      cameraActive={cameraActive}
      busy={busy}
      audioInputs={audioInputs}
      audioOutputs={audioOutputs}
      videoInputs={videoInputs}
      selectedMicId={selectedMicId}
      selectedSpeakerId={selectedSpeakerId}
      selectedCameraId={selectedCameraId}
      onSelectMic={setSelectedMicId}
      onSelectSpeaker={setSelectedSpeakerId}
      onSelectCamera={setSelectedCameraId}
      onRefreshDevices={loadMediaDevices}
    />
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
  if (windowMode === 'compact') {
    const activeJoin = activeLoungeJoin ?? activeProjectJoin ?? null;
    const companionMembers = inLounge ? loungeMembers : focusedZone.members;
    const companionCount = inLounge ? loungeMembers.length : focusedZone.members.length;
    const companionTitle = inLounge
      ? loungeRoom?.name ?? 'Ambient lounge'
      : selectedProjectRoom?.name ?? 'Co-working';
    const companionContext = activeJoin
      ? activeJoin.joined.cloudflare.configured
        ? `live media · ${activeJoin.scope === 'lounge' ? 'lounge' : 'project room'}`
        : activeJoin.scope === 'lounge'
          ? 'media intent · provider unavailable'
          : 'presence only · project room'
      : 'focus only · not joined';
    const leaveCompanion = () => {
      const entry = activeMediaEntry ?? activeJoin;
      if (!entry) return;
      void leaveActiveJoin(entry, {}).catch((err: any) => {
        setDockMessage(err?.message ?? String(err));
      });
    };

    return (
      <>
        <CoWorkingCompanion
          title={companionTitle}
          context={companionContext}
          participants={companionMembers}
          participantCount={companionCount}
          timerState={timerState}
          joined={Boolean(activeJoin)}
          mediaEnabled={Boolean(activeMediaEntry)}
          micActive={micActive}
          cameraActive={cameraActive}
          screenActive={screenActive}
          captionsOn={captionsOn}
          busy={windowModeBusy || busy !== null}
          error={windowModeError ?? dockMessage ?? loungeError ?? roomDetailError}
          onToggleMic={() => { void toggleMic(); }}
          onToggleCamera={() => { void toggleCamera(); }}
          onToggleScreen={() => { void toggleScreen(); }}
          onToggleCaptions={() => setCaptionsOn((current) => !current)}
          onLeave={leaveCompanion}
          onExpand={() => { void changeWindowMode('standard'); }}
        />
        {remoteAudioLayer}
      </>
    );
  }

  return (
    <div className={`px-fadein px-coworking-studio${floorOffline ? ' px-floor-quiet' : ''}`}>
      <PageHeader
        title="Co-working"
        sub="my studio · focus stage · ambient team presence"
        right={
          <Button
            variant="ghost"
            onClick={() => { void changeWindowMode('compact'); }}
            disabled={windowModeBusy}
            title="Keep essential Co-working controls above the app you are presenting"
          >
            <IconScreen s={14} /> {windowModeBusy ? 'RESIZING' : 'COMPACT CAST MODE'}
          </Button>
        }
      />

      {windowModeError && <div className="px-coworking-error" role="alert">{windowModeError}</div>}

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
        joinLounge={handleJoinLounge}
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
              onDropIn={handleDropIn}
              onPin={setPinnedTrackId}
              onToggleFullscreen={toggleStageFullscreen}
              evidence={stageEvidence}
            />
          )}
          <IndependentDegradedStatesPanel degradedStates={degradedStates} />
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
        available={Boolean(loungeRoom)}
        error={loungeError}
        onJoin={handleJoinLounge}
      />

      {closeoutOpen && closeoutTarget && (
        <CoWorkingCloseoutModal
          roomName={closeoutTarget.roomName}
          title={closeoutTitle}
          notes={closeoutNotes}
          decisions={closeoutDecisions}
          actions={closeoutActions}
          sendToPaperclip={sendToPaperclip}
          busy={closeoutBusy}
          error={closeoutError}
          onTitleChange={setCloseoutTitle}
          onNotesChange={setCloseoutNotes}
          onDecisionsChange={setCloseoutDecisions}
          onActionsChange={setCloseoutActions}
          onSendToPaperclipChange={setSendToPaperclip}
          onClose={closeCloseout}
          onSave={() => { void saveCloseout(); }}
        />
      )}

      {remoteAudioLayer}

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
            setDockMessage(null);
          } catch (err: any) {
            setDockMessage(err?.message ?? String(err));
          } finally {
            setBusy(null);
          }
        }}
        leaving={busy === 'lounge_leave' || busy === 'room_leave'}
        message={dockMessage ?? deviceError ?? loungeError}
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
