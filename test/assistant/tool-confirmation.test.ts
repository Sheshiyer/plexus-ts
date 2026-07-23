import { describe, expect, it, vi } from 'vitest';
import { confirmAssistantIntent, executeAssistantTool } from '../../src/main/assistant-tools';
import { createAssistantRuntime } from '../../src/main/assistant-runtime';
import type { AssistantIntentRecord } from '../../src/db/database';

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of stream) result.push(item);
  return result;
}

describe('assistant tool confirmation flow', () => {
  function intentRecord(overrides: Partial<AssistantIntentRecord> = {}): AssistantIntentRecord {
    return {
      id: 'intent_nav',
      conversationId: 'conversation_1',
      toolId: 'app.navigate',
      status: 'confirmed',
      payload: { routeKey: 'reports' },
      result: {},
      expiresAt: '2099-01-01T00:00:00.000Z',
      consumedAt: null,
      createdAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-07-01T09:00:00.000Z',
      ...overrides,
    };
  }

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
        expiresAt: '2026-07-01T09:15:00.000Z',
      },
    ]);
    expect(events.find((event) => event.type === 'approval_required')).toMatchObject({
      type: 'approval_required',
      intentId: 'intent_1',
      toolId: 'app.generateStandup',
    });
    expect(events.find((event) => event.type === 'suggestion')).toMatchObject({
      type: 'suggestion',
      suggestion: { intent: { intentId: 'intent_1', expiresAt: '2026-07-01T09:15:00.000Z' } },
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
        getIntent: async () => intentRecord({
          status,
        }),
        claimIntent: async (_id, claimedAt) => {
          status = 'running';
          statuses.push('running');
          return intentRecord({
            status,
            consumedAt: claimedAt,
            updatedAt: claimedAt,
          });
        },
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
            expiresAt: '2026-07-01T09:15:00.000Z',
            consumedAt: null,
            createdAt: '2026-07-01T09:00:00.000Z',
            updatedAt: '2026-07-01T09:00:00.000Z',
          }),
          claimIntent: async () => {
            throw new Error('claim should not run');
          },
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
          getIntent: async () => intentRecord({
            status: 'confirmed',
            payload: { routeKey: 'does-not-exist' },
          }),
          claimIntent: async (_id, claimedAt) => intentRecord({
            payload: { routeKey: 'does-not-exist' },
            status: 'running',
            consumedAt: claimedAt,
            updatedAt: claimedAt,
          }),
          updateIntent: async () => ({} as any),
          recordToolAudit: async (audit) => audit as any,
        },
      ),
    ).rejects.toThrow('routeKey is invalid');
  });

  it('fails expired intents before confirmation can dispatch', async () => {
    const updates: any[] = [];
    const dispatchNavigation = vi.fn();

    await expect(
      confirmAssistantIntent(
        'intent_nav',
        { actorId: 'user_1' },
        {
          now: () => new Date('2026-07-01T09:20:00.000Z'),
          dispatchNavigation,
          getIntent: async () => intentRecord({
            status: 'draft',
            expiresAt: '2026-07-01T09:15:00.000Z',
          }),
          updateIntent: async (_id, patch) => {
            updates.push(patch);
            return intentRecord({ status: patch.status ?? 'failed', result: patch.result ?? {} });
          },
          claimIntent: async () => {
            throw new Error('claim should not run');
          },
          recordToolAudit: async (audit) => audit as any,
        },
      ),
    ).rejects.toThrow('Assistant intent expired');

    expect(dispatchNavigation).not.toHaveBeenCalled();
    expect(updates).toEqual([
      {
        status: 'failed',
        result: { error: 'Assistant intent expired.' },
        updatedAt: '2026-07-01T09:20:00.000Z',
      },
    ]);
  });

  it('rejects consumed intents before replaying side effects', async () => {
    const dispatchNavigation = vi.fn();

    await expect(
      executeAssistantTool(
        'app.navigate',
        { routeKey: 'reports' },
        { intentId: 'intent_nav' },
        {
          dispatchNavigation,
          getIntent: async () => intentRecord({
            status: 'confirmed',
            consumedAt: '2026-07-01T09:04:00.000Z',
          }),
          updateIntent: async () => ({} as any),
          claimIntent: async () => {
            throw new Error('claim should not run');
          },
          recordToolAudit: async (audit) => audit as any,
        },
      ),
    ).rejects.toThrow('already consumed');

    expect(dispatchNavigation).not.toHaveBeenCalled();
  });

  it('queues confirmed daily.sendEvent intents through the daily event runner', async () => {
    const statuses: string[] = [];
    const sendDailyEvent = vi.fn(async () => ({
      id: 'assistant_daily_20260701_member_1',
      date: '2026-07-01',
      status: 'queued' as const,
      payload: {},
      error: null,
      artifactRef: 'handoff_daily_1',
      createdAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-07-01T09:00:00.000Z',
      nextRetryAt: null,
    }));

    const execution = await executeAssistantTool(
      'daily.sendEvent',
      { date: '2026-07-01', memberId: 'member_1', standupRecordId: 'standup_2026-07-01' },
      { intentId: 'intent_daily', actorId: 'user_1' },
      {
        getIntent: async () => intentRecord({
          id: 'intent_daily',
          toolId: 'daily.sendEvent',
          payload: { date: '2026-07-01', memberId: 'member_1', standupRecordId: 'standup_2026-07-01' },
        }),
        claimIntent: async (_id, claimedAt) => {
          statuses.push('running');
          return intentRecord({
            id: 'intent_daily',
            toolId: 'daily.sendEvent',
            payload: { date: '2026-07-01', memberId: 'member_1', standupRecordId: 'standup_2026-07-01' },
            status: 'running',
            consumedAt: claimedAt,
          });
        },
        updateIntent: async (_id, patch) => {
          if (patch.status) statuses.push(patch.status);
          return intentRecord({
            id: 'intent_daily',
            toolId: 'daily.sendEvent',
            status: patch.status ?? 'succeeded',
            result: patch.result ?? {},
          });
        },
        recordToolAudit: async (audit) => audit as any,
        sendDailyEvent,
      },
    );

    expect(sendDailyEvent).toHaveBeenCalledWith({
      date: '2026-07-01',
      memberId: 'member_1',
      standupRecordId: 'standup_2026-07-01',
    });
    expect(statuses).toEqual(['running', 'succeeded']);
    expect(execution.result).toMatchObject({
      eventId: 'assistant_daily_20260701_member_1',
      status: 'queued',
      artifactRef: 'handoff_daily_1',
    });
  });
});
