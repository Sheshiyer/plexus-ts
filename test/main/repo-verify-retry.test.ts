import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  listProjects: vi.fn(async () => []),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
  updateEntry: vi.fn(),
  listUnsyncedEntries: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const workerFailure = () => new Response(JSON.stringify({
  ok: false,
  error: { message: 'workspace verify endpoint unavailable' },
}), { status: 500 });

describe('verifyProjectRepo local fallback statuses', () => {
  it('returns transient "unverified" (not "inaccessible") on a GitHub rate limit', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.startsWith('https://worker.test')) return workerFailure();
      if (target.startsWith('https://api.github.com')) {
        return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), { status: 403 });
      }
      // HEAD fallback also rate-limited/blocked, but not a 404.
      return new Response(null, { status: 429 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { verifyProjectRepo } = await import('../../src/main/teamforge');

    const result = await verifyProjectRepo('proj-1', 'https://github.com/thoughtseed/plexus-ts');

    expect(result.ok).toBe(false);
    expect(result.status).toBe('unverified');
  });

  it('returns "inaccessible" only on a confirmed 404', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.startsWith('https://worker.test')) return workerFailure();
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { verifyProjectRepo } = await import('../../src/main/teamforge');

    const result = await verifyProjectRepo('proj-1', 'https://github.com/thoughtseed/does-not-exist');

    expect(result.ok).toBe(false);
    expect(result.status).toBe('inaccessible');
  });

  it('returns transient "unverified" when GitHub is unreachable (network error)', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.startsWith('https://worker.test')) return workerFailure();
      throw new Error('getaddrinfo ENOTFOUND api.github.com');
    });
    vi.stubGlobal('fetch', fetchMock);
    const { verifyProjectRepo } = await import('../../src/main/teamforge');

    const result = await verifyProjectRepo('proj-1', 'https://github.com/thoughtseed/plexus-ts');

    expect(result.ok).toBe(false);
    expect(result.status).toBe('unverified');
  });

  it('verifies successfully via the public GitHub API when the worker is down', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.startsWith('https://worker.test')) return workerFailure();
      if (target.startsWith('https://api.github.com')) {
        return new Response(JSON.stringify({
          id: 12345,
          full_name: 'thoughtseed/plexus-ts',
          html_url: 'https://github.com/thoughtseed/plexus-ts',
        }), { status: 200 });
      }
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { verifyProjectRepo } = await import('../../src/main/teamforge');

    const result = await verifyProjectRepo('proj-1', 'https://github.com/thoughtseed/plexus-ts');

    expect(result.ok).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.project?.repoEvidenceStatus).toBe('verified');
    expect(result.project?.repoVerifiedAt).toBeTruthy();
    expect(result.remoteVerified).toBe(false);
  });
});

describe('retryHandoff persists repo verification outcomes', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/main/main.ts'), 'utf8');

  it('shares one persistence helper between the IPC handler and the retry path', () => {
    expect(source).toContain('async function applyRepoVerificationResult(');
    // Both call sites use it.
    expect(source.match(/await applyRepoVerificationResult\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('persists the retried outcome inside the github_repo_verify retry branch', () => {
    const branch = source.slice(
      source.indexOf("retrying.kind === 'github_repo_verify'"),
      source.indexOf("retrying.kind === 'github_activity_sync'"),
    );
    expect(branch).toContain('await applyRepoVerificationResult(projectId, repoUrl, result)');
  });
});
