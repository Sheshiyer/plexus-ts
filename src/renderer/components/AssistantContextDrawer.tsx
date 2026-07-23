import React from 'react';
import { IconBridge } from './Icons';
import {
  EmptyStatePanel,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  StatusChip,
  type PlexusTone,
} from './PlexusUI';

export interface AssistantContextSection {
  key: string;
  label: string;
  included: boolean;
  count?: number | string;
  detail?: string;
  truncated?: boolean;
  tone?: PlexusTone;
}

export interface AssistantOptionalHelperStatus {
  label: string;
  state: string;
  detail?: string;
  tone?: PlexusTone;
}

interface Props {
  sections: AssistantContextSection[];
  helpers: AssistantOptionalHelperStatus[];
  generatedAt?: string | null;
  loading?: boolean;
}

export default function AssistantContextDrawer({ sections, helpers, generatedAt, loading }: Props) {
  const included = sections.filter((section) => section.included);
  const truncated = sections.filter((section) => section.truncated).length;

  return (
    <InstrumentPanel
      label="context drawer"
      title="Bounded local context"
      note="Counts and budgets only; raw session text stays out of the renderer summary."
      actions={<StatusChip tone={loading ? 'warning' : 'accent'}>{loading ? 'refreshing' : generatedAt ? 'fresh' : 'local'}</StatusChip>}
      trace
    >
      <MetricRailGroup className="px-assistant-context-metrics">
        <MetricRail label="included" value={included.length} tone="accent" hint="sections" />
        <MetricRail label="truncated" value={truncated} tone={truncated ? 'warning' : 'idle'} hint="budgets" />
        <MetricRail label="updated" value={generatedAt ? new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'pending'} tone="mint" hint="snapshot" />
      </MetricRailGroup>

      {sections.length === 0 ? (
        <EmptyStatePanel
          icon={<IconBridge s={24} />}
          title="Context is not loaded"
          message="Clio can still answer in offline mode using local data."
        />
      ) : (
        <Ledger>
          {sections.map((section, index) => (
            <LedgerRail
              key={section.key}
              index={String(index + 1).padStart(2, '0')}
              marker={<span className="px-swatch" style={{ background: section.included ? 'var(--accent)' : 'var(--t4)' }} />}
              title={section.label}
              meta={section.detail ?? 'bounded summary'}
              status={section.included ? 'included' : 'skipped'}
              statusTone={section.included ? section.tone ?? 'accent' : 'idle'}
              value={typeof section.count === 'undefined' ? undefined : section.count}
            />
          ))}
        </Ledger>
      )}

      <div className="px-assistant-helper-band">
        <div className="px-lbl">optional helpers</div>
        {helpers.length === 0 ? (
          <p>Fabric and Paperclip status will appear separately when available.</p>
        ) : (
          helpers.map((helper) => (
            <div key={helper.label} className="px-assistant-helper-row">
              <StatusChip tone={helper.tone ?? 'idle'}>{helper.state}</StatusChip>
              <span>{helper.label}</span>
              {helper.detail && <small>{helper.detail}</small>}
            </div>
          ))
        )}
      </div>
    </InstrumentPanel>
  );
}
