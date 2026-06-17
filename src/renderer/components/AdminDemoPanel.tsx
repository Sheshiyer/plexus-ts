import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, Panel, Button, Badge, SectionLabel, Skeleton, EmptyState } from './ui';
import { IconCheck, IconProjects, IconSync } from './Icons';
import type { AdminDemoIdentity, AdminDemoOverview, OnboardingStateValue } from '../../shared/types';

function badgeTone(state: string): 'bill' | 'mint' | 'rose' | undefined {
  if (state === 'completed') return 'mint';
  if (state === 'failed') return 'rose';
  if (state === 'skipped' || state === 'deferred') return 'bill';
  return undefined;
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
          <Badge tone={identity.role === 'admin' ? 'bill' : undefined}>{identity.role}</Badge>
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
    const res = await window.plexus.adminDemoOnboardingUpdate(identityId, stepId, state, { adminDemo: true });
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
        <PageHeader title="Admin Demo" sub="real TeamForge overview" />
        <Panel pad><Skeleton lines={6} /></Panel>
      </div>
    );
  }

  return (
    <div className="px-fadein">
      <PageHeader
        title="Admin Demo"
        sub={overview ? `${overview.workspaceId} · ${overview.identities.length} identities` : 'real TeamForge overview'}
        right={<Button variant="ghost" onClick={load}><IconSync s={14} /> Refresh</Button>}
      />

      {error && (
        <Panel raised pad crosshairs style={{ borderColor: 'var(--rose)', marginBottom: 18 }}>
          <div className="px-mono md" style={{ color: 'var(--rose)' }}>{error}</div>
        </Panel>
      )}

      {overview && (
        <>
          <div className="px-specs px-specs-four">
            <div className="px-spec"><span className="l">viewer</span><span className="v compact">{overview.viewer.email}</span></div>
            <div className="px-spec"><span className="l">role</span><span className="v">{overview.viewer.role}</span></div>
            <div className="px-spec acc"><span className="l">projects</span><span className="v">{overview.projects.length}</span></div>
            <div className="px-spec"><span className="l">visibility</span><span className="v">{overview.viewer.projectVisibility}</span></div>
          </div>

          <Panel raised pad crosshairs className="px-composed-panel" style={{ marginTop: 18 }}>
            <div className="px-section-head">
              <div>
                <SectionLabel>project overview</SectionLabel>
                <div className="px-section-note">Admin visibility is loaded from TeamForge and capped here to the first visible project set.</div>
              </div>
              <Badge tone="mint">{overview.projects.length} total</Badge>
            </div>
            <div className="px-token-cloud">
              {overview.projects.slice(0, 18).map((project: any) => (
                <Badge key={project.id ?? project.name} tone="mint">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <IconProjects s={11} /> {project.name ?? project.id}
                  </span>
                </Badge>
              ))}
            </div>
          </Panel>

          <div className="px-admin-layout">
            <Panel raised pad crosshairs className="px-composed-panel">
              <div className="px-section-head">
                <div>
                  <SectionLabel>identities</SectionLabel>
                  <div className="px-section-note">Select an employee context without bypassing the real session contract.</div>
                </div>
              </div>
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
            </Panel>

            <Panel raised pad crosshairs className="px-composed-panel">
              <div className="px-section-head">
                <div>
                  <SectionLabel>employee onboarding emulation</SectionLabel>
                  <div className="px-section-note">Each action writes demo-safe onboarding state through the same Worker route employees use.</div>
                </div>
              </div>
              {!selected && <EmptyState>Select an identity to inspect its real onboarding state.</EmptyState>}
              {selected && (
                <div className="px-stack">
                  <div className="px-token-cloud">
                    <strong>{selected.displayName}</strong>
                    <Badge>{selected.email}</Badge>
                    <Badge tone={selected.role === 'admin' ? 'bill' : undefined}>{selected.role}</Badge>
                  </div>
                  {selected.onboarding.steps.map((step) => (
                    <div key={step.stepId} className={`px-flow-card state-${step.state}`}>
                      <div className="px-flow-icon">
                        <IconCheck s={15} />
                      </div>
                      <div className="px-flow-main">
                        <div className="px-flow-top">
                          <div className="px-flow-title">{step.label}</div>
                          <Badge tone={badgeTone(step.state)}>{step.state}</Badge>
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
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
