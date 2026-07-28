import { describe, expect, it, vi } from 'vitest';
import {
  OmniRouteClientError,
  createOmniRouteAssistantProvider,
  redactOmniRouteError,
  resolveOmniRouteRelayOrigin,
} from './assistant-omniroute';
import { fetchOmniRouteWithAccess } from './teamforge';

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of stream) items.push(item);
  return items;
}

describe('authenticated Clio OmniRoute client', () => {
  it('requires a canonical HTTPS relay origin in production', () => {
    expect(resolveOmniRouteRelayOrigin({
      isPackaged: true,
      env: { PLEXUS_OMNIROUTE_RELAY_ORIGIN: 'https://models.thoughtseed.space' },
    })).toBe('https://models.thoughtseed.space');

    expect(() => resolveOmniRouteRelayOrigin({
      isPackaged: true,
      env: { PLEXUS_OMNIROUTE_RELAY_ORIGIN: 'http://models.thoughtseed.space' },
    })).toThrow(/https/i);
    expect(() => resolveOmniRouteRelayOrigin({
      isPackaged: true,
      env: { PLEXUS_OMNIROUTE_RELAY_ORIGIN: 'https://models.thoughtseed.space/proxy?x=1' },
    })).toThrow(/origin/i);
  });

  it('allows only an explicit loopback override during development', () => {
    expect(resolveOmniRouteRelayOrigin({
      isPackaged: false,
      env: { PLEXUS_OMNIROUTE_RELAY_DEV_ORIGIN: 'http://127.0.0.1:20130' },
    })).toBe('http://127.0.0.1:20130');
    expect(() => resolveOmniRouteRelayOrigin({
      isPackaged: false,
      env: { PLEXUS_OMNIROUTE_RELAY_DEV_ORIGIN: 'http://192.168.1.5:20130' },
    })).toThrow(/loopback/i);
  });

  it('adds the Access assertion through a narrow main-process fetch without cookies or bearer keys', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response('{}', {
      status: 200,
      headers: init?.headers,
    }));

    await fetchOmniRouteWithAccess(
      'https://models.thoughtseed.space/v1/models',
      { method: 'GET', headers: { Cookie: 'remove-me', Authorization: 'Bearer remove-me' } },
      {
        relayOrigin: 'https://models.thoughtseed.space',
        readAccessJwt: async () => 'header.payload.signature',
        fetch,
      },
    );

    const headers = new Headers(fetch.mock.calls[0][1]?.headers);
    expect(headers.get('Cf-Access-Jwt-Assertion')).toBe('header.payload.signature');
    expect(headers.has('Cookie')).toBe(false);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('rejects alternate origins and unsupported relay routes before fetching', async () => {
    const fetch = vi.fn();
    const deps = {
      relayOrigin: 'https://models.thoughtseed.space',
      readAccessJwt: async () => 'header.payload.signature',
      fetch,
    };

    await expect(fetchOmniRouteWithAccess('https://attacker.example/v1/models', { method: 'GET' }, deps)).rejects.toThrow(/origin/i);
    await expect(fetchOmniRouteWithAccess('https://models.thoughtseed.space/v1/anything', { method: 'GET' }, deps)).rejects.toThrow(/route/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the selected lane as model and preserves text, tools, finish reason, and usage', async () => {
    const streamText = vi.fn(async () => ({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'hello' };
        yield { type: 'tool-call', toolCallId: 'call_1', toolName: 'context.projects', input: {} };
        yield { type: 'finish', finishReason: 'tool-calls', usage: { totalTokens: 9 } };
      })(),
    }));
    const createModel = vi.fn(() => ({ provider: 'omniroute' }));
    const provider = createOmniRouteAssistantProvider({
      laneId: 'te-validate',
      origin: 'https://models.thoughtseed.space',
      createModel,
      loadAiSdk: async () => ({ generateText: vi.fn(), streamText }),
    });

    const chunks = await collect(await provider.stream({
      messages: [{ role: 'user', content: 'check this' }],
      tools: [{ id: 'context.projects', parameters: { type: 'object' } }],
    }));

    expect(createModel).toHaveBeenCalledWith('te-validate', expect.objectContaining({
      baseURL: 'https://models.thoughtseed.space/v1',
      fetch: expect.any(Function),
    }));
    expect(chunks).toEqual([
      expect.objectContaining({ type: 'text-delta', delta: 'hello', provider: 'omniroute', model: 'te-validate' }),
      expect.objectContaining({ type: 'tool-call', callId: 'call_1', toolId: 'context.projects' }),
      expect.objectContaining({ type: 'done', finishReason: 'tool-calls', usage: { totalTokens: 9 } }),
    ]);
  });

  it('passes cancellation to the AI SDK request and classifies Access and offline errors honestly', async () => {
    const streamText = vi.fn(async () => ({ fullStream: (async function* () {})() }));
    const provider = createOmniRouteAssistantProvider({
      laneId: 'te-build',
      origin: 'https://models.thoughtseed.space',
      createModel: () => ({}),
      loadAiSdk: async () => ({ generateText: vi.fn(), streamText }),
    });
    const controller = new AbortController();

    await provider.stream({ messages: [], signal: controller.signal });

    expect(streamText).toHaveBeenCalledWith(expect.objectContaining({ abortSignal: controller.signal }));
    expect(new OmniRouteClientError('denied', { status: 401 }).state).toBe('sign_in_required');
    expect(new OmniRouteClientError('fetch failed').state).toBe('offline');
    expect(new OmniRouteClientError('denied', { status: 403 }).message).toMatch(/sign in/i);
    expect(new OmniRouteClientError('fetch failed').message).toMatch(/gateway.*offline|retry/i);
  });

  it('redacts Access assertions and response secrets from errors', () => {
    const message = redactOmniRouteError(
      'Cf-Access-Jwt-Assertion: eyJhbGciOiJSUzI1NiJ9.payload.signature Authorization: Bearer local-secret api_key=relay-secret',
    );

    expect(message).not.toContain('payload.signature');
    expect(message).not.toContain('local-secret');
    expect(message).not.toContain('relay-secret');
  });
});
