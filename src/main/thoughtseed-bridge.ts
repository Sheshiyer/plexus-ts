import { safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { getSetting, setSetting } from '../db/database.js';
import {
  hashBridgePayload,
  isBridgeTokenExpired,
  signBridgeMessage,
} from '../shared/thoughtseed-bridge-crypto.js';
import { historyEventFromThoughtseedDirective, taskFromThoughtseedDirective } from '../shared/thoughtseed-fabric-task.js';
import type {
  ThoughtseedFabricEvidence,
  ThoughtseedFabricEvidenceStrength,
  ThoughtseedFabricEvidenceType,
  ThoughtseedFabricHistoryEventType,
  ThoughtseedFabricTask,
  ThoughtseedFabricTaskHistoryEvent,
  ThoughtseedFabricTaskListResult,
  ThoughtseedFabricTaskReportInput,
  ThoughtseedFabricTaskReportResult,
  ThoughtseedFabricTaskStatus,
  ThoughtseedFabricTaskSyncResult,
  ThoughtseedFabricTaskWorkMode,
  ThoughtseedFabricWorkModeResult,
  ThoughtseedBridgeAckResult,
  ThoughtseedBridgeDirective,
  ThoughtseedBridgeHeartbeatResult,
  ThoughtseedBridgePollResult,
  ThoughtseedBridgeRedeemResult,
  ThoughtseedBridgeRotateResult,
  ThoughtseedBridgeStatus,
} from '../shared/types.js';
import type {
  AssistantDailyDeliveryResult,
  AssistantDailyEvent,
} from '../shared/native-assistant.js';
import { redactedErrorMessage } from './redaction.js';

const DEFAULT_BRIDGE_API_URL = 'https://curious.thoughtseed.space';
const DEFAULT_TENANT_ID = 'cambium';

const KEYS = {
  apiUrl: 'ts.bridgeApiUrl',
  memberId: 'ts.bridgeMemberId',
  tenantId: 'ts.bridgeTenantId',
  tokenEnc: 'ts.bridgeTokenEnc',
  tokenExpiresAt: 'ts.bridgeTokenExpiresAt',
  lastSeenAt: 'ts.bridgeLastSeenAt',
  lastIngestId: 'ts.bridgeLastIngestId',
  lastError: 'ts.bridgeLastError',
  fabricTasksJson: 'ts.fabricTasksJson',
} as const;

interface BridgeCredential {
  bridgeApiUrl: string;
  memberId: string;
  tenantId: string;
  token: string;
  tokenExpiresAt: string | null;
}

interface BridgeMessage {
  version: '1.0.0';
  id: string;
  timestamp: string;
  direction: 'upstream';
  tenantId: string;
  memberId: string;
  payload: Record<string, unknown>;
}

type AppendResult = 'appended' | 'duplicate' | 'conflict';

function nowIso(): string {
  return new Date().toISOString();
}

function text(value: unknown): string | undefined {
  const next = String(value ?? '').trim();
  return next || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function directiveTenantId(directive: ThoughtseedBridgeDirective): string | undefined {
  const payload = isRecord(directive.payload) ? directive.payload : null;
  const target = payload && isRecord(payload.target) ? payload.target : null;
  const task = payload && isRecord(payload.task) ? payload.task : null;
  return text(directive.tenantId)
    || text(payload?.tenantId)
    || text(target?.tenantId)
    || text(task?.tenantId);
}

function directiveMemberId(directive: ThoughtseedBridgeDirective): string | undefined {
  const payload = isRecord(directive.payload) ? directive.payload : null;
  const target = payload && isRecord(payload.target) ? payload.target : null;
  const task = payload && isRecord(payload.task) ? payload.task : null;
  return text(directive.memberId)
    || text(payload?.memberId)
    || text(target?.memberId)
    || text(task?.assigneeMemberId);
}

function assertTaskOwnership(task: ThoughtseedFabricTask, memberId: string, action: string): void {
  if (task.assigneeMemberId !== memberId) {
    throw new Error(`Cannot ${action} Fabric task ${task.taskId}; task is assigned to ${task.assigneeMemberId}.`);
  }
}

function eventSource(value: unknown): ThoughtseedFabricTaskHistoryEvent['source'] {
  return value === 'hermes' || value === 'cambium' || value === 'paperclip' || value === 'github' || value === 'figma' || value === 'canva' || value === 'deploy' || value === 'manual'
    ? value
    : 'plexus';
}

function verifiedEvidenceType(type: ThoughtseedFabricEvidenceType): boolean {
  return type !== 'note';
}

function evidenceStrengthFor(evidence?: { type: ThoughtseedFabricEvidenceType; value: string } | null): ThoughtseedFabricEvidenceStrength {
  return evidence && evidence.value.trim() && verifiedEvidenceType(evidence.type)
    ? 'verified_evidence'
    : 'weak_evidence';
}

function fabricWorkMode(value: unknown): ThoughtseedFabricTaskWorkMode | null {
  return value === 'manual' || value === 'delegated' ? value : null;
}

function fabricEvidenceType(value: unknown): ThoughtseedFabricEvidenceType {
  return value === 'github_pr'
    || value === 'github_commit'
    || value === 'github_branch'
    || value === 'deploy_url'
    || value === 'figma_url'
    || value === 'canva_url'
    || value === 'doc_url'
    || value === 'file_path'
    || value === 'note'
    ? value
    : 'note';
}

function evidenceFromHistoryPayload(
  payload: Record<string, unknown>,
  addedAt: string,
  strength: ThoughtseedFabricEvidenceStrength,
): ThoughtseedFabricEvidence | null {
  const evidence = payload.evidence && typeof payload.evidence === 'object' && !Array.isArray(payload.evidence)
    ? payload.evidence as Record<string, unknown>
    : null;
  if (!evidence) return null;
  const value = text(evidence.value ?? evidence.url ?? evidence.branch ?? evidence.commit ?? evidence.path ?? evidence.note);
  if (!value) return null;
  const status = payload.status === 'verified_evidence' || payload.status === 'review_pending' || payload.status === 'rejected_candidate'
    ? payload.status
    : undefined;
  return {
    id: text(evidence.id ?? payload.evidenceCandidateId) || `ev_${Date.now()}_${randomUUID().slice(0, 8)}`,
    type: fabricEvidenceType(evidence.type),
    value,
    label: text(evidence.label) || (status === 'rejected_candidate' ? 'Rejected candidate' : undefined),
    source: eventSource(evidence.source ?? fabricEvidenceType(evidence.type).split('_')[0]),
    strength,
    status,
    addedAt,
  };
}

function addEvidenceIfMissing(task: ThoughtseedFabricTask, evidence: ThoughtseedFabricEvidence): void {
  if (task.evidence.some((item) => item.id === evidence.id)) return;
  task.evidence = [...task.evidence, evidence];
}

function makeEvent(input: {
  eventId?: string;
  type: ThoughtseedFabricHistoryEventType;
  actor: string;
  source: ThoughtseedFabricTaskHistoryEvent['source'];
  payload: Record<string, unknown>;
  timestamp?: string;
  correlationId?: string;
}): ThoughtseedFabricTaskHistoryEvent {
  const payloadHash = hashBridgePayload(input.payload);
  return {
    eventId: input.eventId || `plexus_${input.type}_${Date.now()}_${randomUUID()}`,
    timestamp: input.timestamp || nowIso(),
    actor: input.actor,
    source: input.source,
    type: input.type,
    payloadHash,
    payload: input.payload,
    correlationId: input.correlationId,
  };
}

function appendHistory(task: ThoughtseedFabricTask, event: ThoughtseedFabricTaskHistoryEvent): AppendResult {
  const existing = task.history.find((row) => row.eventId === event.eventId);
  if (existing?.payloadHash === event.payloadHash) return 'duplicate';
  if (existing) return 'conflict';
  task.history = [...task.history, event];
  task.updatedAt = event.timestamp;
  return 'appended';
}

async function readFabricTasks(): Promise<ThoughtseedFabricTask[]> {
  const raw = await getSetting(KEYS.fabricTasksJson);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ThoughtseedFabricTask[] : [];
  } catch {
    await setSetting(KEYS.lastError, 'Stored Fabric task state was unreadable; resetting local task cache.');
    await setSetting(KEYS.fabricTasksJson, '[]');
    return [];
  }
}

async function writeFabricTasks(tasks: ThoughtseedFabricTask[]): Promise<void> {
  const sorted = [...tasks].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  await setSetting(KEYS.fabricTasksJson, JSON.stringify(sorted));
}

async function sendUpstreamPayload(
  credential: BridgeCredential,
  payload: Record<string, unknown>,
  idPrefix: string,
): Promise<{ id: string; response: Record<string, unknown> }> {
  const sentAt = nowIso();
  const id = `${idPrefix}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const message: BridgeMessage = {
    version: '1.0.0',
    id,
    timestamp: sentAt,
    direction: 'upstream',
    tenantId: credential.tenantId,
    memberId: credential.memberId,
    payload,
  };
  const signed = signBridgeMessage(message as unknown as Record<string, unknown>, credential.token);
  const response = await bridgeFetch<Record<string, unknown>>(credential, '/v1/bridge/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signed),
  });
  await setSetting(KEYS.lastSeenAt, sentAt);
  await setSetting(KEYS.lastIngestId, id);
  await setSetting(KEYS.lastError, '');
  return { id, response };
}

async function reportBridgeConflict(
  credential: BridgeCredential,
  task: ThoughtseedFabricTask,
  event: ThoughtseedFabricTaskHistoryEvent,
): Promise<void> {
  const existing = task.history.find((row) => row.eventId === event.eventId);
  await sendUpstreamPayload(credential, {
    type: 'fabric_task_history_conflict',
    schema: 'thoughtseed.fabric_task_history_conflict.v1',
    taskId: task.taskId,
    eventId: event.eventId,
    conflictReason: 'duplicate_event_payload_mismatch',
    existingPayloadHash: existing?.payloadHash ?? null,
    incomingPayloadHash: event.payloadHash,
    correlationId: event.correlationId ?? task.correlationId ?? null,
  }, 'plexus_conflict');
}

async function reportFabricHistoryEvent(
  credential: BridgeCredential,
  task: ThoughtseedFabricTask,
  event: ThoughtseedFabricTaskHistoryEvent,
  applied: boolean,
  reason?: string,
): Promise<void> {
  await sendUpstreamPayload(credential, {
    type: 'fabric_task_event',
    schema: 'thoughtseed.fabric_task_event.v1',
    taskId: task.taskId,
    projectId: task.projectId ?? null,
    status: task.status,
    workMode: task.workMode ?? null,
    evidenceStrength: task.evidenceStrength,
    historyEventId: event.eventId,
    historyPayloadHash: event.payloadHash,
    eventType: event.type,
    applied,
    reason: reason ?? null,
    overrideCount: task.overrideCount,
    correlationId: event.correlationId ?? task.correlationId ?? null,
  }, 'plexus_task_event');
}

async function applyFabricHistoryDirective(
  credential: BridgeCredential,
  task: ThoughtseedFabricTask,
  event: ThoughtseedFabricTaskHistoryEvent,
): Promise<AppendResult> {
  const appendResult = appendHistory(task, event);
  if (appendResult !== 'appended') return appendResult;

  let applied = true;
  let rejectionReason: string | undefined;
  if (event.type === 'workMode_override') {
    const nextMode = fabricWorkMode(event.payload.workMode);
    const reason = text(event.payload.reason);
    const allowedStatus = task.status === 'assigned' || task.status === 'seen' || (task.status === 'in_progress' && !!reason);
    if (!nextMode) {
      applied = false;
      rejectionReason = 'override missing manual|delegated workMode';
    } else if (task.overrideCount >= 1) {
      applied = false;
      rejectionReason = 'override already applied';
    } else if (!allowedStatus) {
      applied = false;
      rejectionReason = 'override status no longer eligible';
    } else {
      task.workMode = nextMode;
      task.workModeLocked = true;
      task.overrideCount += 1;
    }
  } else if (event.type === 'candidate_accepted' || event.type === 'completion_upgraded') {
    task.evidenceStrength = 'verified_evidence';
    const evidence = evidenceFromHistoryPayload(event.payload, event.timestamp, 'verified_evidence');
    if (evidence) addEvidenceIfMissing(task, { ...evidence, status: 'verified_evidence' });
  } else if (event.type === 'candidate_rejected') {
    const evidence = evidenceFromHistoryPayload(event.payload, event.timestamp, 'weak_evidence');
    if (evidence) addEvidenceIfMissing(task, { ...evidence, status: 'rejected_candidate' });
  } else if (event.type === 'candidate_review_pending' || event.type === 'candidate_evidence_found') {
    const evidence = evidenceFromHistoryPayload(event.payload, event.timestamp, 'weak_evidence');
    if (evidence) addEvidenceIfMissing(task, { ...evidence, status: 'review_pending' });
  }

  await reportFabricHistoryEvent(credential, task, event, applied, rejectionReason);
  return appendResult;
}

async function setBridgeToken(token: string): Promise<void> {
  if (!token) {
    await setSetting(KEYS.tokenEnc, '');
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is unavailable; cannot store the bridge token safely.');
  }
  await setSetting(KEYS.tokenEnc, safeStorage.encryptString(token).toString('base64'));
}

async function getBridgeToken(): Promise<string | null> {
  const enc = await getSetting(KEYS.tokenEnc);
  if (!enc) return null;
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'));
  } catch {
    await setSetting(KEYS.lastError, 'Stored bridge token could not be decrypted. Redeem a fresh invite.');
    return null;
  }
}

function normalizeBaseUrl(url?: string | null): string {
  const next = (url || DEFAULT_BRIDGE_API_URL).trim().replace(/\/+$/, '');
  if (!next.startsWith('https://')) throw new Error('Thoughtseed bridge URL must use https.');
  return next;
}

async function bridgeApiUrl(): Promise<string> {
  return normalizeBaseUrl(await getSetting(KEYS.apiUrl));
}

async function parseBridgeJson(res: Response, context: string): Promise<any> {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Thoughtseed bridge returned ${res.status} non-JSON for ${context}.`);
  }
  if (!res.ok) {
    const message = json?.error?.message ?? json?.error ?? json?.message ?? `HTTP ${res.status}`;
    throw new Error(`Thoughtseed bridge ${context} failed: ${message}`);
  }
  return json;
}

async function getCredential(): Promise<BridgeCredential> {
  const [bridgeApiUrlValue, memberId, tenantId, token, tokenExpiresAt] = await Promise.all([
    bridgeApiUrl(),
    getSetting(KEYS.memberId),
    getSetting(KEYS.tenantId),
    getBridgeToken(),
    getSetting(KEYS.tokenExpiresAt),
  ]);
  if (!token || !memberId) throw new Error('Thoughtseed bridge is not connected. Redeem an invite first.');
  if (isBridgeTokenExpired(tokenExpiresAt)) throw new Error('Thoughtseed bridge token expired. Rotate the token or redeem a fresh invite.');
  return {
    bridgeApiUrl: bridgeApiUrlValue,
    memberId,
    tenantId: tenantId || DEFAULT_TENANT_ID,
    token,
    tokenExpiresAt,
  };
}

async function bridgeFetch<T>(credential: BridgeCredential, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${credential.token}`);
  const res = await fetch(`${credential.bridgeApiUrl}${path}`, { ...init, headers });
  return parseBridgeJson(res, path) as Promise<T>;
}

async function rememberError(error: unknown): Promise<void> {
  await setSetting(KEYS.lastError, redactedErrorMessage(error));
}

function bridgeArtifactRefFrom(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  const direct = record.artifactRef ?? record.artifact_ref ?? record.ref;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const artifact = record.artifact;
  if (artifact && typeof artifact === 'object') {
    const nested = artifact as Record<string, unknown>;
    const ref = nested.ref ?? nested.url ?? nested.key;
    if (typeof ref === 'string' && ref.trim()) return ref.trim();
  }
  return undefined;
}

export async function sendThoughtseedDailyEvent(event: AssistantDailyEvent): Promise<AssistantDailyDeliveryResult> {
  const credential = await getCredential();
  try {
    const sent = await sendUpstreamPayload(credential, {
      type: 'daily_agent_event',
      schema: event.schema,
      event,
      date: event.date,
      memberId: event.memberId,
      eventId: event.eventId,
    }, 'daily_agent_event');
    return {
      ok: true,
      channel: 'bridge',
      status: 'sent',
      message: 'Daily assistant event sent through the Thoughtseed bridge.',
      artifactRef: bridgeArtifactRefFrom(sent.response),
    };
  } catch (err: any) {
    await rememberError(err);
    return {
      ok: false,
      channel: 'bridge',
      status: 'failed',
      message: redactedErrorMessage(err),
    };
  }
}

export async function getThoughtseedBridgeStatus(): Promise<ThoughtseedBridgeStatus> {
  const [bridgeApiUrlValue, memberId, tenantId, tokenEnc, tokenExpiresAt, lastSeenAt, lastError] = await Promise.all([
    bridgeApiUrl(),
    getSetting(KEYS.memberId),
    getSetting(KEYS.tenantId),
    getSetting(KEYS.tokenEnc),
    getSetting(KEYS.tokenExpiresAt),
    getSetting(KEYS.lastSeenAt),
    getSetting(KEYS.lastError),
  ]);
  const token = tokenEnc ? await getBridgeToken() : null;
  const decryptError = tokenEnc && !token
    ? 'Stored bridge token could not be decrypted. Redeem a fresh invite.'
    : null;
  const configured = Boolean(token && memberId);
  const expired = isBridgeTokenExpired(tokenExpiresAt);
  return {
    configured,
    connected: configured && !expired && !decryptError,
    bridgeApiUrl: bridgeApiUrlValue,
    tenantId: tenantId || DEFAULT_TENANT_ID,
    memberId: memberId || '',
    tokenExpiresAt: tokenExpiresAt || null,
    lastSeenAt: lastSeenAt || null,
    lastError: decryptError || (expired ? 'Thoughtseed bridge token expired.' : (lastError || null)),
  };
}

export async function redeemThoughtseedInvite(input: { invite: string; bridgeApiUrl?: string }): Promise<ThoughtseedBridgeRedeemResult> {
  const invite = input.invite.trim();
  if (!invite) throw new Error('Invite token is required.');
  const baseUrl = normalizeBaseUrl(input.bridgeApiUrl);
  const res = await fetch(`${baseUrl}/v1/handoff/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ invite }),
  });
  const json = await parseBridgeJson(res, '/v1/handoff/redeem');
  if (!json?.ok || !json?.token || !json?.memberId) throw new Error('Thoughtseed bridge redeem returned an incomplete member credential.');

  const bridgeApiUrlValue = normalizeBaseUrl(json.bridgeApiUrl || baseUrl);
  await setSetting(KEYS.apiUrl, bridgeApiUrlValue);
  await setSetting(KEYS.memberId, String(json.memberId));
  await setSetting(KEYS.tenantId, String(json.tenantId || DEFAULT_TENANT_ID));
  await setSetting(KEYS.tokenExpiresAt, json.expiresAt ? String(json.expiresAt) : '');
  await setSetting(KEYS.lastError, '');
  await setBridgeToken(String(json.token));

  return { ok: true, status: await getThoughtseedBridgeStatus() };
}

export async function sendThoughtseedHeartbeat(payload?: Record<string, unknown>): Promise<ThoughtseedBridgeHeartbeatResult> {
  const credential = await getCredential();
  const now = new Date().toISOString();
  try {
    const sent = await sendUpstreamPayload(credential, payload ?? {
      type: 'heartbeat',
      lane: 'heartbeat',
      agentStatus: {
        plexus: {
          state: 'idle',
          lastSeen: now,
          currentTask: 'connected',
        },
      },
      viability: {
        coherenceScore: 1,
        lastCheck: now,
      },
    }, 'plexus');
    return { ok: true, id: sent.id, response: sent.response };
  } catch (err) {
    await rememberError(err);
    throw new Error(redactedErrorMessage(err), { cause: err });
  }
}

export async function pollThoughtseedDirectives(): Promise<ThoughtseedBridgePollResult> {
  const credential = await getCredential();
  try {
    const json = await bridgeFetch<any>(credential, `/v1/bridge/directives/${encodeURIComponent(credential.memberId)}`);
    const directives = Array.isArray(json) ? json : (json?.directives ?? json?.items ?? []);
    await setSetting(KEYS.lastError, '');
    return { ok: true, directives: directives as ThoughtseedBridgeDirective[] };
  } catch (err) {
    await rememberError(err);
    throw new Error(redactedErrorMessage(err), { cause: err });
  }
}

export async function ackThoughtseedDirectives(ids: string[]): Promise<ThoughtseedBridgeAckResult> {
  const credential = await getCredential();
  const cleanIds = ids.map((id) => id.trim()).filter(Boolean);
  if (cleanIds.length === 0) throw new Error('At least one directive id is required.');
  try {
    const response = await bridgeFetch<Record<string, unknown>>(credential, '/v1/bridge/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: credential.memberId, ids: cleanIds }),
    });
    await setSetting(KEYS.lastError, '');
    return { ok: true, ackedIds: cleanIds, response };
  } catch (err) {
    await rememberError(err);
    throw new Error(redactedErrorMessage(err), { cause: err });
  }
}

export async function listThoughtseedFabricTasks(): Promise<ThoughtseedFabricTaskListResult> {
  return { ok: true, tasks: await readFabricTasks() };
}

export async function syncThoughtseedFabricTasks(): Promise<ThoughtseedFabricTaskSyncResult> {
  const credential = await getCredential();
  const json = await bridgeFetch<any>(credential, `/v1/bridge/directives/${encodeURIComponent(credential.memberId)}`);
  const directives = (Array.isArray(json) ? json : (json?.directives ?? json?.items ?? [])) as ThoughtseedBridgeDirective[];
  const tasks = await readFabricTasks();
  const ingestedDirectiveIds: string[] = [];
  let conflictCount = 0;

  for (const directive of directives) {
    const incomingTenantId = directiveTenantId(directive);
    if (incomingTenantId && incomingTenantId !== credential.tenantId) continue;
    const incomingMemberId = directiveMemberId(directive);
    if (incomingMemberId && incomingMemberId !== credential.memberId) continue;

    const parsed = taskFromThoughtseedDirective(directive, credential.memberId, credential.tenantId);
    if (!parsed) {
      const history = historyEventFromThoughtseedDirective(directive);
      if (!history) continue;
      const task = tasks.find((row) => row.taskId === history.taskId);
      if (!task) continue;
      const appendResult = await applyFabricHistoryDirective(credential, task, history.event);
      if (appendResult === 'conflict') {
        conflictCount += 1;
        await reportBridgeConflict(credential, task, history.event);
      }
      ingestedDirectiveIds.push(directive.id);
      continue;
    }
    const existingIndex = tasks.findIndex((task) => task.taskId === parsed.task.taskId);
    if (existingIndex < 0) {
      if (parsed.task.assigneeMemberId !== credential.memberId) continue;
      tasks.push(parsed.task);
      ingestedDirectiveIds.push(directive.id);
      continue;
    }

    const existing = tasks[existingIndex];
    const appendResult = appendHistory(existing, parsed.event);
    if (appendResult === 'conflict') {
      conflictCount += 1;
      await reportBridgeConflict(credential, existing, parsed.event);
      continue;
    }
    if (appendResult === 'appended') {
      existing.directiveId = parsed.task.directiveId;
      existing.correlationId = parsed.task.correlationId || existing.correlationId;
      existing.projectId = parsed.task.projectId || existing.projectId;
      existing.projectName = parsed.task.projectName || existing.projectName;
      existing.questId = parsed.task.questId || existing.questId;
      existing.branchId = parsed.task.branchId || existing.branchId;
      existing.arcId = parsed.task.arcId || existing.arcId;
      existing.missionId = parsed.task.missionId || existing.missionId;
      existing.kpiIds = parsed.task.kpiIds || existing.kpiIds;
      existing.gateId = parsed.task.gateId || existing.gateId;
      existing.proofRequired = parsed.task.proofRequired || existing.proofRequired;
      existing.proofFoldback = parsed.task.proofFoldback || existing.proofFoldback;
      existing.promotionState = parsed.task.promotionState || existing.promotionState;
      existing.autonomyBoundary = parsed.task.autonomyBoundary || existing.autonomyBoundary;
      existing.approvalsRequired = parsed.task.approvalsRequired || existing.approvalsRequired;
      existing.skillHints = parsed.task.skillHints || existing.skillHints;
      existing.clientId = parsed.task.clientId || existing.clientId;
      existing.clientName = parsed.task.clientName || existing.clientName;
      existing.title = parsed.task.title || existing.title;
      existing.description = parsed.task.description || existing.description;
      existing.priority = parsed.task.priority || existing.priority;
      existing.taskType = parsed.task.taskType || existing.taskType;
    }
    ingestedDirectiveIds.push(directive.id);
  }

  await writeFabricTasks(tasks);
  if (ingestedDirectiveIds.length > 0) {
    await bridgeFetch<Record<string, unknown>>(credential, '/v1/bridge/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: credential.memberId, ids: ingestedDirectiveIds }),
    });
  }
  return { ok: true, tasks: await readFabricTasks(), ingestedDirectiveIds, conflictCount };
}

export async function setThoughtseedFabricTaskWorkMode(
  taskId: string,
  workMode: ThoughtseedFabricTaskWorkMode,
): Promise<ThoughtseedFabricWorkModeResult> {
  const credential = await getCredential();
  const tasks = await readFabricTasks();
  const task = tasks.find((row) => row.taskId === taskId);
  if (!task) throw new Error(`Fabric task not found: ${taskId}`);
  assertTaskOwnership(task, credential.memberId, 'set work mode for');
  if (task.workModeLocked || task.workMode) {
    throw new Error('Fabric task work mode is already locked. Hermes/admin override is required.');
  }

  const event = makeEvent({
    type: 'workMode_selected',
    actor: task.assigneeMemberId,
    source: 'plexus',
    correlationId: task.correlationId,
    payload: {
      taskId,
      previousWorkMode: null,
      workMode,
      previousStatus: task.status,
      status: task.status === 'assigned' ? 'seen' : task.status,
    },
  });
  appendHistory(task, event);
  task.workMode = workMode;
  task.workModeLocked = true;
  if (task.status === 'assigned') task.status = 'seen';
  try {
    await sendUpstreamPayload(credential, {
      type: 'fabric_task_event',
      schema: 'thoughtseed.fabric_task_event.v1',
      taskId: task.taskId,
      projectId: task.projectId ?? null,
      status: task.status,
      workMode: task.workMode,
      historyEventId: event.eventId,
      historyPayloadHash: event.payloadHash,
      correlationId: task.correlationId ?? null,
    }, 'plexus_task_event');
    await writeFabricTasks(tasks);
  } catch (err) {
    await rememberError(err);
    throw new Error(redactedErrorMessage(err), { cause: err });
  }
  return { ok: true, task };
}

function findTaskOrThrow(tasks: ThoughtseedFabricTask[], taskId: string): ThoughtseedFabricTask {
  const task = tasks.find((row) => row.taskId === taskId);
  if (!task) throw new Error(`Fabric task not found: ${taskId}`);
  return task;
}

function eventTypeForStatus(status: ThoughtseedFabricTaskStatus): ThoughtseedFabricHistoryEventType {
  if (status === 'seen') return 'seen';
  if (status === 'blocked') return 'blocked';
  if (status === 'done') return 'done';
  return 'status_changed';
}

export async function reportThoughtseedFabricTask(input: ThoughtseedFabricTaskReportInput): Promise<ThoughtseedFabricTaskReportResult> {
  const credential = await getCredential();
  const tasks = await readFabricTasks();
  const task = findTaskOrThrow(tasks, input.taskId);
  assertTaskOwnership(task, credential.memberId, 'report');
  const note = text(input.note);
  const blocker = text(input.blocker);
  const evidenceInput = input.evidence && text(input.evidence.value)
    ? { ...input.evidence, value: text(input.evidence.value)! }
    : null;

  if ((input.status === 'in_progress' || input.status === 'blocked' || input.status === 'done') && !task.workMode) {
    throw new Error('Choose manual or delegated work mode before reporting progress.');
  }
  if (input.status === 'done' && !note && !evidenceInput) {
    throw new Error('Done requires at least one evidence item or completion note.');
  }

  const evidence: ThoughtseedFabricEvidence | null = evidenceInput
    ? {
        id: `ev_${Date.now()}_${randomUUID().slice(0, 8)}`,
        type: evidenceInput.type,
        value: evidenceInput.value,
        label: text(evidenceInput.label),
        source: eventSource(evidenceInput.type.split('_')[0]),
        strength: evidenceStrengthFor(evidenceInput),
        addedAt: nowIso(),
      }
    : input.status === 'done' && note
      ? {
          id: `ev_${Date.now()}_${randomUUID().slice(0, 8)}`,
          type: 'note',
          value: note,
          label: 'Completion note',
          source: 'manual',
          strength: 'weak_evidence',
          addedAt: nowIso(),
        }
      : null;

  const nextStrength = evidence?.strength === 'verified_evidence' || task.evidenceStrength === 'verified_evidence'
    ? 'verified_evidence'
    : input.status === 'done'
      ? 'weak_evidence'
      : task.evidenceStrength;
  const event = makeEvent({
    type: eventTypeForStatus(input.status),
    actor: task.assigneeMemberId,
    source: 'plexus',
    correlationId: task.correlationId,
    payload: {
      taskId: task.taskId,
      projectId: task.projectId ?? null,
      status: input.status,
      workMode: task.workMode ?? null,
      note: note ?? null,
      blocker: blocker ?? null,
      evidence: evidence ?? null,
      evidenceStrength: nextStrength,
    },
  });
  const appendResult = appendHistory(task, event);
  if (appendResult === 'conflict') throw new Error(`Local event id conflict for ${event.eventId}`);
  if (evidence) task.evidence = [...task.evidence, evidence];
  task.status = input.status;
  task.evidenceStrength = nextStrength;

  try {
    const sent = await sendUpstreamPayload(credential, {
      type: 'fabric_task_report',
      schema: 'thoughtseed.fabric_task_report.v1',
      taskId: task.taskId,
      projectId: task.projectId ?? null,
      projectName: task.projectName ?? null,
      questId: task.questId ?? null,
      clientId: task.clientId ?? null,
      clientName: task.clientName ?? null,
      title: task.title,
      status: task.status,
      workMode: task.workMode ?? null,
      evidenceStrength: task.evidenceStrength,
      evidence,
      note: note ?? null,
      blocker: blocker ?? null,
      historyEventId: event.eventId,
      historyPayloadHash: event.payloadHash,
      correlationId: task.correlationId ?? null,
    }, 'plexus_task_report');
    await writeFabricTasks(tasks);
    return { ok: true, task, reportId: sent.id, response: sent.response };
  } catch (err) {
    await rememberError(err);
    throw new Error(redactedErrorMessage(err), { cause: err });
  }
}

export async function rotateThoughtseedBridgeToken(): Promise<ThoughtseedBridgeRotateResult> {
  const credential = await getCredential();
  try {
    const json = await fetch(`${credential.bridgeApiUrl}/v1/handoff/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token: credential.token }),
    }).then((res) => parseBridgeJson(res, '/v1/handoff/rotate'));
    if (!json?.token) throw new Error('Thoughtseed bridge rotate returned no replacement token.');
    await setBridgeToken(String(json.token));
    await setSetting(KEYS.tokenExpiresAt, json.expiresAt ? String(json.expiresAt) : '');
    await setSetting(KEYS.lastError, '');
    return { ok: true, status: await getThoughtseedBridgeStatus() };
  } catch (err) {
    await rememberError(err);
    throw new Error(redactedErrorMessage(err), { cause: err });
  }
}

export async function disconnectThoughtseedBridge(): Promise<ThoughtseedBridgeStatus> {
  await Promise.all([
    setSetting(KEYS.tokenEnc, ''),
    setSetting(KEYS.tokenExpiresAt, ''),
    setSetting(KEYS.lastSeenAt, ''),
    setSetting(KEYS.lastIngestId, ''),
    setSetting(KEYS.lastError, ''),
  ]);
  return getThoughtseedBridgeStatus();
}
