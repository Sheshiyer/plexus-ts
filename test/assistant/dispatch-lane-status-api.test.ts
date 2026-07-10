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
    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'task_alice_blocked',
      assigneeMemberId: 'member_alice',
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
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({
      taskId: 'task_alice_delegated',
      skillName: 'dispatching-parallel-agents',
      safety: 'confirm_required',
    });
    expect(JSON.stringify(result)).not.toContain('secret-value');
    expect(result.toolHarnessPlan.invariants).toContain('audit record is required');
  }, 30000);
});
