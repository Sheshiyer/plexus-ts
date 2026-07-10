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
import BackgroundVideo from './splash/BackgroundVideo';

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

export interface DailyAgentReadinessInput {
  assistantEnabled: boolean;
  bridgeConnected: boolean;
  bridgeError?: string;
  workerConnected: boolean;
  queueReady: boolean;
}

export interface DailyAgentReadinessResult {
  ok: boolean;
  message?: string;
}

export function evaluateDailyAgentReadiness(input: DailyAgentReadinessInput): DailyAgentReadinessResult {
  if (!input.assistantEnabled) {
    return { ok: false, message: 'Assistant is disabled. Enable Assistant in Settings, then retry.' };
  }
  if (input.bridgeConnected) return { ok: true };

  const bridgeError = input.bridgeError?.trim();
  const fallbackDetail = input.workerConnected || input.queueReady
    ? ' Worker delivery and the local queue provide degraded fallback durability only.'
    : '';
  return {
    ok: false,
    message: `Thoughtseed member bridge is not connected.${bridgeError ? ` ${bridgeError}` : ''} Connect the member bridge in Settings before completing daily update readiness.${fallbackDetail}`,
  };
}

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

function displayNameForStep(step: OnboardingStepState): string {
  if (step.stepId === 'identity_projects') return 'Connect account';
  if (step.stepId === 'preferences') return 'Set preferences';
  if (step.stepId === 'paperclip') return 'Optional helpers';
  if (step.stepId === 'daily_agent') return 'Daily agent readiness';
  return step.label;
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
      eyebrow: 'Connect account',
      title: 'Connect your account to assigned projects.',
      body: 'Plexus checks that your workspace can open the projects you use for work proof.',
    };
  }
  if (step.stepId === 'preferences') {
    return {
      eyebrow: 'Set preferences',
      title: 'Set your profile and work preferences.',
      body: 'Preferences help shape focus suggestions, standup context, and report visibility without blocking core work.',
    };
  }
  if (step.stepId === 'paperclip') {
    return {
      eyebrow: 'Check local helpers',
      title: 'Check optional local helpers.',
      body: 'Local helpers can support handoffs and work summaries. If they are not ready yet, you can retry later.',
    };
  }
  if (step.stepId === 'daily_agent') {
    return {
      eyebrow: 'Assistant readiness',
      title: 'Connect daily updates through Assistant.',
      body: 'Daily updates are connected only when Assistant and the member-scoped Thoughtseed bridge are ready. The Worker and local queue provide degraded fallback durability after bridge failure; they do not establish connected readiness.',
    };
  }
  return {
    eyebrow: step.requirement,
    title: displayNameForStep(step),
    body: 'You can finish this now or come back when your workspace is ready.',
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
      eyebrow: 'guided setup',
      title: 'Set up your workspace one step at a time.',
      body: 'This flow checks your account, preferences, Assistant readiness, and optional helpers before you enter Plexus.',
    },
    {
      id: 'session',
      kind: 'session',
      scene: 'entry',
      eyebrow: 'Connect account',
      title: 'Confirm your account.',
      body: 'Your Thoughtseed account opens the workspace. Profile and rhythm choices stay separate from sign-in.',
    },
    ...workerSteps,
    {
      id: 'permissions',
      kind: 'permissions',
      scene: 'readiness',
      eyebrow: 'Device permissions',
      title: 'Allow device access when your work needs it.',
      body: 'Microphone, camera, speaker, and screen sharing can support co-working, and you can keep going if one is denied.',
    },
    {
      id: 'rhythm',
      kind: 'rhythm',
      scene: 'rhythm',
      eyebrow: 'Set preferences',
      title: 'Choose personal rhythm support.',
      body: 'Rhythm reminders stay optional, local, and deletable.',
    },
    {
      id: 'readiness',
      kind: 'readiness',
      scene: 'readiness',
      eyebrow: 'Review readiness',
      title: 'Review what is complete before entering the app.',
      body: 'Required items, optional skips, retry states, and privacy settings stay visible after onboarding in Settings.',
    },
  ];
}

function OnboardingSceneBackground() {
  return (
    <div className="px-onboarding-bg" aria-hidden="true">
      <BackgroundVideo className="px-onboarding-bg-video" />
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
    } catch {
      setInstallError('Could not check local helper readiness.');
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
    } catch {
      setRhythmSavedAt(null);
      setMessage('Could not save rhythm preference. Please try again.');
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
          await window.plexus.onboardingUpdate(step.stepId, 'failed', { message: ran.message ?? 'This readiness step needs attention.' });
          const refreshed = await window.plexus.authRefreshSession();
          if (refreshed.session) onSessionChange?.(refreshed.session);
          setMessage(ran.message ?? 'This readiness step needs attention.');
          return;
        }
      }
      const res = await window.plexus.onboardingUpdate(step.stepId, state);
      if (res.ok && res.session) onSessionChange?.(res.session);
      if (res.ok && res.message) setMessage('Readiness updated.');
      else if (!res.ok) setMessage('Could not update readiness. Please try again.');
    } catch {
      setMessage('Could not update readiness. Please try again.');
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
      return {
        ok: synced.ok,
        message: synced.ok ? 'Project access connected.' : 'Project connection needs attention. Open Projects, then retry.',
      };
    };
  }
  if (step.stepId === 'paperclip') {
    return async () => {
      const setup = await window.plexus.memberSetup();
      return {
        ok: setup.ok,
        message: setup.ok ? 'Local helpers are ready.' : 'Local helper setup needs attention. Please retry from Settings.',
      };
    };
  }
  if (step.stepId === 'daily_agent') {
    return async () => {
      const [assistant, bridge, worker, queueReady] = await Promise.all([
        window.plexus.assistantStatus(),
        window.plexus.thoughtseedBridgeStatus().catch((err: any) => ({ connected: false, lastError: err?.message ?? String(err) })),
        window.plexus.workerStatus().catch((err: any) => ({ connected: false, message: err?.message ?? String(err) })),
        window.plexus.handoffList().then(() => true).catch(() => false),
      ]);
      return evaluateDailyAgentReadiness({
        assistantEnabled: assistant.enabled,
        bridgeConnected: bridge.connected,
        bridgeError: bridge.lastError ?? undefined,
        workerConnected: worker.connected,
        queueReady,
      });
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
      <MetricRail label="account" value={session.email} tone="mint" hint="verified" />
      <MetricRail label="role" value={session.role} tone={session.role === 'admin' ? 'accent' : 'idle'} hint="account" />
      <MetricRail label="projects" value={session.projectVisibility} tone="mint" hint="access" />
      <MetricRail label="readiness" value={requiredOpen ? 'open' : 'done'} tone={requiredOpen ? 'warning' : 'accent'} hint="setup" />
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
    return <EmptyStatePanel title="Optional helper check is loading" message="Helper readiness appears when optional local tools respond." />;
  }
  if (installError) {
    return <DegradedStatePanel title="Optional helper check needs attention" message={installError} tone="warning" />;
  }
  if (!installStatus) return null;
  return (
    <MetricRailGroup>
      <MetricRail label="helper app" value={installStatus.binaryFound ? 'found' : 'not found'} tone={installStatus.binaryFound ? 'accent' : 'warning'} hint="optional" />
      <MetricRail label="setup" value={installStatus.configFound ? 'ready' : 'needs setup'} tone={installStatus.configFound ? 'accent' : 'warning'} hint="workspace" />
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
    return <EmptyStatePanel title="No readiness steps returned" message="The workspace did not return setup steps for this account." />;
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
                <div className="px-flow-title">{displayNameForStep(step)}</div>
                <StatusChip tone={toneFor(step.state)}>{stateText(step)}</StatusChip>
              </div>
              <div className="px-flow-meta">
                Updated {new Date(step.updatedAt).toLocaleString()}
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
        <div><span>01</span><strong>Account</strong><small>Confirm who is entering the workspace.</small></div>
        <div><span>02</span><strong>Work proof</strong><small>Connect projects to reliable work records.</small></div>
        <div><span>03</span><strong>Assistant readiness</strong><small>Prepare daily updates without depending on helpers.</small></div>
        <div><span>04</span><strong>Optional helpers</strong><small>Check enrichment tools without blocking work.</small></div>
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
            <div className="px-section-title">{displayNameForStep(flowStep.workerStep)}</div>
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
      <div><span className="px-dot" /><strong>Optional helpers</strong><small>{runtime.installStatus?.binaryFound ? 'Available' : 'Retry from Settings if needed'}</small></div>
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
            The guided setup remains available here after sign-in, along with retry actions, permissions, and private rhythm controls.
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
              <SectionLabel>workspace connection</SectionLabel>
              <div className="px-section-note">Your role, project access, and readiness state.</div>
            </div>
          </div>
          <SessionContract session={session} requiredOpen={runtime.requiredOpen} />
        </div>

        <div className="px-form-band">
          <div className="px-section-head">
            <div>
              <SectionLabel>optional helpers</SectionLabel>
              <div className="px-section-note">Optional helper readiness; issues remain retryable.</div>
            </div>
          </div>
          <PaperclipPreflight installStatus={runtime.installStatus} installError={runtime.installError} />
        </div>

        <div className="px-form-band">
          <div className="px-section-head">
            <div>
              <SectionLabel>readiness steps</SectionLabel>
              <div className="px-section-note">Required steps help work proof stay reliable; optional steps can wait.</div>
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
              <div className="px-section-note">Birthdate stays local and is not shared in preferences or reports.</div>
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

const REQUIRED_SETUP_BYPASS_PHRASE = 'ENTER WITH OPEN REQUIRED STEPS';

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
  const continueButtonLabel = runtime.requiredOpen ? 'Continue with risk' : 'Continue to app';
  const enterButtonLabel = runtime.requiredOpen ? 'Enter with risk' : 'Enter Plexus';
  const handleContinue = useCallback(() => {
    if (!onContinue) return;
    if (!runtime.requiredOpen) {
      onContinue();
      return;
    }
    const acknowledged = window.confirm(
      'Required setup is still open. Entering now can reduce work-proof reliability. Continue only if you accept this risk.',
    );
    if (!acknowledged) return;
    const phrase = window.prompt(
      `Type "${REQUIRED_SETUP_BYPASS_PHRASE}" to continue with required setup still open.`,
      '',
    );
    if (phrase !== REQUIRED_SETUP_BYPASS_PHRASE) {
      window.alert('Confirmation phrase did not match. Continue is cancelled.');
      return;
    }
    onContinue();
  }, [onContinue, runtime.requiredOpen]);

  return (
    <div className="px-onboarding-shell px-fadein" data-scene={activeStep.scene} role="dialog" aria-modal="true" aria-label="Plexus onboarding flow">
      <OnboardingSceneBackground />
      <div className="px-onboarding-flow-chrome">
        <header className="px-onboarding-flow-top">
          <div>
            <span className="px-brandmark"><span className="px-dot pulse" /><b>PLEXUS</b></span>
            <div className="px-lbl">guided setup - workspace readiness</div>
          </div>
          <div className="px-onboarding-top-actions">
            {workerConnection && onRefreshWorkerConnection && (
              <WorkerConnectionButton
                status={workerConnection}
                onRefresh={onRefreshWorkerConnection}
                className="px-hud-action"
              />
            )}
            <Button variant="ghost" onClick={handleContinue}>{continueButtonLabel}</Button>
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
                <Button onClick={handleContinue}>{enterButtonLabel}</Button>
              ) : (
                <Button onClick={() => setActiveIndex((current) => Math.min(flowSteps.length - 1, current + 1))}>
                  Next Step
                </Button>
              )}
            </footer>
            {runtime.requiredOpen && (
              <div className="px-section-note" style={{ marginTop: 12 }}>
                Required setup is still open. Finish required steps for full readiness, or continue only with explicit risk confirmation.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
