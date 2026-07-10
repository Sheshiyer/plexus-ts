import type {
  AssistantToolSafety,
  TemperanceDispatchEvent,
  TemperanceDispatchEventKind,
  TemperanceDispatchLaneKey,
  TemperanceDispatchLaneStatusResult,
  TemperanceDispatchLaneSummary,
  TemperanceDispatchLaneTask,
  TemperanceParallelAgentHandoffRecord,
  TemperanceSkillRecommendation,
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
  const status = text(event.payload.status);
  const workMode = text(event.payload.workMode);
  const blocker = text(event.payload.blocker ?? event.payload.reason);
  const artifact = isRecord(event.payload.evidence) ? text(event.payload.evidence.value ?? event.payload.evidence.url) : null;
  return [status, workMode, blocker, artifact].filter(Boolean).join(' · ') || event.type;
}

function laneForTask(task: ThoughtseedFabricTask): TemperanceDispatchLaneKey {
  if (task.status === 'done') return 'done';
  if (task.status === 'blocked') return 'blocked';
  if (task.workMode === 'delegated') return 'delegated';
  return 'assigned';
}

function conflictCount(task: ThoughtseedFabricTask): number {
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
    conflictCount: conflictCount(task),
  };
}

export function deriveTemperanceSkillRecommendations(
  tasks: readonly ThoughtseedFabricTask[],
): TemperanceSkillRecommendation[] {
  const seen = new Set<string>();
  const recommendations: TemperanceSkillRecommendation[] = [];
  for (const task of tasks) {
    for (const hint of task.skillHints ?? []) {
      const skillName = sanitizeTemperanceSkillHint(hint);
      if (!skillName) continue;
      const key = `${task.taskId}:${skillName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const known = Boolean(KNOWN_SKILL_LABELS[skillName]);
      const safety: AssistantToolSafety = 'confirm_required';
      recommendations.push({
        id: `skill_${task.taskId}_${skillName.replace(/[^a-z0-9]+/g, '_')}`,
        taskId: task.taskId,
        skillName,
        label: KNOWN_SKILL_LABELS[skillName] ?? skillName,
        known,
        confidence: known ? 0.82 : 0.48,
        rationale: known
          ? 'Task includes a known Temperance skill hint; recommend it as a confirmed workflow aid.'
          : 'Task includes an unknown skill hint; preserve the name as metadata only.',
        safety,
        source: 'skillHints',
      });
    }
  }
  return recommendations;
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
  generatedAt?: string;
}): TemperanceDispatchLaneStatusResult {
  return {
    ok: true,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    lanes: deriveTemperanceDispatchLaneStatus(input.tasks),
    recommendations: deriveTemperanceSkillRecommendations(input.tasks),
    recentEvents: deriveTemperanceDispatchEvents(input.tasks),
    toolHarnessPlan: buildTemperanceToolHarnessRunPlan(),
  };
}
