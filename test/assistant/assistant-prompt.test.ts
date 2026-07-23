import { describe, expect, it } from 'vitest';
import { buildAssistantSystemPrompt } from '../../src/main/assistant-runtime';

describe('assistant prompt builder', () => {
  it('builds a Plexus-native prompt with read-only and daily proof boundaries', () => {
    const prompt = buildAssistantSystemPrompt({
      routeKey: 'reports',
      selectedProjectName: 'Native Assistant',
      todayEntryCount: 3,
      pendingSessionCount: 1,
      bridgeConnected: true,
    });

    expect(prompt).toContain('Plexus-native work assistant');
    expect(prompt).toContain('read-only unless the user explicitly confirms');
    expect(prompt).toContain('daily proof');
    expect(prompt).toContain('Current route: reports.');
    expect(prompt).not.toContain('Fabric-first');
    expect(prompt).not.toMatch(/paperclip/i);
  });
});
