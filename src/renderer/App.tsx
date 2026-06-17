import React, { useState, useEffect } from 'react';
import Timer from './components/Timer';
import ProjectManager from './components/ProjectManager';
import TimeEntryList from './components/TimeEntryList';
import Reports from './components/Reports';
import BridgePanel from './components/AgentFabricPanel';
import IdleDialog from './components/IdleDialog';
import ExportPanel from './components/ExportPanel';
import Settings from './components/Settings';
import SplashScreen from './components/splash/SplashScreen';
import ShortcutsModal from './components/ShortcutsModal';
import BackupPanel from './components/BackupPanel';
import Login from './components/Login';
import PreferencesPanel from './components/PreferencesPanel';
import Onboarding from './components/Onboarding';
import AdminDemoPanel from './components/AdminDemoPanel';
import CoWorkingPanel from './components/CoWorkingPanel';
import {
  IconTimer, IconEntries, IconProjects, IconReports, IconExport, IconBridge, IconBackups, IconSettings, IconHand,
  IconSync, IconKeyboard, IconChevronLeft, IconChevronRight, IconUsers,
} from './components/Icons';
import { fmtHMS, localDateString } from './components/ui';
import type { Project, TimeEntry, TimerState, Session } from '../shared/types';
import { applyThemePreference } from './themeMode';

type Tab = 'timer' | 'projects' | 'entries' | 'reports' | 'export' | 'bridge' | 'realtime' | 'settings' | 'backup' | 'preferences' | 'onboarding' | 'admin';

const TABS: { key: Tab; label: string; hint: string; Icon: React.FC<{ s?: number }> }[] = [
  { key: 'onboarding', label: 'Onboarding', hint: 'required and optional setup', Icon: IconHand },
  { key: 'timer', label: 'Timer', hint: 'track active work', Icon: IconTimer },
  { key: 'entries', label: 'Entries', hint: 'review today and history', Icon: IconEntries },
  { key: 'projects', label: 'Projects', hint: 'local project cache', Icon: IconProjects },
  { key: 'reports', label: 'Reports', hint: 'hours and quota views', Icon: IconReports },
  { key: 'export', label: 'Export', hint: 'extract local data', Icon: IconExport },
  { key: 'bridge', label: 'Fabric', hint: 'agent runtime health', Icon: IconBridge },
  { key: 'realtime', label: 'Co-working', hint: 'ambient presence', Icon: IconUsers },
  { key: 'backup', label: 'Backups', hint: 'local database restore', Icon: IconBackups },
  { key: 'preferences', label: 'Preferences', hint: 'member working style', Icon: IconSettings },
  { key: 'admin', label: 'Admin', hint: 'all projects and emulation', Icon: IconProjects },
  { key: 'settings', label: 'Settings', hint: 'app configuration', Icon: IconSettings },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [tab, setTab] = useState<Tab>('timer');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [idleDialog, setIdleDialog] = useState<{ idleDuration: number; activeDuration: number; entryId: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [timerState, setTimerState] = useState<TimerState>({ running: false });
  const [todayTotal, setTodayTotal] = useState(0);
  const [clock, setClock] = useState('');

  const loadProjects = async () => setProjects(await window.plexus.projectList());
  const loadEntries = async () => {
    const today = localDateString();
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
    let themePref: 'light' | 'dark' | 'system' = 'system';
    window.plexus.settingsGet().then((settings) => {
      themePref = settings.theme;
      applyThemePreference(themePref);
    });
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    const onThemeChange = () => {
      if (themePref === 'system') applyThemePreference(themePref);
    };
    media?.addEventListener('change', onThemeChange);
    return () => {
      unsub(); unsubIdle();
      window.removeEventListener('keydown', handleKey);
      media?.removeEventListener('change', onThemeChange);
      clearInterval(clockId);
    };
  }, []);

  const runningProject = timerState.running ? projects.find(p => p.id === timerState.projectId)?.name : null;
  const sessionStatus = timerState.running
    ? `${timerState.paused ? 'paused' : 'tracking'} · ${runningProject ?? 'active session'}`
    : 'system idle';
  const visibleTabs = TABS.filter((item) => item.key !== 'admin' || session?.role === 'admin');
  const refreshWorkspace = async () => {
    if (actionBusy) return;
    setActionBusy('refresh');
    try {
      const auth = await window.plexus.authRefreshSession();
      if (auth.ok && auth.session) setSession(auth.session);
      await window.plexus.projectsSync();
      await loadProjects();
      await loadEntries();
      await loadTimerState();
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} minDuration={2500} />}

      {!showSplash && session === null && (
        <Login onLogin={(s) => { setSession(s); setTab('onboarding'); window.plexus.projectsSync().then(loadProjects); }} />
      )}

      {!showSplash && session && (
      <div className="px-app-frame">
        {/* HUD top bar — FORMA telemetry cells */}
        <div className="px-hud">
          <div className="px-hud-cell" style={{ paddingLeft: 80 }}>
            <span className="px-brandmark">
              <span className={`px-dot${timerState.running ? ' pulse' : ' idle'}`} />
              <b>PLEXUS</b>
            </span>
            <span style={{ marginLeft: 'auto', color: 'var(--t2)' }}>{session?.email ?? 'v0.1.0'} · {session?.role}</span>
          </div>
          <div className="px-hud-cell center stack">
            <span className="px-hud-status">{sessionStatus}</span>
            <div className="px-hud-actions">
              <button className="px-hud-action" onClick={refreshWorkspace} disabled={actionBusy === 'refresh'} title="Refresh session and sync projects">
                <IconSync s={13} /><span>{actionBusy === 'refresh' ? 'Syncing' : 'Sync'}</span>
              </button>
              <button className="px-hud-action" onClick={() => setTab('onboarding')} title="Open onboarding state">
                <IconHand s={13} /><span>Onboard</span>
              </button>
              {session.role === 'admin' && (
                <button className="px-hud-action" onClick={() => setTab('admin')} title="Open admin demo">
                  <IconProjects s={13} /><span>Admin</span>
                </button>
              )}
              <button className="px-hud-action" onClick={() => setTab('bridge')} title="Open agent fabric health">
                <IconBridge s={13} /><span>Fabric</span>
              </button>
              <button className="px-hud-action icon-only" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts">
                <IconKeyboard s={13} />
              </button>
            </div>
          </div>
          <div className="px-hud-cell end">
            <span>{clock}</span>
            <span style={{ color: timerState.running ? (timerState.paused ? 'var(--t2)' : 'var(--accent)') : 'var(--t3)' }}>
              {timerState.running ? (timerState.paused ? 'paused' : 'rec') : 'standby'}
            </span>
          </div>
        </div>

        <div className="px-shell">
          {/* Sidebar */}
          <nav className={`px-side${navCollapsed ? ' collapsed' : ''}`}>
            <button className="px-nav-toggle" onClick={() => setNavCollapsed((v) => !v)} title={navCollapsed ? 'Expand menu' : 'Collapse menu'}>
              {navCollapsed ? <IconChevronRight s={15} /> : <IconChevronLeft s={15} />}
              {!navCollapsed && <span>Collapse menu</span>}
            </button>
            {visibleTabs.map(({ key, label, hint, Icon }) => (
              <button key={key} className={`px-nav${tab === key ? ' on' : ''}`} onClick={() => setTab(key)} title={`${label}: ${hint}`}>
                <Icon s={16} />
                <span className="nav-copy">
                  <span className="nav-label">{label}</span>
                  <span className="nav-hint">{hint}</span>
                </span>
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
              <Timer
                projects={projects}
                timerState={timerState}
                session={session}
                onProjectsChange={loadProjects}
                onEntriesChange={loadEntries}
                onTimerStateChange={loadTimerState}
              />
            )}
            {tab === 'onboarding' && (
              <Onboarding
                session={session}
                onSessionChange={setSession}
                onContinue={() => setTab('timer')}
              />
            )}
            {tab === 'entries' && <TimeEntryList projects={projects} onChange={loadEntries} />}
            {tab === 'projects' && <ProjectManager projects={projects} onChange={loadProjects} />}
            {tab === 'reports' && <Reports projects={projects} />}
            {tab === 'export' && <ExportPanel projects={projects} />}
            {tab === 'bridge' && <BridgePanel />}
            {tab === 'realtime' && <CoWorkingPanel />}
            {tab === 'preferences' && <PreferencesPanel />}
            {tab === 'settings' && <Settings />}
            {tab === 'backup' && <BackupPanel />}
            {tab === 'admin' && session.role === 'admin' && <AdminDemoPanel />}
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
