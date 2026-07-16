import { describe, expect, it } from 'vitest';
import { deriveFocusedZone } from '../../src/renderer/lib/coworkingModel';
import type {
  FloorPresence,
  RealtimeMediaTrack,
  RealtimeParticipant,
  RealtimeRoom,
} from '../../src/shared/types';

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
    isSpeaking: participantId.endsWith('shesh'),
  };
}

function track(input: {
  id: string;
  roomId: string;
  trackKind: RealtimeMediaTrack['trackKind'];
  state?: RealtimeMediaTrack['state'];
  participantId?: string;
}): RealtimeMediaTrack {
  return {
    id: input.id,
    workspaceId: 'workspace_1',
    roomId: input.roomId,
    callSessionId: 'call_1',
    participantId: input.participantId ?? 'participant_1',
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

function participant(input: {
  id: string;
  roomId: string;
  displayName: string;
  state?: RealtimeParticipant['state'];
}): RealtimeParticipant {
  return {
    id: input.id,
    workspaceId: 'workspace_1',
    roomId: input.roomId,
    callSessionId: 'call_1',
    identityId: `identity_${input.id}`,
    employeeId: null,
    displayName: input.displayName,
    role: 'participant',
    state: input.state ?? 'joined',
    cloudflareSessionId: null,
    media: {
      audio: true,
      video: false,
      screen: false,
    },
    joinedAt: '2026-07-06T10:00:00.000Z',
    leftAt: null,
    lastSeenAt: '2026-07-06T10:00:02.000Z',
    metadata: {},
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
    expect(zone.selectionIntent).toBe('joined');
    expect(zone.stageMode).toBe('meet_like_focus');
    expect(zone.members.map((member) => member.participantId)).toEqual(['participant_shesh']);
    expect(zone.participants).toMatchObject([
      {
        participantId: 'participant_shesh',
        stageRole: 'speaker',
      },
    ]);
    expect(zone.presenceSummary).toEqual({
      memberCount: 1,
      speakingCount: 1,
      screenShareCount: 1,
    });
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

  it('fills focused stage participants from room detail when floor presence was deduped elsewhere', () => {
    const selectedRoom = projectRoom();
    const zone = deriveFocusedZone({
      selectedRoom,
      floor: [
        presence('room_lounge', 'participant_lounge_priority'),
      ],
      participants: [
        participant({ id: 'participant_room_detail', roomId: selectedRoom.id, displayName: 'Maya Patel' }),
        participant({ id: 'participant_left', roomId: selectedRoom.id, displayName: 'Past Member', state: 'left' }),
      ],
      tracks: [
        track({
          id: 'audio_room_detail',
          roomId: selectedRoom.id,
          trackKind: 'audio',
          participantId: 'participant_room_detail',
        }),
      ],
    });

    expect(zone.members).toEqual([]);
    expect(zone.participants).toMatchObject([
      {
        participantId: 'participant_room_detail',
        displayName: 'Maya Patel',
        initials: 'MP',
        stageRole: 'participant',
      },
    ]);
    expect(zone.presenceSummary).toEqual({
      memberCount: 1,
      speakingCount: 0,
      screenShareCount: 0,
    });
  });

  it('dedupes room-detail participants that are already present on the floor', () => {
    const selectedRoom = projectRoom();
    const zone = deriveFocusedZone({
      selectedRoom,
      floor: [
        presence(selectedRoom.id, 'participant_shesh'),
      ],
      participants: [
        participant({ id: 'participant_shesh', roomId: selectedRoom.id, displayName: 'Duplicate Shesh' }),
        participant({ id: 'participant_maya', roomId: selectedRoom.id, displayName: 'Maya Patel' }),
      ],
    });

    expect(zone.participants.map((member) => member.participantId)).toEqual([
      'participant_maya',
      'participant_shesh',
    ]);
    expect(zone.participants.filter((member) => member.participantId === 'participant_shesh')).toHaveLength(1);
    expect(zone.presenceSummary.memberCount).toBe(2);
  });

  it('keeps recording idle and media unjoined when only focus changes', () => {
    const selectedRoom = projectRoom();
    const zone = deriveFocusedZone({
      selectedRoom,
      activeRoomId: 'room_project_elsewhere',
      recordingState: 'idle',
    });

    expect(zone.joinState).toBe('not_joined');
    expect(zone.selectionIntent).toBe('focus_only');
    expect(zone.recordingState).toBe('idle');
    expect(zone.screenTracks).toEqual([]);
  });
});
