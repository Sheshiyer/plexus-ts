import { BrowserWindow, powerMonitor } from 'electron';
import { getRunningEntry, updateEntry } from '../db/database.js';
import { calculateActiveSeconds } from './timer-session.js';

let idleCheckInterval: ReturnType<typeof setInterval> | null = null;
const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function startIdleDetection(mainWindow: BrowserWindow) {
  idleCheckInterval = setInterval(async () => {
    const idleTime = powerMonitor.getSystemIdleTime() * 1000;
    if (idleTime >= IDLE_THRESHOLD_MS) {
      const running = await getRunningEntry();
      if (running && mainWindow && !running.pausedAt) {
        const now = new Date();
        const idleStart = new Date(now.getTime() - idleTime);
        const activeDuration = calculateActiveSeconds(running, idleStart);

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
  if (running.pausedAt) return;

  const now = new Date();
  const idleSeconds = Math.floor(idleMs / 1000);

  if (action === 'discard') {
    const activeEnd = new Date(now.getTime() - idleMs);
    const activeDuration = calculateActiveSeconds(running, activeEnd);
    await updateEntry(entryId, {
      endTime: activeEnd.toISOString(),
      durationSeconds: Math.max(0, activeDuration),
      pausedAt: null,
    });
  } else if (action === 'trim') {
    const activeDuration = calculateActiveSeconds(running, now) - idleSeconds;
    await updateEntry(entryId, {
      endTime: now.toISOString(),
      durationSeconds: Math.max(0, activeDuration),
      pausedAt: null,
    });
  } else {
    // keep - just update end time with full duration
    const duration = calculateActiveSeconds(running, now);
    await updateEntry(entryId, {
      endTime: now.toISOString(),
      durationSeconds: duration,
      pausedAt: null,
    });
  }
}
