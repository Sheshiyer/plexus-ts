import React from 'react';
import type { AssistantRole, AssistantToolId } from '../../shared/types';
import { IconBridge, IconCheck, IconClose, IconSync } from './Icons';
import { EmptyStatePanel, StatusChip } from './PlexusUI';

export type AssistantMessageRole = AssistantRole | 'error';

export interface AssistantUiMessage {
  id: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
  provider?: string | null;
  fallbackProvider?: string | null;
  toolId?: AssistantToolId;
  status?: 'streaming' | 'done' | 'failed' | 'pending';
}

interface Props {
  messages: AssistantUiMessage[];
  streaming?: boolean;
  providerLabel?: string;
}

export default function AssistantMessageList({ messages, streaming, providerLabel }: Props) {
  if (messages.length === 0) {
    return (
      <EmptyStatePanel
        icon={<IconBridge s={26} />}
        title="No assistant messages yet"
        message="Ask for a daily proof check, session review, project sync, or navigation help."
      />
    );
  }

  return (
    <div className="px-assistant-message-list" aria-live="polite">
      {messages.map((message) => (
        <article key={message.id} className={`px-assistant-message role-${message.role}`}>
          <div className="px-assistant-message-marker">{roleIcon(message.role, message.status)}</div>
          <div className="px-assistant-message-main">
            <div className="px-assistant-message-head">
              <StatusChip tone={roleTone(message.role, message.status)}>{roleLabel(message.role)}</StatusChip>
              <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {metadataLine(message, providerLabel) && <span>{metadataLine(message, providerLabel)}</span>}
            </div>
            <div className="px-assistant-message-content">{message.content}</div>
          </div>
        </article>
      ))}
      {streaming && (
        <div className="px-assistant-stream-indicator">
          <span className="px-dot pulse" />
          <span>assistant stream active</span>
        </div>
      )}
    </div>
  );
}

function roleLabel(role: AssistantMessageRole): string {
  if (role === 'user') return 'you';
  if (role === 'assistant') return 'assistant';
  if (role === 'tool') return 'tool';
  if (role === 'system') return 'system';
  return 'error';
}

function roleTone(role: AssistantMessageRole, status?: AssistantUiMessage['status']) {
  if (role === 'error' || status === 'failed') return 'error';
  if (role === 'tool') return 'warning';
  if (role === 'user') return 'mint';
  if (status === 'streaming' || status === 'pending') return 'accent';
  return 'idle';
}

function roleIcon(role: AssistantMessageRole, status?: AssistantUiMessage['status']) {
  if (role === 'error' || status === 'failed') return <IconClose s={14} />;
  if (status === 'streaming' || status === 'pending') return <IconSync s={14} />;
  if (role === 'tool') return <IconCheck s={14} />;
  return <IconBridge s={14} />;
}

function metadataLine(message: AssistantUiMessage, providerLabel?: string): string {
  const parts = [
    message.toolId ? message.toolId : null,
    message.provider ?? (message.role === 'assistant' ? providerLabel : null),
    message.fallbackProvider ? `fallback ${message.fallbackProvider}` : null,
    message.status && message.status !== 'done' ? message.status : null,
  ].filter(Boolean);
  return parts.join(' / ');
}
