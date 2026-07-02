import { describe, expect, it, vi } from 'vitest';
import { executeAssistantTool } from '../../src/main/assistant-tools';

const confirmedIntent = {
  id: 'intent_accept',
  conversationId: 'conversation_1',
  toolId: 'app.acceptSession' as const,
  status: 'confirmed' as const,
  payload: { candidateId: 'candidate_1' },
  result: {},
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
        updateIntent: async () => confirmedIntent as any,
        recordToolAudit: async (audit) => audit as any,
      },
    );

    expect(acceptAgentSession).toHaveBeenCalledWith('candidate_1');
    expect(execution.result).toMatchObject({
      entryId: 'entry_1',
      candidateId: 'candidate_1',
      projectId: 'project_1',
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
          updateIntent: async () => confirmedIntent as any,
          recordToolAudit: async (audit) => audit as any,
        },
      ),
    ).rejects.toThrow('needs a verified GitHub repo');
  });
});
