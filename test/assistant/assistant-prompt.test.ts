import { describe, expect, it } from 'vitest';
import { buildAssistantSystemPrompt } from '../../src/main/assistant-runtime';

describe('assistant prompt builder', () => {
  it('builds a Plexus-native prompt with read-only and daily proof boundaries', () => {
    const prompt = buildAssistantSystemPrompt({
      routeKey: 'reports',
      selectedProjectName: 'Native Assistant',
      todayEntryCount: 3,
      taskSummaries: [{
        taskId: 'task_trace',
        title: 'Trace delegated runtime proof',
        status: 'blocked',
        workMode: 'delegated',
        proofStatus: 'missing',
        conflictCount: 2,
        correlationId: 'corr_trace_1',
      }],
      pendingSessionCount: 1,
      bridgeConnected: true,
    });

    expect(prompt).toContain('Plexus-native work assistant');
    expect(prompt).toContain('read-only unless the user explicitly confirms');
    expect(prompt).toContain('daily proof');
    expect(prompt).toContain('Current route: reports.');
    expect(prompt).toContain('Trace delegated runtime proof (blocked, mode delegated, proof missing, 2 conflicts, corr corr_trace_1).');
    expect(prompt).not.toContain('Fabric-first');
    expect(prompt).not.toMatch(/paperclip/i);
  });
});
