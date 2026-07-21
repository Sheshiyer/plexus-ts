import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { TimeEntry, TimerState } from '../../src/shared/types';
import { completedTodaySeconds, displayedTodaySeconds } from '../../src/renderer/today-total';

const electronState = vi.hoisted(() => ({
  trays: [] as Array<{
    title: string;
    tooltip: string;
    menu: unknown[] | null;
    handlers: Record<string, () => void>;
    destroy: ReturnType<typeof vi.fn>;
    isDestroyed: () => boolean;
    setContextMenu: ReturnType<typeof vi.fn>;
  }>,
  appQuit: vi.fn(),
  iconEmpty: false,
  menuTemplate: null as unknown[] | null,
}));

const databaseState = vi.hoisted(() => ({
  running: null as null | TimeEntry,
  activeSeconds: 0,
  pendingRead: null as Promise<TimeEntry | null> | null,
}));

const timerActions = vi.hoisted(() => ({
  stop: vi.fn(async () => databaseState.running),
  resume: vi.fn(async () => ({ running: true, paused: false, activeSeconds: databaseState.activeSeconds })),
}));

vi.mock('electron', () => {
  class MockTray {
    title = '';
    tooltip = '';
    menu: unknown[] | null = null;
    handlers: Record<string, () => void> = {};
    destroyed = false;
    destroy = vi.fn(() => { this.destroyed = true; });
    setTitle = vi.fn((value: string) => { this.title = value; });
    setToolTip = vi.fn((value: string) => { this.tooltip = value; });
    setContextMenu = vi.fn((value: unknown[]) => { this.menu = value; });

    constructor() {
      electronState.trays.push(this);
    }

    on(event: string, handler: () => void) { this.handlers[event] = handler; }
    isDestroyed() { return this.destroyed; }
  }

  return {
    app: { quit: electronState.appQuit },
    BrowserWindow: class MockBrowserWindow {},
    Tray: MockTray,
    Menu: {
      buildFromTemplate: vi.fn((template: unknown[]) => {
        electronState.menuTemplate = template;
        return template;
      }),
    },
    nativeImage: {
      createFromPath: vi.fn(() => ({
        isEmpty: () => electronState.iconEmpty,
        setTemplateImage: vi.fn(),
      })),
    },
  };
});

vi.mock('../../src/db/database.js', () => ({
  getRunningEntry: vi.fn(async () => databaseState.pendingRead ?? databaseState.running),
}));

vi.mock('../../src/main/timer-session.js', () => ({
  calculateActiveSeconds: vi.fn(() => databaseState.activeSeconds),
  stopRunningEntry: timerActions.stop,
  resumeRunningEntry: timerActions.resume,
}));

import {
  clearTrayFocusNudgeState,
  createTray,
  destroyTray,
  setTrayFocusNudgeState,
  updateTrayMenu,
} from '../../src/main/tray';

type MenuItem = {
  label?: string;
  enabled?: boolean;
  type?: string;
  click?: () => void | Promise<void>;
};

function entry(id: string, durationSeconds: number): TimeEntry {
  return {
    id,
    projectId: 'project-1',
    description: id,
    startTime: '2026-07-21T06:00:00.000Z',
    endTime: null,
    durationSeconds,
    tags: [],
    source: 'timer',
  };
}

function windowDouble(visible = true) {
  return {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    isVisible: vi.fn(() => visible),
    restore: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    close: vi.fn(),
    webContents: { send: vi.fn() },
  };
}

function menuItems(): MenuItem[] {
  return (electronState.menuTemplate ?? []) as MenuItem[];
}

function item(label: string): MenuItem {
  const found = menuItems().find((candidate) => candidate.label === label);
  if (!found) throw new Error(`Missing tray item: ${label}`);
  return found;
}

async function renderMenu(getWindow: () => ReturnType<typeof windowDouble>) {
  createTray(getWindow as never);
  await updateTrayMenu();
}

describe('sidebar live-total contract', () => {
  it('adds authoritative active seconds to completed entries', () => {
    const timer: TimerState = { running: true, entryId: 'active', activeSeconds: 122 };
    const entries = [entry('completed', 300), entry('active', 0)];

    expect(completedTodaySeconds(entries, timer)).toBe(300);
    expect(displayedTodaySeconds(300, timer)).toBe(422);
  });

  it('does not double-count the persisted duration of a paused entry', () => {
    const timer: TimerState = { running: true, paused: true, entryId: 'active', activeSeconds: 120 };
    const entries = [entry('completed', 300), entry('active', 120)];

    expect(completedTodaySeconds(entries, timer)).toBe(300);
    expect(displayedTodaySeconds(300, timer)).toBe(420);
  });

  it('advances with running ticks, freezes while paused, and settles after stop', () => {
    const running: TimerState = { running: true, entryId: 'active', activeSeconds: 120 };
    const fiveSecondsLater: TimerState = { ...running, activeSeconds: 125 };
    const paused: TimerState = { ...fiveSecondsLater, paused: true };
    const stopped: TimerState = { running: false };

    expect(displayedTodaySeconds(300, fiveSecondsLater) - displayedTodaySeconds(300, running)).toBe(5);
    expect(displayedTodaySeconds(300, paused)).toBe(displayedTodaySeconds(300, fiveSecondsLater));
    expect(displayedTodaySeconds(completedTodaySeconds([entry('completed', 300), entry('active', 125)], stopped), stopped)).toBe(425);
  });

  it('fails safe for invalid or negative persisted seconds', () => {
    const timer: TimerState = { running: true, entryId: 'active', activeSeconds: Number.NaN };
    const invalidEntry = entry('completed', Number.POSITIVE_INFINITY);

    expect(completedTodaySeconds([invalidEntry], timer)).toBe(0);
    expect(displayedTodaySeconds(-10, timer)).toBe(0);
  });

  it('renders the shared total projection in the sidebar', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/renderer/App.tsx'), 'utf8');

    expect(source).toContain('completedTodaySeconds(snapshot.entries, snapshot.timer.raw)');
    expect(source).toContain('displayedTodaySeconds(todayCompletedSeconds, timerState)');
    expect(source).toContain('entriesLoadSequenceRef');
    expect(source).toContain('loadSequence === entriesLoadSequenceRef.current');
    expect(source).toContain('{fmtHMS(todayTotal)}');
  });
});

describe('macOS app/tray lifecycle contract', () => {
  it('keeps app-level services alive when only the last window closes', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/main/main.ts'), 'utf8');
    const traySource = readFileSync(path.resolve(process.cwd(), 'src/main/tray.ts'), 'utf8');
    const shortcutSource = readFileSync(path.resolve(process.cwd(), 'src/main/shortcuts.ts'), 'utf8');
    const windowClosed = source.slice(
      source.indexOf("app.on('window-all-closed'"),
      source.indexOf("let quitReady"),
    );

    expect(windowClosed).not.toContain('destroyTray()');
    expect(windowClosed).not.toContain('clearInterval(timerInterval)');
    expect(windowClosed).toContain("process.platform !== 'darwin'");
    expect(source).toContain("app.on('will-quit'");
    expect(source).toContain('getOrCreateMainWindow');
    expect(source).toContain('function startWindowServices');
    expect(source).toContain('function stopWindowServices');
    expect(source).toMatch(/mainWindow\.on\('closed',[\s\S]*stopWindowServices\(\)/);

    const activate = source.slice(source.indexOf("app.on('activate'"), source.indexOf("}).catch((err)"));
    expect(activate).toContain('if (appShuttingDown) return;');
    expect(activate).toContain('getOrCreateMainWindow()');

    const beforeQuit = source.slice(source.indexOf("app.on('before-quit'"), source.indexOf("app.on('will-quit'"));
    expect(beforeQuit).toContain('event.preventDefault()');
    expect(beforeQuit).toContain('stopTimerSession({ emitSideEffects: false })');
    expect(beforeQuit).toContain('stopTimerTicker()');
    expect(beforeQuit).toContain('waitForTimerTickerIdle()');
    expect(beforeQuit).toContain('stopApiServer()');
    expect(beforeQuit).toContain('waitForStartupSettled()');
    expect(beforeQuit).toContain('beginDbShutdown()');
    expect(beforeQuit).toContain('closeDb()');
    expect(beforeQuit).toContain('settleShutdownPipeline');
    expect(beforeQuit).toContain("databaseCloseResult.status !== 'settled'");
    expect(beforeQuit).not.toContain('settleShutdownTask(stopRunningEntry()');
    expect(beforeQuit).toContain('disconnectCoworkingPresenceNow()');
    expect(beforeQuit).toContain('settleShutdownPipeline');
    expect(beforeQuit).toContain('SHUTDOWN_TASK_TIMEOUT_MS');
    expect(beforeQuit).toContain('appShuttingDown = true');
    expect(beforeQuit).toContain('destroyTray()');
    expect(beforeQuit).toContain('stopWindowServices()');
    expect(beforeQuit).toContain('app.quit()');

    expect(source).toContain('stopRunningTimer: stopTimerSession');
    expect(source).toContain('resumePausedTimer: resumeTimerSession');
    expect(source).toContain('registerShortcuts(window, stopTimerSession)');
    expect(source).toMatch(/beforeInstall:[\s\S]*stopTimerSession\(\)/);
    expect(source).toMatch(/async function stopTimerSession[\s\S]*flushTimeEntries[\s\S]*prepareTimerStopUsageSignal/);
    expect(source).toMatch(/timer:start[\s\S]*runTimerMutation[\s\S]*if \(appShuttingDown\)/);
    expect(source).toMatch(/function pauseTimerSession[\s\S]*runTimerMutation[\s\S]*pauseRunningEntry/);
    expect(source).toMatch(/function resumeTimerSession[\s\S]*runTimerMutation[\s\S]*resumeRunningEntry/);
    expect(source).toMatch(/idle:action[\s\S]*runTimerMutation[\s\S]*handleIdleAction/);
    expect(source).toContain('executeAssistantTool(toolId, payload, {}, { startTimer: startTimerSession })');
    expect(source).toMatch(/confirmAssistantIntent\(intentId\.trim\(\),[\s\S]*startTimer: startTimerSession/);
    expect(traySource).not.toContain('stopRunningEntry');
    expect(traySource).not.toContain('resumeRunningEntry');
    expect(shortcutSource).not.toContain('stopRunningEntry');
    expect(source).toContain('timerTickInFlight');
    expect(source).toContain('timerTickTask');
    expect(source).toContain('function stopTimerTicker()');
    expect(source).toContain('if (appShuttingDown) throw new Error');
    expect(source).toContain('function stopBackgroundFlushLoops()');
    expect(source).toContain('const startupGate = new StartupGate()');
    expect(source).toContain('startupTask = app.whenReady()');
    expect(source).toContain('startupGate.runStep');
    expect(source).toMatch(/catch\(\(err\) => \{[\s\S]*if \(appShuttingDown/);
    const startupLifecycle = source.slice(
      source.indexOf('startupTask = app.whenReady()'),
      source.indexOf("app.on('window-all-closed'"),
    );
    const startupFailure = startupLifecycle.slice(
      startupLifecycle.indexOf('}).catch((err) => {'),
      startupLifecycle.indexOf('}).finally(() => {'),
    );
    expect(startupFailure).toContain('process.exitCode = 1');
    expect(startupFailure).toContain('app.quit()');
    expect(startupFailure).not.toContain('app.exit(1)');
  });
});

describe('tray menu action contract', () => {
  beforeEach(() => {
    destroyTray();
    electronState.trays = [];
    electronState.menuTemplate = null;
    electronState.appQuit.mockClear();
    electronState.iconEmpty = false;
    timerActions.stop.mockClear();
    timerActions.resume.mockClear();
    databaseState.running = null;
    databaseState.activeSeconds = 0;
    databaseState.pendingRead = null;
  });

  afterEach(() => {
    destroyTray();
  });

  it('creates one tray instance even when initialization is requested twice', () => {
    const win = windowDouble();
    createTray((() => win) as never);
    createTray((() => win) as never);

    expect(electronState.trays).toHaveLength(1);
  });

  it('reports an empty tray icon instead of creating a broken menu-bar item', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    electronState.iconEmpty = true;

    expect(createTray((() => windowDouble()) as never)).toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Tray icon failed to load'), expect.any(String));
    expect(electronState.trays).toHaveLength(0);
    error.mockRestore();
  });

  it('handles a rejected background menu refresh', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    databaseState.pendingRead = Promise.reject(new Error('database unavailable'));

    createTray((() => windowDouble()) as never);
    await vi.waitFor(() => expect(warning).toHaveBeenCalledWith(
      '[tray] background menu refresh failed',
      expect.any(Error),
    ));
    warning.mockRestore();
  });

  it('enables the idle primary action and opens a lazily resolved window', async () => {
    const win = windowDouble(false);
    await renderMenu(() => win);
    const primary = item('Open Clio Today');

    expect(primary.enabled).toBe(true);
    await primary.click?.();
    expect(win.show).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);
  });

  it('routes a running tray stop through the canonical timer-stop workflow exactly once', async () => {
    const win = windowDouble();
    const canonicalStop = vi.fn(async () => null);
    databaseState.running = { ...entry('entry-1', 0), description: 'Active work' };
    databaseState.activeSeconds = 122;
    createTray({
      getWindow: () => win,
      getOrCreateWindow: () => win,
      stopRunningTimer: canonicalStop,
    } as never);
    await updateTrayMenu();

    await item('Stop Today - Active work').click?.();
    expect(canonicalStop).toHaveBeenCalledTimes(1);
    expect(timerActions.stop).not.toHaveBeenCalled();
  });

  it('renders the authoritative running time in the macOS tray title', async () => {
    databaseState.running = { ...entry('entry-1', 0), description: 'Active work' };
    databaseState.activeSeconds = 122;
    await renderMenu(() => windowDouble());

    expect(electronState.trays[0]?.title).toBe('00:02:02');
  });

  it('resumes or stops a paused Today session through explicit actions', async () => {
    const win = windowDouble();
    const canonicalStop = vi.fn(async () => null);
    const canonicalResume = vi.fn(async () => ({
      running: true,
      paused: false,
      activeSeconds: databaseState.activeSeconds,
    }));
    databaseState.running = {
      ...entry('entry-2', 120),
      description: 'Paused work',
      pausedAt: '2026-07-21T06:02:00.000Z',
      pausedSeconds: 10,
    };
    databaseState.activeSeconds = 120;
    createTray({
      getWindow: () => win,
      getOrCreateWindow: () => win,
      stopRunningTimer: canonicalStop,
      resumePausedTimer: canonicalResume,
    } as never);
    await updateTrayMenu();

    await item('Resume paused Today - Paused work').click?.();
    expect(canonicalResume).toHaveBeenCalledTimes(1);
    expect(timerActions.resume).not.toHaveBeenCalled();

    await item('Stop paused Today').click?.();
    expect(canonicalStop).toHaveBeenCalledTimes(1);
    expect(timerActions.stop).not.toHaveBeenCalled();
  });

  it('links Show Plexus, Hide, and Quit to their named application actions', async () => {
    const win = windowDouble(false);
    await renderMenu(() => win);

    await item('Show Plexus').click?.();
    await item('Hide').click?.();
    await item('Quit').click?.();

    expect(win.show).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);
    expect(win.hide).toHaveBeenCalledTimes(1);
    expect(electronState.appQuit).toHaveBeenCalledTimes(1);
    expect(win.close).not.toHaveBeenCalled();
  });

  it('creates a missing window for Show but not for Hide', async () => {
    const win = windowDouble(false);
    const getWindow = vi.fn(() => null);
    const getOrCreateWindow = vi.fn(() => win);
    createTray({ getWindow, getOrCreateWindow } as never);
    await updateTrayMenu();

    await item('Hide').click?.();
    expect(getOrCreateWindow).not.toHaveBeenCalled();

    await item('Show Plexus').click?.();
    expect(getOrCreateWindow).toHaveBeenCalledTimes(1);
    expect(win.show).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);
  });

  it('rebinds a recreated window without duplicating the tray instance', async () => {
    const firstWindow = windowDouble();
    const recreatedWindow = windowDouble(false);
    createTray({ getWindow: () => firstWindow, getOrCreateWindow: () => firstWindow } as never);
    createTray({ getWindow: () => recreatedWindow, getOrCreateWindow: () => recreatedWindow } as never);
    await updateTrayMenu();

    await item('Show Plexus').click?.();
    expect(electronState.trays).toHaveLength(1);
    expect(firstWindow.focus).not.toHaveBeenCalled();
    expect(recreatedWindow.show).toHaveBeenCalledTimes(1);
    expect(recreatedWindow.focus).toHaveBeenCalledTimes(1);
  });

  it('does not write a menu after its tray was destroyed during an async refresh', async () => {
    await renderMenu(() => windowDouble());
    const activeTray = electronState.trays[0];
    if (!activeTray) throw new Error('Expected tray instance');
    const writesBeforeRefresh = activeTray.setContextMenu.mock.calls.length;
    let resolveRead!: (entry: TimeEntry | null) => void;
    databaseState.pendingRead = new Promise((resolve) => { resolveRead = resolve; });

    const refresh = updateTrayMenu();
    destroyTray();
    createTray((() => windowDouble(false)) as never);
    const recreatedTray = electronState.trays[1];
    if (!recreatedTray) throw new Error('Expected recreated tray instance');
    resolveRead(null);
    await refresh;

    expect(activeTray.setContextMenu).toHaveBeenCalledTimes(writesBeforeRefresh);
    await vi.waitFor(() => expect(recreatedTray.setContextMenu).toHaveBeenCalledTimes(1));
  });

  it('keeps focus-nudge information disabled and actionless', async () => {
    const win = windowDouble();
    createTray((() => win) as never);
    await setTrayFocusNudgeState(win as never, { active: true, idleMinutes: 15, reason: 'standby' });

    const information = item('No active timer for 15 minutes');
    expect(information.enabled).toBe(false);
    expect(information.click).toBeUndefined();
  });

  it('clears stale focus-nudge labels when window services stop', async () => {
    const win = windowDouble();
    createTray((() => win) as never);
    await setTrayFocusNudgeState(win as never, { active: true, idleMinutes: 15, reason: 'standby' });

    clearTrayFocusNudgeState();
    await updateTrayMenu();
    expect(item('Open Clio Today')).toBeDefined();
  });
});
