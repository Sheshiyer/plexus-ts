import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRunningEntry } from '../db/database.js';
import { calculateActiveSeconds, stopRunningEntry } from './timer-session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let tray: Tray | null = null;

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
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

export async function updateTrayMenu(mainWindow: BrowserWindow) {
  if (!tray) return;

  const running = await getRunningEntry();
  let timerLabel = 'Open Focus Session';
  let trayTitle = '';

  if (running) {
    const elapsed = calculateActiveSeconds(running);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    const label = running.description.slice(0, 24) + (running.description.length > 24 ? '...' : '');
    timerLabel = `${running.pausedAt ? 'Stop paused' : 'Stop focus'} - ${label}`;
    trayTitle = running.pausedAt ? `II ${timeStr}` : timeStr;
  }

  if (process.platform === 'darwin') {
    tray.setTitle(trayTitle);
  } else {
    tray.setToolTip(trayTitle ? `Plexus - ${trayTitle}` : 'Plexus - Work Coordination');
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: timerLabel,
      enabled: !!running,
      click: async () => {
        const current = await getRunningEntry();
        if (current) {
          await stopRunningEntry();
          mainWindow.webContents.send('timer:tick', { running: false });
          await updateTrayMenu(mainWindow);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Show Plexus',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
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

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
