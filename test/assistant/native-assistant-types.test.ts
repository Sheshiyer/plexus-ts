import { describe, expect, it } from 'vitest';
import type {
  AssistantStreamEvent,
  AssistantSuggestion,
  AssistantTurnRequest,
} from '../../src/shared/native-assistant';

describe('native assistant shared types', () => {
  it('supports assistant turn requests and stream events', () => {
    const request: AssistantTurnRequest = {
      conversationId: 'conversation_1',
      message: 'Prepare today for standup',
      contextScopes: ['today', 'session_group'],
      routeKey: 'reports',
    };
    const suggestion: AssistantSuggestion = {
      id: 'suggestion_1',
      title: 'Prepare daily update',
      body: 'Generate a standup summary from today and recent sessions.',
      confidence: 0.91,
      safety: 'confirm_required',
      intent: {
        toolId: 'app.generateStandup',
        title: 'Generate standup',
        payload: { date: '2026-07-01' },
      },
    };
    const event: AssistantStreamEvent = {
      type: 'suggestion',
      conversationId: request.conversationId,
      suggestion,
    };

    expect(event.suggestion.intent?.toolId).toBe('app.generateStandup');
  });
});
