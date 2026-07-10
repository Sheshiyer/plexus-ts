import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  deriveFocusedZone,
  deriveLoungeLayer,
  derivePresenceMap,
  deriveScreenWall,
  listProjectRoomOptions,
} from '../../src/renderer/lib/coworkingModel';
import type { FloorPresence, RealtimeRoom } from '../../src/shared/types';

const selectedRoom: RealtimeRoom = {
  id: 'room_project_ambient_floor',
  workspaceId: 'workspace_1',
  projectId: 'project_ambient_floor',
  projectName: 'Ambient floor',
  name: 'Ambient floor room',
  slug: 'ambient-floor',
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
};

function presence(input: {
  participantId: string;
  displayName?: string;
  ringState: FloorPresence['ringState'];
  roomId?: string | null;
  isSpeaking?: boolean;
}): FloorPresence {
  return {
    participantId: input.participantId,
    displayName: input.displayName ?? input.participantId,
    initials: input.participantId.slice(0, 2).toUpperCase(),
    ringState: input.ringState,
    roomId: input.roomId ?? null,
    roomName: input.roomId ?? null,
    projectTag: input.roomId ?? null,
    isSpeaking: input.isSpeaking ?? false,
  };
}

describe('coworking renderer model contract', () => {
  it('exports callable pure model functions', () => {
    expect(typeof deriveFocusedZone).toBe('function');
    expect(typeof listProjectRoomOptions).toBe('function');
    expect(typeof deriveLoungeLayer).toBe('function');
    expect(typeof deriveScreenWall).toBe('function');
  });

  it('returns stable safe defaults for project room options', () => {
    expect(listProjectRoomOptions([selectedRoom])).toEqual([
      {
        roomId: selectedRoom.id,
        projectId: selectedRoom.projectId,
        label: 'Ambient floor',
        activeMemberCount: 0,
        screenShareCount: 0,
        room: selectedRoom,
      },
    ]);
    expect(listProjectRoomOptions([], [], [])).toEqual([]);
  });

  it('returns stable safe defaults for the focused zone', () => {
    expect(deriveFocusedZone()).toEqual({
      kind: 'lounge',
      room: null,
      projectId: null,
      projectName: '',
      joinState: 'not_joined',
      selectionIntent: 'focus_only',
      stageMode: 'meet_like_focus',
      members: [],
      participants: [],
      screenTracks: [],
      pinnedTrackId: null,
      recordingState: 'idle',
      presenceSummary: {
        memberCount: 0,
        speakingCount: 0,
        screenShareCount: 0,
      },
    });
  });

  it('reflects the selected room without auto-joining media', () => {
    expect(deriveFocusedZone({ selectedRoom })).toMatchObject({
      kind: 'project',
      room: selectedRoom,
      projectId: selectedRoom.projectId,
      projectName: selectedRoom.projectName,
      joinState: 'not_joined',
      selectionIntent: 'focus_only',
      stageMode: 'meet_like_focus',
      members: [],
      participants: [],
      screenTracks: [],
      pinnedTrackId: null,
      recordingState: 'idle',
      presenceSummary: {
        memberCount: 0,
        speakingCount: 0,
        screenShareCount: 0,
      },
    });
  });

  it('groups the floor into an explicit focus-only presence map', () => {
    const map = derivePresenceMap([
      presence({ participantId: 'participant_voice', ringState: 'timing', roomId: selectedRoom.id, isSpeaking: true }),
      presence({ participantId: 'participant_lounge', ringState: 'lounge', roomId: 'room_lounge' }),
      presence({ participantId: 'participant_idle', ringState: 'idle' }),
    ]);

    expect(map.focusOnly).toBe(true);
    expect(map.totalPresent).toBe(2);
    expect(map.activeRoomIds).toEqual(['room_lounge', selectedRoom.id]);
    expect(map.zones.map((zone) => zone.key)).toEqual(['timing', 'online', 'lounge', 'idle']);
    expect(map.zones[0]?.participants[0]).toMatchObject({
      participantId: 'participant_voice',
      stageRole: 'speaker',
    });
  });

  it('returns stable safe defaults for the lounge layer', () => {
    expect(deriveLoungeLayer()).toEqual({
      room: null,
      members: [],
      visible: true,
      miniControlVisible: false,
      audioPriority: 'lounge',
    });
  });

  it('returns stable safe defaults for the screen wall', () => {
    expect(deriveScreenWall()).toEqual({
      mode: 'wall',
      pinnedTrackId: null,
      tiles: [],
    });
  });

  it('does not import renderer runtime APIs into the model contract', () => {
    const sourcePath = fileURLToPath(new URL('../../src/renderer/lib/coworkingModel.ts', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|\bnavigator\b|\bWorker\b/);
    expect(source).not.toMatch(/\bipcRenderer\b|\bipcMain\b|from ['"]electron['"]/);
    expect(source).not.toMatch(/\bMediaStream\b|\bgetUserMedia\b|\bRTCPeerConnection\b/);
  });
});
