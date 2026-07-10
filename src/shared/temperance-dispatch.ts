import type {
  AgentSessionCandidate,
  TemperanceDispatchConflictInput,
  TemperanceDispatchConflictRecord,
  TemperanceDispatchDiagnostics,
  TemperanceDispatchEvent,
  TemperanceDispatchEventKind,
  TemperanceDispatchFailureKind,
  TemperanceDispatchLaneKey,
  TemperanceDispatchLocalSmokeResult,
  TemperanceDispatchRuntimeDiagnostics,
  TemperanceDispatchLaneStatusResult,
  TemperanceDispatchLaneSummary,
  TemperanceDispatchLaneTask,
  TemperanceDispatchSessionLink,
  TemperanceDispatchSupportPacket,
  TemperanceParallelAgentHandoffRecord,
  TemperanceSkillRecommendation,
  TemperanceSkillRecommendationSource,
  TemperanceToolHarnessRunPlan,
  ThoughtseedFabricTask,
  ThoughtseedFabricTaskHistoryEvent,
  ThoughtseedFabricTaskStatus,
  ThoughtseedFabricTaskWorkMode,
} from './types.js';

const KNOWN_SKILL_LABELS: Record<string, string> = {
  'dispatching-parallel-agents': 'Dispatching Parallel Agents',
  'executing-plans': 'Executing Plans',
  'engineering:code-review': 'Engineering Code Review',
  'engineering:documentation': 'Engineering Documentation',
  'engineering:testing-strategy': 'Engineering Testing Strategy',
  'design:accessibility-review': 'Design Accessibility Review',
};

const THEME_SKILLS: Array<{
  skillName: keyof typeof KNOWN_SKILL_LABELS;
  pattern: RegExp;
  source: TemperanceSkillRecommendationSource;
  rationale: string;
}> = [
  {
    skillName: 'engineering:testing-strategy',
    pattern: /\b(test|tests|testing|vitest|playwright|smoke|verification|regression|qa)\b/,
    source: 'taskThemes',
    rationale: 'Task theme mentions testing or verification; recommend focused test strategy support.',
  },
  {
    skillName: 'engineering:documentation',
    pattern: /\b(doc|docs|documentation|readme|handoff|release notes|evidence readme)\b/,
    source: 'taskThemes',
    rationale: 'Task theme mentions documentation or handoff work; recommend documentation support.',
  },
  {
    skillName: 'engineering:code-review',
    pattern: /\b(review|audit|readiness|risk|security|regression)\b/,
    source: 'taskThemes',
    rationale: 'Task theme mentions review or risk; recommend a code-review pass before closeout.',
  },
  {
    skillName: 'design:accessibility-review',
    pattern: /\b(design|ux|ui|visual|layout|viewport|accessibility|a11y)\b/,
    source: 'taskThemes',
    rationale: 'Task theme mentions UI or accessibility; recommend a design/accessibility review.',
  },
  {
    skillName: 'executing-plans',
    pattern: /\b(plan|roadmap|batch|execution|execute|milestone)\b/,
    source: 'taskThemes',
    rationale: 'Task theme is plan execution; recommend the execution workflow as confirmed support.',
  },
  {
    skillName: 'dispatching-parallel-agents',
    pattern: /\b(dispatch|parallel|delegated|agent|session|handoff|lane)\b/,
    source: 'taskThemes',
    rationale: 'Task theme mentions delegated or parallel work; recommend dispatch support with confirmation.',
  },
];

const LANE_LABELS: Record<TemperanceDispatchLaneKey, string> = {
  assigned: 'Assigned',
  delegated: 'Delegated',
  blocked: 'Blocked',
  done: 'Done',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max = 96): string | null {
  const next = String(value ?? '').trim();
  return next ? next.slice(0, max) : null;
}

function redactRendererText(value: unknown, max = 96): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const redacted = raw
    .replace(/bearer\s+[a-z0-9._~+/=-]+/gi, 'bearer [redacted]')
    .replace(/\b((?:api[_-]?key|token|secret|password))\s*[:=]\s*[^,\s;]+/gi, '$1=[redacted]')
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, '[redacted-jwt]')
    .replace(/\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{16,}\b/g, '[redacted-token]')
    .replace(/\/(?:Users|Volumes|private|tmp)\/[^\s,;]+/g, '[redacted-path]');
  return redacted.slice(0, max);
}

function safeSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function taskThemeText(task: ThoughtseedFabricTask): string {
  return [
    task.title,
    task.description ?? '',
    task.projectName ?? '',
    task.taskType ?? '',
    task.status,
    task.workMode ?? '',
    task.proofStatus ?? '',
    task.evidenceStrength,
    ...task.history.flatMap((event) => [
      event.type,
      text(event.payload.status) ?? '',
      text(event.payload.reason ?? event.payload.blocker) ?? '',
    ]),
  ].join(' ').toLowerCase();
}

function sessionThemeText(candidate: AgentSessionCandidate): string {
  return [
    candidate.title,
    candidate.summary ?? '',
    candidate.projectName ?? '',
    candidate.repoFullName ?? '',
    ...candidate.confidenceReasons,
  ].join(' ').toLowerCase();
}

function tokenSet(value: string): Set<string> {
  return new Set(value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !['task', 'work', 'with', 'from', 'this', 'that'].includes(token)));
}

function tokenOverlap(left: string, right: string): number {
  const rightSet = tokenSet(right);
  return [...tokenSet(left)].filter((token) => rightSet.has(token)).length;
}

function recommendationFor(input: {
  task: ThoughtseedFabricTask;
  skillName: string;
  confidence: number;
  rationale: string;
  source: TemperanceSkillRecommendationSource;
}): TemperanceSkillRecommendation {
  const known = Boolean(KNOWN_SKILL_LABELS[input.skillName]);
  return {
    id: `skill_${input.task.taskId}_${safeSlug(input.skillName)}_${input.source}`,
    taskId: input.task.taskId,
    skillName: input.skillName,
    label: KNOWN_SKILL_LABELS[input.skillName] ?? input.skillName,
    known,
    confidence: Math.min(0.99, Math.max(0.1, Number(input.confidence.toFixed(2)))),
    rationale: input.rationale,
    safety: 'confirm_required',
    source: input.source,
  };
}

export function sanitizeTemperanceSkillHint(value: unknown): string | null {
  const raw = typeof value === 'string'
    ? value
    : isRecord(value)
      ? text(value.name ?? value.skill ?? value.skillName ?? value.id, 120)
      : null;
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes('://') || normalized.includes('\\') || normalized.startsWith('/') || normalized.includes('..')) return null;
  if (!/^[a-z0-9:_-]{2,80}$/.test(normalized)) return null;
  return normalized;
}

export function sanitizeTemperanceSkillHints(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.flatMap((item) => {
    const hint = sanitizeTemperanceSkillHint(item);
    return hint ? [hint] : [];
  }))).slice(0, max);
}

function statusFromPayload(value: unknown): ThoughtseedFabricTaskStatus | null {
  return value === 'assigned' || value === 'seen' || value === 'in_progress' || value === 'blocked' || value === 'done'
    ? value
    : null;
}

function modeFromPayload(value: unknown): ThoughtseedFabricTaskWorkMode | null {
  return value === 'manual' || value === 'delegated' ? value : null;
}

function eventKind(event: ThoughtseedFabricTaskHistoryEvent): TemperanceDispatchEventKind {
  if (event.type === 'assigned') return 'assignment';
  if (event.type === 'workMode_selected' || event.type === 'workMode_override') return 'mode';
  if (event.type === 'evidence_added' || event.type === 'candidate_evidence_found' || event.type === 'candidate_review_pending' || event.type === 'candidate_accepted' || event.type === 'candidate_rejected') return 'evidence';
  if (event.type === 'completion_upgraded' || event.type === 'done') return 'completion';
  if (event.type === 'bridge_conflict') return 'conflict';
  return 'status';
}

function payloadSummary(event: ThoughtseedFabricTaskHistoryEvent): string {
  const status = redactRendererText(event.payload.status);
  const workMode = redactRendererText(event.payload.workMode);
  const blocker = redactRendererText(event.payload.blocker ?? event.payload.reason);
  const artifact = isRecord(event.payload.evidence) ? redactRendererText(event.payload.evidence.value ?? event.payload.evidence.url) : null;
  return [status, workMode, blocker, artifact].filter(Boolean).join(' · ') || event.type;
}

function payloadRecordSummary(value: Record<string, unknown> | undefined): string {
  if (!value) return 'redacted conflict payload';
  const status = redactRendererText(value.status);
  const workMode = redactRendererText(value.workMode);
  const blocker = redactRendererText(value.blocker ?? value.reason);
  const evidence = isRecord(value.evidence) ? redactRendererText(value.evidence.value ?? value.evidence.type ?? value.evidence.label) : null;
  return [status, workMode, blocker, evidence].filter(Boolean).join(' · ') || 'redacted conflict payload';
}

function laneForTask(task: ThoughtseedFabricTask): TemperanceDispatchLaneKey {
  if (task.status === 'done') return 'done';
  if (task.status === 'blocked') return 'blocked';
  if (task.workMode === 'delegated') return 'delegated';
  return 'assigned';
}

function conflictCountForTask(task: ThoughtseedFabricTask): number {
  return task.history.filter((event) => event.type === 'bridge_conflict').length;
}

function laneTask(task: ThoughtseedFabricTask): TemperanceDispatchLaneTask {
  return {
    taskId: task.taskId,
    title: task.title,
    status: task.status,
    workMode: task.workMode ?? null,
    evidenceStrength: task.evidenceStrength,
    proofStatus: task.proofStatus ?? null,
    updatedAt: task.updatedAt,
    conflictCount: conflictCountForTask(task),
  };
}

export function deriveTemperanceSkillRecommendations(
  tasks: readonly ThoughtseedFabricTask[],
  sessions: readonly AgentSessionCandidate[] = [],
): TemperanceSkillRecommendation[] {
  const recommendations = new Map<string, TemperanceSkillRecommendation>();
  const sessionLinks = deriveTemperanceDispatchSessionLinks(tasks, sessions);

  function add(recommendation: TemperanceSkillRecommendation) {
    const key = `${recommendation.taskId}:${recommendation.skillName}`;
    const current = recommendations.get(key);
    if (!current || recommendation.confidence > current.confidence) {
      recommendations.set(key, recommendation);
    }
  }

  for (const task of tasks) {
    for (const hint of task.skillHints ?? []) {
      const skillName = sanitizeTemperanceSkillHint(hint);
      if (!skillName) continue;
      const known = Boolean(KNOWN_SKILL_LABELS[skillName]);
      add(recommendationFor({
        task,
        skillName,
        confidence: known ? 0.82 : 0.48,
        rationale: known
          ? 'Task includes a known Temperance skill hint; recommend it as a confirmed workflow aid.'
          : 'Task includes an unknown skill hint; preserve the name as metadata only.',
        source: 'skillHints',
      }));
    }
    const haystack = taskThemeText(task);
    for (const rule of THEME_SKILLS) {
      if (!rule.pattern.test(haystack)) continue;
      add(recommendationFor({
        task,
        skillName: rule.skillName,
        confidence: task.workMode === 'delegated' ? 0.76 : 0.66,
        rationale: rule.rationale,
        source: rule.source,
      }));
    }
  }

  for (const link of sessionLinks) {
    const task = tasks.find((candidate) => candidate.taskId === link.taskId);
    const session = sessions.find((candidate) => candidate.id === link.candidateId);
    if (!task || !session) continue;
    const haystack = sessionThemeText(session);
    for (const rule of THEME_SKILLS) {
      if (!rule.pattern.test(haystack)) continue;
      add(recommendationFor({
        task,
        skillName: rule.skillName,
        confidence: Math.max(0.58, link.confidence - 0.12),
        rationale: `Linked ${session.provider} session themes support this skill recommendation.`,
        source: 'sessionThemes',
      }));
    }
  }

  return [...recommendations.values()].sort((left, right) => {
    const byConfidence = right.confidence - left.confidence;
    if (byConfidence !== 0) return byConfidence;
    if (left.known !== right.known) return left.known ? -1 : 1;
    return left.label.localeCompare(right.label);
  });
}

export function deriveTemperanceDispatchEvents(
  tasks: readonly ThoughtseedFabricTask[],
  limit = 12,
): TemperanceDispatchEvent[] {
  return tasks
    .flatMap((task) => task.history.map((event): TemperanceDispatchEvent => ({
      eventId: event.eventId,
      taskId: task.taskId,
      kind: eventKind(event),
      historyType: event.type,
      source: event.source,
      actor: event.actor,
      timestamp: event.timestamp,
      correlationId: event.correlationId ?? task.correlationId ?? null,
      status: statusFromPayload(event.payload.status) ?? task.status,
      workMode: modeFromPayload(event.payload.workMode) ?? task.workMode ?? null,
      evidenceStrength: task.evidenceStrength ?? null,
      conflict: event.type === 'bridge_conflict',
      payloadSummary: payloadSummary(event),
    })))
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp) || left.eventId.localeCompare(right.eventId))
    .slice(0, limit);
}

export function deriveTemperanceDispatchLaneStatus(
  tasks: readonly ThoughtseedFabricTask[],
): TemperanceDispatchLaneSummary[] {
  const lanes: Record<TemperanceDispatchLaneKey, TemperanceDispatchLaneTask[]> = {
    assigned: [],
    delegated: [],
    blocked: [],
    done: [],
  };
  for (const task of tasks) {
    lanes[laneForTask(task)].push(laneTask(task));
  }
  const order: TemperanceDispatchLaneKey[] = ['assigned', 'delegated', 'blocked', 'done'];
  return order.map((key) => ({
    key,
    label: LANE_LABELS[key],
    count: lanes[key].length,
    tasks: lanes[key].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, 8),
  }));
}

export function deriveTemperanceDispatchSessionLinks(
  tasks: readonly ThoughtseedFabricTask[],
  sessions: readonly AgentSessionCandidate[],
  limit = 12,
): TemperanceDispatchSessionLink[] {
  const links: TemperanceDispatchSessionLink[] = [];
  for (const task of tasks) {
    for (const session of sessions) {
      if (session.status === 'dismissed' || session.status === 'ignored') continue;
      let matchReason: TemperanceDispatchSessionLink['matchReason'] | null = null;
      let confidence = Math.min(0.9, Math.max(0.35, session.confidence / 100));
      if (task.projectId && session.projectId && task.projectId === session.projectId) {
        matchReason = 'project';
        confidence += 0.08;
      } else if (task.projectName && session.projectName && task.projectName.toLowerCase() === session.projectName.toLowerCase()) {
        matchReason = 'project_name';
        confidence += 0.04;
      } else if (tokenOverlap(taskThemeText(task), sessionThemeText(session)) >= 2 && session.confidence >= 55) {
        matchReason = 'theme';
      }
      if (!matchReason) continue;
      links.push({
        id: `dispatch_link_${safeSlug(task.taskId)}_${safeSlug(session.id)}`,
        taskId: task.taskId,
        candidateId: session.id,
        provider: session.provider,
        title: text(session.title, 120) ?? session.provider,
        status: session.status,
        matchReason,
        confidence: Math.min(0.99, Number(confidence.toFixed(2))),
        evidenceStrength: task.evidenceStrength,
        artifactRefs: session.createdEntryId ? [session.createdEntryId] : [],
        correlationId: task.correlationId ?? null,
      });
    }
  }
  return links
    .sort((left, right) => right.confidence - left.confidence || left.taskId.localeCompare(right.taskId))
    .slice(0, limit);
}

export function deriveTemperanceDispatchDiagnostics(input: {
  tasks: readonly ThoughtseedFabricTask[];
  lanes: readonly TemperanceDispatchLaneSummary[];
  recommendations: readonly TemperanceSkillRecommendation[];
  sessionLinks: readonly TemperanceDispatchSessionLink[];
  recentEvents: readonly TemperanceDispatchEvent[];
}): TemperanceDispatchDiagnostics {
  const taskCountFor = (key: TemperanceDispatchLaneKey) => input.lanes.find((lane) => lane.key === key)?.count ?? 0;
  const conflictCount = input.tasks.reduce((sum, task) => sum + conflictCountForTask(task), 0);
  const lastEventAt = input.recentEvents[0]?.timestamp ?? input.tasks
    .map((task) => task.updatedAt)
    .sort()
    .at(-1) ?? null;
  return {
    totalTasks: input.tasks.length,
    activeTasks: taskCountFor('assigned') + taskCountFor('delegated') + taskCountFor('blocked'),
    delegatedTasks: taskCountFor('delegated'),
    blockedTasks: taskCountFor('blocked'),
    doneTasks: taskCountFor('done'),
    conflictCount,
    recommendationCount: input.recommendations.length,
    linkedSessionCount: input.sessionLinks.length,
    lastEventAt,
  };
}

export function deriveTemperanceDispatchConflicts(
  tasks: readonly ThoughtseedFabricTask[],
  storedConflicts: readonly TemperanceDispatchConflictInput[] = [],
  limit = 12,
): TemperanceDispatchConflictRecord[] {
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const records = new Map<string, TemperanceDispatchConflictRecord>();

  function add(record: TemperanceDispatchConflictRecord) {
    const key = `${record.taskId}:${record.eventId}:${record.incomingPayloadHash}`;
    if (!records.has(key)) records.set(key, record);
  }

  for (const conflict of storedConflicts) {
    const task = taskById.get(conflict.taskId);
    const event = task?.history.find((row) => row.eventId === conflict.eventId);
    add({
      id: `conflict_${safeSlug(conflict.taskId)}_${safeSlug(conflict.eventId)}_${safeSlug(conflict.incomingPayloadHash)}`,
      taskId: conflict.taskId,
      eventId: conflict.eventId,
      createdAt: conflict.createdAt,
      correlationId: event?.correlationId ?? task?.correlationId ?? null,
      existingPayloadHash: conflict.existingPayloadHash,
      incomingPayloadHash: conflict.incomingPayloadHash,
      payloadSummary: payloadRecordSummary(conflict.incomingPayload),
      status: 'needs_review',
    });
  }

  for (const task of tasks) {
    for (const event of task.history) {
      if (event.type !== 'bridge_conflict') continue;
      add({
        id: `conflict_${safeSlug(task.taskId)}_${safeSlug(event.eventId)}_${safeSlug(event.payloadHash)}`,
        taskId: task.taskId,
        eventId: event.eventId,
        createdAt: event.timestamp,
        correlationId: event.correlationId ?? task.correlationId ?? null,
        existingPayloadHash: text(event.payload.existingPayloadHash) ?? null,
        incomingPayloadHash: event.payloadHash,
        payloadSummary: payloadSummary(event),
        status: 'needs_review',
      });
    }
  }

  return [...records.values()]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.eventId.localeCompare(right.eventId))
    .slice(0, limit);
}

function deriveTemperanceDispatchCorrelationIds(input: {
  tasks: readonly ThoughtseedFabricTask[];
  sessionLinks: readonly TemperanceDispatchSessionLink[];
  recentEvents: readonly TemperanceDispatchEvent[];
  conflicts: readonly TemperanceDispatchConflictRecord[];
}): string[] {
  const ids = new Set<string>();
  for (const task of input.tasks) {
    if (task.correlationId) ids.add(task.correlationId);
    for (const event of task.history) {
      if (event.correlationId) ids.add(event.correlationId);
    }
  }
  for (const link of input.sessionLinks) {
    if (link.correlationId) ids.add(link.correlationId);
  }
  for (const event of input.recentEvents) {
    if (event.correlationId) ids.add(event.correlationId);
  }
  for (const conflict of input.conflicts) {
    if (conflict.correlationId) ids.add(conflict.correlationId);
  }
  return [...ids].sort().slice(0, 16);
}

function buildTemperanceDispatchSupportPacket(input: {
  generatedAt: string;
  diagnostics: TemperanceDispatchDiagnostics;
  correlationIds: readonly string[];
  conflicts: readonly TemperanceDispatchConflictRecord[];
}): TemperanceDispatchSupportPacket {
  return {
    packetId: `support_${safeSlug(input.generatedAt)}`,
    generatedAt: input.generatedAt,
    localOnly: true,
    summary: {
      totalTasks: input.diagnostics.totalTasks,
      activeTasks: input.diagnostics.activeTasks,
      delegatedTasks: input.diagnostics.delegatedTasks,
      conflictCount: input.conflicts.length,
      recommendationCount: input.diagnostics.recommendationCount,
      linkedSessionCount: input.diagnostics.linkedSessionCount,
      lastEventAt: input.diagnostics.lastEventAt,
    },
    correlationIds: [...input.correlationIds],
    conflictEventIds: input.conflicts.map((conflict) => conflict.eventId),
    redactions: [
      'bridge tokens',
      'raw skill hint objects',
      'agent session source paths',
      'raw conflict payloads',
      'local repository roots',
    ],
    boundary: 'Local smoke only; no live Cambium, Hermes, or external parallel-agent execution was attempted.',
  };
}

function buildTemperanceDispatchLocalSmoke(input: {
  generatedAt: string;
  recommendations: readonly TemperanceSkillRecommendation[];
  conflicts: readonly TemperanceDispatchConflictRecord[];
  supportPacket: TemperanceDispatchSupportPacket;
  toolHarnessPlan: TemperanceToolHarnessRunPlan;
}): TemperanceDispatchLocalSmokeResult {
  const checks = [
    {
      name: 'recommendations-confirm-required',
      ok: input.recommendations.every((recommendation) => recommendation.safety === 'confirm_required'),
      detail: 'Every dispatch recommendation stays confirmation gated.',
    },
    {
      name: 'conflicts-renderer-safe',
      ok: input.conflicts.every((conflict) => !JSON.stringify(conflict).match(/sourcePath|repoRoot|bearer\s+[a-z0-9._~+/=-]+|(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^,\s;]+|\/(?:Users|Volumes|private|tmp)\//i)),
      detail: 'Conflict rows expose hashes and summaries, not raw payloads or paths.',
    },
    {
      name: 'support-packet-redacted',
      ok: input.supportPacket.localOnly && input.supportPacket.redactions.length >= 4,
      detail: 'Support packet declares the redaction classes before sharing diagnostics.',
    },
    {
      name: 'tool-harness-bounded',
      ok: input.toolHarnessPlan.auditRequired && input.toolHarnessPlan.redactionRequired && input.toolHarnessPlan.timeoutMs <= 600000,
      detail: 'Tool harness plan requires audit, redaction, and bounded timeout.',
    },
  ];
  return {
    ok: checks.every((check) => check.ok),
    checkedAt: input.generatedAt,
    checks,
    boundary: 'Deterministic local dispatch smoke; live bridge/operator dispatch remains out of scope.',
  };
}

function buildTemperanceDispatchRuntime(input: {
  tasks: readonly ThoughtseedFabricTask[];
  sessionLinks: readonly TemperanceDispatchSessionLink[];
  recentEvents: readonly TemperanceDispatchEvent[];
  diagnostics: TemperanceDispatchDiagnostics;
  recommendations: readonly TemperanceSkillRecommendation[];
  conflicts?: readonly TemperanceDispatchConflictInput[];
  generatedAt: string;
  toolHarnessPlan: TemperanceToolHarnessRunPlan;
}): TemperanceDispatchRuntimeDiagnostics {
  const conflicts = deriveTemperanceDispatchConflicts(input.tasks, input.conflicts ?? []);
  const correlationIds = deriveTemperanceDispatchCorrelationIds({
    tasks: input.tasks,
    sessionLinks: input.sessionLinks,
    recentEvents: input.recentEvents,
    conflicts,
  });
  const supportPacket = buildTemperanceDispatchSupportPacket({
    generatedAt: input.generatedAt,
    diagnostics: input.diagnostics,
    correlationIds,
    conflicts,
  });
  return {
    correlationIds,
    conflicts,
    supportPacket,
    localSmoke: buildTemperanceDispatchLocalSmoke({
      generatedAt: input.generatedAt,
      recommendations: input.recommendations,
      conflicts,
      supportPacket,
      toolHarnessPlan: input.toolHarnessPlan,
    }),
  };
}

export function classifyTemperanceDispatchFailure(value: unknown): TemperanceDispatchFailureKind {
  const message = String(value instanceof Error ? value.message : value ?? '').toLowerCase();
  if (/\b(auth|unauthorized|forbidden|credential|token|permission)\b/.test(message)) return 'auth';
  if (/\b(quota|rate limit|429|limit exceeded)\b/.test(message)) return 'quota';
  if (/\b(network|fetch|timeout|timed out|econn|enotfound|offline)\b/.test(message)) return 'network';
  if (/\b(validation|schema|invalid|malformed|required)\b/.test(message)) return 'validation';
  if (/\b(conflict|duplicate|race|mismatch)\b/.test(message)) return 'conflict';
  if (/\b(cancel|cancelled|canceled|user)\b/.test(message)) return 'user_cancel';
  return 'unknown';
}

export function buildTemperanceToolHarnessRunPlan(input: {
  permission?: 'read_only' | 'write' | 'admin';
  timeoutMs?: number;
} = {}): TemperanceToolHarnessRunPlan {
  const permission = input.permission ?? 'read_only';
  return {
    visible: true,
    permissions: permission === 'admin' ? ['read_only', 'write', 'admin'] : permission === 'write' ? ['read_only', 'write'] : ['read_only'],
    auditRequired: true,
    timeoutMs: Math.min(Math.max(input.timeoutMs ?? 120000, 5000), 600000),
    redactionRequired: true,
    failureKinds: ['auth', 'quota', 'network', 'validation', 'conflict', 'user_cancel', 'unknown'],
    copy: 'Tool runs require explicit permission, audit rows, bounded timeout, redaction, and failure-kind classification.',
    invariants: [
      'permission is explicit before execution',
      'audit record is required',
      'timeout is bounded',
      'secret-like fields are redacted',
      'failure kind is classified',
    ],
  };
}

export function buildTemperanceParallelAgentHandoffRecord(input: {
  parentTaskId: string;
  childSessionId: string;
  owner: string;
  status?: TemperanceParallelAgentHandoffRecord['status'];
  evidenceStrength?: TemperanceParallelAgentHandoffRecord['evidenceStrength'];
  artifactRefs?: string[];
  correlationId?: string | null;
}): TemperanceParallelAgentHandoffRecord {
  return {
    id: `handoff_${input.parentTaskId}_${input.childSessionId}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
    parentTaskId: input.parentTaskId,
    childSessionId: input.childSessionId,
    owner: input.owner,
    status: input.status ?? 'assigned',
    evidenceRequired: true,
    evidenceStrength: input.evidenceStrength ?? 'weak_evidence',
    artifactRefs: input.artifactRefs ?? [],
    correlationId: input.correlationId ?? null,
  };
}

export function buildTemperanceDispatchLaneStatusResult(input: {
  tasks: readonly ThoughtseedFabricTask[];
  sessions?: readonly AgentSessionCandidate[];
  conflicts?: readonly TemperanceDispatchConflictInput[];
  generatedAt?: string;
}): TemperanceDispatchLaneStatusResult {
  const sessions = input.sessions ?? [];
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const lanes = deriveTemperanceDispatchLaneStatus(input.tasks);
  const sessionLinks = deriveTemperanceDispatchSessionLinks(input.tasks, sessions);
  const recommendations = deriveTemperanceSkillRecommendations(input.tasks, sessions);
  const recentEvents = deriveTemperanceDispatchEvents(input.tasks);
  const diagnostics = deriveTemperanceDispatchDiagnostics({
    tasks: input.tasks,
    lanes,
    recommendations,
    sessionLinks,
    recentEvents,
  });
  const toolHarnessPlan = buildTemperanceToolHarnessRunPlan();
  const runtime = buildTemperanceDispatchRuntime({
    tasks: input.tasks,
    sessionLinks,
    recentEvents,
    diagnostics,
    recommendations,
    conflicts: input.conflicts,
    generatedAt,
    toolHarnessPlan,
  });
  return {
    ok: true,
    generatedAt,
    lanes,
    recommendations,
    sessionLinks,
    recentEvents,
    diagnostics,
    runtime,
    toolHarnessPlan,
  };
}
