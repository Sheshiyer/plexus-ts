import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  RealtimeJoinResponse,
  RealtimeMediaTrack,
  RealtimeRoom,
  RealtimeRoomType,
} from '../../shared/types';
import type { RealtimeRoomScope } from './realtimeRoomPolling';
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
  onRefresh,
  onJoinCleared,
}: {
  loungeRoom: RealtimeRoom | null;
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
  const captureEpoch = useRef(0);
  const mediaSessionPending = useRef<Promise<RealtimeSession> | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | 'not-started'>('not-started');
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
    captureEpoch.current += 1;
    setConnectionState('not-started');
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

  const handleConnectionStateChange = useCallback((state: RTCPeerConnectionState) => {
    if (state === 'failed' || state === 'closed') stopLocalTracks();
    setConnectionState(state);
  }, [stopLocalTracks]);

  const clearRemoteStreams = useCallback(() => {
    remoteStreamsRef.current = [];
    setRemoteStreams([]);
  }, []);

  const leaveLounge = useCallback(async () => {
    const entry = Object.values(activeJoinsRef.current).find((join) => join.scope === 'lounge');
    if (!entry) return;
    setBusy('lounge_leave');
    const session = sessionRef.current;
    sessionRef.current = null;
    try {
      stopLocalTracks();
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
      await session?.close();
      setBusy(null);
    }
  }, [clearActiveJoin, clearRemoteStreams, onRefresh, stopLocalTracks]);

  const leaveActiveJoin = useCallback(async (
    entry: ActiveJoin,
    options: { refresh?: boolean; silent?: boolean } = {},
  ) => {
    const session = entry.scope === 'lounge' || entry.hasSession ? sessionRef.current : null;
    if (session) sessionRef.current = null;
    try {
      if (entry.scope === 'lounge' || entry.hasSession) {
        stopLocalTracks();
        clearRemoteStreams();
      }
      const result = await window.plexus.realtimeLeaveCall(entry.joined.call.id, entry.joined.participant.id);
      if (!result.ok && !shouldClearLocalAfterLeaveFailure(result.message)) {
        throw new Error(result.message ?? `Could not leave ${entry.roomName}.`);
      }
      clearActiveJoin(entry.roomId);
      if (!options.silent) setInfo(`Left ${entry.roomName}.`);
      if (options.refresh !== false) await onRefresh();
    } finally {
      await session?.close();
    }
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
    const session = sessionRef.current;
    sessionRef.current = null;
    clearRemoteStreams();
    activeJoinsRef.current = {};
    replaceActiveJoins(() => ({}));
    void Promise.allSettled(entries.map((entry) => window.plexus.realtimeLeaveCall(entry.joined.call.id, entry.joined.participant.id)))
      .finally(() => session?.close());
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
      const joinEpoch = captureEpoch.current;
      // Client identity is stamped by the Electron main process; the renderer
      // no longer sends a client instance id (app-presence authority contract).
      const result = await window.plexus.realtimeJoinRoom(loungeRoom.id, {
        intent: 'presence_only',
        media: { audio: false, video: false, screen: false },
      });
      if (!result.ok || !result.joined) {
        setLoungeError(result.message ?? 'Could not join lounge.');
        return;
      }
      joined = result.joined;
      if (joinEpoch !== captureEpoch.current) {
        await window.plexus.realtimeLeaveCall(joined.call.id, joined.participant.id);
        return;
      }

      const session = new RealtimeSession(result.joined, {
        onRemoteTrack: (remote) => {
          if (sessionRef.current !== session) return;
          const nextStreams = [
            ...remoteStreamsRef.current.filter((existing) => existing.trackId !== remote.trackId),
            remote,
          ];
          remoteStreamsRef.current = nextStreams;
          setRemoteStreams(nextStreams);
        },
        onRemoteTrackEnded: (trackId) => {
          if (sessionRef.current !== session) return;
          const nextStreams = remoteStreamsRef.current.filter((existing) => existing.trackId !== trackId);
          remoteStreamsRef.current = nextStreams;
          setRemoteStreams(nextStreams);
        },
        onConnectionStateChange: handleConnectionStateChange,
        onError: (msg) => setLoungeError(msg),
      });
      await session.init();
      if (joinEpoch !== captureEpoch.current) {
        await session.close();
        await window.plexus.realtimeLeaveCall(result.joined.call.id, result.joined.participant.id);
        return;
      }
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
      setInfo('Joined lounge · devices stay off until enabled; incoming publications connect when available.');
      await onRefresh();
    } catch (err: any) {
      if (joined) {
        await window.plexus.realtimeLeaveCall(joined.call.id, joined.participant.id);
      }
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [addActiveJoin, handleConnectionStateChange, leaveOtherActiveJoins, loungeRoom, onRefresh]);

  const activeJoinList = useMemo(() => Object.values(activeJoins), [activeJoins]);
  const activeLoungeJoin = activeJoinList.find((entry) => entry.scope === 'lounge') ?? null;
  // Only one media-capable join exists at a time (lounge XOR one project
  // room — enforced by leaveOtherActiveJoins), so the toggles operate on
  // whichever join owns the shared sessionRef.
  const activeMediaEntry = activeJoinList.find((entry) => entry.hasSession) ?? null;
  const activeMediaJoin = activeMediaEntry?.joined ?? null;
  const activeMediaScopeLabel = activeMediaEntry?.scope === 'lounge' ? 'lounge' : 'project';

  const ensureMediaSession = useCallback(async (): Promise<RealtimeSession> => {
    if (mediaSessionPending.current) return mediaSessionPending.current;
    const pending = (async () => {
      const entry = Object.values(activeJoinsRef.current).find((item) => item.hasSession);
      if (!entry) throw new Error('Join a room before enabling media.');
      if (entry.joined.cloudflare.sessionId && sessionRef.current) return sessionRef.current;
      const epoch = captureEpoch.current;
      const result = await window.plexus.realtimeJoinRoom(entry.roomId, {
        intent: 'media', media: { audio: false, video: false, screen: false },
      });
      if (!result.ok || !result.joined?.cloudflare.sessionId) throw new Error(result.message ?? 'Media provider session is unavailable.');
      if (epoch !== captureEpoch.current) {
        await window.plexus.realtimeLeaveCall(result.joined.call.id, result.joined.participant.id);
        throw new Error('Room was closed while preparing media.');
      }
      await sessionRef.current?.close();
      const session = new RealtimeSession(result.joined, {
        onConnectionStateChange: handleConnectionStateChange,
        onError: setLoungeError,
        onRemoteTrack: (remote) => {
          if (sessionRef.current !== session) return;
          const next = [...remoteStreamsRef.current.filter((item) => item.trackId !== remote.trackId), remote];
          remoteStreamsRef.current = next;
          setRemoteStreams(next);
        },
        onRemoteTrackEnded: (trackId) => {
          if (sessionRef.current !== session) return;
          const next = remoteStreamsRef.current.filter((item) => item.trackId !== trackId);
          remoteStreamsRef.current = next;
          setRemoteStreams(next);
        },
      });
      await session.init();
      if (epoch !== captureEpoch.current) {
        await session.close();
        await window.plexus.realtimeLeaveCall(result.joined.call.id, result.joined.participant.id);
        throw new Error('Room was closed while preparing media.');
      }
      sessionRef.current = session;
      addActiveJoin({ ...entry, joined: result.joined });
      return session;
    })();
    mediaSessionPending.current = pending;
    try { return await pending; } finally {
      if (mediaSessionPending.current === pending) mediaSessionPending.current = null;
    }
  }, [addActiveJoin, handleConnectionStateChange]);

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
    if (busy) return;
    setBusy('mic');
    let captured: MediaStream | null = null;
    const epoch = captureEpoch.current;
    try {
      const audio: boolean | MediaTrackConstraints = selectedMicId === SYSTEM_DEVICE_ID
        ? true
        : { deviceId: { exact: selectedMicId } };
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      captured = stream;
      if (epoch !== captureEpoch.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const session = await ensureMediaSession();
      if (epoch !== captureEpoch.current || sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const id = newLocalId('mic');
      localMicRef.current = { id, stream };
      const publishedTrackId = await session.publishLocal(id, stream, 'audio', `${activeMediaJoin.participant.displayName} ${activeMediaScopeLabel} mic`);
      if (!publishedTrackId || epoch !== captureEpoch.current || sessionRef.current !== session) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        localMicRef.current = null;
        setMicActive(false);
        return;
      }
      setMicActive(true);
      await loadMediaDevices();
    } catch (err: any) {
      captured?.getTracks().forEach((track) => track.stop());
      if (localMicRef.current?.stream === captured) localMicRef.current = null;
      setMicActive(false);
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [busy, ensureMediaSession, activeMediaJoin, activeMediaScopeLabel, loadMediaDevices, micActive, selectedMicId]);

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
    if (busy) return;
    setBusy('camera');
    let captured: MediaStream | null = null;
    const epoch = captureEpoch.current;
    try {
      const video: boolean | MediaTrackConstraints = selectedCameraId === SYSTEM_DEVICE_ID
        ? true
        : { deviceId: { exact: selectedCameraId } };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      captured = stream;
      if (epoch !== captureEpoch.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const session = await ensureMediaSession();
      if (epoch !== captureEpoch.current || sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const id = newLocalId('cam');
      localCamRef.current = { id, stream };
      const publishedTrackId = await session.publishLocal(id, stream, 'camera', `${activeMediaJoin.participant.displayName} ${activeMediaScopeLabel} camera`);
      if (!publishedTrackId || epoch !== captureEpoch.current || sessionRef.current !== session) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        localCamRef.current = null;
        setCameraActive(false);
        return;
      }
      setCameraActive(true);
      await loadMediaDevices();
    } catch (err: any) {
      captured?.getTracks().forEach((track) => track.stop());
      if (localCamRef.current?.stream === captured) localCamRef.current = null;
      setCameraActive(false);
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [busy, ensureMediaSession, activeMediaJoin, activeMediaScopeLabel, cameraActive, loadMediaDevices, selectedCameraId]);

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
    if (busy) return;
    setBusy('screen');
    let captured: MediaStream | null = null;
    const epoch = captureEpoch.current;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      captured = stream;
      if (epoch !== captureEpoch.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const session = await ensureMediaSession();
      if (epoch !== captureEpoch.current || sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const id = newLocalId('screen');
      localScreenRef.current = { id, stream };
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          void session.unpublishLocal(id);
          if (localScreenRef.current?.id === id) {
            localScreenRef.current = null;
            setScreenActive(false);
          }
        };
      });
      const publishedTrackId = await session.publishLocal(id, stream, 'screen', `${activeMediaJoin.participant.displayName} screen share`);
      if (!publishedTrackId || epoch !== captureEpoch.current || sessionRef.current !== session) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        localScreenRef.current = null;
        setScreenActive(false);
        return;
      }
      setScreenActive(true);
    } catch (err: any) {
      captured?.getTracks().forEach((track) => track.stop());
      if (localScreenRef.current?.stream === captured) localScreenRef.current = null;
      setScreenActive(false);
      setLoungeError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  }, [busy, ensureMediaSession, activeMediaJoin, screenActive]);

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
      const joinEpoch = captureEpoch.current;
      const result = await window.plexus.realtimeJoinRoom(
        room.id,
        buildProjectRoomJoinRequest(room),
      );
      if (!result.ok || !result.joined) {
        setRoomsError(result.message ?? 'Could not drop into room.');
      } else {
        joined = result.joined;
        if (joinEpoch !== captureEpoch.current) {
          await window.plexus.realtimeLeaveCall(joined.call.id, joined.participant.id);
          return;
        }
        const session = new RealtimeSession(result.joined, {
          onRemoteTrack: (remote) => {
          if (sessionRef.current !== session) return;
            const nextStreams = [
              ...remoteStreamsRef.current.filter((existing) => existing.trackId !== remote.trackId),
              remote,
            ];
            remoteStreamsRef.current = nextStreams;
            setRemoteStreams(nextStreams);
          },
          onRemoteTrackEnded: (trackId) => {
          if (sessionRef.current !== session) return;
            const nextStreams = remoteStreamsRef.current.filter((existing) => existing.trackId !== trackId);
            remoteStreamsRef.current = nextStreams;
            setRemoteStreams(nextStreams);
          },
          onConnectionStateChange: handleConnectionStateChange,
          onError: (msg) => setRoomsError(msg),
        });
        await session.init();
        if (joinEpoch !== captureEpoch.current) {
          await session.close();
          await window.plexus.realtimeLeaveCall(result.joined.call.id, result.joined.participant.id);
          return;
        }
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
  }, [addActiveJoin, handleConnectionStateChange, leaveOtherActiveJoins, onRefresh]);

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

  const subscribeRemoteTracks = useCallback(async (tracks: RealtimeMediaTrack[], scope?: RealtimeRoomScope): Promise<void> => {
    const isCurrent = () => {
      if (!scope) return true;
      const entry = activeJoinsRef.current[scope.roomId];
      return Boolean(entry?.hasSession && entry.joined.call.id === scope.callId
        && entry.joined.participant.id === scope.participantId);
    };
    if (!isCurrent()) return;
    const hasRemoteMedia = tracks.some((track) => track.state === 'live' && track.cloudflareTrackId);
    try {
      const session = hasRemoteMedia ? await ensureMediaSession() : sessionRef.current;
      if (!session) return;
      if (!isCurrent() || sessionRef.current !== session) return;
      await session.subscribeRemote(tracks);
    } catch (error) {
      if (isCurrent()) setLoungeError(error instanceof Error ? error.message : String(error));
    }
  }, [ensureMediaSession]);

  /* ---------------- return ---------------- */

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
    connectionState,
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
    subscribeRemoteTracks,
    loadMediaDevices,
  };
}

export { newLocalId };
