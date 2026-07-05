import { describe, expect, it, vi } from 'vitest';
import { discoverAssistantModelCatalog } from '../../src/main/assistant-model-catalog';
import { resolveAssistantModelConfig } from '../../src/main/assistant-models';

describe('assistant model catalog', () => {
  it('discovers local OpenAI-compatible models and marks the selected catalog entry', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url === 'http://127.0.0.1:11434/v1/models') {
        return {
          ok: true,
          async json() {
            return { data: [{ id: 'qwen3:8b' }, { id: 'llama3.2:latest' }] };
          },
        };
      }
      throw new Error('offline');
    });
    const config = resolveAssistantModelConfig({
      provider: 'local',
      localBaseUrl: 'http://127.0.0.1:11434',
      localModel: 'qwen3:8b',
    }, {});

    const catalog = await discoverAssistantModelCatalog(config, {
      fetch,
      now: () => new Date('2026-07-04T00:00:00.000Z'),
      timeoutMs: 5,
    });

    expect(catalog.generatedAt).toBe('2026-07-04T00:00:00.000Z');
    expect(catalog.selectedModelId).toBe('local/configured/qwen3:8b');
    expect(catalog.fallbackModelIds).not.toContain(catalog.selectedModelId);
    expect(catalog.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'local/configured/qwen3:8b',
        provider: 'local',
        state: 'ready',
        selectable: true,
        selected: true,
        baseUrl: 'http://127.0.0.1:11434/v1',
      }),
    ]));
  });

  it('keeps raw cloud keys out of catalog serialization', async () => {
    const config = resolveAssistantModelConfig({
      googleApiKey: 'google-secret',
      nvidiaApiKey: 'nvidia-secret',
    }, {});

    const catalog = await discoverAssistantModelCatalog(config, {
      fetch: async () => {
        throw new Error('offline');
      },
      timeoutMs: 1,
    });

    expect(JSON.stringify(catalog)).not.toContain('google-secret');
    expect(JSON.stringify(catalog)).not.toContain('nvidia-secret');
    expect(catalog.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'google', state: 'ready', requiresKey: true }),
      expect.objectContaining({ provider: 'nvidia', state: 'ready', requiresKey: true }),
    ]));
  });

  it('reports offline local endpoints as non-selectable when no model id is configured', async () => {
    const config = resolveAssistantModelConfig({
      provider: 'local',
      localBaseUrl: 'http://127.0.0.1:11434',
    }, {});

    const catalog = await discoverAssistantModelCatalog(config, {
      fetch: async () => {
        throw new Error('offline');
      },
      timeoutMs: 1,
    });

    expect(catalog.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'local/configured/unavailable',
        provider: 'local',
        state: 'offline',
        selectable: false,
        baseUrl: 'http://127.0.0.1:11434/v1',
      }),
    ]));
  });
});
