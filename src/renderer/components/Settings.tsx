import React, { useState, useEffect } from 'react';
import type { PlexusSettings, Session, WorkerConfig } from '../../shared/types';
import { PageHeader, Panel, Field, Input, Select, Button, Badge, StatusDot, SectionLabel, Skeleton } from './ui';
import { IconCheck, IconSync } from './Icons';

export default function Settings() {
  const [settings, setSettings] = useState<PlexusSettings | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [cfg, setCfg] = useState<WorkerConfig | null>(null);
  const [status, setStatus] = useState<{ connected: boolean; message?: string } | null>(null);
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.plexus.settingsGet().then(setSettings);
    window.plexus.authSession().then(setSession);
    window.plexus.workerConfigGet().then(setCfg);
    window.plexus.workerStatus().then(setStatus);
  }, []);

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const update = (patch: Partial<PlexusSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...patch });
    window.plexus.settingsSet(patch).then(flashSaved);
  };

  const saveConn = async (patch: { baseUrl?: string; workspaceId?: string; token?: string }) => {
    const next = await window.plexus.workerConfigSet(patch);
    setCfg(next);
    setToken('');
    setStatus(await window.plexus.workerStatus());
    flashSaved();
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

      <Panel pad crosshairs>
        <SectionLabel>Account</SectionLabel>
        <div style={{ marginTop: 12 }}>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="desc" style={{ fontSize: 14 }}>{session.employee.displayName}</div>
                <div className="meta">{session.email} · quota {session.employee.monthlyQuotaHours}h/mo</div>
              </div>
              <Button variant="ghost" onClick={signOut}>Sign out</Button>
            </div>
          ) : (
            <div className="meta">Not signed in.</div>
          )}
        </div>

        <div className="px-divider" />

        <SectionLabel>TeamForge Connection</SectionLabel>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusDot active={!!status?.connected}>{status?.connected ? 'connected' : 'not connected'}</StatusDot>
            {status && !status.connected && status.message && (
              <span className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>{status.message}</span>
            )}
            <Button variant="ghost" style={{ marginLeft: 'auto', padding: '7px 12px' }} onClick={async () => setStatus(await window.plexus.workerStatus())}>
              <IconSync s={12} /> Test
            </Button>
          </div>
          <Field label="Worker URL">
            <Input
              value={cfg?.baseUrl ?? ''}
              onChange={e => setCfg(cfg ? { ...cfg, baseUrl: e.target.value } : cfg)}
              onBlur={e => saveConn({ baseUrl: e.target.value })}
              placeholder="https://teamforge-api…workers.dev"
            />
          </Field>
          <Field label="Workspace ID (optional)">
            <Input
              value={cfg?.workspaceId ?? ''}
              onChange={e => setCfg(cfg ? { ...cfg, workspaceId: e.target.value } : cfg)}
              onBlur={e => saveConn({ workspaceId: e.target.value })}
              placeholder="leave blank for all"
            />
          </Field>
          <Field label={cfg?.hasToken ? 'Token (set — paste to replace)' : 'Token'}>
            <Input
              type="password" value={token} onChange={e => setToken(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && token) saveConn({ token }); }}
              placeholder="app bearer token"
            />
          </Field>
          <div>
            <Button variant="ghost" onClick={() => token && saveConn({ token })} disabled={!token}>Save token</Button>
          </div>
          <p className="px-lbl" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--t4)', lineHeight: 1.6 }}>
            Token is encrypted in the OS keychain (safeStorage), never written to disk in plaintext. Replaced by Cloudflare Access sign-in in a later release.
          </p>
        </div>

        <div className="px-divider" />

        <SectionLabel>Appearance</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <Field label="Theme">
            <Select value={settings.theme} onChange={e => update({ theme: e.target.value as any })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </Select>
          </Field>
        </div>

        <div className="px-divider" />

        <SectionLabel>Agent Fabric</SectionLabel>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="px-lbl" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--t4)', lineHeight: 1.6 }}>
            The Agent Fabric panel shows the health of your local Paperclip agents.
            After signing in with Cloudflare Access, your member bundle is fetched automatically.
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
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
      </Panel>
    </div>
  );
}
