import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateFocusNudge, stopFocusNudgeLoop } from '../../src/main/focus-nudge';
import type { AssistantSuggestion } from '../../src/shared/native-assistant';

const electronState = vi.hoisted(() => ({
  notifications: [] as { title: string; body: string; silent: boolean }[],
}));

const databaseState = vi.hoisted(() => ({
  running: null as { pausedAt?: string | null } | null,
  pendingRead: null as Promise<{ pausedAt?: string | null } | null> | null,
  settings: new Map<string, string | null>(),
}));

const trayState = vi.hoisted(() => ({
  states: [] as unknown[],
  writeCalls: 0,
  blockWriteNumber: 0,
  pendingWrite: null as Promise<void> | null,
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
  getRunningEntry: vi.fn(async () => databaseState.pendingRead ?? databaseState.running),
  getSetting: vi.fn(async (key: string) => databaseState.settings.get(key) ?? null),
}));

vi.mock('../../src/main/tray.js', () => ({
  setTrayFocusNudgeState: vi.fn(async (_mainWindow: unknown, state: unknown) => {
    trayState.states.push(state);
    trayState.writeCalls += 1;
    if (trayState.writeCalls === trayState.blockWriteNumber && trayState.pendingWrite) {
      await trayState.pendingWrite;
    }
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
    trayState.writeCalls = 0;
    trayState.blockWriteNumber = 0;
    trayState.pendingWrite = null;
    assistantState.calls = 0;
    assistantState.suggestions = [];
    databaseState.running = { pausedAt: '2026-07-01T11:50:00.000Z' };
    databaseState.pendingRead = null;
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

  it('does not restore tray nudge state after the loop is stopped mid-evaluation', async () => {
    baseSettings(false);
    let resolveRead!: (entry: { pausedAt?: string | null } | null) => void;
    databaseState.pendingRead = new Promise((resolve) => { resolveRead = resolve; });

    const evaluation = evaluateFocusNudge(mainWindow() as never);
    stopFocusNudgeLoop();
    resolveRead({ pausedAt: '2026-07-01T11:50:00.000Z' });
    await evaluation;

    expect(trayState.states).toEqual([]);
  });

  it('does not surface a notification after stopping during the final tray update', async () => {
    baseSettings(false);
    let releaseTrayWrite!: () => void;
    trayState.blockWriteNumber = 2;
    trayState.pendingWrite = new Promise((resolve) => { releaseTrayWrite = resolve; });
    const win = mainWindow();

    const evaluation = evaluateFocusNudge(win as never);
    await vi.waitFor(() => expect(trayState.writeCalls).toBe(2));
    stopFocusNudgeLoop();
    releaseTrayWrite();
    await evaluation;

    expect(electronState.notifications).toEqual([]);
    expect(win.show).not.toHaveBeenCalled();
    expect(win.flashFrame).not.toHaveBeenCalled();
  });
});
