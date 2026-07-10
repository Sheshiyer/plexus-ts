import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveCoWorkingMeetingMemoryPolicy,
  deriveCoWorkingTranscriptionBoundary,
  deriveFocusedZone,
  deriveRecordingConsentShell,
} from '../../src/renderer/lib/coworkingModel';
import type { RealtimeRoom } from '../../src/shared/types';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function room(): RealtimeRoom {
  return {
    id: 'room_project_stage',
    workspaceId: 'workspace_1',
    projectId: 'project_stage',
    projectName: 'Stage foundation',
    name: 'Stage foundation room',
    slug: 'stage-foundation',
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: 'call_project_stage',
    activeCall: null,
    presence: { participants: 1, screenShares: 0 },
    metadata: {},
    lastActivityAt: '2026-07-10T10:00:00.000Z',
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
  };
}

describe('coworking transcription deferred boundary', () => {
  it('separates captions, recording consent, manual memory, and transcription state', () => {
    const focusedZone = deriveFocusedZone({
      selectedRoom: room(),
      activeRoomId: 'room_project_stage',
    });
    const consent = deriveRecordingConsentShell({ focusedZone, activeProjectJoin: true });
    const memory = deriveCoWorkingMeetingMemoryPolicy({ focusedZone });
    const transcription = deriveCoWorkingTranscriptionBoundary();

    expect(consent.requiresConsent).toBe(true);
    expect(consent.startEnabled).toBe(false);
    expect(memory.mode).toBe('manual_closeout');
    expect(memory.transcriptRef).toBeNull();
    expect(transcription).toMatchObject({
      visible: true,
      state: 'deferred',
      autoTranscription: false,
      transcriptRef: null,
      recordingRef: null,
      body: 'Transcription stays deferred; closeout never generates a transcript or recording ref.',
    });
    expect(transcription.chips).toEqual(['transcription deferred', 'auto transcript off', 'closeout cannot capture']);
  });

  it('keeps captions copy from implying saved transcription', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');
    const model = source('src/renderer/lib/coworkingModel.ts');

    expect(panel).toContain('Captions preview only; no transcription is saved');
    expect(panel).toContain('NO TRANSCRIPT');
    expect(panel).toContain('deriveCoWorkingTranscriptionBoundary');
    expect(stage).toContain('Transcription');
    expect(model).toContain('closeout never generates a transcript or recording ref');
  });
});
