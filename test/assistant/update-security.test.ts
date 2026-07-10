import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

const nativePlatform = process.platform;

function setProcessPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    enumerable: true,
    value: platform,
  });
}

const mocks = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const autoUpdater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    channel: 'latest',
    allowPrerelease: false,
    forceDevUpdateConfig: false,
    logger: null as unknown,
    getFeedURL: vi.fn(() => null as string | null),
    setFeedURL: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
      return autoUpdater;
    }),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  };
  const app = {
    isPackaged: false,
    getVersion: vi.fn(() => '0.5.3'),
  };
  const window = {
    isDestroyed: vi.fn(() => false),
    webContents: { send: vi.fn() },
  };
  return { app, autoUpdater, handlers, window };
});

vi.mock('electron', () => ({
  app: mocks.app,
  BrowserWindow: class BrowserWindow {},
}));

vi.mock('electron-updater', () => ({
  default: { autoUpdater: mocks.autoUpdater },
}));

beforeEach(() => {
  setProcessPlatform('darwin');
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.app.isPackaged = false;
  mocks.autoUpdater.getFeedURL.mockReturnValue(null);
  for (const event of Object.keys(mocks.handlers)) delete mocks.handlers[event];
});

afterEach(() => {
  setProcessPlatform(nativePlatform);
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('OTA configuration security', () => {
  it('pins the production HTTPS feed and rejects unsafe URL components', async () => {
    const { normalizeUpdateFeedUrl } = await import('../../src/main/updates');

    expect(normalizeUpdateFeedUrl()).toBe('https://plexus-upgrade.thoughtseed.space/plexus');
    expect(() => normalizeUpdateFeedUrl('http://plexus-upgrade.thoughtseed.space/plexus')).toThrow('must use HTTPS');
    expect(() => normalizeUpdateFeedUrl('https://user:secret@plexus-upgrade.thoughtseed.space/plexus')).toThrow('must not include credentials');
    expect(() => normalizeUpdateFeedUrl('https://plexus-upgrade.thoughtseed.space/plexus?channel=evil')).toThrow('query or fragment');
    expect(() => normalizeUpdateFeedUrl('https://plexus-upgrade.thoughtseed.space/plexus#evil')).toThrow('query or fragment');
    expect(() => normalizeUpdateFeedUrl('https://updates.example.test/plexus')).toThrow('pinned production endpoint');
    expect(normalizeUpdateFeedUrl('https://updates.example.test/plexus/', { allowCustomHttpsFeed: true }))
      .toBe('https://updates.example.test/plexus');
  });

  it('allowlists update channel names', async () => {
    const { normalizeUpdateChannel } = await import('../../src/main/updates');

    expect(normalizeUpdateChannel()).toBe('latest');
    expect(normalizeUpdateChannel(' BETA ')).toBe('beta');
    expect(normalizeUpdateChannel('canary')).toBe('canary');
    expect(() => normalizeUpdateChannel('../../release')).toThrow('must be one of');
    expect(() => normalizeUpdateChannel('nightly')).toThrow('must be one of');
  });

  it('rejects a custom feed unless explicit opt-in is active in dev or forced test mode', async () => {
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    vi.stubEnv('PLEXUS_UPDATE_FEED_URL', 'https://updates.example.test/plexus');
    const withoutOptIn = await import('../../src/main/updates');
    expect(withoutOptIn.initAutoUpdates(mocks.window as unknown as BrowserWindow).state).toBe('disabled');
    expect(mocks.autoUpdater.setFeedURL).not.toHaveBeenCalled();

    vi.resetModules();
    vi.clearAllMocks();
    for (const event of Object.keys(mocks.handlers)) delete mocks.handlers[event];
    vi.stubEnv('PLEXUS_ALLOW_CUSTOM_UPDATE_FEED', '1');
    const withOptIn = await import('../../src/main/updates');
    expect(withOptIn.initAutoUpdates(mocks.window as unknown as BrowserWindow).state).toBe('idle');
    expect(mocks.autoUpdater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://updates.example.test/plexus',
      channel: 'latest',
    });
  });

  it('disables OTA outside Darwin even when forced update checks are requested', async () => {
    setProcessPlatform('win32');
    mocks.app.isPackaged = true;
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    const updates = await import('../../src/main/updates');

    const status = updates.initAutoUpdates(mocks.window as unknown as BrowserWindow);

    expect(status.state).toBe('disabled');
    expect(status.message).toContain('macOS');
    expect(mocks.autoUpdater.setFeedURL).not.toHaveBeenCalled();
    expect(mocks.autoUpdater.on).not.toHaveBeenCalled();
  });
});

describe('OTA install cleanup', () => {
  it('awaits caller cleanup before scheduling quitAndInstall', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    const order: string[] = [];
    const cleanup = vi.fn(async () => {
      await Promise.resolve();
      order.push('cleanup');
    });
    mocks.autoUpdater.quitAndInstall.mockImplementation(() => {
      order.push('quit');
    });
    const updates = await import('../../src/main/updates');
    updates.initAutoUpdates(mocks.window as unknown as BrowserWindow, { beforeInstall: cleanup });
    mocks.handlers['update-downloaded']({ version: '0.5.3', releaseDate: '2026-07-10T00:00:00.000Z' });

    const result = await updates.installUpdateAndRestart();

    expect(result.state).toBe('downloaded');
    expect(cleanup).toHaveBeenCalledOnce();
    expect(order).toEqual(['cleanup']);
    await vi.runAllTimersAsync();
    expect(order).toEqual(['cleanup', 'quit']);
  });

  it('does not quit when cleanup fails', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    const updates = await import('../../src/main/updates');
    updates.initAutoUpdates(mocks.window as unknown as BrowserWindow, {
      beforeInstall: async () => { throw new Error('database flush failed'); },
    });
    mocks.handlers['update-downloaded']({ version: '0.5.3' });

    const result = await updates.installUpdateAndRestart();
    await vi.runAllTimersAsync();

    expect(result.state).toBe('downloaded');
    expect(result.canInstall).toBe(true);
    expect(result.error).toContain('database flush failed');
    expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });
});
