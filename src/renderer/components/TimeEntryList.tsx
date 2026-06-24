import React, { useCallback, useState, useEffect } from 'react';
import type { TimeEntry, Project } from '../../shared/types';
import { PageHeader, Button, Field, Input, Select, Modal, fmtHM, localDateString } from './ui';
import { IconPlus, IconTrash, IconEntries } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  FieldDock,
  Ledger,
  LedgerRail,
  type PlexusTone,
} from './PlexusUI';

interface Props {
  projects: Project[];
  onChange: () => void;
}

export default function TimeEntryList({ projects, onChange }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return localDateString(d);
  });
  const [to, setTo] = useState(() => localDateString());
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ projectId: '', description: '', startTime: '', endTime: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await window.plexus.entryList(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`);
      setEntries(list);
      setLoadedAt(new Date().toISOString());
      setError('');
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || `Project ${id.slice(0, 8)}`;
  const projectColor = (id: string) => projects.find(p => p.id === id)?.color || 'var(--t3)';
  const projectRepo = (id: string) => projects.find(p => p.id === id)?.githubRepoFullName;
  const evidenceTone = (status?: string | null): PlexusTone => {
    if (status === 'matched') return 'accent';
    if (status === 'missing' || status === 'pending') return 'warning';
    if (status === 'legacy_unverified' || status === 'sync_failed') return 'error';
    return 'idle';
  };
  const repoReady = (id: string) => {
    const project = projects.find(p => p.id === id);
    return Boolean(project?.githubRepoUrl && project?.githubRepoFullName && project?.repoVerifiedAt && project?.repoEvidenceStatus !== 'inaccessible');
  };

  const handleCreate = async () => {
    if (!newEntry.projectId || !newEntry.description || !newEntry.startTime || !newEntry.endTime || busy) return;
    if (!repoReady(newEntry.projectId)) {
      setError('Select a project with a verified GitHub repo before creating a manual work record.');
      return;
    }
    const start = new Date(newEntry.startTime);
    const end = new Date(newEntry.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError('End time must be after start time.');
      return;
    }
    setBusy('create');
    setError('');
    try {
      await window.plexus.entryCreate({
        projectId: newEntry.projectId,
        description: newEntry.description,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        tags: [],
        source: 'manual',
      });
      setNewEntry({ projectId: '', description: '', startTime: '', endTime: '' });
      setShowForm(false);
      await load();
      onChange();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (busy || !confirm('Delete this entry?')) return;
    setBusy(id);
    setError('');
    try {
      await window.plexus.entryDelete(id);
      await load();
      onChange();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Work Records"
        sub={`${from} -> ${to} · repo-backed ledger`}
        right={(
          <CommandDock>
            <Button onClick={() => setShowForm(true)}><IconPlus /> Manual Record</Button>
          </CommandDock>
        )}
      />

      <FieldDock>
        <Field label="from">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </Field>
        <Field label="to">
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </Field>
      </FieldDock>

      {error && (
        <DegradedStatePanel
          title="Entries action failed"
          message={error}
          tone="error"
          lastGoodAt={loadedAt}
          onRetry={load}
          busy={Boolean(busy)}
        />
      )}

      {showForm && (
        <Modal title="Manual Work Record" onClose={() => setShowForm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="px-form-grid">
              <Field label="project">
                <Select value={newEntry.projectId} onChange={e => setNewEntry({ ...newEntry, projectId: e.target.value })}>
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id} disabled={!repoReady(p.id)}>
                      {p.name}{repoReady(p.id) ? ` · ${p.githubRepoFullName}` : ' · GitHub repo required'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="description">
                <Input
                  value={newEntry.description}
                  onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
                  aria-label="Manual work record description"
                  title="Required work description for this manual record."
                />
              </Field>
            </div>
            <div className="px-form-grid">
              <Field label="start">
                <Input type="datetime-local" value={newEntry.startTime} onChange={e => setNewEntry({ ...newEntry, startTime: e.target.value })} />
              </Field>
              <Field label="end">
                <Input type="datetime-local" value={newEntry.endTime} onChange={e => setNewEntry({ ...newEntry, endTime: e.target.value })} />
              </Field>
            </div>
            <CommandDock align="start">
              <Button onClick={handleCreate} disabled={busy === 'create' || !repoReady(newEntry.projectId)}>{busy === 'create' ? 'Adding' : 'Add Record'}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} disabled={busy === 'create'}>Cancel</Button>
            </CommandDock>
          </div>
        </Modal>
      )}

      {entries.length === 0 ? (
        <EmptyStatePanel
          icon={<IconEntries s={26} />}
          title="No work records in this range"
          message="Change the date window or start a repo-backed focus session to populate the ledger."
          action={<Button variant="ghost" onClick={() => setShowForm(true)}><IconPlus /> Manual Record</Button>}
        />
      ) : (
        <Ledger>
          {entries.map(e => {
            const repo = e.githubRepoFullName ?? projectRepo(e.projectId) ?? 'legacy unverified';
            return (
              <LedgerRail
                key={e.id}
                marker={<span className="px-swatch" style={{ background: projectColor(e.projectId) }} />}
                title={e.description}
                meta={`${projectName(e.projectId)} · ${new Date(e.startTime).toLocaleString()}${e.endTime ? ` -> ${new Date(e.endTime).toLocaleTimeString()}` : ''} · ${repo}`}
                status={e.evidenceStatus ?? 'pending'}
                statusTone={evidenceTone(e.evidenceStatus)}
                value={fmtHM(e.durationSeconds)}
                action={(
                  <Button variant="ghost" onClick={() => handleDelete(e.id)} disabled={busy === e.id} aria-label="Delete">
                    <IconTrash />
                  </Button>
                )}
              />
            );
          })}
        </Ledger>
      )}
    </div>
  );
}
