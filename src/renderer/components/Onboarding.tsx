import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, SectionLabel, Field, Input, Toggle } from './ui';
import { IconCheck, IconClose, IconPaperclip, IconProjects, IconSettings, IconTimer } from './Icons';
import type { OnboardingStateValue, OnboardingStepState, PaperclipInstallStatus, PlexusSettings, Session } from '../../shared/types';
import PermissionsGate from './PermissionsGate';
import { WorkerConnectionButton, type WorkerConnectionState } from './ConnectionStatus';
import {
  DegradedStatePanel,
  EmptyStatePanel,
  MetricRail,
  MetricRailGroup,
  StatusChip,
  type PlexusTone,
} from './PlexusUI';

interface Props {
  session: Session;
  onSessionChange: (session: Session) => void;
  onContinue?: () => void;
  onOpenProjects?: () => void;
  workerConnection?: WorkerConnectionState;
  onRefreshWorkerConnection?: () => void;
}

interface SetupPanelProps {
  session: Session;
  onSessionChange: (session: Session) => void;
  onOpenFlow?: () => void;
}

type OnboardingScene = 'entry' | 'proof' | 'rhythm' | 'readiness';
type FlowStepKind = 'welcome' | 'session' | 'worker' | 'permissions' | 'rhythm' | 'readiness';

type FlowStep = {
  id: string;
  kind: FlowStepKind;
  scene: OnboardingScene;
  eyebrow: string;
  title: string;
  body: string;
  workerStep?: OnboardingStepState;
};

const onboardingSceneAssets: Record<OnboardingScene, string> = {
  entry: new URL('../../../docs/design/moodboards/2026-06-19-onboarding/images/01-entry-higgs-field.png', import.meta.url).href,
  proof: new URL('../../../docs/design/moodboards/2026-06-19-onboarding/images/02-github-proof-graph.png', import.meta.url).href,
  rhythm: new URL('../../../docs/design/moodboards/2026-06-19-onboarding/images/03-rhythm-breakwork.png', import.meta.url).href,
  readiness: new URL('../../../docs/design/moodboards/2026-06-19-onboarding/images/04-readiness-portal.png', import.meta.url).href,
};

function iconFor(stepId: string) {
  if (stepId === 'identity_projects') return IconProjects;
  if (stepId === 'paperclip') return IconPaperclip;
  if (stepId === 'daily_agent') return IconTimer;
  return IconSettings;
}

function toneFor(state: OnboardingStateValue): PlexusTone {
  if (state === 'completed') return 'accent';
  if (state === 'failed') return 'error';
  if (state === 'skipped' || state === 'deferred') return 'warning';
  return 'idle';
}

function stateText(step: OnboardingStepState): string {
  if (step.state === 'required' || step.state === 'optional') return step.requirement;
  return step.state;
}

function isOpenStep(step: OnboardingStepState): boolean {
  return step.state !== 'completed' && step.state !== 'skipped' && step.state !== 'deferred';
}

function sceneForStepId(stepId: string): OnboardingScene {
  if (stepId === 'identity_projects') return 'proof';
  if (stepId === 'preferences') return 'rhythm';
  if (stepId === 'paperclip' || stepId === 'daily_agent') return 'readiness';
  return 'entry';
}

function copyForStep(step: OnboardingStepState): Pick<FlowStep, 'eyebrow' | 'title' | 'body'> {
  if (step.stepId === 'identity_projects') {
    return {
      eyebrow: 'github evidence',
      title: 'Bind work to a verifiable project surface.',
      body: 'Project access and GitHub repo coverage are the first proof gate. Work sessions can continue only when the project has a verified repository binding.',
    };
  }
  if (step.stepId === 'preferences') {
    return {
      eyebrow: 'working style',
      title: 'Set the member context the fabric can safely use.',
      body: 'Preferences guide standup context, focus suggestions, and report visibility without blocking core work.',
    };
  }
  if (step.stepId === 'paperclip') {
    return {
      eyebrow: 'agent fabric',
      title: 'Prepare Paperclip without blocking verified work.',
      body: 'Paperclip setup is useful for handoffs and generated support, but a runtime failure becomes a retry state instead of stopping the app.',
    };
  }
  if (step.stepId === 'daily_agent') {
    return {
      eyebrow: 'standup proof',
      title: 'Connect daily updates to evidence before meetings.',
      body: 'The daily agent should make standups shorter by carrying project, work record, and repo activity context into the review loop.',
    };
  }
  return {
    eyebrow: step.requirement,
    title: step.label,
    body: 'Complete, skip, defer, or retry this setup item from a single focused screen.',
  };
}

function buildFlowSteps(steps: OnboardingStepState[]): FlowStep[] {
  const workerSteps = steps.map((step): FlowStep => ({
    id: `worker:${step.stepId}`,
    kind: 'worker',
    scene: sceneForStepId(step.stepId),
    workerStep: step,
    ...copyForStep(step),
  }));

  return [
    {
      id: 'welcome',
      kind: 'welcome',
      scene: 'entry',
      eyebrow: 'enter plexus',
      title: 'Set up the work coordination layer one step at a time.',
      body: 'This flow activates identity, repo proof, native permissions, private rhythm, and readiness without turning onboarding into another app page.',
    },
    {
      id: 'session',
      kind: 'session',
      scene: 'entry',
      eyebrow: 'identity',
      title: 'Confirm the verified member session.',
      body: 'Cloudflare Access remains the source of authentication. Local profile and rhythm settings stay separate from that identity proof.',
    },
    ...workerSteps,
    {
      id: 'permissions',
      kind: 'permissions',
      scene: 'readiness',
      eyebrow: 'native controls',
      title: 'Grant only the native permissions Plexus needs.',
      body: 'Microphone, camera, speaker, and screen recording controls support co-working without trapping the member if one permission is denied.',
    },
    {
      id: 'rhythm',
      kind: 'rhythm',
      scene: 'rhythm',
      eyebrow: 'private rhythm',
      title: 'Choose whether rhythm support belongs in this workspace.',
      body: 'Birthdate-based reminders and breakwork stay optional, local-first, and deletable.',
    },
    {
      id: 'readiness',
      kind: 'readiness',
      scene: 'readiness',
      eyebrow: 'readiness',
      title: 'Review what is complete before entering the app.',
      body: 'Required items, optional skips, retry states, and privacy settings stay visible after onboarding in Settings.',
    },
  ];
}

function OnboardingSceneBackground({ scene }: { scene: OnboardingScene }) {
  const [layers, setLayers] = useState<Array<{ scene: OnboardingScene; id: number }>>([{ scene, id: 0 }]);

  useEffect(() => {
    setLayers((current) => {
      const latest = current[current.length - 1];
      if (latest?.scene === scene) return current;
      return [...current.slice(-1), { scene, id: Date.now() }];
    });
    const timeout = window.setTimeout(() => {
      setLayers((current) => current.slice(-1));
    }, 1050);
    return () => window.clearTimeout(timeout);
  }, [scene]);

  return (
    <div className="px-onboarding-bg" aria-hidden="true">
      {layers.map((layer, index) => (
        <img
          key={`${layer.scene}-${layer.id}`}
          className={`px-onboarding-bg-img ${index === layers.length - 1 ? 'active' : 'leaving'}`}
          src={onboardingSceneAssets[layer.scene]}
          alt=""
        />
      ))}
      <div className="px-onboarding-bg-scrim" />
      <div className="px-onboarding-bg-signal" />
    </div>
  );
}

function useOnboardingRuntime(session: Session, onSessionChange?: (session: Session) => void) {
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [installStatus, setInstallStatus] = useState<PaperclipInstallStatus | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PlexusSettings | null>(null);
  const [birthdate, setBirthdate] = useState('');
  const [rhythmEnabled, setRhythmEnabled] = useState(false);
  const [rhythmSaving, setRhythmSaving] = useState(false);
  const [rhythmSavedAt, setRhythmSavedAt] = useState<string | null>(null);
  const steps = useMemo(() => session.onboarding?.steps ?? [], [session.onboarding?.steps]);
  const requiredOpen = useMemo(
    () => steps.some((step) => step.requirement === 'required' && step.state !== 'completed'),
    [steps],
  );

  const loadInstall = useCallback(async () => {
    try {
      setInstallStatus(await window.plexus.fabricInstallStatus());
      setInstallError(null);
    } catch (e: any) {
      setInstallError(e?.message ?? 'Could not reach the Paperclip runtime.');
    }
  }, []);

  useEffect(() => {
    loadInstall();
    const id = setInterval(loadInstall, 15000);
    return () => clearInterval(id);
  }, [loadInstall]);

  useEffect(() => {
    window.plexus.settingsGet().then((next) => {
      setSettings(next);
      setBirthdate(next.rhythmProfile.birthdate ?? '');
      setRhythmEnabled(next.rhythmProfile.enabled);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setRhythmSavedAt(null);
  }, [birthdate, rhythmEnabled]);

  const saveRhythm = async () => {
    const now = new Date().toISOString();
    setRhythmSaving(true);
    setMessage('');
    try {
      const next = await window.plexus.settingsSet({
        rhythmProfile: {
          enabled: rhythmEnabled,
          birthdate: birthdate || undefined,
          privateConsentAt: rhythmEnabled ? (settings?.rhythmProfile.privateConsentAt ?? now) : null,
          updatedAt: now,
        },
      });
      setSettings(next);
      setRhythmSavedAt(now);
      window.setTimeout(() => {
        setRhythmSavedAt((current) => (current === now ? null : current));
      }, 3500);
    } catch (err: any) {
      setRhythmSavedAt(null);
      setMessage(err?.message ?? 'Could not save private rhythm setup.');
    } finally {
      setRhythmSaving(false);
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
          if (refreshed.session) onSessionChange?.(refreshed.session);
          setMessage(ran.message ?? 'Step failed');
          return;
        }
      }
      const res = await window.plexus.onboardingUpdate(step.stepId, state);
      if (res.ok && res.session) onSessionChange?.(res.session);
      if (res.message) setMessage(res.message);
      else if (!res.ok) setMessage('Could not update onboarding state');
    } catch (err: any) {
      setMessage(err.message ?? 'Could not update onboarding state');
    } finally {
      setBusyStep(null);
    }
  };

  return {
    busyStep,
    message,
    installStatus,
    installError,
    settings,
    birthdate,
    setBirthdate,
    rhythmEnabled,
    setRhythmEnabled,
    rhythmSaving,
    rhythmSavedAt,
    steps,
    requiredOpen,
    loadInstall,
    saveRhythm,
    update,
  };
}

function runnerForStep(step: OnboardingStepState): (() => Promise<{ ok: boolean; message?: string }>) | undefined {
  if (step.stepId === 'identity_projects') {
    return async () => {
      const synced = await window.plexus.projectsSync();
      return { ok: synced.ok, message: synced.message };
    };
  }
  if (step.stepId === 'paperclip') {
    return async () => {
      const setup = await window.plexus.memberSetup();
      return { ok: setup.ok, message: setup.message };
    };
  }
  if (step.stepId === 'daily_agent') {
    return async () => {
      const fabric = await window.plexus.fabricStatus();
      const reachable = fabric.bridge.reachable || fabric.ports.some((p) => p.reachable);
      return reachable
        ? { ok: true }
        : { ok: false, message: 'Daily agent runtime offline - start Paperclip (:3100/:3101), then retry.' };
    };
  }
  return undefined;
}

function OnboardingStepActions({
  step,
  busyStep,
  update,
  onOpenProjects,
}: {
  step: OnboardingStepState;
  busyStep: string | null;
  update: ReturnType<typeof useOnboardingRuntime>['update'];
  onOpenProjects?: () => void;
}) {
  const busy = busyStep === step.stepId;
  const isOptional = step.requirement === 'optional';

  return (
    <div className="px-flow-actions">
      <Button
        variant="accent"
        disabled={busy}
        onClick={() => update(step, 'completed', runnerForStep(step))}
      >
        <IconCheck s={12} /> {busy ? 'Working...' : 'Complete'}
      </Button>
      {step.stepId === 'identity_projects' && onOpenProjects && (
        <Button variant="ghost" disabled={busy} onClick={onOpenProjects}>
          Open Projects
        </Button>
      )}
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
  );
}

function RuntimeMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <DegradedStatePanel title="Onboarding action" message={message} tone="warning" />
  );
}

function SessionContract({ session, requiredOpen }: { session: Session; requiredOpen: boolean }) {
  return (
    <MetricRailGroup className="pxds-metric-grid-identity">
      <MetricRail label="email" value={session.email} tone="mint" hint="verified" />
      <MetricRail label="role" value={session.role} tone={session.role === 'admin' ? 'accent' : 'idle'} hint="session" />
      <MetricRail label="projects" value={session.projectVisibility} tone="mint" hint="visibility" />
      <MetricRail label="required" value={requiredOpen ? 'open' : 'done'} tone={requiredOpen ? 'warning' : 'accent'} hint="setup state" />
    </MetricRailGroup>
  );
}

function PaperclipPreflight({
  installStatus,
  installError,
}: {
  installStatus: PaperclipInstallStatus | null;
  installError: string | null;
}) {
  if (!installStatus && !installError) {
    return <EmptyStatePanel title="Paperclip pre-flight is loading" message="Runtime checks will appear once the local probe returns." />;
  }
  if (installError) {
    return <DegradedStatePanel title="Paperclip pre-flight failed" message={installError} tone="warning" />;
  }
  if (!installStatus) return null;
  return (
    <MetricRailGroup>
      <MetricRail label="binary" value={installStatus.binaryFound ? installStatus.binaryPath?.split('/').pop() : 'not found'} tone={installStatus.binaryFound ? 'accent' : 'warning'} hint="paperclipai" />
      <MetricRail label="config" value={installStatus.configFound ? `port ${installStatus.serverPort}` : 'no config'} tone={installStatus.configFound ? 'accent' : 'warning'} hint="runtime" />
      <MetricRail label="ready" value={installStatus.binaryFound && installStatus.configFound ? 'yes' : 'no'} tone={installStatus.binaryFound && installStatus.configFound ? 'accent' : 'warning'} hint="optional" />
    </MetricRailGroup>
  );
}

function RhythmControls({
  birthdate,
  setBirthdate,
  rhythmEnabled,
  setRhythmEnabled,
  rhythmSaving,
  rhythmSavedAt,
  saveRhythm,
}: {
  birthdate: string;
  setBirthdate: (value: string) => void;
  rhythmEnabled: boolean;
  setRhythmEnabled: (enabled: boolean) => void;
  rhythmSaving: boolean;
  rhythmSavedAt: string | null;
  saveRhythm: () => Promise<void>;
}) {
  return (
    <div className="px-onboarding-rhythm-grid">
      <Field label="birthdate">
        <Input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} />
      </Field>
      <Field label="rhythm support">
        <Toggle<'enabled' | 'paused'>
          value={rhythmEnabled ? 'enabled' : 'paused'}
          onChange={v => setRhythmEnabled(v === 'enabled')}
          options={[{ key: 'enabled', label: 'enabled' }, { key: 'paused', label: 'paused' }]}
        />
      </Field>
      <div className="px-rhythm-save-cell">
        <Button onClick={saveRhythm} disabled={rhythmSaving}>
          {rhythmSaving ? 'Saving rhythm' : rhythmSavedAt ? 'Rhythm saved' : 'Save Rhythm'}
        </Button>
        {rhythmSavedAt && (
          <div className="px-rhythm-save-pop" role="status" aria-live="polite">
            <IconCheck s={12} /> Private rhythm saved locally
          </div>
        )}
      </div>
    </div>
  );
}

function StepStatusList({
  steps,
  busyStep,
  update,
  onOpenProjects,
}: {
  steps: OnboardingStepState[];
  busyStep: string | null;
  update: ReturnType<typeof useOnboardingRuntime>['update'];
  onOpenProjects?: () => void;
}) {
  if (!steps.length) {
    return <EmptyStatePanel title="No onboarding state returned" message="The workspace service did not return setup steps for this session." />;
  }
  return (
    <div className="px-flow-grid">
      {steps.map((step) => {
        const StepIcon = iconFor(step.stepId);
        return (
          <div key={step.stepId} className={`px-flow-card state-${step.state}`}>
            <div className="px-flow-icon">
              <StepIcon s={18} />
            </div>
            <div className="px-flow-main">
                <div className="px-flow-top">
                  <div className="px-flow-title">{step.label}</div>
                <StatusChip tone={toneFor(step.state)}>{stateText(step)}</StatusChip>
              </div>
              <div className="px-flow-meta">
                {step.stepId} - updated {new Date(step.updatedAt).toLocaleString()}
              </div>
              <OnboardingStepActions
                step={step}
                busyStep={busyStep}
                update={update}
                onOpenProjects={onOpenProjects}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FlowBody({
  flowStep,
  session,
  runtime,
  onOpenProjects,
}: {
  flowStep: FlowStep;
  session: Session;
  runtime: ReturnType<typeof useOnboardingRuntime>;
  onOpenProjects?: () => void;
}) {
  if (flowStep.kind === 'welcome') {
    return (
      <div className="px-onboarding-principles">
        <div><span>01</span><strong>Identity</strong><small>Confirm who is entering the workspace.</small></div>
        <div><span>02</span><strong>Proof</strong><small>Bind projects to GitHub-backed evidence.</small></div>
        <div><span>03</span><strong>Controls</strong><small>Enable native media only where needed.</small></div>
        <div><span>04</span><strong>Rhythm</strong><small>Keep breakwork optional and private.</small></div>
      </div>
    );
  }

  if (flowStep.kind === 'session') {
    return <SessionContract session={session} requiredOpen={runtime.requiredOpen} />;
  }

  if (flowStep.kind === 'worker' && flowStep.workerStep) {
    return (
      <div className="px-onboarding-worker-step">
        <div className="px-section-head">
          <div>
            <div className="px-lbl">{flowStep.workerStep.requirement}</div>
            <div className="px-section-title">{flowStep.workerStep.label}</div>
            <div className="px-section-note">
              Current state: {flowStep.workerStep.state}. Updated {new Date(flowStep.workerStep.updatedAt).toLocaleString()}.
            </div>
          </div>
          <StatusChip tone={toneFor(flowStep.workerStep.state)}>{stateText(flowStep.workerStep)}</StatusChip>
        </div>
        {flowStep.workerStep.stepId === 'paperclip' && (
          <div style={{ marginBottom: 14 }}>
            <PaperclipPreflight installStatus={runtime.installStatus} installError={runtime.installError} />
          </div>
        )}
        <OnboardingStepActions
          step={flowStep.workerStep}
          busyStep={runtime.busyStep}
          update={runtime.update}
          onOpenProjects={onOpenProjects}
        />
      </div>
    );
  }

  if (flowStep.kind === 'permissions') {
    return <PermissionsGate onComplete={runtime.loadInstall} />;
  }

  if (flowStep.kind === 'rhythm') {
    return (
      <RhythmControls
        birthdate={runtime.birthdate}
        setBirthdate={runtime.setBirthdate}
        rhythmEnabled={runtime.rhythmEnabled}
        setRhythmEnabled={runtime.setRhythmEnabled}
        rhythmSaving={runtime.rhythmSaving}
        rhythmSavedAt={runtime.rhythmSavedAt}
        saveRhythm={runtime.saveRhythm}
      />
    );
  }

  return (
    <div className="px-onboarding-readiness-list">
      <div><span className="px-dot" /><strong>Required setup</strong><small>{runtime.requiredOpen ? 'Still open' : 'Complete'}</small></div>
      <div><span className="px-dot" /><strong>Onboarding state</strong><small>{session.onboarding.completed ? 'Complete' : 'Open'}</small></div>
      <div><span className="px-dot" /><strong>Paperclip</strong><small>{runtime.installStatus?.binaryFound ? 'Installed' : 'Retry from Settings if needed'}</small></div>
      <div><span className="px-dot" /><strong>Rhythm</strong><small>{runtime.rhythmEnabled ? 'Enabled' : 'Optional or paused'}</small></div>
    </div>
  );
}

export function OnboardingSetupPanel({ session, onSessionChange, onOpenFlow }: SetupPanelProps) {
  const runtime = useOnboardingRuntime(session, onSessionChange);

  return (
    <div className="px-form-band">
      <div className="px-section-head">
        <div>
          <SectionLabel>Setup &amp; Onboarding</SectionLabel>
          <div className="px-section-note">
            The first-run experience is a guided flow. This Settings section preserves the underlying setup state, retry actions, permissions, and private rhythm controls.
          </div>
        </div>
        <div className="px-section-actions">
          {onOpenFlow && (
            <Button variant="ghost" onClick={onOpenFlow}>
              Open Guided Flow
            </Button>
          )}
        </div>
      </div>

      <div className="px-form-shell">
        <div className="px-form-band">
          <div className="px-section-head">
            <div>
              <SectionLabel>session contract</SectionLabel>
              <div className="px-section-note">Role, visibility, and required setup state from the workspace service.</div>
            </div>
          </div>
          <SessionContract session={session} requiredOpen={runtime.requiredOpen} />
        </div>

        <div className="px-form-band">
          <div className="px-section-head">
            <div>
              <SectionLabel>paperclip pre-flight</SectionLabel>
              <div className="px-section-note">Optional agent runtime health; failures remain retryable.</div>
            </div>
          </div>
          <PaperclipPreflight installStatus={runtime.installStatus} installError={runtime.installError} />
        </div>

        <div className="px-form-band">
          <div className="px-section-head">
            <div>
              <SectionLabel>step state</SectionLabel>
              <div className="px-section-note">Required steps protect workflow integrity; optional steps can be skipped or deferred.</div>
            </div>
          </div>
          <StepStatusList
            steps={runtime.steps}
            busyStep={runtime.busyStep}
            update={runtime.update}
          />
        </div>

        <div className="px-form-band">
          <div className="px-section-head">
            <div>
              <SectionLabel>private rhythm</SectionLabel>
              <div className="px-section-note">Birthdate stays local and is not sent to CEO-visible preferences or reports.</div>
            </div>
          </div>
          <RhythmControls
            birthdate={runtime.birthdate}
            setBirthdate={runtime.setBirthdate}
            rhythmEnabled={runtime.rhythmEnabled}
            setRhythmEnabled={runtime.setRhythmEnabled}
            rhythmSaving={runtime.rhythmSaving}
            rhythmSavedAt={runtime.rhythmSavedAt}
            saveRhythm={runtime.saveRhythm}
          />
        </div>

        <PermissionsGate onComplete={runtime.loadInstall} />
        <RuntimeMessage message={runtime.message} />
      </div>
    </div>
  );
}

export default function Onboarding({
  session,
  onSessionChange,
  onContinue,
  onOpenProjects,
  workerConnection,
  onRefreshWorkerConnection,
}: Props) {
  const runtime = useOnboardingRuntime(session, onSessionChange);
  const flowSteps = useMemo(() => buildFlowSteps(runtime.steps), [runtime.steps]);
  const firstOpenIndex = useMemo(() => {
    const index = flowSteps.findIndex((step) => step.workerStep && isOpenStep(step.workerStep));
    return index > -1 ? index : 0;
  }, [flowSteps]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, flowSteps.length - 1)));
  }, [flowSteps.length]);

  useEffect(() => {
    if (firstOpenIndex > 0) setActiveIndex(firstOpenIndex);
  }, [firstOpenIndex]);

  const activeStep = flowSteps[activeIndex] ?? flowSteps[0];
  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= flowSteps.length - 1;

  return (
    <div className="px-onboarding-shell px-fadein" data-scene={activeStep.scene} role="dialog" aria-modal="true" aria-label="Plexus onboarding flow">
      <OnboardingSceneBackground scene={activeStep.scene} />
      <div className="px-onboarding-flow-chrome">
        <header className="px-onboarding-flow-top">
          <div>
            <span className="px-brandmark"><span className="px-dot pulse" /><b>PLEXUS</b></span>
            <div className="px-lbl">guided setup - Work Coordination Layer</div>
          </div>
          <div className="px-onboarding-top-actions">
            {workerConnection && onRefreshWorkerConnection && (
              <WorkerConnectionButton
                status={workerConnection}
                onRefresh={onRefreshWorkerConnection}
                className="px-hud-action"
              />
            )}
            <Button variant="ghost" onClick={onContinue}>Continue to app</Button>
          </div>
        </header>

        <div className="px-onboarding-flow-grid">
          <aside className="px-onboarding-step-rail" aria-label="Onboarding steps">
            {flowSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={index === activeIndex ? 'on' : ''}
                onClick={() => setActiveIndex(index)}
                aria-current={index === activeIndex ? 'step' : undefined}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step.eyebrow}</strong>
                {step.workerStep && <small>{stateText(step.workerStep)}</small>}
              </button>
            ))}
          </aside>

          <main className="px-onboarding-flow-card">
            <div className="px-onboarding-flow-copy">
              <SectionLabel>{activeStep.eyebrow}</SectionLabel>
              <h1>{activeStep.title}</h1>
              <p>{activeStep.body}</p>
            </div>

            <div className="px-onboarding-step-body">
              <FlowBody
                flowStep={activeStep}
                session={session}
                runtime={runtime}
                onOpenProjects={onOpenProjects}
              />
              <RuntimeMessage message={runtime.message} />
            </div>

            <footer className="px-onboarding-flow-footer">
              <Button variant="ghost" disabled={atStart} onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}>
                Back
              </Button>
              <div className="px-lbl">{activeIndex + 1} / {flowSteps.length}</div>
              {atEnd ? (
                <Button onClick={onContinue}>Enter Plexus</Button>
              ) : (
                <Button onClick={() => setActiveIndex((current) => Math.min(flowSteps.length - 1, current + 1))}>
                  Next Step
                </Button>
              )}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
