import type { GitHubActivitySyncStatus, Project } from './types.js';

export function hasVerifiedGitHubRepository(project: Project | null | undefined): boolean {
  if (!project) return false;
  if (project.repoRequired === false) return true;
  const repositoryId = project.githubRepoId ?? '';
  return Boolean(
    /^\d+$/.test(repositoryId)
    && Number.isSafeInteger(Number(repositoryId))
    && Number(repositoryId) > 0
    && project.githubRepoUrl
    && project.githubRepoFullName
    && project.repoVerifiedAt
    && Number.isFinite(Date.parse(project.repoVerifiedAt))
    && project.repoEvidenceStatus === 'verified'
  );
}

export function projectPatchAfterGitHubActivityFailure(
  status: Exclude<GitHubActivitySyncStatus, 'synced'>,
): Pick<Project, 'repoEvidenceStatus' | 'evidenceStatus'> {
  return {
    repoEvidenceStatus: status === 'suspended' || status === 'forbidden' ? 'inaccessible' : 'unverified',
    evidenceStatus: 'sync_failed',
  };
}
