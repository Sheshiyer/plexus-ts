import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdminDemoOverview,
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

function CopyValue({ value }: { value: string }) {
  return (
    <Button
      variant="ghost"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
      }}
    >
      Copy
    </Button>
  );
}

function DiagnosticsLedger({ rows }: { rows: DiagnosticRow[] }) {
  return (
    <Ledger>
      {rows.map((row, index) => {
        const copyValue = row.copyValue ?? (typeof row.value === 'string' ? row.value : undefined);
        return (
          <LedgerRail
            key={`${row.label}:${index}`}
            index={String(index + 1).padStart(2, '0')}
            title={row.label}
            meta={row.detail}
            value={row.value}
            status={row.tone && <span>{row.tone}</span>}
            statusTone={row.tone}
            action={copyValue ? <CopyValue value={copyValue} /> : undefined}
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

function promptRows(preferences: Record<string, unknown> | null): DiagnosticRow[] {
  if (!preferences) return [];
  const rows: DiagnosticRow[] = [];
  for (const key of ['meshyPrompt', 'generatedPrompt', 'characterSeed']) {
    const value = preferences[key];
    if (typeof value === 'string' && value.trim()) {
      rows.push({
        label: key,
        value: middleTruncate(value, 72),
        detail: 'admin-only prompt/config value',
        tone: 'idle',
        copyValue: value,
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
      vaultScan,
      preferences,
    ] = await Promise.allSettled([
      window.plexus.workerConfigGet(),
      window.plexus.workerStatus(),
      window.plexus.updatesGetStatus(),
      window.plexus.thoughtseedBridgeStatus(),
      window.plexus.thoughtseedPollDirectives(),
      window.plexus.fabricStatus(),
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
        settledError('vault scan', vaultScan),
        settledError('preferences', preferences),
      ].filter((error): error is string => Boolean(error)),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
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
      { label: 'binary path', value: textOrDash(install?.binaryPath), tone: install?.binaryFound ? 'accent' : 'warning', copyValue: install?.binaryPath },
      { label: 'server host', value: textOrDash(install?.serverHost), tone: install?.serverHost ? 'accent' : 'idle' },
      { label: 'server port', value: textOrDash(install?.serverPort), tone: install?.serverPort ? 'accent' : 'warning' },
      { label: 'adapter port', value: textOrDash(install?.adapterPort), tone: install?.adapterPort ? 'accent' : 'warning' },
    ];
  }, [diagnostics.fabricStatus]);

  const vaultRows = useMemo<DiagnosticRow[]>(() => [
    {
      label: 'repo root',
      value: textOrDash(diagnostics.vaultScan?.repoRoot),
      detail: 'raw vault path moved from Projects',
      tone: diagnostics.vaultScan?.repoRoot ? 'accent' : 'warning',
      copyValue: diagnostics.vaultScan?.repoRoot ?? undefined,
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
    };
  }), [diagnostics.directives]);

  const candidateRows = useMemo<DiagnosticRow[]>(() => (diagnostics.vaultScan?.candidates ?? []).slice(0, 20).map((candidate) => ({
    label: candidate.name,
    value: middleTruncate(candidate.sourcePath, 72),
    detail: `${candidate.code} · ${candidate.status} · ${candidate.githubRepoFullName ?? 'repo missing'}`,
    tone: candidate.cachedRepoStatus === 'verified' ? 'accent' : 'warning',
    copyValue: candidate.sourcePath,
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
