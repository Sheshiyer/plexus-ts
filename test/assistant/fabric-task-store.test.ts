import { afterEach, describe, expect, it } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import { buildThoughtseedFabricTask } from './fixtures/builders';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('Fabric task store', () => {
  it('stores tasks in queryable member, project, work-entry, and status rows', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    const task = buildThoughtseedFabricTask({
      taskId: 'fabric_task_store_1',
      assigneeMemberId: 'member_alice',
      projectId: 'project_a',
      projectName: 'Project A',
      workEntryId: 'entry_a',
      status: 'in_progress',
      workMode: 'manual',
      workModeLocked: true,
      updatedAt: '2026-07-01T09:00:00.000Z',
      history: [
        {
          eventId: 'event_later',
          timestamp: '2026-07-01T09:00:00.000Z',
          actor: 'member_alice',
          source: 'plexus',
          type: 'status_changed',
          payloadHash: 'hash_later',
          payload: { status: 'in_progress' },
        },
        {
          eventId: 'event_first',
          timestamp: '2026-07-01T08:30:00.000Z',
          actor: 'hermes',
          source: 'hermes',
          type: 'assigned',
          payloadHash: 'hash_first',
          payload: { status: 'assigned' },
        },
      ],
    });

    await database.upsertFabricTask(task);

    const byMember = await database.listFabricTasks({ assigneeMemberId: 'member_alice' });
    const byProject = await database.listFabricTasks({ projectId: 'project_a' });
    const byWorkEntry = await database.listFabricTasks({ workEntryId: 'entry_a' });
    const byStatus = await database.listFabricTasks({ status: 'in_progress' });
    const wrongMember = await database.listFabricTasks({ assigneeMemberId: 'member_bob' });

    expect(byMember).toHaveLength(1);
    expect(byProject).toHaveLength(1);
    expect(byWorkEntry).toHaveLength(1);
    expect(byStatus).toHaveLength(1);
    expect(wrongMember).toHaveLength(0);
    expect(byMember[0]).toMatchObject({
      taskId: 'fabric_task_store_1',
      assigneeMemberId: 'member_alice',
      projectId: 'project_a',
      workEntryId: 'entry_a',
      status: 'in_progress',
      workMode: 'manual',
    });
    expect(byMember[0].history.map((event) => event.eventId)).toEqual(['event_first', 'event_later']);
  }, 15000);

  it('treats duplicate history events as idempotent and records mismatched payload conflicts once', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    const task = buildThoughtseedFabricTask({ taskId: 'fabric_task_store_conflict' });
    await database.upsertFabricTask(task);

    const duplicate = await database.upsertFabricTaskHistoryEvent(task.taskId, task.history[0]);
    const conflictEvent = {
      ...task.history[0],
      payloadHash: 'hash_changed',
      payload: { status: 'assigned', changed: true },
    };
    const secondConflictEvent = {
      ...task.history[0],
      payloadHash: 'hash_changed_again',
      payload: { status: 'assigned', changedAgain: true },
    };
    const conflict = await database.upsertFabricTaskHistoryEvent(task.taskId, conflictEvent);
    const repeatedConflict = await database.upsertFabricTaskHistoryEvent(task.taskId, conflictEvent);
    const secondConflict = await database.upsertFabricTaskHistoryEvent(task.taskId, secondConflictEvent);

    expect(duplicate).toBe('duplicate');
    expect(conflict).toBe('conflict');
    expect(repeatedConflict).toBe('conflict');
    expect(secondConflict).toBe('conflict');

    const history = await database.listFabricTaskHistoryEvents(task.taskId);
    const conflicts = await database.listFabricTaskHistoryConflicts(task.taskId);

    expect(history).toHaveLength(1);
    expect(conflicts).toHaveLength(2);
    expect(conflicts.map((row) => row.incomingPayloadHash).sort()).toEqual(['hash_changed', 'hash_changed_again']);
    expect(conflicts.find((row) => row.incomingPayloadHash === 'hash_changed')).toMatchObject({
      taskId: 'fabric_task_store_conflict',
      eventId: task.history[0].eventId,
      existingPayloadHash: task.history[0].payloadHash,
      incomingPayloadHash: 'hash_changed',
      incomingPayload: { status: 'assigned', changed: true },
    });
  }, 15000);
});
