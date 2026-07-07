import type { CoWorkingFocusedZone, CoWorkingRecordingState } from '../../shared/coworking';
import type { FloorPresence, RealtimeMediaTrack, RealtimeRoom } from '../../shared/types';

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

export function deriveFocusedZone(input: DeriveFocusedZoneInput = {}): CoWorkingFocusedZone {
  const selectedRoom = input.selectedRoom ?? null;
  const screenTracks = selectedRoom
    ? (input.tracks ?? []).filter((track) => track.roomId === selectedRoom.id && isLivePublishedScreenTrack(track))
    : [];
  const pinnedTrackId = screenTracks.some((track) => track.id === input.pinnedTrackId)
    ? input.pinnedTrackId ?? null
    : null;

  return {
    kind: selectedRoom?.roomType === 'project_room' ? 'project' : 'lounge',
    room: selectedRoom,
    projectId: selectedRoom?.projectId ?? null,
    projectName: selectedRoom?.projectName ?? selectedRoom?.name ?? '',
    joinState: selectedRoom && input.activeRoomId === selectedRoom.id ? 'presence_only' : 'not_joined',
    members: selectedRoom ? (input.floor ?? []).filter((presence) => presence.roomId === selectedRoom.id) : [],
    screenTracks,
    pinnedTrackId,
    recordingState: input.recordingState ?? 'idle',
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
