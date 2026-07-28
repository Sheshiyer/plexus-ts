import { describe, expect, it } from 'vitest';
import {
  AssistantModelError,
  AssistantModelRouter,
  createMockAssistantModelProvider,
  resolveAssistantModelConfig,
  type AssistantModelProvider,
} from '../../src/main/assistant-models';

function omniRouteProvider(failWith?: Error): AssistantModelProvider {
  return {
    id: 'omniroute',
    model: 'te-build',
    configured: true,
    async generate() {
      if (failWith) throw failWith;
      return { provider: 'omniroute', model: 'te-build', content: 'governed', metadata: {} };
    },
    async stream() {
      if (failWith) throw failWith;
      return (async function* () {
        yield { type: 'text-delta' as const, delta: 'governed', provider: 'omniroute' as const, model: 'te-build' };
        yield { type: 'done' as const, provider: 'omniroute' as const, model: 'te-build' };
      })();
    },
    async health() {
      return { provider: 'omniroute', model: 'te-build', state: 'ok', configured: true, checkedAt: new Date().toISOString() };
    },
  };
}

describe('OmniRoute assistant model router', () => {
  it('routes auto and omniroute through the selected governed lane', async () => {
    const config = resolveAssistantModelConfig({ provider: 'auto', laneId: 'te-plan' }, {});
    const router = new AssistantModelRouter(config, [omniRouteProvider()]);

    const result = await router.generate({ messages: [{ role: 'user', content: 'plan it' }] });

    expect(result.provider).toBe('omniroute');
    expect(result.model).toBe('te-build');
    expect(result.metadata).toMatchObject({ fallback: false, finalProvider: 'omniroute' });
  });

  it('never falls back to mock or a direct provider after an OmniRoute failure', async () => {
    const config = resolveAssistantModelConfig({ provider: 'auto' }, {});
    const router = new AssistantModelRouter(config, [
      omniRouteProvider(new AssistantModelError('gateway offline', { kind: 'network', provider: 'omniroute' })),
      createMockAssistantModelProvider(),
    ]);

    await expect(router.generate({ messages: [] })).rejects.toMatchObject({
      kind: 'network',
      provider: 'omniroute',
    });
  });

  it('activates mock only when explicitly selected', async () => {
    const config = resolveAssistantModelConfig({ provider: 'mock' }, {});
    const router = new AssistantModelRouter(config, [omniRouteProvider(), createMockAssistantModelProvider()]);

    const result = await router.generate({ messages: [{ role: 'user', content: 'test' }] });

    expect(result.provider).toBe('mock');
  });
});
