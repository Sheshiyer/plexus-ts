import React, { useState, useEffect, useCallback } from 'react';
import type { AssistantContextScope, AssistantRouteKey, Project, TimeEntry, TimerState, TodayActionTone, TodaySnapshot } from '../../shared/types';
import { PageHeader, Button, Select, Input, SectionLabel, Crosshairs, fmtHMS, localDateString } from './ui';
import { IconPlay, IconStop, IconClock, IconPause, IconBridge } from './Icons';
import AgentActivityHub from './AgentActivityHub';
import AgentSessionFocusRail from './AgentSessionFocusRail';
import type { Session } from '../../shared/types';
import { hasVerifiedGitHubRepository } from '../../shared/github-repository-authority';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  type PlexusTone,
  StatusChip,
} from './PlexusUI';

interface Props {
  projects: Project[];
  timerState: TimerState;
  todaySnapshot?: TodaySnapshot | null;
  session: Session | null;
  onProjectsChange: () => void;
  onEntriesChange: () => void;
  onTimerStateChange: () => void;
  onOpenAgentSessions?: () => void;
  onOpenProjects?: () => void;
}

function openAssistantIntent(input: {
  sourceRoute: 'today' | 'focus';
  message: string;
  contextScopes: AssistantContextScope[];
  metadata?: Record<string, unknown>;
}) {
  const detail = {
    routeKey: 'assistant',
    createdAt: new Date().toISOString(),
    ...input,
  };
  try {
    window.sessionStorage.setItem('plexus:assistant-launch-intent', JSON.stringify(detail));
  } catch {
    // Ignore storage failures; the navigation event still carries the intent.
  }
  window.dispatchEvent(new CustomEvent('plexus:assistant-navigate', { detail }));
}

function actionTone(tone: TodayActionTone): PlexusTone {
  return tone;
}

function proofTone(snapshot: TodaySnapshot): PlexusTone {
  if (snapshot.proof.risk === 'clear') return 'accent';
  if (snapshot.proof.risk === 'sync_attention') return 'error';
  return 'warning';
}

function proofLabel(snapshot: TodaySnapshot): string {
  if (snapshot.proof.risk === 'clear') return 'clear';
  if (snapshot.proof.risk === 'needs_project') return 'project needed';
  if (snapshot.proof.risk === 'sync_attention') return 'sync attention';
  return 'proof needed';
}

function proofReadiness(snapshot: TodaySnapshot): {
  label: string;
  title: string;
  message: string;
  tone: PlexusTone;
  routeKey: AssistantRouteKey;
} {
  if (snapshot.sourceHealth.fabricTasks.state === 'unavailable') {
    return {
      label: 'bridge degraded',
      title: 'Bridge assignments need a refresh',
      message: snapshot.sourceHealth.fabricTasks.message ?? 'Fabric tasks are unavailable, so assignment readiness may be stale.',
      tone: 'warning',
      routeKey: 'bridge',
    };
  }
  if (snapshot.proof.risk === 'sync_attention') {
    return {
      label: 'sync attention',
      title: 'Proof sync needs review',
      message: `${snapshot.proof.syncFailedEntries} work record${snapshot.proof.syncFailedEntries === 1 ? '' : 's'} reported sync failure.`,
      tone: 'error',
      routeKey: 'entries',
    };
  }
  if (snapshot.proof.risk === 'needs_project') {
    return {
      label: 'project proof needed',
      title: 'Link a verified project before starting',
      message: `${snapshot.proof.unverifiedProjectCount} project${snapshot.proof.unverifiedProjectCount === 1 ? '' : 's'} still need repo proof.`,
      tone: 'warning',
      routeKey: 'projects',
    };
  }
  if (snapshot.proof.risk === 'needs_evidence') {
    const count = snapshot.proof.missingEvidenceEntries + snapshot.proof.legacyUnverifiedEntries;
    return {
      label: 'evidence needed',
      title: 'Today has proof gaps',
      message: `${count} work record${count === 1 ? '' : 's'} need evidence before the day is founder-ready.`,
      tone: 'warning',
      routeKey: 'entries',
    };
  }
  if (snapshot.standup.state === 'needed') {
    return {
      label: 'daily proof needed',
      title: 'Generate today\'s standup proof',
      message: 'Tracked work is evidenced, but persisted standup proof must be generated before founder delivery.',
      tone: 'warning',
      routeKey: 'assistant',
    };
  }
  return {
    label: 'proof ready',
    title: 'Today is founder-ready',
    message: `${snapshot.proof.evidencedEntries} evidenced work record${snapshot.proof.evidencedEntries === 1 ? '' : 's'} are ready for review.`,
    tone: 'accent',
    routeKey: 'reports',
  };
}

function sourceHealthTone(state: TodaySnapshot['sourceHealth'][keyof TodaySnapshot['sourceHealth']]['state']): PlexusTone {
  return state === 'ready' ? 'accent' : 'warning';
}

function projectName(snapshot: TodaySnapshot, projectId: string): string {
  return snapshot.projects.find((project) => project.id === projectId)?.name ?? `Project ${projectId.slice(0, 8)}`;
}

function entryEvidenceTone(entry: TimeEntry): PlexusTone {
  if (entry.evidenceStatus === 'matched') return 'accent';
  if (entry.evidenceStatus === 'sync_failed') return 'error';
  if (entry.evidenceStatus === 'missing' || entry.evidenceStatus === 'legacy_unverified') return 'warning';
  return 'idle';
}

function navigateToRoute(routeKey: AssistantRouteKey) {
  window.dispatchEvent(new CustomEvent('plexus:assistant-navigate', { detail: { routeKey } }));
}

function prepareStandupWithAssistant(snapshot: TodaySnapshot) {
  openAssistantIntent({
    sourceRoute: 'today',
    contextScopes: ['today', 'week', 'project', 'task', 'session_group', 'infra', 'app'],
    message: `Generate persisted standup evidence for ${snapshot.date} from today's proof ledger and local session context before preparing any founder update.`,
    metadata: {
      date: snapshot.date,
      proofStatus: snapshot.proof.status,
      proofRisk: snapshot.proof.risk,
      standupState: snapshot.standup.state,
      totalSeconds: snapshot.totals.trackedSeconds + snapshot.totals.activeSeconds,
      suggestedToolId: 'app.generateStandup',
      suggestedAction: 'prepare-daily-proof',
    },
  });
}

function TodaySnapshotPanel({ snapshot }: { snapshot: TodaySnapshot }) {
  const unavailableSources = Object.values(snapshot.sourceHealth).filter((source) => source.state === 'unavailable').length;
  const trackedToday = snapshot.totals.trackedSeconds + snapshot.totals.activeSeconds;
  const readiness = proofReadiness(snapshot);
  const standupTone: PlexusTone = snapshot.standup.state === 'ready'
    ? 'accent'
    : snapshot.standup.state === 'needed'
      ? 'warning'
      : 'idle';
  const assistantTone: PlexusTone = snapshot.assistant.availability === 'ready'
    ? 'accent'
    : snapshot.assistant.availability === 'needs_model_key'
      ? 'warning'
      : 'idle';
  const openReadinessAction = () => {
    if (readiness.routeKey === 'assistant' && snapshot.standup.state === 'needed') {
      prepareStandupWithAssistant(snapshot);
      return;
    }
    navigateToRoute(readiness.routeKey);
  };
  const openTodayAction = (action: TodaySnapshot['nextActions'][number]) => {
    if (action.id === 'prepare-daily-proof') {
      prepareStandupWithAssistant(snapshot);
      return;
    }
    if (action.routeKey) navigateToRoute(action.routeKey);
  };

  return (
    <InstrumentPanel
      label="today command"
      title="Daily command center"
      note="Timer, assignments, proof, standup, and Clio readiness in one local snapshot."
      actions={<StatusChip tone={unavailableSources ? 'warning' : 'accent'}>{unavailableSources ? `${unavailableSources} degraded` : 'ready'}</StatusChip>}
      className="px-today-command-panel"
      trace
    >
      <div className={`px-today-proof-banner tone-${readiness.tone}`}>
        <div>
          <StatusChip tone={readiness.tone}>{readiness.label}</StatusChip>
          <strong>{readiness.title}</strong>
          <span>{readiness.message}</span>
        </div>
        <Button variant="ghost" onClick={openReadinessAction}>
          {readiness.routeKey === 'assistant' && snapshot.standup.state === 'needed' ? 'Prepare' : 'Open'}
        </Button>
      </div>

      <div className="px-today-hero-grid" aria-label="Today hero command panel">
        <div className="px-today-hero-card primary">
          <span className="px-lbl">tracked today</span>
          <strong>{fmtHMS(trackedToday)}</strong>
          <small>{snapshot.totals.entryCount} record{snapshot.totals.entryCount === 1 ? '' : 's'} · {snapshot.totals.projectCount} project{snapshot.totals.projectCount === 1 ? '' : 's'}</small>
        </div>
        <div className="px-today-hero-card">
          <span className="px-lbl">bridge assignment</span>
          <strong>{snapshot.assignments.current?.title ?? 'No active assignment'}</strong>
          <small>{snapshot.assignments.current ? `${snapshot.assignments.current.source} · ${snapshot.assignments.current.status}` : 'Bridge queue clear'}</small>
          <Button variant="ghost" onClick={() => navigateToRoute('bridge')}>Bridge</Button>
        </div>
        <div className="px-today-hero-card">
          <span className="px-lbl">co-working room</span>
          <strong>{snapshot.rooms.current?.name ?? 'No active room'}</strong>
          <small>{snapshot.rooms.current ? `${snapshot.rooms.current.observedState.replace('_', ' ')} · ${snapshot.rooms.current.participantCount} present` : 'Open Co-working to join'}</small>
          <Button variant="ghost" onClick={() => navigateToRoute('realtime')}>Room</Button>
        </div>
        <div className="px-today-hero-card">
          <span className="px-lbl">Clio runtime</span>
          <strong>{snapshot.assistant.availability}</strong>
          <small>{snapshot.assistant.selectedModelId ?? snapshot.assistant.modelProvider ?? snapshot.assistant.state}</small>
          <Button variant="ghost" onClick={() => navigateToRoute('assistant')}>Clio</Button>
        </div>
      </div>

      <MetricRailGroup>
        <MetricRail label="proof" value={proofLabel(snapshot)} tone={proofTone(snapshot)} hint={snapshot.proof.status} />
        <MetricRail label="tracked today" value={fmtHMS(trackedToday)} tone={trackedToday ? 'accent' : 'idle'} hint={`${snapshot.totals.entryCount} record${snapshot.totals.entryCount === 1 ? '' : 's'}`} />
        <MetricRail label="assignments" value={snapshot.totals.activeTaskCount} tone={snapshot.totals.activeTaskCount ? 'mint' : 'idle'} hint="active Fabric tasks" />
        <MetricRail label="daily proof" value={snapshot.standup.state} tone={standupTone} hint={snapshot.standup.todaySeconds === null ? 'KPI unavailable' : fmtHMS(snapshot.standup.todaySeconds)} />
        <MetricRail label="Clio" value={snapshot.assistant.availability} tone={assistantTone} hint="assistant runtime" />
      </MetricRailGroup>

      <div className="px-today-section-grid">
        <section className="px-today-proof-ledger" aria-label="Today proof ledger">
          <div className="px-today-section-head">
            <SectionLabel>today proof ledger</SectionLabel>
            <StatusChip tone={proofTone(snapshot)}>{snapshot.proof.status}</StatusChip>
          </div>
          <Ledger>
            <LedgerRail
              index="EVD"
              title="Evidence coverage"
              meta={`${snapshot.proof.evidencedEntries} evidenced · ${snapshot.proof.missingEvidenceEntries} missing · ${snapshot.proof.legacyUnverifiedEntries} legacy`}
              status={snapshot.proof.risk}
              statusTone={proofTone(snapshot)}
              value={fmtHMS(snapshot.proof.summary.evidencedSeconds)}
              wrapTitle
            />
            <LedgerRail
              index="PRJ"
              title="Project proof"
              meta={`${snapshot.proof.verifiedProjectCount} verified · ${snapshot.proof.unverifiedProjectCount} needs setup`}
              status={snapshot.proof.unverifiedProjectCount ? 'review' : 'ready'}
              statusTone={snapshot.proof.unverifiedProjectCount ? 'warning' : 'accent'}
              action={snapshot.proof.unverifiedProjectCount ? <Button variant="ghost" onClick={() => navigateToRoute('projects')}>Open</Button> : undefined}
              wrapTitle
            />
            <LedgerRail
              index="STP"
              title="Daily proof packet"
              meta={snapshot.standup.todaySeconds === null ? 'Worker hours mirror unavailable' : `${fmtHMS(snapshot.standup.todaySeconds)} tracked for standup`}
              status={snapshot.standup.state}
              statusTone={standupTone}
              action={snapshot.standup.state !== 'ready' ? <Button variant="ghost" onClick={() => prepareStandupWithAssistant(snapshot)}>Prepare</Button> : undefined}
              wrapTitle
            />
            {Object.entries(snapshot.sourceHealth).map(([key, source], index) => (
              <LedgerRail
                key={key}
                index={`S${index + 1}`}
                title={`${key.replace(/([A-Z])/g, ' $1')} source`}
                meta={source.message ?? `checked ${new Date(source.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                status={source.state}
                statusTone={sourceHealthTone(source.state)}
                wrapTitle
              />
            ))}
            {snapshot.entries.slice(0, 4).map((entry, index) => (
              <LedgerRail
                key={entry.id}
                index={`W${index + 1}`}
                title={entry.description}
                meta={`${projectName(snapshot, entry.projectId)} · ${entry.evidenceStatus ?? 'pending'} evidence`}
                status={entry.evidenceStatus ?? 'pending'}
                statusTone={entryEvidenceTone(entry)}
                value={fmtHMS(entry.durationSeconds)}
                action={<Button variant="ghost" onClick={() => navigateToRoute('entries')}>Open</Button>}
                wrapTitle
              />
            ))}
          </Ledger>
        </section>

        <section className="px-today-suggestion-rail" aria-label="Clio suggestion rail">
          <div className="px-today-section-head">
            <SectionLabel>Clio suggestion rail</SectionLabel>
            <StatusChip tone={snapshot.suggestions.length ? 'mint' : 'idle'}>{snapshot.suggestions.length} suggestions</StatusChip>
          </div>
          {snapshot.suggestions.length === 0 ? (
            <EmptyStatePanel
              title="No Clio suggestions queued"
              message="Today has no assistant or Temperance recommendations waiting."
            />
          ) : (
            <Ledger>
              {snapshot.suggestions.slice(0, 4).map((suggestion, index) => (
                <LedgerRail
                  key={suggestion.id}
                  index={suggestion.source === 'temperance' ? 'TMP' : `C${index + 1}`}
                  title={suggestion.title}
                  meta={suggestion.skillHint ? `${suggestion.skillHint} · ${suggestion.detail}` : suggestion.detail}
                  status={`${Math.round(suggestion.confidence * 100)}% · ${suggestion.safety}`}
                  statusTone={suggestion.source === 'temperance' ? 'mint' : 'idle'}
                  action={suggestion.routeKey && (
                    <Button variant="ghost" onClick={() => navigateToRoute(suggestion.routeKey!)}>
                      Open
                    </Button>
                  )}
                  wrapTitle
                />
              ))}
            </Ledger>
          )}
        </section>
      </div>

      <div style={{ marginTop: 14 }}>
        {snapshot.nextActions.length === 0 ? (
          <EmptyStatePanel
            title="Today is clear"
            message="No immediate proof, project, assignment, or standup action is queued."
          />
        ) : (
          <Ledger>
            {snapshot.nextActions.map((action, index) => (
              <LedgerRail
                key={action.id}
                index={String(index + 1).padStart(2, '0')}
                title={action.title}
                meta={action.detail}
                status={action.tone}
                statusTone={actionTone(action.tone)}
                action={action.routeKey && (
                  <Button variant="ghost" onClick={() => openTodayAction(action)}>
                    {action.id === 'prepare-daily-proof' ? 'Prepare' : 'Open'}
                  </Button>
                )}
                wrapTitle
              />
            ))}
          </Ledger>
        )}
      </div>
    </InstrumentPanel>
  );
}

export default function Timer({ projects, timerState, todaySnapshot, session, onEntriesChange, onTimerStateChange, onOpenAgentSessions, onOpenProjects }: Props) {
  const [selectedProject, setSelectedProject] = useState('');
  const [description, setDescription] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [targetMinutes, setTargetMinutes] = useState('120');
  const [timerAction, setTimerAction] = useState<'start' | 'stop' | 'pause' | 'resume' | null>(null);
  const [timerError, setTimerError] = useState('');

  const loadRecent = useCallback(async () => {
    const today = localDateString();
    const list = await window.plexus.entryList(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
    setRecentEntries(list.slice(0, 12));
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  useEffect(() => {
    if (!timerState.running || !timerState.startTime) {
      setElapsed(0);
      return;
    }

    const baseElapsed = timerState.activeSeconds
      ?? Math.max(0, Math.floor((Date.now() - new Date(timerState.startTime).getTime()) / 1000) - (timerState.pausedSeconds ?? 0));
    setElapsed(baseElapsed);

    if (timerState.paused) return;

    const localStart = Date.now();
    const iv = setInterval(() => {
      setElapsed(baseElapsed + Math.floor((Date.now() - localStart) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [timerState.activeSeconds, timerState.entryId, timerState.paused, timerState.pausedSeconds, timerState.running, timerState.startTime]);

  const handleStart = async () => {
    if (!selectedProject || timerAction) return;
    const project = projects.find(p => p.id === selectedProject);
    if (!repoReady(project)) {
      setTimerError('Select a project with a verified GitHub repo before starting today\'s work session.');
      return;
    }
    setTimerAction('start');
    setTimerError('');
    try {
      const targetSeconds = Number(targetMinutes) > 0 ? Number(targetMinutes) * 60 : undefined;
      const savedDescription = description.trim() || `Work session for ${projectName(selectedProject)}`;
      await window.plexus.timerStart(selectedProject, savedDescription, targetSeconds);
      await onTimerStateChange();
      onEntriesChange();
      loadRecent();
    } catch (err: any) {
      setTimerError(err?.message ?? String(err));
    } finally {
      setTimerAction(null);
    }
  };
  const handleStop = async () => {
    if (timerAction) return;
    setTimerAction('stop');
    setTimerError('');
    try {
      await window.plexus.timerStop();
      await onTimerStateChange();
      onEntriesChange();
      loadRecent();
      setDescription('');
    } catch (err: any) {
      setTimerError(err?.message ?? String(err));
    } finally {
      setTimerAction(null);
    }
  };

  const handlePause = async () => {
    if (timerAction || !timerState.running || timerState.paused) return;
    setTimerAction('pause');
    setTimerError('');
    try {
      await window.plexus.timerPause();
      await onTimerStateChange();
    } catch (err: any) {
      setTimerError(err?.message ?? String(err));
    } finally {
      setTimerAction(null);
    }
  };

  const handleResume = async () => {
    if (timerAction || !timerState.running || !timerState.paused) return;
    setTimerAction('resume');
    setTimerError('');
    try {
      await window.plexus.timerResume();
      await onTimerStateChange();
    } catch (err: any) {
      setTimerError(err?.message ?? String(err));
    } finally {
      setTimerAction(null);
    }
  };

  const projectColor = (id: string) => projects.find(p => p.id === id)?.color || 'var(--t3)';
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || `Project ${id.slice(0, 8)}`;
  const repoReady = (project: Project | undefined) => hasVerifiedGitHubRepository(project);

  const hms = fmtHMS(elapsed);
  const running = timerState.running;
  const completedEntries = recentEntries.filter((entry) => entry.endTime);
  const activeProject = timerState.projectId ? projectName(timerState.projectId) : null;
  const targetSeconds = timerState.targetSeconds;
  const progressPercent = targetSeconds ? Math.min(100, Math.round((elapsed / targetSeconds) * 100)) : undefined;
  const targetLabel = targetSeconds ? fmtHMS(targetSeconds) : 'no target';
  const todaySecs = completedEntries.reduce((s, e) => s + e.durationSeconds, 0) + (running ? elapsed : 0);
  const touchedProjects = new Set([
    ...completedEntries.map(e => e.projectId),
    ...(running && timerState.projectId ? [timerState.projectId] : []),
  ]);
  const projectCount = touchedProjects.size;
  const selectedProjectRecord = projects.find(p => p.id === selectedProject);
  const selectedProjectNeedsRepo = Boolean(selectedProject && !repoReady(selectedProjectRecord));
  const verifiedProjectCount = projects.filter(repoReady).length;
  const runningProject = timerState.projectId ? projects.find(p => p.id === timerState.projectId) : undefined;
  const reviewTodayWithAssistant = () => openAssistantIntent({
    sourceRoute: 'today',
    contextScopes: ['today', 'project', 'task', 'session_group', 'app'],
    message: running
      ? `Review today's work context, including the active ${activeProject ?? 'work'} session and recent entries.`
      : 'Review today\'s work context, recent entries, and what I should do next.',
    metadata: {
      running,
      projectId: (timerState.projectId ?? selectedProject) || null,
      activeProject,
      elapsedSeconds: elapsed,
      todaySeconds: todaySecs,
    },
  });

  return (
    <div className="px-fadein">
      <PageHeader
        title="Clio Today"
        sub={running ? (timerState.paused ? 'daily session paused' : 'daily session active') : 'verified daily command center'}
        right={(
          <CommandDock>
            <Button variant="ghost" onClick={reviewTodayWithAssistant}>
              <IconBridge s={13} /> Review today's context
            </Button>
            <div className="px-lbl">⌘⇧P toggle</div>
          </CommandDock>
        )}
      />

      {timerError && (
        <DegradedStatePanel
          title="Today action failed"
          message={timerError}
          tone="error"
        />
      )}

      {!running && verifiedProjectCount === 0 && (
        <DegradedStatePanel
          title="GitHub repo required"
          message="No project in the local cache has a verified GitHub repo yet. Open Projects, add a repo URL, and verify it before creating work records."
          tone="warning"
        />
      )}

      {!running && selectedProjectNeedsRepo && (
        <DegradedStatePanel
          title="Project needs GitHub proof"
          message={`${selectedProjectRecord?.name ?? 'This project'} is not verified yet, so Plexus will not create a local-only work record.`}
          tone="warning"
        />
      )}

      {/* today dock + controls | activity hub */}
      <div className={`px-panel raised px-timer-layout${running ? ' active-docked' : ''}`}>
        <Crosshairs />
        <div className="px-timer-control">
          {running ? (
            <div className="px-timer-dock">
              <div className="px-timer-dock-head">
                <div>
                  <SectionLabel>{timerState.paused ? 'paused today' : 'active today'}</SectionLabel>
                  <div className="px-timer-compact-time">{hms}</div>
                </div>
                <StatusChip tone={timerState.paused ? 'idle' : 'accent'}>{timerState.paused ? 'paused' : 'live'}</StatusChip>
              </div>

              <div className="px-session-context">
                <span className="px-swatch" style={{ background: timerState.projectId ? projectColor(timerState.projectId) : 'var(--t3)' }} />
                <div>
                  <strong>{activeProject ?? 'Project no longer in local cache'}</strong>
                  <span>{runningProject?.githubRepoFullName ?? 'GitHub repo proof pending'} · {timerState.description || 'No Today note saved'}</span>
                </div>
              </div>

              <div className="px-session-progress" aria-label="Session target progress">
                <span style={{ width: `${progressPercent ?? 0}%` }} />
              </div>
              <div className="px-session-meta">
                <span>target {targetLabel}</span>
                <span>{typeof progressPercent === 'number' ? `${progressPercent}% complete` : 'open session'}</span>
              </div>

              <div className="px-session-actions">
                {timerState.paused ? (
                  <Button onClick={handleResume} disabled={timerAction !== null}>
                    <IconPlay /> {timerAction === 'resume' ? 'Resuming' : 'Resume'}
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={handlePause} disabled={timerAction !== null}>
                    <IconPause /> {timerAction === 'pause' ? 'Pausing' : 'Pause'}
                  </Button>
                )}
                <Button variant="stop" onClick={handleStop} disabled={timerAction !== null}>
                  <IconStop /> {timerAction === 'stop' ? 'Stopping' : 'Stop'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <SectionLabel>today timer</SectionLabel>
              <div className="px-timer-big idle" style={{ margin: '14px 0 26px' }}>
                {hms}
              </div>

              <div className="px-timer-fields">
                <div className="px-target-grid">
                  <Select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} disabled={timerAction !== null}>
                    <option value="">Select project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id} disabled={!repoReady(p)}>
                        {p.name}{repoReady(p) ? ` · ${p.githubRepoFullName}` : ' · GitHub repo required'}
                      </option>
                    ))}
                  </Select>
                  <Select value={targetMinutes} onChange={e => setTargetMinutes(e.target.value)} disabled={timerAction !== null}>
                    <option value="">Open session</option>
                    <option value="25">25 min Today</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="240">4 hours</option>
                  </Select>
                </div>
                <div className="px-timer-entry-row">
                  <Input
                    type="text" value={description}
                    onChange={e => setDescription(e.target.value)} disabled={timerAction !== null} style={{ flex: 1 }}
                    aria-label="Today note for this work session"
                    title="Optional Today note. If empty, Plexus saves a project-based session label."
                    onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
                  />
                  <Button onClick={handleStart} disabled={!selectedProject || selectedProjectNeedsRepo || timerAction !== null}>
                    <IconPlay /> {timerAction === 'start' ? 'Starting' : 'Start'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* activity hub */}
        <div className="px-viz" style={{ position: 'relative' }}>
          <AgentActivityHub
            running={running}
            paused={timerState.paused}
            projectName={activeProject}
            description={timerState.description}
            elapsedSeconds={elapsed}
            progressPercent={progressPercent}
            todaySeconds={todaySecs}
            recentEntries={completedEntries}
            projectCount={projectCount}
            session={session}
          />
        </div>
      </div>

      {todaySnapshot && <TodaySnapshotPanel snapshot={todaySnapshot} />}

      {/* telemetry spec boxes */}
      <MetricRailGroup>
        <MetricRail label="active session" value={running ? hms : '--:--:--'} tone={running ? 'accent' : 'idle'} hint={timerState.paused ? 'paused duration' : 'live work duration'} />
        <MetricRail label="tracked today" value={fmtHMS(todaySecs)} tone={todaySecs ? 'accent' : 'idle'} hint="completed plus active" />
        <MetricRail label="completed entries" value={completedEntries.length} tone={completedEntries.length ? 'mint' : 'idle'} hint="today's saved sessions" />
        <MetricRail label="projects touched" value={projectCount} tone={projectCount ? 'mint' : 'idle'} hint="distinct project signals" />
      </MetricRailGroup>

      <AgentSessionFocusRail
        projects={projects}
        onEntriesChange={async () => {
          onEntriesChange();
          await loadRecent();
        }}
        onOpenQueue={onOpenAgentSessions}
        onOpenProjects={onOpenProjects}
        onOpenAssistant={(intent) => openAssistantIntent({
          sourceRoute: 'today',
          contextScopes: intent.contextScopes,
          message: intent.message,
          metadata: intent.metadata,
        })}
      />

      {/* today's entries — numbered */}
      <InstrumentPanel
        label="today's work records"
        title="Daily work ledger"
        note="Completed entries from today's repo-backed work sessions."
      >
        {completedEntries.length === 0 ? (
          <EmptyStatePanel
            icon={<IconClock s={26} />}
            title="No entries yet today"
            message="Use the Today timer to start the clock once a verified project is selected."
          />
        ) : (
          <Ledger>
            {completedEntries.map((e, i) => (
              <LedgerRail
                key={e.id}
                index={String(i + 1).padStart(2, '0')}
                marker={<span className="px-swatch" style={{ background: projectColor(e.projectId) }} />}
                title={e.description}
                meta={projectName(e.projectId)}
                value={fmtHMS(e.durationSeconds)}
              />
            ))}
          </Ledger>
        )}
      </InstrumentPanel>
    </div>
  );
}
