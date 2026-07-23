import React from 'react';
import { Button, Crosshairs, SectionLabel } from './ui';

export type PlexusTone = 'accent' | 'mint' | 'warning' | 'error' | 'idle';
export type LayoutDensity = 'compact' | 'standard' | 'dense';
export type LayoutSpan = 'auto' | 'full';
export type EmptyStateVariant = 'no-records' | 'no-rooms' | 'no-backups' | 'no-tasks';
export type DegradedStateVariant = 'offline' | 'sync-failed' | 'repo-missing' | 'proof-inaccessible';
export type PlexusStatusState =
  | 'verified'
  | 'connected'
  | 'matched'
  | 'pending'
  | 'needs_repo'
  | 'inaccessible'
  | 'offline'
  | 'warning'
  | 'error'
  | 'idle'
  | 'skipped';

export type PageViewportKind =
  | 'focus'
  | 'records'
  | 'projects'
  | 'reports'
  | 'export'
  | 'fabric'
  | 'coworking'
  | 'backups'
  | 'preferences'
  | 'admin';

export const PAGE_VIEWPORTS: Record<PageViewportKind, {
  label: string;
  archetype: string;
  primaryBand: string;
  secondaryBand: string;
}> = {
  focus: {
    label: 'Focus',
    archetype: 'command viewport',
    primaryBand: 'session instrument',
    secondaryBand: 'proof and suggestion ledger',
  },
  records: {
    label: 'Work Records',
    archetype: 'ledger viewport',
    primaryBand: 'time ledger',
    secondaryBand: 'entry detail band',
  },
  projects: {
    label: 'Projects',
    archetype: 'proof coverage viewport',
    primaryBand: 'project coverage grid',
    secondaryBand: 'repository proof ledger',
  },
  reports: {
    label: 'Reports',
    archetype: 'review viewport',
    primaryBand: 'KPI review rails',
    secondaryBand: 'breakdown ledger',
  },
  export: {
    label: 'Export',
    archetype: 'utility extraction viewport',
    primaryBand: 'export field dock',
    secondaryBand: 'output preview rail',
  },
  fabric: {
    label: 'Fabric',
    archetype: 'operations viewport',
    primaryBand: 'assignment operations grid',
    secondaryBand: 'diagnostics ledger',
  },
  coworking: {
    label: 'Co-working',
    archetype: 'social floor viewport',
    primaryBand: 'room stage',
    secondaryBand: 'presence and proof bands',
  },
  backups: {
    label: 'Backups',
    archetype: 'restore vault viewport',
    primaryBand: 'snapshot ledger',
    secondaryBand: 'restore detail band',
  },
  preferences: {
    label: 'Preferences',
    archetype: 'member profile viewport',
    primaryBand: 'preference field dock',
    secondaryBand: 'local profile detail',
  },
  admin: {
    label: 'Admin',
    archetype: 'oversight viewport',
    primaryBand: 'proof cockpit',
    secondaryBand: 'diagnostic ledger',
  },
};

export const PLEXUS_STATUS_TONE: Record<PlexusStatusState, PlexusTone> = {
  verified: 'accent',
  connected: 'accent',
  matched: 'mint',
  pending: 'warning',
  needs_repo: 'warning',
  inaccessible: 'error',
  offline: 'idle',
  warning: 'warning',
  error: 'error',
  idle: 'idle',
  skipped: 'idle',
};

export const PLEXUS_EMPTY_STATE_VARIANTS: Record<EmptyStateVariant, {
  title: string;
  message: string;
}> = {
  'no-records': {
    title: 'No work records in this range',
    message: 'Change the date window or start a repo-backed Today session to populate the ledger.',
  },
  'no-rooms': {
    title: 'No project rooms configured yet',
    message: 'Workspace rooms appear once project room state is available.',
  },
  'no-backups': {
    title: 'No backups have been created yet',
    message: 'Create the first local snapshot before making high-risk data changes.',
  },
  'no-tasks': {
    title: 'No task assignments',
    message: 'New assignments appear here when task updates are connected.',
  },
};

export const PLEXUS_DEGRADED_STATE_VARIANTS: Record<DegradedStateVariant, {
  title: string;
  message: string;
  tone: PlexusTone;
}> = {
  offline: {
    title: 'Source offline',
    message: 'The last known local state remains visible while this source reconnects.',
    tone: 'warning',
  },
  'sync-failed': {
    title: 'Sync failed',
    message: 'The attempted refresh failed; retry after checking the source connection.',
    tone: 'error',
  },
  'repo-missing': {
    title: 'Repo proof missing',
    message: 'Add a verified GitHub repository before creating proof-backed work.',
    tone: 'warning',
  },
  'proof-inaccessible': {
    title: 'Proof inaccessible',
    message: 'The proof source could not be reached or verified for this record.',
    tone: 'error',
  },
};

export function middleTruncate(value: string, max = 44): string {
  if (value.length <= max) return value;
  const head = Math.max(12, Math.ceil((max - 3) * 0.58));
  const tail = Math.max(8, max - 3 - head);
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function textValue(value: React.ReactNode): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

export function statusStateTone(state: PlexusStatusState = 'idle'): PlexusTone {
  return PLEXUS_STATUS_TONE[state] ?? 'idle';
}

export function PageViewport({
  kind,
  children,
  className = '',
}: {
  kind: PageViewportKind;
  children: React.ReactNode;
  className?: string;
}) {
  const viewport = PAGE_VIEWPORTS[kind];
  return (
    <div
      className={`pxds-page-viewport viewport-${kind}${className ? ` ${className}` : ''}`}
      data-viewport={kind}
      data-archetype={viewport.archetype}
    >
      {children}
    </div>
  );
}

export function OverflowText({
  value,
  max = 44,
  title,
  className = '',
  wrap,
  as = 'span',
}: {
  value: React.ReactNode;
  max?: number;
  title?: string;
  className?: string;
  wrap?: boolean;
  as?: 'span' | 'div';
}) {
  const raw = textValue(value);
  const display = raw && !wrap ? middleTruncate(raw, max) : value;
  const Tag = as;

  return (
    <Tag
      className={`pxds-overflow-text${wrap ? ' wrap' : ''}${className ? ` ${className}` : ''}`}
      title={title ?? raw}
    >
      {display}
    </Tag>
  );
}

export function StatusChip({
  tone,
  state,
  children,
  title,
}: {
  tone?: PlexusTone;
  state?: PlexusStatusState;
  children: React.ReactNode;
  title?: string;
}) {
  const chipTone = tone ?? statusStateTone(state);
  const chipTitle = title ?? textValue(children);
  return <span className={`pxds-chip tone-${chipTone}${state ? ` state-${state}` : ''}`} title={chipTitle}>{children}</span>;
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
  density = 'standard',
  span,
}: {
  label: string;
  title?: React.ReactNode;
  note?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  trace?: boolean;
  density?: LayoutDensity;
  span?: LayoutSpan;
}) {
  const resolvedSpan = span ?? (density === 'dense' ? 'full' : 'auto');

  return (
    <section
      className={`pxds-panel${trace ? ' trace' : ''} ${className}`}
      data-layout-density={density}
      data-layout-span={resolvedSpan}
    >
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

export function MetricRailGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`pxds-metric-grid${className ? ` ${className}` : ''}`}>{children}</div>;
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
      <span className="pxds-metric-label" title={label}>{label}</span>
      <span className="pxds-metric-value" title={textValue(value)}>{value}</span>
      {hint && <span className="pxds-metric-hint" title={textValue(hint)}>{hint}</span>}
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
  const titleText = textValue(title);
  const metaText = textValue(meta);
  const valueText = textValue(value);
  const shouldWrapTitle = wrapTitle ?? true;

  return (
    <div className={`pxds-ledger-rail${shouldWrapTitle ? ' wrap-title' : ''}`}>
      <div className="pxds-ledger-index">
        {index && <span className="pxds-ledger-index-label">{index}</span>}
        {(marker || icon) && <span className="pxds-ledger-marker">{marker ?? icon}</span>}
      </div>
      <div className="pxds-ledger-main">
        {titleText
          ? <OverflowText as="div" value={titleText} className="pxds-ledger-title" wrap={shouldWrapTitle} title={titleText} />
          : <div className="pxds-ledger-title">{title}</div>}
        {meta && (metaText
          ? <OverflowText as="div" value={metaText} className="pxds-ledger-meta" wrap title={metaText} />
          : <div className="pxds-ledger-meta">{meta}</div>)}
      </div>
      {status && <StatusChip tone={statusTone}>{status}</StatusChip>}
      {value && (valueText
        ? <OverflowText as="div" value={valueText} className="pxds-ledger-value" wrap title={valueText} />
        : <div className="pxds-ledger-value">{value}</div>)}
      {action && <div className="pxds-ledger-action">{action}</div>}
    </div>
  );
}

export function EmptyStatePanel({
  variant,
  icon,
  title,
  message,
  action,
}: {
  variant?: EmptyStateVariant;
  icon?: React.ReactNode;
  title?: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const design = variant ? PLEXUS_EMPTY_STATE_VARIANTS[variant] : undefined;
  const resolvedTitle = title ?? design?.title ?? 'Nothing here yet';
  const resolvedMessage = message ?? design?.message;

  return (
    <div className={`pxds-empty${variant ? ` variant-${variant}` : ''}`}>
      {icon && <div className="pxds-empty-icon">{icon}</div>}
      <div>
        <div className="pxds-empty-title">{resolvedTitle}</div>
        {resolvedMessage && <div className="pxds-empty-message">{resolvedMessage}</div>}
      </div>
      {action && <div className="pxds-empty-action">{action}</div>}
    </div>
  );
}

export function DegradedStatePanel({
  variant,
  title,
  message,
  tone,
  lastGoodAt,
  onRetry,
  busy,
}: {
  variant?: DegradedStateVariant;
  title?: string;
  message?: React.ReactNode;
  tone?: PlexusTone;
  lastGoodAt?: string | null;
  onRetry?: () => void;
  busy?: boolean;
}) {
  const design = variant ? PLEXUS_DEGRADED_STATE_VARIANTS[variant] : undefined;
  const resolvedTone = tone ?? design?.tone ?? 'warning';
  const resolvedTitle = title ?? design?.title ?? 'Source needs attention';
  const resolvedMessage = message ?? design?.message ?? 'Retry when the source is available.';

  return (
    <div className={`pxds-degraded tone-${resolvedTone}${variant ? ` variant-${variant}` : ''}`}>
      <div className="pxds-degraded-copy">
        <StatusChip tone={resolvedTone}>{resolvedTitle}</StatusChip>
        <div className="pxds-degraded-message">{resolvedMessage}</div>
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
