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
  it('uses bridge fallback after Worker delivery fails', async () => {
    const event = buildDailyEvent();
    const result = await deliverAssistantDailyEvent(event, {
      sendWorker: vi.fn(async () => ({ ok: false, channel: 'worker', status: 'failed', message: 'offline' })),
      sendBridge: vi.fn(async () => ({ ok: true, channel: 'bridge', status: 'sent', artifactRef: 'r2://daily/2026-07-01.json' })),
    });

    expect(result).toMatchObject({
      ok: true,
      channel: 'bridge',
      status: 'sent',
      artifactRef: 'r2://daily/2026-07-01.json',
    });
  });

  it('keeps the fallback helper member-scoped and token-free', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/main/thoughtseed-bridge.ts'), 'utf8');

    expect(source).toContain("type: 'daily_agent_event'");
    expect(source).toContain("'/v1/bridge/ingest'");
    expect(source).not.toContain('BRIDGE_TOKEN');
  });
});
