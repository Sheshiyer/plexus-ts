import { describe, expect, it } from 'vitest';
import { normalizeAssistantModelStream } from '../../src/main/assistant-runtime';

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of stream) result.push(item);
  return result;
}

describe('assistant stream normalizer', () => {
  it('converts provider chunks into assistant stream events and finishes with done', async () => {
    async function* chunks() {
      yield { type: 'text-delta' as const, delta: 'hello ', provider: 'google' as const, model: 'gemini' };
      yield 'world';
    }

    const events = await collect(normalizeAssistantModelStream({
      conversationId: 'conversation_1',
      stream: chunks(),
    }));

    expect(events).toEqual([
      { type: 'message_delta', conversationId: 'conversation_1', delta: 'hello ' },
      { type: 'message_delta', conversationId: 'conversation_1', delta: 'world' },
      { type: 'done', conversationId: 'conversation_1' },
    ]);
  });

  it('redacts stream errors and still emits done', async () => {
    async function* chunks() {
      throw new Error('api key=AIza-secret-value failed');
    }

    const events = await collect(normalizeAssistantModelStream({
      conversationId: 'conversation_1',
      stream: chunks(),
    }));

    expect(events[0]).toMatchObject({
      type: 'error',
      conversationId: 'conversation_1',
    });
    expect(JSON.stringify(events)).not.toContain('AIza-secret-value');
    expect(events.at(-1)).toEqual({ type: 'done', conversationId: 'conversation_1' });
  });

  it('maps tool calls, results, and errors with bounded redaction', async () => {
    async function* chunks() {
      yield {
        type: 'tool-call' as const,
        toolCallId: 'call_1',
        toolName: 'context.projects',
        input: { projectId: 'project_1', token: 'secret-token' },
        provider: 'mock' as const,
        model: 'mock',
      };
      yield {
        type: 'tool-result' as const,
        toolCallId: 'call_1',
        toolName: 'context.projects',
        output: { projects: [{ id: 'project_1' }], authorization: 'Bearer secret-token' },
        provider: 'mock' as const,
        model: 'mock',
      };
      yield {
        type: 'tool-error' as const,
        toolCallId: 'call_2',
        toolName: 'context.projects',
        error: 'api key=secret-token failed',
        provider: 'mock' as const,
        model: 'mock',
      };
    }

    const events = await collect(normalizeAssistantModelStream({ conversationId: 'conversation_1', stream: chunks() }));

    expect(events).toContainEqual(expect.objectContaining({
      type: 'tool_call',
      toolId: 'context.projects',
      callId: 'call_1',
      payload: { projectId: 'project_1', token: '[REDACTED]' },
    }));
    expect(events).toContainEqual(expect.objectContaining({
      type: 'tool_result',
      toolId: 'context.projects',
      callId: 'call_1',
      result: { projects: [{ id: 'project_1' }], authorization: '[REDACTED]' },
    }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'error' }));
    expect(JSON.stringify(events)).not.toContain('secret-token');
  });
});
