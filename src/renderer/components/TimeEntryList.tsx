import React, { useCallback, useState, useEffect } from 'react';
import type { TimeEntry, Project } from '../../shared/types';
import { PageHeader, Button, Field, Input, Select, Swatch, EmptyState, Modal, SectionLabel, Badge, fmtHM, localDateString } from './ui';
import { IconPlus, IconTrash, IconEntries } from './Icons';
import { ResilienceNotice } from '../lib/resilience';

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
        sub={`${from} → ${to} · repo-backed ledger`}
        right={<Button onClick={() => setShowForm(true)}><IconPlus /> Manual Record</Button>}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto' }} />
        <span className="px-lbl">to</span>
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 'auto' }} />
      </div>

      {error && (
        <ResilienceNotice
          title="Entries action failed"
          message={error}
          lastGoodAt={loadedAt}
          onRetry={load}
          busy={Boolean(busy)}
        />
      )}

      {showForm && (
        <Modal title="Manual Work Record" onClose={() => setShowForm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="project">
                <Select value={newEntry.projectId} onChange={e => setNewEntry({ ...newEntry, projectId: e.target.value })}>
                  <option value="">Select project…</option>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="start">
                <Input type="datetime-local" value={newEntry.startTime} onChange={e => setNewEntry({ ...newEntry, startTime: e.target.value })} />
              </Field>
              <Field label="end">
                <Input type="datetime-local" value={newEntry.endTime} onChange={e => setNewEntry({ ...newEntry, endTime: e.target.value })} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button onClick={handleCreate} disabled={busy === 'create' || !repoReady(newEntry.projectId)}>{busy === 'create' ? 'Adding' : 'Add Record'}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} disabled={busy === 'create'}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      <SectionLabel style={{ marginBottom: 6 }}>work records</SectionLabel>
      {entries.length === 0 ? (
        <EmptyState icon={<IconEntries s={26} />}>No work records in this range.</EmptyState>
      ) : (
        <div className="px-rows">
          {entries.map(e => (
            <div key={e.id} className="px-row" style={{ gridTemplateColumns: '11px 1fr auto auto auto' }}>
              <Swatch color={projectColor(e.projectId)} />
              <div style={{ minWidth: 0 }}>
                <div className="desc">{e.description}</div>
                <div className="meta">
                  {projectName(e.projectId)} · {new Date(e.startTime).toLocaleString()}
                  {e.endTime && ` → ${new Date(e.endTime).toLocaleTimeString()}`}
                  {` · ${e.githubRepoFullName ?? projectRepo(e.projectId) ?? 'legacy unverified'}`}
                </div>
              </div>
              <Badge tone={e.evidenceStatus === 'matched' ? 'mint' : e.evidenceStatus === 'legacy_unverified' ? 'rose' : undefined}>{e.evidenceStatus ?? 'pending'}</Badge>
              <span className="dur">{fmtHM(e.durationSeconds)}</span>
              <Button variant="ghost" style={{ padding: 7 }} onClick={() => handleDelete(e.id)} disabled={busy === e.id} aria-label="Delete"><IconTrash /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
