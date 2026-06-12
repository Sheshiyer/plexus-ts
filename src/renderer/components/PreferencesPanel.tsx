import React, { useState, useEffect } from 'react';
import {
  PageHeader, Panel, Button, Field, Input, Textarea, Badge, SectionLabel, Skeleton, Toggle,
} from './ui';
import { IconCheck } from './Icons';

export default function PreferencesPanel() {
  const [prefs, setPrefs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.plexus.memberPreferencesGet().then((data) => {
      setPrefs(data || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const update = (key: string, value: any) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const save = async () => {
    setSaving(true); setError('');
    const res = await window.plexus.memberPreferencesSet(prefs);
    if (res.ok) {
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } else {
      setError(res.message || 'Save failed');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="px-fadein">
        <PageHeader title="Preferences" sub="about you" />
        <Panel pad><Skeleton lines={5} /></Panel>
      </div>
    );
  }

  return (
    <div className="px-fadein">
      <PageHeader
        title="Preferences"
        sub="how the fabric should know you"
        right={saved
          ? <Badge tone="bill"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconCheck s={11} /> Saved</span></Badge>
          : undefined}
      />

      <Panel raised pad crosshairs>
        <SectionLabel style={{ marginBottom: 12 }}>Focus &amp; Working Style</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Focus areas (comma-separated)">
            <Input
              value={prefs.focusAreas || ''}
              onChange={e => update('focusAreas', e.target.value)}
              placeholder="e.g. frontend, DevOps, client relations"
            />
          </Field>
          <Field label="Preferred working hours">
            <Input
              value={prefs.workingHours || ''}
              onChange={e => update('workingHours', e.target.value)}
              placeholder="e.g. 09:00–18:00 IST"
            />
          </Field>
          <Field label="How the CEO should refer to you">
            <Input
              value={prefs.referral || ''}
              onChange={e => update('referral', e.target.value)}
              placeholder="e.g. informal first name, full name, nickname"
            />
          </Field>
        </div>

        <div className="px-divider" />

        <SectionLabel style={{ marginBottom: 12 }}>Comms &amp; Cadence</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Standup channel preference">
            <Toggle
              value={prefs.standupChannel || 'web'}
              options={[
                { key: 'web', label: 'Web UI' },
                { key: 'telegram', label: 'Telegram' },
                { key: 'slack', label: 'Slack' },
              ]}
              onChange={(v) => update('standupChannel', v)}
            />
          </Field>
          <Field label="Weekly report visibility">
            <Toggle
              value={prefs.weeklyVisibility || 'founder'}
              options={[
                { key: 'founder', label: 'Founders only' },
                { key: 'team', label: 'Full team' },
                { key: 'self', label: 'Self only' },
              ]}
              onChange={(v) => update('weeklyVisibility', v)}
            />
          </Field>
        </div>

        <div className="px-divider" />

        <SectionLabel style={{ marginBottom: 12 }}>Notes</SectionLabel>
        <Field label="Anything else the agent fabric should know">
          <Textarea
            rows={4}
            value={prefs.notes || ''}
            onChange={e => update('notes', e.target.value)}
            placeholder="Context, boundaries, learning goals, etc."
          />
        </Field>

        {error && <div className="px-mono" style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <Button variant="accent" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Preferences'}</Button>
        </div>
      </Panel>
    </div>
  );
}
