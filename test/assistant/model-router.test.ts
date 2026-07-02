import { describe, expect, it } from 'vitest';
import {
  AssistantModelRouter,
  createMockAssistantModelProvider,
  resolveAssistantModelConfig,
} from '../../src/main/assistant-models';

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
});
