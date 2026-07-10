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

function usageSignalString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or less.`);
  return normalized;
}

function usageSignalInteger(value: unknown, label: string, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer.`);
  if (value < 0) throw new Error(`${label} must be at least 0.`);
  if (value > maximum) throw new Error(`${label} must be at most ${maximum}.`);
  return value;
}

export function normalizeMemberUsageSignal(value: unknown): UsageSignal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Usage signal must be an object.');
  }
  const input = value as Record<string, unknown>;
  const timestamp = usageSignalString(input.timestamp, 'Usage signal timestamp', 64);
  utcDayRangeForTimestamp(timestamp);
  const activeProject = input.activeProject === undefined
    ? undefined
    : usageSignalString(input.activeProject, 'Active project', 512);
  if (typeof input.standupCompliant !== 'boolean') {
    throw new Error('Standup compliant must be a boolean.');
  }
  return {
    timestamp,
    ...(activeProject ? { activeProject } : {}),
    dailyTotalSeconds: usageSignalInteger(input.dailyTotalSeconds, 'Daily total seconds', 31_536_000),
    standupCompliant: input.standupCompliant,
    sessionDurationMinutes: usageSignalInteger(input.sessionDurationMinutes, 'Session duration minutes', 525_600),
  };
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
  if (payload.signal !== undefined) {
    try {
      return normalizeMemberUsageSignal(payload.signal);
    } catch {
      // Legacy preparation-failure handoffs may carry a partial signal. Rebuild
      // from their persisted inputs instead of forwarding malformed fields.
    }
  }
  return prepareTimerStopUsageSignal(timerStopUsageInput(payload.usageInput), sources);
}
