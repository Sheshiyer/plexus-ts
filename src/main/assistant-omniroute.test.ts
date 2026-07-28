import { once } from 'node:events';
import { createServer } from 'node:http';
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
      {
        method: 'GET',
        redirect: 'follow',
        headers: { Cookie: 'remove-me', Authorization: 'Bearer remove-me' },
      },
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
    expect(fetch.mock.calls[0][1]?.redirect).toBe('error');
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

  it('blocks Access redirects before assertions reach another origin and reports sign-in required', async () => {
    let assertionAtDestination: string | undefined;
    let destinationRequests = 0;
    const destination = createServer((request, response) => {
      destinationRequests += 1;
      const receivedAssertion = request.headers['cf-access-jwt-assertion'];
      assertionAtDestination = Array.isArray(receivedAssertion) ? receivedAssertion.join(',') : receivedAssertion;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{}');
    });
    destination.listen(0, '127.0.0.1');
    await once(destination, 'listening');
    const destinationAddress = destination.address();
    if (!destinationAddress || typeof destinationAddress === 'string') throw new Error('Destination server did not bind.');
    const destinationOrigin = `http://127.0.0.1:${destinationAddress.port}`;

    const relay = createServer((_request, response) => {
      response.writeHead(302, {
        Location: `${destinationOrigin}/cloudflare-access-login`,
      });
      response.end();
    });
    relay.listen(0, '127.0.0.1');
    await once(relay, 'listening');
    const relayAddress = relay.address();
    if (!relayAddress || typeof relayAddress === 'string') throw new Error('Relay server did not bind.');
    const relayOrigin = `http://127.0.0.1:${relayAddress.port}`;

    try {
      const provider = createOmniRouteAssistantProvider({
        laneId: 'te-build',
        origin: relayOrigin,
        authenticatedFetch: (input, init) => fetchOmniRouteWithAccess(input, init, {
          relayOrigin,
          readAccessJwt: async () => 'header.payload.signature',
          fetch: globalThis.fetch,
        }),
      });

      await expect(collect(await provider.stream({
        messages: [{ role: 'user', content: 'test Access redirect' }],
      }))).rejects.toMatchObject({
        state: 'sign_in_required',
      });
      expect(destinationRequests).toBe(0);
      expect(assertionAtDestination).toBeUndefined();
    } finally {
      relay.close();
      destination.close();
      await Promise.all([once(relay, 'close'), once(destination, 'close')]);
    }
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

  it('adapts tool schemas for the installed AI SDK and preserves provider tool calls', async () => {
    let requestBody: Record<string, unknown> | undefined;
    const authenticatedFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const chunks = [
        {
          id: 'chatcmpl_tool_1',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'moonshotai/Kimi-K3',
          choices: [{
            index: 0,
            delta: {
              role: 'assistant',
              tool_calls: [{
                index: 0,
                id: 'call_real_sdk',
                type: 'function',
                function: { name: 'context.projects', arguments: '{}' },
              }],
            },
            finish_reason: null,
          }],
        },
        {
          id: 'chatcmpl_tool_1',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'moonshotai/Kimi-K3',
          choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        },
      ];
      return new Response(`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}`).join('\n\n')}\n\ndata: [DONE]\n\n`, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'X-Request-Id': 'request_omniroute_1',
          'CF-Ray': 'ray_omniroute_1',
          'Set-Cookie': 'must-not-persist=true',
        },
      });
    });
    const provider = createOmniRouteAssistantProvider({
      laneId: 'te-build',
      origin: 'https://models.thoughtseed.space',
      authenticatedFetch,
    });

    const chunks = await collect(await provider.stream({
      messages: [{ role: 'user', content: 'List projects' }],
      tools: [{
        id: 'context.projects',
        description: 'Read bounded project metadata.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      }],
    }));

    expect(requestBody).toMatchObject({
      model: 'te-build',
      tools: [{
        type: 'function',
        function: {
          name: 'context.projects',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      }],
    });
    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'tool-call',
      callId: 'call_real_sdk',
      toolId: 'context.projects',
      payload: {},
    }));
    expect(chunks).toContainEqual(expect.objectContaining({
      type: 'done',
      finishReason: 'tool-calls',
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      metadata: {
        omniRoute: {
          responseId: 'chatcmpl_tool_1',
          finalRoute: 'moonshotai/Kimi-K3',
          requestId: 'request_omniroute_1',
          cfRay: 'ray_omniroute_1',
        },
      },
    }));
    expect(JSON.stringify(chunks)).not.toContain('must-not-persist');
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
