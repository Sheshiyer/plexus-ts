import React, { useState, useEffect, useCallback } from 'react';
import type { Project, TimeEntry, TimerState } from '../../shared/types';
import { PageHeader, Button, Select, Input, Badge, SectionLabel, EmptyState, Crosshairs, fmtHMS } from './ui';
import { IconPlay, IconStop, IconClock } from './Icons';
import PlexusViz from './PlexusViz';

interface Props {
  projects: Project[];
  timerState: TimerState;
  onProjectsChange: () => void;
  onEntriesChange: () => void;
}

export default function Timer({ projects, timerState, onEntriesChange }: Props) {
  const [selectedProject, setSelectedProject] = useState('');
  const [description, setDescription] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);

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
    if (!selectedProject) return;
    await window.plexus.timerStart(selectedProject, description || 'Untitled');
    onEntriesChange();
    loadRecent();
  };
  const handleStop = async () => {
    await window.plexus.timerStop();
    onEntriesChange();
    loadRecent();
    setDescription('');
  };

  const projectColor = (id: string) => projects.find(p => p.id === id)?.color || 'var(--t3)';
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || 'Unknown';

  const hms = fmtHMS(elapsed);
  const running = timerState.running;
  const todaySecs = recentEntries.reduce((s, e) => s + e.durationSeconds, 0) + (running ? elapsed : 0);
  const billSecs = recentEntries.reduce((s, e) => s + (e.billable ? e.durationSeconds : 0), 0);

  return (
    <div className="px-fadein">
      <PageHeader title="Timer" sub={running ? 'session active' : 'standby'} right={<div className="px-lbl">⌘⇧P toggle</div>} />

      {/* hero — clock + controls | live plexus canvas */}
      <div className="px-panel raised" style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', minHeight: 300, position: 'relative' }}>
        <Crosshairs />
        <div style={{ padding: '30px 32px', borderRight: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column' }}>
          <SectionLabel>{running ? 'elapsed · live' : 'elapsed'}</SectionLabel>
          <div className={`px-timer-big${running ? '' : ' idle'}`} style={{ margin: '14px 0 26px' }}>
            {running
              ? <>{hms.slice(0, 3)}<span className="on">{hms.slice(3, 5)}</span>{hms.slice(5)}</>
              : hms}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} disabled={running}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <div style={{ display: 'flex', gap: 12 }}>
              <Input
                type="text" placeholder="What are you working on?" value={description}
                onChange={e => setDescription(e.target.value)} disabled={running} style={{ flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter' && !running) handleStart(); }}
              />
              {running
                ? <Button variant="stop" onClick={handleStop}><IconStop /> Stop</Button>
                : <Button onClick={handleStart} disabled={!selectedProject}><IconPlay /> Start</Button>}
            </div>
          </div>
        </div>

        {/* live canvas */}
        <div className="px-viz" style={{ position: 'relative' }}>
          <PlexusViz />
          <div style={{ position: 'absolute', inset: 0, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
            <span className="px-badge solid" style={{ alignSelf: 'flex-start' }}>{running ? '● live' : '○ idle'}</span>
            <div className="px-lbl" style={{ textAlign: 'right', lineHeight: 1.7 }}>
              node · {recentEntries.length}<br />flux · {running ? 'active' : 'stable'}
            </div>
          </div>
        </div>
      </div>

      {/* telemetry spec boxes */}
      <div className="px-specs" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="px-spec acc"><span className="l">session</span><span className="v">{running ? hms : '—'}</span></div>
        <div className="px-spec"><span className="l">today</span><span className="v">{fmtHMS(todaySecs)}</span></div>
        <div className="px-spec"><span className="l">entries</span><span className="v">{recentEntries.length}</span></div>
        <div className="px-spec"><span className="l">billable</span><span className="v">{fmtHMS(billSecs)}</span></div>
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
              <div key={e.id} className="px-row" style={{ gridTemplateColumns: '26px 11px 1fr auto auto' }}>
                <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                <span className="px-swatch" style={{ background: projectColor(e.projectId) }} />
                <div style={{ minWidth: 0 }}>
                  <div className="desc">{e.description}</div>
                  <div className="meta">{projectName(e.projectId)}</div>
                </div>
                {e.billable ? <Badge tone="bill">billable</Badge> : <Badge>non-bill</Badge>}
                <span className="dur">{fmtHMS(e.durationSeconds)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
