import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRunningEntry, updateEntry } from '../db/database';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow) {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icons', 'icon_16x16.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  tray.setToolTip('Plexus — Time Tracker');
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
  const timerLabel = running
    ? `⏹ Stop — ${running.description.slice(0, 30)}${running.description.length > 30 ? '...' : ''}`
    : '▶ Start Timer (open app)';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: timerLabel,
      enabled: !!running,
      click: async () => {
        const current = await getRunningEntry();
        if (current) {
          const now = new Date().toISOString();
          const duration = Math.floor((new Date(now).getTime() - new Date(current.startTime).getTime()) / 1000);
          await updateEntry(current.id, { endTime: now, durationSeconds: duration });
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
