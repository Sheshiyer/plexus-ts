import { app, BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import type { UpdateStatus, UpdateState } from '../shared/types.js';

const DEFAULT_CHANNEL = 'latest';
const DEFAULT_FEED_URL = 'https://plexus-upgrade.thoughtseed.space/plexus';

let mainWindow: BrowserWindow | null = null;
let initialized = false;
let lastUpdateInfo: UpdateInfo | null = null;
let updater: typeof electronUpdater.autoUpdater | null = null;

let status: UpdateStatus = makeStatus('idle', {
  message: 'Update service has not initialized yet.',
});

function now() {
  return new Date().toISOString();
}

function updateChannel() {
  return process.env.PLEXUS_UPDATE_CHANNEL?.trim() || DEFAULT_CHANNEL;
}

function envFeedUrl() {
  return process.env.PLEXUS_UPDATE_FEED_URL?.trim() || '';
}

function updatesEnabled() {
  return app.isPackaged || process.env.PLEXUS_FORCE_UPDATE_CHECK === '1';
}

function getAutoUpdater() {
  if (!updater) updater = electronUpdater.autoUpdater;
  return updater;
}

function safeGetFeedUrl() {
  try {
    if (!updater) return undefined;
    return updater.getFeedURL() || undefined;
  } catch {
    return undefined;
  }
}

function currentFeedUrl() {
  return envFeedUrl() || safeGetFeedUrl() || DEFAULT_FEED_URL;
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

  if (!updatesEnabled()) {
    publish('disabled', {
      message: 'Updates are available only in signed packaged builds.',
    });
    return;
  }

  const channel = updateChannel();
  const feedUrl = envFeedUrl();
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

  if (feedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl, channel });
  }

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

export function initAutoUpdates(window: BrowserWindow) {
  mainWindow = window;
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

  publish('downloaded', {
    ...infoPatch(lastUpdateInfo),
    percent: 100,
    message: 'Installing update and restarting Plexus.',
  });

  setTimeout(() => getAutoUpdater().quitAndInstall(false, true), 250);
  return status;
}
