import { describe, expect, it } from 'vitest';
import {
  buildDailyProofPacket,
  buildDailyReport,
  buildFabricTaskProofSummary,
  utcReportDayRange,
  upgradeFabricTasksWithGitHubEvidence,
} from '../../src/main/proof-report';
import { buildGitHubActivity, buildThoughtseedFabricTask, buildTimeEntry } from './fixtures/builders';

describe('proof report helpers', () => {
  it('uses exclusive UTC report day boundaries across the year edge', () => {
    expect(utcReportDayRange('2026-12-31')).toEqual({
      from: '2026-12-31T00:00:00.000Z',
      to: '2027-01-01T00:00:00.000Z',
    });
  });

  it('uses only an actually persisted standup id in daily reports', () => {
    const entry = buildTimeEntry({ durationSeconds: 600 });
    const project = {
      id: entry.projectId,
      name: 'Plexus',
      color: '#3b82f6',
      archived: false,
      createdAt: '2026-07-01T00:00:00.000Z',
    };

    const missing = buildDailyReport({
      date: '2026-07-01',
      entries: [entry],
      projects: [project],
      fabricTasks: [],
      standupEvidenceRecordId: null,
    });
    const persisted = buildDailyReport({
      date: '2026-07-01',
      entries: [entry],
      projects: [project],
      fabricTasks: [],
      standupEvidenceRecordId: 'standup_actual_row',
    });

    expect(missing.proofPacket.standupEvidenceRecordId).toBeNull();
    expect(persisted.proofPacket.standupEvidenceRecordId).toBe('standup_actual_row');
  });

  it('summarizes Fabric task proof strength, missing proof, and blockers', () => {
    const summary = buildFabricTaskProofSummary([
      buildThoughtseedFabricTask({
        taskId: 'task_verified',
        status: 'done',
        proofStatus: 'verified',
        evidenceStrength: 'verified_evidence',
        evidence: [{
          id: 'github_activity_1',
          type: 'github_commit',
          value: 'https://github.com/thoughtseed/verified-project/commit/activity_1',
          source: 'github',
          strength: 'verified_evidence',
          status: 'verified_evidence',
          addedAt: '2026-07-01T09:00:00.000Z',
        }],
      }),
      buildThoughtseedFabricTask({
        taskId: 'task_missing',
        status: 'assigned',
        proofStatus: 'pending',
        evidenceStrength: 'weak_evidence',
        evidence: [],
      }),
      buildThoughtseedFabricTask({
        taskId: 'task_blocked',
        status: 'blocked',
        proofStatus: 'missing',
        evidenceStrength: 'weak_evidence',
        evidence: [],
        history: [{
          eventId: 'blocked_1',
          timestamp: '2026-07-01T09:00:00.000Z',
          actor: 'member_1',
          source: 'plexus',
          type: 'blocked',
          payloadHash: 'hash_blocked_1',
          payload: { blocker: 'Waiting on review.' },
        }],
      }),
    ]);

    expect(summary).toMatchObject({
      proofStatus: 'partial',
      totalTasks: 3,
      doneTasks: 1,
      blockedTasks: 1,
      verifiedTasks: 1,
      missingProofTasks: 2,
    });
    expect(summary.proofStrength).toEqual({ weak_evidence: 2, verified_evidence: 1 });
    expect(summary.blockers).toEqual([expect.objectContaining({
      taskId: 'task_blocked',
      blocker: 'Waiting on review.',
    })]);
  });

  it('upgrades Fabric tasks linked by workEntryId from matched GitHub activity', () => {
    const checkedAt = '2026-07-01T09:05:00.000Z';
    const entry = buildTimeEntry({ githubActivityIds: ['activity_1'] });
    const task = buildThoughtseedFabricTask({
      taskId: 'task_entry_linked',
      workEntryId: entry.id,
      evidence: [],
      evidenceStrength: 'weak_evidence',
      proofStatus: 'pending',
    });

    const [upgraded] = upgradeFabricTasksWithGitHubEvidence({
      tasks: [task],
      entries: [entry],
      activity: [buildGitHubActivity()],
      checkedAt,
    });

    expect(upgraded).toMatchObject({
      taskId: 'task_entry_linked',
      proofStatus: 'verified',
      evidenceStrength: 'verified_evidence',
      updatedAt: checkedAt,
    });
    expect(upgraded.evidence).toEqual([expect.objectContaining({
      id: 'github_activity_1',
      type: 'github_commit',
      source: 'github',
      strength: 'verified_evidence',
      addedAt: checkedAt,
    })]);
    expect(upgraded.history).toContainEqual(expect.objectContaining({
      source: 'github',
      type: 'evidence_added',
      payload: expect.objectContaining({
        workEntryId: entry.id,
        activityId: 'activity_1',
      }),
    }));
  });

  it('builds date-addressable daily proof packets', () => {
    const evidenceSummary = {
      proofStatus: 'partial' as const,
      totalEntries: 2,
      evidencedEntries: 1,
      missingEvidenceEntries: 1,
      legacyUnverifiedEntries: 0,
      evidencedSeconds: 1800,
      missingEvidenceSeconds: 600,
      projectRepoCoverage: { project_verified: 'verified' as const },
    };
    const fabricTaskProof = buildFabricTaskProofSummary([
      buildThoughtseedFabricTask({ taskId: 'task_missing', evidence: [], proofStatus: 'pending' }),
    ]);

    const packet = buildDailyProofPacket({
      date: '2026-07-01',
      totalSeconds: 2400,
      entryCount: 2,
      evidenceSummary,
      fabricTaskProof,
      standupEvidenceRecordId: 'standup_2026-07-01',
    });

    expect(packet).toMatchObject({
      id: 'daily_proof_2026-07-01',
      date: '2026-07-01',
      reportSubjectId: '2026-07-01',
      standupEvidenceRecordId: 'standup_2026-07-01',
      taskCount: 1,
      missingProofCount: 2,
      proofStatus: 'partial',
    });
  });
});
