import { describe, expect, it } from 'vitest';
import {
  buildTimerStopUsageSignal,
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
