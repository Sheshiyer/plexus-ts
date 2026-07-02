import React from 'react';
import type { AssistantSuggestion } from '../../shared/types';
import { Button } from './ui';
import { IconCheck, IconClose, IconEntries, IconProjects, IconReports, IconSync } from './Icons';
import { EmptyStatePanel, InstrumentPanel, StatusChip } from './PlexusUI';
import type { AssistantPendingIntent } from './AssistantActionConfirmModal';

interface Props {
  suggestions: AssistantSuggestion[];
  dismissedIds: Set<string>;
  loading?: boolean;
  onConfirm: (intent: AssistantPendingIntent) => void;
  onDismiss: (id: string) => void;
}

export default function AssistantSuggestionRail({ suggestions, dismissedIds, loading, onConfirm, onDismiss }: Props) {
  const visible = suggestions.filter((suggestion) => !dismissedIds.has(suggestion.id));

  return (
    <InstrumentPanel
      label="suggestion rail"
      title="Next useful actions"
      note="Every action opens a confirmation step before it changes app state."
      actions={<StatusChip tone={loading ? 'warning' : visible.length ? 'accent' : 'idle'}>{loading ? 'loading' : `${visible.length} ready`}</StatusChip>}
    >
      {visible.length === 0 ? (
        <EmptyStatePanel
          icon={<IconCheck s={24} />}
          title="No pending suggestions"
          message="The assistant will surface proof, session, navigation, and sync actions here."
        />
      ) : (
        <div className="px-assistant-suggestion-list">
          {visible.map((suggestion) => {
            const pending = pendingIntentFromSuggestion(suggestion);
            return (
              <article key={suggestion.id} className="px-assistant-suggestion">
                <div className="px-assistant-suggestion-icon">{suggestionIcon(pending.toolId, pending.payload)}</div>
                <div className="px-assistant-suggestion-copy">
                  <div className="px-assistant-suggestion-head">
                    <strong>{suggestion.title}</strong>
                    <StatusChip tone={suggestion.safety === 'read_only' ? 'mint' : suggestion.safety === 'admin_only' ? 'warning' : 'accent'}>
                      {Math.round(suggestion.confidence * 100)}%
                    </StatusChip>
                  </div>
                  <p>{suggestion.body}</p>
                  <div className="px-assistant-suggestion-actions">
                    <Button variant="ghost" onClick={() => onDismiss(suggestion.id)}>
                      <IconClose s={12} /> Dismiss
                    </Button>
                    <Button onClick={() => onConfirm(pending)}>
                      {actionIcon(pending.toolId, pending.payload)} {actionLabel(pending.toolId, pending.payload)}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </InstrumentPanel>
  );
}

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

function routeKey(payload: Record<string, unknown>): string {
  return typeof payload.routeKey === 'string' ? payload.routeKey : '';
}

function actionLabel(toolId: AssistantPendingIntent['toolId'], payload: Record<string, unknown>): string {
  if (toolId === 'app.generateStandup') return 'Generate';
  if (toolId === 'app.syncProjects') return 'Sync';
  if (toolId === 'app.navigate' && routeKey(payload) === 'agents') return 'Review';
  if (toolId === 'app.navigate' && routeKey(payload) === 'reports') return 'Open Reports';
  if (toolId === 'app.navigate') return 'Navigate';
  return 'Confirm';
}

function actionIcon(toolId: AssistantPendingIntent['toolId'], payload: Record<string, unknown>) {
  if (toolId === 'app.syncProjects') return <IconSync s={12} />;
  if (toolId === 'app.navigate' && routeKey(payload) === 'agents') return <IconEntries s={12} />;
  if (toolId === 'app.navigate' && routeKey(payload) === 'reports') return <IconReports s={12} />;
  if (toolId === 'app.navigate') return <IconProjects s={12} />;
  return <IconCheck s={12} />;
}

function suggestionIcon(toolId: AssistantPendingIntent['toolId'], payload: Record<string, unknown>) {
  if (toolId === 'app.syncProjects') return <IconSync s={15} />;
  if (toolId === 'app.navigate' && routeKey(payload) === 'reports') return <IconReports s={15} />;
  if (toolId === 'app.navigate' && routeKey(payload) === 'agents') return <IconEntries s={15} />;
  if (toolId === 'app.navigate') return <IconProjects s={15} />;
  return <IconCheck s={15} />;
}
