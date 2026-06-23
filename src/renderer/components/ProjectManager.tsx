import React, { useEffect, useState } from 'react';
import type { GitHubRepoOption, Project } from '../../shared/types';
import { PageHeader, Button, Swatch, EmptyState, SectionLabel, Badge, Modal, Field, Input, Select } from './ui';
import { IconProjects, IconSync } from './Icons';
import { ResilienceNotice } from '../lib/resilience';

interface Props {
  projects: Project[];
  onChange: () => void;
}

export default function ProjectManager({ projects, onChange }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');
  const [syncOk, setSyncOk] = useState<boolean | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [repoOptions, setRepoOptions] = useState<GitHubRepoOption[]>([]);
  const [repoProject, setRepoProject] = useState<Project | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [repoError, setRepoError] = useState('');
  const [needsOnly, setNeedsOnly] = useState(false);

  useEffect(() => {
    window.plexus.projectRepoOptions().then(setRepoOptions).catch(() => setRepoOptions([]));
  }, [projects.length]);

  const repoReady = (project: Project) => Boolean(
    project.githubRepoUrl &&
    project.githubRepoFullName &&
    project.repoVerifiedAt &&
    project.repoEvidenceStatus !== 'inaccessible',
  );

  const openRepoModal = (project: Project) => {
    setRepoProject(project);
    setRepoUrl(project.githubRepoUrl ?? '');
    setRepoError('');
  };

  const verifyRepo = async () => {
    if (!repoProject || !repoUrl.trim() || verifying) return;
    setVerifying(true);
    setRepoError('');
    try {
      const result = await window.plexus.projectVerifyRepo(repoProject.id, repoUrl.trim());
      if (!result.ok) {
        setRepoError(result.message ?? 'GitHub repo verification failed.');
        return;
      }
      setSyncOk(true);
      setMsg(result.message ?? `Verified ${result.repo?.fullName ?? 'GitHub repo'}`);
      setRepoProject(null);
      await onChange();
      const options = await window.plexus.projectRepoOptions().catch(() => [] as GitHubRepoOption[]);
      setRepoOptions(options);
    } catch (err: any) {
      setRepoError(err?.message ?? String(err));
    } finally {
      setVerifying(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    setMsg('Syncing…');
    setSyncOk(null);
    try {
      const r = await window.plexus.projectsSync();
      setSyncOk(r.ok);
      setMsg(r.ok ? `Synced ${r.count} project${r.count === 1 ? '' : 's'}` : (r.message ?? 'Sync failed'));
      if (r.ok) setLastSyncAt(new Date().toISOString());
      if (!r.ok) {
        await window.plexus.handoffRecord({
          kind: 'project_sync',
          status: 'failed',
          title: 'Project sync failed',
          payload: {},
          error: r.message ?? 'Workspace project sync failed.',
        }).catch(() => {});
      }
      onChange();
    } catch (err: any) {
      setSyncOk(false);
      setMsg(err?.message ?? String(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Projects"
        sub={`${projects.length} · GitHub-backed work surfaces`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {msg && <span className="px-mono" style={{ fontSize: 11, color: syncOk === false ? 'var(--rose)' : syncOk ? 'var(--accent)' : 'var(--t3)' }}>{msg}</span>}
            <Button variant="ghost" onClick={() => setNeedsOnly(v => !v)}>{needsOnly ? 'Show All' : 'Needs Repo'}</Button>
            <Button onClick={sync} disabled={syncing}><IconSync s={14} /> {syncing ? 'Syncing…' : 'Sync'}</Button>
          </div>
        }
      />

      {syncOk === false && msg && (
        <ResilienceNotice
          title="Project sync degraded"
          message={msg}
          lastGoodAt={lastSyncAt}
          onRetry={sync}
          busy={syncing}
        />
      )}

      {repoProject && (
        <Modal title={`GitHub repo · ${repoProject.name}`} onClose={() => setRepoProject(null)} width={520}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="px-section-note">
              A project must have a verified GitHub repository before Plexus can create new focus sessions or manual entries.
              Public repos can be verified locally by URL; private repos need the workspace GitHub integration.
            </div>
            <Field label="saved or suggested repo">
              <Select value={repoUrl} onChange={e => setRepoUrl(e.target.value)}>
                <option value="">Select repo or enter a URL below...</option>
                {repoOptions.map((option) => (
                  <option key={`${option.source}:${option.url}`} value={option.url}>{option.fullName}</option>
                ))}
              </Select>
            </Field>
            <Field label="add GitHub URL">
              <Input value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
            </Field>
            {repoError && <ResilienceNotice title="GitHub verification failed" message={repoError} />}
            <div style={{ display: 'flex', gap: 12 }}>
              <Button onClick={verifyRepo} disabled={verifying || !repoUrl.trim()}>{verifying ? 'Verifying' : 'Verify Repo'}</Button>
              <Button variant="ghost" onClick={() => setRepoProject(null)} disabled={verifying}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      <SectionLabel style={{ marginBottom: 6 }}>workspace projects</SectionLabel>
      {projects.length === 0 ? (
        <EmptyState icon={<IconProjects s={26} />}>
          No projects yet — press <span className="k">Sync</span> to pull them from the workspace service (set the connection in <span className="k">Settings</span> first).
        </EmptyState>
      ) : (
        <div className="px-rows">
          {projects.filter((p) => !needsOnly || !repoReady(p)).map((p, i) => (
            <div
              key={p.id}
              className="px-row"
              style={{ gridTemplateColumns: '26px 11px 1fr auto auto' }}
            >
              <span className="idx">{String(i + 1).padStart(2, '0')}</span>
              <Swatch color={p.color} />
              <div style={{ minWidth: 0 }}>
                <div className="desc">{p.name}</div>
                <div className="meta">
                  {p.clientName ? `${p.clientName} · ` : ''}
                  {p.githubRepoFullName ?? 'GitHub repo required'}
                </div>
              </div>
              <Badge tone={repoReady(p) ? 'mint' : 'rose'}>{repoReady(p) ? 'repo verified' : 'needs repo'}</Badge>
              <Button variant="ghost" onClick={() => openRepoModal(p)}>
                {repoReady(p) ? 'Update Repo' : 'Add Repo'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
