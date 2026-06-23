import React, { useState, useEffect } from 'react';
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
import { PageHeader, Panel, Button, Badge, StatusDot, SectionLabel, Skeleton, Toggle, Input, Field } from './ui';
import { IconCheck, IconLogOut, IconSync } from './Icons';
import { applyThemePreference, type ThemePreference } from '../themeMode';
import ProfileCard from './ProfileCard';
import { OnboardingSetupPanel } from './Onboarding';

const APP_VERSION = __APP_VERSION__;

function cleanHandle(value: string): string {
  return value.replace(/^@+/, '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 32);
}

function deriveProfile(profile: MemberProfileSettings | undefined, session: Session | null, memberId: string, connected?: boolean): Required<Pick<MemberProfileSettings, 'displayName' | 'title' | 'handle' | 'status'>> & Pick<MemberProfileSettings, 'avatarUrl'> {
  const emailHandle = session?.email?.split('@')[0];
  const fallbackName = session?.employee.displayName || memberId || 'Plexus Member';
  return {
    displayName: profile?.displayName?.trim() || fallbackName,
    title: profile?.title?.trim() || `${session?.role ?? 'member'} · ${session?.projectVisibility ?? 'workspace'}`,
    handle: cleanHandle(profile?.handle?.trim() || emailHandle || memberId || 'plexus'),
    status: profile?.status?.trim() || (connected ? 'Verified workspace' : 'Local profile'),
    avatarUrl: profile?.avatarUrl?.trim() || session?.employee.avatarUrl || undefined,
  };
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

  if (!settings) {
    return (
      <div className="px-fadein">
        <PageHeader title="Settings" sub="configuration" />
        <Panel pad><Skeleton lines={5} widths={['30%', '80%', '60%', '90%', '50%']} /></Panel>
      </div>
    );
  }

  return (
    <div className="px-fadein">
      <PageHeader
        title="Settings"
        sub="configuration"
        right={saved
          ? <Badge tone="bill"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconCheck s={11} /> Saved</span></Badge>
          : undefined}
      />

      <Panel raised pad crosshairs className="px-composed-panel">
        <div className="px-form-shell">
          <div className="px-form-band">
            <div className="px-section-head">
              <div>
                <SectionLabel>Account</SectionLabel>
                <div className="px-section-note">Cloudflare Access identity currently active in Plexus.</div>
              </div>
              <div className="px-section-actions">
                <Button variant="ghost" onClick={signOut} disabled={signingOut}>
                  <IconLogOut s={12} /> {signingOut ? 'Signing out' : 'Log out'}
                </Button>
              </div>
            </div>
            {session ? (
              <div className="px-specs">
                <div className="px-spec acc"><span className="l">member</span><span className="v compact">{session.employee.displayName}</span></div>
                <div className="px-spec"><span className="l">email</span><span className="v compact">{session.email}</span></div>
                <div className="px-spec"><span className="l">role</span><span className="v">{session.role}</span></div>
                <div className="px-spec"><span className="l">quota</span><span className="v">{session.employee.monthlyQuotaHours}h/mo</span></div>
                <div className="px-spec"><span className="l">workspace</span><span className="v compact">{session.workspaceId}</span></div>
                <div className="px-spec"><span className="l">visibility</span><span className="v">{session.projectVisibility}</span></div>
              </div>
            ) : (
              <div className="settings-note">Not signed in.</div>
            )}
          </div>

          {displayProfile && (
            <div className="px-form-band" id="plexus-profile-form">
              <div className="px-section-head">
                <div>
                  <SectionLabel>Member Profile</SectionLabel>
                  <div className="px-section-note">The profile card is local Plexus identity display; Access email remains the source of authentication.</div>
                </div>
                <div className="px-section-actions">
                  <Button onClick={saveProfile} disabled={!profileDirty}>
                    {profileDirty ? 'Save Profile' : 'Profile Saved'}
                  </Button>
                </div>
              </div>
              <div className="px-profile-settings-grid">
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
                <div className="px-profile-form">
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
                    Empty fields fall back to verified session identity. Avatar URL is optional; when empty, Plexus renders initials.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-form-band">
            <div className="px-section-head">
              <div>
                <SectionLabel>Session Proof</SectionLabel>
                <div className="px-section-note">Cloudflare Access identity, Worker reachability, and coordination session state.</div>
              </div>
              <div className="px-section-actions">
                <StatusDot active={!!status?.connected}>{status?.connected ? 'connected' : 'not connected'}</StatusDot>
                <Button variant="ghost" onClick={refreshIdentityProof}>
                  <IconSync s={12} /> Refresh proof
                </Button>
              </div>
            </div>
            {status && !status.connected && status.message && (
              <div className="px-flow-meta" style={{ color: 'var(--rose)', marginBottom: 12 }}>{status.message}</div>
            )}
            {sessionError && (
              <div className="px-flow-meta" style={{ color: 'var(--rose)', marginBottom: 12 }}>{sessionError}</div>
            )}
            <div className="px-specs">
              <div className="px-spec acc"><span className="l">auth</span><span className="v">Cloudflare Access</span></div>
              <div className="px-spec"><span className="l">endpoint</span><span className="v compact">{cfg?.baseUrl ?? 'Worker config not loaded'}</span></div>
              <div className="px-spec"><span className="l">identity</span><span className="v compact">{session?.identityId ?? 'Identity proof not loaded'}</span></div>
              <div className="px-spec"><span className="l">employee</span><span className="v compact">{session?.employeeId ?? 'No employee link returned'}</span></div>
              <div className="px-spec"><span className="l">required</span><span className="v">{requiredOnboarding}</span></div>
              <div className="px-spec"><span className="l">onboarding</span><span className="v">{fullOnboarding}</span></div>
            </div>
          </div>

          {session && (
            <OnboardingSetupPanel
              session={session}
              onSessionChange={setSession}
              onOpenFlow={() => window.dispatchEvent(new Event('plexus:open-onboarding-flow'))}
            />
          )}

          <div className="px-settings-card px-bridge-settings-card">
            <div>
              <div className="px-lbl">Thoughtseed Bridge</div>
              <div className="settings-title">
                {bridgeStatus?.connected ? `Cambium connected as ${bridgeStatus.memberId}` : 'Cambium bridge not connected'}
              </div>
              <div className="settings-note">
                Member-scoped bridge credentials stay in secure storage; Plexus never stores the Worker admin token.
              </div>
              <div className="px-specs" style={{ marginTop: 14 }}>
                <div className="px-spec acc"><span className="l">state</span><span className="v">{bridgeStatus?.connected ? 'connected' : 'closed'}</span></div>
                <div className="px-spec"><span className="l">tenant</span><span className="v">{bridgeStatus?.tenantId ?? 'cambium'}</span></div>
                <div className="px-spec"><span className="l">member</span><span className="v compact">{bridgeStatus?.memberId || 'not redeemed'}</span></div>
                <div className="px-spec"><span className="l">expires</span><span className="v compact">{bridgeStatus?.tokenExpiresAt ?? 'not set'}</span></div>
                <div className="px-spec"><span className="l">last seen</span><span className="v compact">{bridgeStatus?.lastSeenAt ?? 'not sent'}</span></div>
                <div className="px-spec"><span className="l">endpoint</span><span className="v compact">{bridgeStatus?.bridgeApiUrl ?? 'https://curious.thoughtseed.space'}</span></div>
              </div>
              {bridgeStatus?.lastError && <div className="px-flow-meta" style={{ color: 'var(--rose)', marginTop: 10 }}>{bridgeStatus.lastError}</div>}
              {bridgeMessage && <div className="px-flow-meta" style={{ marginTop: 10 }}>{bridgeMessage}</div>}
              {bridgeDirectives.length > 0 && (
                <div className="px-flow-meta" style={{ marginTop: 10 }}>
                  {bridgeDirectives.map((directive) => (
                    <div key={directive.id}>{directive.id}: {JSON.stringify(directive.payload).slice(0, 120)}</div>
                  ))}
                </div>
              )}
              {bridgePollCheckedAt && bridgeDirectives.length === 0 && (
                <div className="px-flow-meta" style={{ marginTop: 10 }}>
                  No directives pending. Last checked {new Date(bridgePollCheckedAt).toLocaleTimeString()}.
                </div>
              )}
            </div>
            <div className="settings-actions px-bridge-actions">
              <Input
                value={bridgeInvite}
                onChange={(event) => setBridgeInvite(event.target.value)}
                placeholder="Paste member invite token"
                aria-label="Thoughtseed bridge invite token"
              />
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
                {bridgeBusy === 'ack' ? 'Acking' : 'Ack All'}
              </Button>
              <Button variant="ghost" onClick={rotateBridgeToken} disabled={!bridgeStatus?.connected || !!bridgeBusy}>
                {bridgeBusy === 'rotate' ? 'Rotating' : 'Rotate'}
              </Button>
              <Button variant="ghost" onClick={disconnectBridge} disabled={!bridgeStatus?.configured || !!bridgeBusy}>
                Disconnect
              </Button>
            </div>
          </div>

          <div className="px-settings-card">
            <div>
              <div className="px-lbl">Appearance</div>
              <div className="settings-title">Operator console palette</div>
              <div className="settings-note">
                Current render: {effectiveTheme}. Save locks the preference; System follows macOS.
              </div>
            </div>
            <div className="settings-actions">
              <Toggle<ThemePreference> value={themeDraft} onChange={previewTheme} options={[
                { key: 'dark', label: 'dark' },
                { key: 'light', label: 'light' },
                { key: 'system', label: 'system' },
              ]} />
              <Button onClick={saveAppearance} disabled={!appearanceDirty}>
                {appearanceDirty ? 'Save Appearance' : 'Saved'}
              </Button>
            </div>
          </div>

          <div className="px-settings-card">
            <div>
              <div className="px-lbl">OTA Updates</div>
              <div className="settings-title">
                {updateStatus?.state === 'available' && updateStatus.availableVersion
                  ? `Version ${updateStatus.availableVersion} available`
                  : updateStatus?.state === 'downloaded'
                    ? 'Update ready to install'
                    : 'Release feed'}
              </div>
              <div className="settings-note">
                {updateStatus?.message || 'Checking signed release metadata from the configured update feed.'}
              </div>
              {updateStatus && (
                <div className="px-specs" style={{ marginTop: 14 }}>
                  <div className="px-spec"><span className="l">current</span><span className="v">{updateStatus.currentVersion}</span></div>
                  <div className="px-spec acc"><span className="l">local app</span><span className="v">{APP_VERSION}</span></div>
                  <div className="px-spec"><span className="l">channel</span><span className="v">{updateStatus.channel}</span></div>
                  <div className="px-spec"><span className="l">state</span><span className="v">{updateStatus.state}</span></div>
                  <div className="px-spec"><span className="l">feed</span><span className="v compact">{updateStatus.feedUrl || 'packaged config'}</span></div>
                </div>
              )}
              {updateStatus?.state === 'downloading' && (
                <div className="px-update-meter" aria-label="Update download progress">
                  <span style={{ width: `${Math.max(0, Math.min(100, updateStatus.percent ?? 0))}%` }} />
                </div>
              )}
              {updateStatus?.error && <div className="px-flow-meta" style={{ color: 'var(--rose)', marginTop: 10 }}>{updateStatus.error}</div>}
            </div>
            <div className="settings-actions">
              <StatusDot active={!!updateStatus && updateStatus.state !== 'disabled' && updateStatus.state !== 'error'}>
                {updateStatus?.state ?? 'loading'}
              </StatusDot>
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
                Install + Restart
              </Button>
            </div>
          </div>

          <div className="px-settings-card">
            <div>
              <div className="px-lbl">GitHub Evidence</div>
              <div className="settings-title">Work proof health</div>
              <div className="settings-note">
                New work records require a verified project repo. Activity matching runs through the coordination Worker, not local device secrets.
              </div>
              <div className="px-specs" style={{ marginTop: 14 }}>
                <div className="px-spec acc"><span className="l">entries today</span><span className="v">{evidence?.totalEntries ?? '—'}</span></div>
                <div className="px-spec"><span className="l">matched</span><span className="v">{evidence?.evidencedEntries ?? '—'}</span></div>
                <div className="px-spec"><span className="l">missing proof</span><span className="v">{evidence?.missingEvidenceEntries ?? '—'}</span></div>
                <div className="px-spec"><span className="l">legacy</span><span className="v">{evidence?.legacyUnverifiedEntries ?? '—'}</span></div>
              </div>
            </div>
            <div className="settings-actions">
              <Button variant="ghost" onClick={async () => {
                const today = new Date().toISOString().slice(0, 10);
                setEvidence(await window.plexus.evidenceStatus(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`));
              }}>
                <IconSync s={12} /> Refresh Proof
              </Button>
            </div>
          </div>

          <div className="px-settings-card">
            <div>
              <div className="px-lbl">Sound + Breakwork</div>
              <div className="settings-title">Biorhythmic work reminders</div>
              <div className="settings-note">
                Voice breakwork is optional. ElevenLabs audio generation is Worker-side; Plexus stores no ElevenLabs keys.
              </div>
              <div className="px-specs" style={{ marginTop: 14 }}>
                <div className="px-spec"><span className="l">sounds</span><span className="v">{settings.soundNotificationsEnabled ? 'on' : 'muted'}</span></div>
                <div className="px-spec"><span className="l">voice</span><span className="v">{settings.voiceBreakworkEnabled ? 'on' : 'off'}</span></div>
                <div className="px-spec"><span className="l">volume</span><span className="v">{settings.notificationVolume}%</span></div>
                <div className="px-spec"><span className="l">snooze</span><span className="v">{settings.breakworkSnoozeMinutes}m</span></div>
                <div className="px-spec"><span className="l">quiet start</span><span className="v">{settings.quietHoursStart}</span></div>
                <div className="px-spec"><span className="l">quiet end</span><span className="v">{settings.quietHoursEnd}</span></div>
              </div>
            </div>
            <div className="settings-actions">
              <Toggle<'on' | 'off'> value={settings.soundNotificationsEnabled ? 'on' : 'off'} onChange={v => void updateLocalSettings({ soundNotificationsEnabled: v === 'on' })} options={[{ key: 'on', label: 'sound on' }, { key: 'off', label: 'muted' }]} />
              <Toggle<'voice' | 'text'> value={settings.voiceBreakworkEnabled ? 'voice' : 'text'} onChange={v => void updateLocalSettings({ voiceBreakworkEnabled: v === 'voice' })} options={[{ key: 'voice', label: 'voice' }, { key: 'text', label: 'text only' }]} />
              <Input type="range" min="0" max="100" value={settings.notificationVolume} onChange={e => void updateLocalSettings({ notificationVolume: Number(e.target.value) })} />
            </div>
          </div>

          <div className="px-settings-card">
            <div>
              <div className="px-lbl">Private Rhythm</div>
              <div className="settings-title">{settings.rhythmProfile.enabled ? 'Biorhythmic clock enabled' : 'Biorhythmic clock paused'}</div>
              <div className="settings-note">
                Birthdate is private local setup data for breakwork timing. It is not sent to member preferences, CEO reports, or monthly appraisal summaries.
              </div>
              <div className="px-specs" style={{ marginTop: 14 }}>
                <div className="px-spec acc"><span className="l">birthdate</span><span className="v">{settings.rhythmProfile.birthdate ?? 'not set'}</span></div>
                <div className="px-spec"><span className="l">consent</span><span className="v">{settings.rhythmProfile.privateConsentAt ? 'recorded' : 'not recorded'}</span></div>
              </div>
            </div>
            <div className="settings-actions">
              <Button variant="ghost" onClick={() => void updateLocalSettings({ rhythmProfile: { ...settings.rhythmProfile, enabled: !settings.rhythmProfile.enabled, updatedAt: new Date().toISOString() } })}>
                {settings.rhythmProfile.enabled ? 'Pause Rhythm' : 'Enable Rhythm'}
              </Button>
              <Button variant="ghost" onClick={() => void updateLocalSettings({ rhythmProfile: { enabled: false, privateConsentAt: null, updatedAt: new Date().toISOString() } })}>
                Delete Rhythm Data
              </Button>
            </div>
          </div>

          <div className="px-settings-card">
            <div>
              <div className="px-lbl">Agent Fabric</div>
              <div className="settings-title">Member provisioning and local setup</div>
              <div className="settings-note">
                The Fabric panel shows local Paperclip health; member bundle fetch runs after Cloudflare Access sign-in.
              </div>
              {error && <div className="px-flow-meta" style={{ color: 'var(--rose)' }}>{error}</div>}
            </div>
            <div className="settings-actions">
              <Button variant="ghost" onClick={async () => {
                const res = await window.plexus.memberProvision();
                if (res.ok) {
                  setSaved(true); setTimeout(() => setSaved(false), 2000);
                } else {
                  setError(res.message || 'Provision failed');
                }
              }}>
                Provision Member
              </Button>
              <Button variant="ghost" onClick={async () => {
                const res = await window.plexus.memberSetup();
                if (res.ok) {
                  setSaved(true); setTimeout(() => setSaved(false), 2000);
                } else {
                  setError(res.message || 'Setup failed');
                }
              }}>
                Run Setup
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
