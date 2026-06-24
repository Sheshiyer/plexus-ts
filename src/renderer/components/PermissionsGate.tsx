import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './ui';
import { IconCheck, IconClose, IconMic, IconCamera, IconScreen } from './Icons';
import type { MediaCaptureKind, MediaCaptureStatus, MediaPermissionState, MediaRequestKind } from '../../shared/types';
import { InstrumentPanel, StatusChip, type PlexusTone } from './PlexusUI';

type GateStep = {
  key: MediaCaptureKind;
  label: string;
  blurb: string;
  Icon: React.FC<{ s?: number }>;
  /** screen recording cannot be prompted programmatically — System Settings only */
  systemOnly: boolean;
};

const STEPS: GateStep[] = [
  { key: 'microphone', label: 'Microphone', blurb: 'Captures your voice in realtime calls and meetings.', Icon: IconMic, systemOnly: false },
  { key: 'camera', label: 'Camera', blurb: 'Shares your video in realtime calls.', Icon: IconCamera, systemOnly: false },
  { key: 'screen', label: 'Screen Recording', blurb: 'Lets you share your screen. Approve in System Settings, then relaunch Plexus for it to take effect.', Icon: IconScreen, systemOnly: true },
];

function permTone(state: MediaPermissionState): PlexusTone {
  if (state === 'granted') return 'accent';
  if (state === 'denied' || state === 'restricted') return 'error';
  return 'idle';
}

function permLabel(state: MediaPermissionState): string {
  if (state === 'not-determined') return 'not asked';
  if (state === 'unknown') return 'permission check failed';
  return state;
}

/**
 * First-run permission wizard. Walks microphone → camera → screen one at a time,
 * firing each native macOS dialog only on an explicit user action. A denied or
 * skipped permission never blocks progression. Once every permission is resolved
 * the wizard collapses into a compact status summary.
 */
export default function PermissionsGate({ onComplete }: { onComplete?: () => void }) {
  const [status, setStatus] = useState<MediaCaptureStatus | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const probed = await window.plexus.mediaCaptureStatus();
      if (cancelled) return;
      setStatus(probed);
      // Begin at the first permission that is not already granted.
      const first = STEPS.findIndex((step) => probed.permissions[step.key] !== 'granted');
      setIndex(first === -1 ? STEPS.length : first);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const goNext = () => {
    setIndex((i) => {
      const next = Math.min(i + 1, STEPS.length);
      if (next >= STEPS.length) onComplete?.();
      return next;
    });
  };

  const allow = async (kind: MediaRequestKind) => {
    setBusy(true);
    try {
      const updated = await window.plexus.mediaRequestAccess(kind);
      setStatus(updated);
      if (updated.permissions[kind] === 'granted') goNext();
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    setBusy(true);
    try {
      const updated = await window.plexus.mediaCaptureStatus();
      setStatus(updated);
      const active = STEPS[index];
      if (active && updated.permissions[active.key] === 'granted') goNext();
    } finally {
      setBusy(false);
    }
  };

  const grantedCount = useMemo(
    () => (status ? STEPS.filter((step) => status.permissions[step.key] === 'granted').length : 0),
    [status],
  );

  if (!ready || !status) return null;

  const done = index >= STEPS.length;

  return (
    <InstrumentPanel
      label="system permissions"
      title="Native media controls"
      note={done
        ? 'Realtime media permissions are configured. Reopen System Settings below to change any that were denied.'
        : `Grant access one at a time so realtime calls work. Step ${index + 1} of ${STEPS.length}.`}
      actions={<StatusChip tone={grantedCount === STEPS.length ? 'accent' : 'idle'}>{grantedCount}/{STEPS.length} granted</StatusChip>}
      className="px-composed-panel"
      trace
    >

      <div className="px-flow-grid">
        {STEPS.map((step, i) => {
          const state = status.permissions[step.key];
          const granted = state === 'granted';
          const denied = state === 'denied' || state === 'restricted';
          const isActive = !done && i === index;
          const isUpcoming = !done && i > index && !granted;

          return (
            <div
              key={step.key}
              className={`px-flow-card ${granted ? 'state-completed' : denied ? 'state-failed' : 'state-deferred'}`}
              style={isUpcoming ? { opacity: 0.45 } : undefined}
            >
              <div className="px-flow-icon">
                {granted ? <IconCheck s={16} /> : denied ? <IconClose s={16} /> : <step.Icon s={16} />}
              </div>
              <div className="px-flow-main">
                <div className="px-flow-top">
                  <div className="px-flow-title">{step.label}</div>
                  <StatusChip tone={isUpcoming ? 'idle' : permTone(state)}>{isUpcoming ? 'up next' : permLabel(state)}</StatusChip>
                </div>

                {(isActive || (done && !granted)) && <div className="px-flow-meta">{step.blurb}</div>}

                {isActive && !granted && (
                  <div className="px-flow-actions">
                    {!step.systemOnly && !denied && (
                      <Button variant="accent" onClick={() => allow(step.key as MediaRequestKind)} disabled={busy}>
                        {busy ? 'Requesting...' : `Allow ${step.label}`}
                      </Button>
                    )}
                    {(step.systemOnly || denied) && (
                      <Button variant="accent" onClick={() => window.plexus.mediaOpenPrivacySettings(step.key)} disabled={busy}>
                        Open System Settings
                      </Button>
                    )}
                    {(step.systemOnly || denied) && (
                      <Button variant="ghost" onClick={recheck} disabled={busy}>
                        {busy ? 'Checking...' : 'Re-check'}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={goNext} disabled={busy}>Skip</Button>
                  </div>
                )}

                {isActive && granted && (
                  <div className="px-flow-actions">
                    <Button variant="accent" onClick={goNext} disabled={busy}>
                      <IconCheck s={12} /> Continue
                    </Button>
                  </div>
                )}

                {done && !granted && (
                  <div className="px-flow-actions">
                    <Button variant="ghost" onClick={() => window.plexus.mediaOpenPrivacySettings(step.key)}>
                      Open System Settings
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </InstrumentPanel>
  );
}
