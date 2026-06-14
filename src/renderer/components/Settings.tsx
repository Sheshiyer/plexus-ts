import React, { useState, useEffect } from 'react';
import type { PlexusSettings, Session, UpdateStatus, WorkerConfig } from '../../shared/types';
import { PageHeader, Panel, Field, Input, Button, Badge, StatusDot, SectionLabel, Skeleton, Toggle } from './ui';
import { IconCheck, IconSync } from './Icons';
import { applyThemePreference, type ThemePreference } from '../themeMode';

export default function Settings() {
  const [settings, setSettings] = useState<PlexusSettings | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [cfg, setCfg] = useState<WorkerConfig | null>(null);
  const [status, setStatus] = useState<{ connected: boolean; message?: string } | null>(null);
  const [token, setToken] = useState('');
  const [themeDraft, setThemeDraft] = useState<ThemePreference>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateBusy, setUpdateBusy] = useState('');
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [connectionDirty, setConnectionDirty] = useState(false);
  const [saved, setSaved] = useState(false);
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

  const updateConnectionDraft = (patch: Partial<WorkerConfig>) => {
    setCfg((current) => (current ? { ...current, ...patch } : current));
    setConnectionDirty(true);
  };

  const saveConn = async (patch: { baseUrl?: string; workspaceId?: string; token?: string }) => {
    const next = await window.plexus.workerConfigSet(patch);
    setCfg(next);
    setToken('');
    setStatus(await window.plexus.workerStatus());
    flashSaved();
  };

  const saveConnection = async () => {
    if (!cfg) return;
    await saveConn({ baseUrl: cfg.baseUrl, workspaceId: cfg.workspaceId });
    setConnectionDirty(false);
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
                <div className="px-spec"><span className="l">quota</span><span className="v">{session.employee.monthlyQuotaHours}h/mo</span></div>
              </div>
            ) : (
              <div className="settings-note">Not signed in.</div>
            )}
          </div>

          <div className="px-form-band">
            <div className="px-section-head">
              <div>
                <SectionLabel>TeamForge Connection</SectionLabel>
                <div className="px-section-note">Cloudflare Access remains primary; this stores the Worker target and optional workspace scope.</div>
              </div>
              <div className="px-section-actions">
                <StatusDot active={!!status?.connected}>{status?.connected ? 'connected' : 'not connected'}</StatusDot>
                <Button variant="ghost" onClick={async () => setStatus(await window.plexus.workerStatus())}>
                  <IconSync s={12} /> Test
                </Button>
                <Button variant="accent" onClick={saveConnection} disabled={!connectionDirty || !cfg}>
                  {connectionDirty ? 'Save Connection' : 'Saved'}
                </Button>
              </div>
            </div>
            {status && !status.connected && status.message && (
              <div className="px-flow-meta" style={{ color: 'var(--rose)', marginBottom: 12 }}>{status.message}</div>
            )}
            <div className="px-form-grid">
              <Field label="Worker URL">
                <Input
                  value={cfg?.baseUrl ?? ''}
                  onChange={e => updateConnectionDraft({ baseUrl: e.target.value })}
                  placeholder="https://teamforge-api...workers.dev"
                />
              </Field>
              <Field label="Workspace ID (optional)">
                <Input
                  value={cfg?.workspaceId ?? ''}
                  onChange={e => updateConnectionDraft({ workspaceId: e.target.value })}
                  placeholder="leave blank for all"
                />
              </Field>
            </div>
            <div className="px-settings-card" style={{ marginTop: 14 }}>
              <div>
                <div className="px-lbl">{cfg?.hasToken ? 'Token set' : 'Token optional'}</div>
                <div className="settings-title">Legacy app bearer token</div>
                <div className="settings-note">Encrypted in the OS keychain and never written to disk in plaintext.</div>
              </div>
              <div className="settings-actions">
                <Input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && token) saveConn({ token }); }}
                  placeholder="paste to replace"
                  style={{ minWidth: 220 }}
                />
                <Button variant="ghost" onClick={() => token && saveConn({ token })} disabled={!token}>Save token</Button>
              </div>
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
