import React, { useCallback, useState, useEffect } from 'react';
import type { GitHubRepoOption, TimeEntry, Project } from '../../shared/types';
import { hasVerifiedGitHubRepository } from '../../shared/github-repository-authority';
import { PageHeader, Button, Field, Input, Select, Modal, fmtHM, localDateString } from './ui';
import { IconCheck, IconClock, IconLink, IconPlus, IconTrash, IconEntries } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  FieldDock,
  Ledger,
  LedgerRail,
  type PlexusTone,
} from './PlexusUI';

interface Props {
  projects: Project[];
  onChange: () => void;
}

type ResolverMode = 'existing' | 'unlisted';

interface EntryDraft {
  projectId: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

const UNLISTED_PROJECT = '__unlisted_project__';

function localTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function defaultEntryDraft(): EntryDraft {
  const end = new Date();
  end.setSeconds(0, 0);
  const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);
  return {
    projectId: '',
    description: '',
    startDate: localDateString(start),
    startTime: localTimeString(start),
    endDate: localDateString(end),
    endTime: localTimeString(end),
  };
}

function localDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function hasVerifiedRepo(project?: Project | null): boolean {
  return hasVerifiedGitHubRepository(project);
}

export default function TimeEntryList({ projects, onChange }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return localDateString(d);
  });
  const [to, setTo] = useState(() => localDateString());
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState<EntryDraft>(() => defaultEntryDraft());
  const [resolverMode, setResolverMode] = useState<ResolverMode>('existing');
  const [repositoryId, setRepositoryId] = useState('');
  const [repoOptions, setRepoOptions] = useState<GitHubRepoOption[]>([]);
  const [repoOptionsMessage, setRepoOptionsMessage] = useState('');
  const [canManageRepositories, setCanManageRepositories] = useState(false);
  const [unlistedProject, setUnlistedProject] = useState({ name: '', clientName: '', repositoryId: '' });
  const [resolvedProject, setResolvedProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await window.plexus.entryList(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`);
      setEntries(list);
      setLoadedAt(new Date().toISOString());
      setError('');
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    window.plexus.authSession()
      .then(async (session) => {
        if (cancelled) return;
        const isAdmin = session?.role === 'admin';
        setCanManageRepositories(isAdmin);
        if (!isAdmin) {
          setRepoOptions([]);
          setRepoOptionsMessage('Ask a workspace administrator to bind this project to a GitHub repository.');
          return;
        }
        const result = await window.plexus.githubRepositories();
        if (cancelled) return;
        setRepoOptions(result.repositories);
        setRepoOptionsMessage(result.message ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setCanManageRepositories(false);
        setRepoOptions([]);
        setRepoOptionsMessage('Ask a workspace administrator to bind this project to a GitHub repository.');
      });
    return () => {
      cancelled = true;
    };
  }, [projects.length]);

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || `Project ${id.slice(0, 8)}`;
  const projectColor = (id: string) => projects.find(p => p.id === id)?.color || 'var(--t3)';
  const projectRepo = (id: string) => projects.find(p => p.id === id)?.githubRepoFullName;
  const projectRecord = (id: string) => projects.find(p => p.id === id) ?? (resolvedProject?.id === id ? resolvedProject : undefined);
  const evidenceTone = (status?: string | null): PlexusTone => {
    if (status === 'matched') return 'accent';
    if (status === 'missing' || status === 'pending' || status === 'legacy_unverified') return 'warning';
    if (status === 'sync_failed') return 'error';
    return 'idle';
  };
  const repoReady = (id: string) => {
    return hasVerifiedRepo(projectRecord(id));
  };

  const selectedProject = newEntry.projectId ? projectRecord(newEntry.projectId) : undefined;
  const selectedNeedsRepo = Boolean(selectedProject && !repoReady(selectedProject.id));
  const selectedUnlistedRepo = repoOptions.find((option) => String(option.id) === unlistedProject.repositoryId);
  const inferredUnlistedName = unlistedProject.name.trim()
    || selectedUnlistedRepo?.fullName.split('/').at(-1)?.replace(/[-_]+/g, ' ')
    || '';
  const canAttemptCreate = Boolean(
    !busy &&
    newEntry.description.trim() &&
    newEntry.startDate &&
    newEntry.startTime &&
    newEntry.endDate &&
    newEntry.endTime &&
    (
      resolverMode === 'unlisted'
        ? canManageRepositories && inferredUnlistedName && unlistedProject.repositoryId
        : newEntry.projectId && (repoReady(newEntry.projectId) || (canManageRepositories && repositoryId))
    ),
  );

  const resetManualForm = () => {
    setNewEntry(defaultEntryDraft());
    setResolverMode('existing');
    setRepositoryId('');
    setUnlistedProject({ name: '', clientName: '', repositoryId: '' });
    setResolvedProject(null);
    setError('');
  };

  const openManualForm = () => {
    resetManualForm();
    setShowForm(true);
  };

  const handleProjectSelect = (value: string) => {
    if (value === UNLISTED_PROJECT) {
      if (!canManageRepositories) {
        setError('Only workspace administrators can add and bind an unlisted project.');
        return;
      }
      setResolverMode('unlisted');
      setNewEntry({ ...newEntry, projectId: '' });
      setRepositoryId('');
      return;
    }
    const project = projects.find(p => p.id === value);
    setResolverMode('existing');
    setNewEntry({ ...newEntry, projectId: value });
    setRepositoryId(project?.githubRepoId && /^\d+$/.test(project.githubRepoId) ? project.githubRepoId : '');
    setResolvedProject(project ?? null);
  };

  const verifyExistingProject = async (projectId: string): Promise<string | null> => {
    if (repoReady(projectId)) return projectId;
    if (!canManageRepositories) {
      setError(`${selectedProject?.name ?? 'This project'} needs repository setup by a workspace administrator before work can be recorded.`);
      return null;
    }
    const selectedId = Number(repositoryId || selectedProject?.githubRepoId || '');
    const selectedRepository = repoOptions.find((option) => option.id === selectedId);
    if (!Number.isSafeInteger(selectedId) || selectedId <= 0 || !selectedRepository) {
      setError(`${selectedProject?.name ?? 'This project'} needs a repository selected from the workspace GitHub App.`);
      return null;
    }
    setBusy('verify');
    const result = await window.plexus.projectVerifyRepo(projectId, selectedRepository.installationId, selectedId);
    if (!result.ok || !result.project) {
      setError(result.message ?? 'Repository verification failed.');
      return null;
    }
    setResolvedProject(result.project);
    setRepositoryId(result.project.githubRepoId ?? String(selectedId));
    await onChange();
    return projectId;
  };

  const createAndVerifyUnlistedProject = async (): Promise<string | null> => {
    if (!canManageRepositories) {
      setError('Only workspace administrators can add and bind an unlisted project.');
      return null;
    }
    const selectedId = Number(unlistedProject.repositoryId);
    const selectedRepository = repoOptions.find((option) => option.id === selectedId);
    const name = inferredUnlistedName;
    if (!name || !Number.isSafeInteger(selectedId) || selectedId <= 0 || !selectedRepository) {
      setError('Add a project or brand name and select a workspace GitHub repository before saving this record.');
      return null;
    }
    setBusy('resolve');
    const created = await window.plexus.projectCreate({
      name,
      clientName: unlistedProject.clientName.trim() || undefined,
      color: '#56C8B0',
      archived: false,
      repoEvidenceStatus: 'missing',
      repoRequired: true,
      evidenceStatus: 'missing',
    });
    setResolvedProject(created);
    setResolverMode('existing');
    setNewEntry({ ...newEntry, projectId: created.id });
    setRepositoryId(String(selectedId));
    await onChange();

    setBusy('verify');
    const result = await window.plexus.projectVerifyRepo(created.id, selectedRepository.installationId, selectedId);
    if (!result.ok || !result.project) {
      setError(result.message ?? 'Project was cached, but the repo could not be verified yet.');
      return null;
    }
    setResolvedProject(result.project);
    setRepositoryId(result.project.githubRepoId ?? String(selectedId));
    await onChange();
    return created.id;
  };

  const resolveProjectForEntry = async (): Promise<string | null> => {
    if (resolverMode === 'unlisted') return createAndVerifyUnlistedProject();
    if (!newEntry.projectId) {
      setError('Select a project before saving this work record.');
      return null;
    }
    return verifyExistingProject(newEntry.projectId);
  };

  const handleCreate = async () => {
    if (!newEntry.description.trim() || !newEntry.startDate || !newEntry.startTime || !newEntry.endDate || !newEntry.endTime || busy) return;
    const start = localDateTime(newEntry.startDate, newEntry.startTime);
    const end = localDateTime(newEntry.endDate, newEntry.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError('End time must be after start time.');
      return;
    }
    setBusy('create');
    setError('');
    try {
      const projectId = await resolveProjectForEntry();
      if (!projectId) return;
      setBusy('create');
      await window.plexus.entryCreate({
        projectId,
        description: newEntry.description.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        tags: [],
        source: 'manual',
      });
      resetManualForm();
      setShowForm(false);
      await load();
      onChange();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  const shiftEndByMinutes = (minutes: number) => {
    if (!newEntry.startDate || !newEntry.startTime) return;
    const start = localDateTime(newEntry.startDate, newEntry.startTime);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + minutes * 60 * 1000);
    setNewEntry({
      ...newEntry,
      endDate: localDateString(end),
      endTime: localTimeString(end),
    });
  };

  const useCurrentEndTime = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    setNewEntry({
      ...newEntry,
      endDate: localDateString(now),
      endTime: localTimeString(now),
    });
  };

  const closeManualForm = () => {
    if (busy) return;
    resetManualForm();
    setShowForm(false);
  };

  const selectedProjectState = selectedProject
    ? repoReady(selectedProject.id) ? 'verified' : selectedProject.repoEvidenceStatus === 'inaccessible' ? 'inaccessible' : 'needs repo'
    : 'not selected';

  const selectedProjectMeta = selectedProject
    ? selectedProject.githubRepoFullName ?? selectedProject.githubRepoUrl ?? 'GitHub repo required'
    : 'Choose from local cache or add an unlisted project';

  const selectedProjectTone: PlexusTone = selectedProjectState === 'verified'
    ? 'accent'
    : selectedProjectState === 'inaccessible' ? 'error' : selectedProjectState === 'needs repo' ? 'warning' : 'idle';

  const durationMinutes = (() => {
    if (!newEntry.startDate || !newEntry.startTime || !newEntry.endDate || !newEntry.endTime) return null;
    const start = localDateTime(newEntry.startDate, newEntry.startTime);
    const end = localDateTime(newEntry.endDate, newEntry.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    return Math.round((end.getTime() - start.getTime()) / 60000);
  })();

  const durationLabel = durationMinutes === null
    ? 'invalid window'
    : durationMinutes >= 60
      ? `${Math.floor(durationMinutes / 60)}h ${String(durationMinutes % 60).padStart(2, '0')}m`
      : `${durationMinutes}m`;

  const projectOptionLabel = (project: Project) => {
    const status = repoReady(project.id) ? project.githubRepoFullName : 'repo setup required';
    return `${project.name} · ${status}`;
  };

  const projectFilter = [
    ...(resolvedProject && !projects.some(project => project.id === resolvedProject.id) ? [resolvedProject] : []),
    ...projects.filter(project => !project.archived),
  ];

  const handleDelete = async (id: string) => {
    if (busy || !confirm('Delete this entry?')) return;
    setBusy(id);
    setError('');
    try {
      await window.plexus.entryDelete(id);
      await load();
      onChange();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Work Records"
        sub={`${from} -> ${to} · repo-backed ledger`}
        right={(
          <CommandDock>
            <Button onClick={openManualForm}><IconPlus /> Manual Record</Button>
          </CommandDock>
        )}
      />

      <FieldDock>
        <Field label="from">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </Field>
        <Field label="to">
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </Field>
      </FieldDock>

      {error && !showForm && (
        <DegradedStatePanel
          title="Entries action failed"
          message={error}
          tone="error"
          lastGoodAt={loadedAt}
          onRetry={load}
          busy={Boolean(busy)}
        />
      )}

      {showForm && (
        <Modal title="Manual Work Record" onClose={closeManualForm} width={760}>
          <div className="px-work-entry">
            {error && (
              <DegradedStatePanel
                title="Manual resolver needs attention"
                message={error}
                tone="error"
                busy={Boolean(busy)}
              />
            )}

            <section className="px-work-entry-band">
              <div className="px-work-entry-head">
                <span className="px-lbl">project resolver</span>
                <span className={`pxds-chip tone-${selectedProjectTone}`}>{resolverMode === 'unlisted' ? 'new project' : selectedProjectState}</span>
              </div>
              <div className="px-work-entry-project-grid">
                <Field label="project" className="px-work-entry-main-field">
                  <Select
                    className="px-entry-native-select"
                    value={resolverMode === 'unlisted' ? UNLISTED_PROJECT : newEntry.projectId}
                    onChange={e => handleProjectSelect(e.target.value)}
                  >
                    <option value="">Select project...</option>
                    {projectFilter.map(p => (
                      <option key={p.id} value={p.id}>{projectOptionLabel(p)}</option>
                    ))}
                    {canManageRepositories && <option value={UNLISTED_PROJECT}>Add unlisted project or repo...</option>}
                  </Select>
                </Field>
                <div className="px-work-entry-resolver-status">
                  <span className="px-swatch" style={{ background: selectedProject ? projectColor(selectedProject.id) : 'var(--t3)' }} />
                  <div>
                    <strong>{resolverMode === 'unlisted' ? inferredUnlistedName || 'Unlisted project' : selectedProject?.name ?? 'No project selected'}</strong>
                    <small>{resolverMode === 'unlisted' ? selectedUnlistedRepo?.fullName ?? 'Workspace GitHub repository required' : selectedProjectMeta}</small>
                  </div>
                </div>
              </div>

              {resolverMode === 'unlisted' ? (
                <div className="px-work-entry-unlisted">
                  <Field label="project / brand">
                    <Input
                      value={unlistedProject.name}
                      onChange={e => setUnlistedProject({ ...unlistedProject, name: e.target.value })}
                      placeholder={selectedUnlistedRepo?.fullName.split('/').at(-1)?.replace(/[-_]+/g, ' ') || 'Project, brand, or product'}
                    />
                  </Field>
                  <Field label="client">
                    <Input
                      value={unlistedProject.clientName}
                      onChange={e => setUnlistedProject({ ...unlistedProject, clientName: e.target.value })}
                      placeholder="Optional client"
                    />
                  </Field>
                  <Field label="GitHub repo">
                    <Select
                      value={unlistedProject.repositoryId}
                      onChange={e => setUnlistedProject({ ...unlistedProject, repositoryId: e.target.value })}
                    >
                      <option value="">Select installation repository...</option>
                      {repoOptions.map((option) => (
                        <option key={`${option.installationId}:${option.id}`} value={String(option.id)}>{option.account.login} · {option.fullName}{option.private ? ' · private' : ''}</option>
                      ))}
                    </Select>
                  </Field>
                  {repoOptionsMessage && <div className="px-section-note">{repoOptionsMessage}</div>}
                </div>
              ) : selectedNeedsRepo && canManageRepositories ? (
                <div className="px-work-entry-linker">
                  <IconLink s={15} />
                  <Field label="repo to verify">
                    <Select value={repositoryId} onChange={e => setRepositoryId(e.target.value)}>
                      <option value="">Select installation repository...</option>
                      {repoOptions.map((option) => (
                        <option key={`${option.installationId}:${option.id}`} value={String(option.id)}>{option.account.login} · {option.fullName}{option.private ? ' · private' : ''}</option>
                      ))}
                    </Select>
                  </Field>
                  {repoOptionsMessage && <div className="px-section-note">{repoOptionsMessage}</div>}
                </div>
              ) : selectedNeedsRepo ? (
                <div className="px-section-note">Ask a workspace administrator to bind this project to an installation repository before recording work.</div>
              ) : null}
            </section>

            <section className="px-work-entry-band">
              <div className="px-work-entry-head">
                <span className="px-lbl">work window</span>
                <span className="px-work-entry-duration"><IconClock s={13} /> {durationLabel}</span>
              </div>
              <div className="px-work-entry-time-grid">
                <div className="px-work-entry-time-block">
                  <span className="px-work-entry-time-label">start</span>
                  <Input type="date" value={newEntry.startDate} onChange={e => setNewEntry({ ...newEntry, startDate: e.target.value })} />
                  <Input type="time" value={newEntry.startTime} onChange={e => setNewEntry({ ...newEntry, startTime: e.target.value })} />
                </div>
                <div className="px-work-entry-time-block">
                  <span className="px-work-entry-time-label">end</span>
                  <Input type="date" value={newEntry.endDate} onChange={e => setNewEntry({ ...newEntry, endDate: e.target.value })} />
                  <Input type="time" value={newEntry.endTime} onChange={e => setNewEntry({ ...newEntry, endTime: e.target.value })} />
                </div>
              </div>
              <CommandDock align="start" compact>
                <Button variant="ghost" onClick={() => shiftEndByMinutes(30)}>30m</Button>
                <Button variant="ghost" onClick={() => shiftEndByMinutes(60)}>1h</Button>
                <Button variant="ghost" onClick={() => shiftEndByMinutes(120)}>2h</Button>
                <Button variant="ghost" onClick={useCurrentEndTime}>Now</Button>
              </CommandDock>
            </section>

            <section className="px-work-entry-band">
              <Field label="description">
                <Input
                  value={newEntry.description}
                  onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
                  aria-label="Manual work record description"
                  title="Required work description for this manual record."
                  placeholder="What work should this record capture?"
                />
              </Field>
            </section>

            <CommandDock align="start">
              <Button onClick={handleCreate} disabled={!canAttemptCreate}>
                {busy ? 'Resolving' : <><IconCheck s={14} /> Add Record</>}
              </Button>
              <Button variant="ghost" onClick={closeManualForm} disabled={Boolean(busy)}>Cancel</Button>
            </CommandDock>
          </div>
        </Modal>
      )}

      {entries.length === 0 ? (
        <EmptyStatePanel
          variant="no-records"
          icon={<IconEntries s={26} />}
          action={<Button variant="ghost" onClick={openManualForm}><IconPlus /> Manual Record</Button>}
        />
      ) : (
        <Ledger>
          {entries.map(e => {
            const repo = e.githubRepoFullName ?? projectRepo(e.projectId) ?? 'legacy unverified';
            return (
              <LedgerRail
                key={e.id}
                marker={<span className="px-swatch" style={{ background: projectColor(e.projectId) }} />}
                title={e.description}
                meta={`${projectName(e.projectId)} · ${new Date(e.startTime).toLocaleString()}${e.endTime ? ` -> ${new Date(e.endTime).toLocaleTimeString()}` : ''} · ${repo}`}
                status={e.evidenceStatus ?? 'pending'}
                statusTone={evidenceTone(e.evidenceStatus)}
                value={fmtHM(e.durationSeconds)}
                action={(
                  <Button variant="ghost" onClick={() => handleDelete(e.id)} disabled={busy === e.id} aria-label="Delete">
                    <IconTrash />
                  </Button>
                )}
              />
            );
          })}
        </Ledger>
      )}
    </div>
  );
}
