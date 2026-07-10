import type {
  CoWorkingDegradedStateLevel,
  CoWorkingDegradedStateSignal,
  CoWorkingFocusedZone,
  CoWorkingIndependentDegradedStates,
  CoWorkingMediaTransportState,
  CoWorkingPresenceMap,
  CoWorkingProjectMediaHonesty,
  CoWorkingRecordingConsentShell,
  CoWorkingRecordingState,
  CoWorkingSfuLiveTransportAcceptance,
  CoWorkingStageParticipant,
} from '../../shared/coworking';
import type {
  FloorPresence,
  RealtimeJoinInput,
  RealtimeMediaTrack,
  RealtimeParticipant,
  RealtimeRoom,
} from '../../shared/types';

export interface CoWorkingProjectRoomOption {
  roomId: string;
  projectId: string | null;
  label: string;
  activeMemberCount: number;
  screenShareCount: number;
  room: RealtimeRoom;
}

export interface DeriveFocusedZoneInput {
  selectedRoom?: RealtimeRoom | null;
  activeRoomId?: string | null;
  floor?: FloorPresence[];
  participants?: RealtimeParticipant[];
  tracks?: RealtimeMediaTrack[];
  pinnedTrackId?: string | null;
  recordingState?: CoWorkingRecordingState;
}

export interface CoWorkingLoungeLayer {
  room: RealtimeRoom | null;
  members: FloorPresence[];
  visible: boolean;
  miniControlVisible: boolean;
  audioPriority: 'lounge' | 'project';
}

export interface DeriveLoungeLayerInput {
  loungeRoom?: RealtimeRoom | null;
  floor?: FloorPresence[];
  projectZoneActive?: boolean;
}

export interface DeriveProjectMediaHonestyInput {
  activeProjectJoin?: boolean;
  transportReady?: boolean;
  transportError?: string | null;
}

export interface DeriveRecordingConsentShellInput {
  focusedZone: CoWorkingFocusedZone;
  activeProjectJoin?: boolean;
  recordingRoutesReady?: boolean;
}

export interface DeriveCoWorkingDegradedStatesInput {
  floorError?: string | null;
  roomsError?: string | null;
  roomDetailError?: string | null;
  deviceError?: string | null;
  loungeError?: string | null;
  transportState?: CoWorkingMediaTransportState;
}

export interface DeriveSfuLiveTransportAcceptanceInput {
  transportState?: CoWorkingMediaTransportState;
  liveProofVerified?: boolean;
}

export interface CoWorkingScreenWallTile {
  trackId: string;
  participantId: string;
  label: string;
  pinned: boolean;
  track: RealtimeMediaTrack;
}

export interface CoWorkingScreenWall {
  mode: 'wall' | 'pinned';
  pinnedTrackId: string | null;
  tiles: CoWorkingScreenWallTile[];
}

function isLivePublishedScreenTrack(track: RealtimeMediaTrack): boolean {
  return track.trackKind === 'screen' && track.direction === 'publish' && track.state === 'live';
}

function compareLabels(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function initialsForName(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 3)
    .join('');
  return (initials || name.slice(0, 2)).toUpperCase();
}

function toStageParticipant(presence: FloorPresence): CoWorkingStageParticipant {
  return {
    participantId: presence.participantId,
    displayName: presence.displayName,
    initials: presence.initials,
    roomId: presence.roomId,
    roomName: presence.roomName,
    projectTag: presence.projectTag,
    ringState: presence.ringState,
    isSpeaking: presence.isSpeaking,
    stageRole: presence.isSpeaking ? 'speaker' : 'participant',
  };
}

function toStageParticipantFromRealtimeParticipant(
  participant: RealtimeParticipant,
  room: RealtimeRoom,
  tracks: RealtimeMediaTrack[] = [],
): CoWorkingStageParticipant {
  const isSpeaking = tracks.some((track) => (
    track.participantId === participant.id
    && track.trackKind === 'audio'
    && track.state === 'live'
  ));
  const ringState: FloorPresence['ringState'] = room.roomType === 'workspace_lobby'
    ? 'lounge'
    : room.activeCallId
      ? 'timing'
      : 'online';
  return {
    participantId: participant.id,
    displayName: participant.displayName,
    initials: initialsForName(participant.displayName || participant.id),
    roomId: room.id,
    roomName: room.name,
    projectTag: room.projectName ? room.projectName.toUpperCase() : room.name.toUpperCase(),
    ringState,
    isSpeaking,
    stageRole: isSpeaking ? 'speaker' : 'participant',
  };
}

export function derivePresenceMap(floor: FloorPresence[] = []): CoWorkingPresenceMap {
  const zoneLabels: Record<FloorPresence['ringState'], string> = {
    timing: 'In voice',
    online: 'On the floor',
    lounge: 'Ambient lounge',
    idle: 'Away',
  };
  const order: FloorPresence['ringState'][] = ['timing', 'online', 'lounge', 'idle'];
  const activeRoomIds = Array.from(new Set(
    floor
      .map((presence) => presence.roomId)
      .filter((roomId): roomId is string => Boolean(roomId)),
  )).sort(compareLabels);

  return {
    zones: order.map((key) => {
      const participants = floor
        .filter((presence) => presence.ringState === key)
        .map(toStageParticipant)
        .sort((left, right) => compareLabels(left.displayName, right.displayName));
      return {
        key,
        label: zoneLabels[key],
        participants,
        activeRoomIds: Array.from(new Set(
          participants
            .map((participant) => participant.roomId)
            .filter((roomId): roomId is string => Boolean(roomId)),
        )).sort(compareLabels),
      };
    }),
    totalPresent: floor.filter((presence) => presence.ringState !== 'idle').length,
    activeRoomIds,
    focusOnly: true,
  };
}

export function listProjectRoomOptions(
  rooms: RealtimeRoom[],
  floor: FloorPresence[] = [],
  tracks: RealtimeMediaTrack[] = [],
): CoWorkingProjectRoomOption[] {
  return rooms
    .filter((room) => room.roomType === 'project_room')
    .map((room): CoWorkingProjectRoomOption => {
      const activeMemberCount = floor.filter((presence) => presence.roomId === room.id).length;
      const screenShareCount = tracks.filter((track) => (
        track.roomId === room.id && isLivePublishedScreenTrack(track)
      )).length;
      return {
        roomId: room.id,
        projectId: room.projectId,
        label: room.projectName ?? room.name,
        activeMemberCount,
        screenShareCount,
        room,
      };
    })
    .sort((left, right) => (
      right.activeMemberCount - left.activeMemberCount
      || right.screenShareCount - left.screenShareCount
      || compareLabels(left.label, right.label)
      || compareLabels(left.roomId, right.roomId)
    ));
}

export function buildProjectRoomJoinRequest(
  room: RealtimeRoom,
  clientInstanceId: string,
): RealtimeJoinInput {
  // Product rule: joining a project room is ALWAYS presence-only. Media (mic/camera/
  // screen) is a separate, explicit post-join action, so `room.activeCallId` is
  // intentionally ignored here — the presence-only contract holds for every room.
  void room.id;
  return {
    clientInstanceId,
    intent: 'presence_only',
    media: { audio: false, video: false, screen: false },
  };
}

export function deriveFocusedZone(input: DeriveFocusedZoneInput = {}): CoWorkingFocusedZone {
  const selectedRoom = input.selectedRoom ?? null;
  const screenTracks = selectedRoom
    ? (input.tracks ?? []).filter((track) => track.roomId === selectedRoom.id && isLivePublishedScreenTrack(track))
    : [];
  const pinnedTrackId = screenTracks.some((track) => track.id === input.pinnedTrackId)
    ? input.pinnedTrackId ?? null
    : null;
  const members = selectedRoom ? (input.floor ?? []).filter((presence) => presence.roomId === selectedRoom.id) : [];
  const joinState = selectedRoom && input.activeRoomId === selectedRoom.id ? 'presence_only' : 'not_joined';
  const participantMap = new Map<string, CoWorkingStageParticipant>(
    members.map((member) => [member.participantId, toStageParticipant(member)]),
  );
  if (selectedRoom) {
    for (const participant of input.participants ?? []) {
      if (participant.roomId !== selectedRoom.id || participant.state !== 'joined') continue;
      if (!participantMap.has(participant.id)) {
        participantMap.set(participant.id, toStageParticipantFromRealtimeParticipant(participant, selectedRoom, input.tracks));
      }
    }
  }
  const participants = Array.from(participantMap.values()).sort((left, right) => compareLabels(left.displayName, right.displayName));

  return {
    kind: selectedRoom?.roomType === 'project_room' ? 'project' : 'lounge',
    room: selectedRoom,
    projectId: selectedRoom?.projectId ?? null,
    projectName: selectedRoom?.projectName ?? selectedRoom?.name ?? '',
    joinState,
    selectionIntent: joinState === 'not_joined' ? 'focus_only' : 'joined',
    stageMode: 'meet_like_focus',
    members,
    participants,
    screenTracks,
    pinnedTrackId,
    recordingState: input.recordingState ?? 'idle',
    presenceSummary: {
      memberCount: participants.length,
      speakingCount: participants.filter((participant) => participant.isSpeaking).length,
      screenShareCount: screenTracks.length,
    },
  };
}

export function deriveLoungeLayer(input: DeriveLoungeLayerInput = {}): CoWorkingLoungeLayer {
  const loungeRoom = input.loungeRoom ?? null;
  return {
    room: loungeRoom,
    members: (input.floor ?? []).filter((presence) => (
      presence.ringState === 'lounge' || Boolean(loungeRoom && presence.roomId === loungeRoom.id)
    )),
    visible: true,
    miniControlVisible: Boolean(input.projectZoneActive),
    audioPriority: input.projectZoneActive ? 'project' : 'lounge',
  };
}

export function deriveProjectMediaHonesty(
  input: DeriveProjectMediaHonestyInput = {},
): CoWorkingProjectMediaHonesty {
  const activeProjectJoin = Boolean(input.activeProjectJoin);
  const transportState: CoWorkingMediaTransportState = input.transportReady
    ? 'ready'
    : input.transportError
      ? 'degraded'
      : 'deferred';
  const mediaEnabled = activeProjectJoin && transportState === 'ready';
  const primaryCopy = !activeProjectJoin
    ? 'Drop in to enable project media.'
    : transportState === 'ready'
      ? 'Project media ready.'
      : transportState === 'degraded'
        ? 'Live SFU transport unavailable; presence and metadata are still available.'
        : 'Project mic, camera & screen ship with realtime media transport.';

  return {
    controlsVisible: true,
    activeProjectJoin,
    transportState,
    gated: !mediaEnabled,
    audioEnabled: mediaEnabled,
    cameraEnabled: mediaEnabled,
    screenEnabled: mediaEnabled,
    primaryCopy,
    gateCopy: mediaEnabled
      ? 'Project mic, camera, and screen can publish through live transport.'
      : 'Controls gated; no hidden publish until live SFU transport is connected.',
    proofCopy: mediaEnabled
      ? 'True live SFU proof verified for project media.'
      : 'SFU live proof pending; local visual fallback is not live proof.',
    signals: [
      'controls visible',
      transportState === 'ready' ? 'transport ready' : `transport ${transportState}`,
      mediaEnabled ? 'controls enabled' : 'controls gated',
      'no hidden publish',
    ],
  };
}

export function deriveRecordingConsentShell(
  input: DeriveRecordingConsentShellInput,
): CoWorkingRecordingConsentShell {
  const visible = input.focusedZone.kind === 'project' && Boolean(input.focusedZone.room);
  const activeProjectJoin = Boolean(input.activeProjectJoin);
  const canRequestConsent = visible && activeProjectJoin && input.focusedZone.participants.length > 0;

  return {
    visible,
    scope: 'focused_project_zone',
    loungeDefault: false,
    projectScoped: true,
    requiresConsent: true,
    canRequestConsent,
    startEnabled: false,
    participantCount: input.focusedZone.participants.length,
    captureKinds: ['audio', 'screen'],
    title: 'Recording consent',
    body: activeProjectJoin
      ? 'Recording requires project consent before any focused project-zone capture.'
      : 'Drop in before requesting project recording consent.',
    disabledReason: input.recordingRoutesReady
      ? 'Start disabled until every visible participant consents.'
      : 'Start disabled until every visible participant consents and recording routes are ready.',
    chips: [
      'focused project zone only',
      'project scoped',
      'consent required',
      'lounge is not recorded',
      'no hidden capture',
    ],
  };
}

function degradedSignal(
  kind: CoWorkingDegradedStateSignal['kind'],
  label: string,
  level: CoWorkingDegradedStateLevel,
  message: string,
): CoWorkingDegradedStateSignal {
  return { kind, label, level, message };
}

export function deriveCoWorkingDegradedStates(
  input: DeriveCoWorkingDegradedStatesInput = {},
): CoWorkingIndependentDegradedStates {
  const transportState = input.transportState ?? 'deferred';
  const transportSignal = transportState === 'ready'
    ? degradedSignal('transport', 'Transport', 'ok', 'Live SFU transport connected for project media.')
    : transportState === 'degraded'
      ? degradedSignal('transport', 'Transport', 'blocked', 'Live SFU transport unavailable; presence and metadata are still available.')
      : degradedSignal('transport', 'Transport', 'deferred', 'Project media transport deferred; controls stay gated.');
  const signals: CoWorkingDegradedStateSignal[] = [
    degradedSignal(
      'floor',
      'Floor',
      input.floorError ? 'blocked' : 'ok',
      input.floorError
        ? 'Floor presence is unavailable; room controls remain available below.'
        : 'Floor presence online.',
    ),
    degradedSignal(
      'rooms',
      'Rooms',
      input.roomsError ? 'blocked' : 'ok',
      input.roomsError
        ? 'Project rooms are unavailable; lounge remains available.'
        : 'Project rooms online.',
    ),
    degradedSignal(
      'room_detail',
      'Room detail',
      input.roomDetailError ? 'blocked' : 'ok',
      input.roomDetailError
        ? 'Focused room detail unavailable; room rail and lounge remain available.'
        : 'Focused room detail online.',
    ),
    degradedSignal(
      'devices',
      'Devices',
      input.deviceError ? 'blocked' : 'ok',
      input.deviceError
        ? 'Media device error; you can still leave or save closeout.'
        : 'Media devices available.',
    ),
    degradedSignal(
      'lounge',
      'Lounge',
      input.loungeError ? 'blocked' : 'ok',
      input.loungeError
        ? 'Lounge unavailable; project stage remains available.'
        : 'Lounge available.',
    ),
    transportSignal,
  ];

  return {
    title: 'Independent degraded states',
    signals,
    activeIssueCount: signals.filter((signal) => signal.level !== 'ok').length,
  };
}

export function deriveSfuLiveTransportAcceptance(
  input: DeriveSfuLiveTransportAcceptanceInput = {},
): CoWorkingSfuLiveTransportAcceptance {
  const liveProofVerified = Boolean(input.liveProofVerified && input.transportState === 'ready');
  const status = liveProofVerified
    ? 'verified'
    : input.transportState === 'degraded'
      ? 'degraded_fallback'
      : 'pending_live_proof';

  return {
    liveProofRequired: true,
    liveProofVerified,
    localFallbackAccepted: true,
    status,
    proofBoundary: 'True live SFU proof requires configured Cloudflare, connected peer connection, remote stream receipt, and clean leave.',
    fallbackBoundary: 'Presence and track metadata recorded; live SFU media is not connected.',
    acceptanceCopy: liveProofVerified
      ? 'True live SFU transport proof is verified.'
      : 'True live SFU proof required before enabling project media; local visual fallback is not live proof.',
  };
}

export function deriveScreenWall(
  tracks: RealtimeMediaTrack[] = [],
  pinnedTrackId: string | null = null,
): CoWorkingScreenWall {
  const screenTracks = tracks
    .filter(isLivePublishedScreenTrack)
    .slice()
    .sort((left, right) => (
      left.startedAt.localeCompare(right.startedAt)
      || left.id.localeCompare(right.id)
    ));
  const activePinnedTrackId = screenTracks.some((track) => track.id === pinnedTrackId)
    ? pinnedTrackId
    : null;
  const tiles = screenTracks.map((track): CoWorkingScreenWallTile => ({
    trackId: track.id,
    participantId: track.participantId,
    label: track.label ?? track.participantId,
    pinned: track.id === activePinnedTrackId,
    track,
  }));

  return {
    mode: activePinnedTrackId ? 'pinned' : 'wall',
    pinnedTrackId: activePinnedTrackId,
    tiles,
  };
}
