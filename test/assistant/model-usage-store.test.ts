import { afterEach, describe, expect, it } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('assistant model usage store', () => {
  it('persists sanitized model usage metadata without prompts or secrets', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    await database.insertAssistantModelUsage({
      id: 'usage_1',
      conversationId: 'conversation_1',
      provider: 'google',
      model: 'gemini-test',
      status: 'succeeded',
      startedAt: '2026-07-01T09:00:00.000Z',
      endedAt: '2026-07-01T09:00:01.250Z',
      durationMs: 1250,
      inputTokens: 12,
      outputTokens: 8,
      totalTokens: 20,
      finishReason: 'stop',
      failureKind: null,
      fallback: true,
      primaryProvider: 'google',
      finalProvider: 'nvidia',
      attemptCount: 1,
      metadata: {
        attempts: [{ provider: 'google', status: 'failed', kind: 'timeout' }],
      },
    });

    const [record] = await database.listAssistantModelUsage(10);

    expect(record).toMatchObject({
      id: 'usage_1',
      conversationId: 'conversation_1',
      provider: 'google',
      model: 'gemini-test',
      status: 'succeeded',
      inputTokens: 12,
      outputTokens: 8,
      totalTokens: 20,
      fallback: true,
      attemptCount: 1,
    });
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('system prompt');
    expect(serialized).not.toContain('user asked');
    expect(serialized).not.toContain('api-key');
    expect(serialized).not.toContain('bridge-token');
  });
});
