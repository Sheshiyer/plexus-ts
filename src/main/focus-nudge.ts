import { app, BrowserWindow, Notification } from 'electron';
import { getRunningEntry, getSetting } from '../db/database.js';
import type { AssistantSuggestion } from '../shared/native-assistant.js';
import { buildFocusNudgeAssistantSuggestions } from './assistant-suggestions.js';
import { setTrayFocusNudgeState } from './tray.js';

const CHECK_INTERVAL_MS = 60 * 1000;
const MIN_INTERVAL_MINUTES = 5;
const DEFAULT_INTERVAL_MINUTES = 15;

let nudgeInterval: ReturnType<typeof setInterval> | null = null;
let idleSinceMs: number | null = null;
let lastNudgedAtMs = 0;
let lastTrayIdleMinute = -1;
let showingNotification = false;

interface FocusNudgeSettings {
  intervalMinutes: number;
  notificationsEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  assistantEnabled: boolean;
}

function parseClockMinutes(value: string | null | undefined): number | null {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isQuietTime(now: Date, start: string, end: string): boolean {
  const startMinutes = parseClockMinutes(start);
  const endMinutes = parseClockMinutes(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (startMinutes < endMinutes) return current >= startMinutes && current < endMinutes;
  return current >= startMinutes || current < endMinutes;
}

async function readFocusNudgeSettings(): Promise<FocusNudgeSettings> {
  const rawInterval = Number(await getSetting('reminderIntervalMinutes'));
  return {
    intervalMinutes: Number.isFinite(rawInterval)
      ? Math.max(MIN_INTERVAL_MINUTES, Math.round(rawInterval))
      : DEFAULT_INTERVAL_MINUTES,
    notificationsEnabled: (await getSetting('soundNotificationsEnabled')) !== 'false',
    quietHoursStart: (await getSetting('quietHoursStart')) || '18:00',
    quietHoursEnd: (await getSetting('quietHoursEnd')) || '09:00',
    assistantEnabled: (await getSetting('assistantEnabled')) === 'true',
  };
}

function focusMainWindow(mainWindow: BrowserWindow) {
  if (mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  app.focus({ steal: true });
}

function surfaceMainWindow(mainWindow: BrowserWindow) {
  if (mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
    app.focus({ steal: true });
    return;
  }
  if (!mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }
}

function showFocusNotification(
  mainWindow: BrowserWindow,
  idleMinutes: number,
  reason: 'standby' | 'paused',
  suggestion?: AssistantSuggestion | null,
) {
  if (showingNotification || !Notification.isSupported()) return;
  showingNotification = true;
  const notification = new Notification({
    title: suggestion?.title ?? (reason === 'paused' ? 'Plexus focus paused' : 'Plexus focus standby'),
    body: suggestion?.body ?? (reason === 'paused'
      ? `Focus has been paused for ${idleMinutes} minutes. Resume work capture?`
      : `No active work timer for ${idleMinutes} minutes. Start a repo-backed focus session?`),
    silent: false,
  });
  notification.once('click', () => focusMainWindow(mainWindow));
  notification.once('close', () => {
    showingNotification = false;
  });
  notification.show();
}

async function readFocusNudgeAssistantSuggestion(settings: FocusNudgeSettings, now: Date): Promise<AssistantSuggestion | null> {
  if (!settings.assistantEnabled) return null;
  try {
    const suggestions = await buildFocusNudgeAssistantSuggestions({ now, maxSuggestions: 5 });
    return suggestions.find((suggestion) => suggestion.safety === 'read_only') ?? null;
  } catch (err) {
    console.warn('[focus-nudge] assistant suggestions unavailable', err);
    return null;
  }
}

export async function evaluateFocusNudge(mainWindow: BrowserWindow) {
  if (mainWindow.isDestroyed()) return;

  const running = await getRunningEntry();
  if (running && !running.pausedAt) {
    idleSinceMs = null;
    lastNudgedAtMs = 0;
    lastTrayIdleMinute = -1;
    await setTrayFocusNudgeState(mainWindow, { active: false });
    return;
  }

  const now = new Date();
  const nowMs = now.getTime();
  const reason = running?.pausedAt ? 'paused' : 'standby';
  if (!idleSinceMs) idleSinceMs = running?.pausedAt ? new Date(running.pausedAt).getTime() : nowMs;

  const settings = await readFocusNudgeSettings();
  const idleMinutes = Math.max(0, Math.floor((nowMs - idleSinceMs) / 60000));
  const dueMs = settings.intervalMinutes * 60 * 1000;
  const due = nowMs - idleSinceMs >= dueMs && nowMs - lastNudgedAtMs >= dueMs;

  if (idleMinutes !== lastTrayIdleMinute) {
    lastTrayIdleMinute = idleMinutes;
    await setTrayFocusNudgeState(mainWindow, {
      active: idleMinutes >= settings.intervalMinutes,
      idleMinutes,
      intervalMinutes: settings.intervalMinutes,
      reason,
    });
  }

  if (!due) return;
  lastNudgedAtMs = nowMs;
  const assistantSuggestion = await readFocusNudgeAssistantSuggestion(settings, now);
  await setTrayFocusNudgeState(mainWindow, {
    active: true,
    idleMinutes,
    intervalMinutes: settings.intervalMinutes,
    lastNudgedAt: now.toISOString(),
    reason,
  });

  surfaceMainWindow(mainWindow);
  if (settings.notificationsEnabled && !isQuietTime(now, settings.quietHoursStart, settings.quietHoursEnd)) {
    showFocusNotification(mainWindow, idleMinutes, reason, assistantSuggestion);
  }
}

export function startFocusNudgeLoop(mainWindow: BrowserWindow) {
  if (nudgeInterval) return;
  void evaluateFocusNudge(mainWindow);
  nudgeInterval = setInterval(() => {
    void evaluateFocusNudge(mainWindow).catch((err) => {
      console.warn('[focus-nudge] evaluation failed', err);
    });
  }, CHECK_INTERVAL_MS);
}

export function stopFocusNudgeLoop() {
  if (nudgeInterval) {
    clearInterval(nudgeInterval);
    nudgeInterval = null;
  }
  idleSinceMs = null;
  lastNudgedAtMs = 0;
  lastTrayIdleMinute = -1;
  showingNotification = false;
}
