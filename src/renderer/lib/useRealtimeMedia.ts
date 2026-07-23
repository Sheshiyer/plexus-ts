import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  RealtimeJoinResponse,
  RealtimeRoom,
  RealtimeRoomType,
} from '../../shared/types';
import { RealtimeSession, type RemoteStream } from './RealtimeSession';
import { buildProjectRoomJoinRequest } from './coworkingModel';

/* ------------------------------------------------------------------
 * useRealtimeMedia — sole owner of RealtimeSession
 * ------------------------------------------------------------------
 * Extracted verbatim from CoWorkingPanel.tsx (Task 6 of the co-working
 * redesign). Owns lounge/project-room joins, local media toggles,
 * device enumeration, and the RealtimeSession lifecycle. The caller
 * (CoWorkingPanel) keeps floor/rooms/lounge data loading, selection
 * state, closeout state, and derived composition.
 * ------------------------------------------------------------------ */

export type DeviceChoice = {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
};

export const SYSTEM_DEVICE_ID = 'system-default';

function newLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type ActiveJoinScope = 'lounge' | 'project_room';

export type ActiveJoin = {
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

type BusyKey = 'lounge_join' | 'lounge_leave' | 'mic' | 'camera' | 'screen' | 'drop_in' | null;
export type CoWorkingBusyKey = BusyKey | 'room_leave';

export function useRealtimeMedia({
  loungeRoom,
  clientInstanceId,
  onRefresh,
  onJoinCleared,
}: {
  loungeRoom: RealtimeRoom | null;
  clientInstanceId: React.MutableRefObject<string>;
  onRefresh: () => Promise<void>;
  // Called before an active join is removed from the map — lets the caller
  // clear any state keyed on roomId that it owns (e.g. an open closeout
  // modal targeting the room being left). Mirrors the original inline
  // `setCloseoutTarget((current) => (current?.roomId === roomId ? null : current))`
  // that lived in clearActiveJoin before closeout state moved to the panel.
  onJoinCleared?: (roomId: string) => void;
}) {
  const [activeJoins, setActiveJoins] = useState<ActiveJoinMap>({});
  const [micActive, setMicActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [screenActive, setScreenActive] = useState(false);
  const [audioInputs, setAudioInputs] = useState<DeviceChoice[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<DeviceChoice[]>([]);
  const [videoInputs, setVideoInputs] = useState<DeviceChoice[]>([]);
  const [selectedMicId, setSelectedMicId] = useState(SYSTEM_DEVICE_ID);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(SYSTEM_DEVICE_ID);
  const [selectedCameraId, setSelectedCameraId] = useState(SYSTEM_DEVICE_ID);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [busy, setBusy] = useState<CoWorkingBusyKey>(null);
  const [loungeError, setLoungeError] = useState<string | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [roomActionTargetId, setRoomActionTargetId] = useState<string | null>(null);

  // Realtime wiring (lounge audio)
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
    onJoinCleared?.(roomId);
    replaceActiveJoins((current) => {
      if (!current[roomId]) return current;
      const { [roomId]: _removed, ...next } = current;
      return next;
    });
  }, [onJoinCleared, replaceActiveJoins]);

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
      await onRefresh();
    } catch (err: any) {
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [clearActiveJoin, clearRemoteStreams, onRefresh, stopLocalTracks]);

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
    if (options.refresh !== false) await onRefresh();
  }, [clearActiveJoin, clearRemoteStreams, onRefresh, stopLocalTracks]);

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
      await onRefresh();
    } catch (err: any) {
      if (joined) {
        await window.plexus.realtimeLeaveCall(joined.call.id, joined.participant.id);
      }
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [addActiveJoin, clientInstanceId, leaveOtherActiveJoins, loungeRoom, onRefresh]);

  const activeJoinList = useMemo(() => Object.values(activeJoins), [activeJoins]);
  const activeLoungeJoin = activeJoinList.find((entry) => entry.scope === 'lounge') ?? null;
  // Only one media-capable join exists at a time (lounge XOR one project
  // room — enforced by leaveOtherActiveJoins), so the toggles operate on
  // whichever join owns the shared sessionRef.
  const activeMediaEntry = activeJoinList.find((entry) => entry.hasSession) ?? null;
  const activeMediaJoin = activeMediaEntry?.joined ?? null;
  const activeMediaScopeLabel = activeMediaEntry?.scope === 'lounge' ? 'lounge' : 'project';

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
        await onRefresh();
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
  }, [addActiveJoin, clientInstanceId, leaveOtherActiveJoins, onRefresh]);

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

  return {
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
  };
}

export { newLocalId };
