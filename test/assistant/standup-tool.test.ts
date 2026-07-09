import { describe, expect, it, vi } from 'vitest';
import { executeAssistantTool } from '../../src/main/assistant-tools';

describe('assistant standup tool', () => {
  it('requires a confirmed intent and persists the generated record id', async () => {
    const updates: string[] = [];
    const audits: any[] = [];
    const generateStandupEvidence = vi.fn(async () => ({
      id: 'standup_2026-07-01',
      date: '2026-07-01',
      totalSeconds: 3600,
      evidenceSummary: {} as any,
      activity: [],
      generatedAt: '2026-07-01T10:00:00.000Z',
    }));

    const execution = await executeAssistantTool(
      'app.generateStandup',
      { date: '2026-07-01', accessJwt: 'secret' },
      { intentId: 'intent_1', actorId: 'user_1' },
      {
        generateStandupEvidence,
        getIntent: async () => ({
          id: 'intent_1',
          conversationId: 'conversation_1',
          toolId: 'app.generateStandup',
          status: 'confirmed',
          payload: { date: '2026-07-01', accessJwt: 'secret' },
          result: {},
          expiresAt: '2026-07-01T10:15:00.000Z',
          consumedAt: null,
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
        }),
        claimIntent: async (_id, claimedAt) => {
          updates.push('running');
          return {
            id: 'intent_1',
            conversationId: 'conversation_1',
            toolId: 'app.generateStandup',
            status: 'running',
            payload: { date: '2026-07-01', accessJwt: 'secret' },
            result: {},
            expiresAt: '2026-07-01T10:15:00.000Z',
            consumedAt: claimedAt,
            createdAt: '2026-07-01T09:00:00.000Z',
            updatedAt: claimedAt,
          } as any;
        },
        updateIntent: async (_id, patch) => {
          if (patch.status) updates.push(patch.status);
          return {} as any;
        },
        recordToolAudit: async (audit) => {
          audits.push(audit);
          return audit as any;
        },
        now: () => new Date('2026-07-01T10:01:00.000Z'),
      },
    );

    expect(generateStandupEvidence).toHaveBeenCalledWith('2026-07-01');
    expect(execution.result).toMatchObject({ recordId: 'standup_2026-07-01', totalSeconds: 3600 });
    expect(updates).toEqual(['running', 'succeeded']);
    expect(audits[0].input.accessJwt).toBe('[REDACTED]');
    expect(audits[0].output).toMatchObject({ recordId: 'standup_2026-07-01' });
  });

  it('rejects direct execution without an approved intent id', async () => {
    await expect(
      executeAssistantTool('app.generateStandup', { date: '2026-07-01' }),
    ).rejects.toThrow('requires a confirmed assistant intent id');
  });
});
