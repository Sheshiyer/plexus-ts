import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import { buildThoughtseedFabricTask } from './fixtures/builders';
import { buildDailyEvent } from './fixtures/daily-event';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^enc:/, ''),
  },
}));

let cleanupDatabase: (() => Promise<void>) | null = null;
const ASSISTANT_DB_TEST_TIMEOUT_MS = 30000;

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

async function connectBridge(database: typeof import('../../src/db/database'), memberId = 'member_alice') {
  await database.setSetting('ts.bridgeApiUrl', 'https://bridge.test');
  await database.setSetting('ts.bridgeMemberId', memberId);
  await database.setSetting('ts.bridgeTenantId', 'cambium');
  await database.setSetting('ts.bridgeTokenEnc', Buffer.from('enc:member-token').toString('base64'));
  await database.setSetting('ts.bridgeTokenExpiresAt', '2026-08-01T00:00:00.000Z');
}

function mockBridgeFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => (
    new Response(JSON.stringify({ ok: true, artifactRef: 'bridge://artifact/fabric-report' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  ));
}

describe('Thoughtseed Fabric task history bridge', () => {
  it('uses the daily event id as the stable bridge envelope id', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    await connectBridge(database, 'member_alice');
    const fetchSpy = mockBridgeFetch();
    const bridge = await import('../../src/main/thoughtseed-bridge');
    const event = buildDailyEvent({ eventId: 'assistant_daily_20260701_member_alice' });

    await bridge.sendThoughtseedDailyEvent(event);

    const request = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const envelope = JSON.parse(String(request.body)) as Record<string, any>;
    expect(envelope.id).toBe(event.eventId);
    expect(envelope.payload.eventId).toBe(event.eventId);
  }, ASSISTANT_DB_TEST_TIMEOUT_MS);

  it('uses stable member-scoped ids for founder review payloads without Telegram routing ids', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    await connectBridge(database, 'member_alice');
    const fetchSpy = mockBridgeFetch();
    const bridge = await import('../../src/main/thoughtseed-bridge');
    const review = {
      id: 'review_monthly_2026-02-01',
      kind: 'monthly' as const,
      periodStart: '2026-02-01',
      periodEnd: '2026-03-01',
      evidenceSummary: {
        proofStatus: 'pending' as const,
        totalEntries: 0,
        evidencedEntries: 0,
        missingEvidenceEntries: 0,
        legacyUnverifiedEntries: 0,
        evidencedSeconds: 0,
        missingEvidenceSeconds: 0,
        projectRepoCoverage: {},
      },
      blockers: [],
      appraisalSignals: [],
      standupCompliance: { trackedDays: 0, compliantDays: 0, missedDays: 0, rate: null },
      generatedAt: '2026-03-01T00:00:00.000Z',
    };

    await bridge.sendThoughtseedMemberReviewCycle(review);
    await bridge.sendThoughtseedMemberReviewCycle(review);
    await database.setSetting('ts.bridgeMemberId', 'member_bob');
    await bridge.sendThoughtseedMemberReviewCycle(review);

    const envelopes = fetchSpy.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)) as Record<string, any>);
    expect(envelopes[0].id).toBe(envelopes[1].id);
    expect(envelopes[0].id).not.toBe(envelopes[2].id);
    expect(envelopes[0].id).toContain('member_alice');
    expect(envelopes[0].payload).toMatchObject({
      type: 'member_review_cycle',
      audience: 'founder_review',
      review: { id: review.id, standupCompliance: review.standupCompliance },
    });
    const serialized = JSON.stringify(envelopes);
    expect(serialized).not.toContain('member-token');
    expect(serialized).not.toMatch(/telegram|chat_?id|topic_?id/i);
  }, ASSISTANT_DB_TEST_TIMEOUT_MS);

  it('backfills legacy settings JSON into queryable rows and lists only the active member tasks', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    await connectBridge(database, 'member_alice');
    const aliceTask = buildThoughtseedFabricTask({
      taskId: 'fabric_task_alice',
      assigneeMemberId: 'member_alice',
      projectId: 'project_a',
      workEntryId: 'entry_a',
    });
    await database.setSetting('ts.fabricTasksJson', JSON.stringify([
      aliceTask,
      buildThoughtseedFabricTask({
        taskId: 'fabric_task_bob',
        assigneeMemberId: 'member_bob',
        projectId: 'project_b',
        workEntryId: 'entry_b',
      }),
      {
        taskId: 'fabric_task_partial',
        title: 'Missing assignee and history',
      },
    ]));

    const bridge = await import('../../src/main/thoughtseed-bridge');
    const result = await bridge.listThoughtseedFabricTasks();
    const secondResult = await bridge.listThoughtseedFabricTasks();

    expect(result.tasks.map((task) => task.taskId)).toEqual(['fabric_task_alice']);
    expect(secondResult.tasks.map((task) => task.taskId)).toEqual(['fabric_task_alice']);
    await expect(database.listFabricTasks({ assigneeMemberId: 'member_alice' })).resolves.toHaveLength(1);
    await expect(database.listFabricTasks({ assigneeMemberId: 'member_bob' })).resolves.toHaveLength(1);
    await expect(database.getFabricTask('fabric_task_partial')).resolves.toBeNull();
    await expect(database.listFabricTaskHistoryEvents('fabric_task_alice')).resolves.toHaveLength(aliceTask.history.length);
    expect(await database.getSetting('ts.bridgeLastError')).toContain('Skipped 1 unreadable legacy Fabric task row');
  }, ASSISTANT_DB_TEST_TIMEOUT_MS);

  it('rejects wrong-member task mutation before any bridge write', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    await connectBridge(database, 'member_alice');
    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'fabric_task_bob',
      assigneeMemberId: 'member_bob',
    }));
    const fetchSpy = mockBridgeFetch();

    const bridge = await import('../../src/main/thoughtseed-bridge');

    await expect(bridge.setThoughtseedFabricTaskWorkMode('fabric_task_bob', 'manual'))
      .rejects.toThrow('task is assigned to member_bob');
    await expect(bridge.reportThoughtseedFabricTask({
      taskId: 'fabric_task_bob',
      status: 'done',
      note: 'Finished elsewhere',
    })).rejects.toThrow('task is assigned to member_bob');
    expect(fetchSpy).not.toHaveBeenCalled();
  }, ASSISTANT_DB_TEST_TIMEOUT_MS);

  it('persists local report events and proof custody records for the owning member', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    await connectBridge(database, 'member_alice');
    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'fabric_task_report',
      assigneeMemberId: 'member_alice',
      status: 'seen',
      workMode: 'manual',
      workModeLocked: true,
      history: [
        {
          eventId: 'directive_report',
          timestamp: '2026-07-01T08:30:00.000Z',
          actor: 'hermes',
          source: 'hermes',
          type: 'assigned',
          payloadHash: 'hash_report_assigned',
          payload: { status: 'assigned' },
        },
      ],
    }));
    mockBridgeFetch();

    const bridge = await import('../../src/main/thoughtseed-bridge');
    const result = await bridge.reportThoughtseedFabricTask({
      taskId: 'fabric_task_report',
      status: 'done',
      note: 'Merged and deployed.',
      evidence: {
        type: 'github_pr',
        value: 'https://github.com/Sheshiyer/plexus-ts/pull/60',
        label: 'Merged PR',
      },
    });

    expect(result.task).toMatchObject({
      taskId: 'fabric_task_report',
      status: 'done',
      evidenceStrength: 'verified_evidence',
    });
    const stored = await database.getFabricTask('fabric_task_report');
    expect(stored?.status).toBe('done');
    expect(stored?.history.map((event) => event.type)).toEqual(['assigned', 'done']);
    const custody = await database.listProofCustodyRecords({
      subjectType: 'fabric_task',
      subjectId: 'fabric_task_report',
    });
    expect(custody).toHaveLength(1);
    expect(custody[0]).toMatchObject({
      proofStatus: 'verified',
      evidenceType: 'github_pr',
      artifactRef: 'https://github.com/Sheshiyer/plexus-ts/pull/60',
    });
  }, ASSISTANT_DB_TEST_TIMEOUT_MS);

  it('requires explicit evidence before closing delegated work as done', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    await connectBridge(database, 'member_alice');
    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'fabric_task_delegated_done',
      assigneeMemberId: 'member_alice',
      status: 'in_progress',
      workMode: 'delegated',
      workModeLocked: true,
    }));
    mockBridgeFetch();

    const bridge = await import('../../src/main/thoughtseed-bridge');
    await expect(bridge.reportThoughtseedFabricTask({
      taskId: 'fabric_task_delegated_done',
      status: 'done',
      note: 'The child agent says it is complete.',
    })).rejects.toThrow('Delegated done requires concrete evidence');

    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'fabric_task_delegated_note_done',
      assigneeMemberId: 'member_alice',
      status: 'in_progress',
      workMode: 'delegated',
      workModeLocked: true,
    }));
    const weakResult = await bridge.reportThoughtseedFabricTask({
      taskId: 'fabric_task_delegated_note_done',
      status: 'done',
      note: 'No URL yet; attaching explicit weak-evidence note.',
      evidence: {
        type: 'note',
        value: 'Manual weak-evidence note after delegated review.',
        label: 'Delegated weak evidence',
      },
    });

    expect(weakResult.task).toMatchObject({
      status: 'done',
      evidenceStrength: 'weak_evidence',
    });

    const result = await bridge.reportThoughtseedFabricTask({
      taskId: 'fabric_task_delegated_done',
      status: 'done',
      note: 'Child agent PR merged.',
      evidence: {
        type: 'github_pr',
        value: 'https://github.com/Sheshiyer/plexus-ts/pull/79',
        label: 'Merged delegated PR',
      },
    });

    expect(result.task).toMatchObject({
      status: 'done',
      evidenceStrength: 'verified_evidence',
    });
    const custody = await database.listProofCustodyRecords({
      subjectType: 'fabric_task',
      subjectId: 'fabric_task_delegated_done',
    });
    expect(custody[0]).toMatchObject({
      proofStatus: 'verified',
      evidenceType: 'github_pr',
      artifactRef: 'https://github.com/Sheshiyer/plexus-ts/pull/79',
    });
  }, ASSISTANT_DB_TEST_TIMEOUT_MS);
});
