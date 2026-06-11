import React, { useState } from 'react';
import type { Project } from '../../shared/types';
import { PageHeader, Button, Field, Input, Swatch, EmptyState, Modal, SectionLabel } from './ui';
import { IconPlus, IconTrash, IconProjects, IconCheck } from './Icons';

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
  const [touched, setTouched] = useState(false);

  const reset = () => {
    setName('');
    setClient('');
    setColor(PRESET_COLORS[0]);
    setTouched(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) { setTouched(true); return; }
    await window.plexus.projectCreate({
      name: name.trim(),
      clientName: client.trim() || undefined,
      color,
      archived: false,
    });
    reset();
    setShowForm(false);
    onChange();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    await window.plexus.projectDelete(id);
    onChange();
  };

  const closeForm = () => { setShowForm(false); reset(); };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Projects"
        sub={`${projects.length} active`}
        right={<Button onClick={() => setShowForm(true)}><IconPlus /> New Project</Button>}
      />

      {showForm && (
        <Modal title="New Project" onClose={closeForm}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="name" error={touched && !name.trim() ? 'Name is required' : undefined}>
                <Input placeholder="Project name" value={name} onChange={e => setName(e.target.value)} />
              </Field>
              <Field label="client">
                <Input placeholder="Client (optional)" value={client} onChange={e => setClient(e.target.value)} />
              </Field>
            </div>

            <Field label="color">
              <div style={{ display: 'flex', gap: 10 }}>
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: color === c ? '1px solid var(--mint)' : '1px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--on-accent)',
                    }}
                  >
                    {color === c && <IconCheck s={14} />}
                  </button>
                ))}
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 12 }}>
              <Button onClick={handleCreate}>Create</Button>
              <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      <SectionLabel style={{ marginBottom: 6 }}>all projects</SectionLabel>
      {projects.length === 0 ? (
        <EmptyState icon={<IconProjects s={26} />}>No projects yet.</EmptyState>
      ) : (
        <div className="px-rows">
          {projects.map(p => (
            <div key={p.id} className="px-row" style={{ gridTemplateColumns: '11px 1fr auto' }}>
              <Swatch color={p.color} />
              <div style={{ minWidth: 0 }}>
                <div className="desc">{p.name}</div>
                {p.clientName && <div className="meta">{p.clientName}</div>}
              </div>
              <Button variant="ghost" style={{ padding: 7 }} onClick={() => handleDelete(p.id)} aria-label="Delete"><IconTrash /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
