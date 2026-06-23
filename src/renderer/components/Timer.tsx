import React, { useState, useEffect, useCallback } from 'react';
import type { Project, TimeEntry, TimerState } from '../../shared/types';
import { PageHeader, Button, Select, Input, SectionLabel, EmptyState, Crosshairs, Badge, fmtHMS, localDateString } from './ui';
import { IconPlay, IconStop, IconClock, IconPause } from './Icons';
import AgentActivityHub from './AgentActivityHub';
import type { Session } from '../../shared/types';
import { ResilienceNotice } from '../lib/resilience';

interface Props {
  projects: Project[];
  timerState: TimerState;
  session: Session | null;
  onProjectsChange: () => void;
  onEntriesChange: () => void;
  onTimerStateChange: () => void;
}

export default function Timer({ projects, timerState, session, onEntriesChange, onTimerStateChange }: Props) {
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
      setTimerError('Select a project with a verified GitHub repo before starting a focus session.');
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
  const repoReady = (project: Project | undefined) => Boolean(project?.githubRepoUrl && project?.githubRepoFullName && project?.repoVerifiedAt && project?.repoEvidenceStatus !== 'inaccessible');

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

  return (
    <div className="px-fadein">
      <PageHeader
        title="Focus Session"
        sub={running ? (timerState.paused ? 'session paused' : 'session active') : 'verified work capture'}
        right={<div className="px-lbl">⌘⇧P toggle</div>}
      />

      {timerError && (
        <ResilienceNotice
          title="Focus action failed"
          message={timerError}
        />
      )}

      {!running && verifiedProjectCount === 0 && (
        <ResilienceNotice
          title="GitHub repo required"
          message="No project in the local cache has a verified GitHub repo yet. Open Projects, add a repo URL, and verify it before creating work records."
        />
      )}

      {!running && selectedProjectNeedsRepo && (
        <ResilienceNotice
          title="Project needs GitHub proof"
          message={`${selectedProjectRecord?.name ?? 'This project'} is not verified yet, so Plexus will not create a local-only work record.`}
        />
      )}

      {/* focus dock + controls | activity hub */}
      <div className={`px-panel raised px-timer-layout${running ? ' active-docked' : ''}`}>
        <Crosshairs />
        <div className="px-timer-control">
          {running ? (
            <div className="px-timer-dock">
              <div className="px-timer-dock-head">
                <div>
                  <SectionLabel>{timerState.paused ? 'paused session' : 'active session'}</SectionLabel>
                  <div className="px-timer-compact-time">{hms}</div>
                </div>
                <Badge tone={timerState.paused ? undefined : 'mint'}>{timerState.paused ? 'paused' : 'live'}</Badge>
              </div>

              <div className="px-session-context">
                <span className="px-swatch" style={{ background: timerState.projectId ? projectColor(timerState.projectId) : 'var(--t3)' }} />
                <div>
                  <strong>{activeProject ?? 'Project no longer in local cache'}</strong>
                  <span>{runningProject?.githubRepoFullName ?? 'GitHub repo proof pending'} · {timerState.description || 'No focus note saved'}</span>
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
              <SectionLabel>elapsed</SectionLabel>
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
                    <option value="25">25 min focus</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="240">4 hours</option>
                  </Select>
                </div>
                <div className="px-timer-entry-row">
                  <Input
                    type="text" value={description}
                    onChange={e => setDescription(e.target.value)} disabled={timerAction !== null} style={{ flex: 1 }}
                    aria-label="Focus note for this work session"
                    title="Optional focus note. If empty, Plexus saves a project-based session label."
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

      {/* telemetry spec boxes */}
      <div className="px-specs px-specs-four">
        <div className="px-spec acc"><span className="l">active session</span><span className="v">{running ? hms : '--:--:--'}</span><span className="hint">{timerState.paused ? 'paused duration' : 'live focus duration'}</span></div>
        <div className="px-spec"><span className="l">tracked today</span><span className="v">{fmtHMS(todaySecs)}</span><span className="hint">completed plus active</span></div>
        <div className="px-spec"><span className="l">completed entries</span><span className="v">{completedEntries.length}</span><span className="hint">today's saved sessions</span></div>
        <div className="px-spec"><span className="l">projects touched</span><span className="v">{projectCount}</span><span className="hint">distinct project signals</span></div>
      </div>

      {/* today's entries — numbered */}
      <div style={{ marginTop: 28 }}>
        <SectionLabel style={{ marginBottom: 6 }}>today’s work records</SectionLabel>
        {completedEntries.length === 0 ? (
          <EmptyState icon={<IconClock s={26} />}>
            No entries yet today — press <span className="k">⌘⇧P</span> to start the clock.
          </EmptyState>
        ) : (
          <div className="px-rows">
            {completedEntries.map((e, i) => (
              <div key={e.id} className="px-row" style={{ gridTemplateColumns: '26px 11px 1fr auto' }}>
                <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                <span className="px-swatch" style={{ background: projectColor(e.projectId) }} />
                <div style={{ minWidth: 0 }}>
                  <div className="desc">{e.description}</div>
                  <div className="meta">{projectName(e.projectId)}</div>
                </div>
                <span className="dur">{fmtHMS(e.durationSeconds)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
