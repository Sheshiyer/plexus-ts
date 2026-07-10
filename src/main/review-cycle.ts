import type {
  HandoffInput,
  Project,
  ReviewCycle,
  StandupComplianceSummary,
  StandupEvidenceRecord,
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

export interface ReviewCycleBridgeResult {
  ok: boolean;
  message?: string;
  messageId?: string;
  artifactRef?: string;
}

export interface MonthlyReviewSyncDeps {
  sendBridge: (record: ReviewCycle) => Promise<ReviewCycleBridgeResult>;
  recordHandoff: (input: HandoffInput) => Promise<unknown>;
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
    return { ok: false, message };
  }
}
