import React, { useState, useEffect } from 'react';
import Timer from './components/Timer';
import ProjectManager from './components/ProjectManager';
import TimeEntryList from './components/TimeEntryList';
import BridgePanel from './components/AgentFabricPanel';
import IdleDialog from './components/IdleDialog';
import Settings from './components/Settings';
import SplashScreen from './components/splash/SplashScreen';
import PostOnboardingLoading from './components/splash/PostOnboardingLoading';
import ShortcutsModal from './components/ShortcutsModal';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import AdminDemoPanel from './components/AdminDemoPanel';
import CoWorkingPanel from './components/CoWorkingPanel';
import AgentSessionsPanel from './components/AgentSessionsPanel';
import IdentityPanel from './components/IdentityPanel';
import { useWorkerConnectionStatus, WorkerConnectionButton } from './components/ConnectionStatus';
import {
  IconTimer, IconEntries, IconProjects, IconBridge, IconSettings,
  IconSync, IconKeyboard, IconChevronLeft, IconChevronRight, IconUsers, IconLogOut,
} from './components/Icons';
import { fmtHMS, localDateString } from './components/ui';
import type { Project, TimerState, Session } from '../shared/types';
import { applyThemePreference } from './themeMode';

type Tab = 'timer' | 'identity' | 'projects' | 'entries' | 'agents' | 'bridge' | 'realtime' | 'settings' | 'admin';

const TABS: { key: Tab; label: string; hint: string; Icon: React.FC<{ s?: number }> }[] = [
  { key: 'timer', label: 'Focus', hint: 'repo-backed work session', Icon: IconTimer },
  { key: 'identity', label: 'Identity', hint: 'operator loadout', Icon: IconUsers },
  { key: 'entries', label: 'Work Records', hint: 'review today and history', Icon: IconEntries },
  { key: 'agents', label: 'Agent Sessions', hint: 'CLI work suggestions', Icon: IconBridge },
  { key: 'projects', label: 'Projects', hint: 'GitHub work surfaces', Icon: IconProjects },
  { key: 'bridge', label: 'Fabric', hint: 'agent runtime health', Icon: IconBridge },
  { key: 'realtime', label: 'Co-working', hint: 'ambient presence', Icon: IconUsers },
  { key: 'admin', label: 'Admin', hint: 'workspace oversight', Icon: IconProjects },
  { key: 'settings', label: 'Settings', hint: 'preferences and app configuration', Icon: IconSettings },
];

const APP_MUSE = 'Clio';
const APP_VERSION = __APP_VERSION__;

const getInitialTab = (): Tab => {
  const requested = new URLSearchParams(window.location.search).get('tab');
  if (requested === 'preferences') return 'settings';
  return TABS.some((item) => item.key === requested) ? requested as Tab : 'timer';
};

export default function App() {
  const [showSplash, setShowSplash] = useState(() => new URLSearchParams(window.location.search).get('splash') !== '0');
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [showOnboardingFlow, setShowOnboardingFlow] = useState(false);
  const [showPostOnboardingLoading, setShowPostOnboardingLoading] = useState(false);
  const [dismissedOnboardingIdentityId, setDismissedOnboardingIdentityId] = useState<string | null>(null);
  const [preferencesDirty, setPreferencesDirty] = useState(false);
  const [idleDialog, setIdleDialog] = useState<{ idleDuration: number; activeDuration: number; entryId: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timerState, setTimerState] = useState<TimerState>({ running: false });
  const [todayTotal, setTodayTotal] = useState(0);
  const [clock, setClock] = useState('');
  const workerConnection = useWorkerConnectionStatus(30000);

  const loadProjects = async () => setProjects(await window.plexus.projectList());
  const loadEntries = async () => {
    const today = localDateString();
    const list = await window.plexus.entryList(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`);
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
    const handlePreferencesDirty = (event: Event) => {
      const detail = (event as CustomEvent<{ dirty?: boolean }>).detail;
      setPreferencesDirty(Boolean(detail?.dirty));
    };
    const handleOpenOnboarding = () => setShowOnboardingFlow(true);
    window.addEventListener('plexus:preferences-dirty', handlePreferencesDirty);
    window.addEventListener('plexus:open-onboarding-flow', handleOpenOnboarding);
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
      window.removeEventListener('plexus:preferences-dirty', handlePreferencesDirty);
      window.removeEventListener('plexus:open-onboarding-flow', handleOpenOnboarding);
      media?.removeEventListener('change', onThemeChange);
      clearInterval(clockId);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    if (session.onboarding.completed) return;
    if (dismissedOnboardingIdentityId === session.identityId) return;
    setShowOnboardingFlow(true);
  }, [dismissedOnboardingIdentityId, session]);

  const selectTab = (next: Tab) => {
    if (tab === 'settings' && preferencesDirty && next !== 'settings') {
      const leave = window.confirm('Preferences have unsaved changes. Leave this page?');
      if (!leave) return;
      setPreferencesDirty(false);
    }
    setTab(next);
  };

  const runningProject = timerState.running ? projects.find(p => p.id === timerState.projectId)?.name : null;
  const sessionStatus = timerState.running
    ? `${timerState.paused ? 'paused' : 'focusing'} · ${runningProject ?? 'active session'}`
    : 'coordination ready';
  const visibleTabs = TABS.filter((item) => item.key !== 'admin' || session?.role === 'admin');
  const refreshWorkspace = async () => {
    if (actionBusy) return;
    setActionBusy('refresh');
    try {
      const auth: { ok: boolean; session?: Session; message?: string } = await window.plexus.authRefreshSession()
        .catch((err: any) => ({ ok: false, message: err?.message ?? String(err) }));
      if (auth.ok && auth.session) setSession(auth.session);
      await workerConnection.refresh();
      const synced = await window.plexus.projectsSync().catch((err: any) => ({ ok: false, count: 0, message: err?.message ?? String(err) }));
      if (!synced.ok) {
        await window.plexus.handoffRecord({
          kind: 'project_sync',
          status: 'failed',
          title: 'Workspace refresh project sync failed',
          payload: {},
          error: synced.message ?? 'Project sync failed during workspace refresh.',
        }).catch(() => {});
      }
      await Promise.allSettled([loadProjects(), loadEntries(), loadTimerState()]);
    } finally {
      setActionBusy(null);
    }
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    window.dispatchEvent(new Event('plexus:session-teardown'));
    try {
      await window.plexus.authLogout();
      setSession(null);
      setShowOnboardingFlow(false);
      setShowPostOnboardingLoading(false);
      setDismissedOnboardingIdentityId(null);
      setProjects([]);
      setTimerState({ running: false });
      setTodayTotal(0);
      setTab('timer');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} minDuration={2500} />}

      {!showSplash && session === null && (
        <Login onLogin={(s) => { setSession(s); setTab('timer'); setShowOnboardingFlow(true); window.plexus.projectsSync().then(loadProjects); }} />
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
            <span style={{ marginLeft: 'auto', color: 'var(--t2)' }}>{session?.email ?? `${APP_MUSE} v${APP_VERSION}`} · {session?.role}</span>
          </div>
          <div className="px-hud-cell center stack">
            <span className="px-hud-status">{sessionStatus}</span>
            <div className="px-hud-actions">
              <WorkerConnectionButton status={workerConnection.status} onRefresh={workerConnection.refresh} />
              <button className="px-hud-action" onClick={refreshWorkspace} disabled={actionBusy === 'refresh'} title="Refresh session and sync projects">
                <IconSync s={13} /><span>{actionBusy === 'refresh' ? 'Syncing' : 'Sync'}</span>
              </button>
              {session.role === 'admin' && (
                <button className="px-hud-action" onClick={() => selectTab('admin')} title="Open admin workspace">
                  <IconProjects s={13} /><span>Admin</span>
                </button>
              )}
              <button className="px-hud-action" onClick={() => selectTab('bridge')} title="Open agent fabric health">
                <IconBridge s={13} /><span>Fabric</span>
              </button>
              <button className="px-hud-action icon-only" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts">
                <IconKeyboard s={13} />
              </button>
              <button className="px-hud-action" onClick={signOut} disabled={signingOut} title="Log out and clear Cloudflare Access session">
                <IconLogOut s={13} /><span>{signingOut ? 'Leaving' : 'Logout'}</span>
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
            <div className="px-version-mark" title={`Plexus ${APP_MUSE} v${APP_VERSION}`}>
              <span className="px-version-sigil" aria-hidden="true">{APP_MUSE.slice(0, 1)}</span>
              <span className="px-version-copy">
                <span className="px-version-muse">{APP_MUSE}</span>
                <span className="px-version-number">v{APP_VERSION}</span>
              </span>
            </div>
            {visibleTabs.map(({ key, label, hint, Icon }) => (
              <button key={key} className={`px-nav${tab === key ? ' on' : ''}`} onClick={() => selectTab(key)} title={`${label}: ${hint}`}>
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
                onOpenAgentSessions={() => selectTab('agents')}
                onOpenProjects={() => selectTab('projects')}
              />
            )}
            {tab === 'identity' && (
              <IdentityPanel
                projects={projects}
                onOpenSettings={() => selectTab('settings')}
                onOpenFabric={() => selectTab('bridge')}
              />
            )}
            {tab === 'entries' && <TimeEntryList projects={projects} onChange={loadEntries} />}
            {tab === 'agents' && <AgentSessionsPanel projects={projects} onEntriesChange={loadEntries} onOpenProjects={() => selectTab('projects')} />}
            {tab === 'projects' && <ProjectManager projects={projects} onChange={loadProjects} />}
            {tab === 'bridge' && <BridgePanel />}
            {tab === 'realtime' && <CoWorkingPanel />}
            {tab === 'settings' && <Settings />}
            {tab === 'admin' && session.role === 'admin' && <AdminDemoPanel projects={projects} />}
          </div></div>
        </div>
      </div>
      )}

      {!showSplash && session && showOnboardingFlow && (
        <Onboarding
          session={session}
          onSessionChange={setSession}
          workerConnection={workerConnection.status}
          onRefreshWorkerConnection={workerConnection.refresh}
          onContinue={() => {
            setDismissedOnboardingIdentityId(session.identityId);
            setShowOnboardingFlow(false);
            setShowPostOnboardingLoading(true);
          }}
          onOpenProjects={() => {
            setDismissedOnboardingIdentityId(session.identityId);
            setShowOnboardingFlow(false);
            selectTab('projects');
          }}
        />
      )}

      {!showSplash && session && showPostOnboardingLoading && (
        <PostOnboardingLoading
          minDuration={4200}
          onComplete={() => {
            setShowPostOnboardingLoading(false);
            selectTab('timer');
          }}
        />
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
