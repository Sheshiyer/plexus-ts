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

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
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
    const sendWorker = vi.fn();

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
        async sendBridge(event) {
          calls.push(event.eventId);
          return { ok: true, channel: 'bridge', status: 'sent', artifactRef: `bridge://${event.eventId}` };
        },
        sendWorker,
        recordHandoff: vi.fn(),
      },
    });

    expect(result).toMatchObject({ ok: true, attempted: 2, sent: 2, failed: 0 });
    expect(calls).toEqual(['daily_failed_due', 'daily_queued']);
    expect(sendWorker).not.toHaveBeenCalled();
    await expect(database.getAssistantDailyEvent('daily_failed_later')).resolves.toMatchObject({ status: 'failed' });
    await expect(database.getAssistantDailyEvent('daily_failed_due')).resolves.toMatchObject({
      status: 'sent',
      artifactRef: 'bridge://daily_failed_due',
    });
  });

  it('retries only the bridge after Worker fallback already delivered the event', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { flushAssistantDailyEvents, queueAndSendAssistantDailyEvent } = await import('../../src/main/assistant-daily');
    const event = buildDailyEvent({ eventId: 'daily_worker_fallback' });
    const sendBridge = vi.fn(async () => ({
      ok: false,
      channel: 'bridge' as const,
      status: 'failed' as const,
      message: 'bridge offline',
    }));
    const sendWorker = vi.fn(async () => ({
      ok: true,
      channel: 'worker' as const,
      status: 'sent' as const,
      artifactRef: 'worker://daily/fallback',
    }));

    const queued = await queueAndSendAssistantDailyEvent(event, {
      now: '2026-07-01T09:00:00.000Z',
      deps: { sendBridge, sendWorker, recordHandoff: vi.fn() },
    });
    expect(queued.status).toBe('queued');

    const result = await flushAssistantDailyEvents({
      now: '2026-07-01T09:05:00.000Z',
      deps: { sendBridge, sendWorker, recordHandoff: vi.fn() },
    });

    expect(result).toMatchObject({ attempted: 1, sent: 0, failed: 1 });
    expect(sendBridge).toHaveBeenCalledTimes(2);
    expect(sendWorker).toHaveBeenCalledOnce();
    await expect(database.getAssistantDailyEvent(event.eventId)).resolves.toMatchObject({
      status: 'queued',
      artifactRef: 'worker://daily/fallback',
      nextRetryAt: '2026-07-01T09:10:00.000Z',
    });
  });

  it('wires handoff retry to a specific daily event flush', () => {
    const mainSource = readFileSync(path.resolve(process.cwd(), 'src/main/main.ts'), 'utf8');

    expect(mainSource).toContain("retrying.kind === 'assistant_daily_event'");
    expect(mainSource).toContain('flushAssistantDailyEvents({ eventId');
    expect(mainSource).toContain('recordFailureHandoff: false');
  });
});
