import { describe, expect, it } from 'vitest';
import { deriveLoungeLayer } from '../../src/renderer/lib/coworkingModel';
import type { FloorPresence, RealtimeRoom } from '../../src/shared/types';

const loungeRoom: RealtimeRoom = {
  id: 'room_lounge',
  workspaceId: 'workspace_1',
  projectId: null,
  projectName: null,
  name: 'Lounge',
  slug: 'lounge',
  roomType: 'workspace_lobby',
  state: 'open',
  visibility: 'workspace',
  activeCallId: 'call_lounge',
  activeCall: null,
  presence: {
    participants: 1,
    screenShares: 0,
  },
  metadata: {},
  lastActivityAt: '2026-07-06T10:00:00.000Z',
  createdAt: '2026-07-06T09:00:00.000Z',
  updatedAt: '2026-07-06T10:00:00.000Z',
};

function presence(input: {
  roomId: string | null;
  participantId: string;
  ringState: FloorPresence['ringState'];
}): FloorPresence {
  return {
    participantId: input.participantId,
    displayName: input.participantId,
    initials: input.participantId.slice(0, 2).toUpperCase(),
    ringState: input.ringState,
    roomId: input.roomId,
    roomName: input.roomId,
    projectTag: input.roomId,
    isSpeaking: false,
  };
}

describe('coworking lounge layer model', () => {
  it('keeps lounge members visible as a mini layer while project media has priority', () => {
    const layer = deriveLoungeLayer({
      loungeRoom,
      projectZoneActive: true,
      floor: [
        presence({ roomId: loungeRoom.id, participantId: 'participant_lounge', ringState: 'lounge' }),
        presence({ roomId: loungeRoom.id, participantId: 'participant_lounge_room_id', ringState: 'online' }),
        presence({ roomId: 'room_project', participantId: 'participant_project', ringState: 'online' }),
      ],
    });

    expect(layer.room).toBe(loungeRoom);
    expect(layer.visible).toBe(true);
    expect(layer.miniControlVisible).toBe(true);
    expect(layer.audioPriority).toBe('project');
    expect(layer.members.map((member) => member.participantId)).toEqual([
      'participant_lounge',
      'participant_lounge_room_id',
    ]);
  });
});
