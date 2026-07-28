import { describe, expect, it } from 'vitest';
import {
  AssistantModelError,
  AssistantModelRouter,
  createMockAssistantModelProvider,
  resolveAssistantModelConfig,
  type AssistantModelFailureKind,
  type AssistantModelProvider,
} from '../../src/main/assistant-models';

function failingOmniRoute(kind: AssistantModelFailureKind): AssistantModelProvider {
  return {
    id: 'omniroute',
    model: 'te-build',
    configured: true,
    async generate() {
      throw new AssistantModelError(`omniroute ${kind}`, { kind, provider: 'omniroute' });
    },
    async stream() {
      throw new AssistantModelError(`omniroute ${kind}`, { kind, provider: 'omniroute' });
    },
    async health() {
      return { provider: 'omniroute', model: 'te-build', state: 'offline', configured: true, checkedAt: new Date().toISOString() };
    },
  };
}

describe('assistant model fail-closed routing', () => {
  it.each(['auth', 'quota', 'timeout', 'network'] as const)(
    'does not fall back after an OmniRoute %s failure',
    async (kind) => {
      const config = resolveAssistantModelConfig({ provider: 'auto' }, {});
      const router = new AssistantModelRouter(config, [
        failingOmniRoute(kind),
        createMockAssistantModelProvider({ content: 'must not run' }),
      ]);

      await expect(router.generate({ messages: [] })).rejects.toMatchObject({
        kind,
        provider: 'omniroute',
      });
    },
  );

  it('uses deterministic mock only when explicitly selected', async () => {
    const config = resolveAssistantModelConfig({ provider: 'mock' }, {});
    const router = new AssistantModelRouter(config, [
      failingOmniRoute('network'),
      createMockAssistantModelProvider({ content: 'explicit mock' }),
    ]);

    await expect(router.generate({ messages: [] })).resolves.toMatchObject({
      provider: 'mock',
      content: 'explicit mock',
    });
  });
});
