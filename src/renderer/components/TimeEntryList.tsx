import React, { useState, useEffect } from 'react';
import type { TimeEntry, Project } from '../../shared/types';

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
  const projectColor = (id: string) => projects.find(p => p.id === id)?.color || '#8b949e';

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700 }}>Time Entries</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#238636',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Manual Entry
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
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
        <span style={{ alignSelf: 'center', color: '#8b949e' }}>to</span>
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

      {showForm && (
        <div style={{
          background: '#161920',
          borderRadius: 12,
          padding: 20,
          border: '1px solid #252a33',
          marginBottom: 24,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <select
              value={newEntry.projectId}
              onChange={e => setNewEntry({ ...newEntry, projectId: e.target.value })}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #30363d',
                background: '#0f1115',
                color: '#c9d1d9',
                fontSize: 14,
              }}
            >
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input
              placeholder="Description"
              value={newEntry.description}
              onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input
              type="datetime-local"
              value={newEntry.startTime}
              onChange={e => setNewEntry({ ...newEntry, startTime: e.target.value })}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #30363d',
                background: '#0f1115',
                color: '#c9d1d9',
                fontSize: 14,
              }}
            />
            <input
              type="datetime-local"
              value={newEntry.endTime}
              onChange={e => setNewEntry({ ...newEntry, endTime: e.target.value })}
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#c9d1d9', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={newEntry.billable}
              onChange={e => setNewEntry({ ...newEntry, billable: e.target.checked })}
            />
            Billable
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleCreate} style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#1f6feb',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}>Add Entry</button>
            <button onClick={() => setShowForm(false)} style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #30363d',
              background: 'transparent',
              color: '#8b949e',
              cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map(e => (
          <div key={e.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: '#161920',
            borderRadius: 10,
            border: '1px solid #252a33',
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: projectColor(e.projectId), flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{e.description}</div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>
                {projectName(e.projectId)} · {new Date(e.startTime).toLocaleString()}
                {e.endTime && ` → ${new Date(e.endTime).toLocaleTimeString()}`}
              </div>
            </div>
            {e.billable && <span style={{ fontSize: 11, color: '#3fb950', background: '#3fb95022', padding: '2px 8px', borderRadius: 4 }}>$</span>}
            <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
              {formatTime(e.durationSeconds)}
            </div>
            <button onClick={() => handleDelete(e.id)} style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: '#f85149',
              fontSize: 12,
              cursor: 'pointer',
            }}>Delete</button>
          </div>
        ))}
        {entries.length === 0 && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: 48 }}>No entries in this range</div>
        )}
      </div>
    </div>
  );
}
