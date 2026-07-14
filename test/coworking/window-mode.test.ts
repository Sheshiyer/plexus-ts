import { describe, expect, it, vi } from 'vitest';
import {
  COMPACT_WINDOW_SIZE,
  clampWindowBounds,
  createWindowModeController,
  parseAppWindowMode,
  type WindowModeBrowserWindow,
  type WindowModeDisplayService,
} from '../../src/main/window-mode';

function fixture() {
  let bounds = { x: 120, y: 80, width: 1320, height: 860 };
  let minimum: [number, number] = [1180, 760];
  let maximized = true;
  let alwaysOnTop = false;
  let allWorkspaces = false;

  const window = {
    getBounds: vi.fn(() => ({ ...bounds })),
    getNormalBounds: vi.fn(() => ({ ...bounds })),
    getMinimumSize: vi.fn(() => minimum),
    isMaximized: vi.fn(() => maximized),
    unmaximize: vi.fn(() => { maximized = false; }),
    maximize: vi.fn(() => { maximized = true; }),
    isFullScreen: vi.fn(() => false),
    setFullScreen: vi.fn(),
    once: vi.fn(function (this: WindowModeBrowserWindow) { return this; }),
    removeListener: vi.fn(function (this: WindowModeBrowserWindow) { return this; }),
    isAlwaysOnTop: vi.fn(() => alwaysOnTop),
    setAlwaysOnTop: vi.fn((value: boolean) => { alwaysOnTop = value; }),
    isVisibleOnAllWorkspaces: vi.fn(() => allWorkspaces),
    setVisibleOnAllWorkspaces: vi.fn((value: boolean) => { allWorkspaces = value; }),
    setMinimumSize: vi.fn((width: number, height: number) => { minimum = [width, height]; }),
    setBounds: vi.fn((next: typeof bounds) => { bounds = { ...next }; }),
    show: vi.fn(),
    focus: vi.fn(),
  } satisfies WindowModeBrowserWindow;
  const displays = {
    getDisplayMatching: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1512, height: 982 } })),
  } satisfies WindowModeDisplayService;

  return { window, displays, originalBounds: { ...bounds } };
}

describe('native compact window mode', () => {
  it('accepts only the two explicit window modes', () => {
    expect(parseAppWindowMode('standard')).toBe('standard');
    expect(parseAppWindowMode('compact')).toBe('compact');
    expect(() => parseAppWindowMode('mini')).toThrow('Window mode');
    expect(() => parseAppWindowMode({ mode: 'compact' })).toThrow('Window mode');
  });

  it('enters compact mode once and restores the complete native snapshot', async () => {
    const { window, displays, originalBounds } = fixture();
    const controller = createWindowModeController(window, displays, 'darwin');

    await expect(controller.setMode('compact')).resolves.toMatchObject({ mode: 'compact', alwaysOnTop: true });
    expect(window.unmaximize).toHaveBeenCalledOnce();
    expect(window.setMinimumSize).toHaveBeenCalledWith(COMPACT_WINDOW_SIZE.minWidth, COMPACT_WINDOW_SIZE.minHeight);
    expect(window.setBounds).toHaveBeenCalledWith({
      x: 1512 - COMPACT_WINDOW_SIZE.width - COMPACT_WINDOW_SIZE.margin,
      y: COMPACT_WINDOW_SIZE.margin,
      width: COMPACT_WINDOW_SIZE.width,
      height: COMPACT_WINDOW_SIZE.height,
    });
    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(window.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, { visibleOnFullScreen: true });

    await controller.setMode('compact');
    expect(window.setBounds).toHaveBeenCalledTimes(1);

    await expect(controller.setMode('standard')).resolves.toMatchObject({ mode: 'standard', alwaysOnTop: false });
    expect(window.setVisibleOnAllWorkspaces).toHaveBeenLastCalledWith(false, { visibleOnFullScreen: true });
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(false);
    expect(window.setMinimumSize).toHaveBeenLastCalledWith(1180, 760);
    expect(window.setBounds).toHaveBeenLastCalledWith(originalBounds);
    expect(window.maximize).toHaveBeenCalledOnce();
  });

  it('re-clamps an active companion after display metrics change', async () => {
    const { window, displays } = fixture();
    const controller = createWindowModeController(window, displays);
    await controller.setMode('compact');
    controller.repositionCompactWindow();
    expect(window.setBounds).toHaveBeenCalledTimes(2);
  });

  it('rolls native state back when compact placement fails', async () => {
    const { window, displays, originalBounds } = fixture();
    window.setBounds.mockImplementationOnce(() => { throw new Error('compositor rejected bounds'); });
    const controller = createWindowModeController(window, displays);

    await expect(controller.setMode('compact')).rejects.toThrow('compositor rejected bounds');
    expect(controller.getState()).toMatchObject({ mode: 'standard', alwaysOnTop: false });
    expect(window.setMinimumSize).toHaveBeenLastCalledWith(1180, 760);
    expect(window.setBounds).toHaveBeenLastCalledWith(originalBounds);
  });

  it('skips unsupported all-workspaces mutation on Windows', async () => {
    const { window, displays } = fixture();
    const controller = createWindowModeController(window, displays, 'win32');
    await controller.setMode('compact');
    await controller.setMode('standard');
    expect(window.setVisibleOnAllWorkspaces).not.toHaveBeenCalled();
  });

  it('waits for asynchronous native fullscreen exit before compact bounds', async () => {
    const { window, displays } = fixture();
    let fullscreen = true;
    let leaveFullscreen: (() => void) | null = null;
    window.isFullScreen.mockImplementation(() => fullscreen);
    window.once.mockImplementation(function (this: WindowModeBrowserWindow, event, listener) {
      if (event === 'leave-full-screen') leaveFullscreen = listener;
      return this;
    });
    window.setFullScreen.mockImplementation((value) => {
      if (value) return;
      queueMicrotask(() => {
        fullscreen = false;
        const listener = leaveFullscreen as (() => void) | null;
        if (listener) listener();
      });
    });
    const controller = createWindowModeController(window, displays, 'darwin');

    await controller.setMode('compact');

    expect(window.setFullScreen).toHaveBeenCalledWith(false);
    expect(window.setFullScreen.mock.invocationCallOrder[0]).toBeLessThan(window.setBounds.mock.invocationCallOrder[0]);
  });

  it('clamps restored bounds across negative and reduced display coordinates', () => {
    expect(clampWindowBounds(
      { x: -2400, y: -120, width: 1200, height: 900 },
      { x: -1920, y: 0, width: 1920, height: 1080 },
    )).toEqual({ x: -1920, y: 0, width: 1200, height: 900 });
  });
});
