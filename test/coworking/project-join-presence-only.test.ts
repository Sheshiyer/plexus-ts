import { describe, expect, it } from 'vitest';
import { buildProjectRoomJoinRequest } from '../../src/renderer/lib/coworkingModel';
import type { RealtimeRoom } from '../../src/shared/types';

function projectRoom(overrides: Partial<RealtimeRoom> = {}): RealtimeRoom {
  const id = overrides.id ?? 'room_project_ambient_floor';
  const projectId = overrides.projectId ?? 'project_ambient_floor';
  const projectName = overrides.projectName ?? 'Ambient floor';

  return {
    id,
    workspaceId: 'workspace_1',
    projectId,
    projectName,
    name: overrides.name ?? `${projectName} room`,
    slug: overrides.slug ?? id.replaceAll('_', '-'),
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: null,
    activeCall: null,
    presence: {
      participants: 0,
      screenShares: 0,
    },
    metadata: {},
    lastActivityAt: '2026-07-05T10:00:00.000Z',
    createdAt: '2026-07-05T09:00:00.000Z',
    updatedAt: '2026-07-05T10:00:00.000Z',
    ...overrides,
  };
}

describe('project room join is always presence-only', () => {
  it('builds a presence-only join with all media disabled for a normal project room', () => {
    const request = buildProjectRoomJoinRequest(projectRoom());

    expect(request).toEqual({
      intent: 'presence_only',
      media: { audio: false, video: false, screen: false },
    });
  });

  it('stays presence-only with all media disabled even when the room has an active call', () => {
    const roomWithLiveCall = projectRoom({
      activeCallId: 'call_live',
      presence: { participants: 3, screenShares: 1 },
    });

    const request = buildProjectRoomJoinRequest(roomWithLiveCall);

    expect(request).toEqual({
      intent: 'presence_only',
      media: { audio: false, video: false, screen: false },
    });
    expect(request.intent).toBe('presence_only');
    expect(request.media).toEqual({ audio: false, video: false, screen: false });
    expect(request).not.toHaveProperty('clientInstanceId');
  });
});
