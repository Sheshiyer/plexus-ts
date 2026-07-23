import React, { useState } from 'react';
import type { AdminProofSnapshotHandoff, Project } from '../../shared/types';
import { PageHeader, Button, Field, Input, Toggle, localDateString } from './ui';
import { IconExport } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  FieldDock,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  StatusChip,
} from './PlexusUI';

interface Props {
  projects: Project[];
  proofContext?: AdminProofSnapshotHandoff | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return localDateString(new Date(iso));
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${localDateString(d)} ${d.toTimeString().slice(0, 8)}`;
}

export default function ExportPanel({ projects, proofContext = null }: Props) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localDateString(d);
  });
  const [to, setTo] = useState(() => localDateString());
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const projectFor = (id: string) => projects.find(p => p.id === id);
  const projectName = (id: string) => projectFor(id)?.name || id.slice(0, 8);

  const handleExport = async () => {
    if (new Date(from) > new Date(to)) {
      setError('Start date must be before end date.');
      setStatus('');
      return;
    }
    setBusy(true);
    setStatus('Loading...');
    setError('');
    try {
      const entries = await window.plexus.entryList(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`);
      if (!entries.length) {
        setStatus('No entries in this range.');
        return;
      }

      if (format === 'csv') {
        const headers = [
          'Date',
          'Project',
          'Repo URL',
          'Repo Full Name',
          'Evidence Status',
          'Evidence Checked At',
          'Activity Refs',
          'Description',
          'Start',
          'End',
          'Duration',
          'Source',
        ];
        const rows = entries.map(e => {
          const project = projectFor(e.projectId);
          return [
            formatDate(e.startTime),
            projectName(e.projectId),
            e.githubRepoUrl ?? project?.githubRepoUrl ?? '',
            e.githubRepoFullName ?? project?.githubRepoFullName ?? '',
            e.evidenceStatus ?? 'pending',
            e.evidenceCheckedAt ?? '',
            (e.githubActivityIds ?? []).join(' '),
            `"${e.description.replace(/"/g, '""')}"`,
            formatDateTime(e.startTime),
            e.endTime ? formatDateTime(e.endTime) : '',
            formatDuration(e.durationSeconds),
            e.source,
          ];
        });
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        downloadBlob(blob, `plexus-export-${from}_to_${to}.csv`);
      } else {
        const data = entries.map(e => {
          const project = projectFor(e.projectId);
          return {
            date: formatDate(e.startTime),
            project: projectName(e.projectId),
            githubRepoUrl: e.githubRepoUrl ?? project?.githubRepoUrl ?? null,
            githubRepoFullName: e.githubRepoFullName ?? project?.githubRepoFullName ?? null,
            evidenceStatus: e.evidenceStatus ?? 'pending',
            evidenceCheckedAt: e.evidenceCheckedAt ?? null,
            githubActivityIds: e.githubActivityIds ?? [],
            description: e.description,
            start: e.startTime,
            end: e.endTime,
            durationSeconds: e.durationSeconds,
            durationFormatted: formatDuration(e.durationSeconds),
            source: e.source,
          };
        });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `plexus-export-${from}_to_${to}.json`);
      }

      setStatus(`Exported ${entries.length} work records`);
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setStatus('');
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
      <PageHeader title="Export" sub={`${format} · ${from} -> ${to}`} />

      {proofContext && (
        <InstrumentPanel
          label="proof cockpit context"
          title="Read-only proof snapshot context"
          note={`${proofContext.workspaceId} · ${proofContext.date} · generated ${proofContext.generatedAt}`}
          actions={<StatusChip tone="accent">snapshot preserved</StatusChip>}
          trace
        >
          <Ledger>
            <LedgerRail
              index="01"
              title={proofContext.topBlocker ?? 'No top blocker'}
              meta={proofContext.detail}
              status={proofContext.nextAction}
              statusTone={proofContext.topBlocker ? 'warning' : 'accent'}
              wrapTitle
            />
          </Ledger>
        </InstrumentPanel>
      )}

      {error && (
        <DegradedStatePanel
          title="Export failed"
          message={error}
          tone="error"
        />
      )}

      <InstrumentPanel
        label="extraction chamber"
        title="Local work ledger export"
        note="Export preserves repo proof fields, evidence state, activity references, timestamps, and source."
        actions={status ? <StatusChip tone={busy ? 'idle' : 'accent'}>{status}</StatusChip> : undefined}
        trace
      >
        <FieldDock>
          <Field label="from">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </Field>
          <Field label="to">
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </Field>
          <Field label="format">
            <Toggle<'csv' | 'json'>
              value={format}
              onChange={setFormat}
              options={[{ key: 'csv', label: 'csv' }, { key: 'json', label: 'json' }]}
            />
          </Field>
        </FieldDock>
        <CommandDock align="start">
          <Button onClick={handleExport} disabled={busy}>
            <IconExport /> {busy ? 'Exporting...' : 'Download Export'}
          </Button>
        </CommandDock>
      </InstrumentPanel>

      <InstrumentPanel
        label="output schema"
        title="Exported fields"
        note="CSV and JSON contain the same evidence-aware work record payload."
      >
        <Ledger>
          <LedgerRail
            index="01"
            title="CSV"
            meta="Date, Project, Repo URL, Repo Full Name, Evidence Status, Activity Refs, Description, Start, End, Duration, Source."
            status="spreadsheet"
            statusTone="mint"
            wrapTitle
          />
          <LedgerRail
            index="02"
            title="JSON"
            meta="Structured records with ISO timestamps, duration seconds, formatted duration, repo proof fields, and activity ids."
            status="structured"
            statusTone="accent"
            wrapTitle
          />
        </Ledger>
      </InstrumentPanel>
    </div>
  );
}
