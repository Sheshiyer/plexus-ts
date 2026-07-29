import { describe, expect, it, vi } from 'vitest';
import {
  assistantModelHealth,
  resolveAssistantModelConfig,
  type AssistantModelProvider,
} from '../../src/main/assistant-models';

function provider(probe: ReturnType<typeof vi.fn>): AssistantModelProvider {
  return {
    id: 'omniroute',
    model: 'te-build',
    configured: true,
    async generate() {
      probe();
      return { provider: 'omniroute', model: 'te-build', content: 'ok', metadata: {} };
    },
    async stream() {
      return (async function* () {})();
    },
    async health(input) {
      if (input?.probeLive) probe();
      return { provider: 'omniroute', model: 'te-build', state: 'ok', configured: true, checkedAt: '2026-07-28T00:00:00.000Z' };
    },
  };
}

describe('OmniRoute assistant health', () => {
  it('reports configured gateway metadata without spending tokens by default', async () => {
    const probe = vi.fn();
    const result = await assistantModelHealth(resolveAssistantModelConfig(), [provider(probe)]);

    expect(probe).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.providers[0]).toMatchObject({ provider: 'omniroute', model: 'te-build', state: 'ok' });
  });

  it('runs a live probe only when explicitly requested', async () => {
    const probe = vi.fn();
    const result = await assistantModelHealth(
      resolveAssistantModelConfig(),
      [provider(probe)],
      { probeLive: true, provider: 'omniroute' },
    );

    expect(probe).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });
});
