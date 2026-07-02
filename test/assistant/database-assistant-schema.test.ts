import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const databaseSource = readFileSync(
  path.resolve(process.cwd(), 'src/db/database.ts'),
  'utf-8',
);

describe('assistant database schema', () => {
  it('declares assistant runtime tables and indexes', () => {
    for (const table of [
      'assistant_conversations',
      'assistant_messages',
      'assistant_intents',
      'assistant_daily_events',
    ]) {
      expect(databaseSource).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(databaseSource).toContain('idx_assistant_messages_conversation');
    expect(databaseSource).toContain('idx_assistant_intents_status');
    expect(databaseSource).toContain('idx_assistant_daily_events_status');
  });
});
