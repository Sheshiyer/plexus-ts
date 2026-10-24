import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockHandler = (...args: unknown[]) => unknown;
type MockPermissionRequestHandler = (
  webContents: unknown,
  permission: string,
  callback: (allowed: boolean) => void,
) => void;
type MockPermissionCheckHandler = (
  webContents: unknown,
  permission: string,
  requestingOrigin?: string,
  details?: unknown,
) => boolean;
type AccessWindowOptions = {
  webPreferences?: Record<string, unknown>;
};
type CookieRecord = {
  name: string;
  value: string;
};
type MockWindowState = {
  options: AccessWindowOptions;
  webContentsHandlers: Record<string, MockHandler>;
  windowHandlers: Record<string, MockHandler>;
  windowOpenHandler?: (details: { url: string }) => { action: string };
  permissionRequestHandler?: MockPermissionRequestHandler;
  permissionCheckHandler?: MockPermissionCheckHandler;
  loadURLCalls: string[];
  loadURLError: Error | null;
  closeCalls: number;
  destroyed: boolean;
  cookies: CookieRecord[];
  cookieHandlers: Record<string, MockHandler>;
};

const PLEXUS_ACCESS_AUD = '38b502a01f4063c5521191e084c7fd9b086099c0061b045145cd93165b9af8d0';

const electronState = vi.hoisted(() => ({
  windows: [] as MockWindowState[],
  nextLoadURLError: null as Error | null,
  failNextDecrypt: false,
}));

const databaseState = vi.hoisted(() => ({
  settings: new Map<string, string | null>([
    ['tf.baseUrl', 'https://plexus.example'],
  ]),
}));

vi.mock('electron', () => {
  class MockBrowserWindow {
    readonly options: AccessWindowOptions;
    readonly webContents: {
      session: {
        cookies: {
          on: (event: string, handler: MockHandler) => void;
          removeListener: (event: string, handler: MockHandler) => void;
          get: (filter: { name?: string; url?: string }) => Promise<CookieRecord[]>;
        };
        setPermissionRequestHandler: (handler: MockPermissionRequestHandler) => void;
        setPermissionCheckHandler: (handler: MockPermissionCheckHandler) => void;
      };
      setWindowOpenHandler: (handler: (details: { url: string }) => { action: string }) => void;
      on: (event: string, handler: MockHandler) => void;
      removeListener: (event: string, handler: MockHandler) => void;
    };

    constructor(options: AccessWindowOptions) {
      const state = {
        options,
        webContentsHandlers: {} as Record<string, MockHandler>,
        windowHandlers: {} as Record<string, MockHandler>,
        loadURLCalls: [] as string[],
        loadURLError: electronState.nextLoadURLError,
        closeCalls: 0,
        destroyed: false,
        cookies: [] as CookieRecord[],
        cookieHandlers: {} as Record<string, MockHandler>,
      };
      this.options = options;
      this.webContents = {
        session: {
          cookies: {
            on: (event, handler) => { state.cookieHandlers[event] = handler; },
            removeListener: (event, handler) => { if (state.cookieHandlers[event] === handler) delete state.cookieHandlers[event]; },
            get: async (filter) => {
              if (filter.name) return state.cookies.filter(cookie => cookie.name === filter.name);
              return state.cookies;
            },
          },
          setPermissionRequestHandler: (handler) => {
            state.permissionRequestHandler = handler;
          },
          setPermissionCheckHandler: (handler) => {
            state.permissionCheckHandler = handler;
          },
        },
        setWindowOpenHandler: (handler) => {
          state.windowOpenHandler = handler;
        },
        on: (event, handler) => {
          state.webContentsHandlers[event] = handler;
        },
        removeListener: (event, handler) => {
          if (state.destroyed) throw new Error('Object has been destroyed');
          if (state.webContentsHandlers[event] === handler) {
            delete state.webContentsHandlers[event];
          }
        },
      };
      electronState.windows.push(state);
    }

    on(event: string, handler: MockHandler) {
      const state = electronState.windows.at(-1);
      if (state) state.windowHandlers[event] = handler;
      return this;
    }

    removeListener(event: string, handler: MockHandler) {
      const state = electronState.windows.at(-1);
      if (state?.windowHandlers[event] === handler) {
        delete state.windowHandlers[event];
      }
      return this;
    }

    close() {
      const state = electronState.windows.at(-1);
      if (!state) return;
      state.closeCalls += 1;
      const closed = state.windowHandlers.closed;
      if (closed) closed();
    }

    isDestroyed() {
      const state = electronState.windows.at(-1);
      return state?.destroyed ?? false;
    }

    loadURL(url: string) {
      const state = electronState.windows.at(-1);
      if (state) {
        state.loadURLCalls.push(url);
        if (state.loadURLError) return Promise.reject(state.loadURLError);
      }
      return Promise.resolve();
    }
  }

  return {
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(value),
      decryptString: (value: Buffer) => { if (electronState.failNextDecrypt) { electronState.failNextDecrypt = false; throw new Error('Secure storage temporarily locked'); } return value.toString('utf8'); },
    },
    BrowserWindow: MockBrowserWindow,
    session: {
      fromPartition: vi.fn(() => ({
        clearStorageData: vi.fn(),
        clearCache: vi.fn(),
      })),
    },
  };
});

vi.mock('../../src/db/database.js', () => ({
  getSetting: vi.fn(async (key: string) => databaseState.settings.get(key) ?? ''),
  setSetting: vi.fn(async (key: string, value: string) => {
    databaseState.settings.set(key, value);
  }),
  restoreSettingIfCurrent: vi.fn(async (key: string, expected: string, previous: string | null) => { if (databaseState.settings.get(key) === expected) { if (previous === null) databaseState.settings.delete(key); else databaseState.settings.set(key, previous); } }),
  cancelPendingGrowthIntentsForAuthorityChange: vi.fn(async () => undefined),
  listProjects: vi.fn(async () => []),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
  updateEntry: vi.fn(),
  listUnsyncedEntries: vi.fn(async () => []),
}));

beforeEach(() => {
  vi.stubEnv('PLEXUS_WORKER_BASE_URL', 'https://plexus.example');
});

afterEach(() => {
  electronState.windows = [];
  electronState.nextLoadURLError = null;
  electronState.failNextDecrypt = false;
  databaseState.settings = new Map([
    ['tf.baseUrl', 'https://plexus.example'],
  ]);
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

async function waitForCreatedWindow(): Promise<MockWindowState> {
  for (let i = 0; i < 5 && !electronState.windows[0]; i += 1) {
    await Promise.resolve();
  }
  expect(electronState.windows[0]).toBeDefined();
  return electronState.windows[0];
}

describe('Access login BrowserWindow security', () => {
  it('creates the login child window with locked-down Electron webPreferences', async () => {
    const { ACCESS_LOGIN_PARTITION, createAccessLoginWindow } = await import('../../src/main/teamforge');

    createAccessLoginWindow('https://plexus.example/v1/whoami');

    expect(electronState.windows).toHaveLength(1);
    expect(electronState.windows[0].options.webPreferences).toMatchObject({
      partition: ACCESS_LOGIN_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
    });
    expect(electronState.windows[0].options.webPreferences).not.toHaveProperty('preload');
  });

  it('denies popup windows from the Access login flow', async () => {
    const { createAccessLoginWindow } = await import('../../src/main/teamforge');

    createAccessLoginWindow('https://plexus.example/v1/whoami');

    const popupResult = electronState.windows[0].windowOpenHandler?.({ url: 'https://evil.example/phish' });
    expect(popupResult).toEqual({ action: 'deny' });
  });

  it('allows only exact target-origin and Cloudflare Access navigations', async () => {
    const { createAccessLoginWindow, isAllowedAccessLoginNavigation } = await import('../../src/main/teamforge');
    const target = 'https://plexus.example/v1/whoami';

    createAccessLoginWindow(target);
    const navigate = electronState.windows[0].webContentsHandlers['will-navigate'];
    const redirect = electronState.windows[0].webContentsHandlers['will-redirect'];
    expect(navigate).toBeTypeOf('function');
    expect(redirect).toBeTypeOf('function');

    for (const url of [
      'https://plexus.example/cdn-cgi/access/login',
      'https://team.cloudflareaccess.com/cdn-cgi/access/login',
    ]) {
      const event = { preventDefault: vi.fn() };
      navigate(event, url);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(isAllowedAccessLoginNavigation(url, target)).toBe(true);
    }

    for (const url of [
      'javascript:alert(1)',
      'file:///tmp/steal',
      'https://plexus.example.evil.test/cdn-cgi/access/login',
      'https://evil.example/phish',
    ]) {
      const event = { preventDefault: vi.fn() };
      redirect(event, url);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(isAllowedAccessLoginNavigation(url, target)).toBe(false);
    }
  });

  it('supports explicitly configured exact extra login origins without substring bypasses', async () => {
    vi.stubEnv('PLEXUS_ACCESS_LOGIN_ALLOWED_ORIGINS', 'https://idp.example,not-a-url');
    const { isAllowedAccessLoginNavigation } = await import('../../src/main/teamforge');
    const target = 'https://plexus.example/v1/whoami';

    expect(isAllowedAccessLoginNavigation('https://idp.example/login', target)).toBe(true);
    expect(isAllowedAccessLoginNavigation('https://idp.example.evil.test/login', target)).toBe(false);
  });

  it('denies permission requests and permission checks inside the Access partition', async () => {
    const { createAccessLoginWindow } = await import('../../src/main/teamforge');

    createAccessLoginWindow('https://plexus.example/v1/whoami');

    const requestCallback = vi.fn();
    electronState.windows[0].permissionRequestHandler?.({}, 'media', requestCallback);
    expect(requestCallback).toHaveBeenCalledWith(false);
    expect(electronState.windows[0].permissionCheckHandler?.({}, 'media', 'https://plexus.example')).toBe(false);
  });

  it('keeps the hardened child window compatible with Access cookie capture', async () => {
    const jwt = validAccessJwt();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        email: 'member@example.com',
        displayName: 'Member Example',
        identityId: 'identity_member',
        workspaceId: 'workspace_1',
        role: 'employee',
        capabilities: {},
        onboarding: { steps: [], requiredComplete: false, completed: false },
      },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const { accessLogin } = await import('../../src/main/teamforge');

    const login = accessLogin();
    const win = await waitForCreatedWindow();
    win.cookies = [{ name: 'CF_Authorization', value: jwt }];
    await win.webContentsHandlers['did-finish-load']();
    const result = await login;

    expect(result).toMatchObject({ ok: true, session: { email: 'member@example.com' } });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://plexus.example/v1/whoami',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Cf-Access-Jwt-Assertion': jwt,
          Cookie: `CF_Authorization=${jwt}`,
        }),
      }),
    );
    expect(databaseState.settings.get('tf.accessJwt')).toBe('');
    expect(databaseState.settings.get('tf.accessJwtEnc')).toBe(Buffer.from(jwt).toString('base64'));
    expect(databaseState.settings.get('tf.accessJwtEnc')).not.toContain(jwt);
    expect(databaseState.settings.get('tf.session')).toContain('member@example.com');
    expect(win.closeCalls).toBe(1);
    expect(win.webContentsHandlers['did-finish-load']).toBeUndefined();
  });

  it('rejects non-HTTPS Access login targets before opening a child window', async () => {
    vi.stubEnv('PLEXUS_WORKER_BASE_URL', 'http://127.0.0.1:8787');
    const { accessLogin } = await import('../../src/main/teamforge');

    const result = await accessLogin();

    expect(result).toEqual({
      ok: false,
      message: 'Cloudflare Access sign-in requires an HTTPS workspace URL.',
    });
    expect(electronState.windows).toHaveLength(0);
  });

  it('cleans up and closes the child window when loading the login target fails', async () => {
    electronState.nextLoadURLError = new Error('network down');
    const { accessLogin } = await import('../../src/main/teamforge');

    const login = accessLogin();
    const result = await login;

    expect(result).toEqual({ ok: false, message: 'network down' });
    expect(electronState.windows[0].closeCalls).toBe(1);
    expect(electronState.windows[0].windowHandlers.closed).toBeUndefined();
  });

  it('settles a user-closed Access window without touching destroyed webContents', async () => {
    const { accessLogin } = await import('../../src/main/teamforge');

    const login = accessLogin();
    const win = await waitForCreatedWindow();
    win.destroyed = true;

    expect(() => win.windowHandlers.closed()).not.toThrow();
    await expect(login).resolves.toEqual({ ok: false, message: 'Sign-in cancelled.' });
  });

  it('times out unfinished Access login flows and closes the child window', async () => {
    vi.useFakeTimers();
    const { ACCESS_LOGIN_TIMEOUT_MS, accessLogin } = await import('../../src/main/teamforge');

    const login = accessLogin();
    const win = await waitForCreatedWindow();
    await vi.advanceTimersByTimeAsync(ACCESS_LOGIN_TIMEOUT_MS);
    const result = await login;

    expect(result).toEqual({ ok: false, message: 'Sign-in timed out.' });
    expect(win.closeCalls).toBe(1);
  });

  it('does not log token prefixes when rejecting unusable Access cookies', async () => {
    vi.useFakeTimers();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { ACCESS_LOGIN_TIMEOUT_MS, accessLogin } = await import('../../src/main/teamforge');

    const login = accessLogin();
    const win = await waitForCreatedWindow();
    win.cookies = [
      { name: 'CF_Authorization', value: 'secret-token-prefix-that-must-not-log' },
    ];
    await win.webContentsHandlers['did-finish-load']();
    await vi.advanceTimersByTimeAsync(ACCESS_LOGIN_TIMEOUT_MS);
    await login;

    expect(logSpy).toHaveBeenCalledWith('[accessLogin] cookie candidate found but not usable app token.');
    expect(logSpy.mock.calls.flat().join(' ')).not.toContain('secret-token-prefix');
  });
});

describe('post-OTP lifecycle robustness', () => {
  const identity = () => new Response(JSON.stringify({ email: 'member@example.com', identityId: 'member1', role: 'employee', workspaceId: 'ws1' }), { status: 200 });
  it('captures a late changed cookie, deduplicates events, retries transient validation and cleans listeners', async () => {
    vi.useFakeTimers(); const fetchMock = vi.fn().mockRejectedValueOnce(new Error('temporary network failure')).mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'temporarily unavailable' } }), { status: 500 })).mockImplementation(async () => identity()); vi.stubGlobal('fetch', fetchMock);
    const { accessLogin } = await import('../../src/main/teamforge'); const login = accessLogin(); const win = await waitForCreatedWindow();
    await win.webContentsHandlers['did-finish-load']();
    win.cookies = [{ name: 'CF_Authorization', value: validAccessJwt() }];
    await win.cookieHandlers.changed({}, win.cookies[0], 'explicit', false);
    await vi.advanceTimersByTimeAsync(2000); const result = await login;
    expect(result.ok).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(3); expect(win.cookieHandlers.changed).toBeUndefined();
  });
  it('retries secure-storage failure with the same verified cookie', async () => {
    vi.useFakeTimers(); const fetchMock = vi.fn(async () => identity()); vi.stubGlobal('fetch', fetchMock);
    const database = await import('../../src/db/database.js'); vi.mocked(database.setSetting).mockRejectedValueOnce(new Error('temporary storage failure'));
    const { accessLogin } = await import('../../src/main/teamforge'); const login = accessLogin(); const win = await waitForCreatedWindow(); win.cookies = [{ name: 'CF_Authorization', value: validAccessJwt() }];
    await win.webContentsHandlers['did-finish-load'](); await vi.advanceTimersByTimeAsync(1000);
    expect((await login).ok).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(2); expect(databaseState.settings.has('tf.accessJwtEnc')).toBe(true);
  });
  it.each([401, 403])('does not retry an authoritative invalid credential response %s', async (status) => {
    vi.useFakeTimers(); const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'invalid identity' } }), { status })); vi.stubGlobal('fetch', fetchMock);
    const { accessLogin, ACCESS_LOGIN_TIMEOUT_MS } = await import('../../src/main/teamforge'); const login = accessLogin(); const win = await waitForCreatedWindow(); win.cookies = [{ name: 'CF_Authorization', value: validAccessJwt() }];
    await win.webContentsHandlers['did-finish-load'](); await win.webContentsHandlers['did-navigate']();
    expect(fetchMock).toHaveBeenCalledTimes(1); await vi.advanceTimersByTimeAsync(ACCESS_LOGIN_TIMEOUT_MS); await login; expect(databaseState.settings.has('tf.accessJwtEnc')).toBe(false);
  });
  it('deduplicates validation and never persists a delayed result after cancellation', async () => {
    let resolve!: (value: Response) => void; const fetchMock = vi.fn((_url: string, _init: RequestInit) => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal('fetch', fetchMock);
    const { accessLogin } = await import('../../src/main/teamforge'); const login = accessLogin(); const win = await waitForCreatedWindow(); win.cookies = [{ name: 'CF_Authorization', value: validAccessJwt() }];
    const pending = win.webContentsHandlers['did-finish-load'](); await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await win.webContentsHandlers['did-navigate'](); expect(fetchMock).toHaveBeenCalledTimes(1);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal; win.windowHandlers.closed(); expect(signal.aborted).toBe(true); resolve(identity()); await pending;
    expect(await login).toEqual({ ok: false, message: 'Sign-in cancelled.' }); expect(databaseState.settings.has('tf.accessJwtEnc')).toBe(false); expect(databaseState.settings.has('tf.session')).toBe(false); expect(win.cookieHandlers.changed).toBeUndefined();
  });
  it('bounds each validation request and refuses a result after its request deadline', async () => {
    vi.useFakeTimers(); const validationDeadline = vi.spyOn(AbortSignal, 'timeout'); let resolve!: (value: Response) => void; const fetchMock = vi.fn((_url: string, _init: RequestInit) => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal('fetch', fetchMock);
    const { accessLogin, ACCESS_LOGIN_VALIDATION_TIMEOUT_MS, ACCESS_LOGIN_TIMEOUT_MS } = await import('../../src/main/teamforge'); const login = accessLogin(); const win = await waitForCreatedWindow(); win.cookies = [{ name: 'CF_Authorization', value: validAccessJwt() }];
    const pending = win.webContentsHandlers['did-finish-load'](); await vi.advanceTimersByTimeAsync(0); const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal); expect(validationDeadline).toHaveBeenCalledWith(ACCESS_LOGIN_VALIDATION_TIMEOUT_MS);
    // AbortSignal.timeout uses the runtime clock, independent of fake timers. The
    // lifecycle deadline still guarantees cancellation even for a non-cooperating fetch.
    await vi.advanceTimersByTimeAsync(ACCESS_LOGIN_TIMEOUT_MS); expect(signal.aborted).toBe(true); resolve(identity()); await pending; await login; expect(databaseState.settings.has('tf.session')).toBe(false); expect(ACCESS_LOGIN_VALIDATION_TIMEOUT_MS).toBeLessThan(ACCESS_LOGIN_TIMEOUT_MS);
  });
});

describe('durable employee credential custody', () => {
  const response = (identityId = 'member1', workspaceId = 'ws1') => new Response(JSON.stringify({ email: 'member@example.com', identityId, role: 'employee', workspaceId }), { status: 200 });
  it('preserves encrypted sign-in and bridge credentials across module restart and same-account refresh', async () => {
    const jwt = validAccessJwt(); databaseState.settings.set('tf.accessJwtEnc', Buffer.from(jwt).toString('base64'));
    databaseState.settings.set('tf.session', JSON.stringify({ email: 'member@example.com', identityId: 'member1', workspaceId: 'ws1' })); databaseState.settings.set('ts.bridgeTokenEnc', 'opaque-bridge'); databaseState.settings.set('unrelated.preference', 'keep');
    vi.stubGlobal('fetch', vi.fn(async () => response()));
    vi.resetModules(); const api = await import('../../src/main/teamforge');
    expect(await api.getAccessJwt()).toBe(jwt); expect((await api.getSession())?.identityId).toBe('member1');
    expect((await api.refreshSession()).ok).toBe(true); expect(databaseState.settings.get('ts.bridgeTokenEnc')).toBe('opaque-bridge'); expect(databaseState.settings.get('unrelated.preference')).toBe('keep');
  });
  it.each([['member2','ws1'],['member1','ws2']])('disconnects prior bridge on validated actor/workspace change %s/%s', async (identityId, workspaceId) => {
    databaseState.settings.set('tf.accessJwtEnc', Buffer.from(validAccessJwt()).toString('base64')); databaseState.settings.set('tf.session', JSON.stringify({ email: 'member@example.com', identityId: 'member1', workspaceId: 'ws1' })); databaseState.settings.set('ts.bridgeTokenEnc', 'opaque-bridge'); databaseState.settings.set('ts.bridgeTokenExpiresAt', '2099-01-01'); databaseState.settings.set('unrelated.preference', 'keep');
    vi.stubGlobal('fetch', vi.fn(async () => response(identityId,workspaceId))); const api = await import('../../src/main/teamforge'); const database = await import('../../src/db/database.js'); vi.mocked(database.cancelPendingGrowthIntentsForAuthorityChange).mockClear();
    expect((await api.refreshSession()).ok).toBe(true); expect(databaseState.settings.get('ts.bridgeTokenEnc')).toBe(''); expect(databaseState.settings.get('ts.bridgeTokenExpiresAt')).toBe(''); expect(database.cancelPendingGrowthIntentsForAuthorityChange).toHaveBeenCalledOnce(); expect(databaseState.settings.get('unrelated.preference')).toBe('keep');
  });
  it('disconnects local bridge on explicit logout without rotating server identity', async () => {
    databaseState.settings.set('ts.bridgeTokenEnc', 'opaque-bridge'); databaseState.settings.set('ts.bridgeTokenExpiresAt', '2099-01-01'); databaseState.settings.set('unrelated.preference', 'keep');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); const api = await import('../../src/main/teamforge'); await api.logout();
    expect(databaseState.settings.get('ts.bridgeTokenEnc')).toBe(''); expect(databaseState.settings.get('tf.session')).toBe(''); expect(databaseState.settings.get('unrelated.preference')).toBe('keep'); expect(fetchMock).not.toHaveBeenCalled();
  });
});

it('retains encrypted Access custody when secure storage is temporarily locked and recovers without rewriting it', async () => {
  const jwt = validAccessJwt(); const encrypted = Buffer.from(jwt).toString('base64'); databaseState.settings.set('tf.accessJwtEnc', encrypted); electronState.failNextDecrypt = true;
  const { getAccessJwt } = await import('../../src/main/teamforge'); expect(await getAccessJwt()).toBeNull(); expect(databaseState.settings.get('tf.accessJwtEnc')).toBe(encrypted); expect(await getAccessJwt()).toBe(jwt); expect(databaseState.settings.get('tf.accessJwtEnc')).toBe(encrypted);
});

describe('serialized cancelled credential commits', () => {
  const response = () => new Response(JSON.stringify({ email: 'member@example.com', identityId: 'member1', role: 'employee', workspaceId: 'ws1' }), { status: 200 });
  it.each(['tf.accessJwtEnc','tf.session'])('rolls back a cancellation during async %s write and retains the prior same-account credentials', async key => {
    const oldJwt = encodeJwtPayload({ aud: [PLEXUS_ACCESS_AUD], email: 'member@example.com', exp: Math.floor(Date.now()/1000)+7200 });
    const previous = JSON.stringify({ email: 'member@example.com', identityId: 'member1', workspaceId: 'ws1' }); databaseState.settings.set('tf.session', previous); databaseState.settings.set('tf.accessJwtEnc', Buffer.from(oldJwt).toString('base64')); databaseState.settings.set('ts.bridgeTokenEnc', 'prior-bridge');
    const database = await import('../../src/db/database.js'); let release!: () => void; let blocked = false;
    vi.mocked(database.setSetting).mockImplementation(async (name, value) => { if (name === key && !blocked) { blocked = true; await new Promise<void>(done => { release = done; }); } databaseState.settings.set(name, value); });
    vi.stubGlobal('fetch', vi.fn(async () => response())); const api = await import('../../src/main/teamforge'); const login = api.accessLogin(); const win = await waitForCreatedWindow(); win.cookies = [{ name: 'CF_Authorization', value: validAccessJwt() }];
    const capture = win.webContentsHandlers['did-finish-load'](); await vi.waitFor(() => expect(blocked).toBe(true)); win.windowHandlers.closed(); release(); await capture; expect((await login).ok).toBe(false);
    expect(await api.getAccessJwt()).toBe(oldJwt); expect(databaseState.settings.get('tf.session')).toBe(previous); expect(databaseState.settings.get('ts.bridgeTokenEnc')).toBe('prior-bridge');
  });
  it('never downgrades locked Access custody to an existing worker bearer', async () => {
    const encrypted = Buffer.from(validAccessJwt()).toString('base64'); databaseState.settings.set('tf.accessJwtEnc', encrypted); databaseState.settings.set('tf.tokenEnc', Buffer.from('legacy-worker').toString('base64')); electronState.failNextDecrypt = true;
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); const api = await import('../../src/main/teamforge'); expect(await api.whoami()).toBeNull(); expect(fetchMock).not.toHaveBeenCalled(); expect(databaseState.settings.get('tf.accessJwtEnc')).toBe(encrypted);
  });
  it('does not persist a delayed refresh after logout', async () => {
    databaseState.settings.set('tf.accessJwtEnc', Buffer.from(validAccessJwt()).toString('base64')); databaseState.settings.set('tf.session', JSON.stringify({ email: 'member@example.com', identityId: 'member1', workspaceId: 'ws1' }));
    let release!: (value: Response) => void; const fetchMock = vi.fn(() => new Promise<Response>(done => { release = done; })); vi.stubGlobal('fetch', fetchMock); const api = await import('../../src/main/teamforge'); const refresh = api.refreshSession(); await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce()); await api.logout(); release(response()); expect((await refresh).ok).toBe(false); expect(await api.getSession()).toBeNull(); expect(await api.getAccessJwt()).toBeNull();
  });
});

it('a newer login waits for cancelled-write rollback and its credentials cannot be erased by the older attempt', async () => {
  const oldSession = JSON.stringify({ email: 'member@example.com', identityId: 'member1', workspaceId: 'ws1' }); databaseState.settings.set('tf.session', oldSession); databaseState.settings.set('tf.accessJwtEnc', Buffer.from(validAccessJwt()).toString('base64'));
  const database = await import('../../src/db/database.js'); let release!: () => void; let blocked = false;
  vi.mocked(database.setSetting).mockImplementation(async (key, value) => { if (key === 'tf.session' && !blocked) { blocked = true; await new Promise<void>(done => { release = done; }); } databaseState.settings.set(key, value); });
  let requests = 0; vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ email: 'member@example.com', identityId: ++requests === 1 ? 'member1' : 'member2', role: 'employee', workspaceId: 'ws1' }), { status: 200 })));
  const api = await import('../../src/main/teamforge'); const oldLogin = api.accessLogin(); const first = await waitForCreatedWindow(); first.cookies = [{ name: 'CF_Authorization', value: validAccessJwt() }]; const firstCapture = first.webContentsHandlers['did-finish-load'](); await vi.waitFor(() => expect(blocked).toBe(true));
  const newLogin = api.accessLogin(); await vi.waitFor(() => expect(electronState.windows).toHaveLength(2)); const second = electronState.windows[1]; const newJwt = encodeJwtPayload({ aud: [PLEXUS_ACCESS_AUD], email: 'member@example.com', exp: Math.floor(Date.now()/1000)+10800 }); second.cookies = [{ name: 'CF_Authorization', value: newJwt }]; const secondCapture = second.webContentsHandlers['did-finish-load']();
  release(); await firstCapture; await secondCapture; expect((await oldLogin).ok).toBe(false); expect((await newLogin).ok).toBe(true); expect(await api.getAccessJwt()).toBe(newJwt); expect((await api.getSession())?.identityId).toBe('member2');
});

it('a validated refresh actor transition fences an older in-flight refresh response', async () => {
  databaseState.settings.set('tf.accessJwtEnc', Buffer.from(validAccessJwt()).toString('base64')); databaseState.settings.set('tf.session', JSON.stringify({ email: 'member@example.com', identityId: 'member1', workspaceId: 'ws1' }));
  const responses: Array<(value: Response) => void> = []; vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { responses.push(done); })));
  const api = await import('../../src/main/teamforge'); const first = api.refreshSession(); const older = api.refreshSession(); await vi.waitFor(() => expect(responses).toHaveLength(2));
  responses[0](new Response(JSON.stringify({ email: 'member@example.com', identityId: 'member2', workspaceId: 'ws1' }))); expect((await first).ok).toBe(true);
  responses[1](new Response(JSON.stringify({ email: 'member@example.com', identityId: 'member1', workspaceId: 'ws1' }))); expect((await older).ok).toBe(false); expect((await api.getSession())?.identityId).toBe('member2');
});

describe('production Access multi-domain callback', () => {
  const target = 'https://plexus-api.thoughtseed.space/v1/whoami';
  const callback = 'https://clio-relay.thoughtseed.space/cdn-cgi/access/authorized?fixture=synthetic';
  const login = 'https://thoughtseedlabs.cloudflareaccess.com/cdn-cgi/access/login/plexus-api.thoughtseed.space';
  const context = { isMainFrame: true, expectedLoginSeen: true };

  it.each(['will-redirect', 'will-navigate'])(
    'allows the observed callback after the canonical Labs login through %s',
    async (kind) => {
      const { createAccessLoginWindow, isAllowedAccessLoginNavigation } = await import('../../src/main/teamforge');
      createAccessLoginWindow(target);
      const window = electronState.windows[0];
      const initial = { isMainFrame: true, preventDefault: vi.fn() };
      window.webContentsHandlers['will-redirect'](initial, login);
      expect(initial.preventDefault).not.toHaveBeenCalled();

      for (const url of [callback, 'https://plexus-api.thoughtseed.space/cdn-cgi/access/authorized', target]) {
        const event = { isMainFrame: true, preventDefault: vi.fn() };
        window.webContentsHandlers[kind](event, url);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(isAllowedAccessLoginNavigation(url, target, context)).toBe(true);
      }
    },
  );

  it('denies direct callback, subframe callback and state from another login window', async () => {
    const { createAccessLoginWindow, isAllowedAccessLoginNavigation } = await import('../../src/main/teamforge');
    expect(isAllowedAccessLoginNavigation(callback, target)).toBe(false);
    expect(isAllowedAccessLoginNavigation(callback, target, { ...context, isMainFrame: false })).toBe(false);

    createAccessLoginWindow(target);
    const window = electronState.windows[0];
    const direct = { isMainFrame: true, preventDefault: vi.fn() };
    window.webContentsHandlers['will-redirect'](direct, callback);
    expect(direct.preventDefault).toHaveBeenCalledOnce();

    window.webContentsHandlers['will-redirect']({ isMainFrame: true, preventDefault: vi.fn() }, login);
    const subframe = { isMainFrame: false, preventDefault: vi.fn() };
    window.webContentsHandlers['will-navigate'](subframe, callback);
    expect(subframe.preventDefault).toHaveBeenCalledOnce();

    createAccessLoginWindow(target);
    const fresh = { isMainFrame: true, preventDefault: vi.fn() };
    electronState.windows[1].webContentsHandlers['will-redirect'](fresh, callback);
    expect(fresh.preventDefault).toHaveBeenCalledOnce();
  });

  it.each([
    'https://clio-relay.thoughtseed.space/',
    'https://clio-relay.thoughtseed.space/v1/models',
    'https://clio-relay.thoughtseed.space/cdn-cgi/access/authorized/',
    'https://clio-relay.thoughtseed.space/cdn-cgi/access/authorized-evil',
    'https://clio-relay.thoughtseed.space/cdn-cgi/access/authorized%2F..',
    'https://clio-relay.thoughtseed.space.evil.test/cdn-cgi/access/authorized',
    'http://clio-relay.thoughtseed.space/cdn-cgi/access/authorized',
    'https://user@clio-relay.thoughtseed.space/cdn-cgi/access/authorized',
    'https://clio-relay.thoughtseed.space:444/cdn-cgi/access/authorized',
    'https://clio-relay.thoughtseed.space/cdn-cgi/access/authorized#unexpected',
  ])('rejects sibling navigation %s', async (url) => {
    const { isAllowedAccessLoginNavigation } = await import('../../src/main/teamforge');
    expect(isAllowedAccessLoginNavigation(url, target, context)).toBe(false);
  });

  it.each([
    'https://plexus.example/v1/whoami',
    'https://plexus-api.thoughtseed.space/custom',
    'https://plexus-api.thoughtseed.space/v1/whoami?custom=1',
    'https://user@plexus-api.thoughtseed.space/v1/whoami',
    'http://plexus-api.thoughtseed.space/v1/whoami',
  ])('does not extend callback authority to a custom login target %s', async (custom) => {
    const { isAllowedAccessLoginNavigation } = await import('../../src/main/teamforge');
    expect(isAllowedAccessLoginNavigation(callback, custom, context)).toBe(false);
  });
});
