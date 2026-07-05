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
  return rooms
    .filter((room) => room.roomType === 'project_room')
    .map((room) => {
      const activeMemberCount = Math.max(
        room.presence.participants,
        floor.filter((presence) => presence.roomId === room.id).length,
      );
      const screenShareCount = Math.max(
        room.presence.screenShares,
        tracks.filter((track) => (
          track.roomId === room.id
          && track.trackKind === 'screen'
          && track.direction === 'publish'
          && track.state === 'live'
        )).length,
      );

      return {
        roomId: room.id,
        projectId: room.projectId,
        label: room.projectName ?? room.name,
        activeMemberCount,
        screenShareCount,
        room,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function deriveFocusedZone(input: DeriveFocusedZoneInput = {}): CoWorkingFocusedZone {
  const selectedRoom = input.selectedRoom ?? null;
  const members = selectedRoom
    ? (input.floor ?? []).filter((presence) => presence.roomId === selectedRoom.id)
    : [];
  const screenTracks = selectedRoom
    ? liveScreenTracks(input.tracks ?? []).filter((track) => track.roomId === selectedRoom.id)
    : [];
  const pinnedTrackId = screenTracks.some((track) => track.id === input.pinnedTrackId)
    ? input.pinnedTrackId ?? null
    : null;
  const joined = Boolean(selectedRoom && input.activeRoomId === selectedRoom.id);

  return {
    kind: selectedRoom?.roomType === 'project_room' ? 'project' : 'lounge',
    room: selectedRoom,
    projectId: selectedRoom?.projectId ?? null,
    projectName: selectedRoom?.projectName ?? selectedRoom?.name ?? '',
    joinState: joined ? 'presence_only' : 'not_joined',
    members,
    screenTracks,
    pinnedTrackId,
    recordingState: input.recordingState ?? 'idle',
  };
}

export function deriveLoungeLayer(input: DeriveLoungeLayerInput = {}): CoWorkingLoungeLayer {
  return {
    room: input.loungeRoom ?? null,
    members: (input.floor ?? []).filter((presence) => presence.ringState === 'lounge'),
    visible: true,
    miniControlVisible: Boolean(input.projectZoneActive),
    audioPriority: input.projectZoneActive ? 'project' : 'lounge',
  };
}

export function deriveScreenWall(
  tracks: RealtimeMediaTrack[] = [],
  pinnedTrackId: string | null = null,
): CoWorkingScreenWall {
  const screenTracks = liveScreenTracks(tracks);
  const validPinnedTrackId = screenTracks.some((track) => track.id === pinnedTrackId)
    ? pinnedTrackId
    : null;

  return {
    mode: validPinnedTrackId ? 'pinned' : 'wall',
    pinnedTrackId: validPinnedTrackId,
    tiles: screenTracks.map((track) => ({
      trackId: track.id,
      participantId: track.participantId,
      label: track.label ?? 'Screen share',
      pinned: track.id === validPinnedTrackId,
      track,
    })),
  };
}

function liveScreenTracks(tracks: RealtimeMediaTrack[]): RealtimeMediaTrack[] {
  return tracks
    .filter((track) => (
      track.trackKind === 'screen'
      && track.direction === 'publish'
      && track.state === 'live'
    ))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
