import type { Rectangle } from 'electron';
import type { AppWindowMode, AppWindowModeState } from '../shared/types.js';

export const COMPACT_WINDOW_SIZE = {
  width: 384,
  height: 264,
  minWidth: 340,
  minHeight: 220,
  margin: 16,
} as const;

type WindowSnapshot = {
  bounds: Rectangle;
  minimum: [number, number];
  maximized: boolean;
  fullscreen: boolean;
  alwaysOnTop: boolean;
  visibleOnAllWorkspaces: boolean;
};

export interface WindowModeBrowserWindow {
  getBounds(): Rectangle;
  getNormalBounds(): Rectangle;
  getMinimumSize(): number[];
  isMaximized(): boolean;
  unmaximize(): void;
  maximize(): void;
  isFullScreen(): boolean;
  setFullScreen(value: boolean): void;
  once(event: 'leave-full-screen', listener: () => void): this;
  removeListener(event: 'leave-full-screen', listener: () => void): this;
  isAlwaysOnTop(): boolean;
  setAlwaysOnTop(value: boolean): void;
  isVisibleOnAllWorkspaces(): boolean;
  setVisibleOnAllWorkspaces(value: boolean, options?: { visibleOnFullScreen?: boolean }): void;
  setMinimumSize(width: number, height: number): void;
  setBounds(bounds: Rectangle): void;
  show(): void;
  focus(): void;
}

export interface WindowModeDisplayService {
  getDisplayMatching(bounds: Rectangle): { workArea: Rectangle };
}

export type WindowModePlatform = 'darwin' | 'linux' | 'win32' | string;

export function parseAppWindowMode(value: unknown): AppWindowMode {
  if (value === 'standard' || value === 'compact') return value;
  throw new Error('Window mode must be either standard or compact.');
}

export function clampWindowBounds(bounds: Rectangle, workArea: Rectangle): Rectangle {
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  return {
    x: Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height),
    width,
    height,
  };
}

function compactBoundsFor(workArea: Rectangle): Rectangle {
  const width = Math.min(COMPACT_WINDOW_SIZE.width, workArea.width);
  const height = Math.min(COMPACT_WINDOW_SIZE.height, workArea.height);
  return {
    x: workArea.x + workArea.width - width - Math.min(COMPACT_WINDOW_SIZE.margin, Math.max(0, workArea.width - width)),
    y: workArea.y + Math.min(COMPACT_WINDOW_SIZE.margin, Math.max(0, workArea.height - height)),
    width,
    height,
  };
}

function waitForFullscreenExit(window: WindowModeBrowserWindow): Promise<void> {
  if (!window.isFullScreen()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (timer) clearTimeout(timer);
      window.removeListener('leave-full-screen', finish);
      if (window.isFullScreen()) {
        reject(new Error('Application window did not leave fullscreen before compact resizing.'));
      } else {
        resolve();
      }
    };
    window.once('leave-full-screen', finish);
    try {
      window.setFullScreen(false);
      timer = setTimeout(finish, 2000);
    } catch (error) {
      window.removeListener('leave-full-screen', finish);
      reject(error);
    }
  });
}

export interface WindowModeController {
  getState(): AppWindowModeState;
  setMode(mode: AppWindowMode): Promise<AppWindowModeState>;
  repositionCompactWindow(): AppWindowModeState;
}

export function createWindowModeController(
  window: WindowModeBrowserWindow,
  displays: WindowModeDisplayService,
  platform: WindowModePlatform = process.platform,
): WindowModeController {
  let mode: AppWindowMode = 'standard';
  let snapshot: WindowSnapshot | null = null;
  let transition = Promise.resolve<AppWindowModeState>({
    mode,
    bounds: window.getBounds(),
    alwaysOnTop: window.isAlwaysOnTop(),
  });

  const getState = (): AppWindowModeState => ({
    mode,
    bounds: window.getBounds(),
    alwaysOnTop: window.isAlwaysOnTop(),
  });

  const setWorkspaceVisibility = (visible: boolean) => {
    if (platform === 'win32') return;
    window.setVisibleOnAllWorkspaces(visible, { visibleOnFullScreen: true });
  };

  const restore = (saved: WindowSnapshot) => {
    setWorkspaceVisibility(saved.visibleOnAllWorkspaces);
    window.setAlwaysOnTop(saved.alwaysOnTop);
    window.setMinimumSize(saved.minimum[0], saved.minimum[1]);
    const display = displays.getDisplayMatching(saved.bounds);
    window.setBounds(clampWindowBounds(saved.bounds, display.workArea));
    if (saved.maximized) window.maximize();
    if (saved.fullscreen) window.setFullScreen(true);
  };

  const applyMode = async (nextMode: AppWindowMode): Promise<AppWindowModeState> => {
    if (nextMode === mode) return getState();

    if (nextMode === 'compact') {
      const minimum = window.getMinimumSize();
      const saved: WindowSnapshot = {
        bounds: window.getNormalBounds(),
        minimum: [minimum[0] ?? 0, minimum[1] ?? 0],
        maximized: window.isMaximized(),
        fullscreen: window.isFullScreen(),
        alwaysOnTop: window.isAlwaysOnTop(),
        visibleOnAllWorkspaces: window.isVisibleOnAllWorkspaces(),
      };
      snapshot = saved;
      try {
        await waitForFullscreenExit(window);
        if (window.isMaximized()) window.unmaximize();
        window.setMinimumSize(COMPACT_WINDOW_SIZE.minWidth, COMPACT_WINDOW_SIZE.minHeight);
        const current = window.getBounds();
        const display = displays.getDisplayMatching(current);
        window.setBounds(compactBoundsFor(display.workArea));
        window.setAlwaysOnTop(true);
        setWorkspaceVisibility(true);
        window.show();
        window.focus();
        mode = 'compact';
        return getState();
      } catch (error) {
        restore(saved);
        snapshot = null;
        mode = 'standard';
        throw error;
      }
    }

    if (snapshot) restore(snapshot);
    snapshot = null;
    mode = 'standard';
    window.show();
    window.focus();
    return getState();
  };

  return {
    getState,
    setMode(nextMode) {
      transition = transition.then(() => applyMode(nextMode), () => applyMode(nextMode));
      return transition;
    },
    repositionCompactWindow() {
      if (mode !== 'compact') return getState();
      const display = displays.getDisplayMatching(window.getBounds());
      window.setBounds(compactBoundsFor(display.workArea));
      return getState();
    },
  };
}
