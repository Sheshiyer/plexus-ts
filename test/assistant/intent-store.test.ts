import { afterEach, describe, expect, it } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';

let cleanupDatabase: (() => void) | null = null;

afterEach(() => {
  cleanupDatabase?.();
  cleanupDatabase = null;
});

function runSql(database: typeof import('../../src/db/database'), sql: string, params: unknown[] = []): Promise<void> {
  return database.getDb().then((db) => new Promise((resolve, reject) => {
    db.run(sql, params, (error) => (error ? reject(error) : resolve()));
  }));
}

describe('assistant intent store', () => {
  it('persists intent status transitions and falls back on invalid JSON', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    const conversation = await database.createAssistantConversation('Intent thread');
    const draft = await database.insertAssistantIntent({
      id: 'intent_1',
      conversationId: conversation.id,
      toolId: 'app.generateStandup',
      status: 'draft',
      payload: { date: '2026-07-01' },
      createdAt: '2026-07-01T09:01:00.000Z',
      updatedAt: '2026-07-01T09:01:00.000Z',
    });

    expect(draft.status).toBe('draft');
    expect(draft.payload).toEqual({ date: '2026-07-01' });
    expect(draft.result).toEqual({});

    const confirmed = await database.updateAssistantIntent('intent_1', {
      status: 'confirmed',
      updatedAt: '2026-07-01T09:02:00.000Z',
    });
    expect(confirmed.status).toBe('confirmed');

    const succeeded = await database.updateAssistantIntent('intent_1', {
      status: 'succeeded',
      result: { handoffId: 'handoff_1' },
      updatedAt: '2026-07-01T09:03:00.000Z',
    });
    expect(succeeded.status).toBe('succeeded');
    expect(succeeded.result).toEqual({ handoffId: 'handoff_1' });

    const intents = await database.listAssistantIntents(conversation.id, 10);
    expect(intents.map((intent) => intent.status)).toEqual(['succeeded']);
    expect(intents[0].updatedAt).toBe('2026-07-01T09:03:00.000Z');

    await runSql(
      database,
      'UPDATE assistant_intents SET payload = ?, result = ? WHERE id = ?',
      ['{bad payload', '{bad result', 'intent_1'],
    );
    const [reloaded] = await database.listAssistantIntents(conversation.id, 10);
    expect(reloaded.payload).toEqual({});
    expect(reloaded.result).toEqual({});
  });
});
