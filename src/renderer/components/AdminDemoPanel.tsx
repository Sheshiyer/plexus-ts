import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, Button, Skeleton } from './ui';
import { IconBackups, IconCheck, IconExport, IconProjects, IconReports, IconSync } from './Icons';
import type { AdminDemoIdentity, AdminDemoOverview, AdminProofCockpitSnapshot, AdminProofOpsDrilldownTarget, AdminProofSnapshotHandoff, OnboardingStateValue, Project, TodaySnapshot } from '../../shared/types';
import AdminDiagnosticsPanel from './AdminDiagnosticsPanel';
import AdminProofCockpitPanel from './AdminProofCockpitPanel';
import BackupPanel from './BackupPanel';
import ExportPanel from './ExportPanel';
import Reports from './Reports';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  StatusChip,
  type PlexusTone,
} from './PlexusUI';
import {
  clearAdminEmployeeModeContext,
  readAdminEmployeeModeContext,
  type AdminEmployeeModeContext,
  writeAdminEmployeeModeContext,
} from '../adminEmployeeMode';

export type AdminSection = 'proof' | 'overview' | 'reports' | 'export' | 'backups' | 'diagnostics';

const ADMIN_SECTIONS: Array<{
  key: AdminSection;
  label: string;
  hint: string;
  Icon: React.FC<{ s?: number }>;
}> = [
  { key: 'proof', label: 'Proof Cockpit', hint: 'founder proof', Icon: IconCheck },
  { key: 'overview', label: 'Overview', hint: 'workspace state', Icon: IconProjects },
  { key: 'reports', label: 'Reports', hint: 'proof cycles', Icon: IconReports },
  { key: 'export', label: 'Export', hint: 'local extracts', Icon: IconExport },
  { key: 'backups', label: 'Backups', hint: 'restore points', Icon: IconBackups },
  { key: 'diagnostics', label: 'Diagnostics', hint: 'raw probes', Icon: IconSync },
];

function badgeTone(state: string): PlexusTone {
  if (state === 'completed') return 'accent';
  if (state === 'failed') return 'error';
  if (state === 'skipped' || state === 'deferred') return 'warning';
  return 'idle';
}

function projectRepoTone(project: any): PlexusTone {
  const state = project.repoEvidenceStatus ?? project.repo_evidence_status;
  if (state === 'verified') return 'accent';
  if (state === 'inaccessible' || state === 'failed') return 'error';
  return 'warning';
}

function stepDone(state: OnboardingStateValue): boolean {
  return state === 'completed' || state === 'skipped' || state === 'deferred';
}

function onboardingStats(identity: AdminDemoIdentity) {
  const steps = identity.onboarding.steps;
  const required = steps.filter((step) => step.requirement === 'required');
  const optional = steps.filter((step) => step.requirement === 'optional');
  const done = steps.filter((step) => stepDone(step.state)).length;
  const requiredDone = required.filter((step) => stepDone(step.state)).length;
  const optionalDone = optional.filter((step) => stepDone(step.state)).length;
  const failed = steps.some((step) => step.state === 'failed');
  const setupState = failed ? 'blocked' : requiredDone < required.length ? 'attention' : 'ready';
  const lastUpdatedAt = steps.map((step) => step.updatedAt).filter(Boolean).sort((a, b) => b.localeCompare(a))[0] ?? null;
  return {
    steps,
    required,
    optional,
    done,
    total: steps.length,
    requiredDone,
    requiredTotal: required.length,
    optionalDone,
    optionalTotal: optional.length,
    setupState,
    proofState: setupState === 'ready' ? 'ready' : setupState === 'blocked' ? 'blocked' : 'attention',
    lastUpdatedAt,
  };
}

function setupTone(state: string): PlexusTone {
  if (state === 'ready') return 'accent';
  if (state === 'blocked') return 'error';
  return 'warning';
}

function formatDate(value: string | null): string {
  if (!value) return 'not updated';
  return value.slice(0, 16).replace('T', ' ');
}

function IdentityCard({
  identity,
  selected,
  testModeActive,
  onSelect,
}: {
  identity: AdminDemoIdentity;
  selected: boolean;
  testModeActive: boolean;
  onSelect: () => void;
}) {
  const stats = onboardingStats(identity);
  return (
    <button
      className={`px-command-card ${identity.role}${selected ? ' selected' : ''}`}
      onClick={onSelect}
    >
      <span className="rail" />
      <div className="px-command-main">
        <div className="px-command-title">
          <strong>{identity.displayName}</strong>
          <StatusChip tone={identity.role === 'admin' ? 'accent' : 'idle'}>{identity.role}</StatusChip>
          <StatusChip tone={setupTone(stats.setupState)}>setup {stats.setupState}</StatusChip>
        </div>
        <div className="px-command-meta">
          {identity.email} · proof {stats.proofState} · updated {formatDate(stats.lastUpdatedAt)}
        </div>
      </div>
      <div className="px-command-aside">
        <span className="px-lbl">onboarding</span>
        <span className="px-command-progress">{stats.done}/{stats.total}</span>
        <span className="px-lbl">{identity.role === 'employee' ? (testModeActive ? 'test active' : 'test ready') : 'admin'}</span>
      </div>
    </button>
  );
}

export default function AdminDemoPanel({
  projects,
  initialSection = 'proof',
  todaySnapshot,
}: {
  projects: Project[];
  initialSection?: AdminSection;
  todaySnapshot?: TodaySnapshot | null;
}) {
  const [overview, setOverview] = useState<AdminDemoOverview | null>(null);
  const [proofCockpit, setProofCockpit] = useState<AdminProofCockpitSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [section, setSection] = useState<AdminSection>(initialSection);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [testModeContext, setTestModeContext] = useState<AdminEmployeeModeContext | null>(null);
  const [proofHandoffContext, setProofHandoffContext] = useState<AdminProofSnapshotHandoff | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, cockpit] = await Promise.all([
        window.plexus.adminDemoOverview(),
        window.plexus.adminProofCockpitSnapshot().catch(() => null),
      ]);
      if (res.ok && res.overview) {
        setOverview(res.overview);
        setSelectedId((current) => current || res.overview?.identities[0]?.identityId || '');
      } else {
        setError(res.message ?? 'Admin overview unavailable');
      }
      setProofCockpit(cockpit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin overview unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSection(initialSection); }, [initialSection]);
  useEffect(() => {
    const syncTestModeContext = () => setTestModeContext(readAdminEmployeeModeContext());
    syncTestModeContext();
    window.addEventListener('plexus:admin-employee-mode-changed', syncTestModeContext);
    return () => window.removeEventListener('plexus:admin-employee-mode-changed', syncTestModeContext);
  }, []);

  const selected = useMemo(
    () => overview?.identities.find((identity) => identity.identityId === selectedId) ?? null,
    [overview, selectedId],
  );
  const selectedStats = useMemo(() => selected ? onboardingStats(selected) : null, [selected]);

  const updateStep = async (identityId: string, stepId: string, state: OnboardingStateValue) => {
    setBusy(`${identityId}:${stepId}:${state}`);
    setError('');
    const res = await window.plexus.adminDemoOnboardingUpdate(identityId, stepId, state, { source: 'admin_workspace' });
    if (res.ok && res.overview) {
      setOverview(res.overview);
      const cockpit = await window.plexus.adminProofCockpitSnapshot().catch(() => null);
      setProofCockpit(cockpit);
    } else {
      setError(res.message ?? 'Could not update onboarding state');
    }
    setBusy('');
  };

  const startEmployeeTestMode = useCallback((identity: AdminDemoIdentity) => {
    const context: AdminEmployeeModeContext = {
      identityId: identity.identityId,
      displayName: identity.displayName,
      email: identity.email,
      role: identity.role,
      startedAt: new Date().toISOString(),
    };
    writeAdminEmployeeModeContext(context);
    setTestModeContext(context);
    window.dispatchEvent(new Event('plexus:admin-employee-mode-changed'));
  }, []);

  const stopEmployeeTestMode = useCallback(() => {
    clearAdminEmployeeModeContext();
    setTestModeContext(null);
    window.dispatchEvent(new Event('plexus:admin-employee-mode-changed'));
  }, []);

  const testIdentityFromProofLedger = useCallback((identityId: string) => {
    const identity = overview?.identities.find((candidate) => candidate.identityId === identityId);
    setSelectedId(identityId);
    if (identity?.role === 'employee') {
      startEmployeeTestMode(identity);
    }
    setSection('overview');
  }, [overview, startEmployeeTestMode]);

  const openProofSection = useCallback((nextSection: AdminSection, context?: AdminProofSnapshotHandoff) => {
    if (context && (nextSection === 'reports' || nextSection === 'export')) {
      setProofHandoffContext(context);
    } else if (nextSection !== 'reports' && nextSection !== 'export') {
      setProofHandoffContext(null);
    }
    setSection(nextSection);
  }, []);

  const openProofDrilldown = useCallback(async (id: AdminProofOpsDrilldownTarget) => {
    setError('');
    try {
      const result = await window.plexus.adminProofCockpitOpenDrilldown(id);
      if (!result.ok) {
        setError(result.message ?? `Could not open ${result.target}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open proof drill-through target.');
    }
  }, []);

  if (loading) {
    return (
      <div className="px-fadein">
        <PageHeader title="Founder Proof Cockpit" sub="proof cockpit" />
        <InstrumentPanel label="loading workspace" title="Reading admin contract">
          <Skeleton lines={6} />
        </InstrumentPanel>
      </div>
    );
  }

  return (
    <div className="px-fadein">
      <PageHeader
        title="Founder Proof Cockpit"
        sub={overview ? `${overview.workspaceId} · ${overview.identities.length} identities` : 'proof cockpit'}
        right={<CommandDock><Button variant="ghost" onClick={load}><IconSync s={14} /> Refresh</Button></CommandDock>}
      />

      {error && (
        <DegradedStatePanel title="Admin overview unavailable" message={error} tone="error" onRetry={load} />
      )}

      {testModeContext?.role === 'employee' && (
        <div className="px-admin-test-banner" role="status" aria-label="Admin employee test mode">
          <div className="px-admin-test-banner-copy">
            <span className="px-lbl">Admin employee test mode</span>
            <strong>Testing as {testModeContext.displayName}</strong>
            <small>Admin is viewing {testModeContext.email} through a test lane, not a live employee session.</small>
          </div>
          <div className="px-admin-test-banner-meta">
            <StatusChip tone="warning">test lane</StatusChip>
            <StatusChip tone="mint">{testModeContext.startedAt.slice(0, 16).replace('T', ' ')}</StatusChip>
            <Button variant="ghost" onClick={stopEmployeeTestMode}>End test mode</Button>
          </div>
        </div>
      )}

      {section === 'proof' && proofCockpit && (
        <AdminProofCockpitPanel
          snapshot={proofCockpit}
          onOpenSection={openProofSection}
          onTestIdentity={testIdentityFromProofLedger}
          onOpenDrilldown={openProofDrilldown}
        />
      )}
      {section === 'proof' && !proofCockpit && (
        <DegradedStatePanel
          title="Proof cockpit unavailable"
          message="Admin overview loaded, but the local proof aggregate could not be built."
          tone="warning"
          onRetry={load}
        />
      )}

      <InstrumentPanel
        label="admin utilities"
        title="Proof first, diagnostics second"
        note="Founder/admin starts in proof state; reports, exports, backups, and raw diagnostics remain one step behind it."
        trace
      >
        <div className="px-admin-section-switcher" role="tablist" aria-label="Admin utility sections">
          {ADMIN_SECTIONS.map(({ key, label, hint, Icon }) => (
            <button
              key={key}
              type="button"
              className={`px-admin-section-tab${section === key ? ' active' : ''}`}
              onClick={() => {
                if (key !== 'reports' && key !== 'export') setProofHandoffContext(null);
                setSection(key);
              }}
              aria-selected={section === key}
              role="tab"
            >
              <span className="px-admin-section-icon"><Icon s={13} /></span>
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>
      </InstrumentPanel>

      {section === 'reports' && <Reports projects={projects} todaySnapshot={todaySnapshot} proofContext={proofHandoffContext?.target === 'reports' ? proofHandoffContext : null} />}
      {section === 'export' && <ExportPanel projects={projects} proofContext={proofHandoffContext?.target === 'export' ? proofHandoffContext : null} />}
      {section === 'backups' && <BackupPanel />}
      {section === 'diagnostics' && <AdminDiagnosticsPanel overview={overview} />}

      {overview && section === 'overview' && (
        <>
          <MetricRailGroup>
            <MetricRail label="viewer" value={overview.viewer.email} tone="mint" hint={overview.workspaceId} />
            <MetricRail label="role" value={overview.viewer.role} tone={overview.viewer.role === 'admin' ? 'accent' : 'idle'} hint="session" />
            <MetricRail label="projects" value={overview.projects.length} tone="accent" hint="workspace" />
            <MetricRail label="visibility" value={overview.viewer.projectVisibility} tone="mint" hint="scope" />
          </MetricRailGroup>

          <InstrumentPanel
            label="project overview"
            title="Repo proof coverage"
            note="Missing evidence is shown as setup work; private rhythm settings stay outside admin visibility."
            actions={<StatusChip tone="mint">{overview.projects.length} total</StatusChip>}
            trace
          >
            <Ledger>
              {overview.projects.slice(0, 18).map((project: any, index) => (
                <LedgerRail
                  key={project.id ?? project.name}
                  index={String(index + 1).padStart(2, '0')}
                  icon={<IconProjects s={12} />}
                  title={project.name ?? project.id}
                  meta={(project.githubRepoFullName ?? project.github_repo_full_name) || 'GitHub repo required'}
                  status={(project.repoEvidenceStatus ?? project.repo_evidence_status) === 'verified' ? 'verified' : 'needs repo'}
                  statusTone={projectRepoTone(project)}
                />
              ))}
            </Ledger>
          </InstrumentPanel>

          <div className="px-admin-layout">
            <InstrumentPanel
              density="dense"
              label="identities"
              title="Employee contexts"
              note="Select an employee context without bypassing the real session contract."
            >
              <div className="px-scroll-stack">
                {overview.identities.map((identity) => (
                  <IdentityCard
                    key={identity.identityId}
                    identity={identity}
                    selected={identity.identityId === selectedId}
                    testModeActive={testModeContext?.identityId === identity.identityId}
                    onSelect={() => setSelectedId(identity.identityId)}
                  />
                ))}
              </div>
            </InstrumentPanel>

            <InstrumentPanel
              density="dense"
              label="employee onboarding oversight"
              title={selected ? selected.displayName : 'No identity selected'}
              note="Each action writes admin-applied onboarding state through the same Worker route employees use."
            >
              {!selected && (
                <EmptyStatePanel
                  title="Select an identity"
                  message="Pick a member from the identity rail to inspect onboarding state."
                />
              )}
              {selected && (
                <div className="px-stack">
                  <div className="px-token-cloud">
                    <strong>{selected.displayName}</strong>
                    <StatusChip>{selected.email}</StatusChip>
                    <StatusChip tone={selected.role === 'admin' ? 'accent' : 'idle'}>{selected.role}</StatusChip>
                    {selectedStats && <StatusChip tone={setupTone(selectedStats.setupState)}>setup {selectedStats.setupState}</StatusChip>}
                    {selectedStats && <StatusChip tone={setupTone(selectedStats.proofState)}>proof {selectedStats.proofState}</StatusChip>}
                    {selectedStats && <StatusChip tone="mint">updated {formatDate(selectedStats.lastUpdatedAt)}</StatusChip>}
                    {selected.role === 'employee' && (
                      <StatusChip tone={testModeContext?.identityId === selected.identityId ? 'accent' : 'idle'}>
                        {testModeContext?.identityId === selected.identityId ? 'test mode active' : 'test mode available'}
                      </StatusChip>
                    )}
                  </div>
                  {selected.role === 'employee' && (
                    <div className="px-flow-actions">
                      <Button
                        variant={testModeContext?.identityId === selected.identityId ? 'ghost' : 'accent'}
                        onClick={() => startEmployeeTestMode(selected)}
                      >
                        {testModeContext?.identityId === selected.identityId ? 'Refresh test context' : 'Test as this employee'}
                      </Button>
                      {testModeContext?.identityId === selected.identityId && (
                        <Button variant="ghost" onClick={stopEmployeeTestMode}>
                          End test mode
                        </Button>
                      )}
                    </div>
                  )}
                  {selected.role === 'employee' && (
                    <div className="px-flow-meta">
                      Employee test lane is active while admin oversight stays visible.
                    </div>
                  )}
                  {selectedStats && (
                    <div className="px-setup-summary-grid" aria-label="Employee setup inspector summary">
                      <MetricRail label="required" value={`${selectedStats.requiredDone}/${selectedStats.requiredTotal}`} tone={selectedStats.requiredDone === selectedStats.requiredTotal ? 'accent' : 'warning'} hint="setup" />
                      <MetricRail label="optional" value={`${selectedStats.optionalDone}/${selectedStats.optionalTotal}`} tone="mint" hint="setup" />
                      <MetricRail label="proof" value={selectedStats.proofState} tone={setupTone(selectedStats.proofState)} hint="state" />
                      <MetricRail label="last update" value={formatDate(selectedStats.lastUpdatedAt)} tone="idle" hint="local" />
                    </div>
                  )}
                  {selectedStats && ([
                    ['Required setup', selectedStats.required],
                    ['Optional setup', selectedStats.optional],
                  ] as const).map(([groupLabel, steps]) => (
                    <div key={groupLabel} className="px-setup-step-group">
                      <div className="px-setup-step-group-head">
                        <span className="px-lbl">{groupLabel}</span>
                        <StatusChip tone={steps.every((step) => stepDone(step.state)) ? 'accent' : 'warning'}>
                          {steps.filter((step) => stepDone(step.state)).length}/{steps.length}
                        </StatusChip>
                      </div>
                      {steps.length === 0 && (
                        <div className="px-flow-meta">No {groupLabel.toLowerCase()} steps are configured.</div>
                      )}
                      {steps.map((step) => (
                        <div key={step.stepId} className={`px-flow-card state-${step.state}`}>
                          <div className="px-flow-icon">
                            <IconCheck s={15} />
                          </div>
                          <div className="px-flow-main">
                            <div className="px-flow-top">
                              <div className="px-flow-title">{step.label}</div>
                              <StatusChip tone={badgeTone(step.state)}>{step.state}</StatusChip>
                            </div>
                            <div className="px-flow-meta">{step.stepId} · {step.requirement} · updated {formatDate(step.updatedAt)}</div>
                            <div className="px-flow-actions">
                              <Button
                                variant="ghost"
                                disabled={Boolean(busy)}
                                onClick={() => updateStep(selected.identityId, step.stepId, 'completed')}
                              >
                                <IconCheck s={12} /> Complete
                              </Button>
                              {step.requirement === 'optional' && (
                                <>
                                  <Button variant="ghost" disabled={Boolean(busy)} onClick={() => updateStep(selected.identityId, step.stepId, 'skipped')}>
                                    Skip
                                  </Button>
                                  <Button variant="ghost" disabled={Boolean(busy)} onClick={() => updateStep(selected.identityId, step.stepId, 'deferred')}>
                                    Defer
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </InstrumentPanel>
          </div>
        </>
      )}
    </div>
  );
}
