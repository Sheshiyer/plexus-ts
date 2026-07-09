import type {
  AgentSessionScanResult,
  AssistantRouteKey,
  AssistantStatus,
  AssistantSuggestion,
  MemberKpiSummary,
  Project,
  RealtimeRoom,
  ThoughtseedFabricTask,
  TimeEntry,
  TimerState,
  TodayActionSnapshot,
  TodayAgentSessionSnapshot,
  TodayAssignmentAggregateSnapshot,
  TodayAssistantSnapshot,
  TodayProofRisk,
  TodayProofSnapshot,
  TodayRoomAggregateSnapshot,
  TodaySnapshot,
  TodaySuggestionSnapshot,
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
  assistantSuggestions?: AssistantSuggestion[];
  assistantSuggestionsError?: string | null;
  agentSessionStatus?: AgentSessionScanResult | null;
  agentSessionError?: string | null;
  memberKpi?: MemberKpiSummary | null;
  memberKpiError?: string | null;
  fabricTasksError?: string | null;
  realtimeRooms?: RealtimeRoom[];
  realtimeRoomsError?: string | null;
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
      state: error ? 'unavailable' : 'unknown',
      modelProvider: null,
      selectedModelId: null,
      configuredProviderCount: 0,
      degraded: true,
      ...(error ? { message: error } : {}),
    };
  }
  return {
    availability: status.availability,
    enabled: status.enabled,
    state: status.state,
    modelProvider: status.model.selectedProvider ?? status.model.provider ?? null,
    selectedModelId: status.model.selectedModelId,
    configuredProviderCount: status.model.configuredProviders.length,
    degraded: Boolean(error || !status.ok || status.availability !== 'ready'),
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

function statusRank(status: ThoughtseedFabricTask['status']): number {
  if (status === 'blocked') return 0;
  if (status === 'in_progress') return 1;
  if (status === 'assigned' || status === 'seen') return 2;
  return 3;
}

function priorityRank(priority: ThoughtseedFabricTask['priority']): number {
  if (priority === 'urgent') return 0;
  if (priority === 'high') return 1;
  if (priority === 'normal') return 2;
  if (priority === 'low') return 3;
  return 4;
}

function assignmentNextAction(task: ThoughtseedFabricTask): string {
  if (task.status === 'blocked') return 'Resolve the blocker or request operator input.';
  if (task.status === 'assigned' || task.status === 'seen') return 'Open the bridge queue and choose a work mode.';
  if (task.proofStatus !== 'verified') return 'Continue the task and capture the required proof.';
  return 'Continue the task and keep evidence attached.';
}

function deriveAssignments(tasks: readonly ThoughtseedFabricTask[]): TodayAssignmentAggregateSnapshot {
  const activeTasks = tasks
    .filter((task) => task.status !== 'done')
    .slice()
    .sort((left, right) => (
      statusRank(left.status) - statusRank(right.status)
      || priorityRank(left.priority) - priorityRank(right.priority)
      || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      || left.taskId.localeCompare(right.taskId)
    ));
  const current = activeTasks[0] ?? null;
  return {
    activeCount: activeTasks.length,
    current: current
      ? {
          taskId: current.taskId,
          title: current.title,
          status: current.status,
          source: current.source ?? 'unknown',
          proofRequired: current.proofRequired ?? current.proofFoldback ?? null,
          proofStatus: current.proofStatus ?? null,
          nextAction: assignmentNextAction(current),
          projectId: current.projectId ?? null,
          projectName: current.projectName ?? null,
          workMode: current.workMode ?? null,
          evidenceStrength: current.evidenceStrength,
          updatedAt: current.updatedAt,
        }
      : null,
  };
}

function deriveRooms(rooms: readonly RealtimeRoom[]): TodayRoomAggregateSnapshot {
  const activeRooms = rooms
    .filter((room) => room.state === 'open' && (
      Boolean(room.activeCallId)
      || room.presence.participants > 0
      || room.presence.screenShares > 0
    ))
    .slice()
    .sort((left, right) => (
      Number(Boolean(right.activeCallId)) - Number(Boolean(left.activeCallId))
      || right.presence.screenShares - left.presence.screenShares
      || right.presence.participants - left.presence.participants
      || Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)
      || left.name.localeCompare(right.name)
    ));
  const current = activeRooms[0] ?? null;
  return {
    activeCount: activeRooms.length,
    current: current
      ? {
          roomId: current.id,
          roomType: current.roomType,
          name: current.projectName ?? current.name,
          projectId: current.projectId ?? null,
          projectName: current.projectName ?? null,
          observedState: current.activeCallId
            ? 'active_call'
            : current.presence.screenShares > 0
              ? 'screen_share'
              : current.presence.participants > 0
                ? 'presence'
                : 'quiet',
          joinState: 'unknown',
          participantCount: current.presence.participants,
          screenShareCount: current.presence.screenShares,
          activeCall: Boolean(current.activeCallId),
          lastActivityAt: current.lastActivityAt,
        }
      : null,
  };
}

const ROUTE_KEYS: readonly AssistantRouteKey[] = [
  'today',
  'focus',
  'entries',
  'agents',
  'projects',
  'reports',
  'export',
  'assistant',
  'bridge',
  'realtime',
  'backups',
  'admin',
  'settings',
];

function routeKey(value: unknown): AssistantRouteKey | undefined {
  return typeof value === 'string' && ROUTE_KEYS.includes(value as AssistantRouteKey)
    ? value as AssistantRouteKey
    : undefined;
}

function skillHintLabel(value: unknown): string | null {
  if (typeof value === 'string') {
    const next = value.trim();
    return next ? next.slice(0, 80) : null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const raw = record.skill ?? record.name ?? record.key ?? record.id ?? record.title;
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 80) : null;
}

function deriveSuggestions(
  assistantSuggestions: readonly AssistantSuggestion[],
  assignments: TodayAssignmentAggregateSnapshot,
): TodaySuggestionSnapshot[] {
  const suggestions: TodaySuggestionSnapshot[] = assistantSuggestions.slice(0, 3).map((suggestion): TodaySuggestionSnapshot => ({
    id: suggestion.id,
    title: suggestion.title,
    detail: suggestion.body,
    source: 'assistant',
    safety: suggestion.safety,
    confidence: suggestion.confidence,
    rationale: suggestion.critical ? 'Critical assistant recommendation for today.' : 'Assistant recommendation derived from the Today context.',
    ...(suggestion.intent?.toolId ? { toolId: suggestion.intent.toolId } : {}),
    ...(routeKey(suggestion.intent?.payload.routeKey) ? { routeKey: routeKey(suggestion.intent?.payload.routeKey) } : {}),
  }));

  const current = assignments.current;
  if (current) {
    suggestions.push({
      id: `temperance_work_packet_${current.taskId}`,
      title: 'Prepare confirmed work packet',
      detail: `${current.title} is ${current.status}; confirm scope and proof before dispatch.`,
      source: 'temperance',
      safety: 'confirm_required',
      confidence: 0.82,
      rationale: 'Current bridge assignment can be packaged only after explicit confirmation.',
      taskId: current.taskId,
      routeKey: 'bridge',
    });
  }

  return suggestions.slice(0, 6);
}

function deriveTemperanceSkillSuggestions(
  tasks: readonly ThoughtseedFabricTask[],
  assignments: TodayAssignmentAggregateSnapshot,
): TodaySuggestionSnapshot[] {
  const current = assignments.current
    ? tasks.find((task) => task.taskId === assignments.current?.taskId) ?? null
    : null;
  if (!current?.skillHints?.length) return [];
  const labels = [...new Set(current.skillHints.flatMap((hint) => {
    const label = skillHintLabel(hint);
    return label ? [label] : [];
  }))].slice(0, 2);
  return labels.map((label): TodaySuggestionSnapshot => ({
    id: `temperance_skill_${current.taskId}_${label.replace(/[^a-zA-Z0-9_-]+/g, '_')}`,
    title: `Review ${label}`,
    detail: `Skill hint from ${current.source ?? 'bridge'} for ${current.title}; confirm before dispatch.`,
    source: 'temperance',
    safety: 'confirm_required',
    confidence: 0.74,
    rationale: 'Sanitized bridge skill hint; no skill is loaded or executed from Today.',
    taskId: current.taskId,
    routeKey: 'bridge',
    skillHint: label,
  }));
}

function deriveNextActions(input: {
  timer: TodayTimerSnapshot;
  proof: TodayProofSnapshot;
  standup: TodayStandupSnapshot;
  sessions: TodayAgentSessionSnapshot;
  assistant: TodayAssistantSnapshot;
  assignments: TodayAssignmentAggregateSnapshot;
  rooms: TodayRoomAggregateSnapshot;
  suggestions: TodaySuggestionSnapshot[];
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
  if (input.assignments.current) {
    actions.push({
      id: 'review-fabric-tasks',
      title: 'Review active Fabric assignment',
      detail: `${input.assignments.current.source} · ${input.assignments.current.status} · ${input.assignments.current.nextAction}`,
      tone: 'mint',
      routeKey: 'bridge',
    });
  }
  if (input.rooms.current) {
    actions.push({
      id: 'open-active-room',
      title: 'Open active co-working room',
      detail: `${input.rooms.current.name} has ${input.rooms.current.participantCount} present and ${input.rooms.current.screenShareCount} screen share(s).`,
      tone: input.rooms.current.screenShareCount ? 'accent' : 'mint',
      routeKey: 'realtime',
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
  if (input.assistant.degraded) {
    actions.push({
      id: 'repair-clio-runtime',
      title: 'Check Clio runtime',
      detail: input.assistant.message ?? `Assistant runtime is ${input.assistant.availability}.`,
      tone: input.assistant.availability === 'needs_model_key' ? 'warning' : 'idle',
      routeKey: 'assistant',
    });
  }
  const temperanceSuggestion = input.suggestions.find((suggestion) => suggestion.source === 'temperance');
  if (temperanceSuggestion) {
    actions.push({
      id: 'review-temperance-suggestion',
      title: temperanceSuggestion.title,
      detail: temperanceSuggestion.detail,
      tone: 'mint',
      routeKey: temperanceSuggestion.routeKey,
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
  const assignments = deriveAssignments(tasks);
  const rooms = deriveRooms(input.realtimeRooms ?? []);
  const suggestions = deriveSuggestions(input.assistantSuggestions ?? [], assignments)
    .concat(deriveTemperanceSkillSuggestions(tasks, assignments))
    .slice(0, 6);

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
    assignments,
    rooms,
    suggestions,
    sourceHealth: {
      core: sourceHealth(null, input.generatedAt),
      fabricTasks: sourceHealth(input.fabricTasksError, input.generatedAt),
      standup: sourceHealth(input.memberKpiError, input.generatedAt),
      assistant: sourceHealth(input.assistantError, input.generatedAt),
      agentSessions: sourceHealth(input.agentSessionError, input.generatedAt),
      realtimeRooms: sourceHealth(input.realtimeRoomsError, input.generatedAt),
      recommendations: sourceHealth(input.assistantSuggestionsError, input.generatedAt),
    },
    nextActions: deriveNextActions({ timer, proof, standup, sessions, assistant, assignments, rooms, suggestions }),
  };
}
