import { describe, expect, it } from 'vitest';
import {
  buildTimerStopUsageSignal,
  normalizeMemberUsageSignal,
  retryUsageSignalFromHandoffPayload,
} from '../../src/main/usage-signal';
import { buildTimeEntry } from './fixtures/builders';

describe('timer-stop usage signal semantics', () => {
  it('sums every entry on the explicit UTC day and reads compliance from standup evidence', () => {
    const signal = buildTimerStopUsageSignal({
      timestamp: '2026-07-02T00:00:05.000Z',
      activeProject: 'project_current',
      stoppedDurationSeconds: 90,
      entries: [
        buildTimeEntry({ id: 'previous_day', startTime: '2026-07-01T23:59:59.999Z', durationSeconds: 400 }),
        buildTimeEntry({ id: 'start_boundary', startTime: '2026-07-02T00:00:00.000Z', durationSeconds: 120 }),
        buildTimeEntry({ id: 'end_boundary', startTime: '2026-07-02T23:59:59.999Z', durationSeconds: 180 }),
        buildTimeEntry({ id: 'next_day', startTime: '2026-07-03T00:00:00.000Z', durationSeconds: 500 }),
      ],
      standupEvidence: {
        id: 'standup_2026-07-02',
        date: '2026-07-02',
        totalSeconds: 300,
        evidenceSummary: {
          proofStatus: 'verified',
          totalEntries: 2,
          evidencedEntries: 2,
          missingEvidenceEntries: 0,
          legacyUnverifiedEntries: 0,
          evidencedSeconds: 300,
          missingEvidenceSeconds: 0,
          projectRepoCoverage: {},
        },
        activity: [],
        generatedAt: '2026-07-02T23:00:00.000Z',
      },
    });

    expect(signal).toEqual({
      timestamp: '2026-07-02T00:00:05.000Z',
      activeProject: 'project_current',
      dailyTotalSeconds: 300,
      standupCompliant: true,
      sessionDurationMinutes: 1,
    });
  });

  it('never infers standup compliance from a long timer session', () => {
    const signal = buildTimerStopUsageSignal({
      timestamp: '2026-07-02T20:00:00.000Z',
      activeProject: 'project_current',
      stoppedDurationSeconds: 7200,
      entries: [buildTimeEntry({ startTime: '2026-07-02T18:00:00.000Z', durationSeconds: 7200 })],
      standupEvidence: null,
    });

    expect(signal.dailyTotalSeconds).toBe(7200);
    expect(signal.sessionDurationMinutes).toBe(120);
    expect(signal.standupCompliant).toBe(false);
  });

  it('recomputes a preparation-failure handoff from persisted UTC-day sources', async () => {
    const listEntries = async (from: string, to: string) => {
      expect(from).toBe('2026-07-02T00:00:00.000Z');
      expect(to).toBe('2026-07-03T00:00:00.000Z');
      return [
        buildTimeEntry({ id: 'earlier', startTime: '2026-07-02T08:00:00.000Z', durationSeconds: 600 }),
        buildTimeEntry({ id: 'stopped', startTime: '2026-07-02T09:00:00.000Z', durationSeconds: 120 }),
      ];
    };
    const getStandupEvidenceRecord = async (date: string) => {
      expect(date).toBe('2026-07-02');
      return null;
    };

    const signal = await retryUsageSignalFromHandoffPayload({
      usageInput: {
        timestamp: '2026-07-02T09:02:00.000Z',
        activeProject: 'project_current',
        stoppedDurationSeconds: 120,
      },
    }, { listEntries, getStandupEvidenceRecord });

    expect(signal).toEqual({
      timestamp: '2026-07-02T09:02:00.000Z',
      activeProject: 'project_current',
      dailyTotalSeconds: 720,
      standupCompliant: false,
      sessionDurationMinutes: 2,
    });
  });

  it('preserves an already-built usage signal on ordinary delivery retries', async () => {
    const signal = buildTimerStopUsageSignal({
      timestamp: '2026-07-02T09:02:00.000Z',
      stoppedDurationSeconds: 120,
      entries: [],
      standupEvidence: null,
    });
    const listEntries = async () => {
      throw new Error('must not rescan');
    };

    await expect(retryUsageSignalFromHandoffPayload({ signal }, {
      listEntries,
      getStandupEvidenceRecord: async () => null,
    })).resolves.toEqual(signal);
  });
});

describe('member usage signal IPC payload', () => {
  it('normalizes the typed fields and strips renderer-supplied extras', () => {
    expect(normalizeMemberUsageSignal({
      timestamp: ' 2026-07-02T09:02:00.000Z ',
      activeProject: ' project_current ',
      dailyTotalSeconds: 720,
      standupCompliant: true,
      sessionDurationMinutes: 2,
      privileged: true,
    })).toEqual({
      timestamp: '2026-07-02T09:02:00.000Z',
      activeProject: 'project_current',
      dailyTotalSeconds: 720,
      standupCompliant: true,
      sessionDurationMinutes: 2,
    });
  });

  it.each([
    ['non-object payload', null, 'must be an object'],
    ['invalid timestamp', { timestamp: 'not-a-date', dailyTotalSeconds: 1, standupCompliant: true, sessionDurationMinutes: 1 }, 'valid UTC instant'],
    ['non-string active project', { timestamp: '2026-07-02T09:02:00.000Z', activeProject: {}, dailyTotalSeconds: 1, standupCompliant: true, sessionDurationMinutes: 1 }, 'Active project must be a string'],
    ['oversized active project', { timestamp: '2026-07-02T09:02:00.000Z', activeProject: 'x'.repeat(513), dailyTotalSeconds: 1, standupCompliant: true, sessionDurationMinutes: 1 }, 'Active project must be 512 characters or less'],
    ['non-finite daily total', { timestamp: '2026-07-02T09:02:00.000Z', dailyTotalSeconds: Number.NaN, standupCompliant: true, sessionDurationMinutes: 1 }, 'Daily total seconds must be a finite number'],
    ['negative daily total', { timestamp: '2026-07-02T09:02:00.000Z', dailyTotalSeconds: -1, standupCompliant: true, sessionDurationMinutes: 1 }, 'Daily total seconds must be at least 0'],
    ['fractional daily total', { timestamp: '2026-07-02T09:02:00.000Z', dailyTotalSeconds: 1.5, standupCompliant: true, sessionDurationMinutes: 1 }, 'Daily total seconds must be an integer'],
    ['oversized daily total', { timestamp: '2026-07-02T09:02:00.000Z', dailyTotalSeconds: 31_536_001, standupCompliant: true, sessionDurationMinutes: 1 }, 'Daily total seconds must be at most 31536000'],
    ['non-boolean compliance', { timestamp: '2026-07-02T09:02:00.000Z', dailyTotalSeconds: 1, standupCompliant: 'true', sessionDurationMinutes: 1 }, 'Standup compliant must be a boolean'],
    ['non-finite session duration', { timestamp: '2026-07-02T09:02:00.000Z', dailyTotalSeconds: 1, standupCompliant: true, sessionDurationMinutes: Number.POSITIVE_INFINITY }, 'Session duration minutes must be a finite number'],
    ['negative session duration', { timestamp: '2026-07-02T09:02:00.000Z', dailyTotalSeconds: 1, standupCompliant: true, sessionDurationMinutes: -1 }, 'Session duration minutes must be at least 0'],
    ['oversized session duration', { timestamp: '2026-07-02T09:02:00.000Z', dailyTotalSeconds: 1, standupCompliant: true, sessionDurationMinutes: 525_601 }, 'Session duration minutes must be at most 525600'],
  ])('rejects hostile %s', (_label, payload, message) => {
    expect(() => normalizeMemberUsageSignal(payload)).toThrow(message as string);
  });
});
