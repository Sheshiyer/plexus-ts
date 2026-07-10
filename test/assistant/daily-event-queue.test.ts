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

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('assistant daily event queue', () => {
  it('queues before sending, then marks sent with artifact ref', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { queueAndSendAssistantDailyEvent } = await import('../../src/main/assistant-daily');
    const event = buildDailyEvent();

    const sendWorker = vi.fn();
    const record = await queueAndSendAssistantDailyEvent(event, {
      now: '2026-07-01T09:00:00.000Z',
      deps: {
        async sendBridge(sentEvent) {
          const queued = await database.getAssistantDailyEvent(sentEvent.eventId);
          expect(queued?.status).toBe('queued');
          return { ok: true, channel: 'bridge', status: 'sent', artifactRef: 'bridge://daily/2026-07-01.json' };
        },
        sendWorker,
        recordHandoff: vi.fn(),
      },
    });

    expect(record.status).toBe('sent');
    expect(record.artifactRef).toBe('bridge://daily/2026-07-01.json');
    expect(sendWorker).not.toHaveBeenCalled();
    const stored = await database.getAssistantDailyEvent(event.eventId);
    expect(stored?.payload.eventId).toBe(event.eventId);
    const [custody] = await database.listProofCustodyRecords({
      subjectType: 'assistant_daily_event',
      subjectId: event.eventId,
    });
    expect(custody).toMatchObject({
      proofStatus: 'verified',
      evidenceType: 'daily_event',
      artifactRef: 'bridge://daily/2026-07-01.json',
    });
    expect(custody.payload.deliveryStatus).toBe('sent');
    const packet = await database.getDailyProofPacketByDate(event.date);
    expect(packet).toMatchObject({
      date: event.date,
      dailyEventId: event.eventId,
      deliveryStatus: 'sent',
      deliveryChannel: 'bridge',
      artifactRef: 'bridge://daily/2026-07-01.json',
    });
  });

  it('marks failed with retry timestamp and records a handoff', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
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
    const packet = await database.getDailyProofPacketByDate(record.date);
    expect(packet).toMatchObject({
      deliveryStatus: 'failed',
      nextRetryAt: '2026-07-01T09:05:00.000Z',
    });
  });

  it('keeps Worker fallback success queued for bridge retry', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { queueAndSendAssistantDailyEvent } = await import('../../src/main/assistant-daily');
    const recordHandoff = vi.fn();

    const record = await queueAndSendAssistantDailyEvent(buildDailyEvent({
      eventId: 'assistant_daily_20260701_bridge',
    }), {
      now: '2026-07-01T09:00:00.000Z',
      deps: {
        sendBridge: vi.fn(async () => ({ ok: false, channel: 'bridge', status: 'failed', message: 'bridge offline' })),
        sendWorker: vi.fn(async () => ({ ok: true, channel: 'worker', status: 'sent', artifactRef: 'worker://daily/fallback.json' })),
        recordHandoff,
      },
    });

    expect(record).toMatchObject({
      status: 'queued',
      artifactRef: 'worker://daily/fallback.json',
      nextRetryAt: '2026-07-01T09:05:00.000Z',
    });
    expect(record.error).toContain('Bridge delivery failed');
    expect(record.payload.delivery).toMatchObject({
      channel: 'worker',
      retryableFallback: true,
      bridgeError: 'bridge offline',
      artifactRef: 'worker://daily/fallback.json',
    });
    expect(recordHandoff).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'assistant_daily_event',
      status: 'failed',
      nextRetryAt: '2026-07-01T09:05:00.000Z',
    }));
    const packet = await database.getDailyProofPacketByDate(record.date);
    expect(packet).toMatchObject({
      deliveryStatus: 'queued',
      deliveryChannel: 'worker',
      artifactRef: 'worker://daily/fallback.json',
      nextRetryAt: '2026-07-01T09:05:00.000Z',
    });
  });
});
