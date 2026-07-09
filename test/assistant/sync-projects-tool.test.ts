import { describe, expect, it, vi } from 'vitest';
import { executeAssistantTool } from '../../src/main/assistant-tools';

const confirmedIntent = {
  id: 'intent_sync',
  conversationId: 'conversation_1',
  toolId: 'app.syncProjects' as const,
  status: 'confirmed' as const,
  payload: {},
  result: {},
  expiresAt: '2099-01-01T00:00:00.000Z',
  consumedAt: null,
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-01T09:00:00.000Z',
};

describe('assistant sync-projects tool', () => {
  it('wraps project sync and returns synced count and message', async () => {
    const syncProjects = vi.fn(async () => ({ ok: true, count: 7, message: 'synced' }));

    const execution = await executeAssistantTool(
      'app.syncProjects',
      {},
      { intentId: 'intent_sync' },
      {
        syncProjects,
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

    expect(syncProjects).toHaveBeenCalledOnce();
    expect(execution.result).toEqual({ ok: true, count: 7, message: 'synced' });
  });

  it('returns existing sync-path failure results without creating new handoffs', async () => {
    const execution = await executeAssistantTool(
      'app.syncProjects',
      {},
      { intentId: 'intent_sync' },
      {
        syncProjects: async () => ({ ok: false, count: 0, message: 'not connected' }),
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

    expect(execution.result).toEqual({ ok: false, count: 0, message: 'not connected' });
  });
});
