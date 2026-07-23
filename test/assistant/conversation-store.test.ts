import { afterEach, describe, expect, it } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('assistant conversation store', () => {
  it('persists conversations and returns recent messages chronologically', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    const first = await database.createAssistantConversation('First assistant thread');
    const second = await database.createAssistantConversation('Second assistant thread');

    await database.insertAssistantMessage({
      id: 'message_2',
      conversationId: first.id,
      role: 'assistant',
      content: 'Here is the focused answer.',
      metadata: { tokens: 42 },
      createdAt: '2026-07-01T09:02:00.000Z',
    });
    await database.insertAssistantMessage({
      id: 'message_1',
      conversationId: first.id,
      role: 'user',
      content: 'Summarize today.',
      metadata: { routeKey: 'reports' },
      createdAt: '2026-07-01T09:01:00.000Z',
    });
    await database.insertAssistantMessage({
      id: 'message_3',
      conversationId: second.id,
      role: 'user',
      content: 'Start a fresher thread.',
      createdAt: '2026-07-01T09:03:00.000Z',
    });

    const firstMessages = await database.listAssistantMessages(first.id, 10);
    expect(firstMessages.map((message) => message.id)).toEqual(['message_1', 'message_2']);
    expect(firstMessages[0].metadata).toEqual({ routeKey: 'reports' });
    expect(firstMessages[1].metadata).toEqual({ tokens: 42 });

    const latestFirstMessage = await database.listAssistantMessages(first.id, 1);
    expect(latestFirstMessage.map((message) => message.id)).toEqual(['message_2']);

    const conversations = await database.listAssistantConversations(10);
    expect(conversations.map((conversation) => conversation.id)).toEqual([second.id, first.id]);
    expect(conversations[0].updatedAt).toBe('2026-07-01T09:03:00.000Z');
  }, 15000);
});
