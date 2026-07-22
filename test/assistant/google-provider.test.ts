import { describe, expect, it, vi } from 'vitest';
import { createGoogleAssistantProvider } from '../../src/main/assistant-models';

describe('google assistant provider', () => {
  it('constructs mocked Google AI SDK calls without live network', async () => {
    const generateText = vi.fn(async () => ({
      text: 'google response',
      usage: { inputTokens: 4, outputTokens: 2 },
      finishReason: 'stop',
    }));
    const createModel = vi.fn((modelName: string, options: { apiKey: string }) => ({
      provider: 'google',
      modelName,
      apiKey: options.apiKey,
    }));
    const provider = createGoogleAssistantProvider({
      apiKey: 'google-key',
      model: 'gemini-test',
      createModel,
      loadAiSdk: async () => ({
        generateText,
        streamText: vi.fn(),
      }),
    });

    const result = await provider.generate({
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(createModel).toHaveBeenCalledWith('gemini-test', { apiKey: 'google-key' });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateText.mock.calls[0][0]).toMatchObject({
      model: { provider: 'google', modelName: 'gemini-test', apiKey: 'google-key' },
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(result).toMatchObject({
      provider: 'google',
      model: 'gemini-test',
      content: 'google response',
      finishReason: 'stop',
    });
  });

  it('reports missing auth without probing live APIs', async () => {
    const provider = createGoogleAssistantProvider({ apiKey: null });

    await expect(provider.generate({ messages: [{ role: 'user', content: 'hello' }] })).rejects.toThrow('Google API key is missing');
    await expect(provider.health()).resolves.toMatchObject({
      provider: 'google',
      state: 'missing_auth',
      configured: false,
    });
  });

  it('passes the bounded step signal and preserves tool stream parts', async () => {
    const streamText = vi.fn(() => ({
      stream: (async function* stream() {
        yield { type: 'tool-call', toolCallId: 'call_1', toolName: 'context.projects', input: {} };
        yield { type: 'tool-result', toolCallId: 'call_1', toolName: 'context.projects', output: { projects: [] } };
        yield { type: 'finish', finishReason: 'stop', totalUsage: {} };
      })(),
    }));
    const stepCountIs = vi.fn(() => 'two-steps');
    const provider = createGoogleAssistantProvider({
      apiKey: 'google-key',
      model: 'gemini-test',
      createModel: () => ({}),
      loadAiSdk: async () => ({ generateText: vi.fn(), streamText, stepCountIs }),
    });

    const stream = await provider.stream({
      messages: [{ role: 'user', content: 'inspect projects' }],
      tools: { 'context.projects': { description: 'Read projects', inputSchema: { type: 'object' } } },
      maxToolSteps: 2,
    });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);

    expect(stepCountIs).toHaveBeenCalledWith(2);
    expect(streamText.mock.calls[0][0]).toMatchObject({ stopWhen: 'two-steps' });
    expect(chunks.map((chunk) => chunk.type)).toEqual(['tool-call', 'tool-result', 'done']);
  });
});
