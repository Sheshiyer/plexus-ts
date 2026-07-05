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

export function listProjectRoomOptions(
  rooms: RealtimeRoom[],
  floor: FloorPresence[] = [],
  tracks: RealtimeMediaTrack[] = [],
): CoWorkingProjectRoomOption[] {
  void rooms;
  void floor;
  void tracks;
  return [];
}

export function deriveFocusedZone(input: DeriveFocusedZoneInput = {}): CoWorkingFocusedZone {
  const selectedRoom = input.selectedRoom ?? null;

  return {
    kind: selectedRoom?.roomType === 'project_room' ? 'project' : 'lounge',
    room: selectedRoom,
    projectId: selectedRoom?.projectId ?? null,
    projectName: selectedRoom?.projectName ?? selectedRoom?.name ?? '',
    joinState: 'not_joined',
    members: [],
    screenTracks: [],
    pinnedTrackId: input.pinnedTrackId ?? null,
    recordingState: input.recordingState ?? 'idle',
  };
}

export function deriveLoungeLayer(input: DeriveLoungeLayerInput = {}): CoWorkingLoungeLayer {
  return {
    room: input.loungeRoom ?? null,
    members: [],
    visible: true,
    miniControlVisible: Boolean(input.projectZoneActive),
    audioPriority: input.projectZoneActive ? 'project' : 'lounge',
  };
}

export function deriveScreenWall(
  tracks: RealtimeMediaTrack[] = [],
  pinnedTrackId: string | null = null,
): CoWorkingScreenWall {
  void tracks;

  return {
    mode: pinnedTrackId ? 'pinned' : 'wall',
    pinnedTrackId,
    tiles: [],
  };
}
