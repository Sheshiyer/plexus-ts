import React from 'react';
import { Crosshairs } from './ui';
import { IconPause, IconStop, IconScissors, IconCheck } from './Icons';

interface Props {
  idleSeconds: number;
  activeSeconds: number;
  entryId: string;
  onAction: (action: 'keep' | 'discard' | 'trim') => void;
}

const ACTIONS: { action: 'discard' | 'trim' | 'keep'; Icon: typeof IconStop; color: string; label: string; hint: string }[] = [
  { action: 'discard', Icon: IconStop, color: 'var(--rose)', label: 'Discard idle time', hint: 'Stop timer at start of idle period' },
  { action: 'trim', Icon: IconScissors, color: 'var(--accent)', label: 'Trim idle time', hint: 'Stop timer now and subtract idle duration' },
  { action: 'keep', Icon: IconCheck, color: 'var(--mint)', label: 'Keep full duration', hint: 'Stop timer now, include idle time' },
];

export default function IdleDialog({ idleSeconds, activeSeconds, entryId, onAction }: Props) {
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="px-backdrop">
      <div className="px-modal pad" style={{ maxWidth: 420 }}>
        <Crosshairs />

        <h3 style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <IconPause s={18} /> Idle Detected
        </h3>
        <p style={{ color: 'var(--t2)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
          You have been idle for{' '}
          <strong className="px-mono" style={{ color: 'var(--rose)' }}>{formatTime(idleSeconds)}</strong>.
          Active time before idle:{' '}
          <strong className="px-mono" style={{ color: 'var(--accent)' }}>{formatTime(activeSeconds)}</strong>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ACTIONS.map(({ action, Icon, color, label, hint }) => (
            <button
              key={action}
              className="px-btn ghost"
              onClick={() => onAction(action)}
              style={{ flexDirection: 'column', alignItems: 'flex-start', textTransform: 'none', letterSpacing: 0, padding: '12px 16px' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color, fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                <Icon s={13} /> {label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>{hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
