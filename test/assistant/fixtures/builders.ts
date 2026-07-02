import type {
  AgentSessionCandidate,
  AgentSessionProvider,
  GitHubActivity,
  HandoffRecord,
  HandoffStatus,
  Project,
  RepoEvidenceStatus,
  ThoughtseedBridgeStatus,
  TimeEntry,
  WorkEvidenceStatus,
} from '../../../src/shared/types';

export const FIXTURE_NOW = '2026-07-01T09:00:00.000Z';

export function buildProject(
  patch: Partial<Project> = {},
): Project {
  const id = patch.id ?? 'project_verified';
  return {
    id,
    name: 'Verified Project',
    clientName: 'Thoughtseed',
    color: '#3b82f6',
    archived: false,
    createdAt: FIXTURE_NOW,
    githubRepoUrl: 'https://github.com/thoughtseed/verified-project',
    githubRepoFullName: 'thoughtseed/verified-project',
    githubRepoId: 'repo_verified',
    repoVerifiedAt: FIXTURE_NOW,
    repoEvidenceStatus: 'verified',
    repoRequired: true,
    evidenceStatus: 'pending',
    ...patch,
  };
}

export function buildTimeEntry(
  patch: Partial<TimeEntry> = {},
): TimeEntry {
  return {
    id: 'entry_1',
    projectId: 'project_verified',
    description: 'Implement assistant context gateway',
    startTime: '2026-07-01T08:00:00.000Z',
    endTime: FIXTURE_NOW,
    durationSeconds: 3600,
    targetSeconds: 3600,
    pausedAt: null,
    pausedSeconds: 0,
    tags: ['assistant', 'implementation'],
    source: 'manual',
    githubRepoUrl: 'https://github.com/thoughtseed/verified-project',
    githubRepoFullName: 'thoughtseed/verified-project',
    evidenceStatus: 'matched',
    evidenceCheckedAt: FIXTURE_NOW,
    githubActivityIds: ['activity_1'],
    syncedAt: null,
    ...patch,
  };
}

export function buildGitHubActivity(
  patch: Partial<GitHubActivity> = {},
): GitHubActivity {
  return {
    id: 'activity_1',
    projectId: 'project_verified',
    repoFullName: 'thoughtseed/verified-project',
    repoUrl: 'https://github.com/thoughtseed/verified-project',
    kind: 'commit',
    title: 'feat: add assistant context gateway',
    url: 'https://github.com/thoughtseed/verified-project/commit/activity_1',
    actor: 'shesh',
    occurredAt: FIXTURE_NOW,
    metadata: { sha: 'activity_1' },
    ...patch,
  };
}

export function buildAgentSessionCandidate(
  patch: Partial<AgentSessionCandidate> = {},
): AgentSessionCandidate {
  const provider: AgentSessionProvider = patch.provider ?? 'codex';
  return {
    id: `session_${provider}`,
    provider,
    providerSessionId: `provider_${provider}_1`,
    sourcePath: `/mock/${provider}/session.jsonl`,
    sourceLabel: `${provider} session`,
    sourceHash: `hash_${provider}_1`,
    repoRoot: '/mock/verified-project',
    repoFullName: 'thoughtseed/verified-project',
    projectId: 'project_verified',
    projectName: 'Verified Project',
    startedAt: '2026-07-01T08:00:00.000Z',
    endedAt: FIXTURE_NOW,
    lastSeenAt: FIXTURE_NOW,
    title: `${provider} assistant implementation session`,
    summary: 'Worked on native assistant runtime.',
    confidence: 92,
    confidenceReasons: ['repo match', 'title match'],
    matchStatus: 'ready',
    status: 'pending',
    createdEntryId: null,
    ...patch,
  };
}

export function buildHandoffRecord(
  patch: Partial<HandoffRecord> = {},
): HandoffRecord {
  const status: HandoffStatus = patch.status ?? 'pending';
  return {
    id: 'handoff_1',
    kind: 'standup_sync',
    status,
    title: 'Timer standup signal failed',
    payload: { date: '2026-07-01' },
    error: null,
    attempts: 0,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    nextRetryAt: null,
    ...patch,
  };
}

export function buildThoughtseedBridgeStatus(
  patch: Partial<ThoughtseedBridgeStatus> = {},
): ThoughtseedBridgeStatus {
  return {
    configured: true,
    connected: true,
    bridgeApiUrl: 'https://curious.thoughtseed.space',
    tenantId: 'cambium',
    memberId: 'shesh',
    tokenExpiresAt: '2026-07-21T00:00:00.000Z',
    lastSeenAt: FIXTURE_NOW,
    lastError: null,
    ...patch,
  };
}

export function evidenceStatus(value: WorkEvidenceStatus): WorkEvidenceStatus {
  return value;
}

export function repoEvidenceStatus(value: RepoEvidenceStatus): RepoEvidenceStatus {
  return value;
}
