import { describe, expect, it, vi } from 'vitest';
import {
  buildReviewCycle,
  buildStandupComplianceSummary,
  retryMonthlyReviewCycleHandoff,
  reviewPeriodEnd,
  syncMonthlyReviewCycle,
} from '../../src/main/review-cycle';
import { buildProject, buildTimeEntry } from './fixtures/builders';

describe('review cycle reporting', () => {
  it('uses the exclusive next calendar-month boundary in UTC', () => {
    expect(reviewPeriodEnd('monthly', '2026-02-01')).toBe('2026-03-01');
    expect(reviewPeriodEnd('monthly', '2026-04-01')).toBe('2026-05-01');
    expect(reviewPeriodEnd('weekly', '2026-02-25')).toBe('2026-03-04');
  });

  it('counts distinct UTC work dates and intersects persisted standup dates', () => {
    const summary = buildStandupComplianceSummary(
      [
        buildTimeEntry({ id: 'day_1_a', startTime: '2026-02-01T00:00:00.000Z' }),
        buildTimeEntry({ id: 'day_1_b', startTime: '2026-02-01T23:59:59.999Z' }),
        buildTimeEntry({ id: 'day_2', startTime: '2026-02-02T00:00:00.000Z' }),
      ],
      [
        { date: '2026-02-02' },
        { date: '2026-02-03' },
      ],
    );

    expect(summary).toEqual({
      trackedDays: 2,
      compliantDays: 1,
      missedDays: 1,
      rate: 0.5,
    });
  });

  it('returns a null compliance rate when no work dates were recorded', () => {
    expect(buildStandupComplianceSummary([], [{ date: '2026-02-01' }])).toEqual({
      trackedDays: 0,
      compliantDays: 0,
      missedDays: 0,
      rate: null,
    });
  });

  it('builds the same explicit standup summary for IPC and API callers', () => {
    const record = buildReviewCycle({
      kind: 'monthly',
      periodStart: '2026-02-01',
      entries: [buildTimeEntry({ startTime: '2026-02-14T23:59:59.999Z', evidenceStatus: 'matched' })],
      projects: [buildProject()],
      standupEvidenceRecords: [{ date: '2026-02-14' }],
      generatedAt: '2026-03-01T00:00:00.000Z',
    });

    expect(record).toMatchObject({
      id: 'review_monthly_2026-02-01',
      periodEnd: '2026-03-01',
      standupCompliance: {
        trackedDays: 1,
        compliantDays: 1,
        missedDays: 0,
        rate: 1,
      },
    });
  });

  it('records a retryable review_rollup_sync handoff when bridge delivery fails', async () => {
    const record = buildReviewCycle({
      kind: 'monthly',
      periodStart: '2026-02-01',
      entries: [],
      projects: [],
      standupEvidenceRecords: [],
      generatedAt: '2026-03-01T00:00:00.000Z',
    });
    const recordHandoff = vi.fn(async () => ({}));

    const result = await syncMonthlyReviewCycle(record, {
      now: '2026-03-01T00:00:00.000Z',
      sendBridge: vi.fn(async () => {
        throw new Error('member bridge credential is missing');
      }),
      recordHandoff,
    });

    expect(result.ok).toBe(false);
    expect(recordHandoff).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'review_rollup_sync',
      status: 'failed',
      payload: expect.objectContaining({ reviewId: record.id, review: record }),
      error: 'member bridge credential is missing',
      nextRetryAt: '2026-03-01T00:05:00.000Z',
    }));

    const [{ payload }] = recordHandoff.mock.calls[0];
    const retryBridge = vi.fn(async () => ({ ok: true, messageId: 'review_monthly_member_1' }));
    await expect(retryMonthlyReviewCycleHandoff(payload, { sendBridge: retryBridge }))
      .resolves.toMatchObject({ ok: true, messageId: 'review_monthly_member_1' });
    expect(retryBridge).toHaveBeenCalledWith(record);
  });

  it('does not create a handoff after a successful bridge review sync', async () => {
    const record = buildReviewCycle({
      kind: 'monthly',
      periodStart: '2026-02-01',
      entries: [],
      projects: [],
      standupEvidenceRecords: [],
    });
    const recordHandoff = vi.fn();

    const result = await syncMonthlyReviewCycle(record, {
      sendBridge: vi.fn(async () => ({ ok: true, messageId: 'review_member_1' })),
      recordHandoff,
    });

    expect(result.ok).toBe(true);
    expect(recordHandoff).not.toHaveBeenCalled();
  });

  it('never founder-delivers a weekly review through the monthly sync helper', async () => {
    const record = buildReviewCycle({
      kind: 'weekly',
      periodStart: '2026-02-23',
      entries: [],
      projects: [],
      standupEvidenceRecords: [],
    });
    const sendBridge = vi.fn();
    const recordHandoff = vi.fn();

    const result = await syncMonthlyReviewCycle(record, { sendBridge, recordHandoff });

    expect(result).toMatchObject({ ok: true });
    expect(sendBridge).not.toHaveBeenCalled();
    expect(recordHandoff).not.toHaveBeenCalled();
  });
});
