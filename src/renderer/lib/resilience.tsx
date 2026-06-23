import React, { useCallback, useState } from 'react';
import type { HandoffRecord, HandoffStatus } from '../../shared/types';
import { Badge, Button } from '../components/ui';
import { IconSync } from '../components/Icons';

export type AsyncLoadState<T> = {
  data: T | null;
  lastGoodAt: string | null;
  loading: boolean;
  error: string | null;
};

export function useLastGoodResource<T>(initial: T | null = null) {
  const [state, setState] = useState<AsyncLoadState<T>>({
    data: initial,
    lastGoodAt: initial ? new Date().toISOString() : null,
    loading: false,
    error: null,
  });

  const run = useCallback(async (loader: () => Promise<T>) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await loader();
      setState({
        data,
        lastGoodAt: new Date().toISOString(),
        loading: false,
        error: null,
      });
      return data;
    } catch (err: any) {
      setState((current) => ({
        ...current,
        loading: false,
        error: err?.message ?? String(err),
      }));
      return null;
    }
  }, []);

  const setData = useCallback((data: T) => {
    setState({
      data,
      lastGoodAt: new Date().toISOString(),
      loading: false,
      error: null,
    });
  }, []);

  return { state, run, setData };
}

export function formatLastGood(iso: string | null): string {
  if (!iso) return 'not loaded';
  return new Date(iso).toLocaleTimeString();
}

export function ResilienceNotice({
  title,
  message,
  lastGoodAt,
  onRetry,
  busy,
}: {
  title: string;
  message: string;
  lastGoodAt?: string | null;
  onRetry?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="px-resilience-notice" role="status">
      <div>
        <strong>{title}</strong>
        <span>{message}{lastGoodAt ? ` · showing ${formatLastGood(lastGoodAt)}` : ''}</span>
      </div>
      {onRetry && (
        <Button type="button" variant="ghost" onClick={onRetry} disabled={busy}>
          <IconSync s={12} /> {busy ? 'Retrying' : 'Retry'}
        </Button>
      )}
    </div>
  );
}

function handoffTone(status: HandoffStatus): 'bill' | 'mint' | 'rose' | undefined {
  if (status === 'sent') return 'mint';
  if (status === 'failed') return 'rose';
  if (status === 'pending' || status === 'retrying' || status === 'skipped') return 'bill';
  return undefined;
}

export function HandoffStatusBadge({ status }: { status: HandoffStatus }) {
  return <Badge tone={handoffTone(status)}>{status}</Badge>;
}

export function HandoffRow({
  record,
  onRetry,
  busy,
}: {
  record: HandoffRecord;
  onRetry?: (record: HandoffRecord) => void;
  busy?: boolean;
}) {
  return (
    <div className="px-handoff-row">
      <div style={{ minWidth: 0 }}>
        <div className="desc">{record.title}</div>
        <div className="meta">
          {record.kind} · attempts {record.attempts} · updated {new Date(record.updatedAt).toLocaleTimeString()}
        </div>
        {record.error && <div className="px-handoff-error">{record.error}</div>}
      </div>
      <HandoffStatusBadge status={record.status} />
      {(record.status === 'failed' || record.status === 'pending') && onRetry && (
        <Button type="button" variant="ghost" onClick={() => onRetry(record)} disabled={busy}>
          <IconSync s={12} /> Retry
        </Button>
      )}
    </div>
  );
}
