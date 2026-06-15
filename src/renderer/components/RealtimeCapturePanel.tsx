import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader, Panel, Button, Badge, SectionLabel, StatCard, EmptyState, Field, Input, Select, Textarea } from './ui';
import {
  IconCamera,
  IconCheck,
  IconClose,
  IconCloud,
  IconLink,
  IconMic,
  IconPhone,
  IconScreen,
  IconSync,
  IconUsers,
} from './Icons';
import type {
  MediaCaptureStatus,
  MediaPermissionState,
  MediaRequestKind,
  Project,
  RealtimeCall,
  RealtimeJoinResponse,
  RealtimeMediaTrack,
  RealtimeParticipant,
  RealtimeRoom,
  RealtimeRoomDetail,
  TimeEntry,
} from '../../shared/types';

type LocalTrack = {
  localId: string;
  workerTrackId?: string;
  kind: 'audio' | 'camera' | 'screen';
  label: string;
  stream: MediaStream;
};

function newLocalId(prefix: string): string {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function permissionTone(state: MediaPermissionState): 'mint' | 'rose' | undefined {
  if (state === 'granted') return 'mint';
  if (state === 'denied' || state === 'restricted') return 'rose';
  return undefined;
}

function permissionCopy(state: MediaPermissionState): string {
  if (state === 'not-determined') return 'not asked';
  return state;
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function rendererProbe(): Promise<MediaCaptureStatus['renderer']> {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices) {
    return {
      mediaDevicesAvailable: false,
      enumerateDevicesAvailable: false,
      error: 'navigator.mediaDevices is unavailable in this renderer context.',
    };
  }

  if (!mediaDevices.enumerateDevices) {
    return {
      mediaDevicesAvailable: true,
      enumerateDevicesAvailable: false,
      error: 'enumerateDevices is unavailable in this renderer context.',
    };
  }

  try {
    const devices = await mediaDevices.enumerateDevices();
    return {
      mediaDevicesAvailable: true,
      enumerateDevicesAvailable: true,
      audioInputs: devices.filter((device) => device.kind === 'audioinput').length,
      videoInputs: devices.filter((device) => device.kind === 'videoinput').length,
    };
  } catch (error: any) {
    return {
      mediaDevicesAvailable: true,
      enumerateDevicesAvailable: true,
      error: error?.message ?? String(error),
    };
  }
}

function PermissionCard({
  label,
  state,
  requestKind,
  onRequest,
  requesting,
}: {
  label: string;
  state: MediaPermissionState;
  requestKind?: MediaRequestKind;
  onRequest: (kind: MediaRequestKind) => void;
  requesting: boolean;
}) {
  const denied = state === 'denied' || state === 'restricted';
  const granted = state === 'granted';
  return (
    <div className={`px-flow-card ${denied ? 'state-failed' : granted ? 'state-completed' : 'state-deferred'}`}>
      <div className="px-flow-icon">{granted ? <IconCheck s={16} /> : denied ? <IconClose s={16} /> : <IconCloud s={16} />}</div>
      <div className="px-flow-main">
        <div className="px-flow-top">
          <div className="px-flow-title">{label}</div>
          <Badge tone={permissionTone(state)}>{permissionCopy(state)}</Badge>
        </div>
        <div className="px-flow-meta">
          {label === 'screen' ? 'system setting' : 'renderer publish'}
        </div>
        {requestKind && state !== 'granted' && (
          <div className="px-flow-actions">
            <Button variant="ghost" onClick={() => onRequest(requestKind)} disabled={requesting}>
              {requesting ? 'Requesting' : `Request ${label}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TrackBadge({ track }: { track: RealtimeMediaTrack }) {
  const Icon = track.trackKind === 'audio' ? IconMic : track.trackKind === 'camera' ? IconCamera : IconScreen;
  return (
    <span className={`px-rt-track ${track.state === 'live' ? 'live' : ''}`}>
      <Icon s={13} />
      <span>{track.trackKind}</span>
    </span>
  );
}

function ParticipantTile({
  participant,
  tracks,
  local,
}: {
  participant: RealtimeParticipant;
  tracks: RealtimeMediaTrack[];
  local?: boolean;
}) {
  const liveTracks = tracks.filter((track) => track.state === 'live');
  return (
    <div className={`px-rt-tile ${participant.state === 'joined' ? 'joined' : ''}`}>
      <div className="px-rt-tile-top">
        <div>
          <div className="px-rt-name">{participant.displayName}{local ? ' (you)' : ''}</div>
          <div className="px-flow-meta">{participant.role} · {participant.state}</div>
        </div>
        <Badge tone={participant.state === 'joined' ? 'mint' : undefined}>{participant.state}</Badge>
      </div>
      <div className="px-rt-track-row">
        {liveTracks.length ? liveTracks.map((track) => <TrackBadge key={track.id} track={track} />) : <span className="px-flow-meta">presence only</span>}
      </div>
    </div>
  );
}

function ScreenPreview({
  track,
  onAttach,
  onStop,
}: {
  track: LocalTrack;
  onAttach: (trackId: string, node: HTMLVideoElement | null) => void;
  onStop: (track: LocalTrack) => void;
}) {
  return (
    <div className="px-rt-screen-tile">
      <video ref={(node) => onAttach(track.localId, node)} muted autoPlay playsInline />
      <div className="px-rt-screen-bar">
        <span>{track.label}</span>
        <button onClick={() => onStop(track)} title="Stop screen share"><IconClose s={13} /></button>
      </div>
    </div>
  );
}

export default function RealtimeCapturePanel() {
  const [status, setStatus] = useState<MediaCaptureStatus | null>(null);
  const [rooms, setRooms] = useState<RealtimeRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RealtimeRoomDetail | null>(null);
  const [joined, setJoined] = useState<RealtimeJoinResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState<MediaRequestKind | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [localAudio, setLocalAudio] = useState<LocalTrack | null>(null);
  const [localCamera, setLocalCamera] = useState<LocalTrack | null>(null);
  const [localScreens, setLocalScreens] = useState<LocalTrack[]>([]);
  const [closeout, setCloseout] = useState({
    title: '',
    manualNotes: '',
    decisions: '',
    actionItems: '',
    issueIds: '',
    timeEntryId: '',
    sendToPaperclip: false,
  });
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);
  const clientInstanceId = useRef(newLocalId('client'));
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const screenRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const currentCall: RealtimeCall | null = joined?.call ?? detail?.call ?? null;
  const currentParticipant = joined?.participant ?? null;
  const liveParticipants = detail?.participants ?? (joined?.participant ? [joined.participant] : []);
  const liveTracks = detail?.tracks ?? [];
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? detail?.room ?? null;
  const selectedProject = selectedRoom?.projectId ? projects.find((project) => project.id === selectedRoom.projectId) : null;

  const attachCamera = useCallback(() => {
    if (cameraRef.current && localCamera?.stream && cameraRef.current.srcObject !== localCamera.stream) {
      cameraRef.current.srcObject = localCamera.stream;
    }
  }, [localCamera]);

  useEffect(() => {
    attachCamera();
  }, [attachCamera]);

  useEffect(() => {
    for (const screen of localScreens) {
      const node = screenRefs.current[screen.localId];
      if (node && node.srcObject !== screen.stream) node.srcObject = screen.stream;
    }
  }, [localScreens]);

  const loadDetail = useCallback(async (roomId: string) => {
    const result = await window.plexus.realtimeRoomDetail(roomId);
    if (result.ok && result.detail) {
      setDetail(result.detail);
      return result.detail;
    }
    if (result.message) setError(result.message);
    return null;
  }, []);

  const refreshCapture = useCallback(async () => {
    const [mainStatus, renderer] = await Promise.all([
      window.plexus.mediaCaptureStatus(),
      rendererProbe(),
    ]);
    setStatus({ ...mainStatus, renderer });
  }, []);

  const loadRooms = useCallback(async () => {
    setError(null);
    const result = await window.plexus.realtimeRooms();
    if (!result.ok) {
      setRooms([]);
      setError(result.message ?? 'Realtime rooms unavailable.');
      return;
    }
    setRooms(result.rooms);
    const nextSelected = selectedRoomId && result.rooms.some((room) => room.id === selectedRoomId)
      ? selectedRoomId
      : result.rooms[0]?.id ?? null;
    setSelectedRoomId(nextSelected);
    if (nextSelected) await loadDetail(nextSelected);
  }, [loadDetail, selectedRoomId]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [projectList, timeEntries] = await Promise.all([
        window.plexus.projectList(),
        window.plexus.entryList(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`),
        refreshCapture(),
      ]);
      setProjects(projectList);
      setEntries(timeEntries);
      await loadRooms();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [loadRooms, refreshCapture]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const requestAccess = async (kind: MediaRequestKind) => {
    setRequesting(kind);
    setError(null);
    try {
      const mainStatus = await window.plexus.mediaRequestAccess(kind);
      const renderer = await rendererProbe();
      setStatus({ ...mainStatus, renderer });
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setRequesting(null);
    }
  };

  const selectRoom = async (roomId: string) => {
    setSelectedRoomId(roomId);
    setJoined(null);
    setSavedMeetingId(null);
    setError(null);
    await loadDetail(roomId);
  };

  const joinRoom = async () => {
    if (!selectedRoomId) return;
    setBusy('join');
    setError(null);
    setInfo(null);
    try {
      const result = await window.plexus.realtimeJoinRoom(selectedRoomId, {
        clientInstanceId: clientInstanceId.current,
        intent: 'media',
        media: {
          audio: Boolean(localAudio),
          video: Boolean(localCamera),
          screen: localScreens.length > 0,
        },
      });
      if (!result.ok || !result.joined) {
        setError(result.message ?? 'Could not join realtime room.');
        return;
      }
      const joinedResult = result.joined;
      setJoined(joinedResult);
      setDetail({
        room: joinedResult.room,
        call: joinedResult.call,
        participants: [joinedResult.participant],
        tracks: [],
      });
      setCloseout((current) => ({
        ...current,
        title: current.title || joinedResult.room.name,
      }));
      setInfo(joinedResult.cloudflare.configured ? 'Cloudflare Realtime broker ready.' : 'Joined with local track state; provider credentials are not configured.');
      await loadDetail(joinedResult.room.id);
    } finally {
      setBusy(null);
    }
  };

  const publishTrack = async (track: LocalTrack): Promise<string | undefined> => {
    if (!currentCall || !currentParticipant) return undefined;
    const result = await window.plexus.realtimePublishTrack(currentCall.id, {
      participantId: currentParticipant.id,
      trackKind: track.kind,
      direction: 'publish',
      label: track.label,
      sourceId: track.localId,
      cloudflareSessionId: currentParticipant.cloudflareSessionId,
      metadata: {
        localOnly: true,
        trackLabel: track.stream.getTracks()[0]?.label ?? track.label,
      },
    });
    if (!result.ok || !result.track) {
      setError(result.message ?? `Could not publish ${track.kind} track.`);
      return undefined;
    }
    await loadDetail(currentCall.roomId);
    return result.track.id;
  };

  const stopTrack = async (track: LocalTrack) => {
    track.stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
    if (track.workerTrackId && currentCall) {
      await window.plexus.realtimeCloseTrack(currentCall.id, track.workerTrackId);
    }
    if (track.kind === 'audio') setLocalAudio(null);
    if (track.kind === 'camera') setLocalCamera(null);
    if (track.kind === 'screen') setLocalScreens((items) => items.filter((item) => item.localId !== track.localId));
    if (currentCall) await loadDetail(currentCall.roomId);
  };

  const startAudio = async () => {
    if (localAudio) return stopTrack(localAudio);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone capture is unavailable in this renderer.');
      return;
    }
    setBusy('audio');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const track: LocalTrack = { localId: newLocalId('mic'), kind: 'audio', label: 'Microphone', stream };
      const workerTrackId = await publishTrack(track);
      setLocalAudio({ ...track, workerTrackId });
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const startCamera = async () => {
    if (localCamera) return stopTrack(localCamera);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera capture is unavailable in this renderer.');
      return;
    }
    setBusy('camera');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      const track: LocalTrack = { localId: newLocalId('cam'), kind: 'camera', label: 'Camera', stream };
      const workerTrackId = await publishTrack(track);
      setLocalCamera({ ...track, workerTrackId });
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const startScreen = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen capture is unavailable in this renderer.');
      return;
    }
    setBusy('screen');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoTrack = stream.getVideoTracks()[0];
      const track: LocalTrack = {
        localId: newLocalId('screen'),
        kind: 'screen',
        label: videoTrack?.label || `Screen ${localScreens.length + 1}`,
        stream,
      };
      const workerTrackId = await publishTrack(track);
      const stored = { ...track, workerTrackId };
      videoTrack.onended = () => { stopTrack(stored).catch(() => {}); };
      setLocalScreens((items) => [...items, stored]);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const leaveCall = async () => {
    if (!currentCall || !currentParticipant) return;
    setBusy('leave');
    setError(null);
    try {
      const tracks = [localAudio, localCamera, ...localScreens].filter(Boolean) as LocalTrack[];
      tracks.forEach((track) => track.stream.getTracks().forEach((mediaTrack) => mediaTrack.stop()));
      setLocalAudio(null);
      setLocalCamera(null);
      setLocalScreens([]);
      const result = await window.plexus.realtimeLeaveCall(currentCall.id, currentParticipant.id);
      if (!result.ok) {
        setError(result.message ?? 'Could not leave realtime call.');
        return;
      }
      setJoined(null);
      setInfo(result.ended ? 'Call ended after you left.' : 'Left call.');
      if (selectedRoomId) await loadDetail(selectedRoomId);
      await loadRooms();
    } finally {
      setBusy(null);
    }
  };

  const endCall = async () => {
    if (!currentCall) return;
    setBusy('end');
    setError(null);
    try {
      const result = await window.plexus.realtimeEndCall(currentCall.id);
      if (!result.ok) {
        setError(result.message ?? 'Could not end realtime call.');
        return;
      }
      setJoined(null);
      setInfo('Call ended.');
      await loadRooms();
      if (selectedRoomId) await loadDetail(selectedRoomId);
    } finally {
      setBusy(null);
    }
  };

  const saveCloseout = async () => {
    if (!currentCall) return;
    setBusy('closeout');
    setError(null);
    setInfo(null);
    try {
      const result = await window.plexus.realtimeCloseout(currentCall.id, {
        title: closeout.title || selectedRoom?.name,
        manualNotes: closeout.manualNotes,
        decisions: splitLines(closeout.decisions),
        actionItems: splitLines(closeout.actionItems),
        linkedIssueIds: splitCsv(closeout.issueIds),
        linkedTimeEntryIds: closeout.timeEntryId ? [closeout.timeEntryId] : [],
        timeEntryId: closeout.timeEntryId || null,
        sendToPaperclip: closeout.sendToPaperclip,
      });
      if (!result.ok || !result.meeting) {
        setError(result.message ?? 'Could not save meeting closeout.');
        return;
      }
      setSavedMeetingId(result.meeting.id);
      setInfo(`Meeting saved · ${result.meeting.paperclipStatus}`);
      if (selectedRoomId) await loadDetail(selectedRoomId);
    } finally {
      setBusy(null);
    }
  };

  const localTrackCount = useMemo(() => {
    return Number(Boolean(localAudio)) + Number(Boolean(localCamera)) + localScreens.length;
  }, [localAudio, localCamera, localScreens.length]);

  return (
    <div className="px-fadein">
      <PageHeader
        title="Realtime"
        sub="project rooms, calls, screen shares, and meeting links"
        right={
          <Button variant="accent" onClick={refreshAll} disabled={loading}>
            <IconSync s={14} /> {loading ? 'Syncing' : 'Refresh'}
          </Button>
        }
      />

      <div className="px-rt-layout">
        <Panel raised pad crosshairs>
          <div className="px-section-head">
            <div>
              <SectionLabel>room lobby</SectionLabel>
              <div className="px-section-title">Visible rooms</div>
            </div>
            <Badge tone={rooms.length ? 'mint' : undefined}>{rooms.length}</Badge>
          </div>
          <div className="px-scroll-stack">
            {rooms.map((room) => (
              <button
                key={room.id}
                className={`px-command-card ${selectedRoomId === room.id ? 'selected' : ''}`}
                onClick={() => selectRoom(room.id)}
              >
                <span className="rail" />
                <span className="px-command-main">
                  <span className="px-command-title"><strong>{room.name}</strong></span>
                  <span className="px-command-meta">{room.roomType} · {room.projectName ?? room.projectId ?? 'workspace'}</span>
                </span>
                <span className="px-command-aside">
                  <span className="px-command-progress">{room.presence.participants}</span>
                  <Badge tone={room.activeCallId ? 'mint' : undefined}>{room.activeCallId ? 'live' : room.state}</Badge>
                </span>
              </button>
            ))}
            {!rooms.length && <EmptyState icon={<IconCloud s={24} />}>No realtime rooms returned.</EmptyState>}
          </div>
        </Panel>

        <Panel raised pad crosshairs>
          <div className="px-section-head">
            <div>
              <SectionLabel>active room</SectionLabel>
              <div className="px-section-title">{selectedRoom?.name ?? 'No room selected'}</div>
              <div className="px-section-note">
                {selectedProject?.clientName ?? selectedRoom?.projectName ?? selectedRoom?.projectId ?? 'workspace room'}
              </div>
            </div>
            {currentCall ? <Badge tone="mint">{currentCall.state}</Badge> : <Badge>idle</Badge>}
          </div>

          <div className="px-console-grid">
            <StatCard label="participants" value={detail?.room.presence.participants ?? selectedRoom?.presence.participants ?? 0} accent={Boolean(currentCall)} />
            <StatCard label="screen shares" value={Math.max(detail?.room.presence.screenShares ?? 0, localScreens.length)} accent={localScreens.length > 0} />
            <StatCard label="local tracks" value={localTrackCount} accent={localTrackCount > 0} />
          </div>

          <div className="px-rt-controls">
            {!joined ? (
              <Button onClick={joinRoom} disabled={!selectedRoomId || busy === 'join'}>
                <IconUsers s={14} /> {busy === 'join' ? 'Joining' : 'Join'}
              </Button>
            ) : (
              <>
                <Button variant={localAudio ? 'accent' : 'ghost'} onClick={startAudio} disabled={busy === 'audio'}>
                  <IconMic s={14} /> {localAudio ? 'Mic on' : 'Mic off'}
                </Button>
                <Button variant={localCamera ? 'accent' : 'ghost'} onClick={startCamera} disabled={busy === 'camera'}>
                  <IconCamera s={14} /> {localCamera ? 'Camera on' : 'Camera off'}
                </Button>
                <Button variant="ghost" onClick={startScreen} disabled={busy === 'screen'}>
                  <IconScreen s={14} /> Add screen
                </Button>
                <Button variant="ghost" onClick={leaveCall} disabled={busy === 'leave'}>
                  <IconPhone s={14} /> Leave
                </Button>
                <Button variant="stop" onClick={endCall} disabled={!currentCall || busy === 'end'}>
                  <IconClose s={14} /> End
                </Button>
              </>
            )}
          </div>
        </Panel>
      </div>

      <div className="px-rt-media">
        <Panel raised pad crosshairs>
          <div className="px-section-head">
            <div>
              <SectionLabel>participants</SectionLabel>
              <div className="px-section-title">Call grid</div>
            </div>
            <Badge tone={joined ? 'mint' : undefined}>{joined ? 'joined' : 'lobby'}</Badge>
          </div>
          <div className="px-rt-grid">
            {liveParticipants.map((participant) => (
              <ParticipantTile
                key={participant.id}
                participant={participant}
                tracks={liveTracks.filter((track) => track.participantId === participant.id)}
                local={participant.id === currentParticipant?.id}
              />
            ))}
            {!liveParticipants.length && <EmptyState icon={<IconUsers s={24} />}>No participants in this call.</EmptyState>}
          </div>
        </Panel>

        <Panel raised pad crosshairs>
          <div className="px-section-head">
            <div>
              <SectionLabel>local preview</SectionLabel>
              <div className="px-section-title">Camera and screen publishers</div>
            </div>
            <Badge tone={localScreens.length > 1 ? 'mint' : undefined}>{localScreens.length} screens</Badge>
          </div>
          <div className="px-rt-preview">
            <div className="px-rt-camera">
              {localCamera ? <video ref={cameraRef} muted autoPlay playsInline /> : <div><IconCamera s={28} /><span>camera off</span></div>}
            </div>
            <div className="px-rt-screens">
              {localScreens.map((track) => (
                <ScreenPreview
                  key={track.localId}
                  track={track}
                  onAttach={(trackId, node) => { screenRefs.current[trackId] = node; }}
                  onStop={stopTrack}
                />
              ))}
              {localScreens.length === 0 && <EmptyState icon={<IconScreen s={24} />}>No active screen shares.</EmptyState>}
            </div>
          </div>
        </Panel>
      </div>

      {currentCall && (
        <Panel raised pad crosshairs style={{ marginTop: 18 }}>
          <div className="px-section-head">
            <div>
              <SectionLabel>meeting closeout</SectionLabel>
              <div className="px-section-title">Project, time, decisions, and Paperclip handoff</div>
            </div>
            {savedMeetingId && <Badge tone="mint">{savedMeetingId}</Badge>}
          </div>
          <div className="px-form-shell">
            <div className="px-form-grid">
              <Field label="title">
                <Input value={closeout.title} placeholder={selectedRoom?.name ?? 'Meeting'} onChange={(event) => setCloseout({ ...closeout, title: event.target.value })} />
              </Field>
              <Field label="linked time entry">
                <Select value={closeout.timeEntryId} onChange={(event) => setCloseout({ ...closeout, timeEntryId: event.target.value })}>
                  <option value="">No linked time entry</option>
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>{projects.find((project) => project.id === entry.projectId)?.name ?? entry.projectId} · {entry.description || entry.startTime}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="manual notes">
              <Textarea value={closeout.manualNotes} onChange={(event) => setCloseout({ ...closeout, manualNotes: event.target.value })} />
            </Field>
            <div className="px-form-grid">
              <Field label="decisions">
                <Textarea value={closeout.decisions} onChange={(event) => setCloseout({ ...closeout, decisions: event.target.value })} />
              </Field>
              <Field label="action items">
                <Textarea value={closeout.actionItems} onChange={(event) => setCloseout({ ...closeout, actionItems: event.target.value })} />
              </Field>
            </div>
            <div className="px-form-grid">
              <Field label="issue ids">
                <Input value={closeout.issueIds} onChange={(event) => setCloseout({ ...closeout, issueIds: event.target.value })} />
              </Field>
              <label className="px-rt-check">
                <input type="checkbox" checked={closeout.sendToPaperclip} onChange={(event) => setCloseout({ ...closeout, sendToPaperclip: event.target.checked })} />
                <span><IconLink s={14} /> Queue Paperclip memory</span>
              </label>
            </div>
            <div className="px-section-actions">
              <Button variant="ghost" onClick={saveCloseout} disabled={busy === 'closeout'}>
                <IconCheck s={14} /> {busy === 'closeout' ? 'Saving' : 'Save closeout'}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {status && (
        <Panel raised pad crosshairs style={{ marginTop: 18 }}>
          <div className="px-section-head">
            <div>
              <SectionLabel>capture boundary</SectionLabel>
              <div className="px-section-title">Local media readiness</div>
            </div>
          </div>
          <div className="px-console-grid">
            <StatCard label="platform" value={status.platform} />
            <StatCard label="build" value={status.isPackaged ? 'packaged' : 'dev'} />
            <StatCard label="desktop sources" value={status.desktopCapture.sourceCount} accent={status.desktopCapture.sourceCount > 0} />
            <StatCard label="audio inputs" value={status.renderer.audioInputs ?? 0} />
            <StatCard label="video inputs" value={status.renderer.videoInputs ?? 0} />
          </div>
          <div className="px-flow-grid" style={{ marginTop: 14 }}>
            <PermissionCard label="microphone" state={status.permissions.microphone} requestKind="microphone" onRequest={requestAccess} requesting={requesting === 'microphone'} />
            <PermissionCard label="camera" state={status.permissions.camera} requestKind="camera" onRequest={requestAccess} requesting={requesting === 'camera'} />
            <PermissionCard label="screen" state={status.permissions.screen} onRequest={requestAccess} requesting={false} />
          </div>
        </Panel>
      )}

      {(error || info) && (
        <Panel raised pad crosshairs style={{ marginTop: 18, borderColor: error ? 'var(--rose)' : 'var(--line-hot)' }}>
          <div style={{ color: error ? 'var(--rose)' : 'var(--accent)', fontWeight: 600 }}>{error ? 'Realtime state' : 'Realtime update'}</div>
          <div className="px-mono" style={{ fontSize: 11, marginTop: 6 }}>{error ?? info}</div>
        </Panel>
      )}
    </div>
  );
}
