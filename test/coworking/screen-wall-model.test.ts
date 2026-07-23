import { describe, expect, it } from 'vitest';
import { deriveScreenWall } from '../../src/renderer/lib/coworkingModel';
import type { RealtimeMediaTrack } from '../../src/shared/types';

const baseStartedAt = '2026-07-05T10:00:00.000Z';

function liveScreenTrack(input: {
  id: string;
  participantId: string;
  identityId: string;
  label: string;
  startedAt: string;
  trackKind?: RealtimeMediaTrack['trackKind'];
  direction?: RealtimeMediaTrack['direction'];
  state?: RealtimeMediaTrack['state'];
}): RealtimeMediaTrack {
  return {
    id: input.id,
    workspaceId: 'workspace_ambient_floor',
    roomId: 'room_project_ambient_floor',
    callSessionId: 'call_session_ambient_floor',
    participantId: input.participantId,
    identityId: input.identityId,
    trackKind: input.trackKind ?? 'screen',
    direction: input.direction ?? 'publish',
    state: input.state ?? 'live',
    label: input.label,
    sourceId: null,
    cloudflareSessionId: `cf_session_${input.participantId}`,
    cloudflareTrackId: `cf_track_${input.id}`,
    targetTrackIds: [],
    metadata: {},
    startedAt: input.startedAt,
    endedAt: null,
    updatedAt: input.startedAt,
  };
}

const screenTracks: RealtimeMediaTrack[] = [
  liveScreenTrack({
    id: 'track_screen_shesh',
    participantId: 'participant_shesh',
    identityId: 'identity_shesh',
    label: 'Shesh screen',
    startedAt: baseStartedAt,
  }),
  liveScreenTrack({
    id: 'track_screen_maya',
    participantId: 'participant_maya',
    identityId: 'identity_maya',
    label: 'Maya screen',
    startedAt: '2026-07-05T10:00:05.000Z',
  }),
];

describe('coworking screen wall model', () => {
  it('turns two live screen tracks into two wall tiles', () => {
    const wall = deriveScreenWall(screenTracks, null);

    expect(wall.mode).toBe('wall');
    expect(wall.pinnedTrackId).toBeNull();
    expect(wall.tiles).toHaveLength(2);
    expect(wall.tiles.map((tile) => ({
      trackId: tile.trackId,
      participantId: tile.participantId,
      label: tile.label,
      pinned: tile.pinned,
    }))).toEqual([
      {
        trackId: 'track_screen_shesh',
        participantId: 'participant_shesh',
        label: 'Shesh screen',
        pinned: false,
      },
      {
        trackId: 'track_screen_maya',
        participantId: 'participant_maya',
        label: 'Maya screen',
        pinned: false,
      },
    ]);
    expect(wall.tiles.map((tile) => tile.track)).toEqual(screenTracks);
  });

  it('keeps wall layout when pinnedTrackId does not match a live screen tile', () => {
    const wall = deriveScreenWall(screenTracks, 'track_screen_missing');

    expect(wall.mode).toBe('wall');
    expect(wall.pinnedTrackId).toBeNull();
    expect(wall.tiles).toHaveLength(2);
    expect(wall.tiles.every((tile) => tile.pinned)).toBe(false);
  });

  it('marks exactly one tile pinned when pinnedTrackId matches a live screen track', () => {
    const wall = deriveScreenWall(screenTracks, 'track_screen_maya');

    expect(wall.mode).toBe('pinned');
    expect(wall.pinnedTrackId).toBe('track_screen_maya');
    expect(wall.tiles).toHaveLength(2);
    expect(wall.tiles.filter((tile) => tile.pinned)).toHaveLength(1);
    expect(wall.tiles.find((tile) => tile.trackId === 'track_screen_shesh')).toMatchObject({
      pinned: false,
    });
    expect(wall.tiles.find((tile) => tile.trackId === 'track_screen_maya')).toMatchObject({
      trackId: 'track_screen_maya',
      participantId: 'participant_maya',
      label: 'Maya screen',
      pinned: true,
      track: screenTracks[1],
    });
  });

  it('ignores non-screen, non-published, and closed tracks before pinning', () => {
    const wall = deriveScreenWall([
      liveScreenTrack({
        id: 'track_camera',
        participantId: 'participant_camera',
        identityId: 'identity_camera',
        label: 'Camera',
        startedAt: baseStartedAt,
        trackKind: 'camera',
      }),
      liveScreenTrack({
        id: 'track_subscribed_screen',
        participantId: 'participant_subscribed',
        identityId: 'identity_subscribed',
        label: 'Subscribed screen',
        startedAt: baseStartedAt,
        direction: 'subscribe',
      }),
      liveScreenTrack({
        id: 'track_closed_screen',
        participantId: 'participant_closed',
        identityId: 'identity_closed',
        label: 'Closed screen',
        startedAt: baseStartedAt,
        state: 'closed',
      }),
      screenTracks[0]!,
    ], 'track_closed_screen');

    expect(wall.mode).toBe('wall');
    expect(wall.pinnedTrackId).toBeNull();
    expect(wall.tiles.map((tile) => tile.trackId)).toEqual(['track_screen_shesh']);
  });
});
