import type {
  HandoffInput,
  Project,
  ReviewCycle,
  StandupComplianceSummary,
  StandupEvidenceRecord,
  ThoughtseedBridgeDirective,
  TimeEntry,
} from '../shared/types.js';
import { computeEvidenceSummary } from './evidence.js';

const RETRY_DELAY_MS = 5 * 60 * 1000;

export function reviewPeriodEnd(kind: ReviewCycle['kind'], periodStart: string): string {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== periodStart) {
    throw new Error('Review periodStart must be a valid UTC calendar date.');
  }
  if (kind === 'weekly') {
    start.setUTCDate(start.getUTCDate() + 7);
    return start.toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

function utcEntryDate(entry: Pick<TimeEntry, 'startTime'>): string | null {
  const startedAt = new Date(entry.startTime);
  return Number.isNaN(startedAt.getTime()) ? null : startedAt.toISOString().slice(0, 10);
}

export function buildStandupComplianceSummary(
  entries: readonly Pick<TimeEntry, 'startTime'>[],
  standupEvidenceRecords: readonly Pick<StandupEvidenceRecord, 'date'>[],
): StandupComplianceSummary {
  const trackedDates = new Set(entries.map(utcEntryDate).filter((date): date is string => Boolean(date)));
  const standupDates = new Set(standupEvidenceRecords.map((record) => record.date));
  const compliantDays = [...trackedDates].filter((date) => standupDates.has(date)).length;
  const trackedDays = trackedDates.size;
  return {
    trackedDays,
    compliantDays,
    missedDays: trackedDays - compliantDays,
    rate: trackedDays === 0 ? null : compliantDays / trackedDays,
  };
}

export function buildReviewCycle(input: {
  kind: ReviewCycle['kind'];
  periodStart: string;
  entries: readonly TimeEntry[];
  projects: readonly Project[];
  standupEvidenceRecords: readonly Pick<StandupEvidenceRecord, 'date'>[];
  generatedAt?: string;
}): ReviewCycle {
  const evidenceSummary = computeEvidenceSummary([...input.entries], [...input.projects]);
  const standupCompliance = buildStandupComplianceSummary(input.entries, input.standupEvidenceRecords);
  return {
    id: `review_${input.kind}_${input.periodStart}`,
    kind: input.kind,
    periodStart: input.periodStart,
    periodEnd: reviewPeriodEnd(input.kind, input.periodStart),
    evidenceSummary,
    standupCompliance,
    blockers: evidenceSummary.missingEvidenceEntries > 0 ? ['Evidence activity sync is incomplete for this period.'] : [],
    appraisalSignals: [
      `${evidenceSummary.evidencedEntries}/${evidenceSummary.totalEntries} work records have matched GitHub activity.`,
      `${evidenceSummary.legacyUnverifiedEntries} legacy work records remain unverified.`,
      `${standupCompliance.compliantDays}/${standupCompliance.trackedDays} tracked work days include persisted standup evidence.`,
    ],
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

interface ReviewProofCustodyInput {
  subjectType: 'review';
  subjectId: string;
  proofStatus: ReviewCycle['evidenceSummary']['proofStatus'];
  evidenceType: 'review';
  payload: Record<string, unknown>;
}

export interface ReviewCycleGenerationDeps {
  listEntries: (from: string, to: string) => Promise<TimeEntry[]>;
  listProjects: () => Promise<Project[]>;
  listStandupEvidenceRecords: (from: string, to: string) => Promise<StandupEvidenceRecord[]>;
  upsertReviewCycle: (record: ReviewCycle) => Promise<unknown>;
  upsertProofCustodyRecord: (input: ReviewProofCustodyInput) => Promise<unknown>;
  syncMonthlyReview: (record: ReviewCycle) => Promise<ReviewCycleBridgeResult>;
}

const defaultGenerationDeps: ReviewCycleGenerationDeps = {
  async listEntries(from, to) {
    const database = await import('../db/database.js');
    return database.listEntries(from, to);
  },
  async listProjects() {
    const database = await import('../db/database.js');
    return database.listProjects();
  },
  async listStandupEvidenceRecords(from, to) {
    const database = await import('../db/database.js');
    return database.listStandupEvidenceRecords(from, to);
  },
  async upsertReviewCycle(record) {
    const database = await import('../db/database.js');
    return database.upsertReviewCycle(record);
  },
  async upsertProofCustodyRecord(input) {
    const database = await import('../db/database.js');
    return database.upsertProofCustodyRecord(input);
  },
  async syncMonthlyReview(record) {
    return syncMonthlyReviewCycle(record);
  },
};

export async function generateReviewCycle(
  kind: ReviewCycle['kind'],
  periodStart: string,
  input: Partial<ReviewCycleGenerationDeps> & { generatedAt?: string } = {},
): Promise<ReviewCycle> {
  const deps = { ...defaultGenerationDeps, ...input };
  const periodEnd = reviewPeriodEnd(kind, periodStart);
  const [entries, projects, standupEvidenceRecords] = await Promise.all([
    deps.listEntries(`${periodStart}T00:00:00.000Z`, `${periodEnd}T00:00:00.000Z`),
    deps.listProjects(),
    deps.listStandupEvidenceRecords(periodStart, periodEnd),
  ]);
  const record = buildReviewCycle({
    kind,
    periodStart,
    entries,
    projects,
    standupEvidenceRecords,
    ...(input.generatedAt ? { generatedAt: input.generatedAt } : {}),
  });
  await deps.upsertReviewCycle(record);
  await deps.upsertProofCustodyRecord({
    subjectType: 'review',
    subjectId: record.id,
    proofStatus: record.evidenceSummary.proofStatus,
    evidenceType: 'review',
    payload: {
      kind,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      evidenceSummary: record.evidenceSummary,
      standupCompliance: record.standupCompliance,
      blockers: record.blockers,
      appraisalSignals: record.appraisalSignals,
    },
  });
  if (kind === 'monthly') await deps.syncMonthlyReview(record);
  return record;
}

export interface MonthlyReviewActivation {
  directiveId: string;
  periodStart: string;
}

export interface MonthlyReviewActivationResult {
  directiveId: string;
  review: ReviewCycle;
}

export function parseMonthlyReviewActivationDirective(
  directive: ThoughtseedBridgeDirective,
): MonthlyReviewActivation | null {
  const payload = directive.payload;
  if (payload.type !== 'member_review_activation') return null;
  if (payload.schema !== 'thoughtseed.member_review_activation.v1') {
    throw new Error('Monthly review activation schema is not supported.');
  }
  if (payload.source !== 'hermes') throw new Error('Monthly review activation source must be Hermes.');
  if (payload.audience !== 'founder_review') {
    throw new Error('Monthly review activation audience must be founder_review.');
  }
  if (payload.kind !== 'monthly') throw new Error('Monthly review activation kind must be monthly.');
  if (typeof payload.periodStart !== 'string' || !/^\d{4}-\d{2}-01$/.test(payload.periodStart)) {
    throw new Error('Monthly review activation periodStart must be the first day of a UTC month.');
  }
  reviewPeriodEnd('monthly', payload.periodStart);
  return { directiveId: directive.id, periodStart: payload.periodStart };
}

export async function activateMonthlyReviewDirective(
  directive: ThoughtseedBridgeDirective,
  input: {
    now?: Date | string;
    generateReview?: typeof generateReviewCycle;
    getExistingReview?: (id: string) => Promise<ReviewCycle | null>;
    syncExistingReview?: (record: ReviewCycle) => Promise<ReviewCycleBridgeResult>;
  } = {},
): Promise<MonthlyReviewActivationResult | null> {
  const activation = parseMonthlyReviewActivationDirective(directive);
  if (!activation) return null;
  const now = input.now instanceof Date ? input.now : new Date(input.now ?? new Date().toISOString());
  if (Number.isNaN(now.getTime())) throw new Error('Monthly review activation now must be a valid instant.');
  if (reviewPeriodEnd('monthly', activation.periodStart) > now.toISOString().slice(0, 10)) {
    throw new Error('Monthly review activation requires a closed UTC month.');
  }
  const reviewId = `review_monthly_${activation.periodStart}`;
  const getExistingReview = input.getExistingReview ?? (async (id: string) => {
    const database = await import('../db/database.js');
    return database.getReviewCycle(id);
  });
  const existing = await getExistingReview(reviewId);
  if (existing) {
    const syncExistingReview = input.syncExistingReview ?? syncMonthlyReviewCycle;
    await syncExistingReview(existing);
    return { directiveId: activation.directiveId, review: existing };
  }
  const generate = input.generateReview ?? generateReviewCycle;
  const issuedAt = directive.issuedAt ?? directive.createdAt;
  const issuedInstant = issuedAt ? new Date(issuedAt) : null;
  const generatedAt = issuedInstant && !Number.isNaN(issuedInstant.getTime())
    ? issuedInstant.toISOString()
    : `${reviewPeriodEnd('monthly', activation.periodStart)}T00:00:00.000Z`;
  const review = await generate('monthly', activation.periodStart, { generatedAt });
  return { directiveId: activation.directiveId, review };
}

export interface ReviewCycleBridgeResult {
  ok: boolean;
  message?: string;
  messageId?: string;
  artifactRef?: string;
}

export interface MonthlyReviewSyncDeps {
  sendBridge: (record: ReviewCycle) => Promise<ReviewCycleBridgeResult>;
  recordHandoff: (input: HandoffInput) => Promise<unknown>;
  hasQueuedReview: (reviewId: string) => Promise<boolean>;
  now?: Date | string;
}

const defaultSyncDeps: Omit<MonthlyReviewSyncDeps, 'now'> = {
  async sendBridge(record) {
    const bridge = await import('./thoughtseed-bridge.js');
    return bridge.sendThoughtseedMemberReviewCycle(record);
  },
  async recordHandoff(input) {
    const database = await import('../db/database.js');
    return database.recordHandoff(input);
  },
  async hasQueuedReview(reviewId) {
    const database = await import('../db/database.js');
    const handoffs = await database.listHandoffs();
    return handoffs.some((handoff) => handoff.kind === 'review_rollup_sync'
      && handoff.status !== 'sent'
      && handoff.status !== 'skipped'
      && handoff.payload.reviewId === reviewId);
  },
};

function reviewCycleFromHandoffPayload(payload: Record<string, unknown>): ReviewCycle {
  const review = payload.review;
  if (!review || typeof review !== 'object') throw new Error('Handoff is missing the review cycle payload.');
  const record = review as Partial<ReviewCycle>;
  if (
    typeof record.id !== 'string'
    || (record.kind !== 'weekly' && record.kind !== 'monthly')
    || typeof record.periodStart !== 'string'
    || typeof record.periodEnd !== 'string'
    || !record.evidenceSummary
    || !record.standupCompliance
    || !Array.isArray(record.blockers)
    || !Array.isArray(record.appraisalSignals)
    || typeof record.generatedAt !== 'string'
  ) {
    throw new Error('Handoff review cycle payload is invalid.');
  }
  return record as ReviewCycle;
}

export async function retryMonthlyReviewCycleHandoff(
  payload: Record<string, unknown>,
  input: Pick<MonthlyReviewSyncDeps, 'sendBridge'> = defaultSyncDeps,
): Promise<ReviewCycleBridgeResult> {
  return input.sendBridge(reviewCycleFromHandoffPayload(payload));
}

export async function syncMonthlyReviewCycle(
  record: ReviewCycle,
  input: Partial<MonthlyReviewSyncDeps> = {},
): Promise<ReviewCycleBridgeResult> {
  if (record.kind !== 'monthly') {
    return { ok: true, message: 'Weekly reviews remain local and are not sent to founder review.' };
  }
  const deps = { ...defaultSyncDeps, ...input };
  const now = input.now instanceof Date
    ? input.now
    : new Date(input.now ?? new Date().toISOString());
  try {
    const result = await deps.sendBridge(record);
    if (result.ok) return result;
    throw new Error(result.message ?? 'Member review bridge delivery failed.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!(await deps.hasQueuedReview(record.id))) {
      await deps.recordHandoff({
        kind: 'review_rollup_sync',
        status: 'failed',
        title: `Monthly review ${record.periodStart} is queued for bridge retry`,
        payload: {
          reviewId: record.id,
          kind: record.kind,
          periodStart: record.periodStart,
          periodEnd: record.periodEnd,
          review: record,
        },
        error: message,
        nextRetryAt: new Date(now.getTime() + RETRY_DELAY_MS).toISOString(),
      });
    }
    return { ok: false, message };
  }
}
