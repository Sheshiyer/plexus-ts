import React, { useEffect, useState } from 'react';
import type {
  PlexusSettings,
  Session,
  ThoughtseedBridgeDirective,
  ThoughtseedBridgeStatus,
  UpdateStatus,
  WorkerConfig,
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
  label: string;
  title?: React.ReactNode;
  note?: React.ReactNode;
  state?: SettingsState;
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
  label,
  title,
  note,
  state = 'idle',
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
      className={`px-settings-section state-${state}${active ? ' is-active' : ' is-collapsed'} ${className}`}
      data-active={active ? 'true' : 'false'}
      onClick={() => {
        if (!active) onActivate?.();
      }}
      onFocusCapture={() => {
        if (!active) onActivate?.();
      }}
    >
      <div className="px-settings-section-head">
        <div className="px-settings-section-copy">
          <SectionLabel>{label}</SectionLabel>
          {title && <div className="settings-title">{title}</div>}
          {note && <div className="settings-note">{note}</div>}
        </div>
        {actions && <div className="px-section-actions">{actions}</div>}
      </div>
      <div id={bodyId} className="px-settings-section-body" aria-hidden={!active}>
        <div className="px-settings-section-body-inner">
          {children}
        </div>
      </div>
    </section>
  );
}

function CalibrationRail({
  items,
  activeId,
  onSelect,
}: {
  items: CalibrationItem[];
  activeId: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  const activeItem = items.find((item) => item.id === activeId) ?? items[0];
  const doneCount = items.filter((item) => item.done).length;

  return (
    <nav className="px-settings-rail" aria-label="Settings control guide">
      <div className="px-settings-rail-head">
        <span className="px-dot pulse" />
        <span>
          Control guide
          <small>{doneCount}/{items.length} objectives steady</small>
        </span>
      </div>
      {activeItem && (
        <div className="px-settings-rail-active">
          <span>active objective</span>
          <strong>{activeItem.label}</strong>
          <small>{activeItem.prompt}</small>
        </div>
      )}
      <div className="px-settings-rail-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`px-settings-rail-item tone-${item.tone}${item.id === activeId ? ' is-active' : ''}${item.done ? ' is-done' : ' is-open'}`}
            onClick={() => onSelect(item.id)}
            aria-current={item.id === activeId ? 'step' : undefined}
          >
            <span className="px-settings-rail-index">{item.index}</span>
            <strong>{item.label}</strong>
            <small>{item.state}</small>
            <i aria-hidden="true">{item.id === activeId ? 'now' : item.done ? 'set' : 'next'}</i>
          </button>
        ))}
      </div>
    </nav>
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
  const [cfg, setCfg] = useState<WorkerConfig | null>(null);
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

  useEffect(() => {
    window.plexus.settingsGet().then((next) => {
      setSettings(next);
      setThemeDraft(next.theme);
      setEffectiveTheme(applyThemePreference(next.theme));
    });
    window.plexus.authSession().then(setSession);
    window.plexus.workerConfigGet().then(setCfg);
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
    const observer = new IntersectionObserver((entries) => {
      const next = entries
        .filter((entry) => entry.isIntersecting && entry.target.id && isSettingsSectionId(entry.target.id))
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]?.target.id;
      if (!next || !isSettingsSectionId(next)) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setActiveSection(next));
    }, {
      root: null,
      rootMargin: '-24% 0px -58% 0px',
      threshold: [0.08, 0.18, 0.32, 0.56, 0.8],
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
    return `Connected as ${result.status.memberId}`;
  });

  const sendBridgeHeartbeat = () => runBridgeAction('heartbeat', async () => {
    const result = await window.plexus.thoughtseedSendHeartbeat();
    return `Heartbeat sent: ${result.id}`;
  });

  const pollBridgeDirectives = () => runBridgeAction('poll', async () => {
    const result = await window.plexus.thoughtseedPollDirectives();
    setBridgeDirectives(result.directives);
    setBridgePollCheckedAt(new Date().toISOString());
    return `${result.directives.length} directive${result.directives.length === 1 ? '' : 's'} pending`;
  });

  const ackBridgeDirectives = () => runBridgeAction('ack', async () => {
    const ids = bridgeDirectives.map((directive) => directive.id).filter(Boolean);
    await window.plexus.thoughtseedAckDirectives(ids);
    setBridgeDirectives([]);
    return `${ids.length} directive${ids.length === 1 ? '' : 's'} acked`;
  });

  const rotateBridgeToken = () => runBridgeAction('rotate', async () => {
    const result = await window.plexus.thoughtseedRotateBridgeToken();
    setBridgeStatus(result.status);
    return 'Bridge token rotated';
  });

  const disconnectBridge = () => runBridgeAction('disconnect', async () => {
    setBridgeDirectives([]);
    setBridgePollCheckedAt('');
    setBridgeStatus(await window.plexus.thoughtseedDisconnectBridge());
    return 'Bridge disconnected locally';
  });

  const requiredOnboarding = session?.onboarding.requiredComplete ? 'complete' : 'open';
  const fullOnboarding = session?.onboarding.completed ? 'complete' : 'open';
  const bridgeTone = chipToneForBridge(bridgeStatus);
  const updateTone = chipToneForUpdate(updateStatus);
  const focusSection = (id: SettingsSectionId, scroll = false) => {
    setActiveSection(id);
    if (!scroll) return;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  if (!settings) {
    return (
      <div className="px-fadein px-settings-page">
        <PageHeader title="Settings" sub="system calibration" />
        <InstrumentPanel label="loading settings" title="Reading local configuration">
          <Skeleton lines={5} widths={['30%', '80%', '60%', '90%', '50%']} />
        </InstrumentPanel>
      </div>
    );
  }

  const calibrationItems: CalibrationItem[] = [
    { id: 'settings-identity', index: '01', label: 'identity', state: session ? 'verified' : 'open', tone: session ? 'accent' : 'idle', done: !!session, prompt: 'Keep workspace identity clean.' },
    { id: 'settings-preferences', index: '02', label: 'preferences', state: 'loadout', tone: 'mint', done: true, prompt: 'Shape working style and character loadout.' },
    { id: 'settings-proof', index: '03', label: 'proof', state: status?.connected ? 'online' : 'check', tone: status?.connected ? 'accent' : 'warning', done: !!status?.connected, prompt: 'Confirm Access and Worker proof.' },
    { id: 'settings-setup', index: '04', label: 'setup', state: requiredOnboarding, tone: requiredOnboarding === 'complete' ? 'accent' : 'warning', done: requiredOnboarding === 'complete', prompt: 'Finish required setup gates.' },
    { id: 'settings-bridge', index: '05', label: 'bridge', state: bridgeStatus?.connected ? 'connected' : 'closed', tone: bridgeTone, done: !!bridgeStatus?.connected, prompt: 'Bind Cambium bridge credentials.' },
    { id: 'settings-appearance', index: '06', label: 'appearance', state: appearanceDirty ? 'dirty' : effectiveTheme, tone: appearanceDirty ? 'warning' : 'accent', done: !appearanceDirty, prompt: 'Tune the local console skin.' },
    { id: 'settings-release', index: '07', label: 'release', state: updateStatus?.state ?? 'loading', tone: updateTone, done: updateStatus?.state === 'idle' || updateStatus?.state === 'not-available', prompt: 'Check OTA feed readiness.' },
    { id: 'settings-evidence', index: '08', label: 'evidence', state: `${evidence?.missingEvidenceEntries ?? 0} missing`, tone: (evidence?.missingEvidenceEntries ?? 0) > 0 ? 'warning' : 'accent', done: (evidence?.missingEvidenceEntries ?? 0) === 0, prompt: 'Keep project proof attached.' },
    { id: 'settings-fabric', index: '09', label: 'fabric', state: error ? 'blocked' : 'ready', tone: error ? 'error' : 'mint', done: !error, prompt: 'Run local member provisioning.' },
  ];

  return (
    <div className="px-fadein px-settings-page">
      <PageHeader
        title="Settings"
        sub="system calibration"
        right={saved
          ? <StatusChip tone="accent"><IconCheck s={11} /> Saved</StatusChip>
          : undefined}
      />

      <section className="px-panel raised px-composed-panel px-settings-shell-panel">
        <Crosshairs />
        <div className="px-settings-workbench">
          <CalibrationRail
            items={calibrationItems}
            activeId={activeSection}
            onSelect={(id) => focusSection(id, true)}
          />

          <div className="px-settings-content">
            <SettingsSection
              id="settings-identity"
              label="Identity Credential"
              title="Verified workspace identity"
              note="Cloudflare Access remains the source of authentication; Plexus keeps local calibration separate from identity proof."
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
              label="Member Preferences"
              title="Working style and character loadout"
              note="This replaces the old local profile card: routing context, report visibility, Meshy prompt, and the 3D member sheet live together."
              state="editable"
              active={activeSection === 'settings-preferences'}
              onActivate={() => focusSection('settings-preferences')}
              actions={<StatusChip tone="mint">loadout</StatusChip>}
            >
              <PreferencesPanel embedded />
            </SettingsSection>

            <SettingsSection
              id="settings-proof"
              label="Session Proof"
              title="Access, worker, and onboarding contract"
              note="Proof state is refreshed from Cloudflare Access and the coordination Worker."
              state={status?.connected ? 'verified' : 'warning'}
              active={activeSection === 'settings-proof'}
              onActivate={() => focusSection('settings-proof')}
              actions={(
                <>
                  <StatusDot active={!!status?.connected}>{status?.connected ? 'connected' : 'not connected'}</StatusDot>
                  <Button variant="ghost" onClick={refreshIdentityProof}>
                    <IconSync s={12} /> Refresh proof
                  </Button>
                </>
              )}
            >
              {status && !status.connected && status.message && <SettingsMessage tone="error">{status.message}</SettingsMessage>}
              {sessionError && <SettingsMessage tone="error">{sessionError}</SettingsMessage>}
              <div className="px-datum-grid px-datum-grid-proof">
                <DatumRail label="auth" value="Cloudflare Access" accent />
                <DatumRail label="worker endpoint" value={cfg?.baseUrl ?? 'Worker config not loaded'} compact truncateAt={42} />
                <DatumRail label="identity id" value={session?.identityId ?? 'Identity proof not loaded'} compact truncateAt={40} />
                <DatumRail label="employee id" value={session?.employeeId ?? 'No employee link returned'} compact truncateAt={34} />
                <DatumRail label="required setup" value={requiredOnboarding} status={requiredOnboarding} tone={requiredOnboarding === 'complete' ? 'accent' : 'warning'} />
                <DatumRail label="onboarding" value={fullOnboarding} status={fullOnboarding} tone={fullOnboarding === 'complete' ? 'accent' : 'warning'} />
              </div>
            </SettingsSection>

            <SettingsSection
              id="settings-setup"
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
                <SettingsMessage>Sign in before setup calibration.</SettingsMessage>
              )}
            </SettingsSection>

            <SettingsSection
              id="settings-bridge"
              label="Thoughtseed Bridge"
              title={bridgeStatus?.connected ? `Cambium connected as ${bridgeStatus.memberId}` : 'Cambium bridge not connected'}
              note="Member-scoped bridge credentials stay in secure storage; Plexus never stores the Worker admin token."
              state={bridgeStatus?.lastError ? 'blocked' : bridgeStatus?.connected ? 'verified' : 'idle'}
              active={activeSection === 'settings-bridge'}
              onActivate={() => focusSection('settings-bridge')}
              actions={<StatusChip tone={bridgeTone}>{bridgeStatus?.connected ? 'connected' : bridgeStatus?.configured ? 'configured' : 'closed'}</StatusChip>}
              className="px-settings-bridge-section"
            >
              <div className="px-datum-grid">
                <DatumRail label="state" value={bridgeStatus?.connected ? 'connected' : 'closed'} accent={!!bridgeStatus?.connected} />
                <DatumRail label="tenant" value={bridgeStatus?.tenantId ?? 'cambium'} />
                <DatumRail label="member" value={bridgeStatus?.memberId || 'not redeemed'} compact />
                <DatumRail label="expires" value={bridgeStatus?.tokenExpiresAt ?? 'not set'} compact truncateAt={32} />
                <DatumRail label="last seen" value={bridgeStatus?.lastSeenAt ?? 'not sent'} compact truncateAt={32} />
                <DatumRail label="endpoint" value={bridgeStatus?.bridgeApiUrl ?? 'https://curious.thoughtseed.space'} compact truncateAt={44} />
              </div>

              {bridgeStatus?.lastError && <SettingsMessage tone="error">{bridgeStatus.lastError}</SettingsMessage>}
              {bridgeMessage && <SettingsMessage tone={bridgeTone}>{bridgeMessage}</SettingsMessage>}
              {bridgeDirectives.length > 0 && (
                <div className="px-directive-stream">
                  {bridgeDirectives.map((directive) => {
                    const payload = JSON.stringify(directive.payload);
                    return (
                      <div key={directive.id} title={payload}>
                        <strong>{directive.id}</strong>
                        <span>{middleTruncate(payload, 96)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {bridgePollCheckedAt && bridgeDirectives.length === 0 && (
                <SettingsMessage>No directives pending. Last checked {new Date(bridgePollCheckedAt).toLocaleTimeString()}.</SettingsMessage>
              )}

              <div className="px-bridge-dock">
                <Input
                  value={bridgeInvite}
                  onChange={(event) => setBridgeInvite(event.target.value)}
                  placeholder="Paste member invite token"
                  aria-label="Thoughtseed bridge invite token"
                />
                <div className="px-action-strip">
                  <Button onClick={redeemBridgeInvite} disabled={!bridgeInvite.trim() || !!bridgeBusy}>
                    {bridgeBusy === 'redeem' ? 'Redeeming' : 'Redeem'}
                  </Button>
                  <Button variant="ghost" onClick={sendBridgeHeartbeat} disabled={!bridgeStatus?.connected || !!bridgeBusy}>
                    {bridgeBusy === 'heartbeat' ? 'Sending' : 'Heartbeat'}
                  </Button>
                  <Button variant="ghost" onClick={pollBridgeDirectives} disabled={!bridgeStatus?.connected || !!bridgeBusy}>
                    {bridgeBusy === 'poll' ? 'Polling' : 'Poll'}
                  </Button>
                  <Button variant="ghost" onClick={ackBridgeDirectives} disabled={bridgeDirectives.length === 0 || !!bridgeBusy}>
                    {bridgeBusy === 'ack' ? 'Acking' : 'Ack all'}
                  </Button>
                  <Button variant="ghost" onClick={rotateBridgeToken} disabled={!bridgeStatus?.connected || !!bridgeBusy}>
                    {bridgeBusy === 'rotate' ? 'Rotating' : 'Rotate'}
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
                label="Appearance"
                title="Operator console palette"
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
                label="OTA Updates"
                title={updateStatus?.state === 'available' && updateStatus.availableVersion
                  ? `Version ${updateStatus.availableVersion} available`
                  : updateStatus?.state === 'downloaded'
                    ? 'Update ready to install'
                    : 'Release feed'}
                note={updateStatus?.message || 'Checking signed release metadata from the configured update feed.'}
                state={updateStatus?.state === 'error' ? 'blocked' : updateStatus?.state === 'available' || updateStatus?.state === 'downloaded' ? 'warning' : 'idle'}
                active={activeSection === 'settings-release'}
                onActivate={() => focusSection('settings-release')}
                actions={<StatusChip tone={updateTone}>{updateStatus?.state ?? 'loading'}</StatusChip>}
              >
                {updateStatus && (
                  <div className="px-datum-grid px-datum-grid-tight">
                    <DatumRail label="current" value={updateStatus.currentVersion} />
                    <DatumRail label="local app" value={APP_VERSION} accent />
                    <DatumRail label="channel" value={updateStatus.channel} />
                    <DatumRail label="state" value={updateStatus.state} />
                    <DatumRail label="feed" value={updateStatus.feedUrl || 'packaged config'} compact truncateAt={44} />
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
                label="GitHub Evidence"
                title="Work proof health"
                note="New work records require a verified project repo. Activity matching runs through the coordination Worker."
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
                label="Agent Fabric"
                title="Member provisioning and local setup"
                note="The Fabric panel shows local Paperclip health; member bundle fetch runs after Cloudflare Access sign-in."
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
                    <IconCloud s={12} /> Provision member
                  </Button>
                  <Button variant="ghost" onClick={async () => {
                    const res = await window.plexus.memberSetup();
                    if (res.ok) {
                      flashSaved();
                    } else {
                      setError(res.message || 'Setup failed');
                    }
                  }}>
                    <IconPaperclip s={12} /> Run setup
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
