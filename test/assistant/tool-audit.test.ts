import { afterEach, describe, expect, it } from 'vitest';
import { executeAssistantTool } from '../../src/main/assistant-tools';
import { loadIsolatedAssistantDatabase } from './fixtures/database';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('assistant tool audit records', () => {
  it('persists redacted input and output for confirm-required tool execution', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    const conversation = await database.createAssistantConversation('Audit thread');
    await database.insertAssistantIntent({
      id: 'intent_audit',
      conversationId: conversation.id,
      toolId: 'app.generateStandup',
      status: 'confirmed',
      payload: { date: '2026-07-01', authorization: 'Bearer secret' },
    });

    await executeAssistantTool(
      'app.generateStandup',
      { date: '2026-07-01', authorization: 'Bearer secret' },
      { intentId: 'intent_audit', actorId: 'user_1' },
      {
        generateStandupEvidence: async () => ({
          id: 'standup_2026-07-01',
          date: '2026-07-01',
          totalSeconds: 60,
          evidenceSummary: {} as any,
          activity: [],
          generatedAt: '2026-07-01T10:00:00.000Z',
        }),
      },
    );

    const [audit] = await database.listAssistantToolAudits(10);
    expect(audit).toMatchObject({
      intentId: 'intent_audit',
      toolId: 'app.generateStandup',
      status: 'succeeded',
      actorId: 'user_1',
    });
    expect(audit.input.authorization).toBe('[REDACTED]');
    expect(audit.output).toMatchObject({ recordId: 'standup_2026-07-01' });
  });

  it('stores sanitized failure messages and marks the intent failed', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    const conversation = await database.createAssistantConversation('Audit failure');
    await database.insertAssistantIntent({
      id: 'intent_fail',
      conversationId: conversation.id,
      toolId: 'app.generateStandup',
      status: 'confirmed',
      payload: { date: '2026-07-01' },
    });

    await expect(
      executeAssistantTool(
        'app.generateStandup',
        { date: '2026-07-01' },
        { intentId: 'intent_fail' },
        {
          generateStandupEvidence: async () => {
            throw new Error('Worker unavailable');
          },
        },
      ),
    ).rejects.toThrow('Worker unavailable');

    const [audit] = await database.listAssistantToolAudits(10);
    expect(audit.status).toBe('failed');
    expect(audit.error).toBe('Worker unavailable');
    expect(audit.error).not.toContain('at ');
    const intent = await database.getAssistantIntent('intent_fail');
    expect(intent?.status).toBe('failed');
    expect(intent?.result).toEqual({ error: 'Worker unavailable' });
  });
});
