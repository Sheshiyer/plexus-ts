import { describe, expect, it, vi } from 'vitest';
import { executeAssistantTool } from '../../src/main/assistant-tools';

const confirmedIntent = {
  id: 'intent_accept',
  conversationId: 'conversation_1',
  toolId: 'app.acceptSession' as const,
  status: 'confirmed' as const,
  payload: { candidateId: 'candidate_1' },
  result: {},
  expiresAt: '2099-01-01T00:00:00.000Z',
  consumedAt: null,
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-01T09:00:00.000Z',
};

describe('assistant accept-session tool', () => {
  it('wraps session acceptance and returns the created time entry id', async () => {
    const acceptAgentSession = vi.fn(async () => ({
      id: 'entry_1',
      projectId: 'project_1',
      description: 'Agent session: Build tool',
      startTime: '2026-07-01T09:00:00.000Z',
      endTime: '2026-07-01T10:00:00.000Z',
      durationSeconds: 3600,
      pausedSeconds: 0,
      tags: ['agent-session', 'codex'],
      source: 'manual' as const,
      evidenceStatus: 'pending' as const,
      evidenceCheckedAt: null,
      githubActivityIds: [],
    }));

    const execution = await executeAssistantTool(
      'app.acceptSession',
      { candidateId: 'candidate_1' },
      { intentId: 'intent_accept' },
      {
        acceptAgentSession,
        getIntent: async () => confirmedIntent,
        claimIntent: async (_id, claimedAt) => ({
          ...confirmedIntent,
          status: 'running',
          consumedAt: claimedAt,
          updatedAt: claimedAt,
        }) as any,
        updateIntent: async () => confirmedIntent as any,
        recordToolAudit: async (audit) => audit as any,
      },
    );

    expect(acceptAgentSession).toHaveBeenCalledWith('candidate_1');
    expect(execution.result).toMatchObject({
      entryId: 'entry_1',
      candidateId: 'candidate_1',
      taskId: null,
      projectId: 'project_1',
    });
  });

  it('passes an optional dispatch task id through accepted session intents', async () => {
    const acceptAgentSession = vi.fn(async () => ({
      id: 'entry_1',
      projectId: 'project_1',
      description: 'Agent session: Build tool',
      startTime: '2026-07-01T09:00:00.000Z',
      endTime: '2026-07-01T10:00:00.000Z',
      durationSeconds: 3600,
      pausedSeconds: 0,
      tags: ['agent-session', 'codex'],
      source: 'manual' as const,
      evidenceStatus: 'pending' as const,
      evidenceCheckedAt: null,
      githubActivityIds: [],
    }));
    const intent = {
      ...confirmedIntent,
      payload: { candidateId: 'candidate_1', taskId: 'task_1' },
    };

    const execution = await executeAssistantTool(
      'app.acceptSession',
      { candidateId: 'candidate_1', taskId: 'task_1' },
      { intentId: 'intent_accept' },
      {
        acceptAgentSession,
        getIntent: async () => intent,
        claimIntent: async (_id, claimedAt) => ({
          ...intent,
          status: 'running',
          consumedAt: claimedAt,
          updatedAt: claimedAt,
        }) as any,
        updateIntent: async () => intent as any,
        recordToolAudit: async (audit) => audit as any,
      },
    );

    expect(acceptAgentSession).toHaveBeenCalledWith({ candidateId: 'candidate_1', taskId: 'task_1' });
    expect(execution.result).toMatchObject({
      entryId: 'entry_1',
      candidateId: 'candidate_1',
      taskId: 'task_1',
    });
  });

  it('preserves existing verified-repo failure messages', async () => {
    await expect(
      executeAssistantTool(
        'app.acceptSession',
        { candidateId: 'candidate_1' },
        { intentId: 'intent_accept' },
        {
          acceptAgentSession: async () => {
            throw new Error('Project needs a verified GitHub repo before Plexus can create this work record.');
          },
          getIntent: async () => confirmedIntent,
          claimIntent: async (_id, claimedAt) => ({
            ...confirmedIntent,
            status: 'running',
            consumedAt: claimedAt,
            updatedAt: claimedAt,
          }) as any,
          updateIntent: async () => confirmedIntent as any,
          recordToolAudit: async (audit) => audit as any,
        },
      ),
    ).rejects.toThrow('needs a verified GitHub repo');
  });
});
