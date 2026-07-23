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
} {
  const messages: { conversationId: string; role: 'user' | 'assistant'; content: string; metadata?: Record<string, unknown> }[] = [];
  return {
    messages,
    async saveMessage(input) {
      messages.push(input);
      return { id: `message_${messages.length}` };
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
            yield { type: 'done' as const, provider: 'mock' as const, model: 'mock' };
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
    expect(store.messages[1]).toMatchObject({ content: 'hello', metadata: { mode: 'model', hadError: false } });
    expect(Array.isArray(events)).toBe(true);
    expect(events.map((event) => event.type)).toEqual([
      'run_start',
      'model_call_start',
      'message_delta',
      'done',
      'model_call_end',
      'run_end',
    ]);
    const lifecycle = events.filter((event) => 'runId' in event);
    expect(new Set(lifecycle.map((event) => ('runId' in event ? event.runId : null))).size).toBe(1);
    expect(events).toContainEqual({ type: 'done', conversationId: 'conversation_1', messageId: 'message_2' });
    expect(events.at(-1)).toMatchObject({ type: 'run_end', status: 'completed' });
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

    expect(events[0]).toMatchObject({ type: 'run_start', mode: 'offline' });
    expect(events.find((event) => event.type === 'suggestion')).toMatchObject({
      type: 'suggestion',
      suggestion: { id: 'offline_standup_2026-07-01' },
    });
    expect(events.at(-2)).toEqual({ type: 'done', conversationId: 'conversation_1', messageId: 'message_2' });
    expect(events.at(-1)).toMatchObject({ type: 'run_end', status: 'offline' });
    expect(store.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  });

  it('marks a stream error as a failed model run without changing confirmation behavior', async () => {
    const store = persistence();
    const runtime = createAssistantRuntime({
      persistence: store,
      loadContext: async () => ({}),
      router: {
        isConfigured: () => true,
        async stream() {
          return (async function* stream() {
            yield { type: 'text-delta' as const, delta: 'partial', provider: 'mock' as const, model: 'mock' };
            throw new Error('provider stream failed');
          })();
        },
      },
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_failure',
      message: 'fail safely',
      contextScopes: ['today'],
    }));

    expect(events.map((event) => event.type)).toEqual([
      'run_start',
      'model_call_start',
      'message_delta',
      'error',
      'done',
      'model_call_end',
      'run_end',
    ]);
    expect(events.at(-2)).toMatchObject({ type: 'model_call_end', status: 'failed' });
    expect(events.at(-1)).toMatchObject({ type: 'run_end', status: 'failed' });
  });

  it('closes a persistence or context failure with a failed run event', async () => {
    const runtime = createAssistantRuntime({
      persistence: {
        async saveMessage() {
          throw new Error('context persistence failed');
        },
      },
      loadContext: async () => ({}),
      router: null,
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_initial_failure',
      message: 'fail closed',
      contextScopes: ['today'],
    }));

    expect(events.map((event) => event.type)).toEqual(['run_start', 'error', 'run_end']);
    expect(events.at(-1)).toMatchObject({ type: 'run_end', status: 'failed' });
  });

  it('closes an offline persistence failure with a terminal run event', async () => {
    let saveCount = 0;
    const runtime = createAssistantRuntime({
      persistence: {
        async saveMessage() {
          saveCount += 1;
          if (saveCount === 2) throw new Error('offline assistant persistence failed');
          return { id: `message_${saveCount}` };
        },
      },
      router: null,
      loadContext: async () => ({ todayEntries: [{ id: 'entry_1' }] }),
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_offline_failure',
      message: 'fail closed offline',
      contextScopes: ['today'],
    }));

    expect(events.map((event) => event.type)).toEqual(['run_start', 'error', 'suggestion', 'error', 'done', 'run_end']);
    expect(events.at(-1)).toMatchObject({ type: 'run_end', status: 'failed' });
  });

  it('emits an inline error and terminates the run when no model provider is configured', async () => {
    const store = persistence();
    const runtime = createAssistantRuntime({
      persistence: store,
      router: null,
      loadContext: async () => ({}),
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_no_provider',
      message: 'what next',
      contextScopes: ['today'],
    }));

    expect(events[0]).toMatchObject({ type: 'run_start', mode: 'offline' });
    const errorEvent = events.find((event): event is AssistantStreamEvent & { type: 'error' } => event.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.message).toBe('No AI model is configured — add a key in Settings → Clio.');
    expect(errorEvent?.conversationId).toBe('conversation_no_provider');
    expect(events.at(-1)).toMatchObject({ type: 'run_end' });
    expect(store.messages.some((message) => message.role === 'user' && message.content === 'what next')).toBe(true);
  });
});
