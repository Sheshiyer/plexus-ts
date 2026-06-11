import { BrowserWindow, Notification } from 'electron';
import { getSetting } from '../db/database';
import { syncToPaperclip } from '../bridge/paperclip';
import { pushToMultiCA } from '../bridge/multica';

export async function autoSyncOnStop(mainWindow: BrowserWindow) {
  const syncEnabled = (await getSetting('syncEnabled')) === 'true';
  if (!syncEnabled) return;

  const memberId = (await getSetting('memberId')) || 'anonymous';
  const month = new Date().toISOString().slice(0, 7);
  const messages: string[] = [];

  // Paperclip
  const paperclipPath = (await getSetting('paperclipPath')) || '';
  if (paperclipPath) {
    try {
      const { listEntries } = await import('../db/database');
      const entries = await listEntries(`${month}-01T00:00:00.000Z`, `${month}-31T23:59:59.999Z`);
      const result = await syncToPaperclip(memberId, paperclipPath, entries, month);
      messages.push(result.message);
    } catch (e: any) {
      messages.push(`Paperclip: ${e.message}`);
    }
  }

  // MultiCA
  const multicaApiUrl = (await getSetting('multicaApiUrl')) || '';
  const multicaToken = (await getSetting('multicaToken')) || '';
  if (multicaApiUrl && multicaToken) {
    try {
      const { listEntries } = await import('../db/database');
      const entries = await listEntries(`${month}-01T00:00:00.000Z`, `${month}-31T23:59:59.999Z`);
      const result = await pushToMultiCA(multicaApiUrl, multicaToken, memberId, entries, month);
      messages.push(result.message);
    } catch (e: any) {
      messages.push(`MultiCA: ${e.message}`);
    }
  }

  if (messages.length > 0) {
    new Notification({
      title: 'Plexus Auto-Sync',
      body: messages.join(' · '),
      silent: true,
    }).show();
    mainWindow.webContents.send('bridge:status', { connected: true, lastSync: new Date().toISOString() });
  }
}
