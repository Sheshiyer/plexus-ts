import type {
  AssistantDailyBlocker,
  AssistantDailyConfirmation,
  AssistantDailyDeliveryResult,
  AssistantDailyEvent,
  AssistantDailyEvidenceSummary,
  AssistantDailyProjectSummary,
  AssistantDailySessionGroup,
  AssistantDailySuggestion,
  AssistantDailySummary,
  ProofStatus,
} from '../shared/native-assistant.js';
import { ASSISTANT_DAILY_EVENT_SCHEMA } from '../shared/native-assistant.js';
import type { DailyProofPacket, HandoffInput, RepoEvidenceStatus, WorkEvidenceSummary } from '../shared/types.js';
import type { AssistantContextSnapshot } from './assistant-context.js';
import type { AssistantDailyEventRecord } from '../db/database.js';
import {
  getAssistantDailyEvent,
  insertAssistantDailyEvent,
  listPendingAssistantDailyEvents,
  recordHandoff,
  updateAssistantDailyEvent,
  upsertDailyProofPacket,
  upsertProofCustodyRecord,
} from '../db/database.js';
import { buildFabricTaskProofSummary } from './proof-report.js';

const DEFAULT_RETRY_DELAY_MS = 5 * 60 * 1000;
const DAILY_EVENT_ID_PREFIX = 'assistant_daily';

export interface BuildAssistantDailyEventInput {
  date: string;
  memberId: string;
  context: AssistantContextSnapshot;
  generatedAt?: string;
  standupRecordId?: string | null;
}

export interface AssistantDailyDeliveryDeps {
  sendWorker: (event: AssistantDailyEvent) => Promise<AssistantDailyDeliveryResult>;
  sendBridge: (event: AssistantDailyEvent) => Promise<AssistantDailyDeliveryResult>;
  recordHandoff: (input: HandoffInput) => Promise<unknown>;
  getConfirmation: (input: { date: string; artifactRef?: string | null }) => Promise<AssistantDailyConfirmation>;
}

export interface QueueAssistantDailyEventOptions {
  now?: Date | string;
  deps?: Partial<AssistantDailyDeliveryDeps>;
  recordFailureHandoff?: boolean;
}

export interface FlushAssistantDailyEventsOptions extends QueueAssistantDailyEventOptions {
  eventId?: string;
  limit?: number;
}

export interface FlushAssistantDailyEventsResult {
  ok: boolean;
  attempted: number;
  sent: number;
  failed: number;
  message?: string;
  events: AssistantDailyEventRecord[];
}

const defaultDeps: AssistantDailyDeliveryDeps = {
  async sendWorker(event) {
    const worker = await import('./teamforge.js');
    return worker.sendDailyAssistantEvent(event);
  },
  async sendBridge(event) {
    const bridge = await import('./thoughtseed-bridge.js');
    return bridge.sendThoughtseedDailyEvent(event);
  },
  recordHandoff,
  async getConfirmation(input) {
    const worker = await import('./teamforge.js');
    return worker.getDailyAssistantEventStatus(input);
  },
};

let flushInFlight: Promise<FlushAssistantDailyEventsResult> | null = null;

function iso(value?: Date | string): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function dateSlug(value: string): string {
  return value.replace(/[^0-9a-z]+/gi, '').toLowerCase();
}

function memberSlug(value: string): string {
  return value.trim().replace(/[^0-9a-z]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'member';
}

export function assistantDailyEventId(date: string, memberId: string): string {
  return `${DAILY_EVENT_ID_PREFIX}_${dateSlug(date)}_${memberSlug(memberId)}`;
}

function requireText(value: string, field: string): string {
  const text = value.trim();
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function emptyEvidenceSummary(): AssistantDailyEvidenceSummary {
  return {
    proofStatus: 'pending',
    totalEntries: 0,
    evidencedEntries: 0,
    missingEvidenceEntries: 0,
    legacyUnverifiedEntries: 0,
    evidencedSeconds: 0,
    missingEvidenceSeconds: 0,
    projectRepoCoverage: {},
  };
}

function dailyProofStatus(summary: Pick<AssistantDailyEvidenceSummary, 'proofStatus' | 'totalEntries' | 'evidencedEntries' | 'missingEvidenceEntries' | 'legacyUnverifiedEntries'>): ProofStatus {
  if (summary.proofStatus) return summary.proofStatus;
  if (summary.totalEntries <= 0) return 'pending';
  if (summary.evidencedEntries === summary.totalEntries) return 'verified';
  if (summary.legacyUnverifiedEntries === summary.totalEntries) return 'legacy_unverified';
  if (summary.evidencedEntries > 0) return 'partial';
  return 'missing';
}

function evidenceSummaryFromContext(context: AssistantContextSnapshot): AssistantDailyEvidenceSummary {
  const summary = context.evidence?.summary;
  if (!summary) return emptyEvidenceSummary();
  return {
    proofStatus: dailyProofStatus(summary),
    totalEntries: summary.totalEntries,
    evidencedEntries: summary.evidencedEntries,
    missingEvidenceEntries: summary.missingEvidenceEntries,
    legacyUnverifiedEntries: summary.legacyUnverifiedEntries,
    evidencedSeconds: summary.evidencedSeconds,
    missingEvidenceSeconds: summary.missingEvidenceSeconds,
    projectRepoCoverage: Object.fromEntries(
      Object.entries(summary.projectRepoCoverage).map(([projectId, status]) => [projectId, String(status)]),
    ),
  };
}

function projectSummariesFromContext(context: AssistantContextSnapshot): AssistantDailyProjectSummary[] {
  const entriesByProject = new Map<string, { totalSeconds: number; entryCount: number }>();
  for (const entry of context.entries) {
    const current = entriesByProject.get(entry.projectId) ?? { totalSeconds: 0, entryCount: 0 };
    current.totalSeconds += entry.durationSeconds;
    current.entryCount += 1;
    entriesByProject.set(entry.projectId, current);
  }

  return context.projects.map((project) => {
    const totals = entriesByProject.get(project.id) ?? { totalSeconds: 0, entryCount: 0 };
    return {
      projectId: project.id,
      name: project.name,
      clientName: project.clientName,
      totalSeconds: totals.totalSeconds,
      entryCount: totals.entryCount,
      evidenceStatus: project.evidenceStatus,
      repoFullName: project.repo.fullName ?? null,
    };
  });
}

function sessionGroupsFromContext(context: AssistantContextSnapshot): AssistantDailySessionGroup[] {
  return context.sessionGroups.map((group) => ({
    id: group.id,
    label: group.label,
    projectId: group.projectId ?? null,
    projectName: group.projectName ?? null,
    repoFullName: group.repoFullName ?? null,
    sessionCount: group.sessionCount,
    themes: [...group.themes],
    matchStatus: group.matchStatus,
  }));
}

function blockersFromContext(context: AssistantContextSnapshot, standupRecordId: string | null): AssistantDailyBlocker[] {
  const blockers: AssistantDailyBlocker[] = [];
  const evidence = evidenceSummaryFromContext(context);
  if (evidence.missingEvidenceEntries > 0 || evidence.legacyUnverifiedEntries > 0) {
    blockers.push({
      id: 'missing-proof',
      label: `${evidence.missingEvidenceEntries + evidence.legacyUnverifiedEntries} work entries need proof.`,
      severity: 'warning',
      source: 'evidence',
    });
  }
  if (!standupRecordId) {
    blockers.push({
      id: 'missing-standup',
      label: 'No standup evidence record is linked yet.',
      severity: 'info',
      source: 'standup',
    });
  }
  for (const group of context.sessionGroups.filter((item) => item.matchStatus !== 'ready').slice(0, 3)) {
    blockers.push({
      id: `session-${group.id}`,
      label: `${group.label} needs session matching attention.`,
      severity: group.matchStatus === 'repo_unverified' ? 'warning' : 'info',
      source: 'session_group',
    });
  }
  if (context.infra?.worker.connected === false && context.infra.thoughtseedBridge?.connected === false) {
    blockers.push({
      id: 'daily-delivery-offline',
      label: 'Worker and Thoughtseed bridge are both unavailable.',
      severity: 'critical',
      source: 'infra',
    });
  }
  return blockers;
}

function suggestionsFromContext(context: AssistantContextSnapshot, standupRecordId: string | null): AssistantDailySuggestion[] {
  const suggestions: AssistantDailySuggestion[] = [];
  if (!standupRecordId) {
    suggestions.push({
      id: 'generate-standup',
      label: 'Generate today\'s standup evidence.',
      reason: 'Daily delivery is stronger with a linked standup record.',
      toolId: 'app.generateStandup',
    });
  }
  if (context.workSummary.missingEvidenceEntries > 0) {
    suggestions.push({
      id: 'review-missing-proof',
      label: 'Review entries missing proof.',
      reason: 'The daily summary has work records that are not evidence matched.',
      toolId: 'context.reports',
    });
  }
  if (context.sessionGroups.some((group) => group.matchStatus !== 'ready')) {
    suggestions.push({
      id: 'review-session-groups',
      label: 'Review unmatched session groups.',
      reason: 'Some local agent sessions need project or repo confirmation.',
      toolId: 'context.sessions',
    });
  }
  return suggestions;
}

export function buildAssistantDailyEvent(input: BuildAssistantDailyEventInput): AssistantDailyEvent {
  const date = requireText(input.date, 'date');
  const memberId = requireText(input.memberId, 'memberId');
  const standupRecordId = input.standupRecordId ?? input.context.evidence?.standupEvidence?.id ?? null;
  return {
    schema: ASSISTANT_DAILY_EVENT_SCHEMA,
    eventId: assistantDailyEventId(date, memberId),
    date,
    memberId,
    generatedAt: input.generatedAt ?? input.context.generatedAt,
    standupRecordId,
    projectSummaries: projectSummariesFromContext(input.context),
    sessionGroups: sessionGroupsFromContext(input.context),
    blockers: blockersFromContext(input.context, standupRecordId),
    suggestions: suggestionsFromContext(input.context, standupRecordId),
    evidenceSummary: evidenceSummaryFromContext(input.context),
    workSummary: { ...input.context.workSummary },
  };
}

export function validateAssistantDailyEvent(event: AssistantDailyEvent): string[] {
  const missing: string[] = [];
  if (event.schema !== ASSISTANT_DAILY_EVENT_SCHEMA) missing.push('schema');
  if (!event.eventId) missing.push('eventId');
  if (!event.date) missing.push('date');
  if (!event.memberId) missing.push('memberId');
  if (!event.generatedAt) missing.push('generatedAt');
  if (!Array.isArray(event.projectSummaries)) missing.push('projectSummaries');
  if (!Array.isArray(event.sessionGroups)) missing.push('sessionGroups');
  if (!Array.isArray(event.blockers)) missing.push('blockers');
  if (!Array.isArray(event.suggestions)) missing.push('suggestions');
  if (!event.evidenceSummary) missing.push('evidenceSummary');
  return missing;
}

function depsFrom(input?: Partial<AssistantDailyDeliveryDeps>): AssistantDailyDeliveryDeps {
  return { ...defaultDeps, ...input };
}

export async function deliverAssistantDailyEvent(
  event: AssistantDailyEvent,
  depsInput?: Partial<AssistantDailyDeliveryDeps>,
): Promise<AssistantDailyDeliveryResult> {
  const deps = depsFrom(depsInput);
  const worker = await deps.sendWorker(event).catch((err: any) => ({
    ok: false,
    channel: 'worker' as const,
    status: 'failed' as const,
    message: err?.message ?? String(err),
  }));
  if (worker.ok) return { ...worker, channel: 'worker', status: 'sent' };

  const bridge = await deps.sendBridge(event).catch((err: any) => ({
    ok: false,
    channel: 'bridge' as const,
    status: 'failed' as const,
    message: err?.message ?? String(err),
  }));
  if (bridge.ok) {
    return {
      ...bridge,
      channel: 'bridge',
      status: 'sent',
      retryableFallback: true,
      workerError: worker.message ?? 'unknown error',
      message: bridge.message ?? `Worker delivery failed; bridge fallback succeeded. Worker: ${worker.message ?? 'unknown error'}`,
    };
  }

  return {
    ok: false,
    status: 'failed',
    workerError: worker.message ?? 'unknown error',
    bridgeError: bridge.message ?? 'unknown error',
    message: `Worker delivery failed: ${worker.message ?? 'unknown error'}; bridge fallback failed: ${bridge.message ?? 'unknown error'}`,
  };
}

function retryAt(now: Date | string | undefined): string {
  return new Date(Date.parse(iso(now)) + DEFAULT_RETRY_DELAY_MS).toISOString();
}

function eventFromRecord(record: AssistantDailyEventRecord): AssistantDailyEvent {
  const payload = record.payload as Partial<AssistantDailyEvent>;
  if (
    payload.schema !== ASSISTANT_DAILY_EVENT_SCHEMA ||
    typeof payload.eventId !== 'string' ||
    typeof payload.date !== 'string' ||
    typeof payload.memberId !== 'string'
  ) {
    throw new Error(`Daily event ${record.id} has an invalid payload.`);
  }
  return payload as AssistantDailyEvent;
}

async function recordFailureHandoff(
  record: AssistantDailyEventRecord,
  event: AssistantDailyEvent,
  error: string,
  nextRetryAt: string,
  deps: AssistantDailyDeliveryDeps,
): Promise<void> {
  await deps.recordHandoff({
    kind: 'assistant_daily_event',
    status: 'failed',
    title: `Daily assistant event for ${event.date} is queued for retry`,
    payload: {
      dailyEventId: record.id,
      eventId: event.eventId,
      date: event.date,
      memberId: event.memberId,
      artifactRef: record.artifactRef,
    },
    error,
    nextRetryAt,
  });
}

function payloadWithDelivery(
  event: AssistantDailyEvent,
  result: AssistantDailyDeliveryResult,
  nextRetryAt?: string | null,
): Record<string, unknown> {
  return {
    ...event,
    delivery: {
      channel: result.channel ?? null,
      status: result.status ?? null,
      retryableFallback: Boolean(result.retryableFallback),
      workerError: result.workerError ?? null,
      bridgeError: result.bridgeError ?? null,
      message: result.message ?? null,
      artifactRef: result.artifactRef ?? null,
      nextRetryAt: nextRetryAt ?? null,
      checkedAt: new Date().toISOString(),
    },
  } as unknown as Record<string, unknown>;
}

async function deliverAndPersistDailyEvent(
  record: AssistantDailyEventRecord,
  event: AssistantDailyEvent,
  options: QueueAssistantDailyEventOptions,
): Promise<AssistantDailyEventRecord> {
  const deps = depsFrom(options.deps);
  const result = await deliverAssistantDailyEvent(event, deps);
  if (result.ok && result.retryableFallback) {
    const nextRetryAt = retryAt(options.now);
    const fallbackQueued = await updateAssistantDailyEvent(record.id, {
      status: 'queued',
      payload: payloadWithDelivery(event, result, nextRetryAt),
      error: result.message ?? 'Worker delivery failed; bridge fallback accepted and queued for Worker retry.',
      artifactRef: result.artifactRef ?? record.artifactRef,
      nextRetryAt,
      updatedAt: iso(options.now),
    });
    const shouldRecordHandoff = options.recordFailureHandoff ?? true;
    if (shouldRecordHandoff) {
      await recordFailureHandoff(
        fallbackQueued,
        event,
        fallbackQueued.error ?? 'Worker delivery failed; bridge fallback accepted and queued for Worker retry.',
        nextRetryAt,
        deps,
      );
    }
    return fallbackQueued;
  }
  if (result.ok) {
    return updateAssistantDailyEvent(record.id, {
      status: 'sent',
      payload: payloadWithDelivery(event, result, null),
      error: null,
      artifactRef: result.artifactRef ?? record.artifactRef,
      nextRetryAt: null,
      updatedAt: iso(options.now),
    });
  }

  const nextRetryAt = retryAt(options.now);
  const failed = await updateAssistantDailyEvent(record.id, {
    status: 'failed',
    payload: payloadWithDelivery(event, result, nextRetryAt),
    error: result.message ?? 'Daily assistant event delivery failed.',
    nextRetryAt,
    updatedAt: iso(options.now),
  });
  const shouldRecordHandoff = options.recordFailureHandoff ?? record.status !== 'failed';
  if (shouldRecordHandoff) {
    await recordFailureHandoff(failed, event, failed.error ?? 'Daily assistant event delivery failed.', nextRetryAt, deps);
  }
  return failed;
}

function repoEvidenceStatus(value: string): RepoEvidenceStatus {
  return value === 'missing'
    || value === 'unverified'
    || value === 'verified'
    || value === 'inaccessible'
    || value === 'legacy_unverified'
    ? value
    : 'missing';
}

function workEvidenceSummaryFromDailyEvent(event: AssistantDailyEvent): WorkEvidenceSummary {
  return {
    proofStatus: dailyProofStatus(event.evidenceSummary),
    totalEntries: event.evidenceSummary.totalEntries,
    evidencedEntries: event.evidenceSummary.evidencedEntries,
    missingEvidenceEntries: event.evidenceSummary.missingEvidenceEntries,
    legacyUnverifiedEntries: event.evidenceSummary.legacyUnverifiedEntries,
    evidencedSeconds: event.evidenceSummary.evidencedSeconds,
    missingEvidenceSeconds: event.evidenceSummary.missingEvidenceSeconds,
    projectRepoCoverage: Object.fromEntries(
      Object.entries(event.evidenceSummary.projectRepoCoverage).map(([projectId, status]) => [projectId, repoEvidenceStatus(status)]),
    ),
  };
}

function deliveryChannelFromRecord(record: AssistantDailyEventRecord): string | null {
  const delivery = record.payload.delivery;
  if (!delivery || typeof delivery !== 'object') return null;
  const channel = (delivery as Record<string, unknown>).channel;
  return typeof channel === 'string' ? channel : null;
}

function dailyProofPacketFromEvent(record: AssistantDailyEventRecord, event: AssistantDailyEvent): DailyProofPacket {
  const evidenceSummary = workEvidenceSummaryFromDailyEvent(event);
  const fabricTaskProof = buildFabricTaskProofSummary([]);
  return {
    id: `daily_proof_${event.date}`,
    date: event.date,
    generatedAt: event.generatedAt,
    proofStatus: dailyProofStatus(event.evidenceSummary),
    reportSubjectId: event.date,
    standupEvidenceRecordId: event.standupRecordId ?? null,
    totalSeconds: event.workSummary.totalDurationSeconds,
    entryCount: event.workSummary.totalEntries,
    taskCount: 0,
    missingProofCount: event.evidenceSummary.missingEvidenceEntries + event.evidenceSummary.legacyUnverifiedEntries,
    blockerCount: event.blockers.length,
    evidenceSummary,
    fabricTaskProof,
    dailyEventId: event.eventId,
    deliveryStatus: record.status,
    deliveryChannel: deliveryChannelFromRecord(record),
    artifactRef: record.artifactRef,
    nextRetryAt: record.nextRetryAt,
  };
}

async function recordDailyEventProofCustody(record: AssistantDailyEventRecord, event: AssistantDailyEvent): Promise<void> {
  await upsertProofCustodyRecord({
    subjectType: 'assistant_daily_event',
    subjectId: event.eventId,
    proofStatus: dailyProofStatus(event.evidenceSummary),
    evidenceType: 'daily_event',
    artifactRef: record.artifactRef,
    payload: {
      eventId: event.eventId,
      date: event.date,
      memberId: event.memberId,
      deliveryStatus: record.status,
      delivery: record.payload.delivery && typeof record.payload.delivery === 'object' ? record.payload.delivery : undefined,
      artifactRef: record.artifactRef,
      evidenceSummary: event.evidenceSummary,
      generatedAt: event.generatedAt,
    },
  });
}

export async function queueAndSendAssistantDailyEvent(
  event: AssistantDailyEvent,
  options: QueueAssistantDailyEventOptions = {},
): Promise<AssistantDailyEventRecord> {
  const missing = validateAssistantDailyEvent(event);
  if (missing.length > 0) throw new Error(`Daily assistant event is missing required fields: ${missing.join(', ')}`);

  const existing = await getAssistantDailyEvent(event.eventId);
  const queued = existing ?? await insertAssistantDailyEvent({
    id: event.eventId,
    date: event.date,
    status: 'queued',
    payload: event as unknown as Record<string, unknown>,
    createdAt: iso(options.now),
    updatedAt: iso(options.now),
  });
  if (queued.status === 'sent') {
    await recordDailyEventProofCustody(queued, event);
    await upsertDailyProofPacket(dailyProofPacketFromEvent(queued, event));
    return queued;
  }
  const delivered = await deliverAndPersistDailyEvent(queued, event, options);
  await recordDailyEventProofCustody(delivered, event);
  await upsertDailyProofPacket(dailyProofPacketFromEvent(delivered, event));
  return delivered;
}

async function flushAssistantDailyEventsOnce(options: FlushAssistantDailyEventsOptions): Promise<FlushAssistantDailyEventsResult> {
  const selected = options.eventId ? await getAssistantDailyEvent(options.eventId) : null;
  const records = options.eventId
    ? (selected ? [selected] : [])
    : await listPendingAssistantDailyEvents(options.limit ?? 25, iso(options.now));
  const events = records.filter((record): record is AssistantDailyEventRecord => Boolean(record));
  let sent = 0;
  let failed = 0;
  const updated: AssistantDailyEventRecord[] = [];

  for (const record of events) {
    if (record.status === 'sent') {
      updated.push(record);
      sent += 1;
      continue;
    }
    try {
      const event = eventFromRecord(record);
      const next = await deliverAndPersistDailyEvent(record, event, {
        ...options,
        recordFailureHandoff: options.recordFailureHandoff ?? false,
      });
      updated.push(next);
      if (next.status === 'sent') sent += 1;
      else failed += 1;
    } catch (err: any) {
      const nextRetryAt = retryAt(options.now);
      const next = await updateAssistantDailyEvent(record.id, {
        status: 'failed',
        error: err?.message ?? String(err),
        nextRetryAt,
        updatedAt: iso(options.now),
      });
      updated.push(next);
      failed += 1;
    }
  }

  return {
    ok: failed === 0,
    attempted: events.length,
    sent,
    failed,
    events: updated,
  };
}

export async function flushAssistantDailyEvents(
  options: FlushAssistantDailyEventsOptions = {},
): Promise<FlushAssistantDailyEventsResult> {
  if (flushInFlight) {
    return {
      ok: true,
      attempted: 0,
      sent: 0,
      failed: 0,
      message: 'Daily assistant event flush already running.',
      events: [],
    };
  }
  flushInFlight = flushAssistantDailyEventsOnce(options).finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

export async function readDailyAssistantConfirmation(
  input: { date: string; artifactRef?: string | null; eventId?: string | null },
  depsInput?: Partial<AssistantDailyDeliveryDeps>,
): Promise<AssistantDailyConfirmation> {
  const deps = depsFrom(depsInput);
  const record = input.eventId ? await getAssistantDailyEvent(input.eventId) : null;
  return deps.getConfirmation({
    date: input.date,
    artifactRef: input.artifactRef ?? record?.artifactRef ?? null,
  });
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 0.1) return '0h';
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
}

export function generateAssistantDailySummary(event: AssistantDailyEvent): AssistantDailySummary {
  const topProjects = [...event.projectSummaries]
    .filter((project) => project.totalSeconds > 0)
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, 3)
    .map((project) => `${project.name} (${formatHours(project.totalSeconds)})`);
  const topSessionGroups = [...event.sessionGroups]
    .sort((a, b) => b.sessionCount - a.sessionCount || a.label.localeCompare(b.label))
    .slice(0, 3)
    .map((group) => `${group.label} (${group.sessionCount})`);
  const blockers = event.blockers.length > 0
    ? event.blockers.map((blocker) => blocker.label).join(' ')
    : 'No blockers recorded.';
  const missingProofNote = event.evidenceSummary.missingEvidenceEntries > 0 || event.evidenceSummary.legacyUnverifiedEntries > 0
    ? `${event.evidenceSummary.missingEvidenceEntries + event.evidenceSummary.legacyUnverifiedEntries} entries still need proof.`
    : null;

  return {
    date: event.date,
    title: `Daily assistant summary for ${event.date}`,
    yesterday: event.standupRecordId ? `Linked standup ${event.standupRecordId}.` : 'No linked standup record yet.',
    today: topProjects.length > 0
      ? `Tracked ${formatHours(event.workSummary.totalDurationSeconds)} across ${topProjects.join(', ')}.`
      : `Tracked ${formatHours(event.workSummary.totalDurationSeconds)} with no project focus yet.`,
    blockers,
    topSessionGroups,
    missingProofNote,
  };
}
