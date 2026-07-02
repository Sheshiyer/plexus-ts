import React, { useMemo, useState } from 'react';
import type { AssistantContextScope } from '../../shared/types';
import { Button, Textarea } from './ui';
import { IconPlay } from './Icons';

interface Props {
  disabled?: boolean;
  streaming?: boolean;
  onSubmit: (message: string, scopes: AssistantContextScope[]) => Promise<void> | void;
}

const SCOPE_OPTIONS: { key: AssistantContextScope; label: string }[] = [
  { key: 'today', label: 'today' },
  { key: 'week', label: 'week' },
  { key: 'project', label: 'project' },
  { key: 'session_group', label: 'sessions' },
  { key: 'infra', label: 'infra' },
  { key: 'app', label: 'app' },
];

export default function AssistantComposer({ disabled, streaming, onSubmit }: Props) {
  const [draft, setDraft] = useState('');
  const [scopes, setScopes] = useState<AssistantContextScope[]>(['today', 'project', 'session_group', 'infra', 'app']);
  const canSend = useMemo(() => draft.trim().length > 0 && scopes.length > 0 && !disabled && !streaming, [disabled, draft, scopes.length, streaming]);

  const submit = async () => {
    if (!canSend) return;
    const message = draft.trim();
    setDraft('');
    await onSubmit(message, scopes);
  };

  return (
    <div className="px-assistant-composer">
      <div className="px-assistant-scope-strip" role="group" aria-label="Assistant context scopes">
        {SCOPE_OPTIONS.map((scope) => {
          const checked = scopes.includes(scope.key);
          return (
            <label key={scope.key} className={`px-assistant-scope${checked ? ' on' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setScopes((current) => checked ? current.filter((item) => item !== scope.key) : [...current, scope.key])}
              />
              <span>{scope.label}</span>
            </label>
          );
        })}
      </div>
      <div className="px-assistant-compose-row">
        <Textarea
          value={draft}
          placeholder="Ask Plexus to inspect today, review sessions, prepare proof, navigate, or sync projects."
          disabled={disabled || streaming}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <Button onClick={submit} disabled={!canSend}>
          <IconPlay s={14} /> {streaming ? 'Working' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
