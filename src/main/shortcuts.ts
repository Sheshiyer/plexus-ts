import { globalShortcut, BrowserWindow } from 'electron';

export function registerShortcuts(mainWindow: BrowserWindow, stopRunningTimer: () => Promise<unknown | null>) {
  // Toggle timer: Cmd/Ctrl+Shift+P
  globalShortcut.register('CommandOrControl+Shift+P', async () => {
    const stopped = await stopRunningTimer();
    if (stopped) {
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
