import React, { useState } from 'react';

export default function BridgePanel() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState<Record<string, { success?: boolean; message: string; loading?: boolean }>>({});

  const run = async (key: string, fn: (m: string) => Promise<{ success: boolean; message: string; url?: string }>) => {
    setStatus(prev => ({ ...prev, [key]: { message: 'Running...', loading: true } }));
    try {
      const res = await fn(month);
      setStatus(prev => ({ ...prev, [key]: { success: res.success, message: res.message || (res.success ? 'OK' : 'Failed') } }));
    } catch (e: any) {
      setStatus(prev => ({ ...prev, [key]: { success: false, message: e.message || 'Error' } }));
    }
  };

  const actions = [
    {
      key: 'paperclip',
      label: '📎 Sync to Paperclip',
      desc: 'Push time entries into Paperclip vault for agent visibility',
      action: () => run('paperclip', window.plexus.syncToPaperclip),
    },
    {
      key: 'multica',
      label: '🌉 Push to MultiCA',
      desc: 'Send monthly report across the MultiCA bridge to cofounders',
      action: () => run('multica', window.plexus.pushToMultiCA),
    },
    {
      key: 'r2',
      label: '☁️ Archive to R2',
      desc: 'Store monthly report in Cloudflare R2 for durable retention',
      action: () => run('r2', window.plexus.archiveToR2),
    },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Bridge</h2>
      <p style={{ color: '#8b949e', marginBottom: 24 }}>Connect Plexus to the Thoughtseed ecosystem</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <label style={{ color: '#8b949e', fontSize: 14 }}>Month</label>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #30363d',
            background: '#0f1115',
            color: '#c9d1d9',
            fontSize: 14,
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {actions.map(a => (
          <div key={a.key} style={{
            background: '#161920',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #252a33',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: 13, color: '#8b949e' }}>{a.desc}</div>
              {status[a.key] && (
                <div style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: status[a.key].success === true ? '#3fb950' : status[a.key].success === false ? '#f85149' : '#8b949e',
                }}>
                  {status[a.key].message}
                </div>
              )}
            </div>
            <button
              onClick={a.action}
              disabled={status[a.key]?.loading}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#1f6feb',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: status[a.key]?.loading ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {status[a.key]?.loading ? 'Running...' : 'Run'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, background: '#161920', borderRadius: 12, padding: 20, border: '1px solid #252a33' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#8b949e' }}>Data Flow</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#c9d1d9' }}>
          <span style={{ background: '#1f6feb22', padding: '4px 10px', borderRadius: 6 }}>Plexus</span>
          <span>→</span>
          <span style={{ background: '#3fb95022', padding: '4px 10px', borderRadius: 6 }}>Paperclip</span>
          <span>→</span>
          <span style={{ background: '#f59e0b22', padding: '4px 10px', borderRadius: 6 }}>MultiCA</span>
          <span>→</span>
          <span style={{ background: '#ec489922', padding: '4px 10px', borderRadius: 6 }}>TeamForge</span>
          <span>→</span>
          <span style={{ background: '#8b5cf622', padding: '4px 10px', borderRadius: 6 }}>R2 Archive</span>
        </div>
      </div>
    </div>
  );
}
