import React, { useEffect, useState } from 'react';
import type {
  MemberProfileSettings,
  PlexusSettings,
  Session,
  ThoughtseedBridgeDirective,
  ThoughtseedBridgeStatus,
  UpdateStatus,
  WorkerConfig,
  WorkEvidenceSummary,
} from '../../shared/types';
import { PageHeader, Button, Crosshairs, StatusDot, SectionLabel, Skeleton, Toggle, Input, Field } from './ui';
import {
  IconCheck,
  IconClock,
  IconCloud,
  IconLogOut,
  IconPaperclip,
  IconSync,
  IconTrash,
} from './Icons';
import { applyThemePreference, type ThemePreference } from '../themeMode';
import ProfileCard from './ProfileCard';
import { OnboardingSetupPanel } from './Onboarding';
import { InstrumentPanel } from './PlexusUI';

const APP_VERSION = __APP_VERSION__;

type SettingsState = 'verified' | 'editable' | 'warning' | 'blocked' | 'idle';
type ChipTone = 'accent' | 'mint' | 'warning' | 'error' | 'idle';

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
}

function cleanHandle(value: string): string {
  return value.replace(/^@+/, '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 32);
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

function deriveProfile(profile: MemberProfileSettings | undefined, session: Session | null, memberId: string, connected?: boolean): Required<Pick<MemberProfileSettings, 'displayName' | 'title' | 'handle' | 'status'>> & Pick<MemberProfileSettings, 'avatarUrl'> {
  const emailHandle = session?.email?.split('@')[0];
  const fallbackName = session?.employee.displayName || memberId || 'Plexus Member';
  return {
    displayName: profile?.displayName?.trim() || fallbackName,
    title: profile?.title?.trim() || `${session?.role ?? 'member'} / ${session?.projectVisibility ?? 'workspace'}`,
    handle: cleanHandle(profile?.handle?.trim() || emailHandle || memberId || 'plexus'),
    status: profile?.status?.trim() || (connected ? 'Verified workspace' : 'Local profile'),
    avatarUrl: profile?.avatarUrl?.trim() || session?.employee.avatarUrl || undefined,
  };
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

function SettingsSection({ id, label, title, note, state = 'idle', actions, children, className = '' }: SettingsSectionProps) {
  return (
    <section id={id} className={`px-settings-section state-${state} ${className}`}>
      <div className="px-settings-section-head">
        <div className="px-settings-section-copy">
          <SectionLabel>{label}</SectionLabel>
          {title && <div className="settings-title">{title}</div>}
          {note && <div className="settings-note">{note}</div>}
        </div>
        {actions && <div className="px-section-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function CalibrationRail({ items }: { items: { index: string; label: string; state: string; tone: ChipTone; href: string }[] }) {
  return (
    <nav className="px-settings-rail" aria-label="Settings calibration sections">
      <div className="px-settings-rail-head">
        <span className="px-dot pulse" />
        <span>Field calibration</span>
      </div>
      <div className="px-settings-rail-list">
        {items.map((item) => (
          <a key={item.href} href={item.href} className={`px-settings-rail-item tone-${item.tone}`}>
            <span>{item.index}</span>
            <strong>{item.label}</strong>
            <small>{item.state}</small>
          </a>
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
  const [profileDraft, setProfileDraft] = useState<MemberProfileSettings>({});
  const [profileDirty, setProfileDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    window.plexus.settingsGet().then((next) => {
      setSettings(next);
      setProfileDraft(next.profile ?? {});
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
    if (!settings || profileDirty) return;
    setProfileDraft(settings.profile ?? {});
  }, [settings, session, status?.connected, profileDirty]);

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

  const updateLocalSettings = async (patch: Partial<PlexusSettings>) => {
    const next = await window.plexus.settingsSet(patch);
    setSettings(next);
    flashSaved();
  };

  const updateProfileDraft = (patch: Partial<MemberProfileSettings>) => {
    setProfileDraft((current) => ({ ...current, ...patch }));
    setProfileDirty(true);
  };

  const saveProfile = async () => {
    if (!settings) return;
    const resolved = deriveProfile(profileDraft, session, settings.memberId, status?.connected);
    const nextProfile: MemberProfileSettings = {
      displayName: resolved.displayName,
      title: resolved.title,
      handle: resolved.handle,
      status: resolved.status,
      avatarUrl: resolved.avatarUrl,
      updatedAt: new Date().toISOString(),
    };
    const next = await window.plexus.settingsSet({ profile: nextProfile });
    setSettings(next);
    setProfileDraft(next.profile);
    setProfileDirty(false);
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
  const displayProfile = settings ? deriveProfile(profileDraft, session, settings.memberId, status?.connected) : null;
  const bridgeTone = chipToneForBridge(bridgeStatus);
  const updateTone = chipToneForUpdate(updateStatus);

  if (!settings) {
    return (
      <div className="px-fadein px-settings-page">
        <PageHeader title="Settings" sub="field calibration" />
        <InstrumentPanel label="loading settings" title="Reading local configuration">
          <Skeleton lines={5} widths={['30%', '80%', '60%', '90%', '50%']} />
        </InstrumentPanel>
      </div>
    );
  }

  const calibrationItems = [
    { index: '01', label: 'identity', state: session ? 'verified' : 'open', tone: session ? 'accent' : 'idle' as ChipTone, href: '#settings-identity' },
    { index: '02', label: 'profile', state: profileDirty ? 'dirty' : 'saved', tone: profileDirty ? 'warning' : 'accent' as ChipTone, href: '#settings-profile' },
    { index: '03', label: 'proof', state: status?.connected ? 'online' : 'check', tone: status?.connected ? 'accent' : 'warning' as ChipTone, href: '#settings-proof' },
    { index: '04', label: 'setup', state: requiredOnboarding, tone: requiredOnboarding === 'complete' ? 'accent' : 'warning' as ChipTone, href: '#settings-setup' },
    { index: '05', label: 'bridge', state: bridgeStatus?.connected ? 'connected' : 'closed', tone: bridgeTone, href: '#settings-bridge' },
    { index: '06', label: 'rhythm', state: settings.rhythmProfile.enabled ? 'enabled' : 'paused', tone: settings.rhythmProfile.enabled ? 'accent' : 'idle' as ChipTone, href: '#settings-rhythm' },
    { index: '07', label: 'release', state: updateStatus?.state ?? 'loading', tone: updateTone, href: '#settings-release' },
    { index: '08', label: 'fabric', state: error ? 'blocked' : 'ready', tone: error ? 'error' : 'mint' as ChipTone, href: '#settings-fabric' },
  ];

  return (
    <div className="px-fadein px-settings-page">
      <PageHeader
        title="Settings"
        sub="field calibration"
        right={saved
          ? <StatusChip tone="accent"><IconCheck s={11} /> Saved</StatusChip>
          : undefined}
      />

      <section className="px-panel raised px-composed-panel px-settings-shell-panel">
        <Crosshairs />
        <div className="px-settings-workbench">
          <CalibrationRail items={calibrationItems} />

          <div className="px-settings-content">
            <SettingsSection
              id="settings-identity"
              label="Identity Credential"
              title="Verified workspace identity"
              note="Cloudflare Access remains the source of authentication; Plexus keeps local calibration separate from identity proof."
              state={session ? 'verified' : 'idle'}
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

            {displayProfile && (
              <SettingsSection
                id="settings-profile"
                label="Member Profile"
                title="Local member credential"
                note="Profile display is local to Plexus. Empty fields fall back to the verified session identity."
                state={profileDirty ? 'editable' : 'verified'}
                actions={(
                  <>
                    <StatusChip tone={profileDirty ? 'warning' : 'accent'}>{profileDirty ? 'dirty' : 'saved'}</StatusChip>
                    <Button onClick={saveProfile} disabled={!profileDirty}>
                      {profileDirty ? 'Save profile' : 'Profile saved'}
                    </Button>
                  </>
                )}
              >
                <div className="px-member-profile-editor">
                  <ProfileCard
                    name={displayProfile.displayName}
                    title={displayProfile.title}
                    handle={displayProfile.handle}
                    status={displayProfile.status}
                    avatarUrl={displayProfile.avatarUrl}
                    contactText="Edit"
                    enableTilt
                    behindGlowEnabled
                    onContactClick={() => document.getElementById('plexus-profile-form')?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                  />
                  <div className="px-profile-form" id="plexus-profile-form">
                    <Field label="display name">
                      <Input
                        value={profileDraft.displayName ?? ''}
                        onChange={(event) => updateProfileDraft({ displayName: event.target.value })}
                        aria-label="Profile display name"
                      />
                    </Field>
                    <Field label="handle">
                      <Input
                        value={profileDraft.handle ?? ''}
                        onChange={(event) => updateProfileDraft({ handle: cleanHandle(event.target.value) })}
                        aria-label="Profile handle"
                      />
                    </Field>
                    <Field label="title">
                      <Input
                        value={profileDraft.title ?? ''}
                        onChange={(event) => updateProfileDraft({ title: event.target.value })}
                        aria-label="Profile title"
                      />
                    </Field>
                    <Field label="status">
                      <Input
                        value={profileDraft.status ?? ''}
                        onChange={(event) => updateProfileDraft({ status: event.target.value })}
                        aria-label="Profile status"
                      />
                    </Field>
                    <Field label="avatar image URL" className="wide">
                      <Input
                        value={profileDraft.avatarUrl ?? ''}
                        onChange={(event) => updateProfileDraft({ avatarUrl: event.target.value })}
                        aria-label="Profile avatar image URL"
                      />
                    </Field>
                    <div className="settings-note wide">
                      Avatar URL is optional. Long names, handles, and URLs are contained by the credential frame.
                    </div>
                  </div>
                </div>
              </SettingsSection>
            )}

            <SettingsSection
              id="settings-proof"
              label="Session Proof"
              title="Access, worker, and onboarding contract"
              note="Proof state is refreshed from Cloudflare Access and the coordination Worker."
              state={status?.connected ? 'verified' : 'warning'}
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

            {session && (
              <div id="settings-setup" className="px-settings-onboarding-wrap">
                <OnboardingSetupPanel
                  session={session}
                  onSessionChange={setSession}
                  onOpenFlow={() => window.dispatchEvent(new Event('plexus:open-onboarding-flow'))}
                />
              </div>
            )}

            <SettingsSection
              id="settings-bridge"
              label="Thoughtseed Bridge"
              title={bridgeStatus?.connected ? `Cambium connected as ${bridgeStatus.memberId}` : 'Cambium bridge not connected'}
              note="Member-scoped bridge credentials stay in secure storage; Plexus never stores the Worker admin token."
              state={bridgeStatus?.lastError ? 'blocked' : bridgeStatus?.connected ? 'verified' : 'idle'}
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
                id="settings-sound"
                label="Sound + Breakwork"
                title="Biorhythmic work reminders"
                note="Voice breakwork is optional. ElevenLabs audio generation is Worker-side; Plexus stores no ElevenLabs keys."
                state={settings.soundNotificationsEnabled ? 'verified' : 'idle'}
              >
                <div className="px-datum-grid px-datum-grid-tight">
                  <DatumRail label="sounds" value={settings.soundNotificationsEnabled ? 'on' : 'muted'} />
                  <DatumRail label="voice" value={settings.voiceBreakworkEnabled ? 'on' : 'off'} />
                  <DatumRail label="volume" value={`${settings.notificationVolume}%`} accent />
                  <DatumRail label="snooze" value={`${settings.breakworkSnoozeMinutes}m`} />
                  <DatumRail label="quiet start" value={settings.quietHoursStart ?? '18:00'} />
                  <DatumRail label="quiet end" value={settings.quietHoursEnd ?? '09:00'} />
                </div>
                <div className="px-settings-control-row">
                  <Toggle<'on' | 'off'> value={settings.soundNotificationsEnabled ? 'on' : 'off'} onChange={v => void updateLocalSettings({ soundNotificationsEnabled: v === 'on' })} options={[{ key: 'on', label: 'sound on' }, { key: 'off', label: 'muted' }]} />
                  <Toggle<'voice' | 'text'> value={settings.voiceBreakworkEnabled ? 'voice' : 'text'} onChange={v => void updateLocalSettings({ voiceBreakworkEnabled: v === 'voice' })} options={[{ key: 'voice', label: 'voice' }, { key: 'text', label: 'text only' }]} />
                  <Input className="px-settings-range" type="range" min="0" max="100" value={settings.notificationVolume} onChange={e => void updateLocalSettings({ notificationVolume: Number(e.target.value) })} />
                </div>
              </SettingsSection>
            </div>

            <div className="px-settings-module-grid">
              <SettingsSection
                id="settings-rhythm"
                label="Private Rhythm"
                title={settings.rhythmProfile.enabled ? 'Biorhythmic clock enabled' : 'Biorhythmic clock paused'}
                note="Birthdate is private local setup data for breakwork timing. It is not sent to preferences, CEO reports, or appraisal summaries."
                state={settings.rhythmProfile.enabled ? 'verified' : 'idle'}
                actions={<StatusChip tone={settings.rhythmProfile.enabled ? 'accent' : 'idle'}>{settings.rhythmProfile.enabled ? 'enabled' : 'paused'}</StatusChip>}
              >
                <div className="px-datum-grid px-datum-grid-tight">
                  <DatumRail label="birthdate" value={settings.rhythmProfile.birthdate ?? 'not set'} accent />
                  <DatumRail label="consent" value={settings.rhythmProfile.privateConsentAt ? 'recorded' : 'not recorded'} />
                </div>
                <div className="px-action-strip">
                  <Button variant="ghost" onClick={() => void updateLocalSettings({ rhythmProfile: { ...settings.rhythmProfile, enabled: !settings.rhythmProfile.enabled, updatedAt: new Date().toISOString() } })}>
                    <IconClock s={12} /> {settings.rhythmProfile.enabled ? 'Pause rhythm' : 'Enable rhythm'}
                  </Button>
                  <Button variant="stop" onClick={() => void updateLocalSettings({ rhythmProfile: { enabled: false, privateConsentAt: null, updatedAt: new Date().toISOString() } })}>
                    <IconTrash s={12} /> Delete rhythm data
                  </Button>
                </div>
              </SettingsSection>

              <SettingsSection
                id="settings-fabric"
                label="Agent Fabric"
                title="Member provisioning and local setup"
                note="The Fabric panel shows local Paperclip health; member bundle fetch runs after Cloudflare Access sign-in."
                state={error ? 'blocked' : 'idle'}
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

            <SettingsSection
              label="Overflow Lab"
              title="Long values stay contained"
              note="Every rail keeps its full value available while rendering compactly inside the Settings frame."
              state="idle"
              className="px-overflow-lab"
            >
              <div className="px-datum-grid px-datum-grid-tight">
                <DatumRail label="long email" value={session?.email ?? 'thoughtseedlabs@gmail.com'} compact truncateAt={28} />
                <DatumRail label="long endpoint" value={bridgeStatus?.bridgeApiUrl ?? cfg?.baseUrl ?? 'https://curious.thoughtseed.space/api/member/bridge/directives'} compact truncateAt={44} />
                <DatumRail label="long identity id" value={session?.identityId ?? 'cf-access-identity-thoughtseed-labs-admin-prod-2026-06-24'} compact truncateAt={42} />
                <DatumRail label="invite token" value={bridgeInvite || 'px_invite_3F9A2C7E9B1D...redacted'} compact truncateAt={36} />
                <DatumRail label="directive payload" value={'{"type":"member.sync","project":"workspace-calibration","payload":...}'} wrap />
              </div>
            </SettingsSection>
          </div>
        </div>
      </section>
    </div>
  );
}
