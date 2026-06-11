import React, { useState, useEffect } from 'react';

export default function BackupPanel() {
  const [backups, setBackups] = useState<{ name: string; path: string; size: number; date: string }[]>([]);
  const [status, setStatus] = useState('');

  const load = async () => {
    const list = await window.plexus.backupList();
    setBackups(list);
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (path: string) => {
    if (!confirm('Restore this backup? Current data will be overwritten.')) return;
    setStatus('Restoring...');
    const ok = await window.plexus.backupRestore(path);
    setStatus(ok ? 'Restored successfully. Restart app to apply.' : 'Restore failed.');
  };

  const handleBackup = async () => {
    setStatus('Backing up...');
    await window.plexus.backupRun();
    await load();
    setStatus('Backup created.');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Backups</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          onClick={handleBackup}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: '#238636',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          💾 Backup Now
        </button>
        <button
          onClick={load}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid #30363d',
            background: 'transparent',
            color: '#8b949e',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {status && <div style={{ marginBottom: 16, fontSize: 13, color: '#3fb950' }}>{status}</div>}

      <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 12 }}>
        Auto-backup runs every 6 hours. Keeps the last 10 backups.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {backups.map(b => (
          <div key={b.name} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: '#161920',
            borderRadius: 10,
            border: '1px solid #252a33',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>
                {new Date(b.date).toLocaleString()} · {formatSize(b.size)}
              </div>
            </div>
            <button
              onClick={() => handleRestore(b.path)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid #30363d',
                background: 'transparent',
                color: '#58a6ff',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Restore
            </button>
          </div>
        ))}
        {backups.length === 0 && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>No backups yet</div>
        )}
      </div>
    </div>
  );
}
