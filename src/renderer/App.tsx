import React, { useState, useEffect } from 'react';
import Timer from './components/Timer';
import ProjectManager from './components/ProjectManager';
import TimeEntryList from './components/TimeEntryList';
import Reports from './components/Reports';
import BridgePanel from './components/BridgePanel';
import IdleDialog from './components/IdleDialog';
import ExportPanel from './components/ExportPanel';
import Settings from './components/Settings';
import SplashScreen from './components/splash/SplashScreen';
import ShortcutsModal from './components/ShortcutsModal';
import BackupPanel from './components/BackupPanel';
import Login from './components/Login';
import {
  IconTimer, IconEntries, IconProjects, IconReports, IconExport, IconBridge, IconBackups, IconSettings,
} from './components/Icons';
import { fmtHMS } from './components/ui';
import type { Project, TimeEntry, TimerState, Session } from '../shared/types';

type Tab = 'timer' | 'projects' | 'entries' | 'reports' | 'export' | 'bridge' | 'settings' | 'backup';

const TABS: { key: Tab; label: string; Icon: React.FC<{ s?: number }> }[] = [
  { key: 'timer', label: 'Timer', Icon: IconTimer },
  { key: 'entries', label: 'Entries', Icon: IconEntries },
  { key: 'projects', label: 'Projects', Icon: IconProjects },
  { key: 'reports', label: 'Reports', Icon: IconReports },
  { key: 'export', label: 'Export', Icon: IconExport },
  { key: 'bridge', label: 'Bridge', Icon: IconBridge },
  { key: 'backup', label: 'Backups', Icon: IconBackups },
  { key: 'settings', label: 'Settings', Icon: IconSettings },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [tab, setTab] = useState<Tab>('timer');
  const [idleDialog, setIdleDialog] = useState<{ idleDuration: number; activeDuration: number; entryId: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [timerState, setTimerState] = useState<TimerState>({ running: false });
  const [todayTotal, setTodayTotal] = useState(0);
  const [clock, setClock] = useState('');

  const loadProjects = async () => setProjects(await window.plexus.projectList());
  const loadEntries = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const list = await window.plexus.entryList(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
    setEntries(list);
    setTodayTotal(list.reduce((s, e) => s + e.durationSeconds, 0));
  };
  const loadTimerState = async () => setTimerState(await window.plexus.timerGetState());

  useEffect(() => {
    loadProjects();
    loadEntries();
    loadTimerState();
    const unsub = window.plexus.onTimerTick((state) => { setTimerState(state); loadEntries(); });
    const unsubIdle = window.plexus.onIdleDetected((data) => {
      setIdleDialog({ idleDuration: data.idleDuration, activeDuration: data.activeDuration, entryId: data.entryId });
    });
    window.plexus.authSession().then(setSession);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) setShowShortcuts(s => !s);
    };
    window.addEventListener('keydown', handleKey);
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB'));
    tick();
    const clockId = setInterval(tick, 1000);
    return () => {
      unsub(); unsubIdle();
      window.removeEventListener('keydown', handleKey);
      clearInterval(clockId);
    };
  }, []);

  const runningProject = timerState.running ? projects.find(p => p.id === timerState.projectId)?.name : null;

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} minDuration={2500} />}

      {!showSplash && session === null && (
        <Login onLogin={(s) => { setSession(s); window.plexus.projectsSync().then(loadProjects); }} />
      )}

      {!showSplash && session && (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* HUD top bar — FORMA telemetry cells */}
        <div className="px-hud">
          <div className="px-hud-cell" style={{ paddingLeft: 80 }}>
            <span className="px-brandmark">
              <span className={`px-dot${timerState.running ? ' pulse' : ' idle'}`} />
              <b>PLEXUS</b>
            </span>
            <span style={{ marginLeft: 'auto', color: 'var(--t2)' }}>{session?.email ?? 'v0.1.0'}</span>
          </div>
          <div className="px-hud-cell center">
            {runningProject ? `▸ tracking · ${runningProject}` : 'system idle'}
          </div>
          <div className="px-hud-cell end">
            <span>{clock}</span>
            <span style={{ color: timerState.running ? 'var(--accent)' : 'var(--t3)' }}>
              {timerState.running ? '● rec' : '○ standby'}
            </span>
          </div>
        </div>

        <div className="px-shell">
          {/* Sidebar */}
          <nav className="px-side">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} className={`px-nav${tab === key ? ' on' : ''}`} onClick={() => setTab(key)}>
                <Icon s={16} />{label}
              </button>
            ))}
            <div className="px-side-sp" />
            <div className="px-total">
              <div className="px-lbl">today</div>
              <div className="v">{fmtHMS(todayTotal)}</div>
            </div>
          </nav>

          {/* Content */}
          <div className="px-main"><div className="px-pad">
            {tab === 'timer' && (
              <Timer projects={projects} timerState={timerState} onProjectsChange={loadProjects} onEntriesChange={loadEntries} />
            )}
            {tab === 'entries' && <TimeEntryList projects={projects} onChange={loadEntries} />}
            {tab === 'projects' && <ProjectManager projects={projects} onChange={loadProjects} />}
            {tab === 'reports' && <Reports projects={projects} />}
            {tab === 'export' && <ExportPanel projects={projects} />}
            {tab === 'bridge' && <BridgePanel />}
            {tab === 'settings' && <Settings />}
            {tab === 'backup' && <BackupPanel />}
          </div></div>
        </div>
      </div>
      )}

      {idleDialog && (
        <IdleDialog
          idleSeconds={Math.floor(idleDialog.idleDuration / 1000)}
          activeSeconds={idleDialog.activeDuration}
          entryId={idleDialog.entryId}
          onAction={async (action) => {
            await window.plexus.idleAction(idleDialog.entryId, action, idleDialog.idleDuration);
            setIdleDialog(null);
            loadEntries();
            loadTimerState();
          }}
        />
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  );
}
