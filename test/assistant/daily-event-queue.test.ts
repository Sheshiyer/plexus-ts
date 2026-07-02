import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('assistant daily event queue', () => {
  it('queues before sending, then marks sent with artifact ref', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { queueAndSendAssistantDailyEvent } = await import('../../src/main/assistant-daily');
    const event = buildDailyEvent();

    const record = await queueAndSendAssistantDailyEvent(event, {
      now: '2026-07-01T09:00:00.000Z',
      deps: {
        async sendWorker(sentEvent) {
          const queued = await database.getAssistantDailyEvent(sentEvent.eventId);
          expect(queued?.status).toBe('queued');
          return { ok: true, channel: 'worker', status: 'sent', artifactRef: 'r2://daily/2026-07-01.json' };
        },
        sendBridge: vi.fn(),
        recordHandoff: vi.fn(),
      },
    });

    expect(record.status).toBe('sent');
    expect(record.artifactRef).toBe('r2://daily/2026-07-01.json');
    const stored = await database.getAssistantDailyEvent(event.eventId);
    expect(stored?.payload.eventId).toBe(event.eventId);
  });

  it('marks failed with retry timestamp and records a handoff', async () => {
    const { cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { queueAndSendAssistantDailyEvent } = await import('../../src/main/assistant-daily');
    const recordHandoff = vi.fn(async () => ({}));

    const record = await queueAndSendAssistantDailyEvent(buildDailyEvent(), {
      now: '2026-07-01T09:00:00.000Z',
      deps: {
        sendWorker: vi.fn(async () => ({ ok: false, channel: 'worker', status: 'failed', message: 'offline' })),
        sendBridge: vi.fn(async () => ({ ok: false, channel: 'bridge', status: 'failed', message: 'bridge offline' })),
        recordHandoff,
      },
    });

    expect(record.status).toBe('failed');
    expect(record.nextRetryAt).toBe('2026-07-01T09:05:00.000Z');
    expect(recordHandoff).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'assistant_daily_event',
      title: 'Daily assistant event for 2026-07-01 is queued for retry',
    }));
  });

  it('marks sent and stores artifact ref after bridge fallback success', async () => {
    const { cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { queueAndSendAssistantDailyEvent } = await import('../../src/main/assistant-daily');

    const record = await queueAndSendAssistantDailyEvent(buildDailyEvent({
      eventId: 'assistant_daily_20260701_bridge',
    }), {
      now: '2026-07-01T09:00:00.000Z',
      deps: {
        sendWorker: vi.fn(async () => ({ ok: false, channel: 'worker', status: 'failed', message: 'offline' })),
        sendBridge: vi.fn(async () => ({ ok: true, channel: 'bridge', status: 'sent', artifactRef: 'r2://daily/bridge.json' })),
        recordHandoff: vi.fn(),
      },
    });

    expect(record).toMatchObject({
      status: 'sent',
      artifactRef: 'r2://daily/bridge.json',
      error: null,
      nextRetryAt: null,
    });
  });
});
