import { describe, expect, it } from 'vitest';
import { humanizeToolEvent } from '../../src/renderer/lib/assistant-thread-model';

describe('humanizeToolEvent', () => {
  it('humanizes known action tools for both phases', () => {
    expect(humanizeToolEvent('app.startTimer', 'call')).toBe('Starting the timer…');
    expect(humanizeToolEvent('app.startTimer', 'result')).toBe('Timer started');
    expect(humanizeToolEvent('app.navigate', 'call')).toBe('Opening a page…');
    expect(humanizeToolEvent('app.navigate', 'result')).toBe('Opened the page');
    expect(humanizeToolEvent('app.generateStandup', 'call')).toBe('Drafting standup proof…');
    expect(humanizeToolEvent('app.generateStandup', 'result')).toBe('Standup draft ready');
    expect(humanizeToolEvent('app.syncProjects', 'call')).toBe('Syncing projects…');
    expect(humanizeToolEvent('app.syncProjects', 'result')).toBe('Projects synced');
    expect(humanizeToolEvent('app.acceptSession', 'result')).toBe('Session accepted');
  });

  it('humanizes read-only context tools as checks', () => {
    expect(humanizeToolEvent('context.entries', 'call')).toBe('Checking the work log…');
    expect(humanizeToolEvent('context.entries', 'result')).toBe('Checked the work log');
    expect(humanizeToolEvent('context.infra', 'result')).toBe('Checked infra status');
  });

  it('falls back to the raw tool id for unknown tools', () => {
    expect(humanizeToolEvent('admin.diagnostics', 'result')).toBe('Ran admin.diagnostics');
    expect(humanizeToolEvent('admin.diagnostics', 'call')).toBe('Running admin.diagnostics…');
  });
});
