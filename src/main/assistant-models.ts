import type {
  AssistantConfiguredModelProvider,
  AssistantModelHealthRequest,
  AssistantModelHealthResult,
  AssistantModelHealthState,
  AssistantModelProvider as AssistantModelProviderName,
  AssistantModelProviderHealth,
  AssistantModelStatus,
} from '../shared/native-assistant.js';
import { jsonSchema } from 'ai';
import {
  ASSISTANT_RECOMMENDED_LANE,
  normalizeAssistantLaneId,
  normalizeAssistantModelProvider,
  type AssistantRole,
} from '../shared/native-assistant.js';

export const ASSISTANT_MODEL_ENV = {
  relayOrigin: 'PLEXUS_OMNIROUTE_RELAY_ORIGIN',
  relayDevelopmentOrigin: 'PLEXUS_OMNIROUTE_RELAY_DEV_ORIGIN',
} as const;

export const ASSISTANT_DEFAULT_MODELS = {
  lane: ASSISTANT_RECOMMENDED_LANE,
  local: 'local-auto',
  google: 'gemini-2.0-flash',
  nvidia: 'meta/llama-3.1-70b-instruct',
  mock: 'mock-deterministic',
} as const;

export const NVIDIA_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export interface AssistantModelConfigSettings {
  provider?: AssistantModelProviderName | null;
  laneId?: string | null;
  // Read-only compatibility inputs. They are ignored by governed routing and
  // retained only so one migration can consume old persisted settings.
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
  laneId: string;
  mockModel: string;
  selectedModelId: string | null;
  selectedProvider: AssistantConfiguredModelProvider | null;
  configuredProviders: AssistantConfiguredModelProvider[];
  envKeys: typeof ASSISTANT_MODEL_ENV;
}

export interface AssistantModelMessage {
  role: AssistantRole;
  content: string;
  toolCallId?: string;
  toolId?: string;
  toolCalls?: Array<{
    callId: string;
    toolId: string;
    payload: Record<string, unknown>;
  }>;
}

export interface AssistantModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AssistantModelGenerateInput {
  messages: AssistantModelMessage[];
  tools?: unknown;
  maxToolSteps?: number;
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
      type: 'tool-call';
      callId?: string;
      toolId?: string;
      payload?: unknown;
      toolCallId?: string;
      toolName?: string;
      input?: unknown;
      provider: AssistantConfiguredModelProvider;
      model: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'tool-result';
      toolCallId: string;
      toolName: string;
      input?: unknown;
      output: unknown;
      provider: AssistantConfiguredModelProvider;
      model: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'tool-error';
      toolCallId: string;
      toolName: string;
      error: unknown;
      provider: AssistantConfiguredModelProvider;
      model: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'error';
      message: string;
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

export function normalizeLocalModelBaseUrl(value: string | null | undefined): string | null {
  const next = nonEmpty(value);
  if (!next) return null;
  const trimmed = next.replace(/\/+$/, '');
  if (/\/v1$/i.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

export function localBaseUrlFromEnv(env: EnvLike = process.env): string | null {
  return normalizeLocalModelBaseUrl(
    env.LOCAL_ENDPOINT
      ?? env.LMSTUDIO_BASE_URL
      ?? env.LM_STUDIO_BASE_URL
      ?? (env.OLLAMA_HOST ? `${env.OLLAMA_HOST}/v1` : undefined),
  );
}

export function resolveAssistantModelConfig(
  settings: AssistantModelConfigSettings = {},
  _env: EnvLike = process.env,
): AssistantResolvedModelConfig {
  const provider = normalizeAssistantModelProvider(settings.provider);
  const laneId = normalizeAssistantLaneId(settings.laneId);
  const config: AssistantResolvedModelConfig = {
    provider,
    laneId,
    mockModel: modelName(settings.mockModel, ASSISTANT_DEFAULT_MODELS.mock),
    selectedModelId: provider === 'mock' ? `mock/${modelName(settings.mockModel, ASSISTANT_DEFAULT_MODELS.mock)}` : laneId,
    selectedProvider: provider === 'mock' ? 'mock' : 'omniroute',
    configuredProviders: provider === 'mock' ? ['mock'] : ['omniroute'],
    envKeys: ASSISTANT_MODEL_ENV,
  } satisfies AssistantResolvedModelConfig;
  return config;
}

export function assistantModelStatusFromConfig(config: AssistantResolvedModelConfig): AssistantModelStatus {
  return {
    provider: config.provider,
    laneId: config.laneId,
    mockModel: config.mockModel,
    selectedModelId: config.selectedModelId,
    selectedProvider: config.selectedProvider,
    configuredProviders: config.configuredProviders,
    gatewayState: config.provider === 'mock' ? 'ready' : 'offline',
    message: config.provider === 'mock'
      ? 'Deterministic mock is explicitly selected.'
      : 'OmniRoute gateway status is checked through the authenticated catalog.',
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

function jsonValue(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return { status: 'invalid_tool_result' };
  }
}

function aiSdkMessages(messages: AssistantModelMessage[]): Record<string, unknown>[] {
  return messages.map((message) => {
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: [
          ...(message.content ? [{ type: 'text', text: message.content }] : []),
          ...message.toolCalls.map((call) => ({
            type: 'tool-call',
            toolCallId: call.callId,
            toolName: call.toolId,
            input: call.payload,
          })),
        ],
      };
    }
    if (message.role === 'tool' && message.toolCallId && message.toolId) {
      return {
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: message.toolCallId,
          toolName: message.toolId,
          output: { type: 'json', value: jsonValue(message.content) },
        }],
      };
    }
    return { role: message.role, content: message.content };
  });
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

interface AiSdkStreamPart {
  type?: string;
  text?: string;
  delta?: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  args?: unknown;
  output?: unknown;
  usage?: unknown;
  finishReason?: string;
  error?: unknown;
  totalUsage?: unknown;
  response?: unknown;
}

export interface AiSdkStreamResult {
  stream?: AsyncIterable<unknown>;
  textStream?: AsyncIterable<string>;
  fullStream?: AsyncIterable<AiSdkStreamPart>;
  usage?: unknown;
  finishReason?: string;
}

export interface AiSdkModule {
  generateText(input: Record<string, unknown>): Promise<{ text?: string; usage?: unknown; finishReason?: string }>;
  streamText(input: Record<string, unknown>): Promise<AiSdkStreamResult> | AiSdkStreamResult;
  stepCountIs?(count: number): unknown;
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

export function baseGenerateInput(input: AssistantModelGenerateInput, model: unknown, sdk?: Pick<AiSdkModule, 'stepCountIs'>): Record<string, unknown> {
  const tools = Array.isArray(input.tools) ? aiSdkTools(input.tools) : input.tools;
  const firstConversationMessage = input.messages.findIndex(({ role }) => role !== 'system');
  if (
    firstConversationMessage >= 0
    && input.messages.slice(firstConversationMessage).some(({ role }) => role === 'system')
  ) {
    throw new Error('Assistant system instructions must precede conversation messages.');
  }
  const instructionMessages = firstConversationMessage < 0
    ? input.messages
    : input.messages.slice(0, firstConversationMessage);
  const instructions = instructionMessages
    .filter(({ content }) => content.trim().length > 0)
    .map(({ content }) => content)
    .join('\n\n');
  return {
    model,
    ...(instructions ? { instructions } : {}),
    messages: aiSdkMessages(input.messages.filter(({ role }) => role !== 'system')),
    ...(tools ? { tools } : {}),
    ...(input.maxToolSteps && sdk?.stepCountIs ? { stopWhen: sdk.stepCountIs(input.maxToolSteps) } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    ...(input.signal ? { abortSignal: input.signal } : {}),
  };
}

function aiSdkTools(tools: unknown[]): Record<string, unknown> {
  return Object.fromEntries(tools.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const schema = candidate as Record<string, unknown>;
    if (typeof schema.id !== 'string' || !schema.parameters || typeof schema.parameters !== 'object') return [];
    return [[schema.id, {
      ...(typeof schema.description === 'string' ? { description: schema.description } : {}),
      inputSchema: jsonSchema(schema.parameters as Parameters<typeof jsonSchema>[0]),
    }]];
  }));
}

async function* textStreamToChunks(
  stream: AsyncIterable<unknown> | undefined,
  provider: AssistantConfiguredModelProvider,
  model: string,
  usage?: unknown,
  finishReason?: string,
): AsyncGenerator<AssistantModelStreamChunk> {
  if (!stream) return;
  let finished = false;
  for await (const delta of stream) {
    if (typeof delta === 'string') {
      if (delta) yield { type: 'text-delta', delta, provider, model };
      continue;
    }
    if (!delta || typeof delta !== 'object') continue;
    const part = delta as Record<string, unknown>;
    if (part.type === 'text-delta' && typeof part.text === 'string') {
      if (part.text) yield { type: 'text-delta', delta: part.text, provider, model };
    } else if (part.type === 'tool-call' && typeof part.toolCallId === 'string' && typeof part.toolName === 'string') {
      yield { type: 'tool-call', toolCallId: part.toolCallId, toolName: part.toolName, input: part.input, provider, model };
    } else if (part.type === 'tool-result' && typeof part.toolCallId === 'string' && typeof part.toolName === 'string') {
      yield { type: 'tool-result', toolCallId: part.toolCallId, toolName: part.toolName, input: part.input, output: part.output, provider, model };
    } else if (part.type === 'tool-error' && typeof part.toolCallId === 'string' && typeof part.toolName === 'string') {
      yield { type: 'tool-error', toolCallId: part.toolCallId, toolName: part.toolName, error: part.error, provider, model };
    } else if (part.type === 'error') {
      yield { type: 'error', message: redactAssistantModelError(part.error), provider, model };
    } else if (part.type === 'finish') {
      finished = true;
      yield {
        type: 'done',
        provider,
        model,
        usage: normalizeUsage(part.totalUsage ?? part.usage ?? usage),
        finishReason: typeof part.finishReason === 'string' ? part.finishReason : finishReason,
      };
    }
  }
  if (!finished) {
    yield { type: 'done', provider, model, usage: normalizeUsage(await Promise.resolve(usage)), finishReason };
  }
}

export async function* sdkStreamToChunks(
  result: AiSdkStreamResult,
  provider: AssistantConfiguredModelProvider,
  model: string,
  options: { throwStreamErrors?: boolean } = {},
): AsyncGenerator<AssistantModelStreamChunk> {
  if (!result.fullStream) {
    yield* textStreamToChunks(result.stream ?? result.textStream, provider, model, result.usage, result.finishReason);
    return;
  }
  let emittedDone = false;
  let responseEvidence: Record<string, unknown> | undefined;
  for await (const part of result.fullStream) {
    if (part.type === 'finish-step' && provider === 'omniroute') {
      const response = part.response && typeof part.response === 'object'
        ? part.response as Record<string, unknown>
        : {};
      const headers = response.headers && typeof response.headers === 'object'
        ? response.headers as Record<string, unknown>
        : {};
      const header = (name: string, maxLength: number) => {
        const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
        return typeof entry?.[1] === 'string' && entry[1].length <= maxLength && !/[\r\n]/.test(entry[1])
          ? entry[1]
          : undefined;
      };
      const evidence = {
        responseId: typeof response.id === 'string' && response.id.length <= 128 ? response.id : undefined,
        finalRoute: typeof response.modelId === 'string' && response.modelId.length <= 256 ? response.modelId : undefined,
        requestId: header('x-request-id', 128),
        cfRay: header('cf-ray', 128),
      };
      if (Object.values(evidence).some((value) => value !== undefined)) {
        responseEvidence = { omniRoute: evidence };
      }
      continue;
    }
    if (part.type === 'text-delta') {
      const delta = part.text ?? part.delta;
      if (delta) yield { type: 'text-delta', delta, provider, model };
      continue;
    }
    if (part.type === 'tool-call' && part.toolCallId && part.toolName) {
      yield {
        type: 'tool-call',
        callId: part.toolCallId,
        toolId: part.toolName,
        payload: part.input ?? part.args,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input ?? part.args,
        provider,
        model,
      };
      continue;
    }
    if (part.type === 'tool-result' && part.toolCallId && part.toolName) {
      yield { type: 'tool-result', toolCallId: part.toolCallId, toolName: part.toolName, input: part.input, output: part.output, provider, model };
      continue;
    }
    if (part.type === 'tool-error' && part.toolCallId && part.toolName) {
      yield { type: 'tool-error', toolCallId: part.toolCallId, toolName: part.toolName, error: part.error, provider, model };
      continue;
    }
    if (part.type === 'error') {
      if (options.throwStreamErrors) throw part.error;
      yield { type: 'error', message: redactAssistantModelError(part.error), provider, model };
      continue;
    }
    if (part.type === 'finish') {
      emittedDone = true;
      yield {
        type: 'done',
        provider,
        model,
        usage: normalizeUsage(part.usage ?? await Promise.resolve(result.usage)),
        finishReason: part.finishReason ?? await Promise.resolve(result.finishReason),
        ...(responseEvidence ? { metadata: responseEvidence } : {}),
      };
    }
  }
  if (!emittedDone) {
    yield {
      type: 'done',
      provider,
      model,
      usage: normalizeUsage(await Promise.resolve(result.usage)),
      finishReason: await Promise.resolve(result.finishReason),
      ...(responseEvidence ? { metadata: responseEvidence } : {}),
    };
  }
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
        const result = await sdk.generateText(baseGenerateInput(input, await sdkModel(), sdk));
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
        const result = await sdk.streamText(baseGenerateInput(input, await sdkModel(), sdk));
        return sdkStreamToChunks(result, 'google', model);
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
        const result = await sdk.generateText(baseGenerateInput(input, await sdkModel(), sdk));
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
        const result = await sdk.streamText(baseGenerateInput(input, await sdkModel(), sdk));
        return sdkStreamToChunks(result, 'nvidia', model);
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
        const result = await sdk.generateText(baseGenerateInput(input, await sdkModel(), sdk));
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
        const result = await sdk.streamText(baseGenerateInput(input, await sdkModel(), sdk));
        return sdkStreamToChunks(result, 'local', model);
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

export function createAssistantModelProviders(
  config: AssistantResolvedModelConfig,
  options: { omniRouteProvider?: AssistantModelProvider } = {},
): AssistantModelProvider[] {
  if (config.provider === 'mock') {
    return [createMockAssistantModelProvider({ model: config.mockModel })];
  }
  return options.omniRouteProvider ? [options.omniRouteProvider] : [];
}

function providerOrder(provider: AssistantModelProviderName): AssistantConfiguredModelProvider[] {
  if (provider === 'mock') return ['mock'];
  return ['omniroute'];
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
  const ids: AssistantConfiguredModelProvider[] = requestedProvider === 'mock' ? ['mock'] : ['omniroute'];
  const checks = await Promise.all(ids.map(async (id): Promise<AssistantModelProviderHealth> => {
    const providerId = id;
    const provider = providerMap.get(providerId);
    if (!provider) {
      return health(
        providerId,
        providerId === 'mock' ? ASSISTANT_DEFAULT_MODELS.mock : config.laneId,
        'not_configured',
        false,
        now,
      );
    }
    return provider.health({ ...input, provider: providerId as AssistantModelProviderName });
  }));
  const selected = requestedProvider === 'mock' ? 'mock' : 'omniroute';
  return {
    ok: selected ? checks.some((check) => check.provider === selected && check.state === 'ok') : false,
    provider: requestedProvider,
    selectedProvider: selected,
    providers: checks,
    checkedAt: nowIso(now),
  };
}
