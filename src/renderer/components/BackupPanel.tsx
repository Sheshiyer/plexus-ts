import React, { useState, useEffect } from 'react';
import { PageHeader, Button, Modal } from './ui';
import { IconBackups, IconSync } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  StatusChip,
} from './PlexusUI';

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
    setStatus('Restoring...');
    const ok = await window.plexus.backupRestore(path);
    setStatus(ok ? 'Restored successfully. Restart app to apply.' : 'Restore failed.');
    setBusy(false);
  };

  const handleBackup = async () => {
    setBusy(true);
    setStatus('Backing up...');
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
  const confirmBackup = backups.find((backup) => backup.path === confirmPath);
  const latestBackup = backups[0];

  return (
    <div className="px-fadein">
      <PageHeader
        title="Backups"
        sub="auto-backup every 6h · local snapshot vault"
        right={
          <CommandDock>
            {status && !restoreFailed && <StatusChip tone={busy ? 'idle' : 'accent'}>{status}</StatusChip>}
            <Button onClick={handleBackup} disabled={busy}><IconBackups /> {busy ? 'Working...' : 'Backup Now'}</Button>
            <Button variant="ghost" onClick={load} disabled={busy}><IconSync /> Refresh</Button>
          </CommandDock>
        }
      />

      {restoreFailed && (
        <DegradedStatePanel
          title="Restore failed"
          message="The selected local snapshot could not be restored. The current database was left in place."
          tone="error"
        />
      )}

      <MetricRailGroup>
        <MetricRail label="snapshots" value={backups.length} tone={backups.length ? 'accent' : 'idle'} hint="local copies" />
        <MetricRail label="latest" value={latestBackup ? new Date(latestBackup.date).toLocaleDateString() : 'none'} tone={latestBackup ? 'mint' : 'idle'} hint={latestBackup ? new Date(latestBackup.date).toLocaleTimeString() : 'not created'} />
        <MetricRail label="retention" value="10" tone="idle" hint="kept locally" />
        <MetricRail label="cadence" value="6h" tone="idle" hint="automatic" />
      </MetricRailGroup>

      <InstrumentPanel
        label="snapshot vault"
        title="Local database backups"
        note="Snapshots protect local Plexus state and can be restored after confirmation; restarting applies restored data."
        trace
      >
        {backups.length === 0 ? (
          <EmptyStatePanel
            variant="no-backups"
            icon={<IconBackups s={26} />}
            action={<Button onClick={handleBackup} disabled={busy}><IconBackups /> Backup Now</Button>}
          />
        ) : (
          <Ledger>
            {backups.map((backup, index) => (
              <LedgerRail
                key={backup.name}
                index={String(index + 1).padStart(2, '0')}
                title={backup.name}
                meta={`${new Date(backup.date).toLocaleString()} · ${backup.path}`}
                status={index === 0 ? 'latest' : 'snapshot'}
                statusTone={index === 0 ? 'accent' : 'idle'}
                value={formatSize(backup.size)}
                action={<Button variant="ghost" onClick={() => setConfirmPath(backup.path)} disabled={busy}>Restore</Button>}
              />
            ))}
          </Ledger>
        )}
      </InstrumentPanel>

      {confirmPath && (
        <Modal title="Restore backup?" onClose={() => setConfirmPath(null)}>
          <p style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
            Current data will be overwritten. Restart the app to apply the restored snapshot.
          </p>
          {confirmBackup && (
            <div className="px-mono md" style={{ color: 'var(--mint)', marginBottom: 18 }}>
              {confirmBackup.name}
            </div>
          )}
          <CommandDock>
            <Button variant="ghost" onClick={() => setConfirmPath(null)}>Cancel</Button>
            <Button variant="stop" onClick={() => handleRestore(confirmPath)}>Restore</Button>
          </CommandDock>
        </Modal>
      )}
    </div>
  );
}
