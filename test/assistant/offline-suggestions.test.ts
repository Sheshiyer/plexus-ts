import { describe, expect, it } from 'vitest';
import { buildOfflineAssistantSuggestions } from '../../src/main/assistant-runtime';

describe('offline assistant suggestions', () => {
  it('generates deterministic suggestions from local context without an LLM', () => {
    const suggestions = buildOfflineAssistantSuggestions({
      todayDate: '2026-07-01',
      todayEntries: [{ id: 'entry_1', description: 'Build runtime', durationSeconds: 1800 }],
      hasStandupProofToday: false,
      memberId: 'member_1',
      sessionScan: { readyPending: 2 },
      bridgeStatus: { connected: true },
      projectCache: { stale: true },
    });

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual([
      'offline_founder_update_2026-07-01',
      'offline_review_sessions',
      'offline_sync_projects',
    ]);
    expect(suggestions[0]).toMatchObject({
      title: 'Prepare founder update',
      intent: {
        toolId: 'daily.sendEvent',
        payload: { date: '2026-07-01', memberId: 'member_1', standupRecordId: null },
      },
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

  it('falls back to standup generation when no member id is available', () => {
    const suggestions = buildOfflineAssistantSuggestions({
      todayDate: '2026-07-01',
      todayEntries: [{ id: 'entry_1' }],
      hasStandupProofToday: false,
    });

    expect(suggestions[0]).toMatchObject({
      id: 'offline_standup_2026-07-01',
      intent: { toolId: 'app.generateStandup', payload: { date: '2026-07-01' } },
    });
  });
});
