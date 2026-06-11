import React, { useState } from 'react';
import type { Project } from '../../shared/types';

interface Props {
  projects: Project[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
}

export default function ExportPanel({ projects }: Props) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [status, setStatus] = useState('');

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id.slice(0, 8);

  const handleExport = async () => {
    setStatus('Loading...');
    const entries = await window.plexus.entryList(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`);

    if (format === 'csv') {
      const headers = ['Date', 'Project', 'Description', 'Start', 'End', 'Duration', 'Billable', 'Source'];
      const rows = entries.map(e => [
        formatDate(e.startTime),
        projectName(e.projectId),
        `"${e.description.replace(/"/g, '""')}"`,
        formatDateTime(e.startTime),
        e.endTime ? formatDateTime(e.endTime) : '',
        formatDuration(e.durationSeconds),
        e.billable ? 'Yes' : 'No',
        e.source,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      downloadBlob(blob, `plexus-export-${from}_to_${to}.csv`);
    } else {
      const data = entries.map(e => ({
        date: formatDate(e.startTime),
        project: projectName(e.projectId),
        description: e.description,
        start: e.startTime,
        end: e.endTime,
        durationSeconds: e.durationSeconds,
        durationFormatted: formatDuration(e.durationSeconds),
        billable: e.billable,
        source: e.source,
      }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `plexus-export-${from}_to_${to}.json`);
    }

    setStatus(`Exported ${entries.length} entries`);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Export</h2>

      <div style={{
        background: '#161920',
        borderRadius: 12,
        padding: 24,
        border: '1px solid #252a33',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #30363d',
              background: '#0f1115',
              color: '#c9d1d9',
              fontSize: 14,
            }}
          />
          <span style={{ color: '#8b949e' }}>to</span>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
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

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['csv', 'json'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #30363d',
                background: format === f ? '#1f6feb' : 'transparent',
                color: format === f ? '#fff' : '#8b949e',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'uppercase',
                fontSize: 12,
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          style={{
            padding: '12px 24px',
            borderRadius: 8,
            border: 'none',
            background: '#238636',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          📥 Download Export
        </button>

        {status && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#3fb950' }}>{status}</div>
        )}
      </div>

      <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.6 }}>
        <p>CSV exports include: Date, Project, Description, Start/End times, Duration, Billable flag.</p>
        <p style={{ marginTop: 8 }}>JSON exports include the same data in structured format with ISO timestamps.</p>
      </div>
    </div>
  );
}
