import type { StandupEvidenceRecord, TimeEntry, UsageSignal } from '../shared/types.js';

export interface TimerStopUsageInput {
  timestamp: string;
  activeProject?: string;
  stoppedDurationSeconds: number;
}

export interface UsageSignalSources {
  listEntries: (from: string, to: string) => Promise<TimeEntry[]>;
  getStandupEvidenceRecord: (date: string) => Promise<StandupEvidenceRecord | null>;
}

export function utcDayRangeForTimestamp(timestamp: string): { date: string; from: string; to: string } {
  const start = new Date(timestamp);
  if (Number.isNaN(start.getTime())) throw new Error('Usage signal timestamp must be a valid UTC instant.');
  const date = start.toISOString().slice(0, 10);
  const from = `${date}T00:00:00.000Z`;
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + 1);
  return { date, from, to: end.toISOString() };
}

export function buildTimerStopUsageSignal(input: {
  timestamp: string;
  activeProject?: string;
  stoppedDurationSeconds: number;
  entries: readonly TimeEntry[];
  standupEvidence: StandupEvidenceRecord | null;
}): UsageSignal {
  const range = utcDayRangeForTimestamp(input.timestamp);
  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);
  const dailyTotalSeconds = input.entries.reduce((total, entry) => {
    const startedAt = Date.parse(entry.startTime);
    if (!Number.isFinite(startedAt) || startedAt < fromMs || startedAt >= toMs) return total;
    return total + Math.max(0, Number(entry.durationSeconds) || 0);
  }, 0);

  return {
    timestamp: input.timestamp,
    ...(input.activeProject ? { activeProject: input.activeProject } : {}),
    dailyTotalSeconds,
    standupCompliant: input.standupEvidence?.date === range.date,
    sessionDurationMinutes: Math.floor(Math.max(0, input.stoppedDurationSeconds) / 60),
  };
}

export async function prepareTimerStopUsageSignal(
  input: TimerStopUsageInput,
  sources: UsageSignalSources,
): Promise<UsageSignal> {
  const range = utcDayRangeForTimestamp(input.timestamp);
  const [entries, standupEvidence] = await Promise.all([
    sources.listEntries(range.from, range.to),
    sources.getStandupEvidenceRecord(range.date),
  ]);
  return buildTimerStopUsageSignal({ ...input, entries, standupEvidence });
}

function isUsageSignal(value: unknown): value is UsageSignal {
  if (!value || typeof value !== 'object') return false;
  const signal = value as Partial<UsageSignal>;
  return typeof signal.timestamp === 'string'
    && typeof signal.dailyTotalSeconds === 'number'
    && typeof signal.standupCompliant === 'boolean'
    && typeof signal.sessionDurationMinutes === 'number';
}

function timerStopUsageInput(value: unknown): TimerStopUsageInput {
  if (!value || typeof value !== 'object') throw new Error('Handoff is missing usage signal preparation inputs.');
  const input = value as Partial<TimerStopUsageInput>;
  if (typeof input.timestamp !== 'string' || typeof input.stoppedDurationSeconds !== 'number') {
    throw new Error('Handoff usage signal preparation inputs are invalid.');
  }
  return {
    timestamp: input.timestamp,
    stoppedDurationSeconds: input.stoppedDurationSeconds,
    ...(typeof input.activeProject === 'string' && input.activeProject ? { activeProject: input.activeProject } : {}),
  };
}

export async function retryUsageSignalFromHandoffPayload(
  payload: Record<string, unknown>,
  sources: UsageSignalSources,
): Promise<UsageSignal> {
  if (isUsageSignal(payload.signal)) return payload.signal;
  return prepareTimerStopUsageSignal(timerStopUsageInput(payload.usageInput), sources);
}
