import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRunningEntry, updateEntry } from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow) {
  // "Template" suffix → macOS treats it as a template image (auto dark/light menubar adaptation).
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icons', 'trayTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

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
  let timerLabel = '▶ Start Timer (open app)';
  let trayTitle = '';

  if (running) {
    const elapsed = Math.floor((Date.now() - new Date(running.startTime).getTime()) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    timerLabel = `⏹ Stop — ${running.description.slice(0, 24)}${running.description.length > 24 ? '...' : ''}`;
    trayTitle = timeStr;
  }

  if (process.platform === 'darwin') {
    tray.setTitle(trayTitle);
  } else {
    tray.setToolTip(trayTitle ? `Plexus — ${trayTitle}` : 'Plexus — Time Tracker');
  }

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
