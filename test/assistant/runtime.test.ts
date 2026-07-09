import { describe, expect, it } from 'vitest';
import { createAssistantRuntime, type AssistantRuntimePersistence } from '../../src/main/assistant-runtime';
import type { AssistantStreamEvent } from '../../src/shared/native-assistant';

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of stream) result.push(item);
  return result;
}

function persistence(): AssistantRuntimePersistence & {
  messages: { conversationId: string; role: 'user' | 'assistant'; content: string; metadata?: Record<string, unknown> }[];
  modelUsage: Parameters<NonNullable<AssistantRuntimePersistence['saveModelUsage']>>[0][];
} {
  const messages: { conversationId: string; role: 'user' | 'assistant'; content: string; metadata?: Record<string, unknown> }[] = [];
  const modelUsage: Parameters<NonNullable<AssistantRuntimePersistence['saveModelUsage']>>[0][] = [];
  return {
    messages,
    modelUsage,
    async saveMessage(input) {
      messages.push(input);
      return { id: `message_${messages.length}` };
    },
    async saveModelUsage(input) {
      modelUsage.push(input);
    },
  };
}

describe('assistant runtime orchestrator', () => {
  it('persists user and assistant messages around a model stream', async () => {
    const store = persistence();
    const runtime = createAssistantRuntime({
      persistence: store,
      loadContext: async () => ({ routeKey: 'reports', todayEntryCount: 1 }),
      router: {
        isConfigured: () => true,
        async stream() {
          return (async function* stream() {
            yield { type: 'text-delta' as const, delta: 'hello', provider: 'mock' as const, model: 'mock' };
            yield {
              type: 'done' as const,
              provider: 'mock' as const,
              model: 'mock',
              usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
              finishReason: 'stop',
              metadata: { fallback: false, primaryProvider: 'mock', finalProvider: 'mock', attempts: [] },
            };
          })();
        },
      },
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_1',
      message: 'what next',
      contextScopes: ['today'],
      routeKey: 'reports',
    }));

    expect(store.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(store.messages[0]).toMatchObject({ content: 'what next' });
    expect(store.messages[1]).toMatchObject({
      content: 'hello',
      metadata: { mode: 'model', provider: 'mock', usage: { totalTokens: 3 } },
    });
    expect(store.modelUsage).toEqual([expect.objectContaining({
      conversationId: 'conversation_1',
      provider: 'mock',
      model: 'mock',
      status: 'succeeded',
      usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
      finishReason: 'stop',
      fallback: false,
      primaryProvider: 'mock',
      finalProvider: 'mock',
      attempts: [],
    })]);
    expect(JSON.stringify(store.modelUsage)).not.toContain('what next');
    expect(events).toEqual<AssistantStreamEvent[]>([
      { type: 'message_delta', conversationId: 'conversation_1', delta: 'hello' },
      { type: 'done', conversationId: 'conversation_1', messageId: 'message_2' },
    ]);
  });

  it('falls back to offline suggestions when no model is configured', async () => {
    const store = persistence();
    const runtime = createAssistantRuntime({
      persistence: store,
      router: null,
      now: () => new Date('2026-07-01T09:00:00.000Z'),
      loadContext: async () => ({
        todayEntries: [{ id: 'entry_1' }],
        hasStandupProofToday: false,
      }),
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_1',
      message: 'help',
      contextScopes: ['today'],
    }));

    expect(events[0]).toMatchObject({
      type: 'suggestion',
      suggestion: { id: 'offline_standup_2026-07-01' },
    });
    expect(events.at(-1)).toEqual({ type: 'done', conversationId: 'conversation_1', messageId: 'message_2' });
    expect(store.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  });
});
