import { THOUGHTSEED_GITHUB_WORKSPACE_TARGET } from './founder-github-setup.js';
import { hasVerifiedGitHubRepository } from './github-repository-authority.js';
import type { GitHubRepoOption, Project } from './types.js';

export type WorkspaceRepositoryMatch =
  | { status: 'matched'; repository: GitHubRepoOption }
  | { status: 'not_configured' | 'outside_workspace' | 'missing' | 'ambiguous'; repository: null };

export function normalizeGitHubRepositoryFullName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const fullName = value.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) return null;
  return fullName.toLowerCase();
}

function isWorkspaceRepository(repository: GitHubRepoOption): boolean {
  return repository.source === 'worker'
    && repository.account.id === THOUGHTSEED_GITHUB_WORKSPACE_TARGET.id
    && repository.account.type === THOUGHTSEED_GITHUB_WORKSPACE_TARGET.type
    && repository.account.login.toLowerCase() === THOUGHTSEED_GITHUB_WORKSPACE_TARGET.login.toLowerCase();
}

export function matchWorkspaceRepository(
  fullName: unknown,
  repositories: readonly GitHubRepoOption[],
): WorkspaceRepositoryMatch {
  const normalized = normalizeGitHubRepositoryFullName(fullName);
  if (!normalized) return { status: 'not_configured', repository: null };

  const exact = repositories.filter((repository) => (
    isWorkspaceRepository(repository)
    && normalizeGitHubRepositoryFullName(repository.fullName) === normalized
  ));
  if (exact.length === 1) return { status: 'matched', repository: exact[0] };
  if (exact.length > 1) return { status: 'ambiguous', repository: null };

  const existsOutsideWorkspace = repositories.some((repository) => (
    normalizeGitHubRepositoryFullName(repository.fullName) === normalized
  ));
  return {
    status: existsOutsideWorkspace ? 'outside_workspace' : 'missing',
    repository: null,
  };
}

export function projectLinkedToGitHubRepository(
  repository: GitHubRepoOption,
  projects: readonly Project[],
): Project | null {
  const repositoryId = String(repository.id);
  const fullName = normalizeGitHubRepositoryFullName(repository.fullName);
  return projects.find((project) => {
    if (!hasVerifiedGitHubRepository(project)) return false;
    if (project.githubInstallationId !== undefined && project.githubInstallationId !== null) {
      return project.githubInstallationId === repository.installationId
        && project.githubRepoId === repositoryId
        && (project.githubRepoOwnerId === undefined
          || project.githubRepoOwnerId === null
          || project.githubRepoOwnerId === repository.account.id);
    }
    return project.githubRepoId === repositoryId
      || (fullName !== null && normalizeGitHubRepositoryFullName(project.githubRepoFullName) === fullName);
  }) ?? null;
}
