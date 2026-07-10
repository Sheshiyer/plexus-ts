import type {
  CoWorkingFocusedZone,
  CoWorkingPresenceMap,
  CoWorkingRecordingState,
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
