import React from 'react';
import { Button } from './ui';
import './AssistantGrowthRequest.css';

export const GROWTH_SOURCE_LABELS: Record<string, string> = {
  '20-operations/growth/README.md': 'Growth operating model',
  '20-operations/growth/department/execution-map.md': 'Department execution map',
  '20-operations/growth/department/organ-map.md': 'Department roles',
  '20-operations/growth/department/workflows.md': 'Growth workflows',
};
const STATUS: Record<string, string> = {
  queued: 'Waiting for Hermes', running: 'Hermes is preparing your draft',
  retrying: 'Waiting to retry', failed: 'Could not prepare this draft', draft_ready: 'Draft ready for review',
};
export default function AssistantGrowthRequest({ request, refreshing, onRefresh }: {
  request: Record<string, unknown>; refreshing: boolean; onRefresh: () => void;
}) {
  const status = typeof request.status === 'string' ? request.status : '';
  const result = request.result && typeof request.result === 'object' ? request.result as Record<string, unknown> : null;
  const content = result?.schema === 'thoughtseed.growth.result.v1' && typeof result.content === 'string' ? result.content : null;
  const sources = result && Array.isArray(result.sources) ? result.sources.flatMap(source => {
    if (!source || typeof source !== 'object' || typeof source.path !== 'string' || !GROWTH_SOURCE_LABELS[source.path]) return [];
    return [{ path: source.path as string, label: GROWTH_SOURCE_LABELS[source.path] }];
  }) : [];
  return (
    <section className="px-growth-request" aria-label="Hermes growth request" aria-live="polite">
      <header className="px-growth-request-heading">{typeof request.objective === 'string' && <h3 style={{ margin: 0, overflowWrap: 'anywhere' }}>{request.objective}</h3>}<strong>{STATUS[status] ?? 'Checking request status'}</strong>{typeof request.role === 'string' && <p>Prepared by {request.role.replace(/^./, c => c.toUpperCase())}</p>}</header>
      {status === 'queued' && <p>Your request is accepted. The draft will appear here after Hermes finishes.</p>}
      {status === 'retrying' && <p>Hermes will retry this request automatically. Refresh to check for an update.</p>}
      {status === 'failed' && <p>This request has stopped. Ask Clio to review the objective and prepare a fresh handoff for confirmation.</p>}
      {content && (
        <article className="px-growth-request-draft" aria-label="Growth draft">
          <p><strong>Internal draft · review before external use</strong></p>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{content}</div>
          {sources.length > 0 && <div><strong>Sources</strong><ul>{sources.map(source => <li key={source.path}><span>{source.label}</span><br /><small>{source.path}</small></li>)}</ul></div>}
        </article>
      )}
      {status === 'draft_ready' && !content && <p>The draft could not be displayed. Refresh to retrieve it again.</p>}
      <footer className="px-growth-request-footer"><Button disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Checking…' : 'Refresh status'}</Button>
      <details><summary>Request details</summary><p>Request {String(request.id)}</p>{typeof request.updatedAt === 'string' && <p>Last updated {request.updatedAt}</p>}</details></footer>
    </section>
  );
}
