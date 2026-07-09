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
      'proof_custody_records',
      'fabric_tasks',
      'fabric_task_history_events',
      'fabric_task_history_conflicts',
    ]) {
      expect(databaseSource).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(databaseSource).toContain('idx_assistant_messages_conversation');
    expect(databaseSource).toContain('idx_assistant_intents_status');
    expect(databaseSource).toContain('idx_assistant_intents_consumed');
    expect(databaseSource).toContain('expires_at TEXT');
    expect(databaseSource).toContain('consumed_at TEXT');
    expect(databaseSource).toContain('failure_kind TEXT');
    expect(databaseSource).toContain('duration_ms INTEGER NOT NULL DEFAULT 0');
    expect(databaseSource).toContain('idx_assistant_daily_events_status');
    expect(databaseSource).toContain('idx_proof_custody_subject');
    expect(databaseSource).toContain('idx_proof_custody_unique');
    expect(databaseSource).toContain('idx_fabric_tasks_assignee_status');
    expect(databaseSource).toContain('idx_fabric_tasks_project');
    expect(databaseSource).toContain('idx_fabric_tasks_work_entry');
    expect(databaseSource).toContain('idx_fabric_task_events_task_time');
    expect(databaseSource).toContain('idx_fabric_task_conflicts_task_time');
  });
});
