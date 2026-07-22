import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createAssistantRuntime,
  type AssistantRuntimePersistence,
} from '../../src/main/assistant-runtime';
import {
  createGoogleAssistantProvider,
  type AssistantModelGenerateInput,
  type AssistantModelStreamChunk,
} from '../../src/main/assistant-models';

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of stream) result.push(item);
  return result;
}

function modelStream(...chunks: AssistantModelStreamChunk[]): AsyncIterable<AssistantModelStreamChunk> {
  return (async function* stream() {
    yield* chunks;
  })();
}

function persistence(): AssistantRuntimePersistence & {
  intents: Parameters<NonNullable<AssistantRuntimePersistence['saveIntent']>>[0][];
} {
  const intents: Parameters<NonNullable<AssistantRuntimePersistence['saveIntent']>>[0][] = [];
  let messageId = 0;
  return {
    intents,
    async saveMessage() {
      messageId += 1;
      return { id: `message_${messageId}` };
    },
    async saveIntent(input) {
      intents.push(input);
      return { id: `intent_${intents.length}` };
    },
  };
}

const provider = { provider: 'mock' as const, model: 'mock-tool-model' };

describe('assistant model tool-call loop', () => {
  it('adapts SDK schemas, calls, and tool results across provider rounds', async () => {
    const streamText = vi.fn(async () => ({
      fullStream: (async function* () {
        yield { type: 'tool-call', toolCallId: 'provider_call', toolName: 'context.projects', input: {} };
        yield { type: 'finish', finishReason: 'tool-calls', usage: { totalTokens: 7 } };
      })(),
    }));
    const adapter = createGoogleAssistantProvider({
      apiKey: 'test-key',
      createModel: () => ({}),
      loadAiSdk: async () => ({ generateText: vi.fn(), streamText }),
    });

    const chunks = await collect(await adapter.stream({
      messages: [
        { role: 'assistant', content: '', toolCalls: [{ callId: 'prior', toolId: 'context.infra', payload: {} }] },
        { role: 'tool', content: '{"status":"succeeded"}', toolCallId: 'prior', toolId: 'context.infra' },
      ],
      tools: [{ id: 'context.projects', description: 'Projects', parameters: { type: 'object' } }],
    }));

    expect(chunks).toEqual([
      expect.objectContaining({ type: 'tool-call', callId: 'provider_call', toolId: 'context.projects', payload: {} }),
      expect.objectContaining({ type: 'done', finishReason: 'tool-calls', usage: { totalTokens: 7 } }),
    ]);
    expect(streamText).toHaveBeenCalledWith(expect.objectContaining({
      tools: { 'context.projects': expect.objectContaining({ inputSchema: { type: 'object' } }) },
      messages: [
        expect.objectContaining({ role: 'assistant', content: [expect.objectContaining({ type: 'tool-call', toolCallId: 'prior' })] }),
        expect.objectContaining({ role: 'tool', content: [expect.objectContaining({ type: 'tool-result', toolCallId: 'prior' })] }),
      ],
    }));
  });

  it('wires the production runtime to the registered assistant tool executor', () => {
    const mainSource = readFileSync(new URL('../../src/main/main.ts', import.meta.url), 'utf8');
    expect(mainSource).toContain('async executeReadOnlyTool(toolId, payload, execution)');
    expect(mainSource).toContain('await executeAssistantTool(toolId, payload, {}, { startTimer: startTimerSession })');
  });

  it('executes a validated read-only call and feeds its bounded result into the next model round', async () => {
    const store = persistence();
    const inputs: AssistantModelGenerateInput[] = [];
    const executeReadOnlyTool = vi.fn(async () => ({
      projects: [{ id: 'project_1', name: 'Plexus' }],
      apiKey: 'must-not-reach-model',
    }));
    const runtime = createAssistantRuntime({
      persistence: store,
      loadContext: async () => ({}),
      executeReadOnlyTool,
      router: {
        isConfigured: () => true,
        async stream(input) {
          inputs.push(input);
          return inputs.length === 1
            ? modelStream(
                { type: 'tool-call', callId: 'call_1', toolId: 'context.projects', payload: {}, ...provider },
                { type: 'done', finishReason: 'tool-calls', ...provider },
              )
            : modelStream(
                { type: 'text-delta', delta: 'Plexus is ready.', ...provider },
                { type: 'done', finishReason: 'stop', ...provider },
              );
        },
      },
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_1',
      message: 'Which projects are ready?',
      contextScopes: ['project'],
    }));

    expect(executeReadOnlyTool).toHaveBeenCalledWith('context.projects', {}, expect.objectContaining({
      conversationId: 'conversation_1',
      callId: 'call_1',
    }));
    expect(inputs).toHaveLength(2);
    expect(inputs[1].messages.at(-1)).toMatchObject({
      role: 'tool',
      toolCallId: 'call_1',
      toolId: 'context.projects',
    });
    expect(inputs[1].messages.at(-1)?.content).toContain('project_1');
    expect(inputs[1].messages.at(-1)?.content).not.toContain('must-not-reach-model');
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tool_call', toolId: 'context.projects', callId: 'call_1' }),
      expect.objectContaining({ type: 'tool_result', toolId: 'context.projects', callId: 'call_1' }),
      expect.objectContaining({ type: 'message_delta', delta: 'Plexus is ready.' }),
    ]));
  });

  it('persists confirmation-required calls as draft suggestions without executing them', async () => {
    const store = persistence();
    const executeReadOnlyTool = vi.fn();
    let round = 0;
    const runtime = createAssistantRuntime({
      persistence: store,
      loadContext: async () => ({}),
      executeReadOnlyTool,
      now: () => new Date('2026-07-13T08:00:00.000Z'),
      router: {
        isConfigured: () => true,
        async stream() {
          round += 1;
          return round === 1
            ? modelStream(
                {
                  type: 'tool-call',
                  callId: 'call_write',
                  toolId: 'app.startTimer',
                  payload: { projectId: 'project_1', description: 'Review release' },
                  ...provider,
                },
                { type: 'done', finishReason: 'tool-calls', ...provider },
              )
            : modelStream(
                { type: 'text-delta', delta: 'Please confirm the timer action.', ...provider },
                { type: 'done', finishReason: 'stop', ...provider },
              );
        },
      },
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_2',
      message: 'Start the timer',
      contextScopes: ['today'],
    }));

    expect(executeReadOnlyTool).not.toHaveBeenCalled();
    expect(store.intents).toEqual([expect.objectContaining({
      toolId: 'app.startTimer',
      status: 'draft',
      payload: { projectId: 'project_1', description: 'Review release' },
    })]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'suggestion',
        suggestion: expect.objectContaining({
          safety: 'confirm_required',
          intent: expect.objectContaining({ intentId: 'intent_1', toolId: 'app.startTimer' }),
        }),
      }),
      expect.objectContaining({
        type: 'tool_result',
        callId: 'call_write',
        result: expect.objectContaining({ status: 'confirmation_required', intentId: 'intent_1' }),
      }),
    ]));
  });

  it('rejects unknown and malformed calls without invoking the executor or leaking payload secrets', async () => {
    const store = persistence();
    const executeReadOnlyTool = vi.fn();
    const inputs: AssistantModelGenerateInput[] = [];
    const runtime = createAssistantRuntime({
      persistence: store,
      loadContext: async () => ({}),
      executeReadOnlyTool,
      router: {
        isConfigured: () => true,
        async stream(input) {
          inputs.push(input);
          return inputs.length === 1
            ? modelStream(
                {
                  type: 'tool-call',
                  callId: 'bad_1',
                  toolId: 'shell.exec',
                  payload: { apiKey: 'top-secret', command: 'rm -rf /' },
                  ...provider,
                },
                {
                  type: 'tool-call',
                  callId: 'bad_2',
                  toolId: 'context.reports',
                  payload: { period: 'yearly' },
                  ...provider,
                },
                { type: 'done', finishReason: 'tool-calls', ...provider },
              )
            : modelStream(
                { type: 'text-delta', delta: 'I could not run those tools.', ...provider },
                { type: 'done', finishReason: 'stop', ...provider },
              );
        },
      },
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_3',
      message: 'Try tools',
      contextScopes: ['today'],
    }));

    expect(executeReadOnlyTool).not.toHaveBeenCalled();
    const feedback = inputs[1].messages.filter((message) => message.role === 'tool');
    expect(feedback).toHaveLength(2);
    expect(JSON.stringify(feedback)).not.toContain('top-secret');
    expect(JSON.stringify(feedback)).not.toContain('rm -rf');
    expect(events.filter((event) => event.type === 'tool_call')).toHaveLength(0);
  });

  it('redacts executor errors and stops after four model rounds', async () => {
    const store = persistence();
    let rounds = 0;
    const runtime = createAssistantRuntime({
      persistence: store,
      loadContext: async () => ({}),
      executeReadOnlyTool: async () => {
        throw new Error('Bearer secret-token failed with api_key=another-secret');
      },
      router: {
        isConfigured: () => true,
        async stream() {
          rounds += 1;
          return modelStream(
            { type: 'tool-call', callId: `call_${rounds}`, toolId: 'context.projects', payload: {}, ...provider },
            { type: 'done', finishReason: 'tool-calls', ...provider },
          );
        },
      },
    });

    const events = await collect(runtime.runTurn({
      conversationId: 'conversation_4',
      message: 'Loop forever',
      contextScopes: ['project'],
    }));

    expect(rounds).toBe(4);
    expect(JSON.stringify(events)).not.toContain('secret-token');
    expect(JSON.stringify(events)).not.toContain('another-secret');
    expect(events.findLast((event) => event.type === 'done')).toEqual({ type: 'done', conversationId: 'conversation_4' });
    expect(events.at(-1)).toMatchObject({ type: 'run_end', status: 'completed' });
  });
});
