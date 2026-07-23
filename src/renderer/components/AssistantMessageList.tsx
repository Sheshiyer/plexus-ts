import React from 'react';
import type { AssistantRole, AssistantToolId } from '../../shared/types';
import { IconBridge, IconClose, IconSync } from './Icons';
import { EmptyStatePanel } from './PlexusUI';

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
}

export default function AssistantMessageList({ messages, streaming }: Props) {
  if (messages.length === 0) {
    return (
      <EmptyStatePanel
        icon={<IconBridge s={26} />}
        title="No messages yet"
        message="Ask for a daily proof check, session review, project sync, or navigation help."
      />
    );
  }

  return (
    <div className="px-assistant-message-list" aria-live="polite">
      {messages.map((message) => (
        message.role === 'tool' ? (
          <div key={message.id} className="px-clio-tool-row" title={message.toolId ?? undefined}>
            <span aria-hidden="true">▸</span> {message.content}
          </div>
        ) : (
          <article key={message.id} className={`px-assistant-message role-${message.role}`}>
            <div className="px-assistant-message-marker">{roleIcon(message.role, message.status)}</div>
            <div className="px-assistant-message-main">
              <div className="px-assistant-message-content">{message.content}</div>
              <span className="px-clio-msg-time">
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {message.status && message.status !== 'done' ? ` · ${message.status}` : ''}
              </span>
            </div>
          </article>
        )
      ))}
      {streaming && (
        <div className="px-assistant-stream-indicator">
          <span className="px-dot pulse" />
          <span>Clio is thinking…</span>
        </div>
      )}
    </div>
  );
}

function roleIcon(role: AssistantMessageRole, status?: AssistantUiMessage['status']) {
  if (role === 'error' || status === 'failed') return <IconClose s={14} />;
  if (status === 'streaming' || status === 'pending') return <IconSync s={14} />;
  return <IconBridge s={14} />;
}
