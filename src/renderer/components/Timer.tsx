import React, { useState, useEffect, useCallback } from 'react';
import type { Project, TimeEntry, TimerState } from '../../shared/types';
import { PageHeader, Button, Select, Input, SectionLabel, EmptyState, Crosshairs, fmtHMS } from './ui';
import { IconPlay, IconStop, IconClock } from './Icons';
import AgentActivityHub from './AgentActivityHub';
import type { Session } from '../../shared/types';

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
  const [timerAction, setTimerAction] = useState<'start' | 'stop' | null>(null);

  const loadRecent = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const list = await window.plexus.entryList(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
    setRecentEntries(list.slice(0, 12));
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  useEffect(() => {
    if (!timerState.running || !timerState.startTime) { setElapsed(0); return; }
    const start = new Date(timerState.startTime).getTime();
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [timerState]);

  const handleStart = async () => {
    if (!selectedProject || timerAction) return;
    setTimerAction('start');
    try {
      await window.plexus.timerStart(selectedProject, description || 'Untitled');
      await onTimerStateChange();
      onEntriesChange();
      loadRecent();
    } finally {
      setTimerAction(null);
    }
  };
  const handleStop = async () => {
    if (timerAction) return;
    setTimerAction('stop');
    try {
      await window.plexus.timerStop();
      await onTimerStateChange();
      onEntriesChange();
      loadRecent();
      setDescription('');
    } finally {
      setTimerAction(null);
    }
  };

  const projectColor = (id: string) => projects.find(p => p.id === id)?.color || 'var(--t3)';
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || 'Unknown';

  const hms = fmtHMS(elapsed);
  const running = timerState.running;
  const todaySecs = recentEntries.reduce((s, e) => s + e.durationSeconds, 0) + (running ? elapsed : 0);
  const projectCount = new Set(recentEntries.map(e => e.projectId)).size;

  return (
    <div className="px-fadein">
      <PageHeader title="Timer" sub={running ? 'session active' : 'standby'} right={<div className="px-lbl">⌘⇧P toggle</div>} />

      {/* hero — clock + controls | live plexus canvas */}
      <div className="px-panel raised px-timer-layout">
        <Crosshairs />
        <div className="px-timer-control">
          <SectionLabel>{running ? 'elapsed · live' : 'elapsed'}</SectionLabel>
          <div className={`px-timer-big${running ? '' : ' idle'}`} style={{ margin: '14px 0 26px' }}>
            {running
              ? <>{hms.slice(0, 3)}<span className="on">{hms.slice(3, 5)}</span>{hms.slice(5)}</>
              : hms}
          </div>

          <div className="px-timer-fields">
            <Select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} disabled={running || timerAction !== null}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <div className="px-timer-entry-row">
              <Input
                type="text" placeholder="What are you working on?" value={description}
                onChange={e => setDescription(e.target.value)} disabled={running || timerAction !== null} style={{ flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter' && !running) handleStart(); }}
              />
              {running
                ? <Button variant="stop" onClick={handleStop} disabled={timerAction !== null}><IconStop /> {timerAction === 'stop' ? 'Stopping' : 'Stop'}</Button>
                : <Button onClick={handleStart} disabled={!selectedProject || timerAction !== null}><IconPlay /> {timerAction === 'start' ? 'Starting' : 'Start'}</Button>}
            </div>
          </div>
        </div>

        {/* activity hub */}
        <div className="px-viz" style={{ position: 'relative' }}>
          <AgentActivityHub
            running={running}
            projectName={timerState.projectId ? projectName(timerState.projectId) : null}
            description={timerState.description}
            elapsedSeconds={elapsed}
            todaySeconds={todaySecs}
            recentEntries={recentEntries}
            projectCount={projectCount}
            session={session}
          />
        </div>
      </div>

      {/* telemetry spec boxes */}
      <div className="px-specs px-specs-four">
        <div className="px-spec acc"><span className="l">active session</span><span className="v">{running ? hms : '--:--:--'}</span><span className="hint">live timer duration</span></div>
        <div className="px-spec"><span className="l">tracked today</span><span className="v">{fmtHMS(todaySecs)}</span><span className="hint">completed plus active</span></div>
        <div className="px-spec"><span className="l">completed entries</span><span className="v">{recentEntries.length}</span><span className="hint">today's saved sessions</span></div>
        <div className="px-spec"><span className="l">projects touched</span><span className="v">{projectCount}</span><span className="hint">distinct project signals</span></div>
      </div>

      {/* today's entries — numbered */}
      <div style={{ marginTop: 28 }}>
        <SectionLabel style={{ marginBottom: 6 }}>today’s entries</SectionLabel>
        {recentEntries.length === 0 ? (
          <EmptyState icon={<IconClock s={26} />}>
            No entries yet today — press <span className="k">⌘⇧P</span> to start the clock.
          </EmptyState>
        ) : (
          <div className="px-rows">
            {recentEntries.map((e, i) => (
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
