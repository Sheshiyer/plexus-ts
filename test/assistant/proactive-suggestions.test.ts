import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import {
  assistantSuggestionDedupeKey,
  buildProactiveAssistantSuggestions,
} from '../../src/main/assistant-suggestions';
import type { AssistantSuggestion } from '../../src/shared/native-assistant';
import { FIXTURE_NOW, buildThoughtseedBridgeStatus } from './fixtures/builders';
import { buildContextSources } from './fixtures/context-sources';

async function suggestionContext() {
  return buildAssistantContext({
    contextScopes: ['today', 'project', 'session_group', 'infra', 'app'],
    now: FIXTURE_NOW,
    routeState: { routeKey: 'focus', selectedProjectId: null, updatedAt: FIXTURE_NOW },
    sources: buildContextSources({
      async thoughtseedBridgeStatus() {
        return buildThoughtseedBridgeStatus({ configured: false, connected: false });
      },
    }),
  });
}

describe('proactive assistant suggestions', () => {
  it('generates the rollout suggestion types from local context and offline suggestions', async () => {
    const suggestions = buildProactiveAssistantSuggestions(await suggestionContext());

    expect(suggestions.map((suggestion) => suggestion.type)).toEqual([
      'missing_proof',
      'standup',
      'session_grouping',
      'navigate_reports',
      'sync_projects',
      'check_settings',
    ]);
    expect(suggestions.every((suggestion) => (
      typeof suggestion.confidence === 'number'
      && suggestion.confidence >= 0
      && suggestion.confidence <= 1
      && Boolean(suggestion.dedupeKey)
    ))).toBe(true);
    expect(suggestions.find((suggestion) => suggestion.type === 'missing_proof')).toMatchObject({
      critical: true,
      safety: 'read_only',
      date: '2026-07-01',
      projectId: 'project_missing',
    });
    expect(suggestions.find((suggestion) => suggestion.type === 'standup')).toMatchObject({
      title: 'Prepare daily proof',
      intent: {
        toolId: 'app.generateStandup',
        payload: { date: '2026-07-01' },
      },
    });
  });

  it('deduplicates suggestions by type, project, and date while keeping strongest confidence', async () => {
    const duplicateLowConfidence: AssistantSuggestion = {
      id: 'offline_low',
      type: 'standup',
      title: 'Draft standup',
      body: 'Older candidate.',
      confidence: 0.4,
      safety: 'confirm_required',
      date: '2026-07-01',
      dedupeKey: assistantSuggestionDedupeKey({ type: 'standup', date: '2026-07-01' }),
    };
    const duplicateHighConfidence: AssistantSuggestion = {
      ...duplicateLowConfidence,
      id: 'offline_high',
      body: 'Stronger candidate.',
      confidence: 0.9,
    };

    const suggestions = buildProactiveAssistantSuggestions(await suggestionContext(), {
      offlineSuggestions: [duplicateLowConfidence, duplicateHighConfidence],
    });

    const standups = suggestions.filter((suggestion) => suggestion.type === 'standup');
    expect(standups).toHaveLength(1);
    expect(standups[0]).toMatchObject({ id: 'offline_high', confidence: 0.9 });
  });
});
