import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconReports, IconSync } from './Icons';
import { Button, Skeleton } from './ui';
import {
  DegradedStatePanel,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  StatusChip,
  type PlexusTone,
} from './PlexusUI';
import type { GrowthCellStatus, GrowthOverview } from '../../shared/types';
import './GrowthOverviewPanel.css';

const STATUS_LABELS: Record<GrowthCellStatus, string> = {
  empty: 'empty',
  inbox: 'inbox',
  draft: 'draft',
  graded: 'graded',
  approved: 'approved source',
  published: 'published source',
  held: 'held',
  stale: 'stale',
  pointer: 'pointer',
};

const STATUS_ORDER: Record<GrowthCellStatus, number> = {
  graded: 0,
  approved: 1,
  draft: 2,
  inbox: 3,
  stale: 4,
  held: 5,
  pointer: 6,
  empty: 7,
  published: 8,
};

function statusTone(status: GrowthCellStatus): PlexusTone {
  if (status === 'approved' || status === 'published') return 'accent';
  if (status === 'graded') return 'mint';
  if (status === 'held' || status === 'stale' || status === 'inbox' || status === 'draft') return 'warning';
  return 'idle';
}

function formatCheckedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'checked now' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function GrowthOverviewPanel() {
  const [overview, setOverview] = useState<GrowthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOverview(await window.plexus.growthOverview());
    } catch (err) {
      setOverview(null);
      setError(err instanceof Error ? err.message : 'Growth overview unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cells = useMemo(() => (overview?.cells ?? []).slice().sort((a, b) => (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.title.localeCompare(b.title)
  )), [overview]);

  if (loading && !overview) {
    return (
      <div className="px-growth-overview">
        <InstrumentPanel label="growth / source boundary" title="Reading local Growth state" trace>
          <Skeleton lines={7} />
        </InstrumentPanel>
      </div>
    );
  }

  if (error || !overview || overview.source.state !== 'ready') {
    return (
      <div className="px-growth-overview">
        <InstrumentPanel
          label="growth / source boundary"
          title="Growth stays source-backed"
          note="Plexus reads a bounded local projection only. It does not create a parallel task list or open a delivery path."
          actions={<Button variant="ghost" onClick={() => { void load(); }} disabled={loading}><IconSync s={14} /> {loading ? 'Refreshing' : 'Refresh'}</Button>}
          trace
        >
          <DegradedStatePanel
            title={error ? 'Growth overview unavailable' : 'Growth source unavailable'}
            message={error || overview?.source.message || 'No Growth records were loaded.'}
            tone={overview?.source.state === 'invalid' ? 'error' : 'warning'}
            onRetry={() => { void load(); }}
            busy={loading}
          />
        </InstrumentPanel>
      </div>
    );
  }

  if (!overview.pack) {
    return (
      <div className="px-growth-overview">
        <DegradedStatePanel
          title="Growth pack unavailable"
          message="The Growth source did not provide a verified pack projection, so no records are shown."
          tone="error"
          onRetry={() => { void load(); }}
          busy={loading}
        />
      </div>
    );
  }

  const { counts, pack } = overview;
  return (
    <div className="px-growth-overview">
      <InstrumentPanel
        label="growth / local source"
        title="Growth is a typed vault projection"
        note="This view shows source-backed cell metadata for founder review. It never reads draft bodies into the renderer, changes a cell, approves a row, or sends a campaign."
        actions={<Button variant="ghost" onClick={() => { void load(); }} disabled={loading}><IconSync s={14} /> {loading ? 'Refreshing' : 'Refresh'}</Button>}
        trace
      >
        <div className="px-growth-source-line">
          <StatusChip tone="mint">local-only source</StatusChip>
          <span>{overview.source.message}</span>
          <time dateTime={overview.source.checkedAt}>checked {formatCheckedAt(overview.source.checkedAt)}</time>
        </div>
      </InstrumentPanel>

      <MetricRailGroup className="px-growth-metrics">
        <MetricRail label="typed cells" value={cells.length} hint="vault metadata" tone="mint" />
        <MetricRail label="graded source" value={counts.graded} hint="not approved" tone={counts.graded > 0 ? 'mint' : 'idle'} />
        <MetricRail label="held" value={counts.held} hint="source hold" tone={counts.held > 0 ? 'warning' : 'idle'} />
        <MetricRail label="external gate" value={overview.founderReviewCount} hint="after-approve only" tone={overview.founderReviewCount > 0 ? 'warning' : 'idle'} />
      </MetricRailGroup>

      <div className="px-growth-layout">
        <InstrumentPanel
          label="typed cell state"
          title="What the Growth source currently says"
          note="Status is shown exactly as source metadata. A graded record is not an approved or sent record."
          actions={<StatusChip tone="idle">{pack.slug}</StatusChip>}
        >
          <Ledger>
            {cells.map((cell, index) => (
              <LedgerRail
                key={cell.id}
                index={String(index + 1).padStart(2, '0')}
                icon={<IconReports s={12} />}
                title={cell.title}
                meta={`${cell.role} · ${cell.organ}${cell.willDesk ? ` · ${cell.willDesk}` : ''}`}
                status={STATUS_LABELS[cell.status]}
                statusTone={statusTone(cell.status)}
                value={cell.publicGate === 'after-approve' ? 'external approval gate' : 'not public'}
              />
            ))}
          </Ledger>
        </InstrumentPanel>

        <div className="px-growth-side-rail">
          <InstrumentPanel
            density="dense"
            label="authority boundary"
            title="Reading is not action"
            note="The Growth vault keeps its own spines, fence, and calendar. Plexus keeps role-aware human state."
          >
            <dl className="px-growth-boundaries">
              <div><dt>Approval</dt><dd>Founder-owned outside this view.</dd></div>
              <div><dt>Delivery</dt><dd>No provider adapter or outbound transport is exposed.</dd></div>
              <div><dt>Tasks</dt><dd>Live team work remains in existing Plexus flows.</dd></div>
            </dl>
          </InstrumentPanel>

          <InstrumentPanel
            density="dense"
            label="pack"
            title={pack.slug}
            note="The source pack defines the platform context; it does not arm a channel."
          >
            <div className="px-growth-platforms" aria-label="Source pack platforms">
              {pack.platforms.map((platform) => <StatusChip key={platform} tone="idle">{platform}</StatusChip>)}
            </div>
          </InstrumentPanel>
        </div>
      </div>
    </div>
  );
}
