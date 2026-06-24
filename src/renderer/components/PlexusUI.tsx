import React from 'react';
import { Button, Crosshairs, SectionLabel } from './ui';

export type PlexusTone = 'accent' | 'mint' | 'warning' | 'error' | 'idle';

export function middleTruncate(value: string, max = 44): string {
  if (value.length <= max) return value;
  const head = Math.max(12, Math.ceil((max - 3) * 0.58));
  const tail = Math.max(8, max - 3 - head);
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function StatusChip({
  tone = 'idle',
  children,
  title,
}: {
  tone?: PlexusTone;
  children: React.ReactNode;
  title?: string;
}) {
  return <span className={`pxds-chip tone-${tone}`} title={title}>{children}</span>;
}

export function CommandDock({
  children,
  align = 'end',
  compact,
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
  compact?: boolean;
}) {
  return <div className={`pxds-command-dock align-${align}${compact ? ' compact' : ''}`}>{children}</div>;
}

export function FieldDock({ children }: { children: React.ReactNode }) {
  return <div className="pxds-field-dock">{children}</div>;
}

export function InstrumentPanel({
  label,
  title,
  note,
  actions,
  children,
  className = '',
  trace,
}: {
  label: string;
  title?: React.ReactNode;
  note?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  trace?: boolean;
}) {
  return (
    <section className={`pxds-panel${trace ? ' trace' : ''} ${className}`}>
      <Crosshairs />
      <div className="pxds-panel-head">
        <div className="pxds-panel-copy">
          <SectionLabel>{label}</SectionLabel>
          {title && <div className="pxds-panel-title">{title}</div>}
          {note && <div className="pxds-panel-note">{note}</div>}
        </div>
        {actions && <CommandDock>{actions}</CommandDock>}
      </div>
      <div className="pxds-panel-body">{children}</div>
    </section>
  );
}

export function MetricRailGroup({ children }: { children: React.ReactNode }) {
  return <div className="pxds-metric-grid">{children}</div>;
}

export function MetricRail({
  label,
  value,
  hint,
  tone = 'idle',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: PlexusTone;
}) {
  return (
    <div className={`pxds-metric tone-${tone}`}>
      <span className="pxds-metric-label">{label}</span>
      <span className="pxds-metric-value">{value}</span>
      {hint && <span className="pxds-metric-hint">{hint}</span>}
    </div>
  );
}

export function Ledger({ children }: { children: React.ReactNode }) {
  return <div className="pxds-ledger">{children}</div>;
}

export function LedgerRail({
  index,
  marker,
  icon,
  title,
  meta,
  status,
  statusTone = 'idle',
  value,
  action,
  wrapTitle,
}: {
  index?: React.ReactNode;
  marker?: React.ReactNode;
  icon?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  statusTone?: PlexusTone;
  value?: React.ReactNode;
  action?: React.ReactNode;
  wrapTitle?: boolean;
}) {
  return (
    <div className={`pxds-ledger-rail${wrapTitle ? ' wrap-title' : ''}`}>
      <div className="pxds-ledger-index">
        {index && <span className="pxds-ledger-index-label">{index}</span>}
        {(marker || icon) && <span className="pxds-ledger-marker">{marker ?? icon}</span>}
      </div>
      <div className="pxds-ledger-main">
        <div className="pxds-ledger-title">{title}</div>
        {meta && <div className="pxds-ledger-meta">{meta}</div>}
      </div>
      {status && <StatusChip tone={statusTone}>{status}</StatusChip>}
      {value && <div className="pxds-ledger-value">{value}</div>}
      {action && <div className="pxds-ledger-action">{action}</div>}
    </div>
  );
}

export function EmptyStatePanel({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="pxds-empty">
      {icon && <div className="pxds-empty-icon">{icon}</div>}
      <div>
        <div className="pxds-empty-title">{title}</div>
        {message && <div className="pxds-empty-message">{message}</div>}
      </div>
      {action && <div className="pxds-empty-action">{action}</div>}
    </div>
  );
}

export function DegradedStatePanel({
  title,
  message,
  tone = 'warning',
  lastGoodAt,
  onRetry,
  busy,
}: {
  title: string;
  message: React.ReactNode;
  tone?: PlexusTone;
  lastGoodAt?: string | null;
  onRetry?: () => void;
  busy?: boolean;
}) {
  return (
    <div className={`pxds-degraded tone-${tone}`}>
      <div className="pxds-degraded-copy">
        <StatusChip tone={tone}>{title}</StatusChip>
        <div className="pxds-degraded-message">{message}</div>
        {lastGoodAt && (
          <div className="pxds-degraded-meta">last good {new Date(lastGoodAt).toLocaleTimeString()}</div>
        )}
      </div>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry} disabled={busy}>
          {busy ? 'Retrying' : 'Retry'}
        </Button>
      )}
    </div>
  );
}
