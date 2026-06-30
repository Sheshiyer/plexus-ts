import React, { useState, useEffect } from 'react';
import type { PlexusSettings } from '../../shared/types';
import {
  PageHeader, Button, Field, Input, Textarea, Skeleton, Toggle,
} from './ui';
import { IconCheck, IconClock, IconTrash } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  FieldDock,
  InstrumentPanel,
  StatusChip,
} from './PlexusUI';
import {
  toText,
} from '../identityLoadout';

const toFormText = (value: unknown): string => (typeof value === 'string' ? value : '');

interface PreferencesPanelProps {
  embedded?: boolean;
}

export default function PreferencesPanel({ embedded = false }: PreferencesPanelProps) {
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localSaved, setLocalSaved] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [localSettings, setLocalSettings] = useState<PlexusSettings | null>(null);

  useEffect(() => {
    Promise.all([
      window.plexus.memberPreferencesGet(),
      window.plexus.settingsGet(),
    ]).then(([data, settings]) => {
      setPrefs(data || {});
      setLocalSettings(settings);
      setLoadedAt(new Date().toISOString());
      setLoading(false);
    }).catch((err: any) => {
      setError(err?.message ?? 'Could not load preferences.');
      setLoading(false);
    });
  }, []);

  const update = (key: string, value: unknown) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('plexus:preferences-dirty', { detail: { dirty } }));
    return () => {
      window.dispatchEvent(new CustomEvent('plexus:preferences-dirty', { detail: { dirty: false } }));
    };
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await window.plexus.memberPreferencesSet(prefs);
      if (res.ok) {
        setDirty(false);
        setSaved(true); setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.message || 'Save failed');
      }
    } catch (err: any) {
      const message = err?.message ?? String(err);
      setError(message);
      await window.plexus.handoffRecord({
        kind: 'preferences_save',
        status: 'failed',
        title: 'Preferences save failed',
        payload: { preferences: prefs },
        error: message,
      }).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const updateLocalSettings = async (patch: Partial<PlexusSettings>) => {
    setError('');
    try {
      setLocalSettings(await window.plexus.settingsSet(patch));
      setLocalSaved(true);
      setTimeout(() => setLocalSaved(false), 1800);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  };

  if (loading) {
    return (
      <div className={`px-fadein${embedded ? ' px-preferences-embedded' : ''}`}>
        {!embedded && <PageHeader title="Preferences" sub="preferences" />}
        <InstrumentPanel label="loading preferences" title="Reading preferences">
          <Skeleton lines={5} />
        </InstrumentPanel>
      </div>
    );
  }

  return (
    <div className={`px-fadein${embedded ? ' px-preferences-embedded' : ''}`}>
      {!embedded && (
        <PageHeader
          title="Preferences"
          sub="preferences"
          right={(
            <CommandDock>
              {saved && <StatusChip tone="accent"><IconCheck s={11} /> Saved</StatusChip>}
              {localSaved && <StatusChip tone="accent"><IconCheck s={11} /> Local saved</StatusChip>}
              {dirty && <StatusChip tone="warning">unsaved</StatusChip>}
              <Button variant="accent" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save preferences'}</Button>
            </CommandDock>
          )}
        />
      )}

      {error && (
        <DegradedStatePanel
          title="Preferences unavailable"
          message={error}
          tone="error"
          lastGoodAt={loadedAt}
          onRetry={save}
          busy={saving}
        />
      )}

      <InstrumentPanel
        label="preferences"
        title="Workspace preferences"
        note="Work style, notification behavior, cadence, and private context stay together here."
        trace
        actions={embedded ? (
          <>
            {saved && <StatusChip tone="accent"><IconCheck s={11} /> Saved</StatusChip>}
            {localSaved && <StatusChip tone="accent"><IconCheck s={11} /> Local saved</StatusChip>}
            {dirty && <StatusChip tone="warning">unsaved</StatusChip>}
            <Button variant="accent" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save preferences'}</Button>
          </>
        ) : undefined}
      >
        <div className="px-preferences-sheet">
          <div className="px-character-console">
            <div className="px-form-band px-character-band">
              <div className="px-section-head">
                <div>
                  <div className="px-lbl">Focus &amp; working style</div>
                  <div className="px-section-note">Project affinity, working rhythm, and naming context.</div>
                </div>
              </div>
              <FieldDock>
                <Field label="Focus areas">
                  <Input
                    value={toFormText(prefs.focusAreas)}
                    onChange={e => update('focusAreas', e.target.value)}
                    aria-label="Focus areas"
                    placeholder="AI ops, product, design systems"
                    title="Comma-separated work areas Plexus can use for task organization and summaries."
                  />
                </Field>
                <Field label="Preferred working hours">
                  <Input
                    value={toFormText(prefs.workingHours)}
                    onChange={e => update('workingHours', e.target.value)}
                    aria-label="Preferred working hours"
                    placeholder="10:00-18:00 IST"
                    title="Your normal working window and timezone."
                  />
                </Field>
                <Field label="CEO reference">
                  <Input
                    value={toFormText(prefs.referral)}
                    onChange={e => update('referral', e.target.value)}
                    aria-label="Preferred name or reference style"
                    placeholder="Shesh"
                    title="The name or reference style that should appear in work summaries."
                  />
                </Field>
              </FieldDock>
            </div>

            {localSettings && (
              <div className="px-form-band px-character-band">
                <div className="px-section-head">
                  <div>
                    <div className="px-lbl">Nudges &amp; breakwork</div>
                    <div className="px-section-note">Local notification behavior, quiet hours, and recovery reminders.</div>
                  </div>
                </div>
                <div className="px-character-toggle-grid">
                  <Field label="Sound reminders">
                    <Toggle<'on' | 'off'>
                      value={localSettings.soundNotificationsEnabled ? 'on' : 'off'}
                      onChange={(value) => void updateLocalSettings({ soundNotificationsEnabled: value === 'on' })}
                      options={[{ key: 'on', label: 'Sound on' }, { key: 'off', label: 'Muted' }]}
                    />
                  </Field>
                  <Field label="Breakwork voice">
                    <Toggle<'voice' | 'text'>
                      value={localSettings.voiceBreakworkEnabled ? 'voice' : 'text'}
                      onChange={(value) => void updateLocalSettings({ voiceBreakworkEnabled: value === 'voice' })}
                      options={[{ key: 'voice', label: 'Voice' }, { key: 'text', label: 'Text only' }]}
                    />
                  </Field>
                </div>
                <FieldDock>
                  <Field label={`Notification volume (${localSettings.notificationVolume}%)`}>
                    <Input
                      className="px-settings-range"
                      type="range"
                      min="0"
                      max="100"
                      value={localSettings.notificationVolume}
                      onChange={(event) => void updateLocalSettings({ notificationVolume: Number(event.target.value) })}
                      aria-label="Notification volume"
                    />
                  </Field>
                  <Field label="Snooze minutes">
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={localSettings.breakworkSnoozeMinutes}
                      onChange={(event) => void updateLocalSettings({
                        breakworkSnoozeMinutes: Math.max(1, Math.min(120, Number(event.target.value) || 10)),
                      })}
                      aria-label="Breakwork snooze minutes"
                    />
                  </Field>
                  <Field label="Quiet start">
                    <Input
                      type="time"
                      value={localSettings.quietHoursStart ?? '18:00'}
                      onChange={(event) => void updateLocalSettings({ quietHoursStart: event.target.value })}
                      aria-label="Quiet hours start"
                    />
                  </Field>
                  <Field label="Quiet end">
                    <Input
                      type="time"
                      value={localSettings.quietHoursEnd ?? '09:00'}
                      onChange={(event) => void updateLocalSettings({ quietHoursEnd: event.target.value })}
                      aria-label="Quiet hours end"
                    />
                  </Field>
                </FieldDock>
              </div>
            )}

            {localSettings && (
              <div className="px-form-band px-character-band">
                <div className="px-section-head">
                  <div>
                    <div className="px-lbl">Private rhythm</div>
                    <div className="px-section-note">Birthdate and rhythm timing stay local; they are not sent to reports or summaries.</div>
                  </div>
                </div>
                <FieldDock>
                  <Field label="Birthdate">
                    <Input
                      type="date"
                      value={localSettings.rhythmProfile.birthdate ?? ''}
                      onChange={(event) => void updateLocalSettings({
                        rhythmProfile: {
                          ...localSettings.rhythmProfile,
                          birthdate: event.target.value || undefined,
                          privateConsentAt: localSettings.rhythmProfile.privateConsentAt ?? new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        },
                      })}
                      aria-label="Private rhythm birthdate"
                    />
                  </Field>
                  <Field label="Rhythm state">
                    <Toggle<'enabled' | 'paused'>
                      value={localSettings.rhythmProfile.enabled ? 'enabled' : 'paused'}
                      onChange={(value) => void updateLocalSettings({
                        rhythmProfile: {
                          ...localSettings.rhythmProfile,
                          enabled: value === 'enabled',
                          privateConsentAt: localSettings.rhythmProfile.privateConsentAt ?? new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        },
                      })}
                      options={[{ key: 'enabled', label: 'Enabled' }, { key: 'paused', label: 'Paused' }]}
                    />
                  </Field>
                </FieldDock>
                <div className="px-action-strip">
                  <Button variant="ghost" onClick={() => void updateLocalSettings({
                    rhythmProfile: {
                      ...localSettings.rhythmProfile,
                      enabled: !localSettings.rhythmProfile.enabled,
                      privateConsentAt: localSettings.rhythmProfile.privateConsentAt ?? new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
                  })}>
                    <IconClock s={12} /> {localSettings.rhythmProfile.enabled ? 'Pause rhythm' : 'Enable rhythm'}
                  </Button>
                  <Button variant="stop" onClick={() => void updateLocalSettings({
                    rhythmProfile: { enabled: false, privateConsentAt: null, updatedAt: new Date().toISOString() },
                  })}>
                    <IconTrash s={12} /> Delete rhythm data
                  </Button>
                </div>
              </div>
            )}

            <div className="px-form-band px-character-band">
              <div className="px-section-head">
                <div>
                  <div className="px-lbl">Comms &amp; cadence</div>
                  <div className="px-section-note">Check-in channel and report visibility.</div>
                </div>
              </div>
              <div className="px-character-toggle-grid">
                <Field label="Standup channel preference">
                  <Toggle
                    value={toText(prefs.standupChannel) || 'web'}
                    options={[
                      { key: 'web', label: 'Plexus' },
                      { key: 'paperclip', label: 'Paperclip' },
                      { key: 'telegram', label: 'Telegram' },
                    ]}
                    onChange={(v) => update('standupChannel', v)}
                  />
                </Field>
                <Field label="Weekly report visibility">
                  <Toggle
                    value={toText(prefs.weeklyVisibility) || 'founder'}
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

            <div className="px-form-band px-character-band">
              <div className="px-section-head">
                <div>
                  <div className="px-lbl">Notes</div>
                  <div className="px-section-note">Boundaries, learning goals, and private work context.</div>
                </div>
              </div>
              <Field label="Notes for your preferences">
                <Textarea
                  rows={4}
                  value={toFormText(prefs.notes)}
                  onChange={e => update('notes', e.target.value)}
                  aria-label="Notes for your work preferences"
                  title="Boundaries, learning goals, and private work context."
                />
              </Field>
            </div>

            <div className="px-settings-card px-character-save-card">
              <div>
                <div className="px-lbl">Preference summary</div>
                <div className="settings-title">Saved to workspace preferences</div>
                <div className="settings-note">Focus, cadence, quiet hours, and private rhythm are saved from this panel.</div>
              </div>
              <div className="settings-actions">
                {dirty && <StatusChip tone="warning">draft kept</StatusChip>}
                <Button variant="accent" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save preferences'}</Button>
              </div>
            </div>
          </div>
        </div>
      </InstrumentPanel>
    </div>
  );
}
