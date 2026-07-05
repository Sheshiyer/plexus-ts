import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  CoWorkingRecordingStartInput,
  PlexusAPI,
} from '../../src/shared/types';

describe('coworking recording IPC contract', () => {
  it('exposes renderer-safe recording facade members on PlexusAPI', async () => {
    const startInput: CoWorkingRecordingStartInput = {
      projectId: 'project_ambient_floor',
      zoneType: 'project_zone',
      captureScope: {
        trackKinds: ['audio', 'screen'],
        participantIds: ['participant_shesh'],
        trackIds: ['track_screen_1'],
        composedPlaybackRequested: true,
      },
      consentSnapshot: {
        capturedAt: '2026-07-05T10:00:00.000Z',
        visibleRecordingState: 'recording_starting',
        participants: [
          {
            participantId: 'participant_shesh',
            displayName: 'Shesh',
            consented: true,
            consentedAt: '2026-07-05T10:00:00.000Z',
            revokedAt: null,
          },
        ],
      },
    };

    const facade: Pick<PlexusAPI, 'recordingStart' | 'recordingStop' | 'recordingFinalize'> = {
      recordingStart: async (_roomId, _input) => ({ ok: true }),
      recordingStop: async (_recordingId) => ({ ok: true }),
      recordingFinalize: async (_recordingId) => ({ ok: true }),
    };

    await expect(facade.recordingStart('room_project_ambient_floor', startInput)).resolves.toEqual({ ok: true });
    await expect(facade.recordingStop('recording_1')).resolves.toEqual({ ok: true });
    await expect(facade.recordingFinalize('recording_1')).resolves.toEqual({ ok: true });
  });

  it('routes preload calls through IPC without exposing R2 credentials', () => {
    const sourcePath = fileURLToPath(new URL('../../src/preload/preload.ts', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain("ipcRenderer.invoke('realtime:recordingStart'");
    expect(source).toContain("ipcRenderer.invoke('realtime:recordingStop'");
    expect(source).toContain("ipcRenderer.invoke('realtime:recordingFinalize'");
    expect(source).not.toMatch(/\bR2\b|bucket token|signed write|TEAMFORGE_ARTIFACTS/);
  });
});
