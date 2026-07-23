import { describe, expect, it } from 'vitest';
import { computeEvidenceSummary } from '../../src/main/evidence';
import { buildDailyProofPacket, buildFabricTaskProofSummary } from '../../src/main/proof-report';
import {
  deriveCoWorkingRoomCloseoutProofFixture,
  deriveFocusedZone,
} from '../../src/renderer/lib/coworkingModel';
import type {
  RealtimeCloseoutPayload,
  RealtimeJoinResponse,
  RealtimeMeetingRecord,
  RealtimeRoom,
} from '../../src/shared/types';
import { buildProject, buildTimeEntry } from '../assistant/fixtures/builders';

const startedAt = '2026-07-10T12:00:00.000Z';

function room(): RealtimeRoom {
  return {
    id: 'room_project_closeout',
    workspaceId: 'workspace_1',
    projectId: 'project_verified',
    projectName: 'Verified Project',
    name: 'Verified Project room',
    slug: 'verified-project',
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: 'call_project_closeout',
    activeCall: null,
    presence: { participants: 2, screenShares: 1 },
    metadata: {},
    lastActivityAt: startedAt,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

function activeJoin(selectedRoom = room()): RealtimeJoinResponse {
  return {
    room: selectedRoom,
    call: {
      id: 'call_project_closeout',
      workspaceId: selectedRoom.workspaceId,
      roomId: selectedRoom.id,
      projectId: selectedRoom.projectId,
      state: 'live',
      createdByIdentityId: 'identity_shesh',
      meetingRecordId: null,
      provider: 'cloudflare',
      metadata: {},
      startedAt,
      endedAt: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    },
    participant: {
      id: 'participant_shesh',
      workspaceId: selectedRoom.workspaceId,
      roomId: selectedRoom.id,
      callSessionId: 'call_project_closeout',
      identityId: 'identity_shesh',
      employeeId: null,
      displayName: 'Shesh Iyer',
      role: 'host',
      state: 'joined',
      cloudflareSessionId: null,
      media: { audio: false, video: false, screen: false },
      joinedAt: startedAt,
      leftAt: null,
      lastSeenAt: startedAt,
      metadata: {},
    },
    cloudflare: {
      configured: false,
      appId: null,
      sessionId: null,
      sessionDescription: null,
      stunUrls: [],
      negotiation: 'not_configured',
    },
  };
}

describe('coworking room closeout proof fixture', () => {
  it('ties manual closeout to report/evidence draft status without transcript, recording, or Paperclip side effects', () => {
    const selectedRoom = room();
    const focusedZone = deriveFocusedZone({
      selectedRoom,
      activeRoomId: selectedRoom.id,
    });
    const fixture = deriveCoWorkingRoomCloseoutProofFixture({
      focusedZone,
      activeJoin: activeJoin(selectedRoom),
    });
    const closeoutPayload: RealtimeCloseoutPayload = {
      title: 'Verified Project closeout',
      manualNotes: 'Manual room notes with implementation evidence.',
      decisions: ['Keep live SFU proof separate from closeout proof'],
      actionItems: ['Run configured Cloudflare receipt proof later'],
      linkedTimeEntryIds: ['entry_1'],
      linkedIssueIds: ['46'],
      timeEntryId: 'entry_1',
      sendToPaperclip: false,
    };
    const meeting: RealtimeMeetingRecord = {
      id: 'meeting_closeout_1',
      workspaceId: selectedRoom.workspaceId,
      roomId: selectedRoom.id,
      callSessionId: 'call_project_closeout',
      projectId: selectedRoom.projectId,
      timeEntryId: closeoutPayload.timeEntryId,
      title: closeoutPayload.title,
      startedAt,
      endedAt: '2026-07-10T12:30:00.000Z',
      durationSeconds: 1800,
      manualNotes: closeoutPayload.manualNotes,
      decisions: closeoutPayload.decisions,
      actionItems: closeoutPayload.actionItems,
      participantSnapshot: [],
      linkedTimeEntryIds: closeoutPayload.linkedTimeEntryIds,
      linkedIssueIds: closeoutPayload.linkedIssueIds,
      screenShareSummary: [],
      paperclipStatus: 'not_requested',
      paperclipPayload: {},
      paperclipArtifactRef: null,
      transcriptRef: null,
      recordingRef: null,
      createdByIdentityId: 'identity_shesh',
      createdAt: startedAt,
      updatedAt: startedAt,
    };
    const entry = buildTimeEntry({
      id: 'entry_1',
      projectId: 'project_verified',
      description: meeting.title,
      evidenceStatus: 'matched',
      durationSeconds: meeting.durationSeconds,
      githubActivityIds: ['activity_1'],
    });
    const evidenceSummary = computeEvidenceSummary([entry], [buildProject()]);
    const proofPacket = buildDailyProofPacket({
      date: '2026-07-10',
      generatedAt: startedAt,
      totalSeconds: entry.durationSeconds,
      entryCount: 1,
      evidenceSummary,
      fabricTaskProof: buildFabricTaskProofSummary([]),
    });

    expect(fixture).toMatchObject({
      visible: true,
      roomId: selectedRoom.id,
      callSessionId: 'call_project_closeout',
      projectId: 'project_verified',
      manualNotesRequired: true,
      reportEvidenceStatus: 'draft_ready',
      transcriptRef: null,
      recordingRef: null,
      paperclipStatus: 'explicit_optional',
    });
    expect(fixture.proofChain).toContain('report/evidence draft status');
    expect(closeoutPayload.sendToPaperclip).toBe(false);
    expect(meeting.paperclipStatus).toBe('not_requested');
    expect(meeting.transcriptRef).toBeNull();
    expect(meeting.recordingRef).toBeNull();
    expect(evidenceSummary).toMatchObject({
      proofStatus: 'verified',
      evidencedEntries: 1,
      missingEvidenceEntries: 0,
    });
    expect(proofPacket.proofStatus).toBe('verified');
    expect(proofPacket.missingProofCount).toBe(0);
  });

  it('blocks the proof fixture until a focused room has an active closeout context', () => {
    const selectedRoom = room();
    const fixture = deriveCoWorkingRoomCloseoutProofFixture({
      focusedZone: deriveFocusedZone({ selectedRoom }),
      activeJoin: null,
    });

    expect(fixture.reportEvidenceStatus).toBe('blocked_until_closeout');
    expect(fixture.callSessionId).toBeNull();
    expect(fixture.copy).toContain('Drop in and save manual closeout fields');
  });
});
