import {
  ASSISTANT_RECOMMENDED_LANE,
  normalizeAssistantLaneId,
  type AssistantModelHealthRequest,
} from '../shared/native-assistant.js';
import {
  AssistantModelError,
  baseGenerateInput,
  classifyAssistantModelError,
  sdkStreamToChunks,
  type AiSdkModule,
  type AiSdkStreamResult,
  type AssistantModelGenerateInput,
  type AssistantModelProvider,
  type AssistantModelUsage,
} from './assistant-models.js';
import { fetchOmniRouteWithAccess, OmniRouteAccessRequiredError } from './teamforge.js';

type EnvLike = Record<string, string | undefined>;
type AuthenticatedFetch = typeof globalThis.fetch;

export const PRODUCTION_OMNIROUTE_RELAY_ORIGIN = 'https://clio-relay.thoughtseed.space';

export interface OmniRouteModelFactoryOptions {
  baseURL: string;
  fetch: AuthenticatedFetch;
}

export interface OmniRouteAssistantProviderOptions {
  laneId?: unknown;
  origin: string;
  now?: () => Date;
  authenticatedFetch?: AuthenticatedFetch;
  loadAiSdk?: () => Promise<AiSdkModule>;
  createModel?: (laneId: string, options: OmniRouteModelFactoryOptions) => unknown | Promise<unknown>;
}

export function redactOmniRouteError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown OmniRoute error');
  return raw
    .replace(/Cf-Access-Token\s*:\s*[^\s,]+/gi, 'Cf-Access-Token: [redacted]')
    .replace(/Cf-Access-Jwt-Assertion\s*:\s*[^\s,]+/gi, 'Cf-Access-Jwt-Assertion: [redacted]')
    .replace(/Bearer\s+[^\s,]+/gi, 'Bearer [redacted]')
    .replace(/api[_ -]?key\s*[:=]\s*[^\s,]+/gi, 'api_key=[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-access-assertion]');
}

export class OmniRouteClientError extends AssistantModelError {
  readonly status?: number;
  readonly state: 'sign_in_required' | 'offline';

  constructor(
    rawMessage: string,
    options: { status?: number; cause?: unknown } = {},
  ) {
    const status = options.status;
    const denied = status === 401 || status === 403;
    const message = denied
      ? 'Sign in to Plexus to use the OmniRoute gateway.'
      : 'The OmniRoute gateway is offline. Retry shortly or check Clio settings.';
    super(message, {
      kind: denied ? 'auth' : 'network',
      provider: 'omniroute',
      retryable: !denied,
      cause: options.cause ?? new Error(redactOmniRouteError(rawMessage)),
    });
    this.name = 'OmniRouteClientError';
    this.status = status;
    this.state = denied ? 'sign_in_required' : 'offline';
  }
}

function canonicalOrigin(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('OmniRoute relay origin must be a valid URL origin.');
  }
  if (value !== url.origin || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('OmniRoute relay URL must contain only a canonical origin.');
  }
  return url;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]';
}

export function resolveOmniRouteRelayOrigin(input: {
  isPackaged: boolean;
  env?: EnvLike;
}): string {
  const env = input.env ?? process.env;
  const developmentOverride = env.PLEXUS_OMNIROUTE_RELAY_DEV_ORIGIN?.trim();
  if (!input.isPackaged && developmentOverride) {
    const url = canonicalOrigin(developmentOverride);
    if (!isLoopbackHost(url.hostname)) {
      throw new Error('OmniRoute development relay override must use loopback.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('OmniRoute development relay override must use HTTP(S).');
    }
    return url.origin;
  }

  const configured = env.PLEXUS_OMNIROUTE_RELAY_ORIGIN?.trim();
  if (input.isPackaged) {
    if (!configured) return PRODUCTION_OMNIROUTE_RELAY_ORIGIN;
    const url = canonicalOrigin(configured);
    if (url.protocol !== 'https:') {
      throw new Error('Production OmniRoute relay origin must use HTTPS.');
    }
    if (url.origin !== PRODUCTION_OMNIROUTE_RELAY_ORIGIN) {
      throw new Error('Packaged OmniRoute relay origin must match the baked production authority.');
    }
    return PRODUCTION_OMNIROUTE_RELAY_ORIGIN;
  }

  if (!configured) {
    throw new Error('PLEXUS_OMNIROUTE_RELAY_ORIGIN is required.');
  }
  const url = canonicalOrigin(configured);
  if (url.protocol !== 'https:') {
    throw new Error('Production OmniRoute relay origin must use HTTPS.');
  }
  return url.origin;
}

function usageFrom(value: unknown): AssistantModelUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const usage = value as Record<string, unknown>;
  const inputTokens = typeof usage.inputTokens === 'number' ? usage.inputTokens : undefined;
  const outputTokens = typeof usage.outputTokens === 'number' ? usage.outputTokens : undefined;
  const totalTokens = typeof usage.totalTokens === 'number'
    ? usage.totalTokens
    : inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined;
  return inputTokens === undefined && outputTokens === undefined && totalTokens === undefined
    ? undefined
    : { inputTokens, outputTokens, totalTokens };
}

function statusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as Record<string, unknown>;
  if (typeof value.status === 'number') return value.status;
  if (typeof value.statusCode === 'number') return value.statusCode;
  const response = value.response;
  return response && typeof response === 'object' && typeof (response as { status?: unknown }).status === 'number'
    ? (response as { status: number }).status
    : undefined;
}

function omniRouteError(error: unknown): AssistantModelError {
  if (error instanceof OmniRouteClientError) return error;
  if (error instanceof OmniRouteAccessRequiredError) {
    return new OmniRouteClientError(error.message, { status: 401, cause: error });
  }
  const classified = classifyAssistantModelError(error, 'omniroute');
  if (classified.kind === 'timeout' && classified.message.toLowerCase().includes('cancel')) return classified;
  const status = statusFromError(error)
    ?? (/\b401\b/.test(classified.message) ? 401 : /\b403\b/.test(classified.message) ? 403 : undefined);
  return new OmniRouteClientError(classified.message, { status, cause: error });
}

const loadAiSdk = async (): Promise<AiSdkModule> => {
  const sdk = await import('ai');
  return sdk as unknown as AiSdkModule;
};

export function createOmniRouteAssistantProvider(
  options: OmniRouteAssistantProviderOptions,
): AssistantModelProvider {
  const laneId = normalizeAssistantLaneId(options.laneId ?? ASSISTANT_RECOMMENDED_LANE);
  const origin = canonicalOrigin(options.origin).origin;
  const baseURL = `${origin}/v1`;
  const now = options.now ?? (() => new Date());
  const load = options.loadAiSdk ?? loadAiSdk;
  const authenticatedFetch = options.authenticatedFetch
    ?? ((input, init) => fetchOmniRouteWithAccess(input, init, { relayOrigin: origin }));

  async function sdkModel(): Promise<unknown> {
    if (options.createModel) {
      return options.createModel(laneId, { baseURL, fetch: authenticatedFetch });
    }
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
    const omniRoute = createOpenAICompatible({
      name: 'omniroute',
      baseURL,
      fetch: authenticatedFetch,
      includeUsage: true,
    });
    return omniRoute(laneId);
  }

  return {
    id: 'omniroute',
    model: laneId,
    configured: true,
    async generate(input: AssistantModelGenerateInput) {
      const sdk = await load();
      try {
        const result = await sdk.generateText(baseGenerateInput(input, await sdkModel(), sdk));
        return {
          provider: 'omniroute',
          model: laneId,
          content: result.text ?? '',
          usage: usageFrom(result.usage),
          finishReason: result.finishReason,
          metadata: { provider: 'omniroute', laneId },
        };
      } catch (error) {
        throw omniRouteError(error);
      }
    },
    async stream(input: AssistantModelGenerateInput) {
      const sdk = await load();
      try {
        const result: AiSdkStreamResult = await sdk.streamText(baseGenerateInput(input, await sdkModel(), sdk));
        return (async function* guardedOmniRouteStream() {
          try {
            yield* sdkStreamToChunks(result, 'omniroute', laneId, { throwStreamErrors: true });
          } catch (error) {
            throw omniRouteError(error);
          }
        })();
      } catch (error) {
        throw omniRouteError(error);
      }
    },
    async health(input?: AssistantModelHealthRequest) {
      if (!input?.probeLive) {
        return {
          provider: 'omniroute',
          model: laneId,
          state: 'ok',
          configured: true,
          checkedAt: now().toISOString(),
        };
      }
      try {
        await this.generate({ messages: [{ role: 'user', content: 'health check' }] });
        return {
          provider: 'omniroute',
          model: laneId,
          state: 'ok',
          configured: true,
          checkedAt: now().toISOString(),
        };
      } catch (error) {
        const failure = omniRouteError(error);
        return {
          provider: 'omniroute',
          model: laneId,
          state: failure.kind === 'auth' ? 'missing_auth' : 'offline',
          configured: true,
          checkedAt: now().toISOString(),
          message: failure.message,
        };
      }
    },
  };
}
