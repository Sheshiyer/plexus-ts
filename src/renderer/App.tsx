import React, { useState, useEffect, useRef, useCallback } from 'react';
import Timer from './components/Timer';
import ProjectManager from './components/ProjectManager';
import TimeEntryList from './components/TimeEntryList';
import IdleDialog from './components/IdleDialog';
import Settings, { type SettingsSectionId } from './components/Settings';
import SplashScreen from './components/splash/SplashScreen';
import PostOnboardingLoading from './components/splash/PostOnboardingLoading';
import ShortcutsModal from './components/ShortcutsModal';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import AdminDemoPanel, { type AdminSection } from './components/AdminDemoPanel';
import CoWorkingPanel from './components/CoWorkingPanel';
import AgentSessionsPanel from './components/AgentSessionsPanel';
import IdentityPanel from './components/IdentityPanel';
import ClioSideChat from './components/ClioSideChat';
import { AssistantStatusButton, useAssistantConnectionStatus, useWorkerConnectionStatus, WorkerConnectionButton } from './components/ConnectionStatus';
import {
  IconTimer, IconEntries, IconProjects, IconBridge, IconSettings,
  IconSync, IconKeyboard, IconChevronLeft, IconChevronRight, IconUsers, IconLogOut,
} from './components/Icons';
import { fmtHMS, localDateString } from './components/ui';
import type { AssistantRouteKey, Project, TimerState, Session } from '../shared/types';
import { applyThemePreference } from './themeMode';
import { clearAdminEmployeeModeContext, readAdminEmployeeModeContext } from './adminEmployeeMode';

type Tab = 'timer' | 'identity' | 'projects' | 'entries' | 'agents' | 'realtime' | 'settings' | 'admin';
type SelectTabOptions = {
  adminSection?: AdminSection;
  settingsSection?: SettingsSectionId;
};
type RouteTarget = SelectTabOptions & {
  tab: Tab;
  openAssistant?: boolean;
};

const TABS: { key: Tab; label: string; hint: string; Icon: React.FC<{ s?: number }> }[] = [
  { key: 'timer', label: 'Focus', hint: 'repo-backed work session', Icon: IconTimer },
  { key: 'identity', label: 'Identity', hint: 'Clio identity', Icon: IconUsers },
  { key: 'entries', label: 'Work Records', hint: 'review today and history', Icon: IconEntries },
  { key: 'agents', label: 'Clio Memories', hint: 'local agent context', Icon: IconBridge },
  { key: 'projects', label: 'Projects', hint: 'GitHub work surfaces', Icon: IconProjects },
  { key: 'realtime', label: 'Co-working', hint: 'ambient presence', Icon: IconUsers },
  { key: 'admin', label: 'Admin', hint: 'workspace oversight', Icon: IconProjects },
  { key: 'settings', label: 'Settings', hint: 'preferences and app configuration', Icon: IconSettings },
];

const APP_MUSE = 'Clio';
const APP_VERSION = __APP_VERSION__;

const ASSISTANT_ROUTE_TARGETS: Partial<Record<AssistantRouteKey, RouteTarget>> = {
  focus: { tab: 'timer' },
  entries: { tab: 'entries' },
  agents: { tab: 'agents' },
  projects: { tab: 'projects' },
  reports: { tab: 'admin', adminSection: 'reports' },
  export: { tab: 'admin', adminSection: 'export' },
  assistant: { tab: 'settings', settingsSection: 'settings-assistant', openAssistant: true },
  bridge: { tab: 'settings', settingsSection: 'settings-fabric' },
  realtime: { tab: 'realtime' },
  backups: { tab: 'admin', adminSection: 'backups' },
  admin: { tab: 'admin', adminSection: 'overview' },
  settings: { tab: 'settings' },
};

function routeTargetForKey(routeKey: string | null): RouteTarget | null {
  if (!routeKey) return null;
  if (routeKey === 'timer') return { tab: 'timer' };
  if (routeKey === 'preferences') return { tab: 'settings' };
  if (routeKey === 'backup') return ASSISTANT_ROUTE_TARGETS.backups ?? null;
  return ASSISTANT_ROUTE_TARGETS[routeKey as AssistantRouteKey] ?? null;
}

const getInitialRouteTarget = (): RouteTarget => {
  const requested = new URLSearchParams(window.location.search).get('tab');
  return routeTargetForKey(requested) ?? { tab: 'timer' };
};

export default function App() {
  const [showSplash, setShowSplash] = useState(() => new URLSearchParams(window.location.search).get('splash') !== '0');
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [tab, setTab] = useState<Tab>(() => getInitialRouteTarget().tab);
  const [adminSection, setAdminSection] = useState<AdminSection>(() => getInitialRouteTarget().adminSection ?? 'overview');
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>(() => getInitialRouteTarget().settingsSection ?? 'settings-identity');
  const selectTabRef = useRef<(next: Tab, options?: SelectTabOptions) => boolean>(() => false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => window.matchMedia?.('(max-width: 920px)').matches ?? false,
  );
  const [clioSideChatOpen, setClioSideChatOpen] = useState(() => window.localStorage.getItem('plexus:clio-sidechat') === 'open');
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
  const [adminEmployeeMode, setAdminEmployeeMode] = useState<{ identityId: string; displayName: string; role: 'employee' | 'admin' } | null>(null);
  const workerConnection = useWorkerConnectionStatus(30000);
  const assistantConnection = useAssistantConnectionStatus(45000);

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 920px)');
    if (!media) return;
    const onChange = () => setIsNarrowViewport(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // CSS force-collapses the sidebar when the Clio side chat is open or the
  // window is narrow; mirror that in state so the toggle never looks like a
  // no-op (the reported "expand/collapse sometimes not working").
  const sidebarAutoCollapsed = clioSideChatOpen || isNarrowViewport;
  const sidebarEffectivelyCollapsed = navCollapsed || sidebarAutoCollapsed;
  const sidebarToggleTitle = sidebarAutoCollapsed
    ? (clioSideChatOpen ? 'Sidebar is auto-collapsed while Clio chat is open' : 'Sidebar is auto-collapsed on narrow windows')
    : (navCollapsed ? 'Expand menu' : 'Collapse menu');

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
    const handleAdminEmployeeModeChange = () => {
      const employeeMode = readAdminEmployeeModeContext();
      if (!employeeMode) {
        setAdminEmployeeMode(null);
        return;
      }
      setAdminEmployeeMode({
        identityId: employeeMode.identityId,
        displayName: employeeMode.displayName,
        role: employeeMode.role,
      });
    };
    const handleAssistantNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ routeKey?: string }>).detail;
      const target = routeTargetForKey(detail?.routeKey ?? null);
      if (!target) return;
      if (target.openAssistant) setClioSideChatOpen(true);
      selectTabRef.current(target.tab, target);
    };
    const handleAssistantOpen = () => setClioSideChatOpen(true);
    window.addEventListener('plexus:preferences-dirty', handlePreferencesDirty);
    window.addEventListener('plexus:open-onboarding-flow', handleOpenOnboarding);
    window.addEventListener('plexus:admin-employee-mode-changed', handleAdminEmployeeModeChange);
    window.addEventListener('plexus:assistant-navigate', handleAssistantNavigate);
    window.addEventListener('plexus:assistant-open', handleAssistantOpen);
    handleAdminEmployeeModeChange();
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
      window.removeEventListener('plexus:admin-employee-mode-changed', handleAdminEmployeeModeChange);
      window.removeEventListener('plexus:assistant-navigate', handleAssistantNavigate);
      window.removeEventListener('plexus:assistant-open', handleAssistantOpen);
      media?.removeEventListener('change', onThemeChange);
      clearInterval(clockId);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem('plexus:clio-sidechat', clioSideChatOpen ? 'open' : 'closed');
  }, [clioSideChatOpen]);

  useEffect(() => {
    if (!session) return;
    if (session.onboarding.completed) return;
    if (dismissedOnboardingIdentityId === session.identityId) return;
    setShowOnboardingFlow(true);
  }, [dismissedOnboardingIdentityId, session]);

  const selectTab = useCallback((next: Tab, options?: SelectTabOptions) => {
    if (tab === 'settings' && preferencesDirty && next !== 'settings') {
      const leave = window.confirm('Preferences have unsaved changes. Leave this page?');
      if (!leave) return false;
      setPreferencesDirty(false);
    }
    if (options?.adminSection) setAdminSection(options.adminSection);
    if (options?.settingsSection) setSettingsSection(options.settingsSection);
    setTab(next);
    return true;
  }, [preferencesDirty, tab]);
  selectTabRef.current = selectTab;

  useEffect(() => {
    if (!session || session.role === 'admin' || tab !== 'admin') return;
    selectTab('settings');
  }, [selectTab, session, tab]);

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
      clearAdminEmployeeModeContext();
      setSession(null);
      setAdminEmployeeMode(null);
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

  const openAssistantSettings = () => {
    selectTab('settings', { settingsSection: 'settings-assistant' });
    window.setTimeout(() => {
      const target = document.getElementById('settings-assistant');
      const scrollRoot = target?.closest<HTMLElement>('.px-main');
      if (!target || !scrollRoot) return;
      const targetRect = target.getBoundingClientRect();
      const rootRect = scrollRoot.getBoundingClientRect();
      scrollRoot.scrollTo({
        top: Math.max(0, scrollRoot.scrollTop + targetRect.top - rootRect.top - 18),
        behavior: 'smooth',
      });
    }, 80);
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} minDuration={2500} />}

      {!showSplash && session === null && (
        <Login onLogin={(s) => {
          setSession(s);
          setTab('timer');
          setShowOnboardingFlow(!s.onboarding.completed);
          window.plexus.projectsSync().then(loadProjects);
        }}
        />
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
              <AssistantStatusButton
                state={assistantConnection.status}
                className={`px-hud-action${clioSideChatOpen ? ' on' : ''}`}
                onClick={() => {
                  if (assistantConnection.status.status?.availability === 'needs_model_key' || assistantConnection.status.status?.availability === 'disabled') {
                    selectTab('settings', { settingsSection: 'settings-assistant' });
                    return;
                  }
                  setClioSideChatOpen((current) => !current);
                }}
              />
              <button className="px-hud-action" onClick={refreshWorkspace} disabled={actionBusy === 'refresh'} title="Refresh session and sync projects">
                <IconSync s={13} /><span>{actionBusy === 'refresh' ? 'Syncing' : 'Sync'}</span>
              </button>
              {session.role === 'admin' && (
                <button className="px-hud-action" onClick={() => selectTab('admin', { adminSection: 'overview' })} title="Open admin workspace">
                  <IconProjects s={13} /><span>Admin</span>
                </button>
              )}
              {session.role === 'admin' && adminEmployeeMode?.role === 'employee' && (
                <button
                  className="px-hud-action"
                  onClick={() => {
                    clearAdminEmployeeModeContext();
                    setAdminEmployeeMode(null);
                    window.dispatchEvent(new Event('plexus:admin-employee-mode-changed'));
                  }}
                  title={`End employee test mode for ${adminEmployeeMode.displayName}`}
                >
                  <IconUsers s={13} /><span>Testing as {adminEmployeeMode.displayName}</span>
                </button>
              )}
              <button
                className="px-hud-action icon-only"
                onClick={() => selectTab('settings', { settingsSection: 'settings-fabric' })}
                title="Open optional helper status"
                aria-label="Open optional helper status"
              >
                <IconBridge s={13} />
              </button>
            </div>
          </div>
          <div className="px-hud-cell end">
            <div className="px-hud-clock">
              <span>{clock}</span>
              <span style={{ color: timerState.running ? (timerState.paused ? 'var(--t2)' : 'var(--accent)') : 'var(--t3)' }}>
                {timerState.running ? (timerState.paused ? 'paused' : 'rec') : 'standby'}
              </span>
            </div>
            <div className="px-hud-actions px-hud-end-actions">
              <button className="px-hud-action icon-only" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts">
                <IconKeyboard s={13} />
              </button>
              <button className="px-hud-action px-hud-logout" onClick={signOut} disabled={signingOut} title="Log out and clear Cloudflare Access session">
                <IconLogOut s={13} /><span>{signingOut ? 'Leaving' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className={`px-shell${clioSideChatOpen ? ' with-sidechat' : ''}`}>
          {/* Sidebar */}
          <nav className={`px-side${sidebarEffectivelyCollapsed ? ' collapsed' : ''}`}>
            <button
              className="px-nav-toggle"
              onClick={() => { if (sidebarAutoCollapsed) return; setNavCollapsed((v) => !v); }}
              disabled={sidebarAutoCollapsed}
              title={sidebarToggleTitle}
            >
              {sidebarEffectivelyCollapsed ? <IconChevronRight s={15} /> : <IconChevronLeft s={15} />}
              {!sidebarEffectivelyCollapsed && <span>Collapse menu</span>}
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
          <div className={`px-main${clioSideChatOpen ? ' sidechat-open' : ''}`}><div className="px-pad">
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
                onOpenFabric={() => selectTab('settings', { settingsSection: 'settings-fabric' })}
              />
            )}
            {tab === 'entries' && <TimeEntryList projects={projects} onChange={loadEntries} />}
            {tab === 'agents' && <AgentSessionsPanel projects={projects} onEntriesChange={loadEntries} onOpenProjects={() => selectTab('projects')} />}
            {tab === 'projects' && <ProjectManager projects={projects} onChange={loadProjects} />}
            {tab === 'realtime' && <CoWorkingPanel />}
            {tab === 'settings' && <Settings projects={projects} initialSection={settingsSection} />}
            {tab === 'admin' && session.role === 'admin' && <AdminDemoPanel projects={projects} initialSection={adminSection} />}
          </div></div>
          <ClioSideChat
            open={clioSideChatOpen}
            projects={projects}
            onClose={() => setClioSideChatOpen(false)}
            onOpenWorkbench={() => {
              setClioSideChatOpen(false);
              openAssistantSettings();
            }}
          />
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
