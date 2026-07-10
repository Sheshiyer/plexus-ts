import { describe, expect, it } from 'vitest';
import {
  deriveCoWorkingLiveScreenWallProof,
  deriveScreenWall,
} from '../../src/renderer/lib/coworkingModel';
import type { RealtimeMediaTrack } from '../../src/shared/types';

const startedAt = '2026-07-10T11:00:00.000Z';

function liveScreenTrack(id: string, participantId: string): RealtimeMediaTrack {
  return {
    id,
    workspaceId: 'workspace_1',
    roomId: 'room_project_wall',
    callSessionId: 'call_project_wall',
    participantId,
    identityId: `identity_${participantId}`,
    trackKind: 'screen',
    direction: 'publish',
    state: 'live',
    label: `${participantId} screen`,
    sourceId: null,
    cloudflareSessionId: `cf_session_${participantId}`,
    cloudflareTrackId: `cf_track_${id}`,
    targetTrackIds: [],
    metadata: {},
    startedAt,
    endedAt: null,
    updatedAt: startedAt,
  };
}

describe('coworking live screen wall proof', () => {
  it('proves pinned and fullscreen behavior from live screen metadata only', () => {
    const wall = deriveScreenWall([
      liveScreenTrack('track_screen_maya', 'participant_maya'),
      liveScreenTrack('track_screen_ravi', 'participant_ravi'),
    ], 'track_screen_ravi');

    const proof = deriveCoWorkingLiveScreenWallProof({ wall, fullscreen: true });

    expect(proof).toMatchObject({
      visible: true,
      liveTrackCount: 2,
      pinnedTrackId: 'track_screen_ravi',
      fullscreen: true,
      allTilesLive: true,
      pinnedTrackVisible: true,
    });
    expect(proof.copy).toContain('without fabricating media pixels');
    expect(proof.chips).toEqual(['2 live screens', 'pinned track visible', 'fullscreen shell', 'live metadata only']);
  });

  it('keeps the empty wall honest when no live screen share exists', () => {
    const proof = deriveCoWorkingLiveScreenWallProof({
      wall: deriveScreenWall([], null),
      fullscreen: false,
    });

    expect(proof).toMatchObject({
      liveTrackCount: 0,
      pinnedTrackId: null,
      fullscreen: false,
      allTilesLive: true,
      pinnedTrackVisible: true,
    });
    expect(proof.copy).toBe('Screen wall waits for live published screen tracks before showing tiles.');
    expect(proof.chips).toContain('inline wall');
  });
});
