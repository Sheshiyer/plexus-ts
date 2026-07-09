import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRunningEntry } from '../db/database.js';
import { calculateActiveSeconds, resumeRunningEntry, stopRunningEntry } from './timer-session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let tray: Tray | null = null;

export interface TrayFocusNudgeState {
  active: boolean;
  idleMinutes?: number;
  intervalMinutes?: number;
  lastNudgedAt?: string;
  reason?: 'standby' | 'paused';
}

let focusNudgeState: TrayFocusNudgeState = { active: false };

function showMainWindow(mainWindow: BrowserWindow) {
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

export function createTray(mainWindow: BrowserWindow) {
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
  updateTrayMenu(mainWindow);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showMainWindow(mainWindow);
    }
  });

  return tray;
}

export async function updateTrayMenu(mainWindow: BrowserWindow) {
  if (!tray) return;

  const running = await getRunningEntry();
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
    tray.setTitle(trayTitle);
  } else {
    tray.setToolTip(trayToolTip);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: timerLabel,
      enabled: !!running || focusNudgeState.active,
      click: async () => {
        const current = await getRunningEntry();
        if (current) {
          if (current.pausedAt) {
            const state = await resumeRunningEntry();
            mainWindow.webContents.send('timer:tick', state);
            await updateTrayMenu(mainWindow);
          } else {
            await stopRunningEntry();
            mainWindow.webContents.send('timer:tick', { running: false });
            await updateTrayMenu(mainWindow);
          }
        } else {
          showMainWindow(mainWindow);
        }
      },
    },
    ...(running?.pausedAt ? [
      {
        label: 'Stop paused Today',
        click: async () => {
          await stopRunningEntry();
          mainWindow.webContents.send('timer:tick', { running: false });
          await updateTrayMenu(mainWindow);
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
        showMainWindow(mainWindow);
      },
    },
    {
      label: 'Hide',
      click: () => {
        mainWindow.hide();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        mainWindow.close();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export async function setTrayFocusNudgeState(mainWindow: BrowserWindow, state: TrayFocusNudgeState) {
  focusNudgeState = state;
  await updateTrayMenu(mainWindow);
}

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
