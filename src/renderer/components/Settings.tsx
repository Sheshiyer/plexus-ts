import React, { useState, useEffect } from 'react';
import type { PlexusSettings } from '../../shared/types';
import { PageHeader, Panel, Field, Input, Select, Badge, SectionLabel, Skeleton } from './ui';
import { IconCheck } from './Icons';

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
        <SectionLabel>Identity</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <Field label="Member ID">
            <Input
              value={settings.memberId}
              onChange={e => update({ memberId: e.target.value })}
              placeholder="your-thoughtseed-member-id"
            />
          </Field>
        </div>

        <div className="px-divider" />

        <SectionLabel>Appearance</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <Field label="Theme">
            <Select
              value={settings.theme}
              onChange={e => update({ theme: e.target.value as any })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </Select>
          </Field>
        </div>

        <div className="px-divider" />

        <SectionLabel>Paperclip Bridge</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <Field label="Paperclip Repo Path">
            <Input
              value={settings.bridge.paperclipPath}
              onChange={e => updateBridge({ paperclipPath: e.target.value })}
              placeholder="/path/to/thoughtseed-paperclip"
            />
          </Field>
        </div>

        <div className="px-divider" />

        <SectionLabel>MultiCA Bridge</SectionLabel>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="MultiCA API URL">
            <Input
              value={settings.bridge.multicaApiUrl}
              onChange={e => updateBridge({ multicaApiUrl: e.target.value })}
              placeholder="https://api.multica.thoughtseed.space"
            />
          </Field>
          <Field label="MultiCA Token">
            <Input
              type="password"
              value={settings.bridge.multicaToken}
              onChange={e => updateBridge({ multicaToken: e.target.value })}
              placeholder="Bearer token"
            />
          </Field>
        </div>

        <div className="px-divider" />

        <SectionLabel>R2 Archive</SectionLabel>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="R2 Endpoint">
            <Input
              value={settings.bridge.r2Endpoint || ''}
              onChange={e => updateBridge({ r2Endpoint: e.target.value })}
              placeholder="https://<account>.r2.cloudflarestorage.com"
            />
          </Field>
          <Field label="R2 Bucket">
            <Input
              value={settings.bridge.r2Bucket || ''}
              onChange={e => updateBridge({ r2Bucket: e.target.value })}
              placeholder="plexus-reports"
            />
          </Field>
          <Field label="Access Key ID">
            <Input
              value={settings.bridge.r2AccessKeyId || ''}
              onChange={e => updateBridge({ r2AccessKeyId: e.target.value })}
            />
          </Field>
          <Field label="Secret Access Key">
            <Input
              type="password"
              value={settings.bridge.r2SecretAccessKey || ''}
              onChange={e => updateBridge({ r2SecretAccessKey: e.target.value })}
            />
          </Field>
        </div>
      </Panel>
    </div>
  );
}
