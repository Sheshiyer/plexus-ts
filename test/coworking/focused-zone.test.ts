import { describe, expect, it } from 'vitest';
import { deriveFocusedZone } from '../../src/renderer/lib/coworkingModel';
import type { FloorPresence, RealtimeMediaTrack, RealtimeRoom } from '../../src/shared/types';

function projectRoom(id = 'room_project_ambient_floor'): RealtimeRoom {
  return {
    id,
    workspaceId: 'workspace_1',
    projectId: 'project_ambient_floor',
    projectName: 'Ambient floor',
    name: 'Ambient floor room',
    slug: 'ambient-floor',
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: 'call_ambient_floor',
    activeCall: null,
    presence: {
      participants: 2,
      screenShares: 1,
    },
    metadata: {},
    lastActivityAt: '2026-07-06T10:00:00.000Z',
    createdAt: '2026-07-06T09:00:00.000Z',
    updatedAt: '2026-07-06T10:00:00.000Z',
  };
}

function presence(roomId: string, participantId: string): FloorPresence {
  return {
    participantId,
    displayName: participantId,
    initials: participantId.slice(0, 2).toUpperCase(),
    ringState: 'online',
    roomId,
    roomName: roomId,
    projectTag: roomId,
    isSpeaking: false,
  };
}

function track(input: {
  id: string;
  roomId: string;
  trackKind: RealtimeMediaTrack['trackKind'];
  state?: RealtimeMediaTrack['state'];
}): RealtimeMediaTrack {
  return {
    id: input.id,
    workspaceId: 'workspace_1',
    roomId: input.roomId,
    callSessionId: 'call_1',
    participantId: 'participant_1',
    identityId: 'identity_1',
    trackKind: input.trackKind,
    direction: 'publish',
    state: input.state ?? 'live',
    label: input.id,
    sourceId: null,
    cloudflareSessionId: null,
    cloudflareTrackId: null,
    targetTrackIds: [],
    metadata: {},
    startedAt: '2026-07-06T10:00:00.000Z',
    endedAt: null,
    updatedAt: '2026-07-06T10:00:00.000Z',
  };
}

describe('coworking focused zone model', () => {
  it('derives members, live screen tracks, and presence join state for the selected room', () => {
    const selectedRoom = projectRoom();
    const zone = deriveFocusedZone({
      selectedRoom,
      activeRoomId: selectedRoom.id,
      floor: [
        presence(selectedRoom.id, 'participant_shesh'),
        presence('room_project_other', 'participant_maya'),
      ],
      tracks: [
        track({ id: 'screen_live', roomId: selectedRoom.id, trackKind: 'screen' }),
        track({ id: 'screen_closed', roomId: selectedRoom.id, trackKind: 'screen', state: 'closed' }),
        track({ id: 'camera_live', roomId: selectedRoom.id, trackKind: 'camera' }),
        track({ id: 'other_screen', roomId: 'room_project_other', trackKind: 'screen' }),
      ],
      pinnedTrackId: 'screen_live',
    });

    expect(zone.kind).toBe('project');
    expect(zone.joinState).toBe('presence_only');
    expect(zone.members.map((member) => member.participantId)).toEqual(['participant_shesh']);
    expect(zone.screenTracks.map((screenTrack) => screenTrack.id)).toEqual(['screen_live']);
    expect(zone.pinnedTrackId).toBe('screen_live');
  });

  it('clears a pinned track id that is not part of the selected room screen wall', () => {
    const zone = deriveFocusedZone({
      selectedRoom: projectRoom(),
      tracks: [track({ id: 'screen_live', roomId: 'room_project_ambient_floor', trackKind: 'screen' })],
      pinnedTrackId: 'missing_screen',
    });

    expect(zone.pinnedTrackId).toBeNull();
  });
});
