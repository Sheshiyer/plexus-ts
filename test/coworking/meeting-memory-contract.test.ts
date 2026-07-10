import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveCoWorkingMeetingMemoryPolicy,
  deriveFocusedZone,
} from '../../src/renderer/lib/coworkingModel';
import type {
  RealtimeMediaTrack,
  RealtimeMeetingRecord,
  RealtimeParticipant,
  RealtimeRoom,
} from '../../src/shared/types';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function projectRoom(): RealtimeRoom {
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
    clientInstanceId: `client_${id}`,
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

describe('coworking non-transcript meeting memory contract', () => {
  it('keeps meeting memory manual with transcript and recording refs null', () => {
    const focusedZone = deriveFocusedZone({
      selectedRoom: projectRoom(),
      participants: [
        participant('participant_maya', 'Maya Patel'),
        participant('participant_ravi', 'Ravi Menon'),
      ],
      tracks: [screenTrack()],
    });
    const policy = deriveCoWorkingMeetingMemoryPolicy({ focusedZone });

    expect(policy).toMatchObject({
      visible: true,
      mode: 'manual_closeout',
      transcriptState: 'deferred',
      transcriptRef: null,
      recordingRef: null,
      paperclipOptional: true,
      participantCount: 2,
      screenShareCount: 1,
      manualFields: ['manualNotes', 'decisions', 'actionItems'],
      title: 'Manual meeting memory',
    });
    expect(policy.body).toContain('manual closeout only');
    expect(policy.chips).toEqual(['manual notes', 'decisions', 'actions', 'transcript ref null', 'recording ref null']);
  });

  it('matches the shared meeting record shape returned by realtime closeout', () => {
    const meeting: RealtimeMeetingRecord = {
      id: 'meeting_1',
      workspaceId: 'workspace_1',
      roomId: 'room_project_stage',
      callSessionId: 'call_project_stage',
      projectId: 'project_stage',
      timeEntryId: null,
      title: 'Stage closeout',
      startedAt: '2026-07-10T10:00:00.000Z',
      endedAt: '2026-07-10T10:30:00.000Z',
      durationSeconds: 1800,
      manualNotes: 'Manual notes only.',
      decisions: ['Keep SFU proof separate'],
      actionItems: ['Run live transport proof later'],
      participantSnapshot: [],
      linkedTimeEntryIds: [],
      linkedIssueIds: [],
      screenShareSummary: [],
      paperclipStatus: 'not_requested',
      paperclipPayload: {},
      paperclipArtifactRef: null,
      transcriptRef: null,
      recordingRef: null,
      createdByIdentityId: 'identity_shesh',
      createdAt: '2026-07-10T10:30:00.000Z',
      updatedAt: '2026-07-10T10:30:00.000Z',
    };

    expect(meeting.transcriptRef).toBeNull();
    expect(meeting.recordingRef).toBeNull();
    expect(meeting.manualNotes).toContain('Manual notes');
  });

  it('renders meeting memory copy near the closeout button and modal', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');

    expect(panel).toContain('deriveCoWorkingMeetingMemoryPolicy');
    expect(panel).toContain('realtimeCloseout');
    expect(stage).toContain('Meeting memory');
    expect(stage).toContain('transcriptRef null');
    expect(stage).toContain('recordingRef null');
  });

  it('keeps Paperclip handoff opt-in for every untouched closeout', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const initialSelection = panel.match(
      /const \[sendToPaperclip, setSendToPaperclip\] = useState\((true|false)\);/,
    );
    const openedSelection = panel.match(
      /const openCloseout = useCallback\([\s\S]*?setSendToPaperclip\((true|false)\);[\s\S]*?\}, \[\]\);/,
    );

    expect(initialSelection?.[1]).toBe('false');
    expect(openedSelection?.[1]).toBe('false');
    expect(panel).toMatch(/realtimeCloseout\([\s\S]*?sendToPaperclip,/);
  });
});
