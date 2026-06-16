import React, { useCallback, useEffect, useState } from 'react';
import type { Project, ProjectVaultDetail } from '../../shared/types';
import { PageHeader, Panel, Button, Badge, Swatch, EmptyState, SectionLabel } from './ui';
import { IconProjects, IconSync } from './Icons';

interface Props {
  projects: Project[];
  onChange: () => void;
}

export default function ProjectManager({ projects, onChange }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');
  const [vaults, setVaults] = useState<ProjectVaultDetail[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [vaultError, setVaultError] = useState<string | null>(null);
  // Re-read vault dirs on an interval and surface failures instead of leaving
  // the project list silently un-enriched when the fabric scan errors.
  const loadVaults = useCallback(async () => {
    try {
      setVaults(await window.plexus.fabricAllProjectVaults());
      setVaultError(null);
    } catch (e: any) {
      setVaultError(e?.message ?? 'Could not read project vaults.');
    }
  }, []);

  useEffect(() => {
    loadVaults();
    const id = setInterval(loadVaults, 15000);
    return () => clearInterval(id);
  }, [loadVaults, projects]);

  const vaultMap = new Map(vaults.map((v) => [v.projectCode, v]));

  const sync = async () => {
    setSyncing(true);
    setMsg('Syncing…');
    const r = await window.plexus.projectsSync();
    setMsg(r.ok ? `Synced ${r.count} project${r.count === 1 ? '' : 's'}` : (r.message ?? 'Sync failed'));
    setSyncing(false);
    onChange();
  };

  const matchVault = (project: Project): ProjectVaultDetail | undefined => {
    const code = project.name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    return vaultMap.get(code) ?? vaultMap.get(project.name) ?? vaults.find((v) =>
      project.name.toLowerCase().includes(v.projectCode.toLowerCase())
    );
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Projects"
        sub={`${projects.length} · managed by TeamForge${vaults.length > 0 ? ` · ${vaults.length} vault dirs` : ''}`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {msg && <span className="px-mono" style={{ fontSize: 11, color: /^synced/i.test(msg) ? 'var(--accent)' : 'var(--t3)' }}>{msg}</span>}
            {vaultError && <span className="px-mono" style={{ fontSize: 11, color: 'var(--rose)' }}>{vaultError}</span>}
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
          {projects.map((p, i) => {
            const vault = matchVault(p);
            const isExpanded = expanded === p.id;
            return (
              <div key={p.id}>
                <div
                  className="px-row"
                  style={{ gridTemplateColumns: '26px 11px 1fr auto auto', cursor: vault ? 'pointer' : 'default' }}
                  onClick={() => vault && setExpanded(isExpanded ? null : p.id)}
                >
                  <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                  <Swatch color={p.color} />
                  <div style={{ minWidth: 0 }}>
                    <div className="desc">{p.name}</div>
                    {p.clientName && <div className="meta">{p.clientName}</div>}
                  </div>
                  {vault && (
                    <Badge tone="mint">{vault.totalFiles} vault files</Badge>
                  )}
                  <span className="px-lbl">synced</span>
                </div>
                {isExpanded && vault && (
                  <Panel pad style={{ marginLeft: 37, marginBottom: 8, fontSize: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      <VaultSection label="context" files={vault.contextFiles} />
                      <VaultSection label="decisions" files={vault.decisionFiles} />
                      <VaultSection label="handoffs" files={vault.handoffFiles} />
                      <VaultSection label="inbox" files={vault.inboxFiles} />
                    </div>
                  </Panel>
                )}
              </div>
            );
          })}
        </div>
      )}

      {vaults.length > 0 && (
        <Panel raised pad crosshairs style={{ marginTop: 18 }}>
          <SectionLabel style={{ marginBottom: 8 }}>vault project directories</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {vaults.map((v) => (
              <Badge key={v.projectCode}>{v.projectCode} ({v.totalFiles})</Badge>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function VaultSection({ label, files }: { label: string; files: string[] }) {
  return (
    <div>
      <div className="px-lbl" style={{ marginBottom: 4 }}>{label} ({files.length})</div>
      {files.length === 0 ? (
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>empty</div>
      ) : (
        files.slice(0, 5).map((f) => (
          <div key={f} className="px-mono" style={{ fontSize: 11, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f}
          </div>
        ))
      )}
      {files.length > 5 && (
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>+{files.length - 5} more</div>
      )}
    </div>
  );
}
