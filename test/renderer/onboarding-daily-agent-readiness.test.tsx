import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as onboarding from '../../src/renderer/components/Onboarding';

type DailyAgentReadinessInput = {
  assistantEnabled: boolean;
  bridgeConnected: boolean;
  bridgeError?: string;
  workerConnected: boolean;
  queueReady: boolean;
};

type DailyAgentReadinessResult = {
  ok: boolean;
  message?: string;
};

type ReadinessEvaluator = (input: DailyAgentReadinessInput) => DailyAgentReadinessResult;

function readinessEvaluator(): ReadinessEvaluator {
  const evaluator = (onboarding as unknown as {
    evaluateDailyAgentReadiness?: ReadinessEvaluator;
  }).evaluateDailyAgentReadiness;
  expect(evaluator).toBeTypeOf('function');
  return evaluator as ReadinessEvaluator;
}

describe('daily-agent onboarding readiness', () => {
  it('is connected when Assistant and the member bridge are connected', () => {
    const result = readinessEvaluator()({
      assistantEnabled: true,
      bridgeConnected: true,
      workerConnected: false,
      queueReady: false,
    });

    expect(result).toEqual({ ok: true });
  });

  it.each([
    { label: 'Worker only', workerConnected: true, queueReady: false },
    { label: 'local queue only', workerConnected: false, queueReady: true },
  ])('keeps $label in degraded fallback instead of connected readiness', ({ workerConnected, queueReady }) => {
    const result = readinessEvaluator()({
      assistantEnabled: true,
      bridgeConnected: false,
      workerConnected,
      queueReady,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/member bridge/i);
    expect(result.message).toMatch(/degraded fallback/i);
  });

  it('keeps a fully disconnected member blocked on bridge setup', () => {
    const result = readinessEvaluator()({
      assistantEnabled: true,
      bridgeConnected: false,
      bridgeError: 'Bridge invite has not been redeemed.',
      workerConnected: false,
      queueReady: false,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Bridge invite has not been redeemed.');
    expect(result.message).toMatch(/connect.*bridge.*Settings/i);
  });

  it('describes Worker and queue paths only as degraded durability', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/renderer/components/Onboarding.tsx'),
      'utf8',
    );

    expect(source).toContain('member-scoped Thoughtseed bridge');
    expect(source).toContain('degraded fallback');
    expect(source).not.toContain('Worker or the local retry queue can accept events');
  });
});
