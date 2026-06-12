import { BrowserWindow, powerMonitor, dialog } from 'electron';
import { getRunningEntry, updateEntry } from '../db/database.js';

let idleCheckInterval: ReturnType<typeof setInterval> | null = null;
const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function startIdleDetection(mainWindow: BrowserWindow) {
  idleCheckInterval = setInterval(async () => {
    const idleTime = powerMonitor.getSystemIdleTime() * 1000;
    if (idleTime >= IDLE_THRESHOLD_MS) {
      const running = await getRunningEntry();
      if (running && mainWindow) {
        const now = new Date();
        const idleStart = new Date(now.getTime() - idleTime);
        const activeDuration = Math.floor((idleStart.getTime() - new Date(running.startTime).getTime()) / 1000);

        mainWindow.webContents.send('idle:detected', {
          idleDuration: idleTime,
          activeDuration,
          entryId: running.id,
        });
      }
    }
  }, 30000); // Check every 30 seconds
}

export function stopIdleDetection() {
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }
}

export async function handleIdleAction(entryId: string, action: 'keep' | 'discard' | 'trim', idleMs: number) {
  const running = await getRunningEntry();
  if (!running || running.id !== entryId) return;

  const now = new Date();
  const idleSeconds = Math.floor(idleMs / 1000);

  if (action === 'discard') {
    const activeEnd = new Date(now.getTime() - idleMs);
    const activeDuration = Math.floor((activeEnd.getTime() - new Date(running.startTime).getTime()) / 1000);
    await updateEntry(entryId, {
      endTime: activeEnd.toISOString(),
      durationSeconds: Math.max(0, activeDuration),
    });
  } else if (action === 'trim') {
    const activeDuration = Math.floor((now.getTime() - new Date(running.startTime).getTime()) / 1000) - idleSeconds;
    await updateEntry(entryId, {
      endTime: now.toISOString(),
      durationSeconds: Math.max(0, activeDuration),
    });
  } else {
    // keep - just update end time with full duration
    const duration = Math.floor((now.getTime() - new Date(running.startTime).getTime()) / 1000);
    await updateEntry(entryId, {
      endTime: now.toISOString(),
      durationSeconds: duration,
    });
  }
}
