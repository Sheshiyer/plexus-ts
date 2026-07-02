import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import {
  buildProactiveAssistantSuggestions,
  dismissAssistantSuggestion,
  filterDismissedAssistantSuggestions,
  type AssistantSuggestionDismissal,
  type AssistantSuggestionStorage,
} from '../../src/main/assistant-suggestions';
import { FIXTURE_NOW } from './fixtures/builders';
import { buildContextSources } from './fixtures/context-sources';

function memoryStorage(seed: AssistantSuggestionDismissal[] = []): AssistantSuggestionStorage {
  let rows = [...seed];
  return {
    async getDismissals() {
      return [...rows];
    },
    async setDismissals(next) {
      rows = [...next];
    },
  };
}

async function contextAt(now: string) {
  return buildAssistantContext({
    contextScopes: ['today', 'project', 'session_group', 'infra', 'app'],
    now,
    routeState: { routeKey: 'focus', selectedProjectId: null, updatedAt: now },
    sources: buildContextSources(),
  });
}

describe('assistant suggestion throttling', () => {
  it('hides dismissed suggestions until their cooldown expires', async () => {
    const storage = memoryStorage();
    const now = new Date(FIXTURE_NOW);
    const suggestions = buildProactiveAssistantSuggestions(await contextAt(FIXTURE_NOW), { now });
    const standup = suggestions.find((suggestion) => suggestion.type === 'standup');
    expect(standup).toBeDefined();

    await dismissAssistantSuggestion(standup!, { storage, now, cooldownMs: 60 * 60 * 1000 });

    await expect(filterDismissedAssistantSuggestions(suggestions, storage, now))
      .resolves
      .not.toContain(standup);
    await expect(filterDismissedAssistantSuggestions(
      suggestions,
      storage,
      new Date(now.getTime() + 60 * 60 * 1000 + 1),
    )).resolves.toContain(standup);
  });

  it('lets critical missing-proof suggestions reappear on the next day', async () => {
    const storage = memoryStorage();
    const dayOne = new Date(FIXTURE_NOW);
    const dayOneSuggestions = buildProactiveAssistantSuggestions(await contextAt(FIXTURE_NOW), { now: dayOne });
    const missingProof = dayOneSuggestions.find((suggestion) => suggestion.type === 'missing_proof');
    expect(missingProof).toMatchObject({ critical: true, date: '2026-07-01' });

    await dismissAssistantSuggestion(missingProof!, {
      storage,
      now: dayOne,
      cooldownMs: 7 * 24 * 60 * 60 * 1000,
    });

    await expect(filterDismissedAssistantSuggestions(dayOneSuggestions, storage, dayOne))
      .resolves
      .not.toContain(missingProof);

    const dayTwo = new Date('2026-07-02T09:00:00.000Z');
    const dayTwoSuggestions = buildProactiveAssistantSuggestions(await contextAt(dayTwo.toISOString()), { now: dayTwo });
    const nextMissingProof = dayTwoSuggestions.find((suggestion) => suggestion.type === 'missing_proof');
    expect(nextMissingProof).toMatchObject({ critical: true, date: '2026-07-02' });
    await expect(filterDismissedAssistantSuggestions(dayTwoSuggestions, storage, dayTwo))
      .resolves
      .toContain(nextMissingProof);
  });
});
