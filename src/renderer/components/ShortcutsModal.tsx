import React from 'react';

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['Cmd/Ctrl', 'Shift', 'P'], action: 'Toggle timer (global)' },
  { keys: ['Cmd/Ctrl', 'Shift', 'O'], action: 'Show / hide app (global)' },
  { keys: ['?'], action: 'Show this shortcuts help' },
];

export default function ShortcutsModal({ onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 20000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#161920',
          borderRadius: 16,
          padding: 32,
          border: '1px solid #252a33',
          maxWidth: 480,
          width: '90%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>⌨️ Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              fontSize: 20,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SHORTCUTS.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #252a33' }}>
              <span style={{ color: '#c9d1d9', fontSize: 14 }}>{s.action}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {s.keys.map((k, j) => (
                  <span key={j} style={{
                    background: '#0f1115',
                    border: '1px solid #30363d',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 12,
                    fontFamily: 'SF Mono, monospace',
                    color: '#58a6ff',
                  }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: '#8b949e' }}>
          Global shortcuts work even when Plexus is not focused.
        </p>
      </div>
    </div>
  );
}
