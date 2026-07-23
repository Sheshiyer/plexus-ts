import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import { buildAgentSessionCandidate, buildThoughtseedFabricTask } from './fixtures/builders';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^enc:/, ''),
  },
}));

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('Temperance dispatch lane status API', () => {
  it('lists renderer-safe dispatch lanes from queryable Fabric task storage', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    await database.setSetting('ts.bridgeMemberId', 'member_alice');
    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'task_alice_delegated',
      assigneeMemberId: 'member_alice',
      status: 'in_progress',
      workMode: 'delegated',
      skillHints: [{ name: 'dispatching-parallel-agents', token: 'secret-value' }],
      updatedAt: '2026-07-01T10:00:00.000Z',
    }));
    await database.recordFabricTaskHistoryConflict({
      taskId: 'task_alice_delegated',
      eventId: 'directive_1',
      existingPayloadHash: 'hash_assigned_1',
      incomingPayloadHash: 'hash_changed_1',
      incomingPayload: {
        status: 'blocked',
        reason: 'duplicate_event_payload_mismatch',
        token: 'secret-conflict-token',
        sourcePath: '/mock/secret/session.jsonl',
      },
      createdAt: '2026-07-01T10:03:00.000Z',
    });
    await database.upsertAgentSessionCandidates([
      buildAgentSessionCandidate({
        id: 'session_task_alice',
        projectId: 'project_verified',
        title: 'Dispatching parallel agents for delegated task',
        confidence: 94,
        createdEntryId: 'entry_agent_session',
        status: 'accepted',
      }),
    ]);
    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'task_alice_blocked',
      assigneeMemberId: 'member_alice',
      projectId: 'project_blocked',
      projectName: 'Blocked Project',
      status: 'blocked',
      workMode: 'manual',
      updatedAt: '2026-07-01T10:05:00.000Z',
    }));
    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'task_bob_done',
      assigneeMemberId: 'member_bob',
      status: 'done',
      workMode: 'delegated',
      updatedAt: '2026-07-01T10:10:00.000Z',
    }));

    const bridge = await import('../../src/main/thoughtseed-bridge');
    const result = await bridge.listThoughtseedDispatchLanes();

    expect(result.ok).toBe(true);
    expect(result.lanes.map((lane) => [lane.key, lane.count])).toEqual([
      ['assigned', 0],
      ['delegated', 1],
      ['blocked', 1],
      ['done', 0],
    ]);
    expect(result.lanes.flatMap((lane) => lane.tasks.map((task) => task.taskId)).sort()).toEqual([
      'task_alice_blocked',
      'task_alice_delegated',
    ]);
    expect(result.recommendations).toEqual(expect.arrayContaining([expect.objectContaining({
      taskId: 'task_alice_delegated',
      skillName: 'dispatching-parallel-agents',
      safety: 'confirm_required',
    })]));
    expect(result.sessionLinks).toHaveLength(1);
    expect(result.sessionLinks[0]).toMatchObject({
      taskId: 'task_alice_delegated',
      candidateId: 'session_task_alice',
      matchReason: 'project',
      artifactRefs: ['entry_agent_session'],
    });
    expect(result.diagnostics).toMatchObject({
      totalTasks: 2,
      activeTasks: 2,
      delegatedTasks: 1,
      blockedTasks: 1,
      linkedSessionCount: 1,
    });
    expect(result.runtime.correlationIds).toContain('corr_1');
    expect(result.runtime.conflicts).toEqual([
      expect.objectContaining({
        taskId: 'task_alice_delegated',
        eventId: 'directive_1',
        incomingPayloadHash: 'hash_changed_1',
        payloadSummary: 'blocked · duplicate_event_payload_mismatch',
        status: 'needs_review',
      }),
    ]);
    expect(result.runtime.supportPacket).toMatchObject({
      localOnly: true,
      conflictEventIds: ['directive_1'],
      boundary: expect.stringContaining('no live Cambium'),
    });
    expect(result.runtime.localSmoke.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret-value');
    expect(JSON.stringify(result)).not.toContain('secret-conflict-token');
    expect(JSON.stringify(result)).not.toContain('sourcePath');
    expect(JSON.stringify(result)).not.toContain('/mock/');
    expect(result.toolHarnessPlan.invariants).toContain('audit record is required');
  }, 30000);
});
