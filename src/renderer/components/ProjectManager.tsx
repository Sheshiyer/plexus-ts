import React, { useState } from 'react';
import type { Project } from '../../shared/types';

interface Props {
  projects: Project[];
  onChange: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

export default function ProjectManager({ projects, onChange }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [rate, setRate] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await window.plexus.projectCreate({
      name: name.trim(),
      clientName: client.trim() || undefined,
      color,
      hourlyRate: rate ? Number(rate) : undefined,
      currency: 'USD',
      archived: false,
    });
    setName('');
    setClient('');
    setColor(PRESET_COLORS[0]);
    setRate('');
    setShowForm(false);
    onChange();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    await window.plexus.projectDelete(id);
    onChange();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700 }}>Projects</h2>
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
          + New Project
        </button>
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
            <input
              placeholder="Project name"
              value={name}
              onChange={e => setName(e.target.value)}
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
              placeholder="Client (optional)"
              value={client}
              onChange={e => setClient(e.target.value)}
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              placeholder="Hourly rate (USD)"
              type="number"
              value={rate}
              onChange={e => setRate(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #30363d',
                background: '#0f1115',
                color: '#c9d1d9',
                fontSize: 14,
                width: 180,
              }}
            />
            <button onClick={handleCreate} style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#1f6feb',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}>Create</button>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {projects.map(p => (
          <div key={p.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            background: '#161920',
            borderRadius: 10,
            border: '1px solid #252a33',
          }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
              {p.clientName && <div style={{ fontSize: 12, color: '#8b949e' }}>{p.clientName}</div>}
            </div>
            {p.hourlyRate && (
              <div style={{ fontSize: 13, color: '#8b949e' }}>${p.hourlyRate}/hr</div>
            )}
            <button onClick={() => handleDelete(p.id)} style={{
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
        {projects.length === 0 && (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: 48 }}>No projects yet</div>
        )}
      </div>
    </div>
  );
}
