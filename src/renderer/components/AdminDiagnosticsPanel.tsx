import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminDemoOverview,
  AgentSessionScanResult,
  AssistantContextDiagnosticsSnapshot,
  AssistantDailyOutboxDiagnostics,
  AssistantDailyOutboxEventDiagnostic,
  AssistantModelUsageRecord,
  AssistantStatus,
  FabricStatus,
  ThoughtseedBridgeDirective,
  ThoughtseedBridgeStatus,
  UpdateStatus,
  VaultProjectScanResult,
  WorkerConfig,
} from '../../shared/types';
import { Button } from './ui';
import { IconSync } from './Icons';
import {
  CommandDock,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  StatusChip,
  middleTruncate,
  type PlexusTone,
} from './PlexusUI';

interface DiagnosticsState {
  workerConfig: WorkerConfig | null;
  workerStatus: { connected: boolean; message?: string } | null;
  updateStatus: UpdateStatus | null;
  bridgeStatus: ThoughtseedBridgeStatus | null;
  directives: ThoughtseedBridgeDirective[];
  fabricStatus: FabricStatus | null;
  assistantStatus: AssistantStatus | null;
  assistantContext: AssistantContextDiagnosticsSnapshot | null;
  assistantOutbox: AssistantDailyOutboxDiagnostics | null;
  assistantModelUsage: AssistantModelUsageRecord[] | null;
  assistantSessions: AgentSessionScanResult | null;
  vaultScan: VaultProjectScanResult | null;
  preferences: Record<string, unknown> | null;
  loadedAt: string;
  errors: string[];
}

interface DiagnosticRow {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: PlexusTone;
  copyValue?: string;
  sensitive?: boolean;
  highRiskCopy?: boolean;
  action?: React.ReactNode;
}

interface DiagnosticDisclosureProps {
  id: string;
  label: string;
  title: string;
  note?: string;
  count: number;
  statusText: string;
  statusTone: PlexusTone;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

const emptyDiagnostics = (): DiagnosticsState => ({
  workerConfig: null,
  workerStatus: null,
  updateStatus: null,
  bridgeStatus: null,
  directives: [],
  fabricStatus: null,
  assistantStatus: null,
  assistantContext: null,
  assistantOutbox: null,
  assistantModelUsage: null,
  assistantSessions: null,
  vaultScan: null,
  preferences: null,
  loadedAt: '',
  errors: [],
});

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function settledError<T>(label: string, result: PromiseSettledResult<T>): string | null {
  if (result.status === 'fulfilled') return null;
  const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
  return `${label}: ${reason}`;
}

function boolTone(value?: boolean | null): PlexusTone {
  if (value == null) return 'idle';
  return value ? 'accent' : 'warning';
}

function fallbackCopyText(value: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

function CopyValue({ value }: { value: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'idle') return;
    const timeout = window.setTimeout(() => {
      setStatus('idle');
      setMessage('');
    }, 2200);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        setStatus('copied');
        setMessage('Copied to clipboard.');
        return;
      }
      if (fallbackCopyText(value)) {
        setStatus('copied');
        setMessage('Copied with fallback clipboard path.');
        return;
      }
      setStatus('failed');
      setMessage('Copy blocked. Select text and copy manually.');
    } catch {
      if (fallbackCopyText(value)) {
        setStatus('copied');
        setMessage('Copied with fallback clipboard path.');
        return;
      }
      setStatus('failed');
      setMessage('Copy blocked. Select text and copy manually.');
    }
  }, [value]);

  const buttonLabel = status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Copy';

  return (
    <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
      <Button variant="ghost" onClick={() => void handleCopy()}>
        {buttonLabel}
      </Button>
      {message && <small style={{ opacity: 0.72 }}>{message}</small>}
    </div>
  );
}

function DiagnosticsLedger({ rows }: { rows: DiagnosticRow[] }) {
  const [revealedRows, setRevealedRows] = useState<Set<string>>(() => new Set());
  const toggleReveal = useCallback((id: string) => {
    setRevealedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <Ledger>
      {rows.map((row, index) => {
        const rowId = `${row.label}:${index}`;
        const copyValue = row.copyValue ?? (typeof row.value === 'string' ? row.value : undefined);
        const canReveal = Boolean(row.sensitive && copyValue);
        const revealed = canReveal && revealedRows.has(rowId);
        const value = canReveal && !revealed ? (
          <span>masked · {copyValue?.length ?? 0} chars</span>
        ) : row.value;
        const meta = (row.detail || row.highRiskCopy || row.sensitive) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {row.detail ? <span>{row.detail}</span> : null}
            {row.sensitive ? <StatusChip tone="warning">sensitive</StatusChip> : null}
            {row.highRiskCopy ? <StatusChip tone="warning">high-risk copy</StatusChip> : null}
          </div>
        ) : undefined;
        const action = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {row.action}
            {canReveal ? (
              <Button variant="ghost" onClick={() => toggleReveal(rowId)}>
                {revealed ? 'Hide sensitive' : 'Reveal sensitive'}
              </Button>
            ) : null}
            {copyValue ? <CopyValue value={copyValue} /> : null}
          </div>
        );

        return (
          <LedgerRail
            key={rowId}
            index={String(index + 1).padStart(2, '0')}
            title={row.label}
            meta={meta}
            value={value}
            status={row.tone && <span>{row.tone}</span>}
            statusTone={row.tone}
            action={copyValue || canReveal || row.action ? action : undefined}
            wrapTitle
          />
        );
      })}
    </Ledger>
  );
}

function DiagnosticDisclosure({
  id,
  label,
  title,
  note,
  count,
  statusText,
  statusTone,
  open,
  onToggle,
  children,
}: DiagnosticDisclosureProps) {
  return (
    <section className={`px-diagnostic-row ${open ? 'is-open' : 'is-collapsed'}`}>
      <button
        type="button"
        className="px-diagnostic-row-head"
        aria-expanded={open}
        aria-controls={`admin-diagnostic-${id}`}
        onClick={() => onToggle(id)}
      >
        <span className="px-diagnostic-row-marker" aria-hidden="true" />
        <span className="px-diagnostic-row-copy">
          <span className="eyebrow">{label}</span>
          <strong>{title}</strong>
          {note && <small>{note}</small>}
        </span>
        <span className="px-diagnostic-row-meta">
          <StatusChip tone="idle">{count} rows</StatusChip>
          <StatusChip tone={statusTone}>{statusText}</StatusChip>
        </span>
      </button>
      <div id={`admin-diagnostic-${id}`} className="px-diagnostic-row-body">
        <div className="px-diagnostic-row-body-inner">{children}</div>
      </div>
    </section>
  );
}

function textOrDash(value: unknown): string {
  if (value == null || value === '') return 'not set';
  return String(value);
}

function rowsTone(rows: DiagnosticRow[]): PlexusTone {
  if (rows.some((row) => row.tone === 'error')) return 'error';
  if (rows.some((row) => row.tone === 'warning')) return 'warning';
  if (rows.some((row) => row.tone === 'accent')) return 'accent';
  return 'idle';
}

function contextBudgetSummary(snapshot: AssistantContextDiagnosticsSnapshot | null): { value: string; detail: string; tone: PlexusTone } {
  if (!snapshot) return { value: 'unavailable', detail: 'context diagnostics API unavailable', tone: 'idle' };
  const budgets = Object.entries(snapshot.budget);
  const dropped = budgets.reduce((sum, [, budget]) => sum + budget.droppedItems, 0);
  const total = budgets.reduce((sum, [, budget]) => sum + budget.totalItems, 0);
  const detail = budgets
    .map(([scope, budget]) => `${scope}: ${Math.max(0, budget.totalItems - budget.droppedItems)}/${budget.totalItems} shown, ${budget.droppedItems} dropped`)
    .join(' · ');
  return {
    value: `${dropped} dropped / ${total} source items`,
    detail: detail || 'no budgeted context items',
    tone: dropped > 0 ? 'warning' : 'accent',
  };
}

function contextSourceSummary(snapshot: AssistantContextDiagnosticsSnapshot | null): { value: string; detail: string; tone: PlexusTone } {
  if (!snapshot) return { value: 'unavailable', detail: 'source health API unavailable', tone: 'idle' };
  const sources = Object.entries(snapshot.sourceHealth);
  const failed = sources.filter(([, source]) => source.state === 'failed');
  const ready = sources.filter(([, source]) => source.state === 'ready');
  return {
    value: `${ready.length} ready / ${sources.length} sources`,
    detail: failed.length
      ? failed.map(([name, source]) => `${name}: ${source.error ?? 'failed'}`).join(' · ')
      : `generated ${snapshot.generatedAt}`,
    tone: failed.length ? 'warning' : 'accent',
  };
}

function outboxCounts(outbox: AssistantDailyOutboxDiagnostics | null): string {
  if (!outbox) return 'unavailable';
  const { counts } = outbox;
  return `pending ${counts.pending}, queued ${counts.queued}, sending ${counts.sending}, sent ${counts.sent}, failed ${counts.failed}`;
}

function dailyOutboxTone(event: AssistantDailyOutboxEventDiagnostic): PlexusTone {
  if (event.status === 'sent') return 'accent';
  if (event.status === 'failed') return 'warning';
  if (event.status === 'sending') return 'mint';
  return 'idle';
}

function modelUsageSummary(records: AssistantModelUsageRecord[] | null): { value: string; detail: string; tone: PlexusTone } {
  if (!records) return { value: 'unavailable', detail: 'model usage API unavailable', tone: 'idle' };
  const latest = records[0];
  if (!latest) return { value: '0 turns', detail: 'no model usage saved yet', tone: 'idle' };
  const tokens = latest.totalTokens == null ? 'tokens unknown' : `${latest.totalTokens} tokens`;
  return {
    value: `${records.length} recent turns`,
    detail: `${latest.provider}/${latest.model} · ${latest.status} · ${tokens} · ${latest.durationMs}ms`,
    tone: latest.status === 'failed' ? 'warning' : 'accent',
  };
}

function promptRows(preferences: Record<string, unknown> | null): DiagnosticRow[] {
  if (!preferences) return [];
  const rows: DiagnosticRow[] = [];
  for (const key of ['meshyPrompt', 'generatedPrompt', 'characterSeed']) {
    const value = preferences[key];
    if (typeof value === 'string' && value.trim()) {
      rows.push({
        label: key,
        value: middleTruncate(value, 72),
        detail: 'admin-only prompt/config value. Reveal to view raw text.',
        tone: 'idle',
        copyValue: value,
        sensitive: true,
        highRiskCopy: true,
      });
    }
  }
  return rows;
}

export default function AdminDiagnosticsPanel({ overview }: { overview: AdminDemoOverview | null }) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>(emptyDiagnostics);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['errors', 'worker']));

  const load = useCallback(async () => {
    setLoading(true);
    const [
      workerConfig,
      workerStatus,
      updateStatus,
      bridgeStatus,
      directivePoll,
      fabricStatus,
      assistantStatus,
      assistantContext,
      assistantOutbox,
      assistantModelUsage,
      assistantSessions,
      vaultScan,
      preferences,
    ] = await Promise.allSettled([
      window.plexus.workerConfigGet(),
      window.plexus.workerStatus(),
      window.plexus.updatesGetStatus(),
      window.plexus.thoughtseedBridgeStatus(),
      window.plexus.thoughtseedPollDirectives(),
      window.plexus.fabricStatus(),
      window.plexus.assistantStatus(),
      window.plexus.assistantContextDiagnostics(),
      window.plexus.assistantDailyOutbox(),
      window.plexus.assistantModelUsage(),
      window.plexus.agentSessionStatus(),
      window.plexus.projectScanVault(),
      window.plexus.memberPreferencesGet(),
    ]);

    setDiagnostics({
      workerConfig: settledValue(workerConfig),
      workerStatus: settledValue(workerStatus),
      updateStatus: settledValue(updateStatus),
      bridgeStatus: settledValue(bridgeStatus),
      directives: settledValue(directivePoll)?.directives ?? [],
      fabricStatus: settledValue(fabricStatus),
      assistantStatus: settledValue(assistantStatus),
      assistantContext: settledValue(assistantContext),
      assistantOutbox: settledValue(assistantOutbox),
      assistantModelUsage: settledValue(assistantModelUsage),
      assistantSessions: settledValue(assistantSessions),
      vaultScan: settledValue(vaultScan),
      preferences: settledValue(preferences),
      loadedAt: new Date().toISOString(),
      errors: [
        settledError('worker config', workerConfig),
        settledError('worker status', workerStatus),
        settledError('update status', updateStatus),
        settledError('bridge status', bridgeStatus),
        settledError('bridge directives', directivePoll),
        settledError('fabric status', fabricStatus),
        settledError('assistant status', assistantStatus),
        settledError('assistant context diagnostics', assistantContext),
        settledError('assistant daily outbox', assistantOutbox),
        settledError('assistant model usage', assistantModelUsage),
        settledError('assistant sessions', assistantSessions),
        settledError('vault scan', vaultScan),
        settledError('preferences', preferences),
      ].filter((error): error is string => Boolean(error)),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retryDailyOutbox = useCallback(async (eventId?: string) => {
    setLoading(true);
    try {
      await window.plexus.assistantRetryDailyOutboxEvent(eventId);
    } finally {
      await load();
    }
  }, [load]);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const sessionRows = useMemo<DiagnosticRow[]>(() => [
    { label: 'workspaceId', value: textOrDash(overview?.workspaceId), tone: overview?.workspaceId ? 'accent' : 'idle' },
    { label: 'viewer.email', value: textOrDash(overview?.viewer.email), tone: overview?.viewer.email ? 'accent' : 'idle' },
    { label: 'viewer.role', value: textOrDash(overview?.viewer.role), tone: overview?.viewer.role === 'admin' ? 'accent' : 'warning' },
    { label: 'projectVisibility', value: textOrDash(overview?.viewer.projectVisibility), tone: 'idle' },
    { label: 'identities', value: String(overview?.identities.length ?? 0), tone: overview?.identities.length ? 'accent' : 'warning' },
  ], [overview]);

  const workerRows = useMemo<DiagnosticRow[]>(() => [
    {
      label: 'worker base URL',
      value: textOrDash(diagnostics.workerConfig?.baseUrl),
      detail: 'raw employee UI endpoint moved here',
      tone: diagnostics.workerConfig?.baseUrl ? 'accent' : 'warning',
      copyValue: diagnostics.workerConfig?.baseUrl,
      highRiskCopy: true,
    },
    {
      label: 'worker workspaceId',
      value: textOrDash(diagnostics.workerConfig?.workspaceId),
      tone: diagnostics.workerConfig?.workspaceId ? 'accent' : 'warning',
    },
    {
      label: 'worker token configured',
      value: diagnostics.workerConfig?.hasToken ? 'yes' : 'no',
      detail: 'token value is never rendered',
      tone: boolTone(diagnostics.workerConfig?.hasToken),
    },
    {
      label: 'worker status',
      value: diagnostics.workerStatus?.connected ? 'connected' : 'not connected',
      detail: diagnostics.workerStatus?.message,
      tone: boolTone(diagnostics.workerStatus?.connected),
    },
  ], [diagnostics.workerConfig, diagnostics.workerStatus]);

  const updateRows = useMemo<DiagnosticRow[]>(() => [
    { label: 'state', value: textOrDash(diagnostics.updateStatus?.state), tone: diagnostics.updateStatus?.state === 'error' ? 'error' : 'idle' },
    { label: 'current version', value: textOrDash(diagnostics.updateStatus?.currentVersion), tone: 'accent' },
    { label: 'available version', value: textOrDash(diagnostics.updateStatus?.availableVersion), tone: diagnostics.updateStatus?.availableVersion ? 'warning' : 'idle' },
    { label: 'channel', value: textOrDash(diagnostics.updateStatus?.channel), tone: 'idle' },
    {
      label: 'feed URL',
      value: textOrDash(diagnostics.updateStatus?.feedUrl),
      detail: diagnostics.updateStatus?.message,
      tone: diagnostics.updateStatus?.feedUrl ? 'accent' : 'idle',
      copyValue: diagnostics.updateStatus?.feedUrl || undefined,
      highRiskCopy: true,
    },
    { label: 'error', value: textOrDash(diagnostics.updateStatus?.error), tone: diagnostics.updateStatus?.error ? 'error' : 'idle' },
  ], [diagnostics.updateStatus]);

  const bridgeRows = useMemo<DiagnosticRow[]>(() => [
    { label: 'bridge connected', value: diagnostics.bridgeStatus?.connected ? 'yes' : 'no', tone: boolTone(diagnostics.bridgeStatus?.connected) },
    { label: 'bridge configured', value: diagnostics.bridgeStatus?.configured ? 'yes' : 'no', tone: boolTone(diagnostics.bridgeStatus?.configured) },
    {
      label: 'bridge API URL',
      value: textOrDash(diagnostics.bridgeStatus?.bridgeApiUrl),
      detail: 'raw task bridge URL moved from Settings',
      tone: diagnostics.bridgeStatus?.bridgeApiUrl ? 'accent' : 'warning',
      copyValue: diagnostics.bridgeStatus?.bridgeApiUrl,
      highRiskCopy: true,
    },
    { label: 'tenant', value: textOrDash(diagnostics.bridgeStatus?.tenantId), tone: 'idle' },
    { label: 'memberId', value: textOrDash(diagnostics.bridgeStatus?.memberId), tone: diagnostics.bridgeStatus?.memberId ? 'accent' : 'warning' },
    { label: 'token expiry', value: textOrDash(diagnostics.bridgeStatus?.tokenExpiresAt), detail: 'expiry only, never token value', tone: 'idle' },
    { label: 'last seen', value: textOrDash(diagnostics.bridgeStatus?.lastSeenAt), tone: 'idle' },
    { label: 'last error', value: textOrDash(diagnostics.bridgeStatus?.lastError), tone: diagnostics.bridgeStatus?.lastError ? 'error' : 'idle' },
  ], [diagnostics.bridgeStatus]);

  const fabricRows = useMemo<DiagnosticRow[]>(() => {
    const install = diagnostics.fabricStatus?.install;
    return [
      { label: 'checkedAt', value: textOrDash(diagnostics.fabricStatus?.checkedAt), tone: diagnostics.fabricStatus?.checkedAt ? 'accent' : 'idle' },
      { label: 'bridge reachable', value: diagnostics.fabricStatus?.bridge.reachable ? 'yes' : 'no', detail: diagnostics.fabricStatus?.bridge.message, tone: boolTone(diagnostics.fabricStatus?.bridge.reachable) },
      { label: 'agents total', value: String(diagnostics.fabricStatus?.summary.total ?? 0), tone: diagnostics.fabricStatus?.summary.total ? 'accent' : 'warning' },
      { label: 'healthy agents', value: String(diagnostics.fabricStatus?.summary.healthy ?? 0), tone: 'accent' },
      { label: 'degraded agents', value: String(diagnostics.fabricStatus?.summary.degraded ?? 0), tone: diagnostics.fabricStatus?.summary.degraded ? 'warning' : 'idle' },
      { label: 'vault standups', value: String(diagnostics.fabricStatus?.vault.standups ?? 0), tone: 'idle' },
      { label: 'vault handoffs', value: String(diagnostics.fabricStatus?.vault.handoffs ?? 0), tone: 'idle' },
      { label: 'binary path', value: textOrDash(install?.binaryPath), tone: install?.binaryFound ? 'accent' : 'warning', copyValue: install?.binaryPath, highRiskCopy: true },
      { label: 'server host', value: textOrDash(install?.serverHost), tone: install?.serverHost ? 'accent' : 'idle' },
      { label: 'server port', value: textOrDash(install?.serverPort), tone: install?.serverPort ? 'accent' : 'warning' },
      { label: 'adapter port', value: textOrDash(install?.adapterPort), tone: install?.adapterPort ? 'accent' : 'warning' },
      {
        label: 'target company',
        value: textOrDash(diagnostics.fabricStatus?.safety.targetCompanyName),
        detail: diagnostics.fabricStatus?.safety.targetCompanyId ?? undefined,
        tone: diagnostics.fabricStatus?.safety.targetCompanyName ? 'accent' : 'warning',
      },
      { label: 'target company prefix', value: textOrDash(diagnostics.fabricStatus?.safety.targetCompanyPrefix), tone: diagnostics.fabricStatus?.safety.targetCompanyPrefix ? 'idle' : 'warning' },
      { label: 'selection source', value: textOrDash(diagnostics.fabricStatus?.safety.selectionSource), tone: 'idle' },
      { label: 'thoughtseed org', value: diagnostics.fabricStatus?.safety.thoughtseedOrg ? 'yes' : 'no', tone: boolTone(diagnostics.fabricStatus?.safety.thoughtseedOrg === false ? true : diagnostics.fabricStatus?.safety.thoughtseedOrg === true ? false : null) },
      { label: 'writes allowed', value: diagnostics.fabricStatus?.safety.writesAllowed ? 'yes' : 'guarded', detail: diagnostics.fabricStatus?.safety.reason, tone: diagnostics.fabricStatus?.safety.writesAllowed ? 'accent' : 'warning' },
    ];
  }, [diagnostics.fabricStatus]);

  const assistantRows = useMemo<DiagnosticRow[]>(() => {
    const status = diagnostics.assistantStatus;
    const model = status?.model;
    const sessions = diagnostics.assistantSessions;
    const budget = contextBudgetSummary(diagnostics.assistantContext);
    const sources = contextSourceSummary(diagnostics.assistantContext);
    const modelUsage = modelUsageSummary(diagnostics.assistantModelUsage);
    const outbox = diagnostics.assistantOutbox;
    const outboxRows: DiagnosticRow[] = (outbox?.events ?? []).slice(0, 6).map((event) => ({
      label: `daily outbox ${event.date}`,
      value: event.status,
      detail: [
        `id ${event.id}`,
        event.nextRetryAt ? `next retry ${event.nextRetryAt}` : null,
        event.artifactRef ? `artifact ${middleTruncate(event.artifactRef, 56)}` : null,
        event.error ? `error ${middleTruncate(event.error, 72)}` : null,
      ].filter(Boolean).join(' · '),
      tone: dailyOutboxTone(event),
      action: event.retryable ? (
        <Button variant="ghost" onClick={() => void retryDailyOutbox(event.id)} disabled={loading}>
          Retry
        </Button>
      ) : undefined,
    }));
    return [
      { label: 'assistant availability', value: textOrDash(status?.availability), detail: status?.message, tone: status?.availability === 'ready' ? 'accent' : status?.availability === 'needs_model_key' ? 'warning' : 'idle' },
      { label: 'assistant enabled', value: status?.enabled === false ? 'no' : status?.enabled === true ? 'yes' : 'unavailable', tone: boolTone(status?.enabled) },
      { label: 'selected provider', value: textOrDash(model?.selectedProvider ?? model?.provider), tone: model?.selectedProvider ? 'accent' : 'warning' },
      { label: 'configured providers', value: model?.configuredProviders.length ? model.configuredProviders.join(', ') : 'none', detail: 'key presence only; key values are never rendered', tone: model?.configuredProviders.length ? 'accent' : 'idle' },
      { label: 'Google key', value: model?.hasGoogleKey ? 'stored' : 'not stored', tone: model?.hasGoogleKey ? 'accent' : 'idle' },
      { label: 'NVIDIA key', value: model?.hasNvidiaKey ? 'stored' : 'not stored', tone: model?.hasNvidiaKey ? 'accent' : 'idle' },
      { label: 'context sections', value: diagnostics.assistantContext?.requestedScopes.join(', ') ?? 'unavailable', detail: diagnostics.assistantContext?.dateRange ? `${diagnostics.assistantContext.dateRange.from} to ${diagnostics.assistantContext.dateRange.to}` : 'context diagnostics unavailable', tone: diagnostics.assistantContext ? 'mint' : 'idle' },
      { label: 'context budgets', value: budget.value, detail: budget.detail, tone: budget.tone },
      { label: 'context freshness', value: sources.value, detail: sources.detail, tone: sources.tone },
      { label: 'task summaries', value: String(diagnostics.assistantContext?.taskSummaries.length ?? 0), detail: 'safe task summaries only; no raw directives or history', tone: diagnostics.assistantContext?.taskSummaries.length ? 'accent' : 'idle' },
      { label: 'session context pending', value: String(sessions?.totalPending ?? 0), detail: sessions ? `${sessions.readyPending ?? 0} ready, ${sessions.matchedPending ?? 0} matched` : 'session scanner status unavailable', tone: (sessions?.readyPending ?? 0) > 0 ? 'accent' : 'idle' },
      {
        label: 'daily outbox',
        value: outboxCounts(outbox),
        detail: outbox ? `${outbox.dueRetryCount} due retry · checked ${outbox.checkedAt}` : 'assistant daily queue diagnostics unavailable',
        tone: (outbox?.counts.failed ?? 0) > 0 || (outbox?.dueRetryCount ?? 0) > 0 ? 'warning' : outbox ? 'accent' : 'idle',
        action: outbox && outbox.dueRetryCount > 0 ? (
          <Button variant="ghost" onClick={() => void retryDailyOutbox()} disabled={loading}>
            Retry due
          </Button>
        ) : undefined,
      },
      ...outboxRows,
      { label: 'model usage telemetry', value: modelUsage.value, detail: modelUsage.detail, tone: modelUsage.tone },
      { label: 'last tool audit', value: 'main-process only', detail: 'tool audit rows stay off renderer until a dedicated redacted view exists', tone: 'idle' },
    ];
  }, [diagnostics.assistantContext, diagnostics.assistantModelUsage, diagnostics.assistantOutbox, diagnostics.assistantSessions, diagnostics.assistantStatus, loading, retryDailyOutbox]);

  const vaultRows = useMemo<DiagnosticRow[]>(() => [
    {
      label: 'repo root',
      value: textOrDash(diagnostics.vaultScan?.repoRoot),
      detail: 'raw vault path moved from Projects',
      tone: diagnostics.vaultScan?.repoRoot ? 'accent' : 'warning',
      copyValue: diagnostics.vaultScan?.repoRoot ?? undefined,
      highRiskCopy: true,
    },
    { label: 'candidates', value: String(diagnostics.vaultScan?.candidates.length ?? 0), tone: diagnostics.vaultScan?.candidates.length ? 'accent' : 'idle' },
    { label: 'imported', value: String(diagnostics.vaultScan?.imported ?? 0), tone: diagnostics.vaultScan?.imported ? 'accent' : 'idle' },
    { label: 'scan message', value: textOrDash(diagnostics.vaultScan?.message), tone: diagnostics.vaultScan?.ok ? 'accent' : 'warning' },
  ], [diagnostics.vaultScan]);

  const errorRows = useMemo<DiagnosticRow[]>(
    () => diagnostics.errors.map((error) => ({ label: 'probe error', value: error, tone: 'error' })),
    [diagnostics.errors],
  );

  const directiveRows = useMemo<DiagnosticRow[]>(() => diagnostics.directives.map((directive) => {
    const payload = JSON.stringify(directive.payload);
    return {
      label: directive.id,
      value: middleTruncate(payload, 80),
      detail: `${textOrDash(directive.createdAt ?? directive.issuedAt)} · ${textOrDash(directive.tenantId)} · ${textOrDash(directive.memberId)}`,
      tone: 'warning',
      copyValue: payload,
      sensitive: true,
      highRiskCopy: true,
    };
  }), [diagnostics.directives]);

  const candidateRows = useMemo<DiagnosticRow[]>(() => (diagnostics.vaultScan?.candidates ?? []).slice(0, 20).map((candidate) => ({
    label: candidate.name,
    value: middleTruncate(candidate.sourcePath, 72),
    detail: `${candidate.code} · ${candidate.status} · ${candidate.githubRepoFullName ?? 'repo missing'}`,
    tone: candidate.cachedRepoStatus === 'verified' ? 'accent' : 'warning',
    copyValue: candidate.sourcePath,
    highRiskCopy: true,
  })), [diagnostics.vaultScan?.candidates]);

  const promptDiagnosticRows = useMemo<DiagnosticRow[]>(
    () => promptRows(diagnostics.preferences),
    [diagnostics.preferences],
  );

  return (
    <InstrumentPanel
      label="diagnostics"
      title="Admin diagnostics"
      note="Raw endpoints, URLs, paths, prompts, ports, and payload summaries live here instead of employee pages."
      actions={(
        <CommandDock compact>
          {diagnostics.loadedAt && <StatusChip tone="idle">{new Date(diagnostics.loadedAt).toLocaleTimeString()}</StatusChip>}
          <Button variant="ghost" onClick={load} disabled={loading}>
            <IconSync s={12} /> {loading ? 'Refreshing' : 'Refresh diagnostics'}
          </Button>
        </CommandDock>
      )}
      trace
    >
      <div className="px-stack">
        <MetricRailGroup>
          <MetricRail label="worker" value={diagnostics.workerStatus?.connected ? 'connected' : 'check'} tone={boolTone(diagnostics.workerStatus?.connected)} />
          <MetricRail label="bridge" value={diagnostics.bridgeStatus?.connected ? 'connected' : 'closed'} tone={boolTone(diagnostics.bridgeStatus?.connected)} />
          <MetricRail label="assistant" value={diagnostics.assistantStatus?.availability ?? 'check'} tone={diagnostics.assistantStatus?.availability === 'ready' ? 'accent' : diagnostics.assistantStatus?.availability === 'needs_model_key' ? 'warning' : 'idle'} />
          <MetricRail label="update" value={diagnostics.updateStatus?.state ?? 'loading'} tone={diagnostics.updateStatus?.state === 'error' ? 'error' : 'idle'} />
          <MetricRail label="vault" value={`${diagnostics.vaultScan?.candidates.length ?? 0} candidates`} tone={diagnostics.vaultScan?.ok ? 'accent' : 'warning'} />
        </MetricRailGroup>

        <div className="px-admin-diagnostics-list">
          {errorRows.length > 0 && (
            <DiagnosticDisclosure
              id="errors"
              label="diagnostic errors"
              title="Partial diagnostics loaded"
              note="Some probes failed; successful probes remain available below."
              count={errorRows.length}
              statusText="needs review"
              statusTone="error"
              open={openSections.has('errors')}
              onToggle={toggleSection}
            >
              <DiagnosticsLedger rows={errorRows} />
            </DiagnosticDisclosure>
          )}

          <DiagnosticDisclosure
            id="session"
            label="session"
            title="Workspace and viewer"
            count={sessionRows.length}
            statusText={overview?.viewer.role === 'admin' ? 'admin' : 'check role'}
            statusTone={rowsTone(sessionRows)}
            open={openSections.has('session')}
            onToggle={toggleSection}
          >
            <DiagnosticsLedger rows={sessionRows} />
          </DiagnosticDisclosure>

          <DiagnosticDisclosure
            id="worker"
            label="worker"
            title="Worker connection"
            count={workerRows.length}
            statusText={diagnostics.workerStatus?.connected ? 'connected' : 'check'}
            statusTone={rowsTone(workerRows)}
            open={openSections.has('worker')}
            onToggle={toggleSection}
          >
            <DiagnosticsLedger rows={workerRows} />
          </DiagnosticDisclosure>

          <DiagnosticDisclosure
            id="updates"
            label="updates"
            title="OTA feed"
            count={updateRows.length}
            statusText={diagnostics.updateStatus?.state ?? 'loading'}
            statusTone={rowsTone(updateRows)}
            open={openSections.has('updates')}
            onToggle={toggleSection}
          >
            <DiagnosticsLedger rows={updateRows} />
          </DiagnosticDisclosure>

          <DiagnosticDisclosure
            id="bridge"
            label="bridge"
            title="Thoughtseed Bridge"
            count={bridgeRows.length}
            statusText={diagnostics.bridgeStatus?.connected ? 'connected' : 'closed'}
            statusTone={rowsTone(bridgeRows)}
            open={openSections.has('bridge')}
            onToggle={toggleSection}
          >
            <DiagnosticsLedger rows={bridgeRows} />
          </DiagnosticDisclosure>

          <DiagnosticDisclosure
            id="fabric"
            label="local helpers"
            title="Fabric and install"
            count={fabricRows.length}
            statusText={`${diagnostics.fabricStatus?.summary.healthy ?? 0} healthy`}
            statusTone={rowsTone(fabricRows)}
            open={openSections.has('fabric')}
            onToggle={toggleSection}
          >
            <DiagnosticsLedger rows={fabricRows} />
          </DiagnosticDisclosure>

          <DiagnosticDisclosure
            id="assistant"
            label="assistant"
            title="Native assistant"
            count={assistantRows.length}
            statusText={diagnostics.assistantStatus?.availability ?? 'check'}
            statusTone={rowsTone(assistantRows)}
            open={openSections.has('assistant')}
            onToggle={toggleSection}
          >
            <DiagnosticsLedger rows={assistantRows} />
          </DiagnosticDisclosure>

          <DiagnosticDisclosure
            id="vault"
            label="vault"
            title="Project resolver"
            count={vaultRows.length}
            statusText={`${diagnostics.vaultScan?.candidates.length ?? 0} candidates`}
            statusTone={rowsTone(vaultRows)}
            open={openSections.has('vault')}
            onToggle={toggleSection}
          >
            <DiagnosticsLedger rows={vaultRows} />
          </DiagnosticDisclosure>

          <DiagnosticDisclosure
            id="directives"
            label="bridge directives"
            title="Raw directive payloads"
            note="Payload summaries are admin-only; acknowledge actions stay in Settings."
            count={directiveRows.length}
            statusText={directiveRows.length === 0 ? 'clear' : 'pending'}
            statusTone={directiveRows.length === 0 ? 'accent' : 'warning'}
            open={openSections.has('directives')}
            onToggle={toggleSection}
          >
            {directiveRows.length === 0 ? (
              <StatusChip tone="accent">no pending directives</StatusChip>
            ) : (
              <DiagnosticsLedger rows={directiveRows} />
            )}
          </DiagnosticDisclosure>

          <DiagnosticDisclosure
            id="source-paths"
            label="project source paths"
            title="Vault candidate diagnostics"
            note="These source paths are hidden from employees and kept here for resolver debugging."
            count={candidateRows.length}
            statusText={candidateRows.length === 0 ? 'empty' : 'sampled'}
            statusTone={candidateRows.length === 0 ? 'idle' : rowsTone(candidateRows)}
            open={openSections.has('source-paths')}
            onToggle={toggleSection}
          >
            {candidateRows.length === 0 ? (
              <StatusChip tone="idle">no candidates</StatusChip>
            ) : (
              <DiagnosticsLedger rows={candidateRows} />
            )}
          </DiagnosticDisclosure>

          <DiagnosticDisclosure
            id="prompt-config"
            label="prompt/config"
            title="Prompt diagnostics"
            note="Prompt text is admin-only when present; employees see preference outcomes instead."
            count={promptDiagnosticRows.length}
            statusText={promptDiagnosticRows.length === 0 ? 'empty' : 'present'}
            statusTone={promptDiagnosticRows.length === 0 ? 'idle' : rowsTone(promptDiagnosticRows)}
            open={openSections.has('prompt-config')}
            onToggle={toggleSection}
          >
            {promptDiagnosticRows.length === 0 ? (
              <StatusChip tone="idle">no prompt diagnostics</StatusChip>
            ) : (
              <DiagnosticsLedger rows={promptDiagnosticRows} />
            )}
          </DiagnosticDisclosure>
        </div>
      </div>
    </InstrumentPanel>
  );
}
