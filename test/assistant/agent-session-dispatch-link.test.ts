import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import { buildAgentSessionCandidate, buildProject, buildThoughtseedFabricTask } from './fixtures/builders';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('agent session dispatch task links', () => {
  it('attaches an accepted agent session to a Fabric task without exposing raw session paths', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    await database.insertProject(buildProject());
    await database.upsertAgentSessionCandidates([
      buildAgentSessionCandidate({
        id: 'session_dispatch_link',
        sourcePath: '/mock/private/codex/session.jsonl',
        projectId: 'project_verified',
        confidence: 96,
      }),
    ]);
    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'task_dispatch_link',
      projectId: 'project_verified',
      workEntryId: undefined,
      evidence: [],
      history: [],
    }));

    const { acceptAgentSession } = await import('../../src/main/agent-sessions');
    const entry = await acceptAgentSession({
      candidateId: 'session_dispatch_link',
      taskId: 'task_dispatch_link',
    });
    const task = await database.getFabricTask('task_dispatch_link');

    expect(entry.id).toBeTruthy();
    expect(task?.workEntryId).toBe(entry.id);
    expect(task?.evidence).toEqual(expect.arrayContaining([expect.objectContaining({
      type: 'note',
      value: 'agent-session:session_dispatch_link',
      status: 'review_pending',
      strength: 'weak_evidence',
    })]));
    expect(task?.history).toEqual(expect.arrayContaining([expect.objectContaining({
      type: 'candidate_review_pending',
      payload: expect.objectContaining({
        candidateId: 'session_dispatch_link',
        createdEntryId: entry.id,
        status: 'review_pending',
      }),
    })]));
    expect(JSON.stringify(task)).not.toContain('/mock/private');
  }, 30000);
});
