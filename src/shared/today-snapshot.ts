import type {
  AgentSessionScanResult,
  AssistantStatus,
  MemberKpiSummary,
  Project,
  ThoughtseedFabricTask,
  TimeEntry,
  TimerState,
  TodayActionSnapshot,
  TodayAgentSessionSnapshot,
  TodayAssistantSnapshot,
  TodayProofRisk,
  TodayProofSnapshot,
  TodaySnapshot,
  TodaySourceHealth,
  TodayStandupSnapshot,
  TodayTimerSnapshot,
  WorkEvidenceSummary,
} from './types.js';

export interface TodaySnapshotInput {
  date: string;
  generatedAt: string;
  timerState: TimerState;
  entries: TimeEntry[];
  projects: Project[];
  tasks?: ThoughtseedFabricTask[];
  evidenceSummary: WorkEvidenceSummary;
  assistantStatus?: AssistantStatus | null;
  assistantError?: string | null;
  agentSessionStatus?: AgentSessionScanResult | null;
  agentSessionError?: string | null;
  memberKpi?: MemberKpiSummary | null;
  memberKpiError?: string | null;
  fabricTasksError?: string | null;
}

function isRepoReady(project: Project): boolean {
  return Boolean(
    project.githubRepoUrl
      && project.githubRepoFullName
      && project.repoVerifiedAt
      && project.repoEvidenceStatus !== 'inaccessible',
  );
}

function projectName(projects: readonly Project[], projectId?: string | null): string | null {
  if (!projectId) return null;
  return projects.find((project) => project.id === projectId)?.name ?? null;
}

function sourceHealth(error: string | null | undefined, checkedAt: string, readyMessage?: string): TodaySourceHealth {
  if (error) return { state: 'unavailable', checkedAt, message: error };
  return { state: 'ready', checkedAt, ...(readyMessage ? { message: readyMessage } : {}) };
}

function deriveTimer(timerState: TimerState, projects: readonly Project[]): TodayTimerSnapshot {
  return {
    running: timerState.running,
    paused: Boolean(timerState.paused),
    entryId: timerState.entryId ?? null,
    projectId: timerState.projectId ?? null,
    projectName: projectName(projects, timerState.projectId),
    description: timerState.description ?? null,
    activeSeconds: Math.max(0, Math.floor(timerState.activeSeconds ?? 0)),
    targetSeconds: timerState.targetSeconds ?? null,
    raw: timerState,
  };
}

function proofRisk(summary: WorkEvidenceSummary, unverifiedProjectCount: number): TodayProofRisk {
  if (summary.proofStatus === 'sync_failed') return 'sync_attention';
  if (unverifiedProjectCount > 0 && summary.totalEntries === 0) return 'needs_project';
  if (summary.missingEvidenceEntries > 0 || summary.legacyUnverifiedEntries > 0) return 'needs_evidence';
  if (summary.proofStatus === 'missing' || summary.proofStatus === 'partial' || summary.proofStatus === 'legacy_unverified') return 'needs_evidence';
  return 'clear';
}

function deriveProof(summary: WorkEvidenceSummary, entries: readonly TimeEntry[], projects: readonly Project[]): TodayProofSnapshot {
  const verifiedProjectCount = projects.filter(isRepoReady).length;
  const unverifiedProjectCount = projects.filter((project) => !isRepoReady(project)).length;
  const syncFailedEntries = entries.filter((entry) => entry.evidenceStatus === 'sync_failed').length;
  return {
    status: summary.proofStatus,
    risk: proofRisk(summary, unverifiedProjectCount),
    missingEvidenceEntries: summary.missingEvidenceEntries,
    evidencedEntries: summary.evidencedEntries,
    legacyUnverifiedEntries: summary.legacyUnverifiedEntries,
    syncFailedEntries,
    unverifiedProjectCount,
    verifiedProjectCount,
    summary,
  };
}

function deriveStandup(memberKpi: MemberKpiSummary | null | undefined, error?: string | null): TodayStandupSnapshot {
  if (!memberKpi) {
    return {
      state: 'unavailable',
      compliant: null,
      todaySeconds: null,
      weekSeconds: null,
      source: 'unavailable',
      ...(error ? { message: error } : {}),
    };
  }
  return {
    state: memberKpi.standupCompliant ? 'ready' : 'needed',
    compliant: memberKpi.standupCompliant,
    todaySeconds: memberKpi.todaySeconds,
    weekSeconds: memberKpi.weekSeconds,
    source: 'member_kpi',
  };
}

function deriveAssistant(status: AssistantStatus | null | undefined, error?: string | null): TodayAssistantSnapshot {
  if (!status) {
    return {
      availability: 'unknown',
      enabled: null,
      ...(error ? { message: error } : {}),
    };
  }
  return {
    availability: status.availability,
    enabled: status.enabled,
    message: status.message,
  };
}

function deriveSessions(status: AgentSessionScanResult | null | undefined): TodayAgentSessionSnapshot {
  if (!status) {
    return {
      enabled: null,
      pending: 0,
      ready: 0,
      matched: 0,
      needsProject: 0,
    };
  }
  const needsProject = status.candidates.filter((candidate) => candidate.matchStatus === 'needs_project').length;
  return {
    enabled: status.enabled,
    pending: status.totalPending,
    ready: status.readyPending,
    matched: status.matchedPending,
    needsProject,
  };
}

function deriveNextActions(input: {
  timer: TodayTimerSnapshot;
  proof: TodayProofSnapshot;
  standup: TodayStandupSnapshot;
  sessions: TodayAgentSessionSnapshot;
  activeTaskCount: number;
}): TodayActionSnapshot[] {
  const actions: TodayActionSnapshot[] = [];
  if (input.proof.verifiedProjectCount === 0) {
    actions.push({
      id: 'link-project-proof',
      title: 'Link a verified project',
      detail: 'Today needs at least one GitHub-verified project before new work can be captured.',
      tone: 'warning',
      routeKey: 'projects',
    });
  } else if (!input.timer.running) {
    actions.push({
      id: 'start-today-session',
      title: 'Start today from a verified project',
      detail: 'Choose the project and capture the next work block with proof attached.',
      tone: 'accent',
      routeKey: 'today',
    });
  }
  if (input.proof.risk === 'sync_attention') {
    actions.push({
      id: 'repair-sync-proof',
      title: 'Resolve proof sync attention',
      detail: 'At least one work record has evidence sync failure state.',
      tone: 'error',
      routeKey: 'entries',
    });
  } else if (input.proof.missingEvidenceEntries > 0 || input.proof.legacyUnverifiedEntries > 0) {
    actions.push({
      id: 'repair-missing-proof',
      title: 'Repair missing proof',
      detail: `${input.proof.missingEvidenceEntries + input.proof.legacyUnverifiedEntries} work record(s) need evidence before today is founder-ready.`,
      tone: 'warning',
      routeKey: 'entries',
    });
  }
  if (input.activeTaskCount > 0) {
    actions.push({
      id: 'review-fabric-tasks',
      title: 'Review assigned Fabric tasks',
      detail: `${input.activeTaskCount} active assignment(s) are waiting in the bridge queue.`,
      tone: 'mint',
      routeKey: 'bridge',
    });
  }
  if (input.standup.state === 'needed') {
    actions.push({
      id: 'prepare-daily-proof',
      title: 'Prepare daily proof',
      detail: 'Standup proof is not marked ready yet.',
      tone: 'warning',
      routeKey: 'assistant',
    });
  }
  if (input.sessions.ready > 0) {
    actions.push({
      id: 'convert-clio-memories',
      title: 'Convert local Clio memories',
      detail: `${input.sessions.ready} ready session(s) can become work records.`,
      tone: 'mint',
      routeKey: 'agents',
    });
  }
  return actions.slice(0, 5);
}

export function buildTodaySnapshot(input: TodaySnapshotInput): TodaySnapshot {
  const tasks = input.tasks ?? [];
  const timer = deriveTimer(input.timerState, input.projects);
  const trackedSeconds = input.entries.reduce((sum, entry) => sum + Math.max(0, entry.durationSeconds), 0);
  const activeTaskCount = tasks.filter((task) => task.status !== 'done').length;
  const proof = deriveProof(input.evidenceSummary, input.entries, input.projects);
  const standup = deriveStandup(input.memberKpi, input.memberKpiError);
  const assistant = deriveAssistant(input.assistantStatus, input.assistantError);
  const sessions = deriveSessions(input.agentSessionStatus);

  return {
    date: input.date,
    generatedAt: input.generatedAt,
    timer,
    entries: input.entries,
    projects: input.projects,
    tasks,
    totals: {
      trackedSeconds,
      activeSeconds: timer.running ? timer.activeSeconds : 0,
      entryCount: input.entries.length,
      projectCount: new Set([
        ...input.entries.map((entry) => entry.projectId),
        ...(timer.projectId ? [timer.projectId] : []),
      ]).size,
      activeTaskCount,
    },
    proof,
    standup,
    assistant,
    sessions,
    sourceHealth: {
      core: sourceHealth(null, input.generatedAt),
      fabricTasks: sourceHealth(input.fabricTasksError, input.generatedAt),
      standup: sourceHealth(input.memberKpiError, input.generatedAt),
      assistant: sourceHealth(input.assistantError, input.generatedAt),
      agentSessions: sourceHealth(input.agentSessionError, input.generatedAt),
    },
    nextActions: deriveNextActions({ timer, proof, standup, sessions, activeTaskCount }),
  };
}
