import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { deliverAssistantDailyEvent } from '../../src/main/assistant-daily';
import { buildDailyEvent } from './fixtures/daily-event';

vi.mock('../../src/main/teamforge.js', () => ({
  getDailyAssistantEventStatus: vi.fn(),
  sendDailyAssistantEvent: vi.fn(),
}));

vi.mock('../../src/main/thoughtseed-bridge.js', () => ({
  sendThoughtseedDailyEvent: vi.fn(),
}));

describe('assistant daily bridge fallback', () => {
  it('uses the member-scoped bridge as primary and never double-sends to Worker', async () => {
    const event = buildDailyEvent();
    const sendWorker = vi.fn(async () => ({ ok: true, channel: 'worker' as const, status: 'sent' as const }));
    const sendBridge = vi.fn(async () => ({
      ok: true,
      channel: 'bridge' as const,
      status: 'sent' as const,
      artifactRef: 'bridge://daily/2026-07-01.json',
    }));
    const result = await deliverAssistantDailyEvent(event, {
      sendWorker,
      sendBridge,
    });

    expect(result).toMatchObject({
      ok: true,
      channel: 'bridge',
      status: 'sent',
      artifactRef: 'bridge://daily/2026-07-01.json',
    });
    expect(result.retryableFallback).not.toBe(true);
    expect(sendBridge).toHaveBeenCalledOnce();
    expect(sendWorker).not.toHaveBeenCalled();
  });

  it('uses Worker once only after bridge delivery fails', async () => {
    const event = buildDailyEvent();
    const sendBridge = vi.fn(async () => ({ ok: false, channel: 'bridge' as const, status: 'failed' as const, message: 'bridge offline' }));
    const sendWorker = vi.fn(async () => ({
      ok: true,
      channel: 'worker' as const,
      status: 'sent' as const,
      artifactRef: 'worker://daily/2026-07-01.json',
      message: 'stored',
    }));

    const result = await deliverAssistantDailyEvent(event, { sendWorker, sendBridge });

    expect(result).toMatchObject({
      ok: true,
      channel: 'worker',
      status: 'sent',
      artifactRef: 'worker://daily/2026-07-01.json',
      retryableFallback: true,
      bridgeError: 'bridge offline',
    });
    expect(sendBridge).toHaveBeenCalledOnce();
    expect(sendWorker).toHaveBeenCalledOnce();
    expect(result.message).toContain('Bridge delivery failed: bridge offline');
    expect(result.message).toContain('Worker fallback succeeded: stored');
  });

  it('falls back once when the bridge throws and preserves the bridge error', async () => {
    const event = buildDailyEvent();
    const sendBridge = vi.fn(async () => {
      throw new Error('member credential missing');
    });
    const sendWorker = vi.fn(async () => ({
      ok: true,
      channel: 'worker' as const,
      status: 'sent' as const,
      message: 'stored by Worker',
    }));

    const result = await deliverAssistantDailyEvent(event, { sendBridge, sendWorker });

    expect(result).toMatchObject({
      ok: true,
      channel: 'worker',
      retryableFallback: true,
      bridgeError: 'member credential missing',
    });
    expect(result.message).toContain('Bridge delivery failed: member credential missing');
    expect(result.message).toContain('Worker fallback succeeded: stored by Worker');
    expect(sendBridge).toHaveBeenCalledOnce();
    expect(sendWorker).toHaveBeenCalledOnce();
  });

  it('keeps the fallback helper member-scoped and token-free', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/main/thoughtseed-bridge.ts'), 'utf8');

    expect(source).toContain("type: 'daily_agent_event'");
    expect(source).toContain("event.eventId");
    expect(source).toContain("'/v1/bridge/ingest'");
    expect(source).not.toContain('BRIDGE_TOKEN');
  });
});
