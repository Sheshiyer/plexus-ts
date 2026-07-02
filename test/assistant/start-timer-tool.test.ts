import { describe, expect, it, vi } from 'vitest';
import { executeAssistantTool } from '../../src/main/assistant-tools';

const confirmedIntent = {
  id: 'intent_timer',
  conversationId: 'conversation_1',
  toolId: 'app.startTimer' as const,
  status: 'confirmed' as const,
  payload: { projectId: 'project_1', description: 'Implement tools' },
  result: {},
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-01T09:00:00.000Z',
};

describe('assistant start-timer tool', () => {
  it('requires project id and description before starting a timer', async () => {
    const missingDescriptionIntent = {
      ...confirmedIntent,
      payload: { projectId: 'project_1' },
    };
    await expect(
      executeAssistantTool(
        'app.startTimer',
        { projectId: 'project_1' },
        { intentId: 'intent_timer' },
        {
          getIntent: async () => missingDescriptionIntent,
          updateIntent: async () => confirmedIntent as any,
          recordToolAudit: async (audit) => audit as any,
        },
      ),
    ).rejects.toThrow('requires description');
  });

  it('starts a confirmed timer through the injected app dependency', async () => {
    const startTimer = vi.fn(async () => ({
      id: 'entry_timer',
      projectId: 'project_1',
      description: 'Implement tools',
      startTime: '2026-07-01T09:00:00.000Z',
      durationSeconds: 0,
      pausedSeconds: 0,
      tags: [],
      source: 'timer' as const,
      evidenceStatus: 'pending' as const,
      evidenceCheckedAt: null,
      githubActivityIds: [],
    }));

    const execution = await executeAssistantTool(
      'app.startTimer',
      { projectId: 'project_1', description: 'Implement tools', targetSeconds: 1800 },
      { intentId: 'intent_timer' },
      {
        startTimer,
        getIntent: async () => ({
          ...confirmedIntent,
          payload: { projectId: 'project_1', description: 'Implement tools', targetSeconds: 1800 },
        }),
        updateIntent: async () => confirmedIntent as any,
        recordToolAudit: async (audit) => audit as any,
      },
    );

    expect(startTimer).toHaveBeenCalledWith({
      projectId: 'project_1',
      description: 'Implement tools',
      targetSeconds: 1800,
    });
    expect(execution.result).toMatchObject({ entryId: 'entry_timer', projectId: 'project_1' });
  });

  it('rejects overlapping timers through the shared timer helper path', async () => {
    await expect(
      executeAssistantTool(
        'app.startTimer',
        { projectId: 'project_1', description: 'Implement tools' },
        { intentId: 'intent_timer' },
        {
          startTimer: async () => {
            throw new Error('Stop the current timer before starting another focus session.');
          },
          getIntent: async () => confirmedIntent,
          updateIntent: async () => confirmedIntent as any,
          recordToolAudit: async (audit) => audit as any,
        },
      ),
    ).rejects.toThrow('Stop the current timer');
  });
});
