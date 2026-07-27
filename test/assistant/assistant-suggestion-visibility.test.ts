import { describe, expect, it } from 'vitest';
import type { AssistantSuggestion, AssistantToolId } from '../../src/shared/types';
import { mergeAssistantSuggestions } from '../../src/renderer/components/AssistantPanel';

function suggestion(id: string, confidence: number, toolId: AssistantToolId = 'context.reports', intentId = `intent_${id}`): AssistantSuggestion {
  return {
    id,
    title: id,
    body: id,
    confidence,
    safety: 'confirm_required',
    intent: {
      intentId,
      toolId,
      title: id,
      payload: {},
    },
  };
}

describe('assistant daily transition visibility', () => {
  it.each<AssistantToolId>(['app.generateStandup', 'daily.sendEvent'])(
    'reserves a visible chip for persisted %s intent',
    (toolId) => {
      const diagnostics = Array.from({ length: 12 }, (_, index) => (
        suggestion(`diagnostic_${index}`, 0.99 - index / 1_000)
      ));
      const transition = suggestion('daily_transition', 0.8, toolId);

      const merged = mergeAssistantSuggestions(diagnostics, [transition]);

      expect(merged).toHaveLength(8);
      expect(merged).toContainEqual(transition);
    },
  );

  it('does not reserve an unpersisted local transition intent', () => {
    const diagnostics = Array.from({ length: 9 }, (_, index) => (
      suggestion(`diagnostic_${index}`, 0.99 - index / 1_000)
    ));
    const transition = suggestion('unpersisted_transition', 0.8, 'app.generateStandup', '');

    expect(mergeAssistantSuggestions(diagnostics, [transition])).not.toContainEqual(transition);
  });
});
