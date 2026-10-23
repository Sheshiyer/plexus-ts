import React from 'react';
import { Button } from './ui';

export default function AssistantGrowthRequest({ request, refreshing, onRefresh }: {
  request: Record<string, unknown>; refreshing: boolean; onRefresh: () => void;
}) {
  return (
    <section className="px-assistant-action-result" aria-label="Hermes growth request" aria-live="polite">
      <strong>Hermes growth request</strong>
      <p>Request {String(request.id)} · {String(request.status)}</p>
      <p>{String(request.objective ?? '')}</p>
      {request.result != null && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(request.result, null, 2).slice(0, 16000)}</pre>}
      <Button disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Checking…' : 'Refresh status'}</Button>
    </section>
  );
}
