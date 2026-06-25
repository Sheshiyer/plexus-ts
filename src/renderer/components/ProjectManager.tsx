import React, { useEffect, useState } from 'react';
import type { GitHubRepoOption, Project, VaultProjectCandidate, VaultProjectScanResult } from '../../shared/types';
import { PageHeader, Button, Modal, Field, Input, Select } from './ui';
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
  const [vaultScan, setVaultScan] = useState<VaultProjectScanResult | null>(null);
  const [vaultBusy, setVaultBusy] = useState<'scan' | 'import' | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualProject, setManualProject] = useState({ name: '', repoUrl: '' });
  const [manualError, setManualError] = useState('');

  useEffect(() => {
    window.plexus.projectRepoOptions().then(setRepoOptions).catch(() => setRepoOptions([]));
  }, [projects.length]);

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
        setRepoError('Check the GitHub link and try again.');
        return;
      }
      setSyncOk(true);
      setMsg(`${result.repo?.fullName ?? 'Project link'} checked`);
      setRepoProject(null);
      await onChange();
      const options = await window.plexus.projectRepoOptions().catch(() => [] as GitHubRepoOption[]);
      setRepoOptions(options);
    } catch {
      setRepoError('Check the GitHub link and try again.');
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
    const repo = manualProject.repoUrl.trim();
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
          setManualError('Project was added to the local project list, but the GitHub link needs attention.');
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
          title="Project sync needs attention"
          message={msg}
          tone="error"
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
                placeholder="github.com/org/project"
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
              A project needs a verified GitHub link before Plexus can create new focus sessions or work records.
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
                <Input value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
              </Field>
            </FieldDock>
            {repoError && <DegradedStatePanel title="GitHub link needs attention" message={repoError} tone="error" />}
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
                meta={`${p.clientName ? `${p.clientName} · ` : ''}${p.githubRepoFullName ?? 'GitHub link needed'}`}
                status={projectStatus(p)}
                statusTone={projectTone(p)}
                action={(
                  <Button variant="ghost" onClick={() => openRepoModal(p)}>
                    {repoReady(p) ? 'Update link' : 'Add link'}
                  </Button>
                )}
              />
            ))}
          </Ledger>
        )}
      </InstrumentPanel>
    </div>
  );
}
