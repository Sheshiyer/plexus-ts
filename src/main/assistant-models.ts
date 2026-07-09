import type {
  AssistantConfiguredModelProvider,
  AssistantModelHealthRequest,
  AssistantModelHealthResult,
  AssistantModelHealthState,
  AssistantModelProvider as AssistantModelProviderName,
  AssistantModelProviderHealth,
  AssistantModelStatus,
} from '../shared/native-assistant.js';
import type { AssistantRole } from '../shared/native-assistant.js';

export const ASSISTANT_MODEL_ENV = {
  localEndpoint: 'LOCAL_ENDPOINT',
  localModel: 'LOCAL_MODEL',
  localApiKey: 'LOCAL_API_KEY',
  googleApiKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
  nvidiaApiKey: 'NVIDIA_API_KEY',
} as const;

export const ASSISTANT_DEFAULT_MODELS = {
  local: 'local-auto',
  google: 'gemini-2.0-flash',
  nvidia: 'meta/llama-3.1-70b-instruct',
  mock: 'mock-deterministic',
} as const;

export const NVIDIA_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export interface AssistantModelConfigSettings {
  provider?: AssistantModelProviderName | null;
  googleModel?: string | null;
  nvidiaModel?: string | null;
  localModel?: string | null;
  localBaseUrl?: string | null;
  localApiKey?: string | null;
  mockModel?: string | null;
  googleApiKey?: string | null;
  nvidiaApiKey?: string | null;
}

export interface AssistantResolvedModelConfig {
  provider: AssistantModelProviderName;
  googleModel: string;
  nvidiaModel: string;
  localModel: string;
  localBaseUrl: string | null;
  localApiKey: string | null;
  mockModel: string;
  googleApiKey: string | null;
  nvidiaApiKey: string | null;
  selectedModelId: string | null;
  selectedProvider: AssistantConfiguredModelProvider | null;
  configuredProviders: AssistantConfiguredModelProvider[];
  envKeys: typeof ASSISTANT_MODEL_ENV;
}

export interface AssistantModelMessage {
  role: AssistantRole;
  content: string;
}

export interface AssistantModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AssistantModelGenerateInput {
  messages: AssistantModelMessage[];
  tools?: unknown[];
  temperature?: number;
  signal?: AbortSignal;
}

export interface AssistantModelResult {
  provider: AssistantConfiguredModelProvider;
  model: string;
  content: string;
  usage?: AssistantModelUsage;
  finishReason?: string;
  metadata: Record<string, unknown>;
}

export type AssistantModelFailureKind =
  | 'auth'
  | 'quota'
  | 'timeout'
  | 'network'
  | 'configuration'
  | 'unknown';

export class AssistantModelError extends Error {
  readonly kind: AssistantModelFailureKind;
  readonly provider?: AssistantConfiguredModelProvider;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: {
      kind?: AssistantModelFailureKind;
      provider?: AssistantConfiguredModelProvider;
      retryable?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AssistantModelError';
    this.kind = options.kind ?? 'unknown';
    this.provider = options.provider;
    this.retryable = options.retryable ?? isFallbackEligible(options.kind ?? 'unknown');
  }
}

export type AssistantModelStreamChunk =
  | {
      type: 'text-delta';
      delta: string;
      provider: AssistantConfiguredModelProvider;
      model: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'done';
      provider: AssistantConfiguredModelProvider;
      model: string;
      usage?: AssistantModelUsage;
      finishReason?: string;
      metadata?: Record<string, unknown>;
    };

export interface AssistantModelProvider {
  id: AssistantConfiguredModelProvider;
  model: string;
  configured: boolean;
  generate(input: AssistantModelGenerateInput): Promise<AssistantModelResult>;
  stream(input: AssistantModelGenerateInput): Promise<AsyncIterable<AssistantModelStreamChunk>> | AsyncIterable<AssistantModelStreamChunk>;
  health(input?: AssistantModelHealthRequest): Promise<AssistantModelProviderHealth>;
}

export interface AssistantModelRouterOptions {
  providerTimeoutMs?: number;
}

type EnvLike = Record<string, string | undefined>;

const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;

function nonEmpty(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

function modelName(value: string | null | undefined, fallback: string): string {
  return nonEmpty(value) ?? fallback;
}

function hasConfiguredLocalModel(config: Pick<AssistantResolvedModelConfig, 'localBaseUrl' | 'localModel'>): boolean {
  return Boolean(config.localBaseUrl && config.localModel && config.localModel !== ASSISTANT_DEFAULT_MODELS.local);
}

function configuredProviders(config: Pick<AssistantResolvedModelConfig, 'localBaseUrl' | 'localModel' | 'googleApiKey' | 'nvidiaApiKey' | 'provider'>): AssistantConfiguredModelProvider[] {
  const providers: AssistantConfiguredModelProvider[] = [];
  if (hasConfiguredLocalModel(config)) providers.push('local');
  if (config.googleApiKey) providers.push('google');
  if (config.nvidiaApiKey) providers.push('nvidia');
  if (config.provider === 'mock') providers.push('mock');
  return providers;
}

function selectedProvider(config: Pick<AssistantResolvedModelConfig, 'provider' | 'localBaseUrl' | 'localModel' | 'googleApiKey' | 'nvidiaApiKey'>): AssistantConfiguredModelProvider | null {
  if (config.provider === 'mock') return 'mock';
  if (config.provider === 'local') return hasConfiguredLocalModel(config) ? 'local' : null;
  if (config.provider === 'google') return config.googleApiKey ? 'google' : null;
  if (config.provider === 'nvidia') return config.nvidiaApiKey ? 'nvidia' : null;
  if (hasConfiguredLocalModel(config)) return 'local';
  if (config.googleApiKey) return 'google';
  if (config.nvidiaApiKey) return 'nvidia';
  return null;
}

export function normalizeLocalModelBaseUrl(value: string | null | undefined): string | null {
  const next = nonEmpty(value);
  if (!next) return null;
  const trimmed = next.replace(/\/+$/, '');
  if (/\/v1$/i.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

export function localBaseUrlFromEnv(env: EnvLike = process.env): string | null {
  return normalizeLocalModelBaseUrl(
    env[ASSISTANT_MODEL_ENV.localEndpoint]
      ?? env.LMSTUDIO_BASE_URL
      ?? env.LM_STUDIO_BASE_URL
      ?? (env.OLLAMA_HOST ? `${env.OLLAMA_HOST}/v1` : undefined),
  );
}

export function resolveAssistantModelConfig(
  settings: AssistantModelConfigSettings = {},
  env: EnvLike = process.env,
): AssistantResolvedModelConfig {
  const provider = settings.provider === 'google'
    || settings.provider === 'nvidia'
    || settings.provider === 'local'
    || settings.provider === 'mock'
    || settings.provider === 'auto'
    ? settings.provider
    : 'auto';
  const localBaseUrl = normalizeLocalModelBaseUrl(settings.localBaseUrl) ?? localBaseUrlFromEnv(env);
  const config: AssistantResolvedModelConfig = {
    provider,
    localModel: modelName(settings.localModel ?? env[ASSISTANT_MODEL_ENV.localModel], ASSISTANT_DEFAULT_MODELS.local),
    localBaseUrl,
    localApiKey: nonEmpty(env[ASSISTANT_MODEL_ENV.localApiKey]) ?? nonEmpty(settings.localApiKey) ?? 'local',
    googleModel: modelName(settings.googleModel, ASSISTANT_DEFAULT_MODELS.google),
    nvidiaModel: modelName(settings.nvidiaModel, ASSISTANT_DEFAULT_MODELS.nvidia),
    mockModel: modelName(settings.mockModel, ASSISTANT_DEFAULT_MODELS.mock),
    googleApiKey: nonEmpty(env[ASSISTANT_MODEL_ENV.googleApiKey]) ?? nonEmpty(settings.googleApiKey),
    nvidiaApiKey: nonEmpty(env[ASSISTANT_MODEL_ENV.nvidiaApiKey]) ?? nonEmpty(settings.nvidiaApiKey),
    selectedModelId: null,
    selectedProvider: null,
    configuredProviders: [],
    envKeys: ASSISTANT_MODEL_ENV,
  } satisfies AssistantResolvedModelConfig;
  config.selectedProvider = selectedProvider(config);
  config.configuredProviders = configuredProviders(config);
  config.selectedModelId = config.provider === 'auto'
    ? 'auto/recommended'
    : config.provider === 'local'
      ? hasConfiguredLocalModel(config) ? `local/configured/${config.localModel}` : null
      : config.provider === 'google'
        ? `google/${config.googleModel}`
        : config.provider === 'nvidia'
          ? `nvidia/${config.nvidiaModel}`
          : `mock/${config.mockModel}`;
  return config;
}

export function assistantModelStatusFromConfig(config: AssistantResolvedModelConfig): AssistantModelStatus {
  return {
    provider: config.provider,
    googleModel: config.googleModel,
    nvidiaModel: config.nvidiaModel,
    localModel: config.localModel,
    localBaseUrl: config.localBaseUrl,
    mockModel: config.mockModel,
    selectedModelId: config.selectedModelId,
    selectedProvider: config.selectedProvider,
    configuredProviders: config.configuredProviders,
    hasGoogleKey: Boolean(config.googleApiKey),
    hasNvidiaKey: Boolean(config.nvidiaApiKey),
  };
}

export function redactAssistantModelError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown model error');
  return raw
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted-google-key]')
    .replace(/nvapi-[0-9A-Za-z_-]+/g, '[redacted-nvidia-key]')
    .replace(/Bearer\s+[0-9A-Za-z._-]+/gi, 'Bearer [redacted]')
    .replace(/api[_ -]?key\s*[:=]\s*[^,\s]+/gi, 'api key=[redacted]');
}

export function classifyAssistantModelError(
  error: unknown,
  provider?: AssistantConfiguredModelProvider,
): AssistantModelError {
  if (error instanceof AssistantModelError) return error;
  const message = redactAssistantModelError(error);
  const lower = message.toLowerCase();
  let kind: AssistantModelFailureKind = 'unknown';
  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429')) kind = 'quota';
  else if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('api key') || lower.includes('401') || lower.includes('403')) kind = 'auth';
  else if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('abort')) kind = 'timeout';
  else if (lower.includes('network') || lower.includes('fetch') || lower.includes('enotfound') || lower.includes('econnreset')) kind = 'network';
  return new AssistantModelError(message, { kind, provider, cause: error });
}

export function isFallbackEligible(kind: AssistantModelFailureKind): boolean {
  return kind === 'auth'
    || kind === 'quota'
    || kind === 'timeout'
    || kind === 'network'
    || kind === 'configuration'
    || kind === 'unknown';
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function health(
  provider: AssistantConfiguredModelProvider,
  model: string,
  state: AssistantModelHealthState,
  configured: boolean,
  now: () => Date,
  message?: string,
): AssistantModelProviderHealth {
  return {
    provider,
    model,
    state,
    configured,
    checkedAt: nowIso(now),
    ...(message ? { message } : {}),
  };
}

function normalizeUsage(usage: unknown): AssistantModelUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const value = usage as Record<string, unknown>;
  const inputTokens = typeof value.inputTokens === 'number'
    ? value.inputTokens
    : typeof value.promptTokens === 'number'
      ? value.promptTokens
      : undefined;
  const outputTokens = typeof value.outputTokens === 'number'
    ? value.outputTokens
    : typeof value.completionTokens === 'number'
      ? value.completionTokens
      : undefined;
  const totalTokens = typeof value.totalTokens === 'number'
    ? value.totalTokens
    : inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined;
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) return undefined;
  return { inputTokens, outputTokens, totalTokens };
}

function aiSdkMessages(messages: AssistantModelMessage[]): { role: AssistantRole; content: string }[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export function createMockAssistantModelProvider(options: {
  model?: string;
  content?: string;
  failWith?: unknown;
  now?: () => Date;
} = {}): AssistantModelProvider {
  const model = options.model ?? ASSISTANT_DEFAULT_MODELS.mock;
  const now = options.now ?? (() => new Date());
  const makeContent = (input: AssistantModelGenerateInput): string => {
    if (options.content) return options.content;
    const lastUser = [...input.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
    return `Mock assistant (${model}): ${lastUser}`;
  };
  return {
    id: 'mock',
    model,
    configured: true,
    async generate(input) {
      if (options.failWith) throw classifyAssistantModelError(options.failWith, 'mock');
      const content = makeContent(input);
      return {
        provider: 'mock',
        model,
        content,
        usage: {
          inputTokens: input.messages.length,
          outputTokens: content.split(/\s+/).filter(Boolean).length,
        },
        metadata: { deterministic: true },
      };
    },
    async stream(input) {
      if (options.failWith) throw classifyAssistantModelError(options.failWith, 'mock');
      const content = makeContent(input);
      return (async function* streamMock(): AsyncGenerator<AssistantModelStreamChunk> {
        yield { type: 'text-delta', delta: content, provider: 'mock', model, metadata: { deterministic: true } };
        yield {
          type: 'done',
          provider: 'mock',
          model,
          usage: {
            inputTokens: input.messages.length,
            outputTokens: content.split(/\s+/).filter(Boolean).length,
          },
          finishReason: 'stop',
          metadata: { deterministic: true },
        };
      })();
    },
    async health(input) {
      if (input?.probeLive && options.failWith) {
        const err = classifyAssistantModelError(options.failWith, 'mock');
        return health('mock', model, err.kind === 'quota' ? 'quota' : 'error', true, now, err.message);
      }
      return health('mock', model, 'ok', true, now);
    },
  };
}

interface AiSdkModule {
  generateText(input: Record<string, unknown>): Promise<{ text?: string; usage?: unknown; finishReason?: string }>;
  streamText(input: Record<string, unknown>): Promise<{ textStream?: AsyncIterable<string>; usage?: unknown; finishReason?: string }> | { textStream?: AsyncIterable<string>; usage?: unknown; finishReason?: string };
}

type ModelFactory = (modelName: string, options: { apiKey: string; baseURL?: string }) => unknown;

interface ProviderOptions {
  apiKey?: string | null;
  model?: string;
  now?: () => Date;
  loadAiSdk?: () => Promise<AiSdkModule>;
  createModel?: ModelFactory;
  loadModelFactory?: () => Promise<ModelFactory>;
}

const loadAiSdk = async (): Promise<AiSdkModule> => {
  const sdk = await import('ai');
  return sdk as unknown as AiSdkModule;
};

async function resolveModelFactory(options: Pick<ProviderOptions, 'createModel' | 'loadModelFactory'>): Promise<ModelFactory> {
  if (options.createModel) return options.createModel;
  if (options.loadModelFactory) return options.loadModelFactory();
  throw new Error('Model factory was not configured.');
}

function baseGenerateInput(input: AssistantModelGenerateInput, model: unknown): Record<string, unknown> {
  return {
    model,
    messages: aiSdkMessages(input.messages),
    ...(input.tools ? { tools: input.tools } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    ...(input.signal ? { abortSignal: input.signal } : {}),
  };
}

async function* textStreamToChunks(
  stream: AsyncIterable<string> | undefined,
  provider: AssistantConfiguredModelProvider,
  model: string,
  usage?: unknown,
  finishReason?: string,
): AsyncGenerator<AssistantModelStreamChunk> {
  if (!stream) return;
  for await (const delta of stream) {
    if (delta) yield { type: 'text-delta', delta, provider, model };
  }
  yield {
    type: 'done',
    provider,
    model,
    usage: normalizeUsage(await Promise.resolve(usage)),
    finishReason,
  };
}

export function createGoogleAssistantProvider(options: ProviderOptions = {}): AssistantModelProvider {
  const model = options.model ?? ASSISTANT_DEFAULT_MODELS.google;
  const apiKey = nonEmpty(options.apiKey);
  const now = options.now ?? (() => new Date());
  const load = options.loadAiSdk ?? loadAiSdk;
  const loadModelFactory = options.loadModelFactory ?? (async () => {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const google = createGoogleGenerativeAI({ apiKey: apiKey ?? '' });
    return (modelName: string) => google(modelName);
  });

  async function sdkModel(): Promise<unknown> {
    if (!apiKey) throw new AssistantModelError('Google API key is missing.', { kind: 'configuration', provider: 'google' });
    const factory = await resolveModelFactory({ createModel: options.createModel, loadModelFactory });
    return factory(model, { apiKey });
  }

  return {
    id: 'google',
    model,
    configured: Boolean(apiKey),
    async generate(input) {
      const sdk = await load();
      try {
        const result = await sdk.generateText(baseGenerateInput(input, await sdkModel()));
        return {
          provider: 'google',
          model,
          content: result.text ?? '',
          usage: normalizeUsage(result.usage),
          finishReason: result.finishReason,
          metadata: { provider: 'google' },
        };
      } catch (error) {
        throw classifyAssistantModelError(error, 'google');
      }
    },
    async stream(input) {
      const sdk = await load();
      try {
        const result = await sdk.streamText(baseGenerateInput(input, await sdkModel()));
        return textStreamToChunks(result.textStream, 'google', model, result.usage, result.finishReason);
      } catch (error) {
        throw classifyAssistantModelError(error, 'google');
      }
    },
    async health(input) {
      if (!apiKey) return health('google', model, 'missing_auth', false, now, 'Google API key is missing.');
      if (!input?.probeLive) return health('google', model, 'ok', true, now);
      try {
        await this.generate({ messages: [{ role: 'user', content: 'health check' }] });
        return health('google', model, 'ok', true, now);
      } catch (error) {
        const err = classifyAssistantModelError(error, 'google');
        return health('google', model, err.kind === 'quota' ? 'quota' : err.kind === 'network' || err.kind === 'timeout' ? 'offline' : 'error', true, now, err.message);
      }
    },
  };
}

export function createNvidiaAssistantProvider(options: ProviderOptions & { baseURL?: string } = {}): AssistantModelProvider {
  const model = options.model ?? ASSISTANT_DEFAULT_MODELS.nvidia;
  const apiKey = nonEmpty(options.apiKey);
  const baseURL = options.baseURL ?? NVIDIA_NIM_BASE_URL;
  const now = options.now ?? (() => new Date());
  const load = options.loadAiSdk ?? loadAiSdk;
  const loadModelFactory = options.loadModelFactory ?? (async () => {
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
    const nim = createOpenAICompatible({
      name: 'nvidia-nim',
      apiKey: apiKey ?? '',
      baseURL,
    });
    return (modelName: string) => nim(modelName);
  });

  async function sdkModel(): Promise<unknown> {
    if (!apiKey) throw new AssistantModelError('NVIDIA API key is missing.', { kind: 'configuration', provider: 'nvidia' });
    const factory = await resolveModelFactory({ createModel: options.createModel, loadModelFactory });
    return factory(model, { apiKey, baseURL });
  }

  return {
    id: 'nvidia',
    model,
    configured: Boolean(apiKey),
    async generate(input) {
      const sdk = await load();
      try {
        const result = await sdk.generateText(baseGenerateInput(input, await sdkModel()));
        return {
          provider: 'nvidia',
          model,
          content: result.text ?? '',
          usage: normalizeUsage(result.usage),
          finishReason: result.finishReason,
          metadata: { provider: 'nvidia', baseURL },
        };
      } catch (error) {
        throw classifyAssistantModelError(error, 'nvidia');
      }
    },
    async stream(input) {
      const sdk = await load();
      try {
        const result = await sdk.streamText(baseGenerateInput(input, await sdkModel()));
        return textStreamToChunks(result.textStream, 'nvidia', model, result.usage, result.finishReason);
      } catch (error) {
        throw classifyAssistantModelError(error, 'nvidia');
      }
    },
    async health(input) {
      if (!apiKey) return health('nvidia', model, 'missing_auth', false, now, 'NVIDIA API key is missing.');
      if (!input?.probeLive) return health('nvidia', model, 'ok', true, now);
      try {
        await this.generate({ messages: [{ role: 'user', content: 'health check' }] });
        return health('nvidia', model, 'ok', true, now);
      } catch (error) {
        const err = classifyAssistantModelError(error, 'nvidia');
        return health('nvidia', model, err.kind === 'quota' ? 'quota' : err.kind === 'network' || err.kind === 'timeout' ? 'offline' : 'error', true, now, err.message);
      }
    },
  };
}

export function createLocalAssistantProvider(options: ProviderOptions & { baseURL?: string } = {}): AssistantModelProvider {
  const model = options.model ?? ASSISTANT_DEFAULT_MODELS.local;
  const apiKey = nonEmpty(options.apiKey) ?? 'local';
  const baseURL = normalizeLocalModelBaseUrl(options.baseURL) ?? localBaseUrlFromEnv() ?? '';
  const now = options.now ?? (() => new Date());
  const load = options.loadAiSdk ?? loadAiSdk;
  const loadModelFactory = options.loadModelFactory ?? (async () => {
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
    const local = createOpenAICompatible({
      name: 'local-openai-compatible',
      apiKey,
      baseURL,
    });
    return (modelName: string) => local(modelName);
  });

  async function sdkModel(): Promise<unknown> {
    if (!baseURL) throw new AssistantModelError('Local model endpoint is missing.', { kind: 'configuration', provider: 'local' });
    if (!model || model === ASSISTANT_DEFAULT_MODELS.local) throw new AssistantModelError('Local model id is missing.', { kind: 'configuration', provider: 'local' });
    const factory = await resolveModelFactory({ createModel: options.createModel, loadModelFactory });
    return factory(model, { apiKey, baseURL });
  }

  return {
    id: 'local',
    model,
    configured: Boolean(baseURL && model && model !== ASSISTANT_DEFAULT_MODELS.local),
    async generate(input) {
      const sdk = await load();
      try {
        const result = await sdk.generateText(baseGenerateInput(input, await sdkModel()));
        return {
          provider: 'local',
          model,
          content: result.text ?? '',
          usage: normalizeUsage(result.usage),
          finishReason: result.finishReason,
          metadata: { provider: 'local', baseURL },
        };
      } catch (error) {
        throw classifyAssistantModelError(error, 'local');
      }
    },
    async stream(input) {
      const sdk = await load();
      try {
        const result = await sdk.streamText(baseGenerateInput(input, await sdkModel()));
        return textStreamToChunks(result.textStream, 'local', model, result.usage, result.finishReason);
      } catch (error) {
        throw classifyAssistantModelError(error, 'local');
      }
    },
    async health(input) {
      if (!baseURL || !model || model === ASSISTANT_DEFAULT_MODELS.local) {
        return health('local', model, 'not_configured', false, now, 'Local model endpoint or model id is missing.');
      }
      if (!input?.probeLive) return health('local', model, 'ok', true, now);
      try {
        await this.generate({ messages: [{ role: 'user', content: 'health check' }] });
        return health('local', model, 'ok', true, now);
      } catch (error) {
        const err = classifyAssistantModelError(error, 'local');
        return health('local', model, err.kind === 'network' || err.kind === 'timeout' ? 'offline' : 'error', true, now, err.message);
      }
    },
  };
}

export function createAssistantModelProviders(config: AssistantResolvedModelConfig): AssistantModelProvider[] {
  return [
    createLocalAssistantProvider({ apiKey: config.localApiKey, model: config.localModel, baseURL: config.localBaseUrl ?? undefined }),
    createGoogleAssistantProvider({ apiKey: config.googleApiKey, model: config.googleModel }),
    createNvidiaAssistantProvider({ apiKey: config.nvidiaApiKey, model: config.nvidiaModel }),
    createMockAssistantModelProvider({ model: config.mockModel }),
  ];
}

function providerOrder(provider: AssistantModelProviderName): AssistantConfiguredModelProvider[] {
  if (provider === 'local') return ['local', 'google', 'nvidia'];
  if (provider === 'google') return ['google', 'nvidia'];
  if (provider === 'nvidia') return ['nvidia', 'google'];
  if (provider === 'mock') return ['mock'];
  return ['local', 'google', 'nvidia'];
}

function providerTimeoutMessage(provider: AssistantConfiguredModelProvider, timeoutMs: number): string {
  return `${provider} assistant model provider timed out after ${timeoutMs}ms.`;
}

async function withProviderDeadline<T>(
  input: {
    provider: AssistantConfiguredModelProvider;
    timeoutMs: number;
    externalSignal?: AbortSignal;
    retryableOnTimeout: boolean;
  },
  run: (signal?: AbortSignal) => Promise<T>,
): Promise<T> {
  const timeoutMs = Math.max(0, Math.floor(input.timeoutMs));
  if (input.externalSignal?.aborted) {
    throw new AssistantModelError('Assistant model request was cancelled.', {
      kind: 'timeout',
      provider: input.provider,
      retryable: false,
    });
  }
  if (timeoutMs === 0) return run(input.externalSignal);

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let abortListener: (() => void) | null = null;

  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new AssistantModelError(providerTimeoutMessage(input.provider, timeoutMs), {
        kind: 'timeout',
        provider: input.provider,
        retryable: input.retryableOnTimeout,
      }));
    }, timeoutMs);
  });

  const cancellationPromise = new Promise<T>((_resolve, reject) => {
    if (!input.externalSignal) return;
    abortListener = () => {
      controller.abort();
      reject(new AssistantModelError('Assistant model request was cancelled.', {
        kind: 'timeout',
        provider: input.provider,
        retryable: false,
      }));
    };
    input.externalSignal.addEventListener('abort', abortListener, { once: true });
  });

  try {
    return await Promise.race([
      run(controller.signal),
      timeoutPromise,
      cancellationPromise,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (abortListener && input.externalSignal) {
      input.externalSignal.removeEventListener('abort', abortListener);
    }
  }
}

export class AssistantModelRouter {
  private readonly providerMap: Map<AssistantConfiguredModelProvider, AssistantModelProvider>;
  private readonly order: AssistantConfiguredModelProvider[];
  private readonly providerTimeoutMs: number;

  constructor(
    readonly config: AssistantResolvedModelConfig,
    providers: AssistantModelProvider[],
    options: AssistantModelRouterOptions = {},
  ) {
    this.providerMap = new Map(providers.map((provider) => [provider.id, provider]));
    this.order = providerOrder(config.provider).filter((provider) => this.providerMap.get(provider)?.configured);
    this.providerTimeoutMs = options.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  isConfigured(): boolean {
    return this.order.length > 0;
  }

  async generate(input: AssistantModelGenerateInput): Promise<AssistantModelResult> {
    const attempts: { provider: AssistantConfiguredModelProvider; status: 'failed'; kind: AssistantModelFailureKind }[] = [];
    let lastError: AssistantModelError | null = null;
    for (const providerId of this.order) {
      const provider = this.providerMap.get(providerId);
      if (!provider) continue;
      try {
        const result = await withProviderDeadline(
          {
            provider: providerId,
            timeoutMs: this.providerTimeoutMs,
            externalSignal: input.signal,
            retryableOnTimeout: true,
          },
          (signal) => provider.generate({ ...input, signal }),
        );
        return {
          ...result,
          metadata: {
            ...result.metadata,
            fallback: attempts.length > 0,
            primaryProvider: this.order[0] ?? null,
            finalProvider: result.provider,
            attempts,
          },
        };
      } catch (error) {
        const err = classifyAssistantModelError(error, providerId);
        attempts.push({ provider: providerId, status: 'failed', kind: err.kind });
        lastError = err;
        if (!err.retryable) break;
      }
    }
    throw lastError ?? new AssistantModelError('No assistant model provider is configured.', { kind: 'configuration' });
  }

  async stream(input: AssistantModelGenerateInput): Promise<AsyncIterable<AssistantModelStreamChunk>> {
    const attempts: { provider: AssistantConfiguredModelProvider; status: 'failed'; kind: AssistantModelFailureKind }[] = [];
    let lastError: AssistantModelError | null = null;
    const order = this.order;
    const providerMap = this.providerMap;
    const providerTimeoutMs = this.providerTimeoutMs;
    return (async function* streamWithFallback(): AsyncGenerator<AssistantModelStreamChunk> {
      for (const providerId of order) {
        const provider = providerMap.get(providerId);
        if (!provider) continue;
        let yieldedFromProvider = false;
        try {
          const stream = await withProviderDeadline(
            {
              provider: providerId,
              timeoutMs: providerTimeoutMs,
              externalSignal: input.signal,
              retryableOnTimeout: true,
            },
            (signal) => Promise.resolve(provider.stream({ ...input, signal })),
          );
          const iterator = stream[Symbol.asyncIterator]();
          while (true) {
            const next = await withProviderDeadline(
              {
                provider: providerId,
                timeoutMs: providerTimeoutMs,
                externalSignal: input.signal,
                retryableOnTimeout: !yieldedFromProvider,
              },
              () => iterator.next(),
            );
            if (next.done) break;
            yieldedFromProvider = true;
            const chunk = next.value;
            yield {
              ...chunk,
              metadata: {
                ...chunk.metadata,
                fallback: attempts.length > 0,
                primaryProvider: order[0] ?? null,
                finalProvider: providerId,
                attempts,
              },
            };
          }
          return;
        } catch (error) {
          const err = classifyAssistantModelError(error, providerId);
          attempts.push({ provider: providerId, status: 'failed', kind: err.kind });
          lastError = err;
          if (!err.retryable) break;
        }
      }
      throw lastError ?? new AssistantModelError('No assistant model provider is configured.', { kind: 'configuration' });
    })();
  }
}

export async function assistantModelHealth(
  config: AssistantResolvedModelConfig,
  providers: AssistantModelProvider[],
  input: AssistantModelHealthRequest = {},
  now: () => Date = () => new Date(),
): Promise<AssistantModelHealthResult> {
  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
  const requestedProvider = input.provider ?? config.provider;
  const ids = requestedProvider === 'mock'
    ? ['mock']
    : requestedProvider === 'local'
      ? ['local', 'google', 'nvidia']
    : requestedProvider === 'google'
      ? ['google', 'nvidia']
      : requestedProvider === 'nvidia'
        ? ['nvidia', 'google']
        : ['local', 'google', 'nvidia'];
  const checks = await Promise.all(ids.map(async (id): Promise<AssistantModelProviderHealth> => {
    const providerId = id as AssistantConfiguredModelProvider;
    const provider = providerMap.get(providerId);
    if (!provider) return health(providerId, ASSISTANT_DEFAULT_MODELS[providerId], 'not_configured', false, now);
    return provider.health({ ...input, provider: providerId });
  }));
  const selected = requestedProvider === 'mock'
    ? 'mock'
    : requestedProvider === 'local' && hasConfiguredLocalModel(config)
      ? 'local'
    : requestedProvider === 'google' && config.googleApiKey
      ? 'google'
      : requestedProvider === 'nvidia' && config.nvidiaApiKey
        ? 'nvidia'
        : config.selectedProvider;
  return {
    ok: selected ? checks.some((check) => check.provider === selected && check.state === 'ok') : false,
    provider: requestedProvider,
    selectedProvider: selected,
    providers: checks,
    checkedAt: nowIso(now),
  };
}
