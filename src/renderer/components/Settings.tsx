import React, { useState, useEffect } from 'react';
import type { PlexusSettings } from '../../shared/types';

export default function Settings() {
  const [settings, setSettings] = useState<PlexusSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.plexus.settingsGet().then(setSettings);
  }, []);

  const update = (patch: Partial<PlexusSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    window.plexus.settingsSet(patch).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const updateBridge = (patch: Partial<PlexusSettings['bridge']>) => {
    if (!settings) return;
    update({ bridge: { ...settings.bridge, ...patch } });
  };

  if (!settings) return <div style={{ color: '#8b949e', padding: 32 }}>Loading...</div>;

  const sectionStyle = {
    background: '#161920',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #252a33',
    marginBottom: 16,
  };

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#8b949e',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #30363d',
    background: '#0f1115',
    color: '#c9d1d9',
    fontSize: 14,
    marginBottom: 12,
    outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700 }}>Settings</h2>
        {saved && <span style={{ color: '#3fb950', fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Identity</h3>
        <label style={labelStyle}>Member ID</label>
        <input
          style={inputStyle}
          value={settings.memberId}
          onChange={e => update({ memberId: e.target.value })}
          placeholder="your-thoughtseed-member-id"
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Appearance</h3>
        <label style={labelStyle}>Theme</label>
        <select
          style={{ ...inputStyle, marginBottom: 0 }}
          value={settings.theme}
          onChange={e => update({ theme: e.target.value as any })}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Paperclip Bridge</h3>
        <label style={labelStyle}>Paperclip Repo Path</label>
        <input
          style={inputStyle}
          value={settings.bridge.paperclipPath}
          onChange={e => updateBridge({ paperclipPath: e.target.value })}
          placeholder="/path/to/thoughtseed-paperclip"
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>MultiCA Bridge</h3>
        <label style={labelStyle}>MultiCA API URL</label>
        <input
          style={inputStyle}
          value={settings.bridge.multicaApiUrl}
          onChange={e => updateBridge({ multicaApiUrl: e.target.value })}
          placeholder="https://api.multica.thoughtseed.space"
        />
        <label style={labelStyle}>MultiCA Token</label>
        <input
          style={inputStyle}
          type="password"
          value={settings.bridge.multicaToken}
          onChange={e => updateBridge({ multicaToken: e.target.value })}
          placeholder="Bearer token"
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>R2 Archive</h3>
        <label style={labelStyle}>R2 Endpoint</label>
        <input
          style={inputStyle}
          value={settings.bridge.r2Endpoint || ''}
          onChange={e => updateBridge({ r2Endpoint: e.target.value })}
          placeholder="https://<account>.r2.cloudflarestorage.com"
        />
        <label style={labelStyle}>R2 Bucket</label>
        <input
          style={inputStyle}
          value={settings.bridge.r2Bucket || ''}
          onChange={e => updateBridge({ r2Bucket: e.target.value })}
          placeholder="plexus-reports"
        />
        <label style={labelStyle}>Access Key ID</label>
        <input
          style={inputStyle}
          value={settings.bridge.r2AccessKeyId || ''}
          onChange={e => updateBridge({ r2AccessKeyId: e.target.value })}
        />
        <label style={labelStyle}>Secret Access Key</label>
        <input
          style={inputStyle}
          type="password"
          value={settings.bridge.r2SecretAccessKey || ''}
          onChange={e => updateBridge({ r2SecretAccessKey: e.target.value })}
        />
      </div>
    </div>
  );
}
