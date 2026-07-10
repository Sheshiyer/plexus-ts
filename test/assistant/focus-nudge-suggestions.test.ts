import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateFocusNudge, stopFocusNudgeLoop } from '../../src/main/focus-nudge';
import type { AssistantSuggestion } from '../../src/shared/native-assistant';

const electronState = vi.hoisted(() => ({
  notifications: [] as { title: string; body: string; silent: boolean }[],
}));

const databaseState = vi.hoisted(() => ({
  running: null as { pausedAt?: string | null } | null,
  settings: new Map<string, string | null>(),
}));

const trayState = vi.hoisted(() => ({
  states: [] as unknown[],
}));

const assistantState = vi.hoisted(() => ({
  calls: 0,
  suggestions: [] as AssistantSuggestion[],
}));

vi.mock('electron', () => {
  class MockNotification {
    constructor(private readonly options: { title: string; body: string; silent: boolean }) {}

    once() {
      return this;
    }

    show() {
      electronState.notifications.push(this.options);
    }

    static isSupported() {
      return true;
    }
  }

  return {
    app: { focus: vi.fn() },
    BrowserWindow: class MockBrowserWindow {},
    Notification: MockNotification,
  };
});

vi.mock('../../src/db/database.js', () => ({
  getRunningEntry: vi.fn(async () => databaseState.running),
  getSetting: vi.fn(async (key: string) => databaseState.settings.get(key) ?? null),
}));

vi.mock('../../src/main/tray.js', () => ({
  setTrayFocusNudgeState: vi.fn(async (_mainWindow: unknown, state: unknown) => {
    trayState.states.push(state);
  }),
}));

vi.mock('../../src/main/assistant-suggestions.js', () => ({
  buildFocusNudgeAssistantSuggestions: vi.fn(async () => {
    assistantState.calls += 1;
    return assistantState.suggestions;
  }),
}));

function mainWindow() {
  return {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    isFocused: vi.fn(() => true),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    flashFrame: vi.fn(),
  };
}

function baseSettings(assistantEnabled: boolean) {
  databaseState.settings = new Map([
    ['reminderIntervalMinutes', '5'],
    ['soundNotificationsEnabled', 'true'],
    ['quietHoursStart', '00:00'],
    ['quietHoursEnd', '00:00'],
    ['assistantEnabled', String(assistantEnabled)],
  ]);
}

describe('focus nudge assistant suggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-07-01T12:00:00.000Z') });
    stopFocusNudgeLoop();
    electronState.notifications = [];
    trayState.states = [];
    assistantState.calls = 0;
    assistantState.suggestions = [];
    databaseState.running = { pausedAt: '2026-07-01T11:50:00.000Z' };
  });

  afterEach(() => {
    stopFocusNudgeLoop();
    vi.useRealTimers();
  });

  it('uses read-only offline assistant suggestions when assistant nudges are enabled', async () => {
    baseSettings(true);
    assistantState.suggestions = [{
      id: 'proof_gap',
      type: 'missing_proof',
      title: 'Repair missing proof',
      body: 'A work entry still needs evidence review for 2026-07-01.',
      confidence: 0.95,
      safety: 'read_only',
      critical: true,
      dedupeKey: 'missing_proof:project_missing:2026-07-01',
    }];

    await evaluateFocusNudge(mainWindow() as never);

    expect(assistantState.calls).toBe(1);
    expect(electronState.notifications[0]).toMatchObject({
      title: 'Repair missing proof',
      body: 'A work entry still needs evidence review for 2026-07-01.',
    });
    expect(trayState.states.at(-1)).toMatchObject({ active: true, reason: 'paused' });
  });

  it('keeps existing focus nudge behavior when assistant is disabled', async () => {
    baseSettings(false);
    assistantState.suggestions = [{
      id: 'proof_gap',
      type: 'missing_proof',
      title: 'Repair missing proof',
      body: 'This should not be used.',
      confidence: 0.95,
      safety: 'read_only',
      dedupeKey: 'missing_proof:project_missing:2026-07-01',
    }];

    await evaluateFocusNudge(mainWindow() as never);

    expect(assistantState.calls).toBe(0);
    expect(electronState.notifications[0]).toMatchObject({
      title: 'Plexus Today paused',
      body: 'Today has been paused for 10 minutes. Resume work capture?',
    });
  });

  it('surfaces the missing-standup suggestion through the existing periodic focus nudge', async () => {
    baseSettings(true);
    assistantState.suggestions = [
      {
        id: 'generic_confirm',
        type: 'check_settings',
        title: 'Open settings',
        body: 'Generic confirm-required suggestion.',
        confidence: 0.99,
        safety: 'confirm_required',
        dedupeKey: 'check_settings',
      },
      {
        id: 'standup_2026-07-01',
        type: 'standup',
        title: 'Prepare daily proof',
        body: 'Persisted standup evidence is still missing for today.',
        confidence: 0.9,
        safety: 'confirm_required',
        date: '2026-07-01',
        dedupeKey: 'standup:2026-07-01',
        intent: {
          toolId: 'app.generateStandup',
          title: 'Generate standup proof',
          payload: { date: '2026-07-01' },
        },
      },
    ];

    await evaluateFocusNudge(mainWindow() as never);

    expect(electronState.notifications[0]).toMatchObject({
      title: 'Prepare daily proof',
      body: 'Persisted standup evidence is still missing for today.',
    });
  });

  it('does not surface an unrelated confirm-required suggestion', async () => {
    baseSettings(true);
    assistantState.suggestions = [{
      id: 'generic_confirm',
      type: 'check_settings',
      title: 'Open settings',
      body: 'Generic confirm-required suggestion.',
      confidence: 0.99,
      safety: 'confirm_required',
      dedupeKey: 'check_settings',
    }];

    await evaluateFocusNudge(mainWindow() as never);

    expect(electronState.notifications[0]).toMatchObject({
      title: 'Plexus Today paused',
      body: 'Today has been paused for 10 minutes. Resume work capture?',
    });
  });
});
