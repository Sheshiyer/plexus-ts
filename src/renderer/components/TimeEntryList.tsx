import React, { useState, useEffect } from 'react';
import type { TimeEntry, Project } from '../../shared/types';
import { PageHeader, Panel, Button, Field, Input, Select, Badge, Swatch, EmptyState, Modal, SectionLabel, fmtHM } from './ui';
import { IconPlus, IconTrash, IconEntries } from './Icons';

interface Props {
  projects: Project[];
  onChange: () => void;
}

export default function TimeEntryList({ projects, onChange }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ projectId: '', description: '', startTime: '', endTime: '', billable: true });

  const load = async () => {
    const list = await window.plexus.entryList(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`);
    setEntries(list);
  };

  useEffect(() => { load(); }, [from, to]);

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || 'Unknown';
  const projectColor = (id: string) => projects.find(p => p.id === id)?.color || 'var(--t3)';

  const handleCreate = async () => {
    if (!newEntry.projectId || !newEntry.description || !newEntry.startTime || !newEntry.endTime) return;
    await window.plexus.entryCreate({
      projectId: newEntry.projectId,
      description: newEntry.description,
      startTime: new Date(newEntry.startTime).toISOString(),
      endTime: new Date(newEntry.endTime).toISOString(),
      tags: [],
      billable: newEntry.billable,
      source: 'manual',
    });
    setNewEntry({ projectId: '', description: '', startTime: '', endTime: '', billable: true });
    setShowForm(false);
    load();
    onChange();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await window.plexus.entryDelete(id);
    load();
    onChange();
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Time Entries"
        sub={`${from} → ${to}`}
        right={<Button onClick={() => setShowForm(true)}><IconPlus /> Manual Entry</Button>}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto' }} />
        <span className="px-lbl">to</span>
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 'auto' }} />
      </div>

      {showForm && (
        <Modal title="Manual Entry" onClose={() => setShowForm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="project">
                <Select value={newEntry.projectId} onChange={e => setNewEntry({ ...newEntry, projectId: e.target.value })}>
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="description">
                <Input placeholder="What did you work on?" value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} />
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
            <label className="px-chip" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={newEntry.billable} onChange={e => setNewEntry({ ...newEntry, billable: e.target.checked })} />
              Billable
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button onClick={handleCreate}>Add Entry</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      <SectionLabel style={{ marginBottom: 6 }}>entries</SectionLabel>
      {entries.length === 0 ? (
        <EmptyState icon={<IconEntries s={26} />}>No entries in this range.</EmptyState>
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
                </div>
              </div>
              {e.billable ? <Badge tone="bill">billable</Badge> : <Badge>non-bill</Badge>}
              <span className="dur">{fmtHM(e.durationSeconds)}</span>
              <Button variant="ghost" style={{ padding: 7 }} onClick={() => handleDelete(e.id)} aria-label="Delete"><IconTrash /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
