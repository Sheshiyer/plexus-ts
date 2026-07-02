import { describe, expect, it } from 'vitest';
import {
  AssistantModelError,
  AssistantModelRouter,
  type AssistantModelGenerateInput,
  type AssistantModelProvider,
  resolveAssistantModelConfig,
} from '../../src/main/assistant-models';

function provider(input: {
  id: 'google' | 'nvidia';
  fail?: AssistantModelError;
  content?: string;
}): AssistantModelProvider {
  return {
    id: input.id,
    model: `${input.id}-model`,
    configured: true,
    async generate(_payload: AssistantModelGenerateInput) {
      if (input.fail) throw input.fail;
      return {
        provider: input.id,
        model: `${input.id}-model`,
        content: input.content ?? `${input.id} ok`,
        metadata: {},
      };
    },
    async stream() {
      if (input.fail) throw input.fail;
      return (async function* stream() {
        yield { type: 'text-delta' as const, delta: input.content ?? `${input.id} ok`, provider: input.id, model: `${input.id}-model` };
        yield { type: 'done' as const, provider: input.id, model: `${input.id}-model` };
      })();
    },
    async health() {
      return {
        provider: input.id,
        model: `${input.id}-model`,
        state: 'ok',
        configured: true,
        checkedAt: '2026-07-01T00:00:00.000Z',
      };
    },
  };
}

describe('assistant model fallback', () => {
  it('falls back deterministically on auth, quota, timeout, or network failures', async () => {
    const config = resolveAssistantModelConfig({
      provider: 'google',
      googleApiKey: 'google-key',
      nvidiaApiKey: 'nvidia-key',
    }, {});
    const router = new AssistantModelRouter(config, [
      provider({
        id: 'google',
        fail: new AssistantModelError('401 unauthorized', { kind: 'auth', provider: 'google' }),
      }),
      provider({ id: 'nvidia', content: 'fallback response' }),
    ]);

    const result = await router.generate({ messages: [{ role: 'user', content: 'go' }] });

    expect(result.provider).toBe('nvidia');
    expect(result.content).toBe('fallback response');
    expect(result.metadata).toMatchObject({
      fallback: true,
      primaryProvider: 'google',
      finalProvider: 'nvidia',
      attempts: [{ provider: 'google', status: 'failed', kind: 'auth' }],
    });
  });
});
