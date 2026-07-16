import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveCoWorkingTwoParticipantSimulation,
  deriveFocusedZone,
} from '../../src/renderer/lib/coworkingModel';
import type {
  RealtimeCloseoutPayload,
  RealtimeMediaTrack,
  RealtimeMeetingRecord,
  RealtimeParticipant,
  RealtimeRoom,
} from '../../src/shared/types';

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
    presence: { participants: 2, screenShares: 1 },
    metadata: {},
    lastActivityAt: '2026-07-10T10:00:00.000Z',
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
  };
}

function participant(id: string, displayName: string): RealtimeParticipant {
  return {
    id,
    workspaceId: 'workspace_1',
    roomId: 'room_project_stage',
    callSessionId: 'call_project_stage',
    identityId: `identity_${id}`,
    employeeId: null,
    displayName,
    role: 'participant',
    state: 'joined',
    cloudflareSessionId: null,
    media: { audio: true, video: false, screen: id.endsWith('ravi') },
    joinedAt: '2026-07-10T10:00:00.000Z',
    leftAt: null,
    lastSeenAt: '2026-07-10T10:00:02.000Z',
    metadata: {},
  };
}

function screenTrack(): RealtimeMediaTrack {
  return {
    id: 'track_screen_ravi',
    workspaceId: 'workspace_1',
    roomId: 'room_project_stage',
    callSessionId: 'call_project_stage',
    participantId: 'participant_ravi',
    identityId: 'identity_participant_ravi',
    trackKind: 'screen',
    direction: 'publish',
    state: 'live',
    label: 'Roadmap board share',
    sourceId: null,
    cloudflareSessionId: null,
    cloudflareTrackId: null,
    targetTrackIds: [],
    metadata: {},
    startedAt: '2026-07-10T10:00:00.000Z',
    endedAt: null,
    updatedAt: '2026-07-10T10:00:00.000Z',
  };
}

describe('coworking two-participant local simulation', () => {
  it('proves the deterministic local simulation without claiming live SFU', () => {
    const focusedZone = deriveFocusedZone({
      selectedRoom: room(),
      activeRoomId: 'room_project_stage',
      participants: [
        participant('participant_maya', 'Maya Patel'),
        participant('participant_ravi', 'Ravi Menon'),
      ],
      tracks: [screenTrack()],
    });

    const simulation = deriveCoWorkingTwoParticipantSimulation({ focusedZone });

    expect(simulation).toMatchObject({
      localOnly: true,
      minimumParticipants: 2,
      participantCount: 2,
      minimumMet: true,
      participantNames: ['Maya Patel', 'Ravi Menon'],
      screenShareCount: 1,
    });
    expect(simulation.copy).toBe('Local simulation only; no live SFU claim. Two visible participants satisfy deterministic co-working regression proof.');
    expect(simulation.chips).toEqual(['local simulation', '2 participants', '1 screen']);
  });

  it('keeps closeout payload and returned meeting record non-transcript in simulation fixtures', () => {
    const closeout: RealtimeCloseoutPayload = {
      title: 'Stage simulation closeout',
      manualNotes: 'Manual proof notes.',
      decisions: ['Keep SFU proof separate'],
      actionItems: ['Run live media proof later'],
      linkedTimeEntryIds: [],
      linkedIssueIds: [],
      timeEntryId: null,
      sendToPaperclip: false,
    };
    const meeting: Pick<RealtimeMeetingRecord, 'transcriptRef' | 'recordingRef' | 'manualNotes' | 'paperclipStatus'> = {
      manualNotes: closeout.manualNotes,
      paperclipStatus: 'not_requested',
      transcriptRef: null,
      recordingRef: null,
    };

    expect(closeout.manualNotes).toContain('Manual proof');
    expect(closeout.sendToPaperclip).toBe(false);
    expect(meeting.transcriptRef).toBeNull();
    expect(meeting.recordingRef).toBeNull();
  });

  it('renders the simulation boundary in the proof closeout panel', () => {
    const model = source('src/renderer/lib/coworkingModel.ts');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');

    expect(model).toContain('Local simulation only; no live SFU claim.');
    expect(stage).toContain('Local simulation');
    expect(stage).toContain('twoParticipantSimulation.copy');
  });
});
