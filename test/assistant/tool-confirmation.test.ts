import { describe, expect, it, vi } from 'vitest';
import { confirmAssistantIntent, executeAssistantTool } from '../../src/main/assistant-tools';
import { createAssistantRuntime } from '../../src/main/assistant-runtime';

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of stream) result.push(item);
  return result;
}

describe('assistant tool confirmation flow', () => {
  it('persists draft intents when offline suggestions propose actions', async () => {
    const intents: any[] = [];
    const runtime = createAssistantRuntime({
      router: null,
      now: () => new Date('2026-07-01T09:00:00.000Z'),
      loadContext: async () => ({
        todayEntries: [{ id: 'entry_1' }],
        hasStandupProofToday: false,
      }),
      persistence: {
        async saveMessage() {
          return { id: 'message_1' };
        },
        async saveIntent(input) {
          intents.push(input);
          return { id: `intent_${intents.length}` };
        },
      },
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_1',
      message: 'help',
      contextScopes: ['today'],
    }));

    expect(intents).toEqual([
      {
        conversationId: 'conversation_1',
        toolId: 'app.generateStandup',
        payload: { date: '2026-07-01' },
        status: 'draft',
      },
    ]);
    expect(events.find((event) => event.type === 'approval_required')).toMatchObject({
      type: 'approval_required',
      intentId: 'intent_1',
      toolId: 'app.generateStandup',
    });
    expect(events.find((event) => event.type === 'suggestion')).toMatchObject({
      type: 'suggestion',
      suggestion: { intent: { intentId: 'intent_1' } },
    });
  });

  it('changes a draft intent to confirmed before executing it', async () => {
    const statuses: string[] = [];
    let status: 'draft' | 'confirmed' | 'running' | 'succeeded' = 'draft';
    const dispatchNavigation = vi.fn();

    const execution = await confirmAssistantIntent(
      'intent_nav',
      { actorId: 'user_1' },
      {
        dispatchNavigation,
        getIntent: async () => ({
          id: 'intent_nav',
          conversationId: 'conversation_1',
          toolId: 'app.navigate',
          status,
          payload: { routeKey: 'reports' },
          result: {},
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
        }),
        updateIntent: async (_id, patch) => {
          if (patch.status) {
            status = patch.status as typeof status;
            statuses.push(patch.status);
          }
          return {} as any;
        },
        recordToolAudit: async (audit) => audit as any,
      },
    );

    expect(statuses).toEqual(['confirmed', 'running', 'succeeded']);
    expect(dispatchNavigation).toHaveBeenCalledWith('reports');
    expect(execution.result).toEqual({ routeKey: 'reports', event: 'assistant:navigate' });
  });

  it('keeps confirm-required tools impossible from draft intents', async () => {
    await expect(
      executeAssistantTool(
        'app.navigate',
        { routeKey: 'reports' },
        { intentId: 'intent_nav' },
        {
          getIntent: async () => ({
            id: 'intent_nav',
            conversationId: 'conversation_1',
            toolId: 'app.navigate',
            status: 'draft',
            payload: { routeKey: 'reports' },
            result: {},
            createdAt: '2026-07-01T09:00:00.000Z',
            updatedAt: '2026-07-01T09:00:00.000Z',
          }),
          updateIntent: async () => ({} as any),
          recordToolAudit: async (audit) => audit as any,
        },
      ),
    ).rejects.toThrow('cannot run until the assistant intent is confirmed');
  });

  it('rejects invalid navigation route keys after confirmation', async () => {
    await expect(
      executeAssistantTool(
        'app.navigate',
        { routeKey: 'does-not-exist' },
        { intentId: 'intent_nav' },
        {
          getIntent: async () => ({
            id: 'intent_nav',
            conversationId: 'conversation_1',
            toolId: 'app.navigate',
            status: 'confirmed',
            payload: { routeKey: 'does-not-exist' },
            result: {},
            createdAt: '2026-07-01T09:00:00.000Z',
            updatedAt: '2026-07-01T09:00:00.000Z',
          }),
          updateIntent: async () => ({} as any),
          recordToolAudit: async (audit) => audit as any,
        },
      ),
    ).rejects.toThrow('routeKey is invalid');
  });
});
