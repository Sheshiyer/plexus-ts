import type { App, BrowserWindow, WebContents } from 'electron';
import { redactForLog, redactedErrorMessage } from './redaction.js';

type Logger = Pick<Console, 'error' | 'warn'>;
type ProcessLike = Pick<NodeJS.Process, 'on'>;
type AppLike = Pick<App, 'on'>;
type WebContentsLike = Pick<WebContents, 'on' | 'id'>;
type BrowserWindowLike = Pick<BrowserWindow, 'webContents'>;

export const CRASH_REPORTER_POLICY = {
  mode: 'local-redacted',
  upload: 'disabled',
  reason: 'Crash metadata stays local until an explicit opt-in crashReporter policy exists.',
} as const;

const observedProcesses = new WeakSet<object>();
const observedApps = new WeakSet<object>();
const observedWebContents = new WeakSet<object>();

export function installMainProcessObservability(
  electronApp: AppLike,
  proc: ProcessLike = process,
  logger: Logger = console,
): void {
  if (!observedProcesses.has(proc as object)) {
    observedProcesses.add(proc as object);
    proc.on('uncaughtExceptionMonitor', (error) => {
      logger.error('[observability] uncaught exception', redactForLog(error));
    });
    proc.on('unhandledRejection', (reason) => {
      logger.error('[observability] unhandled rejection', redactForLog(reason));
    });
  }

  if (!observedApps.has(electronApp as object)) {
    observedApps.add(electronApp as object);
    electronApp.on('render-process-gone', (_event, webContents, details) => {
      logger.error('[observability] render process gone', redactForLog({
        webContentsId: webContents?.id ?? null,
        reason: details?.reason,
        exitCode: details?.exitCode,
      }));
    });
    electronApp.on('child-process-gone', (_event, details) => {
      logger.error('[observability] child process gone', redactForLog(details));
    });
  }
}

export function bindWindowObservability(window: BrowserWindowLike, logger: Logger = console): void {
  const webContents = window.webContents as WebContentsLike;
  if (observedWebContents.has(webContents as object)) return;
  observedWebContents.add(webContents as object);

  webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (!shouldForwardConsoleLevel(level)) return;
    logger.warn('[observability] renderer console', redactForLog({
      webContentsId: webContents.id,
      level,
      message,
      line,
      sourceId,
    }));
  });

}

export function crashReporterPolicySummary(): string {
  return `${CRASH_REPORTER_POLICY.mode}; upload ${CRASH_REPORTER_POLICY.upload}`;
}

export function observabilityErrorSummary(error: unknown): string {
  return redactedErrorMessage(error);
}

function shouldForwardConsoleLevel(level: unknown): boolean {
  if (typeof level === 'number') return level >= 1;
  if (typeof level === 'string') return ['warning', 'warn', 'error'].includes(level.toLowerCase());
  return false;
}
