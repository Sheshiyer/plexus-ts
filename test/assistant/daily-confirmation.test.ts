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

describe('assistant daily confirmation reader', () => {
  it('passes the stored artifact ref into the read-only status check', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { readDailyAssistantConfirmation } = await import('../../src/main/assistant-daily');
    const event = buildDailyEvent();

    await database.insertAssistantDailyEvent({
      id: event.eventId,
      date: event.date,
      status: 'sent',
      payload: event,
      artifactRef: 'r2://daily/2026-07-01.json',
    });

    const result = await readDailyAssistantConfirmation(
      { date: event.date, eventId: event.eventId },
      {
        async getConfirmation(input) {
          expect(input).toEqual({ date: event.date, artifactRef: 'r2://daily/2026-07-01.json' });
          return {
            ok: true,
            status: 'sent',
            date: input.date,
            artifactRef: input.artifactRef ?? null,
            checkedAt: '2026-07-01T09:10:00.000Z',
          };
        },
      },
    );

    expect(result).toMatchObject({ ok: true, status: 'sent', artifactRef: 'r2://daily/2026-07-01.json' });
  });

  it('returns unknown for missing or unsupported confirmations without throwing', async () => {
    const { cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { readDailyAssistantConfirmation } = await import('../../src/main/assistant-daily');

    const result = await readDailyAssistantConfirmation(
      { date: '2026-07-01', artifactRef: 'r2://missing.json' },
      {
        async getConfirmation(input) {
          return {
            ok: true,
            status: 'unknown',
            date: input.date,
            artifactRef: input.artifactRef ?? null,
            message: 'Daily assistant event status endpoint is unavailable.',
            checkedAt: '2026-07-01T09:10:00.000Z',
          };
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      status: 'unknown',
      artifactRef: 'r2://missing.json',
    });
  });
});
