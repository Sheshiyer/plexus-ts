import { describe, expect, it } from 'vitest';
import { buildOfflineAssistantSuggestions } from '../../src/main/assistant-runtime';

describe('offline assistant suggestions', () => {
  it('generates deterministic suggestions from local context without an LLM', () => {
    const suggestions = buildOfflineAssistantSuggestions({
      todayDate: '2026-07-01',
      todayEntries: [{ id: 'entry_1', description: 'Build runtime', durationSeconds: 1800 }],
      hasStandupProofToday: false,
      sessionScan: { readyPending: 2 },
      bridgeStatus: { connected: true },
      projectCache: { stale: true },
    });

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual([
      'offline_standup_2026-07-01',
      'offline_review_sessions',
      'offline_sync_projects',
    ]);
    expect(suggestions[0]).toMatchObject({
      intent: { toolId: 'app.generateStandup', payload: { date: '2026-07-01' } },
      safety: 'confirm_required',
    });
    expect(suggestions[1]).toMatchObject({
      intent: { toolId: 'context.sessions' },
      safety: 'read_only',
    });
  });

  it('does not suggest standup generation when proof already exists', () => {
    const suggestions = buildOfflineAssistantSuggestions({
      todayEntries: [{ id: 'entry_1' }],
      hasStandupProofToday: true,
    });

    expect(suggestions.some((suggestion) => suggestion.intent?.toolId === 'app.generateStandup')).toBe(false);
  });
});
