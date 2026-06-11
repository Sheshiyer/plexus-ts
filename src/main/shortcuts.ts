import { globalShortcut, BrowserWindow } from 'electron';
import { getRunningEntry, updateEntry } from '../db/database.js';
import { randomUUID } from 'node:crypto';
import type { TimeEntry } from '../shared/types.js';

export function registerShortcuts(mainWindow: BrowserWindow) {
  // Toggle timer: Cmd/Ctrl+Shift+P
  globalShortcut.register('CommandOrControl+Shift+P', async () => {
    const running = await getRunningEntry();
    if (running) {
      const now = new Date().toISOString();
      const duration = Math.floor((new Date(now).getTime() - new Date(running.startTime).getTime()) / 1000);
      await updateEntry(running.id, { endTime: now, durationSeconds: duration });
      mainWindow.webContents.send('timer:tick', { running: false });
    } else {
      // Start timer with default project - we'll just open the app
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('shortcut:start-timer');
    }
  });

  // Show/hide app: Cmd/Ctrl+Shift+O
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
