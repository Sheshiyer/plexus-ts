import React, { useState, useEffect } from 'react';
import { PageHeader, Panel, Button, Modal, EmptyState, SectionLabel } from './ui';
import { IconBackups, IconSync } from './Icons';

export default function BackupPanel() {
  const [backups, setBackups] = useState<{ name: string; path: string; size: number; date: string }[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmPath, setConfirmPath] = useState<string | null>(null);

  const load = async () => {
    const list = await window.plexus.backupList();
    setBackups(list);
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (path: string) => {
    setConfirmPath(null);
    setBusy(true);
    setStatus('Restoring…');
    const ok = await window.plexus.backupRestore(path);
    setStatus(ok ? 'Restored successfully. Restart app to apply.' : 'Restore failed.');
    setBusy(false);
  };

  const handleBackup = async () => {
    setBusy(true);
    setStatus('Backing up…');
    await window.plexus.backupRun();
    await load();
    setStatus('Backup created.');
    setBusy(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const restoreFailed = status === 'Restore failed.';

  return (
    <div className="px-fadein">
      <PageHeader
        title="Backups"
        sub="auto-backup every 6h · keeps last 10"
        right={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button onClick={handleBackup} disabled={busy}><IconBackups /> {busy ? 'Working…' : 'Backup Now'}</Button>
            <Button variant="ghost" onClick={load} disabled={busy}><IconSync /> Refresh</Button>
          </div>
        }
      />

      {status && (
        <div
          className="px-mono"
          style={{ marginBottom: 16, fontSize: 12, color: restoreFailed ? 'var(--rose)' : 'var(--accent)' }}
        >
          {status}
        </div>
      )}

      <SectionLabel style={{ marginBottom: 8 }}>snapshots</SectionLabel>
      {backups.length === 0 ? (
        <EmptyState icon={<IconBackups s={26} />}>
          No backups yet — press <span className="k">Backup Now</span> to create one.
        </EmptyState>
      ) : (
        <div className="px-rows">
          {backups.map(b => (
            <div key={b.name} className="px-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
              <div style={{ minWidth: 0 }}>
                <div className="desc">{b.name}</div>
                <div className="meta">
                  {new Date(b.date).toLocaleString()} · <span className="px-num">{formatSize(b.size)}</span>
                </div>
              </div>
              <Button variant="ghost" onClick={() => setConfirmPath(b.path)} disabled={busy}>Restore</Button>
            </div>
          ))}
        </div>
      )}

      {confirmPath && (
        <Modal title="Restore backup?" onClose={() => setConfirmPath(null)}>
          <p style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
            Current data will be overwritten. Restart the app to apply the restored snapshot.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConfirmPath(null)}>Cancel</Button>
            <Button variant="stop" onClick={() => handleRestore(confirmPath)}>Restore</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
