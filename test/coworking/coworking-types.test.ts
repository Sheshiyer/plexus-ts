import { describe, expect, it } from 'vitest';
import '../../src/shared/coworking';
import type {
  CoWorkingFocusedZone,
  CoWorkingRecordingManifest,
} from '../../src/shared/coworking';

describe('coworking shared contract types', () => {
  it('supports a presence-only focused project zone', () => {
    const zone: CoWorkingFocusedZone = {
      kind: 'project',
      room: null,
      projectId: 'project_ambient_floor',
      projectName: 'Ambient floor',
      joinState: 'presence_only',
      members: [
        {
          participantId: 'participant_shesh',
          displayName: 'Shesh',
          initials: 'SI',
          ringState: 'online',
          roomId: 'room_project_ambient_floor',
          roomName: 'Ambient floor',
          projectTag: 'AMBIENT FLOOR - 12m',
          isSpeaking: false,
        },
      ],
      screenTracks: [],
      pinnedTrackId: null,
      recordingState: 'idle',
    };

    expect(zone.joinState).toBe('presence_only');
    expect(zone.members[0]?.projectTag).toContain('AMBIENT FLOOR');
  });

  it('supports a manifest-first recording description', () => {
    const manifest: CoWorkingRecordingManifest = {
      id: 'recording_manifest_1',
      workspaceId: 'workspace_1',
      projectId: 'project_ambient_floor',
      roomId: 'room_project_ambient_floor',
      callSessionId: 'call_session_1',
      startedAt: '2026-07-05T10:00:00.000Z',
      endedAt: null,
      r2Prefix: 'coworking/workspace_1/project_ambient_floor/call_session_1',
      rawTracks: [
        {
          trackId: 'track_screen_1',
          participantId: 'participant_shesh',
          kind: 'screen',
          objectKey: 'coworking/workspace_1/project_ambient_floor/call_session_1/raw/track_screen_1.webm',
          startedAt: '2026-07-05T10:00:03.000Z',
          endedAt: null,
        },
      ],
      composedPlaybackRef: null,
      consent: [
        {
          participantId: 'participant_shesh',
          displayName: 'Shesh',
          consentedAt: '2026-07-05T09:59:58.000Z',
          revokedAt: null,
        },
      ],
    };

    expect(manifest.rawTracks[0]?.kind).toBe('screen');
    expect(manifest.consent[0]?.revokedAt).toBeNull();
  });
});
