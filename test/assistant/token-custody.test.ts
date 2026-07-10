import { afterEach, describe, expect, it, vi } from 'vitest';

const PLEXUS_ACCESS_AUD = '5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200';

const custodyState = vi.hoisted(() => ({
  settings: new Map<string, string | null>(),
  encryptionAvailable: true,
}));

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => custodyState.encryptionAvailable,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (value: Buffer) => {
      const decoded = value.toString('utf8');
      if (!decoded.startsWith('enc:')) throw new Error('bad ciphertext');
      return decoded.slice(4);
    },
  },
  BrowserWindow: class MockBrowserWindow {},
  session: {
    fromPartition: vi.fn(() => ({
      clearStorageData: vi.fn(),
      clearCache: vi.fn(),
    })),
  },
}));

vi.mock('../../src/db/database.js', () => ({
  getSetting: vi.fn(async (key: string) => custodyState.settings.get(key) ?? ''),
  setSetting: vi.fn(async (key: string, value: string) => {
    custodyState.settings.set(key, value);
  }),
  listProjects: vi.fn(async () => []),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
  updateEntry: vi.fn(),
  listUnsyncedEntries: vi.fn(async () => []),
  listEntries: vi.fn(async () => []),
  getRunningEntry: vi.fn(async () => null),
  listGitHubActivity: vi.fn(async () => []),
  upsertReviewCycle: vi.fn(),
  upsertStandupEvidenceRecord: vi.fn(),
}));

afterEach(() => {
  custodyState.settings = new Map();
  custodyState.encryptionAvailable = true;
  vi.unstubAllGlobals();
  vi.resetModules();
});

function encodeJwtPayload(payload: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

function validAccessJwt(): string {
  return encodeJwtPayload({
    aud: [PLEXUS_ACCESS_AUD],
    email: 'member@example.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}

describe('main-process token custody', () => {
  it('ignores retired MultiCA fields returned by legacy member provisioning', async () => {
    custodyState.settings.set('tf.baseUrl', 'https://plexus.example');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        memberId: 'member_1',
        memberName: 'Member One',
        workspaceId: 'workspace_1',
        paperclipRepoRoot: '/tmp/paperclip',
        multica: {
          apiUrl: 'https://retired-multica.example',
          workspaceId: 'retired_workspace',
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));
    const { provisionMember, setWorkerConfig } = await import('../../src/main/teamforge');
    await setWorkerConfig({ token: 'member-token' });

    const result = await provisionMember();

    expect(result).toMatchObject({
      ok: true,
      bundle: {
        memberId: 'member_1',
        workspaceId: 'workspace_1',
        paperclipRepoRoot: '/tmp/paperclip',
      },
    });
    expect(result.bundle).not.toHaveProperty('multica');
    expect(custodyState.settings.get('tf.paperclipRepoRoot')).toBe('/tmp/paperclip');
    expect(custodyState.settings.has('tf.multicaApiUrl')).toBe(false);
  });

  it('migrates a valid legacy Access JWT into safeStorage and clears plaintext', async () => {
    const jwt = validAccessJwt();
    custodyState.settings.set('tf.accessJwt', jwt);
    const { getAccessJwt } = await import('../../src/main/teamforge');

    expect(await getAccessJwt()).toBe(jwt);
    expect(custodyState.settings.get('tf.accessJwt')).toBe('');
    expect(custodyState.settings.get('tf.accessJwtEnc')).toBe(Buffer.from(`enc:${jwt}`).toString('base64'));
    expect(custodyState.settings.get('tf.accessJwtEnc')).not.toContain(jwt);
  });

  it('clears invalid legacy Access JWTs instead of preserving plaintext', async () => {
    custodyState.settings.set('tf.accessJwt', 'not-a-valid-app-jwt');
    const { getAccessJwt } = await import('../../src/main/teamforge');

    expect(await getAccessJwt()).toBeNull();
    expect(custodyState.settings.get('tf.accessJwt')).toBe('');
    expect(custodyState.settings.get('tf.accessJwtEnc')).toBeUndefined();
  });

  it('migrates legacy Worker bearer tokens into encrypted custody', async () => {
    custodyState.settings.set('tf.token', 'member-token');
    const { getWorkerConfig } = await import('../../src/main/teamforge');

    expect(await getWorkerConfig()).toMatchObject({ hasToken: true });
    expect(custodyState.settings.get('tf.token')).toBe('');
    expect(custodyState.settings.get('tf.tokenEnc')).toBe(Buffer.from('enc:member-token').toString('base64'));
  });

  it('migrates the local API token out of plaintext storage', async () => {
    custodyState.settings.set('apiToken', 'local-api-token');
    const { LOCAL_API_TOKEN_SETTING_KEYS, loadOrCreateLocalApiToken } = await import('../../src/main/api-server');

    expect(await loadOrCreateLocalApiToken()).toBe('local-api-token');
    expect(custodyState.settings.get(LOCAL_API_TOKEN_SETTING_KEYS.legacyToken)).toBe('');
    expect(custodyState.settings.get(LOCAL_API_TOKEN_SETTING_KEYS.tokenEnc)).toBe(Buffer.from('enc:local-api-token').toString('base64'));
  });

  it('removes plaintext local API tokens when secure storage is unavailable', async () => {
    custodyState.encryptionAvailable = false;
    custodyState.settings.set('apiToken', 'local-api-token');
    const { LOCAL_API_TOKEN_SETTING_KEYS, loadOrCreateLocalApiToken } = await import('../../src/main/api-server');

    const token = await loadOrCreateLocalApiToken();

    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(custodyState.settings.get(LOCAL_API_TOKEN_SETTING_KEYS.legacyToken)).toBe('');
    expect(custodyState.settings.get(LOCAL_API_TOKEN_SETTING_KEYS.tokenEnc)).toBeUndefined();
  });
});
