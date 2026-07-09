import { describe, expect, it, vi } from 'vitest';
import {
  bindWindowObservability,
  crashReporterPolicySummary,
  installMainProcessObservability,
  observabilityErrorSummary,
} from '../../src/main/observability';

type Handler = (...args: unknown[]) => void;

class MockEmitter {
  readonly handlers = new Map<string, Handler[]>();
  readonly id = 7;

  on(event: string, handler: Handler): this {
    const next = this.handlers.get(event) ?? [];
    next.push(handler);
    this.handlers.set(event, next);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }
}

describe('main process observability', () => {
  it('registers process and app handlers once and redacts logged payloads', () => {
    const app = new MockEmitter();
    const proc = new MockEmitter();
    const logger = { error: vi.fn(), warn: vi.fn() };

    installMainProcessObservability(app as any, proc as any, logger);
    installMainProcessObservability(app as any, proc as any, logger);

    expect(proc.handlers.get('uncaughtExceptionMonitor')).toHaveLength(1);
    expect(proc.handlers.get('unhandledRejection')).toHaveLength(1);
    expect(app.handlers.get('render-process-gone')).toHaveLength(1);
    expect(app.handlers.get('child-process-gone')).toHaveLength(1);

    proc.emit('unhandledRejection', new Error('Bearer secret-token failed'));
    app.emit('render-process-gone', {}, { id: 44 }, { reason: 'crashed', exitCode: 9, token: 'secret' });
    app.emit('child-process-gone', {}, { type: 'Utility', reason: 'killed', Authorization: 'secret' });

    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).toContain('[observability] unhandled rejection');
    expect(logged).toContain('[observability] render process gone');
    expect(logged).toContain('[observability] child process gone');
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain('"secret"');
  });

  it('forwards only renderer warning and error console messages through redaction', () => {
    const webContents = new MockEmitter();
    const logger = { error: vi.fn(), warn: vi.fn() };

    bindWindowObservability({ webContents } as any, logger);
    bindWindowObservability({ webContents } as any, logger);

    expect(webContents.handlers.get('console-message')).toHaveLength(1);

    webContents.emit('console-message', {}, 0, 'debug token=secret-token', 1, 'renderer.tsx');
    webContents.emit('console-message', {}, 2, 'error token=secret-token', 2, 'renderer.tsx');
    webContents.emit('console-message', {}, 'warn', 'warn cookie=secret-cookie', 3, 'renderer.tsx');

    expect(logger.warn).toHaveBeenCalledTimes(2);
    const logged = JSON.stringify(logger.warn.mock.calls);
    expect(logged).toContain('[observability] renderer console');
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain('secret-cookie');
  });

  it('keeps crashReporter upload policy local-only until explicit opt-in exists', () => {
    expect(crashReporterPolicySummary()).toBe('local-redacted; upload disabled');
    expect(observabilityErrorSummary(new Error('api_key=secret'))).toBe('api_key=[redacted]');
  });
});
