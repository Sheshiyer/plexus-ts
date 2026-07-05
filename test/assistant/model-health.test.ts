import { describe, expect, it, vi } from 'vitest';
import {
  assistantModelHealth,
  createGoogleAssistantProvider,
  createLocalAssistantProvider,
  createNvidiaAssistantProvider,
  resolveAssistantModelConfig,
} from '../../src/main/assistant-models';

describe('assistant model health', () => {
  it('validates configured auth state without spending tokens by default', async () => {
    const generateText = vi.fn();
    const config = resolveAssistantModelConfig({ provider: 'auto', googleApiKey: 'google-key' }, {});
    const result = await assistantModelHealth(config, [
      createGoogleAssistantProvider({
        apiKey: 'google-key',
        loadAiSdk: async () => ({ generateText, streamText: vi.fn() }),
        createModel: () => ({}),
      }),
      createNvidiaAssistantProvider({ apiKey: null }),
    ]);

    expect(generateText).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'local', state: 'not_configured', configured: false }),
      expect.objectContaining({ provider: 'google', state: 'ok', configured: true }),
      expect.objectContaining({ provider: 'nvidia', state: 'missing_auth', configured: false }),
    ]));
  });

  it('runs an optional live probe only when requested', async () => {
    const generateText = vi.fn(async () => ({ text: 'ok' }));
    const config = resolveAssistantModelConfig({ provider: 'google', googleApiKey: 'google-key' }, {});

    const result = await assistantModelHealth(config, [
      createGoogleAssistantProvider({
        apiKey: 'google-key',
        loadAiSdk: async () => ({ generateText, streamText: vi.fn() }),
        createModel: () => ({}),
      }),
    ], { probeLive: true, provider: 'google' });

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result.providers[0]).toMatchObject({ provider: 'google', state: 'ok' });
  });

  it('reports configured local models as ok without a live probe', async () => {
    const generateText = vi.fn();
    const config = resolveAssistantModelConfig({
      provider: 'local',
      localBaseUrl: 'http://127.0.0.1:11434',
      localModel: 'qwen3:8b',
    }, {});

    const result = await assistantModelHealth(config, [
      createLocalAssistantProvider({
        baseURL: config.localBaseUrl ?? undefined,
        model: config.localModel,
        loadAiSdk: async () => ({ generateText, streamText: vi.fn() }),
        createModel: () => ({}),
      }),
    ], { provider: 'local' });

    expect(generateText).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.providers[0]).toMatchObject({ provider: 'local', state: 'ok', configured: true });
  });
});
