import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, Button, Skeleton } from './ui';
import { IconCheck, IconProjects, IconSync } from './Icons';
import type { AdminDemoIdentity, AdminDemoOverview, OnboardingStateValue } from '../../shared/types';
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

function IdentityCard({
  identity,
  selected,
  onSelect,
}: {
  identity: AdminDemoIdentity;
  selected: boolean;
  onSelect: () => void;
}) {
  const done = identity.onboarding.steps.filter((step) => step.state === 'completed').length;
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
        </div>
        <div className="px-command-meta">{identity.email}</div>
      </div>
      <div className="px-command-aside">
        <span className="px-lbl">onboarding</span>
        <span className="px-command-progress">{done}/{identity.onboarding.steps.length}</span>
      </div>
    </button>
  );
}

export default function AdminDemoPanel() {
  const [overview, setOverview] = useState<AdminDemoOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await window.plexus.adminDemoOverview();
    if (res.ok && res.overview) {
      setOverview(res.overview);
      setSelectedId((current) => current || res.overview?.identities[0]?.identityId || '');
    } else {
      setError(res.message ?? 'Admin overview unavailable');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(
    () => overview?.identities.find((identity) => identity.identityId === selectedId) ?? null,
    [overview, selectedId],
  );

  const updateStep = async (identityId: string, stepId: string, state: OnboardingStateValue) => {
    setBusy(`${identityId}:${stepId}:${state}`);
    setError('');
    const res = await window.plexus.adminDemoOnboardingUpdate(identityId, stepId, state, { source: 'admin_workspace' });
    if (res.ok && res.overview) {
      setOverview(res.overview);
    } else {
      setError(res.message ?? 'Could not update onboarding state');
    }
    setBusy('');
  };

  if (loading) {
    return (
      <div className="px-fadein">
        <PageHeader title="Admin Workspace" sub="workspace overview" />
        <InstrumentPanel label="loading workspace" title="Reading admin contract">
          <Skeleton lines={6} />
        </InstrumentPanel>
      </div>
    );
  }

  return (
    <div className="px-fadein">
      <PageHeader
        title="Admin Workspace"
        sub={overview ? `${overview.workspaceId} · ${overview.identities.length} identities` : 'workspace overview'}
        right={<CommandDock><Button variant="ghost" onClick={load}><IconSync s={14} /> Refresh</Button></CommandDock>}
      />

      {error && (
        <DegradedStatePanel title="Admin overview unavailable" message={error} tone="error" onRetry={load} />
      )}

      {overview && (
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
                    onSelect={() => setSelectedId(identity.identityId)}
                  />
                ))}
              </div>
            </InstrumentPanel>

            <InstrumentPanel
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
                  </div>
                  {selected.onboarding.steps.map((step) => (
                    <div key={step.stepId} className={`px-flow-card state-${step.state}`}>
                      <div className="px-flow-icon">
                        <IconCheck s={15} />
                      </div>
                      <div className="px-flow-main">
                        <div className="px-flow-top">
                          <div className="px-flow-title">{step.label}</div>
                          <StatusChip tone={badgeTone(step.state)}>{step.state}</StatusChip>
                        </div>
                        <div className="px-flow-meta">{step.stepId} · {step.requirement}</div>
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
              )}
            </InstrumentPanel>
          </div>
        </>
      )}
    </div>
  );
}
