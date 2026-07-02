import { hashBridgePayload } from './thoughtseed-bridge-crypto.js';
import type {
  ThoughtseedBridgeDirective,
  ThoughtseedFabricTask,
  ThoughtseedFabricTaskHistoryEvent,
  ThoughtseedFabricHistoryEventType,
} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  const next = String(value ?? '').trim();
  return next || undefined;
}

function textArray(value: unknown, max = 120): string[] {
  return Array.isArray(value)
    ? value.map((item) => {
      const next = String(item ?? '').trim();
      return next ? next.slice(0, max) : '';
    }).filter(Boolean)
    : [];
}

function unknownArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function priority(value: unknown): ThoughtseedFabricTask['priority'] {
  return value === 'low' || value === 'normal' || value === 'high' || value === 'urgent'
    ? value
    : 'normal';
}

function taskType(value: unknown): ThoughtseedFabricTask['taskType'] {
  return value === 'engineering' || value === 'design' || value === 'marketing' || value === 'operations' || value === 'research' || value === 'general'
    ? value
    : 'general';
}

function eventSource(value: unknown): ThoughtseedFabricTaskHistoryEvent['source'] {
  return value === 'plexus'
    || value === 'hermes'
    || value === 'cambium'
    || value === 'paperclip'
    || value === 'github'
    || value === 'figma'
    || value === 'canva'
    || value === 'deploy'
    || value === 'manual'
    ? value
    : 'plexus';
}

function taskSource(value: ThoughtseedFabricTaskHistoryEvent['source']): 'hermes' | 'cambium' | 'paperclip' {
  return value === 'cambium' || value === 'paperclip' ? value : 'hermes';
}

function historyEventType(value: unknown): ThoughtseedFabricHistoryEventType | null {
  return value === 'assigned'
    || value === 'seen'
    || value === 'workMode_selected'
    || value === 'status_changed'
    || value === 'blocked'
    || value === 'done'
    || value === 'evidence_added'
    || value === 'candidate_evidence_found'
    || value === 'candidate_review_pending'
    || value === 'candidate_accepted'
    || value === 'candidate_rejected'
    || value === 'workMode_override'
    || value === 'completion_upgraded'
    || value === 'bridge_conflict'
    ? value
    : null;
}

function directiveTaskPayload(directive: ThoughtseedBridgeDirective): Record<string, unknown> | null {
  const payload = directive.payload;
  if (!isRecord(payload)) return null;
  const type = text(payload.type ?? payload.kind);
  if (type !== 'project_task_assignment' && type !== 'fabric_task_assignment') return null;
  return isRecord(payload.task) ? payload.task : payload;
}

function branchMissionMetadata(taskPayload: Record<string, unknown>, root: Record<string, unknown>) {
  const nested = isRecord(taskPayload.branchMission)
    ? taskPayload.branchMission
    : isRecord(root.branchMission)
      ? root.branchMission
      : {};
  const kpiIds = textArray(taskPayload.kpiIds ?? root.kpiIds ?? nested.kpiIds);
  const approvalsRequired = textArray(taskPayload.approvalsRequired ?? root.approvalsRequired ?? nested.approvalsRequired, 240);
  const skillHints = unknownArray(taskPayload.skillHints ?? root.skillHints ?? nested.skillHints);
  return {
    branchId: text(taskPayload.branchId ?? root.branchId ?? nested.branchId),
    arcId: text(taskPayload.arcId ?? root.arcId ?? nested.arcId),
    missionId: text(taskPayload.missionId ?? root.missionId ?? nested.missionId),
    ...(kpiIds.length ? { kpiIds } : {}),
    gateId: text(taskPayload.gateId ?? root.gateId ?? nested.gateId),
    proofRequired: text(taskPayload.proofRequired ?? root.proofRequired ?? nested.proofRequired),
    proofFoldback: text(taskPayload.proofFoldback ?? root.proofFoldback ?? nested.proofFoldback),
    promotionState: text(taskPayload.promotionState ?? root.promotionState ?? nested.promotionState),
    autonomyBoundary: text(taskPayload.autonomyBoundary ?? root.autonomyBoundary ?? nested.autonomyBoundary),
    ...(approvalsRequired.length ? { approvalsRequired } : {}),
    ...(skillHints ? { skillHints } : {}),
  };
}

export function historyEventFromThoughtseedDirective(
  directive: ThoughtseedBridgeDirective,
  receivedAt = new Date().toISOString(),
): { taskId: string; event: ThoughtseedFabricTaskHistoryEvent } | null {
  const root = directive.payload;
  if (!isRecord(root)) return null;
  const type = text(root.type ?? root.kind);
  if (type !== 'fabric_task_history_event') return null;
  const rawEvent = isRecord(root.event) ? root.event : root;
  const eventPayload = isRecord(rawEvent.payload) ? rawEvent.payload : root;
  const taskId = text(eventPayload.taskId ?? rawEvent.taskId ?? root.taskId);
  const eventType = historyEventType(rawEvent.type ?? root.eventType);
  if (!taskId || !eventType) return null;
  const source = eventSource(rawEvent.source ?? root.source);
  const correlationId = text(rawEvent.correlationId ?? root.correlationId ?? directive.id);
  const payload = {
    ...eventPayload,
    directiveId: directive.id,
  };
  return {
    taskId,
    event: {
      eventId: text(rawEvent.eventId ?? root.eventId ?? directive.id) || directive.id,
      timestamp: text(rawEvent.timestamp ?? root.issuedAt ?? directive.issuedAt ?? directive.createdAt) || receivedAt,
      actor: text(rawEvent.actor ?? root.actor) || source,
      source,
      type: eventType,
      payloadHash: hashBridgePayload(payload),
      payload,
      correlationId,
    },
  };
}

function makeAssignmentEvent(input: {
  eventId: string;
  actor: string;
  source: ThoughtseedFabricTaskHistoryEvent['source'];
  payload: Record<string, unknown>;
  timestamp: string;
  correlationId?: string;
}): ThoughtseedFabricTaskHistoryEvent {
  return {
    eventId: input.eventId,
    timestamp: input.timestamp,
    actor: input.actor,
    source: input.source,
    type: 'assigned',
    payloadHash: hashBridgePayload(input.payload),
    payload: input.payload,
    correlationId: input.correlationId,
  };
}

export function taskFromThoughtseedDirective(
  directive: ThoughtseedBridgeDirective,
  memberId: string,
  tenantId: string,
  receivedAt = new Date().toISOString(),
): { task: ThoughtseedFabricTask; event: ThoughtseedFabricTaskHistoryEvent } | null {
  const taskPayload = directiveTaskPayload(directive);
  if (!taskPayload) return null;
  const root = directive.payload;
  const taskId = text(taskPayload.taskId ?? taskPayload.id ?? root.taskId) || `directive:${directive.id}`;
  const correlationId = text(taskPayload.correlationId ?? root.correlationId ?? directive.id);
  const source = eventSource(root.source ?? taskPayload.source ?? 'hermes');
  const sourceTask = taskSource(source);
  const branchMeta = branchMissionMetadata(taskPayload, root);
  const actor = text(taskPayload.assignedBy ?? root.assignedBy) || sourceTask;
  const assigneeMemberId = text(taskPayload.assigneeMemberId ?? root.assigneeMemberId ?? directive.memberId)
    || text((isRecord(root.target) ? root.target.memberId : undefined))
    || memberId;
  const eventPayload = {
    type: 'assigned',
    directiveId: directive.id,
    taskId,
    tenantId,
    projectId: text(taskPayload.projectId ?? root.projectId),
    questId: text(taskPayload.questId ?? root.questId),
    ...branchMeta,
    title: text(taskPayload.title ?? root.title) || taskId,
    assigneeMemberId,
  };
  const event = makeAssignmentEvent({
    eventId: text(taskPayload.eventId ?? root.eventId ?? directive.id) || directive.id,
    actor,
    source,
    payload: eventPayload,
    timestamp: text(directive.issuedAt ?? root.issuedAt ?? directive.createdAt) || receivedAt,
    correlationId,
  });
  return {
    task: {
      taskId,
      directiveId: directive.id,
      correlationId,
      projectId: text(taskPayload.projectId ?? root.projectId),
      projectName: text(taskPayload.projectName ?? root.projectName),
      questId: text(taskPayload.questId ?? root.questId),
      ...branchMeta,
      clientId: text(taskPayload.clientId ?? root.clientId),
      clientName: text(taskPayload.clientName ?? root.clientName),
      title: text(taskPayload.title ?? root.title) || taskId,
      description: text(taskPayload.description ?? root.description),
      priority: priority(taskPayload.priority ?? root.priority),
      taskType: taskType(taskPayload.taskType ?? root.taskType),
      assigneeMemberId,
      assignedBy: actor,
      source: sourceTask,
      status: 'assigned',
      workModeLocked: false,
      overrideCount: 0,
      evidenceStrength: 'weak_evidence',
      evidence: [],
      history: [event],
      updatedAt: event.timestamp,
    },
    event,
  };
}
