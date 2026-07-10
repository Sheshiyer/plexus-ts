import type {
  AgentSessionCandidate,
  AgentSessionProvider,
  FabricStatus,
  GitHubActivity,
  HandoffRecord,
  HandoffStatus,
  Project,
  RealtimeRoom,
  RepoEvidenceStatus,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricTask,
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

export function buildThoughtseedFabricTask(
  patch: Partial<ThoughtseedFabricTask> = {},
): ThoughtseedFabricTask {
  const taskId = patch.taskId ?? 'fabric_task_1';
  const assignedAt = '2026-07-01T08:30:00.000Z';
  const event = patch.history?.[0] ?? {
    eventId: 'directive_1',
    timestamp: assignedAt,
    actor: 'hermes',
    source: 'hermes' as const,
    type: 'assigned' as const,
    payloadHash: 'hash_assigned_1',
    payload: {
      taskId,
      projectId: 'project_verified',
      workEntryId: 'entry_1',
      status: 'assigned',
    },
    correlationId: 'corr_1',
  };
  return {
    taskId,
    directiveId: 'directive_1',
    correlationId: 'corr_1',
    projectId: 'project_verified',
    projectName: 'Verified Project',
    workEntryId: 'entry_1',
    title: 'Ship queryable Fabric task records',
    description: 'Persist Fabric assignments and event history outside settings JSON.',
    priority: 'high',
    taskType: 'engineering',
    assigneeMemberId: 'member_1',
    assignedBy: 'hermes',
    source: 'hermes',
    status: 'assigned',
    proofStatus: 'pending',
    workModeLocked: false,
    overrideCount: 0,
    evidenceStrength: 'weak_evidence',
    evidence: [],
    history: [event],
    updatedAt: assignedAt,
    ...patch,
  };
}

export function buildRealtimeRoom(
  patch: Partial<RealtimeRoom> = {},
): RealtimeRoom {
  return {
    id: 'room_1',
    workspaceId: 'workspace_1',
    projectId: 'project_verified',
    projectName: 'Verified Project',
    name: 'Founder proof room',
    slug: 'founder-proof-room',
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: 'call_1',
    activeCall: null,
    presence: {
      participants: 3,
      screenShares: 1,
    },
    metadata: {},
    lastActivityAt: FIXTURE_NOW,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...patch,
  };
}

export function buildFabricStatus(
  patch: Partial<FabricStatus> = {},
): FabricStatus {
  return {
    ok: true,
    checkedAt: FIXTURE_NOW,
    ports: [
      { port: 3100, label: 'Paperclip API', reachable: true, latencyMs: 12, lastCheckedAt: FIXTURE_NOW },
      { port: 31337, label: 'Runtime adapter optional', reachable: true, latencyMs: 15, lastCheckedAt: FIXTURE_NOW },
    ],
    agents: [],
    summary: { healthy: 2, degraded: 0, uninitialized: 0, stale: 0, missingFileAgents: 0, total: 2 },
    summaryCounts: { healthy: 2, degraded: 0, uninitialized: 0, stale: 0, missingFileAgents: 0, total: 2 },
    bridge: { reachable: true, message: 'Paperclip bridge reachable' },
    safety: {
      mode: 'strict_with_guarded_override',
      targetCompanyId: 'company_thoughtseed',
      targetCompanyName: 'Thoughtseed',
      targetCompanyPrefix: 'TS',
      selectionSource: 'configured',
      thoughtseedOrg: true,
      testCompany: false,
      writesAllowed: true,
      reason: 'fixture',
    },
    vault: { standups: 1, handoffs: 0 },
    ...patch,
  };
}

export function evidenceStatus(value: WorkEvidenceStatus): WorkEvidenceStatus {
  return value;
}

export function repoEvidenceStatus(value: RepoEvidenceStatus): RepoEvidenceStatus {
  return value;
}
