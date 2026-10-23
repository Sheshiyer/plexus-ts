import React, { useState } from 'react';
import type { AssistantToolId, AssistantToolSafety } from '../../shared/types';
import { Button, Modal } from './ui';
import { IconCheck, IconClose } from './Icons';
import { StatusChip } from './PlexusUI';
import { GROWTH_SOURCE_LABELS } from './AssistantGrowthRequest';

export interface AssistantPendingIntent {
  id: string;
  intentId?: string;
  toolId: AssistantToolId;
  title: string;
  body?: string;
  payload: Record<string, unknown>;
  safety: AssistantToolSafety;
  suggestionId?: string;
}

export interface AssistantActionResult {
  ok: boolean;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

interface AssistantActionApi {
  assistantGrowthRetry?: (intentId: string) => Promise<{ intentId: string }>;
  assistantConfirmIntent?: (intentId: string) => Promise<unknown>;
  assistantCancelIntent?: (intentId: string) => Promise<unknown>;
}

interface Props {
  intent: AssistantPendingIntent;
  onClose: () => void;
  onResult: (result: AssistantActionResult) => void;
}

export default function AssistantActionConfirmModal({ intent, onClose, onResult }: Props) {
  const [activeIntentId, setActiveIntentId] = useState(intent.intentId);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [result, setResult] = useState<AssistantActionResult | null>(null);

  const finish = (next: AssistantActionResult) => {
    setResult(next);
    onResult(next);
  };

  const confirm = async () => {
    if (busy || result) return;
    setBusy('confirm');
    try {
      const api = window.plexus as typeof window.plexus & AssistantActionApi;
      if (activeIntentId && typeof api.assistantConfirmIntent === 'function') {
        const execution = await api.assistantConfirmIntent(activeIntentId) as { result?: Record<string, unknown> };
        finish({ ok: true, title: intent.title, message: intent.toolId === 'org.handoff' ? 'Growth request accepted. Check its status below; acceptance is not completion.' : 'Clio action confirmed.', data: execution.result });
        return;
      }
      throw new Error('Assistant action requires a persisted intent before it can change app state.');
    } catch (err: any) {
      finish({ ok: false, title: intent.title, message: err?.message ?? String(err) });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (busy || result) return;
    setBusy('cancel');
    try {
      const api = window.plexus as typeof window.plexus & AssistantActionApi;
      if (activeIntentId && typeof api.assistantCancelIntent === 'function') {
        await api.assistantCancelIntent(activeIntentId);
      }
      finish({ ok: true, title: intent.title, message: 'Clio action cancelled.' });
    } catch (err: any) {
      finish({ ok: false, title: intent.title, message: err?.message ?? String(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Confirm Clio action" onClose={busy ? undefined : onClose} width={560}>
      <div className="px-assistant-confirm">
        <div className="px-assistant-confirm-head">
          <StatusChip tone={intent.safety === 'admin_only' ? 'warning' : intent.safety === 'confirm_required' ? 'accent' : 'mint'}>
            {safetyLabel(intent.safety)}
          </StatusChip>
          <div>
            <h4>{intent.title}</h4>
            {intent.body && <p>{intent.body}</p>}
          </div>
        </div>

        {intent.toolId === 'org.handoff' ? (
          <div className="px-assistant-confirm-body">
            <p><strong>Internal draft only</strong> · Hermes may prepare a draft. This confirmation does not authorize publishing, contacting anyone, or other external actions.</p>
            <dl className="px-assistant-payload-list">
              <dt>Objective</dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{String(intent.payload.objective ?? '')}</dd>
              <dt>Responsible role</dt><dd>{String(intent.payload.role ?? '').replace(/^./, c => c.toUpperCase())}</dd>
              <dt>Context sources</dt><dd>{Array.isArray(intent.payload.contextRefs) && intent.payload.contextRefs.filter((ref): ref is string => typeof ref === 'string' && !!GROWTH_SOURCE_LABELS[ref]).map(ref => <details key={ref}><summary>{GROWTH_SOURCE_LABELS[ref]}</summary><small>{ref}</small></details>)}</dd>
            </dl>
            <details><summary>Request details</summary><p>Request {String(intent.payload.requestId ?? '')}</p><p>Organization growth drafting</p></details>
          </div>
        ) : (
        <div className="px-assistant-confirm-body">
          <div className="px-lbl">Tool</div>
          <div className="px-assistant-confirm-tool">{intent.toolId}</div>
          <div className="px-lbl">Payload summary</div>
          <dl className="px-assistant-payload-list">
            {payloadPairs(intent.payload).map(([key, value]) => (
              <React.Fragment key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
        )}

        {result && (
          <div className={`px-assistant-action-result ${result.ok ? 'ok' : 'err'}`}>
            <StatusChip tone={result.ok ? 'accent' : 'error'}>{result.ok ? intent.toolId === 'org.handoff' ? result.data ? 'accepted' : 'cancelled' : 'completed' : 'blocked'}</StatusChip>
            <span>{result.message}</span>
          </div>
        )}

        {intent.toolId === 'org.handoff' && result && !result.ok && <p>A response may have been lost after acceptance. Retry preserves this request ID and objective, so Hermes will not receive a second task. You will confirm again.</p>}
        {retryError && <p role="alert">{retryError}</p>}
        <div className="px-assistant-confirm-actions">
          {result ? (
            <>
              {intent.toolId === 'org.handoff' && !result.ok && activeIntentId && <Button disabled={busy !== null} onClick={async () => {
                setBusy('confirm'); setRetryError(null);
                try {
                  const api = window.plexus as typeof window.plexus & AssistantActionApi;
                  if (!api.assistantGrowthRetry) throw new Error('Growth recovery is unavailable.');
                  const next = await api.assistantGrowthRetry(activeIntentId);
                  setActiveIntentId(next.intentId); setResult(null);
                } catch (error) { setRetryError(error instanceof Error ? error.message : 'Could not prepare recovery.'); }
                finally { setBusy(null); }
              }}>Review same request again</Button>}
              <Button onClick={onClose}><IconCheck s={14} /> Done</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={cancel} disabled={busy !== null}>
                <IconClose s={14} /> {busy === 'cancel' ? 'Cancelling' : 'Cancel'}
              </Button>
              <Button onClick={confirm} disabled={busy !== null}>
                <IconCheck s={14} /> {busy === 'confirm' ? 'Confirming' : 'Confirm'}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function safetyLabel(safety: AssistantToolSafety): string {
  if (safety === 'read_only') return 'read only';
  if (safety === 'admin_only') return 'admin action';
  return 'confirmation required';
}

function payloadPairs(payload: Record<string, unknown>): [string, string][] {
  const entries = Object.entries(payload).filter(([key]) => !key.startsWith('_')).slice(0, 8).map(([key, value]): [string, string] => {
    if (/token|authorization|cookie|jwt|signature|secret/i.test(key)) return [key, '[redacted]'];
    return [key, compactValue(value)];
  });
  return entries.length ? entries : [['scope', 'no payload fields']];
}

function compactValue(value: unknown): string {
  if (value === null || typeof value === 'undefined') return 'none';
  if (typeof value === 'string') return value.length > 96 ? `${value.slice(0, 93)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return `${Object.keys(value as Record<string, unknown>).length} fields`;
  return String(value);
}
