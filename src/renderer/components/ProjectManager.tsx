import React, { useState } from 'react';
import type { Project } from '../../shared/types';
import { PageHeader, Button, Swatch, EmptyState, SectionLabel } from './ui';
import { IconProjects, IconSync } from './Icons';

interface Props {
  projects: Project[];
  onChange: () => void;
}

export default function ProjectManager({ projects, onChange }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const sync = async () => {
    setSyncing(true);
    setMsg('Syncing…');
    const r = await window.plexus.projectsSync();
    setMsg(r.ok ? `Synced ${r.count} project${r.count === 1 ? '' : 's'}` : (r.message ?? 'Sync failed'));
    setSyncing(false);
    onChange();
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Projects"
        sub={`${projects.length} · managed by TeamForge`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {msg && <span className="px-mono" style={{ fontSize: 11, color: /^synced/i.test(msg) ? 'var(--accent)' : 'var(--t3)' }}>{msg}</span>}
            <Button onClick={sync} disabled={syncing}><IconSync s={14} /> {syncing ? 'Syncing…' : 'Sync'}</Button>
          </div>
        }
      />

      <SectionLabel style={{ marginBottom: 6 }}>workspace projects</SectionLabel>
      {projects.length === 0 ? (
        <EmptyState icon={<IconProjects s={26} />}>
          No projects yet — press <span className="k">Sync</span> to pull them from TeamForge (set the connection in <span className="k">Settings</span> first).
        </EmptyState>
      ) : (
        <div className="px-rows">
          {projects.map((p, i) => (
            <div
              key={p.id}
              className="px-row"
              style={{ gridTemplateColumns: '26px 11px 1fr auto' }}
            >
              <span className="idx">{String(i + 1).padStart(2, '0')}</span>
              <Swatch color={p.color} />
              <div style={{ minWidth: 0 }}>
                <div className="desc">{p.name}</div>
                {p.clientName && <div className="meta">{p.clientName}</div>}
              </div>
              <span className="px-lbl">synced</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
