import React, { useState, useEffect, useCallback } from 'react';
import type { Project, TimeEntry, TimerState } from '../../shared/types';

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
    setRecentEntries(list.slice(0, 10));
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (!timerState.running || !timerState.startTime) {
      setElapsed(0);
      return;
    }
    const start = new Date(timerState.startTime).getTime();
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
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

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const projectColor = (id: string) => projects.find(p => p.id === id)?.color || '#8b949e';
  const projectName = (id: string) => projects.find(p => p.id === id)?.name || 'Unknown';

  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Timer</h2>

      <div style={{
        background: '#161920',
        borderRadius: 16,
        padding: 32,
        border: '1px solid #252a33',
        marginBottom: 32,
      }}>
        <div style={{
          fontSize: 64,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'center',
          color: timerState.running ? '#3fb950' : '#c9d1d9',
          marginBottom: 24,
          fontFamily: 'SF Mono, Monaco, monospace',
        }}>
          {formatTime(elapsed)}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            disabled={timerState.running}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #30363d',
              background: '#0f1115',
              color: '#c9d1d9',
              fontSize: 15,
              outline: 'none',
            }}
          >
            <option value="">Select project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="What are you working on?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={timerState.running}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #30363d',
            background: '#0f1115',
            color: '#c9d1d9',
            fontSize: 15,
            marginBottom: 20,
            outline: 'none',
          }}
        />

        <button
          onClick={timerState.running ? handleStop : handleStart}
          disabled={!timerState.running && !selectedProject}
          style={{
            width: '100%',
            padding: 16,
            borderRadius: 12,
            border: 'none',
            background: timerState.running ? '#da3633' : '#238636',
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
            opacity: (!timerState.running && !selectedProject) ? 0.5 : 1,
          }}
        >
          {timerState.running ? '⏹ Stop Timer' : '▶ Start Timer'}
        </button>
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Today's Entries</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recentEntries.map(e => (
          <div key={e.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: '#161920',
            borderRadius: 10,
            border: '1px solid #252a33',
          }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: projectColor(e.projectId),
              flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{e.description}</div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>{projectName(e.projectId)}</div>
            </div>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {formatTime(e.durationSeconds)}
            </div>
          </div>
        ))}
        {recentEntries.length === 0 && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>No entries yet today</div>
        )}
      </div>
    </div>
  );
}
