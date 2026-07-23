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
  vi.useFakeTimers();
  vi.resetModules();
  vi.unstubAllEnvs();
  mocks.app.isPackaged = false;
  mocks.app.getVersion.mockReset().mockReturnValue('0.5.3');
  mocks.autoUpdater.getFeedURL.mockReset();
  mocks.autoUpdater.getFeedURL.mockReturnValue(null);
  mocks.autoUpdater.setFeedURL.mockReset();
  mocks.autoUpdater.on.mockReset().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    mocks.handlers[event] = handler;
    return mocks.autoUpdater;
  });
  mocks.autoUpdater.checkForUpdates.mockReset().mockResolvedValue(null);
  mocks.autoUpdater.downloadUpdate.mockReset().mockResolvedValue([]);
  mocks.autoUpdater.quitAndInstall.mockReset();
  mocks.window.isDestroyed.mockReset().mockReturnValue(false);
  mocks.window.webContents.send.mockReset();
  for (const event of Object.keys(mocks.handlers)) delete mocks.handlers[event];
});

afterEach(() => {
  vi.clearAllTimers();
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

    const firstInstall = updates.installUpdateAndRestart();
    const secondInstall = updates.installUpdateAndRestart();
    const [result, duplicateResult] = await Promise.all([firstInstall, secondInstall]);

    expect(result.state).toBe('installing');
    expect(duplicateResult.state).toBe('installing');
    expect(cleanup).toHaveBeenCalledOnce();
    expect(order).toEqual(['cleanup']);
    await vi.advanceTimersByTimeAsync(250);
    expect(order).toEqual(['cleanup', 'quit']);
    expect(mocks.autoUpdater.quitAndInstall).toHaveBeenCalledOnce();
  });

  it('does not quit when cleanup fails', async () => {
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    const updates = await import('../../src/main/updates');
    updates.initAutoUpdates(mocks.window as unknown as BrowserWindow, {
      beforeInstall: async () => { throw new Error('database flush failed'); },
    });
    mocks.handlers['update-downloaded']({ version: '0.5.3' });

    const result = await updates.installUpdateAndRestart();
    await vi.advanceTimersByTimeAsync(250);

    expect(result.state).toBe('downloaded');
    expect(result.canInstall).toBe(true);
    expect(result.error).toContain('database flush failed');
    expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });
});

describe('automatic OTA discovery', () => {
  it('schedules one startup check and one bounded periodic check per process', async () => {
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    const updates = await import('../../src/main/updates');

    updates.initAutoUpdates(mocks.window as unknown as BrowserWindow, {
      initialCheckDelayMs: 10,
      checkIntervalMs: 100,
    });
    updates.initAutoUpdates(mocks.window as unknown as BrowserWindow, {
      initialCheckDelayMs: 10,
      checkIntervalMs: 100,
    });

    await vi.advanceTimersByTimeAsync(9);
    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(100);
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('keeps automatic and manual checks single-flight', async () => {
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    let resolveCheck: (() => void) | undefined;
    mocks.autoUpdater.checkForUpdates.mockImplementation(() => new Promise((resolve) => {
      resolveCheck = () => resolve(null);
    }));
    const updates = await import('../../src/main/updates');
    updates.initAutoUpdates(mocks.window as unknown as BrowserWindow, {
      initialCheckDelayMs: 10,
      checkIntervalMs: 50,
    });

    await vi.advanceTimersByTimeAsync(10);
    mocks.handlers['checking-for-update']();
    const manual = updates.checkForUpdates();
    let manualSettled = false;
    void manual.then(() => { manualSettled = true; });
    await Promise.resolve();
    expect(manualSettled).toBe(false);
    await vi.advanceTimersByTimeAsync(150);
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledOnce();

    resolveCheck?.();
    await manual;
    expect(manualSettled).toBe(true);
    mocks.handlers['update-not-available']({ version: '0.5.3' });
    mocks.autoUpdater.checkForUpdates.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(50);
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite an actionable update or trigger privileged actions', async () => {
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    const updates = await import('../../src/main/updates');
    updates.initAutoUpdates(mocks.window as unknown as BrowserWindow, {
      initialCheckDelayMs: 10,
      checkIntervalMs: 50,
    });

    mocks.handlers['update-available']({ version: '0.5.4' });
    expect(updates.getUpdateStatus().canCheck).toBe(false);
    await vi.advanceTimersByTimeAsync(200);

    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(mocks.autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('retries a failed automatic check only on the normal interval', async () => {
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    mocks.autoUpdater.checkForUpdates
      .mockRejectedValueOnce(new Error('feed temporarily unavailable'))
      .mockResolvedValueOnce(null);
    const updates = await import('../../src/main/updates');
    updates.initAutoUpdates(mocks.window as unknown as BrowserWindow, {
      initialCheckDelayMs: 10,
      checkIntervalMs: 100,
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(updates.getUpdateStatus().state).toBe('error');
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(99);
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('clears automatic discovery timers during application shutdown', async () => {
    vi.stubEnv('PLEXUS_FORCE_UPDATE_CHECK', '1');
    const updates = await import('../../src/main/updates');
    updates.initAutoUpdates(mocks.window as unknown as BrowserWindow, {
      initialCheckDelayMs: 10,
      checkIntervalMs: 50,
    });

    updates.stopAutomaticUpdateChecks();
    await vi.advanceTimersByTimeAsync(200);

    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });
});
