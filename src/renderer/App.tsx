import React, { useState, useEffect } from 'react';
import Timer from './components/Timer';
import ProjectManager from './components/ProjectManager';
import TimeEntryList from './components/TimeEntryList';
import Reports from './components/Reports';
import BridgePanel from './components/BridgePanel';
import SplashScreen from './components/splash/SplashScreen';
import type { Project, TimeEntry, TimerState } from '../shared/types';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [tab, setTab] = useState<'timer' | 'projects' | 'entries' | 'reports' | 'bridge'>('timer');
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [timerState, setTimerState] = useState<TimerState>({ running: false });
  const [todayTotal, setTodayTotal] = useState(0);

  const loadProjects = async () => {
    const list = await window.plexus.projectList();
    setProjects(list);
  };

  const loadEntries = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const from = `${today}T00:00:00.000Z`;
    const to = `${today}T23:59:59.999Z`;
    const list = await window.plexus.entryList(from, to);
    setEntries(list);
    setTodayTotal(list.reduce((s, e) => s + e.durationSeconds, 0));
  };

  const loadTimerState = async () => {
    const state = await window.plexus.timerGetState();
    setTimerState(state);
  };

  useEffect(() => {
    loadProjects();
    loadEntries();
    loadTimerState();
    const unsub = window.plexus.onTimerTick((state) => {
      setTimerState(state);
      loadEntries();
    });
    return () => unsub();
  }, []);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const tabs = [
    { key: 'timer' as const, label: '⏱ Timer' },
    { key: 'entries' as const, label: '📝 Entries' },
    { key: 'projects' as const, label: '📁 Projects' },
    { key: 'reports' as const, label: '📊 Reports' },
    { key: 'bridge' as const, label: '🔌 Bridge' },
  ];

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} minDuration={2500} />}
      <div style={{ display: 'flex', height: '100vh', background: '#0f1115' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#161920', borderRight: '1px solid #252a33', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 24, borderBottom: '1px solid #252a33' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#58a6ff', letterSpacing: '-0.5px' }}>Plexus</h1>
          <p style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>Time Tracker for Thoughtseed</p>
        </div>
        <nav style={{ flex: 1, padding: 12 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                marginBottom: 4,
                borderRadius: 8,
                border: 'none',
                background: tab === t.key ? '#1f6feb22' : 'transparent',
                color: tab === t.key ? '#58a6ff' : '#c9d1d9',
                fontSize: 14,
                fontWeight: tab === t.key ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: 16, borderTop: '1px solid #252a33' }}>
          <div style={{ fontSize: 12, color: '#8b949e' }}>Today</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#3fb950', fontVariantNumeric: 'tabular-nums' }}>
            {formatDuration(todayTotal)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {tab === 'timer' && (
          <Timer
            projects={projects}
            timerState={timerState}
            onProjectsChange={loadProjects}
            onEntriesChange={loadEntries}
          />
        )}
        {tab === 'entries' && <TimeEntryList projects={projects} onChange={loadEntries} />}
        {tab === 'projects' && <ProjectManager projects={projects} onChange={loadProjects} />}
        {tab === 'reports' && <Reports projects={projects} />}
        {tab === 'bridge' && <BridgePanel />}
      </div>
    </div>
    </>
  );
}
