import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import { buildDailyEvent } from './fixtures/daily-event';

vi.mock('../../src/main/teamforge.js', () => ({
  getDailyAssistantEventStatus: vi.fn(),
  sendDailyAssistantEvent: vi.fn(),
}));

vi.mock('../../src/main/thoughtseed-bridge.js', () => ({
  sendThoughtseedDailyEvent: vi.fn(),
}));

let cleanupDatabase: (() => void) | null = null;

afterEach(() => {
  cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('assistant daily event retry', () => {
  it('flushes due queued and failed events using stable event ids', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { flushAssistantDailyEvents } = await import('../../src/main/assistant-daily');
    const queued = buildDailyEvent({ eventId: 'daily_queued', date: '2026-07-01' });
    const failedDue = buildDailyEvent({ eventId: 'daily_failed_due', date: '2026-07-01' });
    const failedLater = buildDailyEvent({ eventId: 'daily_failed_later', date: '2026-07-01' });
    const calls: string[] = [];

    await database.insertAssistantDailyEvent({ id: queued.eventId, date: queued.date, status: 'queued', payload: queued });
    await database.insertAssistantDailyEvent({
      id: failedDue.eventId,
      date: failedDue.date,
      status: 'failed',
      payload: failedDue,
      nextRetryAt: '2026-07-01T08:59:00.000Z',
    });
    await database.insertAssistantDailyEvent({
      id: failedLater.eventId,
      date: failedLater.date,
      status: 'failed',
      payload: failedLater,
      nextRetryAt: '2026-07-01T10:00:00.000Z',
    });

    const result = await flushAssistantDailyEvents({
      now: '2026-07-01T09:00:00.000Z',
      deps: {
        async sendWorker(event) {
          calls.push(event.eventId);
          return { ok: true, channel: 'worker', status: 'sent', artifactRef: `r2://${event.eventId}` };
        },
        sendBridge: vi.fn(),
        recordHandoff: vi.fn(),
      },
    });

    expect(result).toMatchObject({ ok: true, attempted: 2, sent: 2, failed: 0 });
    expect(calls).toEqual(['daily_failed_due', 'daily_queued']);
    await expect(database.getAssistantDailyEvent('daily_failed_later')).resolves.toMatchObject({ status: 'failed' });
    await expect(database.getAssistantDailyEvent('daily_failed_due')).resolves.toMatchObject({
      status: 'sent',
      artifactRef: 'r2://daily_failed_due',
    });
  });

  it('wires handoff retry to a specific daily event flush', () => {
    const mainSource = readFileSync(path.resolve(process.cwd(), 'src/main/main.ts'), 'utf8');

    expect(mainSource).toContain("retrying.kind === 'assistant_daily_event'");
    expect(mainSource).toContain('flushAssistantDailyEvents({ eventId');
    expect(mainSource).toContain('recordFailureHandoff: false');
  });
});
