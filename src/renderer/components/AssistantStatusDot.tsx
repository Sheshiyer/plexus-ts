import React, { useState } from 'react';
import { Button } from './ui';
import { IconSync } from './Icons';

export type ClioStatusTone = 'ready' | 'local' | 'error';

export interface AssistantStatusDotProps {
  tone: ClioStatusTone;
  runtimeLabel: string;
  runtimeMessage: string;
  provider: string;
  capabilityCount: number | null;
  contextGeneratedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * One dot replaces the old metric rails + status chips: green = runtime
 * ready with a model provider, amber = local/offline mode, red = error.
 * Everything else lives in the click-to-open popover.
 */
export default function AssistantStatusDot({
  tone, runtimeLabel, runtimeMessage, provider,
  capabilityCount, contextGeneratedAt, refreshing, onRefresh,
}: AssistantStatusDotProps) {
  const [open, setOpen] = useState(false);
  const toneLabel = tone === 'ready' ? 'Clio is ready' : tone === 'local' ? 'Offline mode' : 'Clio has a problem';
  return (
    <div className="px-clio-status">
      <button
        type="button"
        className={`px-clio-status-dot tone-${tone}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Clio status: ${toneLabel}`}
        title={toneLabel}
      />
      {open && (
        <div className="px-clio-status-pop" role="dialog" aria-label="Clio status details">
          <strong>{toneLabel}</strong>
          <p>{runtimeMessage}</p>
          <dl>
            <div><dt>runtime</dt><dd>{runtimeLabel}</dd></div>
            <div><dt>model</dt><dd>{provider}</dd></div>
            <div><dt>capabilities</dt><dd>{capabilityCount ?? '—'}</dd></div>
            <div><dt>context</dt><dd>{contextGeneratedAt ? new Date(contextGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'not loaded'}</dd></div>
          </dl>
          <Button variant="ghost" onClick={onRefresh} disabled={refreshing}>
            <IconSync s={13} /> {refreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      )}
    </div>
  );
}
