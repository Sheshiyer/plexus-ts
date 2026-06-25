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

function textOrDash(value: unknown): string {
  if (value == null || value === '') return 'not set';
  return String(value);
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

        {diagnostics.errors.length > 0 && (
          <InstrumentPanel label="diagnostic errors" title="Partial diagnostics loaded" note="Some probes failed; the successful probes are still shown below.">
            <DiagnosticsLedger rows={diagnostics.errors.map((error) => ({ label: 'probe error', value: error, tone: 'error' }))} />
          </InstrumentPanel>
        )}

        <div className="px-admin-layout">
          <InstrumentPanel label="session" title="Workspace and viewer">
            <DiagnosticsLedger rows={sessionRows} />
          </InstrumentPanel>
          <InstrumentPanel label="worker" title="Worker connection">
            <DiagnosticsLedger rows={workerRows} />
          </InstrumentPanel>
        </div>

        <div className="px-admin-layout">
          <InstrumentPanel label="updates" title="OTA feed">
            <DiagnosticsLedger rows={updateRows} />
          </InstrumentPanel>
          <InstrumentPanel label="bridge" title="Thoughtseed Bridge">
            <DiagnosticsLedger rows={bridgeRows} />
          </InstrumentPanel>
        </div>

        <div className="px-admin-layout">
          <InstrumentPanel label="local helpers" title="Fabric and install">
            <DiagnosticsLedger rows={fabricRows} />
          </InstrumentPanel>
          <InstrumentPanel label="vault" title="Project resolver">
            <DiagnosticsLedger rows={vaultRows} />
          </InstrumentPanel>
        </div>

        <InstrumentPanel
          label="bridge directives"
          title="Raw directive payloads"
          note="Payload summaries are admin-only; acknowledge actions stay in Settings."
        >
          {diagnostics.directives.length === 0 ? (
            <StatusChip tone="accent">no pending directives</StatusChip>
          ) : (
            <DiagnosticsLedger rows={diagnostics.directives.map((directive) => {
              const payload = JSON.stringify(directive.payload);
              return {
                label: directive.id,
                value: middleTruncate(payload, 80),
                detail: `${textOrDash(directive.createdAt ?? directive.issuedAt)} · ${textOrDash(directive.tenantId)} · ${textOrDash(directive.memberId)}`,
                tone: 'warning',
                copyValue: payload,
              };
            })} />
          )}
        </InstrumentPanel>

        <InstrumentPanel
          label="project source paths"
          title="Vault candidate diagnostics"
          note="These source paths are hidden from employees and kept here for resolver debugging."
        >
          {(diagnostics.vaultScan?.candidates.length ?? 0) === 0 ? (
            <StatusChip tone="idle">no candidates</StatusChip>
          ) : (
            <DiagnosticsLedger rows={(diagnostics.vaultScan?.candidates ?? []).slice(0, 20).map((candidate) => ({
              label: candidate.name,
              value: middleTruncate(candidate.sourcePath, 72),
              detail: `${candidate.code} · ${candidate.status} · ${candidate.githubRepoFullName ?? 'repo missing'}`,
              tone: candidate.cachedRepoStatus === 'verified' ? 'accent' : 'warning',
              copyValue: candidate.sourcePath,
            }))} />
          )}
        </InstrumentPanel>

        <InstrumentPanel
          label="prompt/config"
          title="Prompt diagnostics"
          note="Prompt text is admin-only when present; employees see preference outcomes instead."
        >
          {promptRows(diagnostics.preferences).length === 0 ? (
            <StatusChip tone="idle">no prompt diagnostics</StatusChip>
          ) : (
            <DiagnosticsLedger rows={promptRows(diagnostics.preferences)} />
          )}
        </InstrumentPanel>
      </div>
    </InstrumentPanel>
  );
}

