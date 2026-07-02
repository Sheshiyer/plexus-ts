import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDailyEvent } from './fixtures/daily-event';

const workerState = vi.hoisted(() => ({
  settings: new Map<string, string | null>([
    ['tf.baseUrl', 'https://worker.test'],
    ['tf.tokenEnc', 'encrypted-token'],
    ['tf.accessJwt', null],
  ]),
}));

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: () => 'member-token',
  },
  BrowserWindow: class MockBrowserWindow {},
  session: {},
}));

vi.mock('../../src/db/database.js', () => ({
  getSetting: vi.fn(async (key: string) => workerState.settings.get(key) ?? ''),
  setSetting: vi.fn(async (key: string, value: string) => {
    workerState.settings.set(key, value);
  }),
  listProjects: vi.fn(),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
  updateEntry: vi.fn(),
  listUnsyncedEntries: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('assistant daily Worker client', () => {
  it('posts daily events to the default authenticated member endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: { message: 'stored', artifact_ref: 'vault://daily/2026-07-01' },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const { DAILY_ASSISTANT_EVENT_PATH, sendDailyAssistantEvent } = await import('../../src/main/teamforge');

    const result = await sendDailyAssistantEvent(buildDailyEvent());

    expect(DAILY_ASSISTANT_EVENT_PATH).toBe('/v1/member/daily-agent-events');
    expect(result).toMatchObject({
      ok: true,
      channel: 'worker',
      artifactRef: 'vault://daily/2026-07-01',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://worker.test/v1/member/daily-agent-events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer member-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('returns unknown status without failing when the status endpoint is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'not found' }), { status: 404 })));
    const { getDailyAssistantEventStatus } = await import('../../src/main/teamforge');

    const result = await getDailyAssistantEventStatus({
      date: '2026-07-01',
      artifactRef: 'r2://daily/2026-07-01.json',
    });

    expect(result).toMatchObject({
      ok: true,
      status: 'unknown',
      artifactRef: 'r2://daily/2026-07-01.json',
    });
  });
});
