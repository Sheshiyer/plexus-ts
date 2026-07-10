import React, { useEffect, useState } from 'react';
import type { GitHubRepoOption, Project, TimeEntry, VaultProjectCandidate, VaultProjectScanResult } from '../../shared/types';
import { PageHeader, Button, Modal, Field, Input, Select, localDateString } from './ui';
import { IconPlus, IconProjects, IconSync } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  FieldDock,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  StatusChip,
  type PlexusTone,
} from './PlexusUI';
import {
  gitHubApiUrlForFullName,
  gitHubFullNameFromInput,
  gitHubWebUrlForFullName,
  gitHubWebUrlFromInput,
  isGitHubRepoFullName,
  normalizeGitHubRepoInput,
} from '../lib/githubRepoLinks';

interface Props {
  projects: Project[];
  onChange: () => void;
}

type ProjectIntel = {
  lastCommit: string;
  openPrs: string;
  evidence: string;
  evidenceTone: PlexusTone;
};

function githubFullName(project: Project): string | null {
  const fullName = project.githubRepoFullName?.trim();
  if (isGitHubRepoFullName(fullName)) return fullName;
  return gitHubFullNameFromInput(project.githubRepoUrl ?? '');
}

function githubUrl(project: Project, path = ''): string | null {
  const fullName = githubFullName(project);
  if (fullName) {
    return gitHubWebUrlForFullName(fullName, path);
  }
  return gitHubWebUrlFromInput(project.githubRepoUrl ?? '', path);
}

function githubApiUrl(project: Project, path = ''): string | null {
  const fullName = githubFullName(project);
  return fullName ? gitHubApiUrlForFullName(fullName, path) : null;
}

function openProjectUrl(project: Project, path = '') {
  const url = githubUrl(project, path);
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function linkedAge(project: Project): string {
  if (!project.repoVerifiedAt) return project.githubRepoUrl ? 'unverified' : 'not linked';
  const verifiedAt = new Date(project.repoVerifiedAt).getTime();
  if (!Number.isFinite(verifiedAt)) return 'linked';
  const diffDays = Math.max(0, Math.floor((Date.now() - verifiedAt) / 86_400_000));
  if (diffDays === 0) return 'linked today';
  if (diffDays === 1) return 'linked 1d ago';
  if (diffDays < 30) return `linked ${diffDays}d ago`;
  const months = Math.floor(diffDays / 30);
  return `linked ${months}mo ago`;
}

function relativeAge(iso: string): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return 'unknown';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function countFromLinkHeader(link: string | null, fallback: number): number {
  if (!link) return fallback;
  const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return match ? Number(match[1]) : fallback;
}

function evidenceForProject(projectId: string, entries: TimeEntry[]): Pick<ProjectIntel, 'evidence' | 'evidenceTone'> {
  const projectEntries = entries.filter((entry) => entry.projectId === projectId);
  if (projectEntries.length === 0) return { evidence: 'no records', evidenceTone: 'idle' };
  const evidenced = projectEntries.filter((entry) => entry.evidenceStatus === 'matched').length;
  const percent = Math.round((evidenced / projectEntries.length) * 100);
  return {
    evidence: `${percent}% proof`,
    evidenceTone: percent >= 80 ? 'accent' : percent > 0 ? 'warning' : 'error',
  };
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
  const [vaultScan, setVaultScan] = useState<VaultProjectScanResult | null>(null);
  const [vaultBusy, setVaultBusy] = useState<'scan' | 'import' | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualProject, setManualProject] = useState({ name: '', repoUrl: '' });
  const [manualError, setManualError] = useState('');
  const [projectIntel, setProjectIntel] = useState<Record<string, ProjectIntel>>({});

  useEffect(() => {
    window.plexus.projectRepoOptions().then(setRepoOptions).catch(() => setRepoOptions([]));
  }, [projects.length]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const to = localDateString();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      const from = localDateString(fromDate);
      const entries = await window.plexus.entryList(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`).catch(() => [] as TimeEntry[]);
      const linkedProjects = projects.filter((project) => githubFullName(project)).slice(0, 24);
      const next: Record<string, ProjectIntel> = {};

      await Promise.all(linkedProjects.map(async (project) => {
        const evidence = evidenceForProject(project.id, entries);
        const base: ProjectIntel = {
          lastCommit: 'unavailable',
          openPrs: 'unavailable',
          ...evidence,
        };
        const commitsUrl = githubApiUrl(project, '/commits?per_page=1');
        const pullsUrl = githubApiUrl(project, '/pulls?state=open&per_page=1');
        if (!commitsUrl || !pullsUrl) {
          next[project.id] = base;
          return;
        }

        const [commitResponse, pullResponse] = await Promise.allSettled([
          fetch(commitsUrl, { headers: { Accept: 'application/vnd.github+json' } }),
          fetch(pullsUrl, { headers: { Accept: 'application/vnd.github+json' } }),
        ]);

        if (commitResponse.status === 'fulfilled' && commitResponse.value.ok) {
          const commits = await commitResponse.value.json() as Array<{ commit?: { committer?: { date?: string } } }>;
          const latest = commits[0]?.commit?.committer?.date;
          if (latest) base.lastCommit = relativeAge(latest);
        }

        if (pullResponse.status === 'fulfilled' && pullResponse.value.ok) {
          const pulls = await pullResponse.value.json() as unknown[];
          const count = countFromLinkHeader(pullResponse.value.headers.get('Link'), pulls.length);
          base.openPrs = `${count} open`;
        }

        next[project.id] = base;
      }));

      if (!cancelled) setProjectIntel(next);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  const repoReady = (project: Project) => Boolean(
    project.githubRepoUrl &&
    project.githubRepoFullName &&
    project.repoVerifiedAt &&
    project.repoEvidenceStatus !== 'inaccessible',
  );
  const projectTone = (project: Project): PlexusTone => {
    if (repoReady(project)) return 'accent';
    if (project.repoEvidenceStatus === 'inaccessible') return 'error';
    if (project.githubRepoUrl || project.repoEvidenceStatus === 'unverified' || project.repoEvidenceStatus === 'missing') return 'warning';
    return 'idle';
  };
  const projectStatus = (project: Project) => {
    if (repoReady(project)) return 'ready';
    if (project.repoEvidenceStatus === 'inaccessible') return 'needs attention';
    return 'needs setup';
  };
  const vaultTone = (candidate: VaultProjectCandidate): PlexusTone => {
    if (candidate.cachedRepoStatus === 'verified') return 'accent';
    if (candidate.cachedProjectId) return 'warning';
    return 'idle';
  };
  const vaultStatus = (candidate: VaultProjectCandidate) => {
    if (candidate.cachedRepoStatus === 'verified') return 'ready';
    if (candidate.cachedProjectId) return 'in local project list';
    return 'new project';
  };

  const openRepoModal = (project: Project) => {
    setRepoProject(project);
    setRepoUrl(normalizeGitHubRepoInput(project.githubRepoUrl ?? ''));
    setRepoError('');
  };

  const verifyRepo = async () => {
    if (!repoProject || !repoUrl.trim() || verifying) return;
    const normalized = normalizeGitHubRepoInput(repoUrl);
    if (!normalized) {
      setRepoError('Enter a GitHub link in org/repo format, or paste the repository URL.');
      return;
    }
    setVerifying(true);
    setRepoError('');
    try {
      const result = await window.plexus.projectVerifyRepo(repoProject.id, normalized);
      if (!result.ok) {
        setRepoError(result.message ?? 'Check the GitHub link and try again.');
        return;
      }
      setRepoUrl(result.project?.githubRepoUrl ?? normalized);
      setSyncOk(true);
      setMsg(`${result.repo?.fullName ?? 'Project link'} checked`);
      setRepoProject(null);
      await onChange();
      const options = await window.plexus.projectRepoOptions().catch(() => [] as GitHubRepoOption[]);
      setRepoOptions(options);
    } catch (err: any) {
      setRepoError(err?.message ?? 'Check the GitHub link and try again.');
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
      setMsg(r.ok ? `Synced ${r.count} project${r.count === 1 ? '' : 's'}` : 'Projects could not be synced right now.');
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
    } catch {
      setSyncOk(false);
      setMsg('Projects could not be synced right now.');
    } finally {
      setSyncing(false);
    }
  };

  const scanVault = async (mode: 'scan' | 'import') => {
    if (vaultBusy) return;
    setVaultBusy(mode);
    setMsg(mode === 'import' ? 'Adding projects…' : 'Checking assigned projects…');
    setSyncOk(null);
    try {
      const result = mode === 'import'
        ? await window.plexus.projectImportVault()
        : await window.plexus.projectScanVault();
      setVaultScan(result);
      setSyncOk(result.ok);
      setMsg(result.ok
        ? (mode === 'import'
          ? `Added or refreshed ${result.imported ?? 0} assigned project${(result.imported ?? 0) === 1 ? '' : 's'}`
          : `${result.candidates.length} assigned project${result.candidates.length === 1 ? '' : 's'} ready to review`)
        : 'Assigned projects are not available from this device.');
      if (mode === 'import' && result.ok) {
        await onChange();
        const options = await window.plexus.projectRepoOptions().catch(() => [] as GitHubRepoOption[]);
        setRepoOptions(options);
      }
    } catch {
      setSyncOk(false);
      setMsg('Assigned projects could not be checked right now.');
    } finally {
      setVaultBusy(null);
    }
  };

  const createManualProject = async () => {
    const name = manualProject.name.trim();
    const repo = normalizeGitHubRepoInput(manualProject.repoUrl);
    if (!name || verifying) return;
    setVerifying(true);
    setManualError('');
    try {
      const created = await window.plexus.projectCreate({
        name,
        color: '#56C8B0',
        archived: false,
        githubRepoUrl: repo || undefined,
        repoEvidenceStatus: repo ? 'unverified' : 'missing',
        repoRequired: true,
        evidenceStatus: repo ? 'pending' : 'missing',
      });
      if (repo) {
        const result = await window.plexus.projectVerifyRepo(created.id, repo);
        if (!result.ok) {
          setManualError(result.message ?? 'Project was added to the local project list, but the GitHub link needs attention.');
          await onChange();
          return;
        }
      }
      setManualProject({ name: '', repoUrl: '' });
      setManualOpen(false);
      await onChange();
    } catch {
      setManualError('Project could not be saved right now.');
    } finally {
      setVerifying(false);
    }
  };

  const verifiedCount = projects.filter(repoReady).length;
  const inaccessibleCount = projects.filter((project) => project.repoEvidenceStatus === 'inaccessible').length;
  const needsRepoCount = projects.length - verifiedCount - inaccessibleCount;
  const visibleProjects = projects.filter((p) => !needsOnly || !repoReady(p));

  return (
    <div className="px-fadein">
      <PageHeader
        title="Projects"
        sub={`${projects.length} · projects ready for work tracking`}
        right={
          <CommandDock>
            {msg && <StatusChip tone={syncOk === false ? 'error' : syncOk ? 'accent' : 'idle'}>{msg}</StatusChip>}
            <Button variant="ghost" onClick={() => setNeedsOnly(v => !v)}>{needsOnly ? 'Show all' : 'Needs setup'}</Button>
            <Button variant="ghost" onClick={() => scanVault('scan')} disabled={vaultBusy !== null}><IconProjects s={14} /> {vaultBusy === 'scan' ? 'Checking' : 'Check projects'}</Button>
            <Button variant="ghost" onClick={() => scanVault('import')} disabled={vaultBusy !== null}><IconSync s={14} /> {vaultBusy === 'import' ? 'Adding' : 'Add assigned'}</Button>
            <Button variant="ghost" onClick={() => setManualOpen(true)}><IconPlus s={14} /> Add project</Button>
            <Button onClick={sync} disabled={syncing}><IconSync s={14} /> {syncing ? 'Syncing…' : 'Sync'}</Button>
          </CommandDock>
        }
      />

      {syncOk === false && msg && (
        <DegradedStatePanel
          variant="sync-failed"
          title="Project sync needs attention"
          message={msg}
          lastGoodAt={lastSyncAt}
          onRetry={sync}
          busy={syncing}
        />
      )}

      {manualOpen && (
        <Modal title="Add project" onClose={() => setManualOpen(false)} width={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="px-section-note">
              Add a project to the local project list. Work tracking needs a verified GitHub link before any work record is saved.
            </div>
            <Field label="project name">
              <Input value={manualProject.name} onChange={e => setManualProject({ ...manualProject, name: e.target.value })} />
            </Field>
            <Field label="GitHub project link">
              <Input
                value={manualProject.repoUrl}
                onChange={e => setManualProject({ ...manualProject, repoUrl: e.target.value })}
                placeholder="org/repo or paste repository URL"
              />
            </Field>
            {manualError && <DegradedStatePanel title="Project needs attention" message={manualError} tone="error" />}
            <CommandDock align="start">
              <Button onClick={createManualProject} disabled={!manualProject.name.trim() || verifying}>{verifying ? 'Saving' : 'Save project'}</Button>
              <Button variant="ghost" onClick={() => setManualOpen(false)} disabled={verifying}>Cancel</Button>
            </CommandDock>
          </div>
        </Modal>
      )}

      {repoProject && (
        <Modal title={`Project link · ${repoProject.name}`} onClose={() => setRepoProject(null)} width={520}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="px-section-note">
              A project needs a verified GitHub link before Plexus can create new Today sessions or work records.
              Public projects can be checked from a GitHub link; private projects need the workspace GitHub connection.
            </div>
            <FieldDock>
              <Field label="saved or suggested project">
                <Select value={repoUrl} onChange={e => setRepoUrl(e.target.value)}>
                  <option value="">Select a project link or add one below...</option>
                  {repoOptions.map((option) => (
                    <option key={`${option.source}:${option.url}`} value={option.url}>{option.fullName}</option>
                  ))}
                </Select>
              </Field>
              <Field label="add GitHub link">
                <Input
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  placeholder="org/repo or paste repository URL"
                />
              </Field>
            </FieldDock>
            {repoError && <DegradedStatePanel variant="repo-missing" title="GitHub link needs attention" message={repoError} />}
            <CommandDock align="start">
              <Button onClick={verifyRepo} disabled={verifying || !repoUrl.trim()}>{verifying ? 'Checking' : 'Check link'}</Button>
              <Button variant="ghost" onClick={() => setRepoProject(null)} disabled={verifying}>Cancel</Button>
            </CommandDock>
          </div>
        </Modal>
      )}

      <MetricRailGroup>
        <MetricRail label="projects" value={projects.length} tone="mint" hint="assigned projects" />
        <MetricRail label="ready" value={verifiedCount} tone={verifiedCount ? 'accent' : 'idle'} hint="ready for work" />
        <MetricRail label="needs setup" value={needsRepoCount} tone={needsRepoCount ? 'warning' : 'idle'} hint="action needed" />
        <MetricRail label="attention" value={inaccessibleCount} tone={inaccessibleCount ? 'error' : 'idle'} hint="link needs review" />
      </MetricRailGroup>

      {vaultScan && (
        <InstrumentPanel
          label="assigned projects"
          title="Projects ready to add"
          note={vaultScan.candidates.length > 0
            ? `${vaultScan.candidates.length} assigned project${vaultScan.candidates.length === 1 ? '' : 's'} ready to review`
            : 'No assigned projects are ready to add from this device.'}
          trace
        >
          {vaultScan.candidates.length === 0 ? (
            <EmptyStatePanel
              icon={<IconProjects s={26} />}
              title="No assigned projects found"
              message="No assigned projects are available to add right now."
            />
          ) : (
            <Ledger>
              {vaultScan.candidates.slice(0, 12).map((candidate, i) => (
                <LedgerRail
                  key={`${candidate.code}:${i}`}
                  index={String(i + 1).padStart(2, '0')}
                  marker={<span className="px-swatch" style={{ background: candidate.cachedRepoStatus === 'verified' ? 'var(--accent)' : 'var(--t3)' }} />}
                  title={candidate.name}
                  meta={candidate.githubRepoFullName ?? 'GitHub link not connected'}
                  status={vaultStatus(candidate)}
                  statusTone={vaultTone(candidate)}
                />
              ))}
            </Ledger>
          )}
        </InstrumentPanel>
      )}

      <InstrumentPanel
        label="projects"
        title={needsOnly ? 'Projects needing setup' : 'Projects ready for work tracking'}
        note="New work records need a verified GitHub link. Missing setup is actionable, not a fatal project state."
        trace
      >
        {projects.length === 0 ? (
          <EmptyStatePanel
            icon={<IconProjects s={26} />}
            title="No projects in the local project list"
            message="Sync pulls assigned projects from the workspace once the connection is ready."
            action={<Button onClick={sync} disabled={syncing}><IconSync s={14} /> Sync</Button>}
          />
        ) : (
          <Ledger>
            {visibleProjects.map((p, i) => (
              <LedgerRail
                key={p.id}
                index={String(i + 1).padStart(2, '0')}
                marker={<span className="px-swatch" style={{ background: p.color }} />}
                title={p.name}
                meta={(
                  <div style={{ display: 'grid', gap: 8 }}>
                    <span>{`${p.clientName ? `${p.clientName} · ` : ''}${p.githubRepoFullName ?? 'GitHub link needed'}`}</span>
                    {githubUrl(p) && (
                      <CommandDock align="start" compact>
                        <StatusChip tone="idle">Last commit: {projectIntel[p.id]?.lastCommit ?? 'loading'}</StatusChip>
                        <StatusChip tone="idle">PRs: {projectIntel[p.id]?.openPrs ?? 'loading'}</StatusChip>
                        <StatusChip tone={projectIntel[p.id]?.evidenceTone ?? 'idle'}>Evidence: {projectIntel[p.id]?.evidence ?? 'loading'}</StatusChip>
                      </CommandDock>
                    )}
                  </div>
                )}
                status={projectStatus(p)}
                statusTone={projectTone(p)}
                value={linkedAge(p)}
                action={(
                  <CommandDock compact>
                    {githubUrl(p) && (
                      <>
                        <Button variant="ghost" onClick={() => openProjectUrl(p, '/commits')}>
                          Last Commit
                        </Button>
                        <Button variant="ghost" onClick={() => openProjectUrl(p, '/pulls')}>
                          Open PRs
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" onClick={() => openRepoModal(p)}>
                      {repoReady(p) ? 'Update link' : 'Add link'}
                    </Button>
                  </CommandDock>
                )}
              />
            ))}
          </Ledger>
        )}
      </InstrumentPanel>
    </div>
  );
}
