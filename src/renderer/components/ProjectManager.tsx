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
    if (repoReady(project)) return 'repo verified';
    if (project.repoEvidenceStatus === 'inaccessible') return 'inaccessible';
    return 'needs repo';
  };
  const vaultTone = (candidate: VaultProjectCandidate): PlexusTone => {
    if (candidate.cachedRepoStatus === 'verified') return 'accent';
    if (candidate.cachedProjectId) return 'warning';
    return 'idle';
  };
  const vaultStatus = (candidate: VaultProjectCandidate) => {
    if (candidate.cachedRepoStatus === 'verified') return 'repo verified';
    if (candidate.cachedProjectId) return 'cached';
    return 'candidate';
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

  const scanVault = async (mode: 'scan' | 'import') => {
    if (vaultBusy) return;
    setVaultBusy(mode);
    setMsg(mode === 'import' ? 'Importing vault…' : 'Scanning vault…');
    setSyncOk(null);
    try {
      const result = mode === 'import'
        ? await window.plexus.projectImportVault()
        : await window.plexus.projectScanVault();
      setVaultScan(result);
      setSyncOk(result.ok);
      setMsg(result.message ?? (result.ok ? 'Vault scan complete' : 'Vault scan failed'));
      if (mode === 'import' && result.ok) {
        await onChange();
        const options = await window.plexus.projectRepoOptions().catch(() => [] as GitHubRepoOption[]);
        setRepoOptions(options);
      }
    } catch (err: any) {
      setSyncOk(false);
      setMsg(err?.message ?? String(err));
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
          setManualError(result.message ?? 'Project was cached, but repo verification failed.');
          await onChange();
          return;
        }
      }
      setManualProject({ name: '', repoUrl: '' });
      setManualOpen(false);
      await onChange();
    } catch (err: any) {
      setManualError(err?.message ?? String(err));
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
        sub={`${projects.length} · GitHub-backed work surfaces`}
        right={
          <CommandDock>
            {msg && <StatusChip tone={syncOk === false ? 'error' : syncOk ? 'accent' : 'idle'}>{msg}</StatusChip>}
            <Button variant="ghost" onClick={() => setNeedsOnly(v => !v)}>{needsOnly ? 'Show All' : 'Needs Repo'}</Button>
            <Button variant="ghost" onClick={() => scanVault('scan')} disabled={vaultBusy !== null}><IconProjects s={14} /> {vaultBusy === 'scan' ? 'Scanning' : 'Scan Vault'}</Button>
            <Button variant="ghost" onClick={() => scanVault('import')} disabled={vaultBusy !== null}><IconSync s={14} /> {vaultBusy === 'import' ? 'Importing' : 'Import Vault'}</Button>
            <Button variant="ghost" onClick={() => setManualOpen(true)}><IconPlus s={14} /> Manual</Button>
            <Button onClick={sync} disabled={syncing}><IconSync s={14} /> {syncing ? 'Syncing…' : 'Sync'}</Button>
          </CommandDock>
        }
      />

      {syncOk === false && msg && (
        <DegradedStatePanel
          title="Project sync degraded"
          message={msg}
          tone="error"
          lastGoodAt={lastSyncAt}
          onRetry={sync}
          busy={syncing}
        />
      )}

      {manualOpen && (
        <Modal title="Manual project resolver" onClose={() => setManualOpen(false)} width={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="px-section-note">
              Manual entries seed the local resolver cache. Work capture still requires a verified GitHub repo before any time row is saved.
            </div>
            <Field label="project name">
              <Input value={manualProject.name} onChange={e => setManualProject({ ...manualProject, name: e.target.value })} />
            </Field>
            <Field label="GitHub repo URL">
              <Input
                value={manualProject.repoUrl}
                onChange={e => setManualProject({ ...manualProject, repoUrl: e.target.value })}
                placeholder="https://github.com/org/repo"
              />
            </Field>
            {manualError && <DegradedStatePanel title="Manual resolver failed" message={manualError} tone="error" />}
            <CommandDock align="start">
              <Button onClick={createManualProject} disabled={!manualProject.name.trim() || verifying}>{verifying ? 'Saving' : 'Save Resolver'}</Button>
              <Button variant="ghost" onClick={() => setManualOpen(false)} disabled={verifying}>Cancel</Button>
            </CommandDock>
          </div>
        </Modal>
      )}

      {repoProject && (
        <Modal title={`GitHub repo · ${repoProject.name}`} onClose={() => setRepoProject(null)} width={520}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="px-section-note">
              A project must have a verified GitHub repository before Plexus can create new focus sessions or manual entries.
              Public repos can be verified locally by URL; private repos need the workspace GitHub integration.
            </div>
            <FieldDock>
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
            </FieldDock>
            {repoError && <DegradedStatePanel title="GitHub verification failed" message={repoError} tone="error" />}
            <CommandDock align="start">
              <Button onClick={verifyRepo} disabled={verifying || !repoUrl.trim()}>{verifying ? 'Verifying' : 'Verify Repo'}</Button>
              <Button variant="ghost" onClick={() => setRepoProject(null)} disabled={verifying}>Cancel</Button>
            </CommandDock>
          </div>
        </Modal>
      )}

      <MetricRailGroup>
        <MetricRail label="total" value={projects.length} tone="mint" hint="workspace surfaces" />
        <MetricRail label="verified" value={verifiedCount} tone={verifiedCount ? 'accent' : 'idle'} hint="ready for work" />
        <MetricRail label="needs repo" value={needsRepoCount} tone={needsRepoCount ? 'warning' : 'idle'} hint="setup required" />
        <MetricRail label="inaccessible" value={inaccessibleCount} tone={inaccessibleCount ? 'error' : 'idle'} hint="verification failed" />
      </MetricRailGroup>

      {vaultScan && (
        <InstrumentPanel
          label="vault scanner"
          title="R2 / Paperclip project resolver"
          note={vaultScan.repoRoot ? `${vaultScan.candidates.length} candidates from ${vaultScan.repoRoot}` : 'Paperclip vault root is not configured on this device.'}
          trace
        >
          {vaultScan.candidates.length === 0 ? (
            <EmptyStatePanel
              icon={<IconProjects s={26} />}
              title="No vault project candidates"
              message={vaultScan.message ?? 'The scanner did not find project configs or vault project folders.'}
            />
          ) : (
            <Ledger>
              {vaultScan.candidates.slice(0, 12).map((candidate, i) => (
                <LedgerRail
                  key={`${candidate.code}:${candidate.sourcePath}`}
                  index={String(i + 1).padStart(2, '0')}
                  marker={<span className="px-swatch" style={{ background: candidate.cachedRepoStatus === 'verified' ? 'var(--accent)' : 'var(--t3)' }} />}
                  title={`${candidate.code} · ${candidate.name}`}
                  meta={`${candidate.githubRepoFullName ?? 'GitHub repo not declared'} · ${candidate.status}`}
                  status={vaultStatus(candidate)}
                  statusTone={vaultTone(candidate)}
                />
              ))}
            </Ledger>
          )}
        </InstrumentPanel>
      )}

      <InstrumentPanel
        label="workspace projects"
        title={needsOnly ? 'Projects needing GitHub proof' : 'Project proof coverage'}
        note="New work records require verified GitHub repository bindings; missing setup is actionable, not a fatal project state."
        trace
      >
        {projects.length === 0 ? (
          <EmptyStatePanel
            icon={<IconProjects s={26} />}
            title="No projects in the local cache"
            message="Sync pulls assigned projects from the workspace service once the connection is configured."
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
                meta={`${p.clientName ? `${p.clientName} · ` : ''}${p.githubRepoFullName ?? 'GitHub repo required'}`}
                status={projectStatus(p)}
                statusTone={projectTone(p)}
                action={(
                  <Button variant="ghost" onClick={() => openRepoModal(p)}>
                    {repoReady(p) ? 'Update Repo' : 'Add Repo'}
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
