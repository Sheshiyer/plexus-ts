import { afterEach, describe, expect, it, vi } from 'vitest';

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
};

const PLEXUS_ACCESS_AUD = '5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200';

const electronState = vi.hoisted(() => ({
  windows: [] as MockWindowState[],
  nextLoadURLError: null as Error | null,
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
      };
      this.options = options;
      this.webContents = {
        session: {
          cookies: {
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
      decryptString: (value: Buffer) => value.toString('utf8'),
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
  listProjects: vi.fn(async () => []),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
  updateEntry: vi.fn(),
  listUnsyncedEntries: vi.fn(async () => []),
}));

afterEach(() => {
  electronState.windows = [];
  electronState.nextLoadURLError = null;
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
    databaseState.settings.set('tf.baseUrl', 'http://plexus.example');
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
