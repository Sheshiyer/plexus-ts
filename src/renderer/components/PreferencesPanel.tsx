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
        right={(
          <div className="px-section-actions">
            {saved && <Badge tone="bill"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconCheck s={11} /> Saved</span></Badge>}
            <Button variant="accent" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Preferences'}</Button>
          </div>
        )}
      />

      <Panel raised pad crosshairs className="px-composed-panel">
        <div className="px-form-shell">
          <div className="px-form-band">
            <div className="px-section-head">
              <div>
                <SectionLabel>Focus &amp; Working Style</SectionLabel>
                <div className="px-section-note">This profile shapes project suggestions, standup context, and the daily agent tone.</div>
              </div>
            </div>
            <div className="px-form-grid">
              <Field label="Focus areas">
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
                  placeholder="e.g. 09:00-18:00 IST"
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
          </div>

          <div className="px-form-band">
            <div className="px-section-head">
              <div>
                <SectionLabel>Comms &amp; Cadence</SectionLabel>
                <div className="px-section-note">Optional routing preferences; skipping these should never block core onboarding.</div>
              </div>
            </div>
            <div className="px-form-grid">
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
          </div>

          <div className="px-form-band">
            <div className="px-section-head">
              <div>
                <SectionLabel>Notes</SectionLabel>
                <div className="px-section-note">Boundaries, learning goals, and private context the fabric should remember for work support.</div>
              </div>
            </div>
            <Field label="Anything else the agent fabric should know">
              <Textarea
                rows={4}
                value={prefs.notes || ''}
                onChange={e => update('notes', e.target.value)}
                placeholder="Context, boundaries, learning goals, etc."
              />
            </Field>
          </div>

          <div className="px-settings-card">
            <div>
              <div className="px-lbl">Preference bundle</div>
              <div className="settings-title">Saved to TeamForge member preferences</div>
              <div className="settings-note">Changes stay local in this form until you save them.</div>
            </div>
            <div className="settings-actions">
              {error && <Badge tone="rose">{error}</Badge>}
              <Button variant="accent" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Preferences'}</Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
