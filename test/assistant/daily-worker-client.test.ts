import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDailyEvent } from './fixtures/daily-event';

const workerState = vi.hoisted(() => ({
  settings: new Map<string, string | null>([
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

beforeEach(() => {
  workerState.settings = new Map<string, string | null>([
    ['tf.tokenEnc', 'encrypted-token'],
    ['tf.accessJwt', null],
  ]);
  vi.stubEnv('PLEXUS_WORKER_BASE_URL', 'https://worker.test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it.each([
    'https://evil.example',
    'http://plexus-api.thoughtseed.space',
    'https://plexus-api.thoughtseed.space.evil.example',
    'https://plexus-api.thoughtseed.space/redirect',
    'https://user:password@plexus-api.thoughtseed.space',
  ])('rejects renderer-provided non-canonical Worker origin %s', async (baseUrl) => {
    const { setWorkerConfig } = await import('../../src/main/teamforge');

    await expect(setWorkerConfig({ baseUrl })).rejects.toThrow(/Workspace Worker URL/);
    expect(workerState.settings.has('tf.baseUrl')).toBe(false);
  });

  it('ignores a legacy non-canonical stored origin before attaching member credentials', async () => {
    vi.unstubAllEnvs();
    workerState.settings.set('tf.baseUrl', 'https://evil.example');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: { message: 'stored' },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const { sendDailyAssistantEvent } = await import('../../src/main/teamforge');

    await sendDailyAssistantEvent(buildDailyEvent());

    expect(fetchMock).toHaveBeenCalledWith(
      'https://plexus-api.thoughtseed.space/v1/member/daily-agent-events',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer member-token' }),
      }),
    );
    expect(fetchMock.mock.calls.flat().join(' ')).not.toContain('evil.example');
    expect(workerState.settings.get('tf.baseUrl')).toBe('');
    expect(warnSpy).toHaveBeenCalledWith('[worker] Cleared non-canonical stored Workspace Worker URL.');
  });
});
