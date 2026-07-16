import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, PageHeader, Select, Skeleton } from './ui';
import {
  IconCheck,
  IconClock,
  IconClose,
  IconCloud,
  IconMic,
  IconScreen,
  IconUsers,
} from './Icons';
import {
  FocusedRoomStage,
  IndependentDegradedStatesPanel,
  TeamBenchRail,
  type CoWorkingActiveJoin as ActiveJoin,
  type CoWorkingActiveJoinMap as ActiveJoinMap,
} from './coworking/CoWorkingStage';
import { CoWorkingCompanion } from './coworking/CoWorkingCompanion';
import { CoWorkingCloseoutModal } from './coworking/CoWorkingCloseoutModal';
import {
  CoWorkingLoungeSection,
  RemoteAudioSinks,
  SYSTEM_DEVICE_ID,
  type DeviceChoice,
} from './coworking/CoWorkingLoungeSection';
import {
  DegradedStatePanel,
  EmptyStatePanel,
  StatusChip,
} from './PlexusUI';
import type { CoWorkingMediaTransportState } from '../../shared/coworking';
import type {
  AppWindowMode,
  AppWindowModeState,
  CoWorkingRingState,
  FloorPresence,
  MediaCaptureStatus,
  RealtimeJoinResponse,
  RealtimeMeetingRecord,
  RealtimeRoom,
  RealtimeRoomDetail,
  TimerState,
} from '../../shared/types';
import { RealtimeSession, type RemoteStream } from '../lib/RealtimeSession';
import {
  buildProjectRoomJoinRequest,
  deriveCoWorkingDegradedStates,
  deriveCoWorkingLiveScreenWallProof,
  deriveCoWorkingMediaProviderHealth,
  deriveCoWorkingMeetingMemoryPolicy,
  deriveCoWorkingPrivacyPermissionAudit,
  deriveCoWorkingProofCloseout,
  deriveCoWorkingRemoteTrackSubscriptionPlan,
  deriveCoWorkingRoomCloseoutProofFixture,
  deriveCoWorkingRoomAuditEventPlan,
  deriveCoWorkingTranscriptionBoundary,
  deriveCoWorkingTwoParticipantSimulation,
  deriveFocusedZone,
  deriveLoungeLayer,
  derivePresenceMap,
  deriveProjectMediaHonesty,
  deriveRecordingConsentShell,
  deriveScreenWall,
  deriveSfuLiveTransportAcceptance,
  listProjectRoomOptions,
} from '../lib/coworkingModel';

/* ------------------------------------------------------------------
 * Plexus Co-working surface
 * ------------------------------------------------------------------
 * Replaces RealtimeCapturePanel with one personal studio:
 *   §01 · MY BENCH         – one selected project stage
 *   §02 · TEAM BENCHES     – compact ambient presence rail
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

// Project-room media (mic/camera/screen) is a UI shell until project-scoped
// realtime transport lands. Flipping this true only un-disables the buttons —
// it does NOT wire publishing. Set it true in the same change that attaches the
// media handlers (project RealtimeSession + configured SFU credentials).
const PROJECT_MEDIA_TRANSPORT_READY = false;
const PROJECT_MEDIA_TRANSPORT_ERROR: string | null = null;
const PROJECT_SFU_LIVE_PROOF_VERIFIED = false;

function newLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

/* ============================================================
 * Main component
 * ============================================================ */

type BusyKey = 'lounge_join' | 'lounge_leave' | 'mic' | 'camera' | 'screen' | 'drop_in' | null;
type CoWorkingBusyKey = BusyKey | 'room_leave';

export interface CoWorkingPanelProps {
  windowMode: AppWindowMode;
  timerState: TimerState;
  onWindowModeChange(mode: AppWindowMode): Promise<AppWindowModeState>;
}

export default function CoWorkingPanel({ windowMode, timerState, onWindowModeChange }: CoWorkingPanelProps) {
  const [windowModeBusy, setWindowModeBusy] = useState(false);
  const [windowModeError, setWindowModeError] = useState<string | null>(null);
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
  const [loungeError, setLoungeError] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [screenActive, setScreenActive] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [audioInputs, setAudioInputs] = useState<DeviceChoice[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<DeviceChoice[]>([]);
  const [videoInputs, setVideoInputs] = useState<DeviceChoice[]>([]);
  const [mediaCaptureStatus, setMediaCaptureStatus] = useState<MediaCaptureStatus | null>(null);
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
  const [sendToPaperclip, setSendToPaperclip] = useState(false);
  const [closeoutBusy, setCloseoutBusy] = useState(false);
  const [closeoutError, setCloseoutError] = useState<string | null>(null);
  const [realtimeConnectionState, setRealtimeConnectionState] = useState<string>('not-started');

  // Realtime wiring (lounge media now, project remote subscription plan next)
  const sessionRef = useRef<RealtimeSession | null>(null);
  const localMicRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const localCamRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const localScreenRef = useRef<{ id: string; stream: MediaStream } | null>(null);
  const remoteStreamsRef = useRef<RemoteStream[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
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

  const loadMediaCaptureStatus = useCallback(async () => {
    try {
      const status = await window.plexus.mediaCaptureStatus();
      setMediaCaptureStatus(status ?? null);
    } catch {
      setMediaCaptureStatus(null);
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
    loadMediaCaptureStatus();
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    const onDeviceChange = () => {
      loadMediaDevices();
      loadMediaCaptureStatus();
    };
    mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }, [loadMediaCaptureStatus, loadMediaDevices]);

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
    setRealtimeConnectionState('not-started');
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
        onConnectionStateChange: (state) => {
          setRealtimeConnectionState(state);
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
      const result = await window.plexus.realtimeJoinRoom(
        room.id,
        buildProjectRoomJoinRequest(room),
      );
      if (!result.ok || !result.joined) {
        setRoomsError(result.message ?? 'Could not drop into room.');
      } else {
        const detailResult = await window.plexus.realtimeRoomDetail(room.id).catch(() => null);
        const detail = detailResult?.ok ? detailResult.detail ?? null : null;
        if (detail) {
          setRoomDetails((current) => ({ ...current, [room.id]: detail }));
        }
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
          onConnectionStateChange: (state) => {
            setRealtimeConnectionState(state);
          },
          onError: (msg) => setRoomsError(msg),
        });
        await session.init();
        const subscription = await session.subscribeRemote(detail?.tracks ?? []);
        if (result.joined.cloudflare.configured) {
          sessionRef.current = session;
        }
        addActiveJoin({
          scope: 'project_room',
          roomId: room.id,
          roomName: room.name,
          roomType: room.roomType,
          joined: result.joined,
          hasSession: result.joined.cloudflare.configured,
        });
        setInfo(result.joined.cloudflare.configured
          ? `Dropped into ${room.name} · ${subscription.subscribedTargetCount}/${subscription.plannedCount} remote tracks targeted for SFU subscription.`
          : `Dropped into ${room.name} · provider unavailable, so remote track metadata remains local proof only.`);
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
  const presenceMap = useMemo(() => derivePresenceMap(floor), [floor]);

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
    participants: selectedRoomDetail?.participants ?? [],
    tracks: selectedRoomDetail?.tracks ?? [],
    pinnedTrackId,
  }), [activeProjectJoin?.roomId, floor, pinnedTrackId, selectedProjectRoom, selectedRoomDetail?.participants, selectedRoomDetail?.tracks]);
  const screenWall = useMemo(
    () => deriveScreenWall(focusedZone.screenTracks, focusedZone.pinnedTrackId),
    [focusedZone.pinnedTrackId, focusedZone.screenTracks],
  );
  const remoteTrackPlan = useMemo(() => deriveCoWorkingRemoteTrackSubscriptionPlan({
    focusedZone,
    localParticipantId: activeProjectJoin?.joined.participant.id ?? null,
    providerConfigured: Boolean(activeProjectJoin?.joined.cloudflare.configured),
    remoteStreams,
  }), [activeProjectJoin?.joined.cloudflare.configured, activeProjectJoin?.joined.participant.id, focusedZone, remoteStreams]);
  const mediaProviderHealth = useMemo(() => deriveCoWorkingMediaProviderHealth({
    activeJoin: activeProjectJoin?.joined ?? null,
    connectionState: realtimeConnectionState,
    remoteTrackPlan,
    remoteStreams,
  }), [activeProjectJoin?.joined, realtimeConnectionState, remoteStreams, remoteTrackPlan]);
  const mediaTransportState = useMemo((): CoWorkingMediaTransportState => {
    if (PROJECT_MEDIA_TRANSPORT_READY && mediaProviderHealth.liveProofVerified) return 'ready';
    if (activeProjectJoin && !activeProjectJoin.joined.cloudflare.configured) return 'unavailable';
    if (mediaProviderHealth.transportState === 'simulated') return 'simulated';
    if (mediaProviderHealth.transportState === 'degraded') return 'degraded';
    if (PROJECT_MEDIA_TRANSPORT_ERROR) return 'degraded';
    return 'deferred';
  }, [activeProjectJoin, mediaProviderHealth.liveProofVerified, mediaProviderHealth.transportState]);
  const mediaHonesty = useMemo(() => deriveProjectMediaHonesty({
    activeProjectJoin: Boolean(activeProjectJoin),
    transportReady: PROJECT_MEDIA_TRANSPORT_READY,
    transportState: mediaTransportState,
    transportError: PROJECT_MEDIA_TRANSPORT_ERROR,
  }), [activeProjectJoin, mediaTransportState]);
  const recordingConsent = useMemo(() => deriveRecordingConsentShell({
    focusedZone,
    activeProjectJoin: Boolean(activeProjectJoin),
    recordingRoutesReady: false,
  }), [activeProjectJoin, focusedZone]);
  const sfuAcceptance = useMemo(() => deriveSfuLiveTransportAcceptance({
    transportState: mediaHonesty.transportState,
    liveProofVerified: PROJECT_SFU_LIVE_PROOF_VERIFIED,
  }), [mediaHonesty.transportState]);
  const proofCloseout = useMemo(() => deriveCoWorkingProofCloseout({
    focusedZone,
    activeProjectJoin: Boolean(activeProjectJoin),
    closeoutAvailable: true,
  }), [activeProjectJoin, focusedZone]);
  const liveScreenWallProof = useMemo(() => deriveCoWorkingLiveScreenWallProof({
    wall: screenWall,
    fullscreen: stageFullscreen,
  }), [screenWall, stageFullscreen]);
  const roomCloseoutProofFixture = useMemo(() => deriveCoWorkingRoomCloseoutProofFixture({
    focusedZone,
    activeJoin: activeProjectJoin?.joined ?? null,
  }), [activeProjectJoin?.joined, focusedZone]);
  const auditPlan = useMemo(() => deriveCoWorkingRoomAuditEventPlan({
    focusedZone,
    activeProjectJoin: Boolean(activeProjectJoin),
    transportState: mediaHonesty.transportState,
    recordingConsentRequired: recordingConsent.requiresConsent,
  }), [activeProjectJoin, focusedZone, mediaHonesty.transportState, recordingConsent.requiresConsent]);
  const meetingMemory = useMemo(() => deriveCoWorkingMeetingMemoryPolicy({
    focusedZone,
  }), [focusedZone]);
  const transcriptionBoundary = useMemo(() => deriveCoWorkingTranscriptionBoundary(), []);
  const twoParticipantSimulation = useMemo(() => deriveCoWorkingTwoParticipantSimulation({
    focusedZone,
  }), [focusedZone]);
  const privacyPermissionAudit = useMemo(() => deriveCoWorkingPrivacyPermissionAudit({
    status: mediaCaptureStatus,
    deviceError,
    closeoutAvailable: true,
  }), [deviceError, mediaCaptureStatus]);
  const loungeLayer = useMemo(() => deriveLoungeLayer({
    loungeRoom,
    floor,
    projectZoneActive: Boolean(selectedProjectRoom),
  }), [floor, loungeRoom, selectedProjectRoom]);
  const degradedStates = useMemo(() => deriveCoWorkingDegradedStates({
    floorError,
    roomsError,
    roomDetailError,
    deviceError,
    loungeError,
    transportState: mediaHonesty.transportState,
  }), [deviceError, floorError, loungeError, mediaHonesty.transportState, roomDetailError, roomsError]);
  const loungeMembers = loungeLayer.members;
  const loungeSpeakerNames = loungeMembers.slice(0, 3).map((m) => m.displayName.split(' ')[0]).join(' + ');
  const loungeStrapline = loungeMembers.length
    ? `${loungeSpeakerNames || 'In lounge'} · ambient · ${loungeMembers.length} ${loungeMembers.length === 1 ? 'voice' : 'voices'}`
    : 'lounge is calm · drop in to break the silence';
  const localScreenPublisher = screenActive && loungeJoin ? loungeJoin.participant.displayName : null;
  const handleRemoteAudioError = useCallback((message: string) => {
    setDeviceError(message);
  }, []);
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
    const companionCount = inLounge ? loungeMembers.length : focusedZone.presenceSummary.memberCount;
    const companionTitle = inLounge
      ? loungeRoom?.name ?? 'Ambient lounge'
      : selectedProjectRoom?.name ?? 'Co-working';
    const companionContext = activeJoin
      ? activeJoin.scope === 'lounge'
        ? activeJoin.joined.cloudflare.configured
          ? `live media · ${realtimeConnectionState}`
          : 'media intent · provider unavailable'
        : 'presence only · project room'
      : 'focus only · not joined';
    const leaveCompanion = () => {
      if (activeLoungeJoin) {
        void leaveLounge();
        return;
      }
      if (activeProjectJoin && selectedProjectRoom) void leaveProjectRoom(selectedProjectRoom);
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
          mediaEnabled={inLounge}
          micActive={micActive}
          cameraActive={cameraActive}
          screenActive={screenActive}
          captionsOn={captionsOn}
          busy={windowModeBusy || busy !== null}
          error={windowModeError ?? loungeError ?? roomDetailError}
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
    <>
    <div className={`px-fadein px-coworking-studio${stageFullscreen ? ' px-coworking-fullscreen-active' : ''}`}>
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
          <span className="px-studio-rhythm-trace" aria-hidden="true"><i /><i /><i /><i /><i /></span>
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

      {degradedStates.activeIssueCount > 0 && (
        <details className="px-studio-health-drawer">
          <summary>Workspace health · {degradedStates.activeIssueCount} isolated</summary>
          <IndependentDegradedStatesPanel degradedStates={degradedStates} />
        </details>
      )}

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

          {roomsError && <DegradedStatePanel variant="offline" title="Rooms offline" message={roomsError} />}
          {roomsLoading && !roomOptions.length && !roomsError && <Skeleton lines={4} widths={['70%', '55%', '80%', '60%']} />}
          {!roomsLoading && !roomOptions.length && !roomsError && <EmptyStatePanel variant="no-rooms" icon={<IconCloud s={24} />} />}

          {selectedProjectRoom && (
            <FocusedRoomStage
              zone={focusedZone}
              wall={screenWall}
              roomDetailError={roomDetailError}
              mediaHonesty={mediaHonesty}
              mediaProviderHealth={mediaProviderHealth}
              remoteTrackPlan={remoteTrackPlan}
              recordingConsent={recordingConsent}
              sfuAcceptance={sfuAcceptance}
              proofCloseout={proofCloseout}
              liveScreenWallProof={liveScreenWallProof}
              roomCloseoutProofFixture={roomCloseoutProofFixture}
              auditPlan={auditPlan}
              meetingMemory={meetingMemory}
              transcriptionBoundary={transcriptionBoundary}
              twoParticipantSimulation={twoParticipantSimulation}
              privacyPermissionAudit={privacyPermissionAudit}
              fullscreen={stageFullscreen}
              activeJoin={activeProjectJoin}
              pending={(busy === 'drop_in' || busy === 'room_leave') && roomActionTargetId === selectedProjectRoom.id}
              onDropIn={dropInToRoom}
              onLeave={leaveProjectRoom}
              onCloseout={openCloseout}
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

          {floorError && <DegradedStatePanel variant="offline" title="Floor offline" message={floorError} />}
          {floorLoading && !floor.length && !floorError && <Skeleton lines={3} widths={['80%', '65%', '90%']} />}
          {!floorLoading && !floor.length && !floorError && (
            <EmptyStatePanel
              icon={<IconUsers s={24} />}
              title="No-one on the floor yet today"
              message="Benches appear while team sessions or room membership are fresh."
            />
          )}
          {floor.length > 0 && (
            <TeamBenchRail floor={floor} presenceMap={presenceMap} onActivate={focusRoomFromFloor} />
          )}
        </aside>
      </div>

      <CoWorkingLoungeSection
        strapline={loungeStrapline}
        audioPriority={loungeLayer.audioPriority}
        members={loungeMembers}
        inLounge={inLounge}
        error={loungeError}
        deviceError={deviceError}
        busy={busy}
        closeoutBusy={closeoutBusy}
        micActive={micActive}
        cameraActive={cameraActive}
        screenActive={screenActive}
        captionsOn={captionsOn}
        localScreenPublisher={localScreenPublisher}
        audioInputs={audioInputs}
        audioOutputs={audioOutputs}
        videoInputs={videoInputs}
        selectedMicId={selectedMicId}
        selectedSpeakerId={selectedSpeakerId}
        selectedCameraId={selectedCameraId}
        onLeave={() => { void leaveLounge(); }}
        onToggleMic={() => { void toggleMic(); }}
        onToggleCamera={() => { void toggleCamera(); }}
        onToggleScreen={() => { void toggleScreen(); }}
        onToggleCaptions={() => setCaptionsOn((current) => !current)}
        onCloseout={() => { if (activeLoungeJoin) openCloseout(activeLoungeJoin); }}
        onRefreshDevices={() => { void loadMediaDevices(); }}
        onSelectedMicChange={setSelectedMicId}
        onSelectedSpeakerChange={setSelectedSpeakerId}
        onSelectedCameraChange={setSelectedCameraId}
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

      {info && (
        <div className="px-coworking-info" role="status">
          <StatusChip tone="accent"><IconCheck s={11} /> {info}</StatusChip>
          <span className="px-lbl">
            <IconClock s={11} /> refreshes every {Math.round(REFRESH_INTERVAL_MS / 1000)}s
          </span>
        </div>
      )}
    </div>
      {remoteAudioLayer}
    </>
  );
}
