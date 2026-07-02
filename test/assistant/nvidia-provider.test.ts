import { describe, expect, it, vi } from 'vitest';
import { NVIDIA_NIM_BASE_URL, createNvidiaAssistantProvider } from '../../src/main/assistant-models';

describe('nvidia nim assistant provider', () => {
  it('constructs mocked OpenAI-compatible NIM calls without live network', async () => {
    const generateText = vi.fn(async () => ({
      text: 'nvidia response',
      usage: { promptTokens: 3, completionTokens: 2 },
    }));
    const createModel = vi.fn((modelName: string, options: { apiKey: string; baseURL?: string }) => ({
      provider: 'nvidia',
      modelName,
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    }));
    const provider = createNvidiaAssistantProvider({
      apiKey: 'nvidia-key',
      model: 'nim-test',
      createModel,
      loadAiSdk: async () => ({
        generateText,
        streamText: vi.fn(),
      }),
    });

    const result = await provider.generate({
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(createModel).toHaveBeenCalledWith('nim-test', {
      apiKey: 'nvidia-key',
      baseURL: NVIDIA_NIM_BASE_URL,
    });
    expect(generateText.mock.calls[0][0]).toMatchObject({
      model: {
        provider: 'nvidia',
        modelName: 'nim-test',
        apiKey: 'nvidia-key',
        baseURL: NVIDIA_NIM_BASE_URL,
      },
    });
    expect(result).toMatchObject({
      provider: 'nvidia',
      model: 'nim-test',
      content: 'nvidia response',
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });
  });

  it('reports missing auth without probing live APIs', async () => {
    const provider = createNvidiaAssistantProvider({ apiKey: null });

    await expect(provider.generate({ messages: [{ role: 'user', content: 'hello' }] })).rejects.toThrow('NVIDIA API key is missing');
    await expect(provider.health()).resolves.toMatchObject({
      provider: 'nvidia',
      state: 'missing_auth',
      configured: false,
    });
  });
});
