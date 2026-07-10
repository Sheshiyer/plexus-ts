import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import type { ReviewCycle, ThoughtseedBridgeDirective } from '../../src/shared/types';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^enc:/, ''),
  },
}));

let cleanupDatabase: (() => Promise<void>) | null = null;

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function activationDirective(overrides: Partial<ThoughtseedBridgeDirective> = {}): ThoughtseedBridgeDirective {
  return {
    id: 'directive_month_close_2026_06',
    memberId: 'member_alice',
    tenantId: 'cambium',
    payload: {
      type: 'member_review_activation',
      schema: 'thoughtseed.member_review_activation.v1',
      source: 'hermes',
      audience: 'founder_review',
      kind: 'monthly',
      periodStart: '2026-06-01',
    },
    ...overrides,
  };
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('Hermes monthly review activation', () => {
  it('accepts only the typed Hermes founder-review directive for a closed month', async () => {
    const { activateMonthlyReviewDirective, parseMonthlyReviewActivationDirective } = await import('../../src/main/review-cycle');
    const generate = vi.fn(async (_kind: 'monthly', periodStart: string): Promise<ReviewCycle> => ({
      id: `review_monthly_${periodStart}`,
    } as ReviewCycle));

    expect(parseMonthlyReviewActivationDirective(activationDirective())).toEqual({
      directiveId: 'directive_month_close_2026_06',
      periodStart: '2026-06-01',
    });
    await expect(activateMonthlyReviewDirective(activationDirective(), {
      now: '2026-07-10T00:00:00.000Z',
      generateReview: generate,
      getExistingReview: async () => null,
    })).resolves.toMatchObject({ review: { id: 'review_monthly_2026-06-01' } });
    expect(generate).toHaveBeenCalledOnce();

    expect(() => parseMonthlyReviewActivationDirective(activationDirective({
      payload: { ...activationDirective().payload, source: 'paperclip' },
    }))).toThrow(/source must be hermes/i);
    await expect(activateMonthlyReviewDirective(activationDirective({
      payload: { ...activationDirective().payload, periodStart: '2026-07-01' },
    }), {
      now: '2026-07-10T00:00:00.000Z',
      generateReview: generate,
      getExistingReview: async () => null,
    })).rejects.toThrow(/closed UTC month/i);
  });

  it('queues a failed monthly delivery only once for a stable review id', async () => {
    const { syncMonthlyReviewCycle } = await import('../../src/main/review-cycle');
    const review = {
      id: 'review_monthly_2026-06-01',
      kind: 'monthly' as const,
      periodStart: '2026-06-01',
      periodEnd: '2026-07-01',
      evidenceSummary: {},
      standupCompliance: {},
      blockers: [],
      appraisalSignals: [],
      generatedAt: '2026-07-01T00:00:00.000Z',
    } as ReviewCycle;
    let queued = false;
    const recordHandoff = vi.fn(async () => { queued = true; });
    const deps = {
      sendBridge: vi.fn(async () => ({ ok: false, message: 'offline' })),
      recordHandoff,
      hasQueuedReview: vi.fn(async () => queued),
      now: '2026-07-10T00:00:00.000Z',
    };

    await syncMonthlyReviewCycle(review, deps);
    await syncMonthlyReviewCycle(review, deps);

    expect(recordHandoff).toHaveBeenCalledOnce();
  });

  it('polls, generates, sends, and acknowledges the scoped activation through the bridge', async () => {
    const loaded = await loadIsolatedAssistantDatabase();
    cleanupDatabase = loaded.cleanup;
    vi.stubEnv('PLEXUS_THOUGHTSEED_BRIDGE_URL', 'https://bridge.test');
    await loaded.database.setSetting('ts.bridgeMemberId', 'member_alice');
    await loaded.database.setSetting('ts.bridgeTenantId', 'cambium');
    await loaded.database.setSetting('ts.bridgeTokenEnc', Buffer.from('enc:member-token').toString('base64'));
    await loaded.database.setSetting('ts.bridgeTokenExpiresAt', '2027-01-01T00:00:00.000Z');
    const requests: Array<{ url: string; body?: Record<string, unknown> }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const body = url.includes('/directives/')
        ? { directives: [activationDirective()] }
        : { ok: true, id: 'bridge_receipt_1', artifactRef: 'bridge://founder-review/2026-06' };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const bridge = await import('../../src/main/thoughtseed-bridge');

    const result = await bridge.processThoughtseedMonthlyReviewDirectives({
      now: '2026-07-10T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      ok: true,
      activatedReviewIds: ['review_monthly_2026-06-01'],
      ackedDirectiveIds: ['directive_month_close_2026_06'],
    });
    expect(requests.map((request) => request.url)).toEqual([
      'https://bridge.test/v1/bridge/directives/member_alice',
      'https://bridge.test/v1/bridge/ingest',
      'https://bridge.test/v1/bridge/ack',
    ]);
    expect(requests[1]?.body).toMatchObject({
      payload: {
        type: 'member_review_cycle',
        audience: 'founder_review',
        review: {
          id: 'review_monthly_2026-06-01',
          standupCompliance: { trackedDays: 0, compliantDays: 0, missedDays: 0, rate: null },
        },
      },
    });
    expect(requests[2]?.body).toMatchObject({ ids: ['directive_month_close_2026_06'] });

    await bridge.processThoughtseedMonthlyReviewDirectives({
      now: '2026-07-10T00:00:00.000Z',
    });
    expect(requests[4]?.body?.id).toBe(requests[1]?.body?.id);
    expect(requests[4]?.body?.payload).toEqual(requests[1]?.body?.payload);
  });

  it('starts a bounded directive poll loop without adding a local month scheduler', () => {
    const main = source('src/main/main.ts');

    expect(main).toContain('startMonthlyReviewDirectiveLoop();');
    expect(main).toContain('processThoughtseedMonthlyReviewDirectives');
    expect(main).toContain('stopMonthlyReviewDirectiveLoop();');
    expect(main).not.toContain('scheduleMonthlyReview');
    expect(main).toMatch(/if \(process\.platform !== 'darwin'\) \{\s*stopMonthlyReviewDirectiveLoop\(\);\s*app\.quit\(\);\s*\}/);
    expect(main).toMatch(/app\.on\('before-quit',[\s\S]*?stopMonthlyReviewDirectiveLoop\(\);/);
  });
});
