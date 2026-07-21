import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRunningEntry } from '../db/database.js';
import { calculateActiveSeconds } from './timer-session.js';
import type { TimerState } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let tray: Tray | null = null;
let getMainWindow: (() => BrowserWindow | null) | null = null;
let getOrCreateMainWindow: (() => BrowserWindow | null) | null = null;
let stopRunningTimer: (() => Promise<unknown>) | null = null;
let resumePausedTimer: (() => Promise<TimerState>) | null = null;

export interface TrayWindowController {
  getWindow: () => BrowserWindow | null;
  getOrCreateWindow: () => BrowserWindow | null;
  stopRunningTimer?: () => Promise<unknown>;
  resumePausedTimer?: () => Promise<TimerState>;
}

export interface TrayFocusNudgeState {
  active: boolean;
  idleMinutes?: number;
  intervalMinutes?: number;
  lastNudgedAt?: string;
  reason?: 'standby' | 'paused';
}

let focusNudgeState: TrayFocusNudgeState = { active: false };

function refreshTrayMenuInBackground(): void {
  void updateTrayMenu().catch((err) => {
    console.warn('[tray] background menu refresh failed', err);
  });
}

function currentMainWindow(createIfMissing = false): BrowserWindow | null {
  const provider = createIfMissing ? getOrCreateMainWindow : getMainWindow;
  const mainWindow = provider?.() ?? null;
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  return mainWindow;
}

function showMainWindow() {
  const mainWindow = currentMainWindow(true);
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

export function createTray(windowSource: BrowserWindow | (() => BrowserWindow | null) | TrayWindowController) {
  if (typeof windowSource === 'function') {
    getMainWindow = windowSource;
    getOrCreateMainWindow = windowSource;
    stopRunningTimer = null;
    resumePausedTimer = null;
  } else if ('getWindow' in windowSource) {
    getMainWindow = windowSource.getWindow;
    getOrCreateMainWindow = windowSource.getOrCreateWindow;
    stopRunningTimer = windowSource.stopRunningTimer ?? null;
    resumePausedTimer = windowSource.resumePausedTimer ?? null;
  } else {
    getMainWindow = () => windowSource;
    getOrCreateMainWindow = () => windowSource;
    stopRunningTimer = null;
    resumePausedTimer = null;
  }

  if (tray) {
    refreshTrayMenuInBackground();
    return tray;
  }

  // The "Template" suffix usually triggers macOS template-image rendering, but
  // auto-detection is unreliable when the path is a virtual asar path. We
  // mirror the icon as a real filesystem file via electron-builder asarUnpack
  // (see package.json build.asarUnpack) AND call setTemplateImage(true)
  // explicitly so neither layer is load-bearing on its own.
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icons', 'trayTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.error('[tray] Tray icon failed to load — empty nativeImage. iconPath=', iconPath);
    return null;
  }
  icon.setTemplateImage(true);

  try {
    tray = new Tray(icon);
  } catch (err) {
    console.error('[tray] new Tray(icon) threw:', err);
    return null;
  }

  tray.setToolTip('Plexus - Work Coordination');
  refreshTrayMenuInBackground();

  tray.on('click', () => {
    const mainWindow = currentMainWindow();
    if (!mainWindow) {
      showMainWindow();
      return;
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
  });

  return tray;
}

export async function updateTrayMenu(_mainWindow?: BrowserWindow) {
  const activeTray = tray;
  if (!activeTray) return;

  const running = await getRunningEntry();
  if (tray !== activeTray || activeTray.isDestroyed()) return;
  let timerLabel = 'Open Clio Today';
  let trayTitle = '';
  let trayToolTip = 'Plexus - Work Coordination';

  if (running) {
    const elapsed = calculateActiveSeconds(running);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    const label = running.description.slice(0, 24) + (running.description.length > 24 ? '...' : '');
    timerLabel = `${running.pausedAt ? 'Resume paused Today' : 'Stop Today'} - ${label}`;
    trayTitle = running.pausedAt ? `II ${timeStr}` : timeStr;
    trayToolTip = `Plexus - ${trayTitle}`;
    if (running.pausedAt && focusNudgeState.active) {
      const idle = focusNudgeState.idleMinutes ?? focusNudgeState.intervalMinutes ?? 0;
      timerLabel = `Resume Today - paused ${idle}m`;
      trayTitle = 'PAUSE';
      trayToolTip = `Plexus - paused ${idle}m`;
    }
  } else if (focusNudgeState.active) {
    const idle = focusNudgeState.idleMinutes ?? focusNudgeState.intervalMinutes ?? 0;
    timerLabel = `Start Today session - idle ${idle}m`;
    trayTitle = 'START';
    trayToolTip = `Plexus - Today standby ${idle}m`;
  }

  if (process.platform === 'darwin') {
    activeTray.setTitle(trayTitle);
  } else {
    activeTray.setToolTip(trayToolTip);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: timerLabel,
      enabled: true,
      click: async () => {
        const current = await getRunningEntry();
        if (current) {
          if (current.pausedAt) {
            if (!resumePausedTimer) return;
            const state = await resumePausedTimer();
            currentMainWindow()?.webContents.send('timer:tick', state);
            await updateTrayMenu();
          } else {
            if (!stopRunningTimer) return;
            await stopRunningTimer();
          }
        } else {
          showMainWindow();
        }
      },
    },
    ...(running?.pausedAt ? [
      {
        label: 'Stop paused Today',
        click: async () => {
          if (!stopRunningTimer) return;
          await stopRunningTimer();
        },
      },
    ] : []),
    ...(!running && focusNudgeState.active ? [
      {
        label: `No active timer for ${focusNudgeState.idleMinutes ?? focusNudgeState.intervalMinutes ?? 0} minutes`,
        enabled: false,
      },
      { type: 'separator' as const },
    ] : []),
    ...(running?.pausedAt && focusNudgeState.active ? [
      {
        label: `Today paused for ${focusNudgeState.idleMinutes ?? focusNudgeState.intervalMinutes ?? 0} minutes`,
        enabled: false,
      },
      { type: 'separator' as const },
    ] : []),
    { type: 'separator' },
    {
      label: 'Show Plexus',
      click: () => {
        showMainWindow();
      },
    },
    {
      label: 'Hide',
      click: () => {
        currentMainWindow()?.hide();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  if (tray === activeTray && !activeTray.isDestroyed()) activeTray.setContextMenu(contextMenu);
}

export async function setTrayFocusNudgeState(mainWindow: BrowserWindow, state: TrayFocusNudgeState) {
  focusNudgeState = state;
  await updateTrayMenu(mainWindow);
}

export function clearTrayFocusNudgeState(): void {
  focusNudgeState = { active: false };
  refreshTrayMenuInBackground();
}

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  getMainWindow = null;
  getOrCreateMainWindow = null;
  stopRunningTimer = null;
  resumePausedTimer = null;
  focusNudgeState = { active: false };
}
