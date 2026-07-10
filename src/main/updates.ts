import { app, BrowserWindow } from 'electron';
import { spawnSync } from 'node:child_process';
import electronUpdater from 'electron-updater';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import type { UpdateStatus, UpdateState } from '../shared/types.js';

const DEFAULT_CHANNEL = 'latest';
const DEFAULT_FEED_URL = 'https://plexus-upgrade.thoughtseed.space/plexus';
const ALLOWED_UPDATE_CHANNELS = new Set(['latest', 'beta', 'canary']);

export interface UpdateFeedValidationOptions {
  allowCustomHttpsFeed?: boolean;
}

export interface AutoUpdateInitOptions {
  beforeInstall?: () => void | Promise<void>;
}

let mainWindow: BrowserWindow | null = null;
let initialized = false;
let lastUpdateInfo: UpdateInfo | null = null;
let updater: typeof electronUpdater.autoUpdater | null = null;
let trustedSignature: boolean | null = null;
let beforeInstall: AutoUpdateInitOptions['beforeInstall'];

let status: UpdateStatus = makeStatus('idle', {
  message: 'Update service has not initialized yet.',
});

function now() {
  return new Date().toISOString();
}

export function normalizeUpdateChannel(value?: string): string {
  const channel = value?.trim().toLowerCase() || DEFAULT_CHANNEL;
  if (!ALLOWED_UPDATE_CHANNELS.has(channel)) {
    throw new Error(`Update channel must be one of: ${[...ALLOWED_UPDATE_CHANNELS].join(', ')}.`);
  }
  return channel;
}

export function normalizeUpdateFeedUrl(
  value?: string,
  options: UpdateFeedValidationOptions = {},
): string {
  const raw = value?.trim() || DEFAULT_FEED_URL;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Update feed URL is invalid.');
  }
  if (parsed.protocol !== 'https:') throw new Error('Update feed URL must use HTTPS.');
  if (parsed.username || parsed.password) throw new Error('Update feed URL must not include credentials.');
  if (parsed.search || parsed.hash) throw new Error('Update feed URL must not include a query or fragment.');

  const normalized = parsed.href.replace(/\/+$/, '');
  if (normalized !== DEFAULT_FEED_URL && !options.allowCustomHttpsFeed) {
    throw new Error(`Update feed must use the pinned production endpoint ${DEFAULT_FEED_URL}.`);
  }
  return normalized;
}

function customFeedAllowed() {
  const explicitOptIn = process.env.PLEXUS_ALLOW_CUSTOM_UPDATE_FEED === '1';
  const testMode = !app.isPackaged || process.env.PLEXUS_FORCE_UPDATE_CHECK === '1';
  return explicitOptIn && testMode;
}

function updateChannel() {
  try {
    return normalizeUpdateChannel(process.env.PLEXUS_UPDATE_CHANNEL);
  } catch {
    return DEFAULT_CHANNEL;
  }
}

function hasTrustedDistributionSignature() {
  if (process.platform !== 'darwin') return false;
  if (trustedSignature !== null) return trustedSignature;

  const result = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', process.execPath], {
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  trustedSignature = result.status === 0
    && !/Signature=adhoc/i.test(output)
    && /TeamIdentifier=(?!not set)[A-Z0-9]+/i.test(output);
  return trustedSignature;
}

function updatesEnabled() {
  if (process.env.PLEXUS_FORCE_UPDATE_CHECK === '1') return true;
  return app.isPackaged && hasTrustedDistributionSignature();
}

function getAutoUpdater() {
  if (!updater) updater = electronUpdater.autoUpdater;
  return updater;
}

function safeGetFeedUrl() {
  try {
    if (!updater) return undefined;
    const feedUrl = updater.getFeedURL() || undefined;
    if (!feedUrl || /deprecated/i.test(feedUrl)) return undefined;
    return feedUrl;
  } catch {
    return undefined;
  }
}

function currentFeedUrl() {
  return safeGetFeedUrl() || DEFAULT_FEED_URL;
}

function flagsFor(state: UpdateState) {
  const enabled = updatesEnabled();
  return {
    canCheck: enabled && state !== 'checking' && state !== 'downloading',
    canDownload: enabled && state === 'available',
    canInstall: enabled && state === 'downloaded',
  };
}

function makeStatus(state: UpdateState, patch: Partial<UpdateStatus> = {}): UpdateStatus {
  const next: UpdateStatus = {
    state,
    currentVersion: app.getVersion(),
    channel: updateChannel(),
    feedUrl: currentFeedUrl(),
    updatedAt: now(),
    message: patch.message,
    ...patch,
    ...flagsFor(state),
  };
  return next;
}

function publish(state: UpdateState, patch: Partial<UpdateStatus> = {}) {
  status = makeStatus(state, patch);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:status', status);
  }
  return status;
}

function infoPatch(info?: UpdateInfo | null): Partial<UpdateStatus> {
  if (!info) return {};
  return {
    availableVersion: info.version,
    releaseDate: info.releaseDate,
  };
}

function configureUpdater() {
  if (initialized) return;
  initialized = true;

  if (process.platform !== 'darwin') {
    publish('disabled', {
      message: 'Automatic updates are currently available only for the signed macOS arm64 release.',
    });
    return;
  }

  if (!updatesEnabled()) {
    publish('disabled', {
      message: 'Updates are available only in signed packaged builds.',
    });
    return;
  }

  let channel: string;
  let feedUrl: string;
  try {
    channel = normalizeUpdateChannel(process.env.PLEXUS_UPDATE_CHANNEL);
    feedUrl = normalizeUpdateFeedUrl(process.env.PLEXUS_UPDATE_FEED_URL, {
      allowCustomHttpsFeed: customFeedAllowed(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    publish('disabled', {
      error: message,
      message: 'Update configuration was rejected.',
    });
    return;
  }
  const autoUpdater = getAutoUpdater();

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.channel = channel;
  autoUpdater.allowPrerelease = channel !== DEFAULT_CHANNEL;
  autoUpdater.forceDevUpdateConfig = process.env.PLEXUS_FORCE_UPDATE_CHECK === '1';
  autoUpdater.logger = {
    info: (...args: unknown[]) => console.info('[updates]', ...args),
    warn: (...args: unknown[]) => console.warn('[updates]', ...args),
    error: (...args: unknown[]) => console.error('[updates]', ...args),
  };

  autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl, channel });

  autoUpdater.on('checking-for-update', () => {
    publish('checking', { message: 'Checking update feed.' });
  });

  autoUpdater.on('update-available', (info) => {
    lastUpdateInfo = info;
    publish('available', {
      ...infoPatch(info),
      message: `Version ${info.version} is available.`,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    lastUpdateInfo = info;
    publish('not-available', {
      ...infoPatch(info),
      message: 'Plexus is up to date.',
    });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    publish('downloading', {
      ...infoPatch(lastUpdateInfo),
      percent: progress.percent,
      transferredBytes: progress.transferred,
      totalBytes: progress.total,
      message: `Downloading update ${Math.max(0, Math.min(100, Math.round(progress.percent)))}%.`,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    lastUpdateInfo = info;
    publish('downloaded', {
      ...infoPatch(info),
      percent: 100,
      message: `Version ${info.version} is ready to install.`,
    });
  });

  autoUpdater.on('error', (err) => {
    publish('error', {
      ...infoPatch(lastUpdateInfo),
      error: err.message,
      message: 'Update check failed.',
    });
  });

  publish('idle', {
    message: 'Ready to check for updates.',
  });
}

export function initAutoUpdates(window: BrowserWindow, options: AutoUpdateInitOptions = {}) {
  mainWindow = window;
  beforeInstall = options.beforeInstall;
  configureUpdater();
  return status;
}

export function getUpdateStatus() {
  return status;
}

export async function checkForUpdates() {
  configureUpdater();
  if (!status.canCheck) return status;

  try {
    const result = await getAutoUpdater().checkForUpdates();
    if (result?.updateInfo) {
      lastUpdateInfo = result.updateInfo;
    }
    return status;
  } catch (err: any) {
    return publish('error', {
      ...infoPatch(lastUpdateInfo),
      error: err.message || String(err),
      message: 'Update check failed.',
    });
  }
}

export async function downloadUpdate() {
  configureUpdater();
  if (!status.canDownload) return status;

  publish('downloading', {
    ...infoPatch(lastUpdateInfo),
    percent: 0,
    message: 'Starting update download.',
  });

  try {
    await getAutoUpdater().downloadUpdate();
    return status;
  } catch (err: any) {
    return publish('error', {
      ...infoPatch(lastUpdateInfo),
      error: err.message || String(err),
      message: 'Update download failed.',
    });
  }
}

export async function installUpdateAndRestart() {
  configureUpdater();
  if (!status.canInstall) return status;

  try {
    await beforeInstall?.();
  } catch (err) {
    return publish('downloaded', {
      ...infoPatch(lastUpdateInfo),
      percent: 100,
      error: err instanceof Error ? err.message : String(err),
      message: 'Plexus could not safely prepare to install the update. Resolve the issue and try again.',
    });
  }

  publish('downloaded', {
    ...infoPatch(lastUpdateInfo),
    percent: 100,
    message: 'Installing update and restarting Plexus.',
  });

  setTimeout(() => getAutoUpdater().quitAndInstall(false, true), 250);
  return status;
}
