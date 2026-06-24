import React from 'react';
import { Modal } from './ui';
import { IconKeyboard } from './Icons';
import { Ledger, LedgerRail } from './PlexusUI';

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['Cmd/Ctrl', 'Shift', 'P'], action: 'Toggle focus session (global)' },
  { keys: ['Cmd/Ctrl', 'Shift', 'O'], action: 'Show / hide app (global)' },
  { keys: ['?'], action: 'Show this shortcuts help' },
];

const kbd: React.CSSProperties = {
  border: '1px solid var(--line-2)',
  padding: '2px 7px',
  borderRadius: 'var(--r)',
  color: 'var(--mint)',
  fontSize: 11,
  background: 'var(--bg-0)',
};

export default function ShortcutsModal({ onClose }: Props) {
  return (
    <Modal title="Keyboard Shortcuts" onClose={onClose}>
      <div className="px-caption" style={{ marginTop: -4 }}>
        <IconKeyboard s={14} /> bindings
      </div>

      <Ledger>
        {SHORTCUTS.map((s, i) => (
          <LedgerRail
            key={i}
            index={String(i + 1).padStart(2, '0')}
            title={s.action}
            value={(
              <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {s.keys.map((k, j) => (
                <span key={j} className="px-mono" style={kbd}>{k}</span>
              ))}
              </span>
            )}
          />
        ))}
      </Ledger>

      <p className="px-lbl" style={{ marginTop: 18, lineHeight: 1.6, textTransform: 'none', letterSpacing: '.02em' }}>
        Global shortcuts work even when Plexus is not focused.
      </p>
    </Modal>
  );
}
