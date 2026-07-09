import { describe, expect, it } from 'vitest';
import {
  AssistantModelRouter,
  createMockAssistantModelProvider,
  type AssistantModelProvider,
  resolveAssistantModelConfig,
} from '../../src/main/assistant-models';

function textProvider(input: {
  id: 'local' | 'google';
  configured: boolean;
  content: string;
}): AssistantModelProvider {
  return {
    id: input.id,
    model: `${input.id}-model`,
    configured: input.configured,
    async generate() {
      return {
        provider: input.id,
        model: `${input.id}-model`,
        content: input.content,
        metadata: {},
      };
    },
    async stream() {
      return (async function* stream() {
        yield { type: 'text-delta' as const, delta: input.content, provider: input.id, model: `${input.id}-model` };
        yield { type: 'done' as const, provider: input.id, model: `${input.id}-model` };
      })();
    },
    async health() {
      return {
        provider: input.id,
        model: `${input.id}-model`,
        state: input.configured ? 'ok' : 'not_configured',
        configured: input.configured,
        checkedAt: '2026-07-01T00:00:00.000Z',
      };
    },
  };
}

describe('assistant model router', () => {
  it('routes to the deterministic mock provider', async () => {
    const config = resolveAssistantModelConfig({ provider: 'mock' }, {});
    const router = new AssistantModelRouter(config, [createMockAssistantModelProvider()]);

    const result = await router.generate({
      messages: [{ role: 'user', content: 'summarize today' }],
    });

    expect(result.provider).toBe('mock');
    expect(result.content).toContain('summarize today');
    expect(result.usage?.inputTokens).toBe(1);
    expect(result.metadata.fallback).toBe(false);
  });

  it('streams deterministic mock chunks', async () => {
    const config = resolveAssistantModelConfig({ provider: 'mock' }, {});
    const router = new AssistantModelRouter(config, [createMockAssistantModelProvider({ content: 'mock stream' })]);
    const stream = await router.stream({ messages: [{ role: 'user', content: 'go' }] });
    const chunks = [];

    for await (const chunk of stream) chunks.push(chunk);

    expect(chunks.map((chunk) => chunk.type)).toEqual(['text-delta', 'done']);
    expect(chunks[0]).toMatchObject({ provider: 'mock', model: 'mock-deterministic' });
  });

  it('skips unconfigured local providers before cloud fallback in auto mode', async () => {
    const config = resolveAssistantModelConfig({ provider: 'auto', googleApiKey: 'google-key' }, {});
    const router = new AssistantModelRouter(config, [
      textProvider({ id: 'local', configured: false, content: 'local should not run' }),
      textProvider({ id: 'google', configured: true, content: 'google response' }),
    ]);

    const result = await router.generate({ messages: [{ role: 'user', content: 'go' }] });

    expect(result.provider).toBe('google');
    expect(result.content).toBe('google response');
    expect(result.metadata).toMatchObject({
      fallback: false,
      primaryProvider: 'google',
      finalProvider: 'google',
      attempts: [],
    });
  });

  it('aborts hung providers and falls back with timeout attempt metadata', async () => {
    const config = resolveAssistantModelConfig({
      provider: 'google',
      googleApiKey: 'google-key',
      nvidiaApiKey: 'nvidia-key',
    }, {});
    const hungGoogle: AssistantModelProvider = {
      id: 'google',
      model: 'google-model',
      configured: true,
      async generate() {
        return new Promise(() => {});
      },
      async stream() {
        return new Promise(() => {});
      },
      async health() {
        return {
          provider: 'google',
          model: 'google-model',
          state: 'ok',
          configured: true,
          checkedAt: '2026-07-01T00:00:00.000Z',
        };
      },
    };
    const router = new AssistantModelRouter(config, [
      hungGoogle,
      {
        id: 'nvidia',
        model: 'nvidia-model',
        configured: true,
        async generate() {
          return {
            provider: 'nvidia' as const,
            model: 'nvidia-model',
            content: 'fallback after timeout',
            metadata: {},
          };
        },
        async stream() {
          return (async function* stream() {
            yield { type: 'text-delta' as const, delta: 'fallback after timeout', provider: 'nvidia' as const, model: 'nvidia-model' };
            yield { type: 'done' as const, provider: 'nvidia' as const, model: 'nvidia-model' };
          })();
        },
        async health() {
          return {
            provider: 'nvidia' as const,
            model: 'nvidia-model',
            state: 'ok' as const,
            configured: true,
            checkedAt: '2026-07-01T00:00:00.000Z',
          };
        },
      },
    ], { providerTimeoutMs: 5 });

    const result = await router.generate({ messages: [{ role: 'user', content: 'go' }] });

    expect(result.provider).toBe('nvidia');
    expect(result.content).toBe('fallback after timeout');
    expect(result.metadata).toMatchObject({
      fallback: true,
      primaryProvider: 'google',
      finalProvider: 'nvidia',
      attempts: [{ provider: 'google', status: 'failed', kind: 'timeout' }],
    });
  });
});
