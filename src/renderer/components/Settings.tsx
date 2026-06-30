import React, { useEffect, useRef, useState } from 'react';
import type {
  PlexusSettings,
  Session,
  ThoughtseedBridgeDirective,
  ThoughtseedBridgeStatus,
  UpdateStatus,
  WorkEvidenceSummary,
} from '../../shared/types';
import { PageHeader, Button, Crosshairs, StatusDot, SectionLabel, Skeleton, Toggle, Input } from './ui';
import {
  IconCheck,
  IconCloud,
  IconLogOut,
  IconPaperclip,
  IconSync,
} from './Icons';
import { applyThemePreference, type ThemePreference } from '../themeMode';
import { OnboardingSetupPanel } from './Onboarding';
import { InstrumentPanel } from './PlexusUI';
import PreferencesPanel from './PreferencesPanel';

const APP_VERSION = __APP_VERSION__;

type SettingsState = 'verified' | 'editable' | 'warning' | 'blocked' | 'idle';
type ChipTone = 'accent' | 'mint' | 'warning' | 'error' | 'idle';
const SETTINGS_SECTION_IDS = [
  'settings-identity',
  'settings-preferences',
  'settings-proof',
  'settings-setup',
  'settings-bridge',
  'settings-appearance',
  'settings-release',
  'settings-evidence',
  'settings-fabric',
] as const;
type SettingsSectionId = typeof SETTINGS_SECTION_IDS[number];

interface CalibrationItem {
  id: SettingsSectionId;
  index: string;
  label: string;
  state: string;
  tone: ChipTone;
  done: boolean;
  prompt: string;
}

interface DatumRailProps {
  label: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
  status?: React.ReactNode;
  tone?: ChipTone;
  accent?: boolean;
  compact?: boolean;
  wrap?: boolean;
  truncateAt?: number;
  className?: string;
}

interface SettingsSectionProps {
  id?: string;
  index?: string;
  label: string;
  title?: React.ReactNode;
  note?: React.ReactNode;
  state?: SettingsState;
  statusText?: string;
  statusTone?: ChipTone;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onActivate?: () => void;
}

function middleTruncate(value: string, max = 38): string {
  if (value.length <= max) return value;
  const head = Math.max(10, Math.ceil((max - 3) * 0.6));
  const tail = Math.max(8, max - 3 - head);
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function textValue(value: React.ReactNode): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTION_IDS.includes(value as SettingsSectionId);
}

function chipToneForBridge(status: ThoughtseedBridgeStatus | null): ChipTone {
  if (status?.lastError) return 'error';
  if (status?.connected) return 'accent';
  if (status?.configured) return 'warning';
  return 'idle';
}

function chipToneForUpdate(status: UpdateStatus | null): ChipTone {
  if (!status) return 'idle';
  if (status.state === 'error') return 'error';
  if (status.state === 'available' || status.state === 'downloaded') return 'warning';
  if (status.state === 'checking' || status.state === 'downloading') return 'mint';
  if (status.state === 'idle' || status.state === 'not-available') return 'accent';
  return 'idle';
}

function StatusChip({ children, tone = 'idle' }: { children: React.ReactNode; tone?: ChipTone }) {
  return <span className={`px-settings-chip tone-${tone}`}>{children}</span>;
}

function DatumRail({
  label,
  value,
  secondary,
  status,
  tone = 'idle',
  accent,
  compact,
  wrap,
  truncateAt,
  className = '',
}: DatumRailProps) {
  const raw = textValue(value);
  const max = truncateAt ?? (compact ? 34 : 42);
  const display = raw && !wrap ? middleTruncate(raw, max) : value;
  const hasTruncated = raw && display !== raw;

  return (
    <div className={`px-datum-rail${accent ? ' is-accent' : ''}${compact ? ' is-compact' : ''}${wrap ? ' is-wrap' : ''} ${className}`} title={hasTruncated ? raw : undefined}>
      <span className="px-datum-label">{label}</span>
      <span className="px-datum-main">{display}</span>
      {secondary && <span className="px-datum-secondary">{secondary}</span>}
      {status && <StatusChip tone={tone}>{status}</StatusChip>}
    </div>
  );
}

function SettingsSection({
  id,
  index,
  label,
  title,
  note,
  state = 'idle',
  statusText,
  statusTone = 'idle',
  actions,
  children,
  className = '',
  active = true,
  onActivate,
}: SettingsSectionProps) {
  const bodyId = id ? `${id}-body` : undefined;

  return (
    <section
      id={id}
      className={`px-settings-section state-${state}${active ? ' is-active' : ''} ${className}`}
      data-active={active ? 'true' : 'false'}
      onClick={() => {
        if (!active) onActivate?.();
      }}
      onFocusCapture={() => {
        if (!active) onActivate?.();
      }}
    >
      <div className="px-settings-section-head">
        <button
          type="button"
          className="px-settings-section-marker"
          onClick={(event) => {
            event.stopPropagation();
            onActivate?.();
          }}
          aria-controls={bodyId}
          aria-label={`Focus ${label} settings section`}
          title={active ? `${label} selected` : `Focus ${label}`}
        >
          <span>{index ?? '--'}</span>
        </button>
        <div className="px-settings-section-copy">
          <SectionLabel>{label}</SectionLabel>
          {title && <div className="settings-title">{title}</div>}
          {note && <div className="settings-note">{note}</div>}
        </div>
        <div className="px-section-actions">
          {statusText && <StatusChip tone={statusTone}>{statusText}</StatusChip>}
          {actions}
        </div>
      </div>
      <div id={bodyId} className="px-settings-section-body" aria-hidden={false}>
        <div className="px-settings-section-body-inner">
          {children}
        </div>
      </div>
    </section>
  );
}

function PaletteSwatches() {
  return (
    <div className="px-settings-swatches" aria-label="Plexus palette tokens">
      <span style={{ background: 'var(--bg-0)' }} />
      <span style={{ background: 'var(--bg-1)' }} />
      <span style={{ background: 'var(--bg-2)' }} />
      <span style={{ background: 'var(--accent)' }} />
      <span style={{ background: 'var(--mint)' }} />
    </div>
  );
}

function SettingsMessage({ tone = 'idle', children }: { tone?: ChipTone; children: React.ReactNode }) {
  return <div className={`px-settings-message tone-${tone}`}>{children}</div>;
}

export default function Settings() {
  const [settings, setSettings] = useState<PlexusSettings | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<{ connected: boolean; message?: string } | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<ThoughtseedBridgeStatus | null>(null);
  const [bridgeInvite, setBridgeInvite] = useState('');
  const [bridgeDirectives, setBridgeDirectives] = useState<ThoughtseedBridgeDirective[]>([]);
  const [bridgePollCheckedAt, setBridgePollCheckedAt] = useState('');
  const [bridgeBusy, setBridgeBusy] = useState('');
  const [bridgeMessage, setBridgeMessage] = useState('');
  const [themeDraft, setThemeDraft] = useState<ThemePreference>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateBusy, setUpdateBusy] = useState('');
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [evidence, setEvidence] = useState<WorkEvidenceSummary | null>(null);
  const [saved, setSaved] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('settings-identity');
  const scrollSpyPausedUntil = useRef(0);

  useEffect(() => {
    window.plexus.settingsGet().then((next) => {
      setSettings(next);
      setThemeDraft(next.theme);
      setEffectiveTheme(applyThemePreference(next.theme));
    });
    window.plexus.authSession().then(setSession);
    window.plexus.workerStatus().then(setStatus);
    window.plexus.thoughtseedBridgeStatus().then(setBridgeStatus);
    window.plexus.updatesGetStatus().then(setUpdateStatus);
    const today = new Date().toISOString().slice(0, 10);
    window.plexus.evidenceStatus(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`).then(setEvidence).catch(() => {});
    return window.plexus.onUpdatesStatus(setUpdateStatus);
  }, []);

  useEffect(() => {
    if (!settings) return;
    const elements = SETTINGS_SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (elements.length === 0) return;

    let frame = 0;
    const scrollRoot = document.querySelector<HTMLElement>('.px-main');
    const observer = new IntersectionObserver((entries) => {
      if (Date.now() < scrollSpyPausedUntil.current) return;
      const next = entries
        .filter((entry) => entry.isIntersecting && entry.target.id && isSettingsSectionId(entry.target.id))
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]?.target.id;
      if (!next || !isSettingsSectionId(next)) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setActiveSection(next));
    }, {
      root: scrollRoot,
      rootMargin: '-18% 0px -54% 0px',
      threshold: [0.01, 0.12, 0.28, 0.5, 0.72],
    });

    elements.forEach((element) => observer.observe(element));
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [settings, session]);

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const previewTheme = (theme: ThemePreference) => {
    setThemeDraft(theme);
    setEffectiveTheme(applyThemePreference(theme));
    setAppearanceDirty(theme !== settings?.theme);
  };

  const saveAppearance = async () => {
    if (!settings) return;
    const next = await window.plexus.settingsSet({ theme: themeDraft });
    setSettings(next);
    setThemeDraft(next.theme);
    setEffectiveTheme(applyThemePreference(next.theme));
    setAppearanceDirty(false);
    flashSaved();
  };

  const runUpdateAction = async (label: string, action: () => Promise<UpdateStatus>) => {
    setUpdateBusy(label);
    setError('');
    try {
      setUpdateStatus(await action());
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setUpdateBusy('');
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    setSessionError('');
    window.dispatchEvent(new Event('plexus:session-teardown'));
    try {
      await window.plexus.authLogout();
      window.location.reload();
    } catch (err: any) {
      setSessionError(err?.message ?? String(err));
      setSigningOut(false);
    }
  };

  const refreshIdentityProof = async () => {
    setSessionError('');
    const [nextSession, nextStatus] = await Promise.all([
      window.plexus.authRefreshSession(),
      window.plexus.workerStatus(),
    ]);
    if (nextSession.ok && nextSession.session) {
      setSession(nextSession.session);
      flashSaved();
    } else {
      setSessionError(nextSession.message ?? 'No role-aware identity returned.');
    }
    setStatus(nextStatus);
  };

  const refreshEvidence = async () => {
    const today = new Date().toISOString().slice(0, 10);
    setEvidence(await window.plexus.evidenceStatus(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`));
  };

  const runBridgeAction = async (label: string, action: () => Promise<string | void>) => {
    setBridgeBusy(label);
    setBridgeMessage('');
    try {
      const message = await action();
      setBridgeStatus(await window.plexus.thoughtseedBridgeStatus());
      if (message) setBridgeMessage(message);
    } catch (err: any) {
      setBridgeStatus(await window.plexus.thoughtseedBridgeStatus());
      setBridgeMessage(err?.message ?? String(err));
    } finally {
      setBridgeBusy('');
    }
  };

  const redeemBridgeInvite = () => runBridgeAction('redeem', async () => {
    const result = await window.plexus.thoughtseedRedeemInvite({ invite: bridgeInvite });
    setBridgeInvite('');
    setBridgePollCheckedAt('');
    setBridgeStatus(result.status);
    return result.status.connected ? 'Task updates connected.' : 'Task updates saved.';
  });

  const pollBridgeDirectives = () => runBridgeAction('poll', async () => {
    const result = await window.plexus.thoughtseedPollDirectives();
    setBridgeDirectives(result.directives);
    setBridgePollCheckedAt(new Date().toISOString());
    return `${result.directives.length} task update${result.directives.length === 1 ? '' : 's'} waiting.`;
  });

  const ackBridgeDirectives = () => runBridgeAction('ack', async () => {
    const ids = bridgeDirectives.map((directive) => directive.id).filter(Boolean);
    await window.plexus.thoughtseedAckDirectives(ids);
    setBridgeDirectives([]);
    return `${ids.length} task update${ids.length === 1 ? '' : 's'} marked read.`;
  });

  const disconnectBridge = () => runBridgeAction('disconnect', async () => {
    setBridgeDirectives([]);
    setBridgePollCheckedAt('');
    setBridgeStatus(await window.plexus.thoughtseedDisconnectBridge());
    return 'Task updates disconnected on this device.';
  });

  const requiredOnboarding = session?.onboarding.requiredComplete ? 'complete' : 'open';
  const fullOnboarding = session?.onboarding.completed ? 'complete' : 'open';
  const bridgeTone = chipToneForBridge(bridgeStatus);
  const updateTone = chipToneForUpdate(updateStatus);
  const focusSection = (id: SettingsSectionId, scroll = false) => {
    scrollSpyPausedUntil.current = Date.now() + (scroll ? 900 : 240);
    setActiveSection(id);
    if (!scroll) return;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      const scrollRoot = target?.closest<HTMLElement>('.px-main');
      if (!target || !scrollRoot) return;
      const targetRect = target.getBoundingClientRect();
      const rootRect = scrollRoot.getBoundingClientRect();
      const nextTop = scrollRoot.scrollTop + targetRect.top - rootRect.top - 18;
      scrollRoot.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    }));
  };

  if (!settings) {
    return (
      <div className="px-fadein px-settings-page">
        <PageHeader title="Settings" sub="workspace preferences" />
        <InstrumentPanel label="loading settings" title="Loading workspace preferences">
          <Skeleton lines={5} widths={['30%', '80%', '60%', '90%', '50%']} />
        </InstrumentPanel>
      </div>
    );
  }

  const calibrationItems: CalibrationItem[] = [
    { id: 'settings-identity', index: '01', label: 'account', state: session ? 'verified' : 'open', tone: session ? 'accent' : 'idle', done: !!session, prompt: 'Keep your workspace account current.' },
    { id: 'settings-preferences', index: '02', label: 'preferences', state: 'ready', tone: 'mint', done: true, prompt: 'Shape how Plexus supports your work.' },
    { id: 'settings-proof', index: '03', label: 'connection', state: status?.connected ? 'online' : 'check', tone: status?.connected ? 'accent' : 'warning', done: !!status?.connected, prompt: 'Confirm your workspace is connected.' },
    { id: 'settings-setup', index: '04', label: 'setup', state: requiredOnboarding, tone: requiredOnboarding === 'complete' ? 'accent' : 'warning', done: requiredOnboarding === 'complete', prompt: 'Finish required setup steps.' },
    { id: 'settings-bridge', index: '05', label: 'updates', state: bridgeStatus?.connected ? 'connected' : 'closed', tone: bridgeTone, done: !!bridgeStatus?.connected, prompt: 'Connect task updates.' },
    { id: 'settings-appearance', index: '06', label: 'appearance', state: appearanceDirty ? 'unsaved' : effectiveTheme, tone: appearanceDirty ? 'warning' : 'accent', done: !appearanceDirty, prompt: 'Tune your local theme.' },
    { id: 'settings-release', index: '07', label: 'app update', state: updateStatus?.state ?? 'loading', tone: updateTone, done: updateStatus?.state === 'idle' || updateStatus?.state === 'not-available', prompt: 'Check for app updates.' },
    { id: 'settings-evidence', index: '08', label: 'evidence', state: `${evidence?.missingEvidenceEntries ?? 0} missing`, tone: (evidence?.missingEvidenceEntries ?? 0) > 0 ? 'warning' : 'accent', done: (evidence?.missingEvidenceEntries ?? 0) === 0, prompt: 'Keep project proof attached.' },
    { id: 'settings-fabric', index: '09', label: 'helpers', state: error ? 'blocked' : 'ready', tone: error ? 'error' : 'mint', done: !error, prompt: 'Check optional local helpers.' },
  ];
  const sectionChrome = (id: SettingsSectionId) => {
    const item = calibrationItems.find((candidate) => candidate.id === id);
    return {
      index: item?.index,
      statusText: item?.state,
      statusTone: item?.tone,
    };
  };

  return (
    <div className="px-fadein px-settings-page">
      <PageHeader
        title="Settings"
        sub="workspace preferences"
        right={saved
          ? <StatusChip tone="accent"><IconCheck s={11} /> Saved</StatusChip>
          : undefined}
      />

      <section className="px-panel raised px-composed-panel px-settings-shell-panel">
        <Crosshairs />
        <div className="px-settings-workbench">
          <div className="px-settings-content">
            <SettingsSection
              id="settings-identity"
              {...sectionChrome('settings-identity')}
              label="Account"
              title="Workspace account"
              note="Your account controls workspace access, project visibility, and setup status."
              state={session ? 'verified' : 'idle'}
              active={activeSection === 'settings-identity'}
              onActivate={() => focusSection('settings-identity')}
              actions={(
                <>
                  {session && <StatusChip tone="accent">verified</StatusChip>}
                  <Button variant="ghost" onClick={signOut} disabled={signingOut}>
                    <IconLogOut s={12} /> {signingOut ? 'Signing out' : 'Log out'}
                  </Button>
                </>
              )}
            >
              {session ? (
                <div className="px-datum-grid">
                  <DatumRail label="member" value={session.employee.displayName} accent compact />
                  <DatumRail label="email" value={session.email} compact truncateAt={30} />
                  <DatumRail label="role" value={session.role} />
                  <DatumRail label="quota" value={`${session.employee.monthlyQuotaHours}h/mo`} />
                  <DatumRail label="workspace" value={session.workspaceId} compact />
                  <DatumRail label="visibility" value={session.projectVisibility} />
                </div>
              ) : (
                <SettingsMessage>Not signed in.</SettingsMessage>
              )}
            </SettingsSection>

            <SettingsSection
              id="settings-preferences"
              {...sectionChrome('settings-preferences')}
              label="Profile and preferences"
              title="How Plexus supports your work"
              note="Set your work style, report cadence, and local profile preferences."
              state="editable"
              active={activeSection === 'settings-preferences'}
              onActivate={() => focusSection('settings-preferences')}
              actions={<StatusChip tone="mint">loadout</StatusChip>}
            >
              <PreferencesPanel embedded />
            </SettingsSection>

            <SettingsSection
              id="settings-proof"
              {...sectionChrome('settings-proof')}
              label="Workspace connection"
              title="Account and setup readiness"
              note="Refresh this when your workspace access or setup state has changed."
              state={status?.connected ? 'verified' : 'warning'}
              active={activeSection === 'settings-proof'}
              onActivate={() => focusSection('settings-proof')}
              actions={(
                <>
                  <StatusDot active={!!status?.connected}>{status?.connected ? 'connected' : 'not connected'}</StatusDot>
                  <Button variant="ghost" onClick={refreshIdentityProof}>
                    <IconSync s={12} /> Refresh connection
                  </Button>
                </>
              )}
            >
              {status && !status.connected && status.message && <SettingsMessage tone="error">{status.message}</SettingsMessage>}
              {sessionError && <SettingsMessage tone="error">{sessionError}</SettingsMessage>}
              <div className="px-datum-grid px-datum-grid-proof">
                <DatumRail label="connection" value={status?.connected ? 'connected' : 'needs attention'} accent={!!status?.connected} />
                <DatumRail label="account" value={session?.email ?? 'Not signed in'} compact truncateAt={34} />
                <DatumRail label="required setup" value={requiredOnboarding} status={requiredOnboarding} tone={requiredOnboarding === 'complete' ? 'accent' : 'warning'} />
                <DatumRail label="onboarding" value={fullOnboarding} status={fullOnboarding} tone={fullOnboarding === 'complete' ? 'accent' : 'warning'} />
              </div>
            </SettingsSection>

            <SettingsSection
              id="settings-setup"
              {...sectionChrome('settings-setup')}
              label="Setup Gates"
              title={session ? 'Required member setup' : 'Setup waits for sign-in'}
              note="Complete required gates first; optional gates can remain paused without blocking work."
              state={requiredOnboarding === 'complete' ? 'verified' : 'warning'}
              active={activeSection === 'settings-setup'}
              onActivate={() => focusSection('settings-setup')}
              actions={<StatusChip tone={requiredOnboarding === 'complete' ? 'accent' : 'warning'}>{requiredOnboarding}</StatusChip>}
            >
              {session ? (
                <div className="px-settings-onboarding-wrap">
                  <OnboardingSetupPanel
                    session={session}
                    onSessionChange={setSession}
                    onOpenFlow={() => window.dispatchEvent(new Event('plexus:open-onboarding-flow'))}
                  />
                </div>
              ) : (
                <SettingsMessage>Sign in before setup can continue.</SettingsMessage>
              )}
            </SettingsSection>

            <SettingsSection
              id="settings-bridge"
              {...sectionChrome('settings-bridge')}
              label="Task updates"
              title={bridgeStatus?.connected ? 'Task updates connected' : 'Task updates not connected'}
              note="Connect this device to receive assigned task updates."
              state={bridgeStatus?.lastError ? 'blocked' : bridgeStatus?.connected ? 'verified' : 'idle'}
              active={activeSection === 'settings-bridge'}
              onActivate={() => focusSection('settings-bridge')}
              actions={<StatusChip tone={bridgeTone}>{bridgeStatus?.connected ? 'connected' : bridgeStatus?.configured ? 'configured' : 'closed'}</StatusChip>}
              className="px-settings-bridge-section"
            >
              <div className="px-datum-grid">
                <DatumRail label="state" value={bridgeStatus?.connected ? 'connected' : 'closed'} accent={!!bridgeStatus?.connected} />
                <DatumRail label="updates waiting" value={bridgeDirectives.length} tone={bridgeDirectives.length > 0 ? 'warning' : 'accent'} />
                <DatumRail label="last sync" value={bridgePollCheckedAt ? new Date(bridgePollCheckedAt).toLocaleTimeString() : 'not checked'} compact />
              </div>

              {bridgeStatus?.lastError && <SettingsMessage tone="error">{bridgeStatus.lastError}</SettingsMessage>}
              {bridgeMessage && <SettingsMessage tone={bridgeTone}>{bridgeMessage}</SettingsMessage>}
              {bridgeDirectives.length > 0 && (
                <SettingsMessage tone="warning">
                  {bridgeDirectives.length} task update{bridgeDirectives.length === 1 ? '' : 's'} waiting.
                </SettingsMessage>
              )}
              {bridgePollCheckedAt && bridgeDirectives.length === 0 && (
                <SettingsMessage>No task updates waiting. Last checked {new Date(bridgePollCheckedAt).toLocaleTimeString()}.</SettingsMessage>
              )}

              <div className="px-bridge-dock">
                <Input
                  value={bridgeInvite}
                  onChange={(event) => setBridgeInvite(event.target.value)}
                  placeholder="Paste task update invite"
                  aria-label="Task update invite"
                />
                <div className="px-action-strip">
                  <Button onClick={redeemBridgeInvite} disabled={!bridgeInvite.trim() || !!bridgeBusy}>
                    {bridgeBusy === 'redeem' ? 'Connecting' : 'Connect'}
                  </Button>
                  <Button variant="ghost" onClick={pollBridgeDirectives} disabled={!bridgeStatus?.connected || !!bridgeBusy}>
                    {bridgeBusy === 'poll' ? 'Syncing' : 'Sync now'}
                  </Button>
                  <Button variant="ghost" onClick={ackBridgeDirectives} disabled={bridgeDirectives.length === 0 || !!bridgeBusy}>
                    {bridgeBusy === 'ack' ? 'Marking read' : 'Mark read'}
                  </Button>
                  <Button variant="stop" onClick={disconnectBridge} disabled={!bridgeStatus?.configured || !!bridgeBusy}>
                    Disconnect
                  </Button>
                </div>
              </div>
            </SettingsSection>

            <div className="px-settings-module-grid">
              <SettingsSection
                id="settings-appearance"
                {...sectionChrome('settings-appearance')}
                label="Appearance"
                title="App appearance"
                note={`Current render: ${effectiveTheme}. System follows macOS.`}
                state={appearanceDirty ? 'editable' : 'verified'}
                active={activeSection === 'settings-appearance'}
                onActivate={() => focusSection('settings-appearance')}
                actions={<Button onClick={saveAppearance} disabled={!appearanceDirty}>{appearanceDirty ? 'Save appearance' : 'Saved'}</Button>}
              >
                <div className="px-settings-control-row">
                  <Toggle<ThemePreference> value={themeDraft} onChange={previewTheme} options={[
                    { key: 'dark', label: 'dark' },
                    { key: 'light', label: 'light' },
                    { key: 'system', label: 'system' },
                  ]} />
                  <PaletteSwatches />
                </div>
              </SettingsSection>

              <SettingsSection
                id="settings-release"
                {...sectionChrome('settings-release')}
                label="App update"
                title={updateStatus?.state === 'available' && updateStatus.availableVersion
                  ? `Version ${updateStatus.availableVersion} available`
                  : updateStatus?.state === 'downloaded'
                    ? 'Update ready to install'
                    : 'App update'}
                note={updateStatus?.message || 'Check whether a new version is ready.'}
                state={updateStatus?.state === 'error' ? 'blocked' : updateStatus?.state === 'available' || updateStatus?.state === 'downloaded' ? 'warning' : 'idle'}
                active={activeSection === 'settings-release'}
                onActivate={() => focusSection('settings-release')}
                actions={<StatusChip tone={updateTone}>{updateStatus?.state ?? 'loading'}</StatusChip>}
              >
                {updateStatus && (
                  <div className="px-datum-grid px-datum-grid-tight">
                    <DatumRail label="current" value={updateStatus.currentVersion} />
                    <DatumRail label="local app" value={APP_VERSION} accent />
                    <DatumRail label="state" value={updateStatus.state} />
                  </div>
                )}
                {updateStatus?.state === 'downloading' && (
                  <div className="px-update-meter" aria-label="Update download progress">
                    <span style={{ width: `${Math.max(0, Math.min(100, updateStatus.percent ?? 0))}%` }} />
                  </div>
                )}
                {updateStatus?.error && <SettingsMessage tone="error">{updateStatus.error}</SettingsMessage>}
                <div className="px-action-strip">
                  <Button
                    variant="ghost"
                    onClick={() => runUpdateAction('check', window.plexus.updatesCheck)}
                    disabled={!updateStatus?.canCheck || !!updateBusy}
                  >
                    <IconSync s={12} /> {updateBusy === 'check' ? 'Checking' : 'Check'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => runUpdateAction('download', window.plexus.updatesDownload)}
                    disabled={!updateStatus?.canDownload || !!updateBusy}
                  >
                    {updateBusy === 'download' ? 'Downloading' : 'Download'}
                  </Button>
                  <Button
                    variant={updateStatus?.canInstall ? 'accent' : 'ghost'}
                    onClick={() => runUpdateAction('install', window.plexus.updatesInstall)}
                    disabled={!updateStatus?.canInstall || !!updateBusy}
                  >
                    Install + restart
                  </Button>
                </div>
              </SettingsSection>
            </div>

            <div className="px-settings-module-grid">
              <SettingsSection
                id="settings-evidence"
                {...sectionChrome('settings-evidence')}
                label="Work proof"
                title="Work proof health"
                note="New work records need a verified project repo before summaries can count them as proven."
                state={(evidence?.missingEvidenceEntries ?? 0) > 0 ? 'warning' : 'verified'}
                active={activeSection === 'settings-evidence'}
                onActivate={() => focusSection('settings-evidence')}
                actions={<Button variant="ghost" onClick={refreshEvidence}><IconSync s={12} /> Refresh proof</Button>}
              >
                <div className="px-datum-grid px-datum-grid-tight">
                  <DatumRail label="entries today" value={evidence?.totalEntries ?? 'not loaded'} accent />
                  <DatumRail label="matched" value={evidence?.evidencedEntries ?? 'not loaded'} />
                  <DatumRail label="missing proof" value={evidence?.missingEvidenceEntries ?? 'not loaded'} tone={(evidence?.missingEvidenceEntries ?? 0) > 0 ? 'warning' : 'accent'} />
                  <DatumRail label="legacy" value={evidence?.legacyUnverifiedEntries ?? 'not loaded'} />
                </div>
              </SettingsSection>

              <SettingsSection
                id="settings-fabric"
                {...sectionChrome('settings-fabric')}
                label="Local helpers"
                title="Optional local helper setup"
                note="Use these actions when support asks you to refresh this device."
                state={error ? 'blocked' : 'idle'}
                active={activeSection === 'settings-fabric'}
                onActivate={() => focusSection('settings-fabric')}
                actions={<StatusChip tone={error ? 'error' : 'mint'}>{error ? 'blocked' : 'ready'}</StatusChip>}
              >
                {error && <SettingsMessage tone="error">{error}</SettingsMessage>}
                <div className="px-fabric-actions">
                  <Button variant="ghost" onClick={async () => {
                    const res = await window.plexus.memberProvision();
                    if (res.ok) {
                      flashSaved();
                    } else {
                      setError(res.message || 'Provision failed');
                    }
                  }}>
                    <IconCloud s={12} /> Refresh profile setup
                  </Button>
                  <Button variant="ghost" onClick={async () => {
                    const res = await window.plexus.memberSetup();
                    if (res.ok) {
                      flashSaved();
                    } else {
                      setError(res.message || 'Setup failed');
                    }
                  }}>
                    <IconPaperclip s={12} /> Run helper setup
                  </Button>
                </div>
              </SettingsSection>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
