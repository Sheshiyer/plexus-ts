import type { GitHubActivity, Project, TimeEntry, WorkEvidenceSummary } from '../shared/types.js';

const MATCH_BEFORE_MS = 15 * 60 * 1000;
const MATCH_AFTER_MS = 30 * 60 * 1000;

export function computeEvidenceSummary(entries: TimeEntry[], projects: Project[]): WorkEvidenceSummary {
  const projectRepoCoverage: Record<string, any> = {};
  for (const project of projects) {
    projectRepoCoverage[project.id] = project.repoEvidenceStatus ?? (project.githubRepoUrl ? 'unverified' : 'missing');
  }

  let evidencedEntries = 0;
  let missingEvidenceEntries = 0;
  let legacyUnverifiedEntries = 0;
  let evidencedSeconds = 0;
  let missingEvidenceSeconds = 0;

  for (const entry of entries) {
    const status = entry.evidenceStatus ?? (entry.githubRepoUrl ? 'pending' : 'legacy_unverified');
    if (status === 'matched') {
      evidencedEntries += 1;
      evidencedSeconds += entry.durationSeconds;
    } else if (status === 'legacy_unverified') {
      legacyUnverifiedEntries += 1;
      missingEvidenceSeconds += entry.durationSeconds;
    } else {
      missingEvidenceEntries += 1;
      missingEvidenceSeconds += entry.durationSeconds;
    }
  }

  return {
    totalEntries: entries.length,
    evidencedEntries,
    missingEvidenceEntries,
    legacyUnverifiedEntries,
    evidencedSeconds,
    missingEvidenceSeconds,
    projectRepoCoverage,
  };
}

export function matchedActivityIdsForEntry(entry: TimeEntry, activity: GitHubActivity[], now = new Date()): string[] {
  if (!entry.githubRepoFullName) return [];
  const startMs = new Date(entry.startTime).getTime() - MATCH_BEFORE_MS;
  const endMs = new Date(entry.endTime ?? now.toISOString()).getTime() + MATCH_AFTER_MS;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];

  return activity
    .filter((item) => item.projectId === entry.projectId)
    .filter((item) => item.repoFullName === entry.githubRepoFullName)
    .filter((item) => {
      const occurredMs = new Date(item.occurredAt).getTime();
      return Number.isFinite(occurredMs) && occurredMs >= startMs && occurredMs <= endMs;
    })
    .map((item) => item.id);
}
