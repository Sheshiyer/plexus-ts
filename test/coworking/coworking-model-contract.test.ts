import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  deriveFocusedZone,
  deriveLoungeLayer,
  deriveScreenWall,
  listProjectRoomOptions,
} from '../../src/renderer/lib/coworkingModel';
import type { FloorPresence, RealtimeMediaTrack, RealtimeRoom } from '../../src/shared/types';

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

describe('coworking renderer model contract', () => {
  it('exports callable pure model functions', () => {
    expect(typeof deriveFocusedZone).toBe('function');
    expect(typeof listProjectRoomOptions).toBe('function');
    expect(typeof deriveLoungeLayer).toBe('function');
    expect(typeof deriveScreenWall).toBe('function');
  });

  it('returns project room options for the dropdown without requiring card render', () => {
    const floorPresence: FloorPresence = {
      participantId: 'participant_1',
      displayName: 'Maya Rao',
      initials: 'MR',
      ringState: 'online',
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      projectTag: 'Ambient floor',
      isSpeaking: false,
    };
    const screenTrack: RealtimeMediaTrack = {
      id: 'track_screen_1',
      workspaceId: selectedRoom.workspaceId,
      roomId: selectedRoom.id,
      callSessionId: 'call_1',
      participantId: floorPresence.participantId,
      identityId: 'identity_1',
      trackKind: 'screen',
      direction: 'publish',
      state: 'live',
      label: 'Maya screen',
      sourceId: null,
      cloudflareSessionId: null,
      cloudflareTrackId: null,
      targetTrackIds: [],
      metadata: {},
      startedAt: '2026-07-05T10:01:00.000Z',
      endedAt: null,
      updatedAt: '2026-07-05T10:01:00.000Z',
    };

    expect(listProjectRoomOptions([selectedRoom], [floorPresence], [screenTrack])).toEqual([{
      roomId: selectedRoom.id,
      projectId: selectedRoom.projectId,
      label: selectedRoom.projectName,
      activeMemberCount: 1,
      screenShareCount: 1,
      room: selectedRoom,
    }]);
    expect(listProjectRoomOptions([], [], [])).toEqual([]);
  });

  it('returns stable safe defaults for the focused zone', () => {
    expect(deriveFocusedZone()).toEqual({
      kind: 'lounge',
      room: null,
      projectId: null,
      projectName: '',
      joinState: 'not_joined',
      members: [],
      screenTracks: [],
      pinnedTrackId: null,
      recordingState: 'idle',
    });
  });

  it('reflects the selected room without auto-joining media', () => {
    expect(deriveFocusedZone({ selectedRoom })).toMatchObject({
      kind: 'project',
      room: selectedRoom,
      projectId: selectedRoom.projectId,
      projectName: selectedRoom.projectName,
      joinState: 'not_joined',
      members: [],
      screenTracks: [],
      pinnedTrackId: null,
      recordingState: 'idle',
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
