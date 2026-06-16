import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader, Panel, Button, Badge, SectionLabel, EmptyState } from './ui';
import { IconCheck, IconClose, IconPaperclip, IconProjects, IconSettings, IconTimer, IconMic, IconCamera, IconScreen } from './Icons';
import type { MediaCaptureStatus, MediaPermissionState, OnboardingStateValue, OnboardingStepState, Session } from '../../shared/types';

function permTone(state: MediaPermissionState): 'mint' | 'rose' | undefined {
  if (state === 'granted') return 'mint';
  if (state === 'denied' || state === 'restricted') return 'rose';
  return undefined;
}

function permLabel(state: MediaPermissionState): string {
  if (state === 'not-determined') return 'not asked';
  return state;
}

function PermCard({
  icon,
  label,
  state,
  onRequest,
  onOpenSettings,
  requesting,
}: {
  icon: React.ReactNode;
  label: string;
  state: MediaPermissionState;
  onRequest?: () => void;
  onOpenSettings?: () => void;
  requesting: boolean;
}) {
  const denied = state === 'denied' || state === 'restricted';
  const granted = state === 'granted';
  return (
    <div className={`px-flow-card ${denied ? 'state-failed' : granted ? 'state-completed' : 'state-deferred'}`}>
      <div className="px-flow-icon">{granted ? <IconCheck s={16} /> : denied ? <IconClose s={16} /> : icon}</div>
      <div className="px-flow-main">
        <div className="px-flow-top">
          <div className="px-flow-title">{label}</div>
          <Badge tone={permTone(state)}>{permLabel(state)}</Badge>
        </div>
        {!granted && (
          <div className="px-flow-actions">
            {onRequest && !denied && (
              <Button variant="ghost" onClick={onRequest} disabled={requesting}>
                {requesting ? 'Requesting…' : `Request ${label}`}
              </Button>
            )}
            {onOpenSettings && (denied || state === 'not-determined') && (
              <Button variant="ghost" onClick={onOpenSettings} disabled={requesting}>
                Open System Settings
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [captureStatus, setCaptureStatus] = useState<MediaCaptureStatus | null>(null);
  const [permRequesting, setPermRequesting] = useState<string | null>(null);
  const steps = session.onboarding?.steps ?? [];
  const requiredOpen = useMemo(
    () => steps.some((step) => step.requirement === 'required' && step.state !== 'completed'),
    [steps],
  );

  useEffect(() => {
    let cancelled = false;
    async function probeAndRequest() {
      const status = await window.plexus.mediaCaptureStatus();
      if (cancelled) return;
      setCaptureStatus(status);

      // Auto-request mic then camera if not yet determined (triggers native macOS dialogs)
      if (status.permissions.microphone === 'not-determined') {
        setPermRequesting('microphone');
        const updated = await window.plexus.mediaRequestAccess('microphone');
        if (!cancelled) {
          setCaptureStatus(updated);
          setPermRequesting(null);
        }
      }
      if (status.permissions.camera === 'not-determined') {
        setPermRequesting('camera');
        const updated = await window.plexus.mediaRequestAccess('camera');
        if (!cancelled) {
          setCaptureStatus(updated);
          setPermRequesting(null);
        }
      }
      // Re-probe after requests so screen status reflects desktopCapturer state
      if (!cancelled) {
        const final = await window.plexus.mediaCaptureStatus();
        if (!cancelled) setCaptureStatus(final);
      }
    }
    probeAndRequest();
    return () => { cancelled = true; };
  }, []);

  const requestPerm = async (kind: 'microphone' | 'camera') => {
    setPermRequesting(kind);
    try {
      const updated = await window.plexus.mediaRequestAccess(kind);
      setCaptureStatus(updated);
    } finally {
      setPermRequesting(null);
    }
  };

  const requestScreenPerm = async () => {
    setPermRequesting('screen');
    try {
      // Re-probing calls desktopCapturer.getSources() which triggers the TCC prompt if not-determined
      const updated = await window.plexus.mediaCaptureStatus();
      setCaptureStatus(updated);
    } finally {
      setPermRequesting(null);
    }
  };

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

      {captureStatus && (
        <Panel raised pad crosshairs className="px-composed-panel" style={{ marginTop: 18 }}>
          <div className="px-section-head">
            <div>
              <SectionLabel>system permissions</SectionLabel>
              <div className="px-section-note">
                Plexus requests microphone and camera access for realtime collaboration. Screen recording requires manual approval in System Settings.
              </div>
            </div>
            <Badge tone={
              captureStatus.permissions.microphone === 'granted' &&
              captureStatus.permissions.camera === 'granted' &&
              captureStatus.permissions.screen === 'granted'
                ? 'mint' : undefined
            }>
              {[captureStatus.permissions.microphone, captureStatus.permissions.camera, captureStatus.permissions.screen]
                .filter(s => s === 'granted').length}/3 granted
            </Badge>
          </div>
          <div className="px-flow-grid">
            <PermCard
              icon={<IconMic s={16} />}
              label="microphone"
              state={captureStatus.permissions.microphone}
              onRequest={() => requestPerm('microphone')}
              requesting={permRequesting === 'microphone'}
            />
            <PermCard
              icon={<IconCamera s={16} />}
              label="camera"
              state={captureStatus.permissions.camera}
              onRequest={() => requestPerm('camera')}
              requesting={permRequesting === 'camera'}
            />
            <PermCard
              icon={<IconScreen s={16} />}
              label="screen recording"
              state={captureStatus.permissions.screen}
              onRequest={captureStatus.permissions.screen === 'not-determined' ? requestScreenPerm : undefined}
              onOpenSettings={() => window.plexus.mediaOpenScreenSettings()}
              requesting={permRequesting === 'screen'}
            />
          </div>
        </Panel>
      )}

      {message && (
        <Panel raised pad crosshairs style={{ marginTop: 18, borderColor: 'var(--rose)' }}>
          <div className="px-mono" style={{ color: 'var(--rose)', fontSize: 12 }}>{message}</div>
        </Panel>
      )}
    </div>
  );
}
