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
      'offline_standup_2026-07-01',
      'offline_review_sessions',
      'offline_sync_projects',
    ]);
    expect(suggestions[0]).toMatchObject({
      title: 'Prepare daily proof',
      intent: {
        toolId: 'app.generateStandup',
        payload: { date: '2026-07-01' },
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
      todayDate: '2026-07-01',
      todayEntries: [{ id: 'entry_1' }],
      hasStandupProofToday: true,
      memberId: 'member_1',
      standupRecordId: 'standup_2026-07-01',
    });

    expect(suggestions.some((suggestion) => suggestion.intent?.toolId === 'app.generateStandup')).toBe(false);
    expect(suggestions.find((suggestion) => suggestion.intent?.toolId === 'daily.sendEvent')).toMatchObject({
      id: 'offline_daily_send_2026-07-01',
      title: 'Send daily update',
      safety: 'confirm_required',
      intent: {
        toolId: 'daily.sendEvent',
        payload: {
          date: '2026-07-01',
          memberId: 'member_1',
          standupRecordId: 'standup_2026-07-01',
        },
      },
    });
  });

  it('uses the same persisted-evidence action when no member id is available', () => {
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

  it('does not offer publishing after proof when no member id is available', () => {
    const suggestions = buildOfflineAssistantSuggestions({
      todayDate: '2026-07-01',
      todayEntries: [{ id: 'entry_1' }],
      hasStandupProofToday: true,
      standupRecordId: 'standup_2026-07-01',
    });

    expect(suggestions.some((suggestion) => suggestion.intent?.toolId === 'app.generateStandup')).toBe(false);
    expect(suggestions.some((suggestion) => suggestion.intent?.toolId === 'daily.sendEvent')).toBe(false);
  });

  it.each([
    ['queued', 'Resume daily delivery', 'already queued'],
    ['failed', 'Retry daily delivery', 'failed'],
  ] as const)('shows an honest %s publish action that keeps confirmation required', (status, title, body) => {
    const suggestions = buildOfflineAssistantSuggestions({
      todayDate: '2026-07-01',
      todayEntries: [{ id: 'entry_1' }],
      hasStandupProofToday: true,
      memberId: 'member_1',
      standupRecordId: 'standup_2026-07-01',
      dailyEventStatus: status,
    });

    expect(suggestions.find((suggestion) => suggestion.intent?.toolId === 'daily.sendEvent')).toMatchObject({
      title,
      body: expect.stringContaining(body),
      safety: 'confirm_required',
      intent: {
        payload: {
          date: '2026-07-01',
          memberId: 'member_1',
          standupRecordId: 'standup_2026-07-01',
        },
      },
    });
  });

  it('suppresses publish and generate actions after the daily event is sent', () => {
    const suggestions = buildOfflineAssistantSuggestions({
      todayDate: '2026-07-01',
      todayEntries: [{ id: 'entry_1' }],
      hasStandupProofToday: true,
      memberId: 'member_1',
      standupRecordId: 'standup_2026-07-01',
      dailyEventStatus: 'sent',
    });

    expect(suggestions.some((suggestion) => (
      suggestion.intent?.toolId === 'app.generateStandup'
      || suggestion.intent?.toolId === 'daily.sendEvent'
    ))).toBe(false);
  });
});
