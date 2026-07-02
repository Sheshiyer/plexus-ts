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
});
