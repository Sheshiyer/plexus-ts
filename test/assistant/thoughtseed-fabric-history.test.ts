import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import { buildThoughtseedFabricTask } from './fixtures/builders';

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
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok: true, artifactRef: 'bridge://artifact/fabric-report' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('Thoughtseed Fabric task history bridge', () => {
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

  it('requires concrete evidence before closing delegated work as done', async () => {
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
