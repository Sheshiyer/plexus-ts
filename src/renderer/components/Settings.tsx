import React, { useState, useEffect } from 'react';
import type { PlexusSettings, Session, UpdateStatus, WorkerConfig } from '../../shared/types';
import { PageHeader, Panel, Button, Badge, StatusDot, SectionLabel, Skeleton, Toggle } from './ui';
import { IconCheck, IconSync } from './Icons';
import { applyThemePreference, type ThemePreference } from '../themeMode';

export default function Settings() {
  const [settings, setSettings] = useState<PlexusSettings | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [cfg, setCfg] = useState<WorkerConfig | null>(null);
  const [status, setStatus] = useState<{ connected: boolean; message?: string } | null>(null);
  const [themeDraft, setThemeDraft] = useState<ThemePreference>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateBusy, setUpdateBusy] = useState('');
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    window.plexus.settingsGet().then((next) => {
      setSettings(next);
      setThemeDraft(next.theme);
      setEffectiveTheme(applyThemePreference(next.theme));
    });
    window.plexus.authSession().then(setSession);
    window.plexus.workerConfigGet().then(setCfg);
    window.plexus.workerStatus().then(setStatus);
    window.plexus.updatesGetStatus().then(setUpdateStatus);
    return window.plexus.onUpdatesStatus(setUpdateStatus);
  }, []);

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
    await window.plexus.authLogout();
    window.location.reload();
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

  const requiredOnboarding = session?.onboarding.requiredComplete ? 'complete' : 'open';
  const fullOnboarding = session?.onboarding.completed ? 'complete' : 'open';

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
                <Button variant="ghost" onClick={signOut}>Sign out</Button>
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

          <div className="px-form-band">
            <div className="px-section-head">
              <div>
                <SectionLabel>Session Proof</SectionLabel>
                <div className="px-section-note">Cloudflare Access identity, Worker reachability, and TeamForge session state.</div>
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
              <div className="px-spec"><span className="l">endpoint</span><span className="v compact">{cfg?.baseUrl ?? 'default'}</span></div>
              <div className="px-spec"><span className="l">identity</span><span className="v compact">{session?.identityId ?? 'pending'}</span></div>
              <div className="px-spec"><span className="l">employee</span><span className="v compact">{session?.employeeId ?? 'unlinked'}</span></div>
              <div className="px-spec"><span className="l">required</span><span className="v">{requiredOnboarding}</span></div>
              <div className="px-spec"><span className="l">onboarding</span><span className="v">{fullOnboarding}</span></div>
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
                onClick={() => runUpdateAction('install', window.plexus.updatesInstall)}
                disabled={!updateStatus?.canInstall || !!updateBusy}
              >
                Install + Restart
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
