import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  THOUGHTSEED_GITHUB_OPTIONAL_INSTALLATION_TARGETS,
  THOUGHTSEED_GITHUB_WORKSPACE_TARGET,
} from '../../src/shared/founder-github-setup';
import {
  githubWorkspaceConnectionTarget,
  hasConnectedGitHubWorkspaceInstallation,
} from '../../src/shared/github-connection-status';
import {
  matchWorkspaceRepository,
  normalizeGitHubRepositoryFullName,
  projectLinkedToGitHubRepository,
} from '../../src/shared/github-project-linking';
import type {
  GitHubConnectionStatus,
  GitHubRepoOption,
  GitHubRepositoryListResult,
  Project,
  VaultProjectCandidate,
} from '../../src/shared/types';
import { loadIsolatedAssistantDatabase } from './fixtures/database';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function repository(
  id: number,
  fullName: string,
  owner = THOUGHTSEED_GITHUB_WORKSPACE_TARGET,
): GitHubRepoOption {
  return {
    id,
    installationId: owner.id + 1000,
    repositorySelection: 'all',
    account: { ...owner },
    fullName,
    url: `https://github.com/${fullName}`,
    source: 'worker',
    private: true,
  };
}

function connection(
  targets: NonNullable<GitHubConnectionStatus['targets']>,
  status: GitHubConnectionStatus['status'] = 'connected',
): GitHubConnectionStatus {
  return {
    status,
    installations: targets.flatMap((target) => target.installationId
      ? [{
        installationId: target.installationId,
        repositorySelection: target.repositorySelection,
        account: target.account,
        status: target.status,
      }]
      : []),
    allowedTargets: [
      THOUGHTSEED_GITHUB_WORKSPACE_TARGET,
      ...THOUGHTSEED_GITHUB_OPTIONAL_INSTALLATION_TARGETS,
    ],
    targets,
    repositoryCount: 0,
  };
}

describe('central workspace repository authority', () => {
  it('keeps founder personal installations optional while pinning one workspace target', () => {
    expect(THOUGHTSEED_GITHUB_WORKSPACE_TARGET).toEqual({
      id: 65741640,
      login: 'thoughtseed-labs',
      type: 'Organization',
    });
    expect(THOUGHTSEED_GITHUB_OPTIONAL_INSTALLATION_TARGETS.map((target) => target.login))
      .toEqual(['Sheshiyer', 'psychon7']);
  });

  it('does not accept a personal installation as workspace readiness', () => {
    const personalOnly = connection([
      {
        account: THOUGHTSEED_GITHUB_WORKSPACE_TARGET,
        status: 'unconfigured',
        reason: 'not_connected',
      },
      {
        account: THOUGHTSEED_GITHUB_OPTIONAL_INSTALLATION_TARGETS[0],
        installationId: 9001,
        repositorySelection: 'all',
        status: 'connected',
        reason: 'connected',
      },
      {
        account: THOUGHTSEED_GITHUB_OPTIONAL_INSTALLATION_TARGETS[1],
        status: 'unconfigured',
        reason: 'not_connected',
      },
    ]);

    expect(githubWorkspaceConnectionTarget(personalOnly)).toMatchObject({
      account: THOUGHTSEED_GITHUB_WORKSPACE_TARGET,
      status: 'unconfigured',
    });
    expect(hasConnectedGitHubWorkspaceInstallation(personalOnly)).toBe(false);
  });

  it('accepts the workspace installation without requiring either personal installation', () => {
    const workspaceOnly = connection([
      {
        account: THOUGHTSEED_GITHUB_WORKSPACE_TARGET,
        installationId: 9000,
        repositorySelection: 'all',
        status: 'connected',
        reason: 'connected',
      },
      ...THOUGHTSEED_GITHUB_OPTIONAL_INSTALLATION_TARGETS.map((account) => ({
        account,
        status: 'unconfigured' as const,
        reason: 'not_connected' as const,
      })),
    ]);

    expect(hasConnectedGitHubWorkspaceInstallation(workspaceOnly)).toBe(true);
  });
});

describe('exact organization-only vault matching', () => {
  const personalOwner = THOUGHTSEED_GITHUB_OPTIONAL_INSTALLATION_TARGETS[0];
  const repositories = [
    repository(11, 'thoughtseed-labs/plexus'),
    repository(21, 'Sheshiyer/private-project', personalOwner),
  ];

  it('normalizes only complete owner/repository values', () => {
    expect(normalizeGitHubRepositoryFullName(' Thoughtseed-Labs/Plexus ')).toBe('thoughtseed-labs/plexus');
    expect(normalizeGitHubRepositoryFullName('plexus')).toBeNull();
    expect(normalizeGitHubRepositoryFullName('thoughtseed-labs/plexus/issues')).toBeNull();
  });

  it('matches one exact thoughtseed-labs repository', () => {
    expect(matchWorkspaceRepository('THOUGHTSEED-LABS/PLEXUS', repositories)).toEqual({
      status: 'matched',
      repository: repositories[0],
    });
  });

  it('never auto-links a personal repository or falls back by basename', () => {
    expect(matchWorkspaceRepository('Sheshiyer/private-project', repositories)).toEqual({
      status: 'outside_workspace',
      repository: null,
    });
    expect(matchWorkspaceRepository('thoughtseed-labs/private-project', repositories)).toEqual({
      status: 'missing',
      repository: null,
    });
    expect(matchWorkspaceRepository('private-project', repositories)).toEqual({
      status: 'not_configured',
      repository: null,
    });
  });

  it('fails closed when the organization inventory is ambiguous', () => {
    const duplicate = repository(12, 'thoughtseed-labs/plexus');
    expect(matchWorkspaceRepository('thoughtseed-labs/plexus', [...repositories, duplicate])).toEqual({
      status: 'ambiguous',
      repository: null,
    });
  });
});

describe('workspace catalog integration contracts', () => {
  it('releases the binding queue after a verification exception', async () => {
    const { serializeGitHubRepositoryBinding } = await import('../../src/main/github-repository-binding-lock');
    await expect(serializeGitHubRepositoryBinding(async () => {
      throw new Error('verification failed');
    })).rejects.toThrow('verification failed');
    await expect(serializeGitHubRepositoryBinding(async () => 'next binding')).resolves.toBe('next binding');
  });

  it('persists an exact Worker-verified auto-link once and preserves manual precedence', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    try {
      const candidate: VaultProjectCandidate = {
        code: 'plexus',
        projectId: 'project_plexus',
        cachedProjectId: 'project_plexus',
        name: 'Plexus',
        status: 'active',
        sourcePath: '/bounded/fixture/plexus.yaml',
        githubRepoFullName: 'thoughtseed-labs/plexus',
        githubRepoUrl: 'https://github.com/thoughtseed-labs/plexus',
      };
      const project: Project = {
        id: 'project_plexus',
        name: 'Plexus',
        color: '#56C8B0',
        archived: false,
        createdAt: '2026-07-27T00:00:00.000Z',
        githubRepoFullName: candidate.githubRepoFullName,
        githubRepoUrl: candidate.githubRepoUrl,
        repoEvidenceStatus: 'unverified',
        repoRequired: true,
        evidenceStatus: 'pending',
      };
      await database.insertProject(project);
      const workspaceRepository = repository(11, 'thoughtseed-labs/plexus');
      const verifiedAt = '2026-07-27T00:01:00.000Z';
      const { autoLinkVaultProjectRepositories } = await import('../../src/main/vault-projects');
      const verify = async () => ({
        ok: true as const,
        status: 'verified' as const,
        repo: { ...workspaceRepository, verifiedAt },
        project: {
          ...project,
          githubInstallationId: workspaceRepository.installationId,
          githubRepoId: String(workspaceRepository.id),
          githubRepoOwnerId: workspaceRepository.account.id,
          githubRepoOwnerLogin: workspaceRepository.account.login,
          githubRepoOwnerType: workspaceRepository.account.type,
          repoVerifiedAt: verifiedAt,
          repoEvidenceStatus: 'verified' as const,
          repoAuthoritySource: 'worker' as const,
        },
      });

      await expect(autoLinkVaultProjectRepositories([candidate], [workspaceRepository], verify))
        .resolves.toEqual({ autoLinked: 1, failed: 0 });
      await expect(database.getProject(project.id)).resolves.toMatchObject({
        githubInstallationId: workspaceRepository.installationId,
        githubRepoId: String(workspaceRepository.id),
        githubRepoOwnerId: THOUGHTSEED_GITHUB_WORKSPACE_TARGET.id,
        repoBindingSource: 'vault_auto',
        repoBoundAt: verifiedAt,
        repoAuthoritySource: 'worker',
        repoEvidenceStatus: 'verified',
      });

      await expect(autoLinkVaultProjectRepositories([candidate], [workspaceRepository], verify))
        .resolves.toEqual({ autoLinked: 0, failed: 0 });
      await database.updateProject(project.id, { repoBindingSource: 'manual' });
      await expect(autoLinkVaultProjectRepositories([candidate], [workspaceRepository], verify))
        .resolves.toEqual({ autoLinked: 0, failed: 0 });
      await expect(database.getProject(project.id)).resolves.toMatchObject({
        repoBindingSource: 'manual',
        repoBoundAt: verifiedAt,
      });

      await database.insertProject({
        ...project,
        id: 'project_conflict',
        name: 'Conflicting Plexus',
      });
      await expect(autoLinkVaultProjectRepositories([
        { ...candidate, projectId: 'project_conflict', cachedProjectId: 'project_conflict' },
      ], [workspaceRepository], verify)).resolves.toEqual({ autoLinked: 0, failed: 1 });
      await expect(database.getProject('project_conflict')).resolves.toMatchObject({
        repoEvidenceStatus: 'unverified',
      });
    } finally {
      await cleanup();
    }
  });

  it('leaves failed automatic verification unverified for explicit selection', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    try {
      const candidate: VaultProjectCandidate = {
        code: 'plexus',
        projectId: 'project_failed',
        cachedProjectId: 'project_failed',
        name: 'Plexus',
        status: 'active',
        sourcePath: '/bounded/fixture/plexus.yaml',
        githubRepoFullName: 'thoughtseed-labs/plexus',
      };
      await database.insertProject({
        id: 'project_failed',
        name: 'Plexus',
        color: '#56C8B0',
        archived: false,
        createdAt: '2026-07-27T00:00:00.000Z',
        githubRepoFullName: candidate.githubRepoFullName,
        repoEvidenceStatus: 'unverified',
        repoRequired: true,
        evidenceStatus: 'pending',
      });
      const workspaceRepository = repository(11, 'thoughtseed-labs/plexus');
      const { autoLinkVaultProjectRepositories } = await import('../../src/main/vault-projects');
      const result = await autoLinkVaultProjectRepositories(
        [candidate],
        [workspaceRepository],
        async () => ({ ok: false, status: 'forbidden', message: 'Not granted.' }),
      );

      expect(result).toEqual({ autoLinked: 0, failed: 1 });
      const failedProject = await database.getProject('project_failed');
      expect(failedProject).toMatchObject({
        repoEvidenceStatus: 'unverified',
      });
      expect(projectLinkedToGitHubRepository(workspaceRepository, [failedProject!])).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it('serializes concurrent auto-links so one repository cannot bind twice', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    try {
      const workspaceRepository = repository(11, 'thoughtseed-labs/plexus');
      const candidates = ['project_one', 'project_two'].map((projectId): VaultProjectCandidate => ({
        code: projectId,
        projectId,
        cachedProjectId: projectId,
        name: projectId,
        status: 'active',
        sourcePath: `/bounded/fixture/${projectId}.yaml`,
        githubRepoFullName: workspaceRepository.fullName,
        githubRepoUrl: workspaceRepository.url,
      }));
      for (const candidate of candidates) {
        await database.insertProject({
          id: candidate.projectId,
          name: candidate.name,
          color: '#56C8B0',
          archived: false,
          createdAt: '2026-07-27T00:00:00.000Z',
          githubRepoFullName: candidate.githubRepoFullName,
          githubRepoUrl: candidate.githubRepoUrl,
          repoEvidenceStatus: 'unverified',
          repoRequired: true,
          evidenceStatus: 'pending',
        });
      }

      let verificationCount = 0;
      const verify = async (projectId: string) => {
        verificationCount++;
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        return {
          ok: true as const,
          status: 'verified' as const,
          repo: { ...workspaceRepository, verifiedAt: '2026-07-27T00:01:00.000Z' },
          project: {
            id: projectId,
            name: projectId,
            color: '#56C8B0',
            archived: false,
            createdAt: '2026-07-27T00:00:00.000Z',
            githubRepoUrl: workspaceRepository.url,
            githubRepoFullName: workspaceRepository.fullName,
            githubInstallationId: workspaceRepository.installationId,
            githubRepoId: String(workspaceRepository.id),
            githubRepoOwnerId: workspaceRepository.account.id,
            githubRepoOwnerLogin: workspaceRepository.account.login,
            githubRepoOwnerType: workspaceRepository.account.type,
            repoVerifiedAt: '2026-07-27T00:01:00.000Z',
            repoEvidenceStatus: 'verified' as const,
            repoAuthoritySource: 'worker' as const,
            repoRequired: true,
            evidenceStatus: 'pending' as const,
          },
        };
      };
      const { autoLinkVaultProjectRepositories } = await import('../../src/main/vault-projects');
      const outcomes = await Promise.all(candidates.map((candidate) => (
        autoLinkVaultProjectRepositories([candidate], [workspaceRepository], verify)
      )));

      expect(verificationCount).toBe(1);
      expect(outcomes).toEqual(expect.arrayContaining([
        { autoLinked: 1, failed: 0 },
        { autoLinked: 0, failed: 1 },
      ]));
      const linked = (await database.listProjects()).filter((project) => (
        project.githubInstallationId === workspaceRepository.installationId
        && project.githubRepoId === String(workspaceRepository.id)
        && project.repoEvidenceStatus === 'verified'
      ));
      expect(linked).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it('atomically rejects one repository id across different installations when callers bypass the queue', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    try {
      const workspaceRepository = repository(11, 'thoughtseed-labs/plexus');
      const verifiedAt = '2026-07-27T00:01:00.000Z';
      const verifiedProject = (id: string): Project => ({
        id,
        name: id,
        color: '#56C8B0',
        archived: false,
        createdAt: '2026-07-27T00:00:00.000Z',
        githubRepoUrl: workspaceRepository.url,
        githubRepoFullName: workspaceRepository.fullName,
        githubInstallationId: workspaceRepository.installationId,
        githubRepoId: String(workspaceRepository.id),
        githubRepoOwnerId: workspaceRepository.account.id,
        githubRepoOwnerLogin: workspaceRepository.account.login,
        githubRepoOwnerType: workspaceRepository.account.type,
        repoVerifiedAt: verifiedAt,
        repoEvidenceStatus: 'verified',
        repoRequired: true,
        evidenceStatus: 'pending',
      });
      await database.insertProject({
        ...verifiedProject('project_one'),
        githubInstallationId: null,
        githubRepoId: null,
        githubRepoOwnerId: null,
        githubRepoOwnerLogin: null,
        githubRepoOwnerType: null,
        repoVerifiedAt: null,
        repoEvidenceStatus: 'unverified',
      });
      await database.insertProject({
        ...verifiedProject('project_two'),
        githubInstallationId: null,
        githubRepoId: null,
        githubRepoOwnerId: null,
        githubRepoOwnerLogin: null,
        githubRepoOwnerType: null,
        repoVerifiedAt: null,
        repoEvidenceStatus: 'unverified',
      });

      const outcomes = await Promise.all([
        database.bindVerifiedProjectRepository('project_one', verifiedProject('project_one'), 'manual', verifiedAt),
        database.bindVerifiedProjectRepository('project_two', {
          ...verifiedProject('project_two'),
          githubInstallationId: workspaceRepository.installationId + 1,
        }, 'manual', verifiedAt),
      ]);
      expect(outcomes.sort()).toEqual([false, true]);
      const linked = (await database.listProjects()).filter((project) => project.repoEvidenceStatus === 'verified');
      expect(linked).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it('treats a verified legacy repository id as the same global repository authority', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    try {
      const workspaceRepository = repository(11, 'thoughtseed-labs/plexus');
      const verifiedAt = '2026-07-27T00:01:00.000Z';
      await database.insertProject({
        id: 'legacy_project',
        name: 'Legacy project',
        color: '#56C8B0',
        archived: false,
        createdAt: '2026-07-27T00:00:00.000Z',
        githubRepoUrl: workspaceRepository.url,
        githubRepoFullName: workspaceRepository.fullName,
        githubRepoId: String(workspaceRepository.id),
        repoVerifiedAt: verifiedAt,
        repoEvidenceStatus: 'verified',
        repoRequired: true,
        evidenceStatus: 'pending',
      });
      const nextProject: Project = {
        id: 'next_project',
        name: 'Next project',
        color: '#56C8B0',
        archived: false,
        createdAt: '2026-07-27T00:00:00.000Z',
        githubRepoUrl: workspaceRepository.url,
        githubRepoFullName: workspaceRepository.fullName,
        githubInstallationId: workspaceRepository.installationId,
        githubRepoId: String(workspaceRepository.id),
        githubRepoOwnerId: workspaceRepository.account.id,
        githubRepoOwnerLogin: workspaceRepository.account.login,
        githubRepoOwnerType: workspaceRepository.account.type,
        repoVerifiedAt: verifiedAt,
        repoEvidenceStatus: 'verified',
        repoRequired: true,
        evidenceStatus: 'pending',
      };
      await database.insertProject({
        ...nextProject,
        githubInstallationId: null,
        githubRepoId: null,
        githubRepoOwnerId: null,
        githubRepoOwnerLogin: null,
        githubRepoOwnerType: null,
        repoVerifiedAt: null,
        repoEvidenceStatus: 'unverified',
      });

      await expect(database.bindVerifiedProjectRepository(
        nextProject.id,
        nextProject,
        'manual',
        verifiedAt,
      )).resolves.toBe(false);
    } finally {
      await cleanup();
    }
  });

  it('preserves manual links and clears stale provenance when vault-auto assignments change', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    try {
      const verifiedAt = '2026-07-27T00:01:00.000Z';
      const oldRepository = repository(11, 'thoughtseed-labs/old-repo');
      const nextRepository = repository(12, 'thoughtseed-labs/next-repo');
      const baseProject: Project = {
        id: 'project_manual',
        name: 'Manual project',
        color: '#56C8B0',
        archived: false,
        createdAt: '2026-07-27T00:00:00.000Z',
        githubRepoUrl: oldRepository.url,
        githubRepoFullName: oldRepository.fullName,
        githubInstallationId: oldRepository.installationId,
        githubRepoId: String(oldRepository.id),
        githubRepoOwnerId: oldRepository.account.id,
        githubRepoOwnerLogin: oldRepository.account.login,
        githubRepoOwnerType: oldRepository.account.type,
        repoVerifiedAt: verifiedAt,
        repoEvidenceStatus: 'verified',
        repoBindingSource: 'manual',
        repoBoundAt: verifiedAt,
        repoAuthoritySource: 'worker',
        repoRequired: true,
        evidenceStatus: 'pending',
      };
      await database.insertProject(baseProject);
      await database.insertProject({
        ...baseProject,
        id: 'project_auto',
        name: 'Automatic project',
        repoBindingSource: 'vault_auto',
      });

      const { vaultProjectImportPatch } = await import('../../src/main/vault-projects');
      const candidate = {
        code: 'project',
        projectId: 'project',
        name: 'Project',
        status: 'active',
        sourcePath: '/bounded/fixture/project.yaml',
        githubRepoFullName: nextRepository.fullName,
        githubRepoUrl: nextRepository.url,
      } satisfies VaultProjectCandidate;

      const manualPatch = vaultProjectImportPatch(candidate, baseProject);
      expect(manualPatch).toEqual({
        name: candidate.name,
      });

      const automaticPatch = vaultProjectImportPatch(candidate, {
        ...baseProject,
        id: 'project_auto',
        repoBindingSource: 'vault_auto',
      });
      expect(automaticPatch).toMatchObject({
        githubRepoUrl: nextRepository.url,
        githubRepoFullName: nextRepository.fullName,
        githubInstallationId: null,
        githubRepoId: null,
        githubRepoOwnerId: null,
        repoVerifiedAt: null,
        repoEvidenceStatus: 'unverified',
        repoBindingSource: null,
        repoBoundAt: null,
        repoAuthoritySource: null,
      });
      expect(projectLinkedToGitHubRepository(oldRepository, [baseProject])).toEqual(baseProject);
      expect(projectLinkedToGitHubRepository(nextRepository, [{
        ...baseProject,
        ...automaticPatch,
      }])).toBeNull();
      expect(candidate.githubRepoFullName).toBe(nextRepository.fullName);
    } finally {
      await cleanup();
    }
  });

  it('persists visible vault-auto provenance and reports automatic links', () => {
    const types = source('src/shared/types.ts');
    const database = source('src/db/database.ts');
    const vault = source('src/main/vault-projects.ts');
    const main = source('src/main/main.ts');
    const projects = source('src/renderer/components/ProjectManager.tsx');

    expect(types).toContain("export type RepoBindingSource = 'manual' | 'vault_auto'");
    expect(types).toContain('repoBindingSource?: RepoBindingSource');
    expect(types).toContain('repoBoundAt?: string | null');
    expect(types).toContain('githubInstallationId?: number | null');
    expect(types).toContain('repoAuthoritySource?: RepoAuthoritySource');
    expect(types).toContain('autoLinked: number');
    expect(database).toContain('repo_binding_source TEXT');
    expect(database).toContain('repo_bound_at TEXT');
    expect(vault).toContain('matchWorkspaceRepository(candidate.githubRepoFullName, repositories)');
    expect(vault).toContain("repoBindingSource: 'vault_auto'");
    expect(main).toContain('autoLinkVaultProjectRepositories');
    expect(projects).toContain("'auto-linked from assigned project'");
    expect(projects).toContain("repoReady(p) ? 'Change link' : 'Add link'");
  });

  it('renders a searchable complete read-only catalog with project mapping state', () => {
    const settings = source('src/renderer/components/Settings.tsx');
    const theme = source('src/renderer/theme.css');

    expect(settings).toContain('githubRepositoryQuery');
    expect(settings).toContain('filteredGitHubRepositories.map');
    expect(settings).toContain('available to link');
    expect(settings).toContain('linked to');
    expect(settings).toContain('optional personal catalog');
    expect(settings).toContain('hasConnectedGitHubWorkspaceInstallation');
    expect(theme).toContain('.px-github-repository-catalog');
    expect(theme).toContain('.px-github-repository-list');
  });

  it('keeps the catalog renderer shape token-free', () => {
    const inventory: GitHubRepositoryListResult = {
      status: 'connected',
      repositories: [repository(11, 'thoughtseed-labs/plexus')],
    };
    expect(JSON.stringify(inventory)).not.toMatch(/token|oauth.?code|private.?key|webhook.?secret/i);
  });
});
