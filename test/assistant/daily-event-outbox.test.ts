import { afterEach, describe, expect, it } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('assistant daily event outbox', () => {
  it('lists pending and due failed events, then records sent status', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    await database.insertAssistantDailyEvent({
      id: 'daily_pending',
      date: '2026-07-01',
      status: 'pending',
      payload: { kind: 'standup', date: '2026-07-01' },
      createdAt: '2026-07-01T08:40:00.000Z',
      updatedAt: '2026-07-01T08:40:00.000Z',
    });
    await database.insertAssistantDailyEvent({
      id: 'daily_failed_due',
      date: '2026-07-01',
      status: 'failed',
      payload: { kind: 'standup', date: '2026-07-01' },
      error: 'Network unavailable',
      createdAt: '2026-07-01T08:45:00.000Z',
      updatedAt: '2026-07-01T08:50:00.000Z',
      nextRetryAt: '2026-07-01T08:55:00.000Z',
    });
    await database.insertAssistantDailyEvent({
      id: 'daily_failed_later',
      date: '2026-07-01',
      status: 'failed',
      payload: { kind: 'standup', date: '2026-07-01' },
      createdAt: '2026-07-01T08:46:00.000Z',
      updatedAt: '2026-07-01T08:50:00.000Z',
      nextRetryAt: '2026-07-01T10:00:00.000Z',
    });
    await database.insertAssistantDailyEvent({
      id: 'daily_sent',
      date: '2026-07-01',
      status: 'sent',
      payload: { kind: 'standup', date: '2026-07-01' },
      createdAt: '2026-07-01T08:30:00.000Z',
      updatedAt: '2026-07-01T08:35:00.000Z',
    });

    const pending = await database.listPendingAssistantDailyEvents(10, '2026-07-01T09:00:00.000Z');
    expect(pending.map((event) => event.id)).toEqual(['daily_pending', 'daily_failed_due']);
    expect(pending[1].error).toBe('Network unavailable');

    const sent = await database.updateAssistantDailyEvent('daily_failed_due', {
      status: 'sent',
      error: null,
      nextRetryAt: null,
      updatedAt: '2026-07-01T09:05:00.000Z',
    });
    expect(sent.status).toBe('sent');
    expect(sent.error).toBeNull();
    expect(sent.nextRetryAt).toBeNull();

    const fetched = await database.getAssistantDailyEvent('daily_failed_due');
    expect(fetched?.updatedAt).toBe('2026-07-01T09:05:00.000Z');

    const remaining = await database.listPendingAssistantDailyEvents(10, '2026-07-01T09:10:00.000Z');
    expect(remaining.map((event) => event.id)).toEqual(['daily_pending']);
  });
});
