import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntry } from '../../src/shared/types';

const apiState = vi.hoisted(() => ({
  settings: new Map<string, string | null>(),
  listEntries: vi.fn(async (): Promise<TimeEntry[]> => []),
  listProjects: vi.fn(async () => []),
  listGitHubActivity: vi.fn(async () => []),
  getRunningEntry: vi.fn(async () => null),
  upsertReviewCycle: vi.fn(async () => undefined),
  upsertStandupEvidenceRecord: vi.fn(async () => undefined),
}));

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (value: Buffer) => {
      const decoded = value.toString('utf8');
      if (!decoded.startsWith('enc:')) throw new Error('bad ciphertext');
      return decoded.slice(4);
    },
  },
}));

vi.mock('../../src/db/database.js', () => ({
  getSetting: vi.fn(async (key: string) => apiState.settings.get(key) ?? ''),
  setSetting: vi.fn(async (key: string, value: string) => {
    apiState.settings.set(key, value);
  }),
  listEntries: apiState.listEntries,
  listProjects: apiState.listProjects,
  listGitHubActivity: apiState.listGitHubActivity,
  getRunningEntry: apiState.getRunningEntry,
  upsertReviewCycle: apiState.upsertReviewCycle,
  upsertStandupEvidenceRecord: apiState.upsertStandupEvidenceRecord,
}));

let apiServer: typeof import('../../src/main/api-server') | null = null;

beforeEach(() => {
  apiState.settings = new Map([['apiToken', 'test-token']]);
  apiState.listEntries.mockClear();
  apiState.listProjects.mockClear();
  apiState.listGitHubActivity.mockClear();
  apiState.getRunningEntry.mockClear();
  apiState.upsertReviewCycle.mockClear();
  apiState.upsertStandupEvidenceRecord.mockClear();
  vi.resetModules();
});

afterEach(async () => {
  await apiServer?.stopApiServer();
  apiServer = null;
  vi.resetModules();
});

async function startServer(): Promise<void> {
  apiServer = await import('../../src/main/api-server');
  await apiServer.startApiServer();
}

async function apiGet(path: string): Promise<Response> {
  return fetch(`http://127.0.0.1:31339${path}`, {
    headers: { Authorization: 'Bearer test-token', Connection: 'close' },
  });
}

async function expectBadRequest(path: string): Promise<Record<string, unknown>> {
  const response = await apiGet(path);
  expect(response.status).toBe(400);
  return await response.json() as Record<string, unknown>;
}

describe('local API validation', () => {
  it('rejects missing, invalid, inverted, and oversized entry ranges before DB scans', async () => {
    await startServer();

    await expectBadRequest('/api/entries');
    await expectBadRequest('/api/entries?from=not-a-date&to=2026-07-01T00:00:00.000Z');
    await expectBadRequest('/api/entries?from=2026-08-01T00:00:00.000Z&to=2026-07-01T00:00:00.000Z');
    await expectBadRequest('/api/entries?from=2026-01-01T00:00:00.000Z&to=2026-03-01T00:00:00.000Z');

    expect(apiState.listEntries).not.toHaveBeenCalled();
  });

  it('passes valid explicit ranges through to the database', async () => {
    await startServer();

    const response = await apiGet('/api/entries?from=2026-07-01T00:00:00.000Z&to=2026-07-02T00:00:00.000Z');

    expect(response.status).toBe(200);
    expect(apiState.listEntries).toHaveBeenCalledWith('2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z');
  });

  it('rejects unsafe project IDs and missing activity ranges before GitHub activity scans', async () => {
    await startServer();

    await expectBadRequest('/api/evidence/activity/%20?from=2026-07-01T00:00:00.000Z&to=2026-07-02T00:00:00.000Z');
    await expectBadRequest('/api/evidence/activity/project_verified');

    expect(apiState.listGitHubActivity).not.toHaveBeenCalled();
  });

  it('rejects invalid report and review path params with JSON 400 responses', async () => {
    await startServer();

    await expectBadRequest('/api/reviews/yearly/2026-07-01');
    await expectBadRequest('/api/reviews/weekly/not-a-date');
    await expectBadRequest('/api/reports/weekly/not-a-date');
    await expectBadRequest('/api/reports/daily/not-a-date');
    await expectBadRequest('/api/standups/2026-02-30');
    await expectBadRequest('/api/reports/monthly/2026-13');

    expect(apiState.listEntries).not.toHaveBeenCalled();
  });

  it('uses exclusive next-boundary ranges for daily, weekly, monthly, and standup routes', async () => {
    await startServer();

    expect((await apiGet('/api/reports/daily/2026-07-09')).status).toBe(200);
    expect(apiState.listEntries).toHaveBeenLastCalledWith('2026-07-09T00:00:00.000Z', '2026-07-10T00:00:00.000Z');

    expect((await apiGet('/api/reports/monthly/2026-02')).status).toBe(200);
    expect(apiState.listEntries).toHaveBeenLastCalledWith('2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z');

    expect((await apiGet('/api/reports/weekly/2026-07-06')).status).toBe(200);
    expect(apiState.listEntries).toHaveBeenCalledWith('2026-07-12T00:00:00.000Z', '2026-07-13T00:00:00.000Z');

    expect((await apiGet('/api/standups/2026-07-09')).status).toBe(200);
    expect(apiState.listEntries).toHaveBeenLastCalledWith('2026-07-09T00:00:00.000Z', '2026-07-10T00:00:00.000Z');
  });
});
