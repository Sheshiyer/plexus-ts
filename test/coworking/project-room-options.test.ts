import { describe, expect, it } from 'vitest';
import { listProjectRoomOptions } from '../../src/renderer/lib/coworkingModel';
import type { FloorPresence, RealtimeMediaTrack, RealtimeRoom } from '../../src/shared/types';

function projectRoom(input: {
  id: string;
  name: string;
  projectName?: string | null;
  activeParticipants?: number;
  screenShares?: number;
}): RealtimeRoom {
  return {
    id: input.id,
    workspaceId: 'workspace_1',
    projectId: `project_${input.id}`,
    projectName: input.projectName ?? input.name,
    name: input.name,
    slug: input.id,
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: null,
    activeCall: null,
    presence: {
      participants: input.activeParticipants ?? 0,
      screenShares: input.screenShares ?? 0,
    },
    metadata: {},
    lastActivityAt: '2026-07-06T10:00:00.000Z',
    createdAt: '2026-07-06T09:00:00.000Z',
    updatedAt: '2026-07-06T10:00:00.000Z',
  };
}

function loungeRoom(): RealtimeRoom {
  return {
    ...projectRoom({ id: 'lobby', name: 'Lounge' }),
    projectId: null,
    projectName: null,
    roomType: 'workspace_lobby',
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

function screen(roomId: string, id: string): RealtimeMediaTrack {
  return {
    id,
    workspaceId: 'workspace_1',
    roomId,
    callSessionId: 'call_1',
    participantId: 'participant_1',
    identityId: 'identity_1',
    trackKind: 'screen',
    direction: 'publish',
    state: 'live',
    label: id,
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

describe('coworking project room options', () => {
  it('excludes the lounge and sorts active project rooms before inactive rooms by label', () => {
    const options = listProjectRoomOptions(
      [
        loungeRoom(),
        projectRoom({ id: 'zeta', name: 'Zeta room', projectName: 'Zeta' }),
        projectRoom({ id: 'alpha', name: 'Alpha room', projectName: 'Alpha' }),
      ],
      [presence('zeta', 'participant_zed')],
      [screen('zeta', 'screen_1')],
    );

    expect(options.map((option) => option.roomId)).toEqual(['zeta', 'alpha']);
    expect(options[0]).toMatchObject({
      projectId: 'project_zeta',
      label: 'Zeta',
      activeMemberCount: 1,
      screenShareCount: 1,
    });
    expect(options[1]).toMatchObject({
      projectId: 'project_alpha',
      label: 'Alpha',
      activeMemberCount: 0,
      screenShareCount: 0,
    });
  });
});
