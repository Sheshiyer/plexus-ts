import React, { useMemo, useState } from 'react';
import { PageHeader, Panel, Button, Badge, SectionLabel, EmptyState } from './ui';
import { IconCheck, IconClose, IconPaperclip, IconProjects, IconSettings, IconTimer } from './Icons';
import type { OnboardingStateValue, OnboardingStepState, Session } from '../../shared/types';

interface Props {
  session: Session;
  onSessionChange: (session: Session) => void;
  onContinue?: () => void;
}

function iconFor(stepId: string) {
  if (stepId === 'identity_projects') return IconProjects;
  if (stepId === 'paperclip') return IconPaperclip;
  if (stepId === 'daily_agent') return IconTimer;
  return IconSettings;
}

function toneFor(state: OnboardingStateValue): 'bill' | 'mint' | 'rose' | undefined {
  if (state === 'completed') return 'mint';
  if (state === 'failed') return 'rose';
  if (state === 'skipped' || state === 'deferred') return 'bill';
  return undefined;
}

function stateText(step: OnboardingStepState): string {
  if (step.state === 'required' || step.state === 'optional') return step.requirement;
  return step.state;
}

export default function Onboarding({ session, onSessionChange, onContinue }: Props) {
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const steps = session.onboarding?.steps ?? [];
  const requiredOpen = useMemo(
    () => steps.some((step) => step.requirement === 'required' && step.state !== 'completed'),
    [steps],
  );

  const update = async (
    step: OnboardingStepState,
    state: OnboardingStateValue,
    runner?: () => Promise<{ ok: boolean; message?: string }>,
  ) => {
    setBusyStep(step.stepId);
    setMessage('');
    try {
      if (runner) {
        const ran = await runner();
        if (!ran.ok) {
          await window.plexus.onboardingUpdate(step.stepId, 'failed', { message: ran.message ?? 'Step failed' });
          const refreshed = await window.plexus.authRefreshSession();
          if (refreshed.session) onSessionChange(refreshed.session);
          setMessage(ran.message ?? 'Step failed');
          return;
        }
      }
      const res = await window.plexus.onboardingUpdate(step.stepId, state);
      if (res.ok && res.session) onSessionChange(res.session);
      else setMessage(res.message ?? 'Could not update onboarding state');
    } catch (err: any) {
      setMessage(err.message ?? 'Could not update onboarding state');
    } finally {
      setBusyStep(null);
    }
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Onboarding"
        sub={`${session.displayName} · ${session.role} · ${session.workspaceId}`}
        right={onContinue && (
          <Button variant="ghost" onClick={onContinue}>
            Continue to app
          </Button>
        )}
      />

      <Panel raised pad crosshairs className="px-composed-panel">
        <div className="px-section-head">
          <div>
            <SectionLabel>session contract</SectionLabel>
            <div className="px-section-note">Role, visibility, and onboarding state are resolved by TeamForge before this screen renders.</div>
          </div>
        </div>
        <div className="px-specs px-specs-four">
          <div className="px-spec"><span className="l">email</span><span className="v compact">{session.email}</span></div>
          <div className="px-spec"><span className="l">role</span><span className="v">{session.role}</span></div>
          <div className="px-spec"><span className="l">projects</span><span className="v">{session.projectVisibility}</span></div>
          <div className="px-spec acc"><span className="l">required</span><span className="v" style={{ color: requiredOpen ? 'var(--rose)' : 'var(--accent)' }}>{requiredOpen ? 'open' : 'done'}</span></div>
        </div>
      </Panel>

      <Panel raised pad crosshairs className="px-composed-panel" style={{ marginTop: 18 }}>
        <div className="px-section-head">
          <div>
            <SectionLabel>steps</SectionLabel>
            <div className="px-section-note">Required steps keep the app sequence intact; optional fabric steps can be completed, skipped, or deferred.</div>
          </div>
        </div>
        {!steps.length && <EmptyState>No onboarding state returned by TeamForge.</EmptyState>}
        <div className="px-flow-grid">
          {steps.map((step) => {
            const StepIcon = iconFor(step.stepId);
            const busy = busyStep === step.stepId;
            const isOptional = step.requirement === 'optional';
            return (
              <div key={step.stepId} className={`px-flow-card state-${step.state}`}>
                <div className="px-flow-icon">
                  <StepIcon s={18} />
                </div>
                <div className="px-flow-main">
                  <div className="px-flow-top">
                    <div className="px-flow-title">{step.label}</div>
                    <Badge tone={toneFor(step.state)}>{stateText(step)}</Badge>
                  </div>
                  <div className="px-flow-meta">
                    {step.stepId} · updated {new Date(step.updatedAt).toLocaleString()}
                  </div>
                  <div className="px-flow-actions">
                    <Button
                      variant="accent"
                      disabled={busy}
                      onClick={() => update(
                        step,
                        'completed',
                        step.stepId === 'identity_projects'
                          ? async () => {
                              const synced = await window.plexus.projectsSync();
                              return { ok: synced.ok, message: synced.message };
                            }
                          : step.stepId === 'paperclip'
                            ? async () => {
                                const setup = await window.plexus.memberSetup();
                                return { ok: setup.ok, message: setup.message };
                              }
                            : undefined,
                      )}
                    >
                      <IconCheck s={12} /> {busy ? 'Working...' : 'Complete'}
                    </Button>
                    {isOptional && (
                      <>
                        <Button variant="ghost" disabled={busy} onClick={() => update(step, 'skipped')}>
                          Skip
                        </Button>
                        <Button variant="ghost" disabled={busy} onClick={() => update(step, 'deferred')}>
                          Defer
                        </Button>
                      </>
                    )}
                    {step.state === 'failed' && (
                      <Button variant="ghost" disabled={busy} onClick={() => update(step, step.requirement)}>
                        <IconClose s={12} /> Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {message && (
        <Panel raised pad crosshairs style={{ marginTop: 18, borderColor: 'var(--rose)' }}>
          <div className="px-mono" style={{ color: 'var(--rose)', fontSize: 12 }}>{message}</div>
        </Panel>
      )}
    </div>
  );
}
