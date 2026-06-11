import React from 'react';

interface Props {
  idleSeconds: number;
  activeSeconds: number;
  entryId: string;
  onAction: (action: 'keep' | 'discard' | 'trim') => void;
}

export default function IdleDialog({ idleSeconds, activeSeconds, entryId, onAction }: Props) {
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 20000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#161920',
          borderRadius: 16,
          padding: 32,
          border: '1px solid #252a33',
          maxWidth: 420,
          width: '90%',
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>⏸ Idle Detected</h2>
        <p style={{ color: '#8b949e', fontSize: 14, marginBottom: 20 }}>
          You have been idle for <strong style={{ color: '#f85149' }}>{formatTime(idleSeconds)}</strong>.
          Active time before idle: <strong style={{ color: '#3fb950' }}>{formatTime(activeSeconds)}</strong>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => onAction('discard')}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #30363d',
              background: 'transparent',
              color: '#c9d1d9',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ color: '#f85149' }}>⏹ Discard idle time</span>
            <span style={{ display: 'block', fontSize: 12, color: '#8b949e', fontWeight: 400, marginTop: 2 }}>
              Stop timer at start of idle period
            </span>
          </button>

          <button
            onClick={() => onAction('trim')}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #30363d',
              background: 'transparent',
              color: '#c9d1d9',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ color: '#f0883e' }}>✂️ Trim idle time</span>
            <span style={{ display: 'block', fontSize: 12, color: '#8b949e', fontWeight: 400, marginTop: 2 }}>
              Stop timer now and subtract idle duration
            </span>
          </button>

          <button
            onClick={() => onAction('keep')}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #30363d',
              background: 'transparent',
              color: '#c9d1d9',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ color: '#3fb950' }}>✓ Keep full duration</span>
            <span style={{ display: 'block', fontSize: 12, color: '#8b949e', fontWeight: 400, marginTop: 2 }}>
              Stop timer now, include idle time
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
