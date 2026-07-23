import React, { useState } from 'react';
import type { AssistantSuggestion } from '../../shared/types';
import type { AssistantPendingIntent } from './AssistantActionConfirmModal';
import { IconClose } from './Icons';

const VISIBLE_LIMIT = 3;

/**
 * Horizontal suggestion chips above the composer. Click confirms via the
 * existing action modal; the ✕ dismisses. Confidence values are hidden.
 */
export default function AssistantSuggestionChips({
  suggestions, dismissedIds, onConfirm, onDismiss,
}: {
  suggestions: AssistantSuggestion[];
  dismissedIds: Set<string>;
  onConfirm: (intent: AssistantPendingIntent) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = suggestions.filter((item) => !dismissedIds.has(item.id));
  if (!active.length) return null;
  const visible = expanded ? active : active.slice(0, VISIBLE_LIMIT);
  const hidden = active.length - visible.length;
  return (
    <div className="px-clio-chips" aria-label="Suggested actions">
      {visible.map((suggestion) => (
        <span key={suggestion.id} className="px-clio-chip" title={suggestion.body}>
          <button
            type="button"
            className="px-clio-chip-act"
            onClick={() => onConfirm(pendingIntentFromSuggestion(suggestion))}
          >
            {suggestion.title}
          </button>
          <button type="button" className="px-clio-chip-x" aria-label={`Dismiss ${suggestion.title}`} onClick={() => onDismiss(suggestion.id)}>
            <IconClose s={10} />
          </button>
        </span>
      ))}
      {hidden > 0 && (
        <button type="button" className="px-clio-chip more" onClick={() => setExpanded(true)}>+{hidden} more</button>
      )}
    </div>
  );
}

// Mirrors AssistantSuggestionRail's pendingIntentFromSuggestion exactly so
// confirming a chip behaves identically to confirming a rail card.
function pendingIntentFromSuggestion(suggestion: AssistantSuggestion): AssistantPendingIntent {
  const intent = suggestion.intent;
  return {
    id: `${suggestion.id}:${intent?.toolId ?? 'app.navigate'}`,
    intentId: intent?.intentId,
    suggestionId: suggestion.id,
    toolId: intent?.toolId ?? 'app.navigate',
    title: intent?.title ?? suggestion.title,
    body: intent?.body ?? suggestion.body,
    payload: intent?.payload ?? { routeKey: 'assistant' },
    safety: suggestion.safety === 'read_only' ? 'confirm_required' : suggestion.safety,
  };
}
