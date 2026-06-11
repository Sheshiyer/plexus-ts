import React, { useState } from 'react';
import type { Project } from '../../shared/types';
import { PageHeader, Panel, Button, Field, Input, Toggle, SectionLabel } from './ui';
import { IconExport } from './Icons';

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
  const [busy, setBusy] = useState(false);

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id.slice(0, 8);

  const handleExport = async () => {
    setBusy(true);
    setStatus('Loading…');
    try {
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
    } finally {
      setBusy(false);
    }
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
    <div className="px-fadein">
      <PageHeader title="Export" sub={`${format} · ${from} → ${to}`} />

      <Panel raised pad crosshairs>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="from">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto' }} />
          </Field>
          <Field label="to">
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 'auto' }} />
          </Field>
          <Field label="format">
            <Toggle<'csv' | 'json'>
              value={format}
              onChange={setFormat}
              options={[{ key: 'csv', label: 'csv' }, { key: 'json', label: 'json' }]}
            />
          </Field>
        </div>

        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Button onClick={handleExport} disabled={busy}>
            <IconExport /> {busy ? 'Exporting…' : 'Download Export'}
          </Button>
          {status && (
            <span className="px-mono" style={{ fontSize: 12, color: busy ? 'var(--t3)' : 'var(--accent)' }}>{status}</span>
          )}
        </div>
      </Panel>

      <div style={{ marginTop: 26 }}>
        <SectionLabel style={{ marginBottom: 8 }}>format details</SectionLabel>
        <div className="px-rows">
          <div className="px-row" style={{ gridTemplateColumns: '70px 1fr' }}>
            <span className="px-lbl">csv</span>
            <span className="desc" style={{ whiteSpace: 'normal', color: 'var(--t2)' }}>
              Date, Project, Description, Start/End times, Duration, Billable flag.
            </span>
          </div>
          <div className="px-row" style={{ gridTemplateColumns: '70px 1fr' }}>
            <span className="px-lbl">json</span>
            <span className="desc" style={{ whiteSpace: 'normal', color: 'var(--t2)' }}>
              Same data in structured format with ISO timestamps.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
