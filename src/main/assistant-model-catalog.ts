import type {
  AssistantModelCatalog,
  AssistantModelCatalogEntry,
  AssistantModelCatalogState,
  AssistantModelProvider,
} from '../shared/native-assistant.js';
import {
  ASSISTANT_DEFAULT_MODELS,
  type AssistantResolvedModelConfig,
  localBaseUrlFromEnv,
  normalizeLocalModelBaseUrl,
} from './assistant-models.js';

type EnvLike = Record<string, string | undefined>;
type FetchLike = (input: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

interface LocalEndpointCandidate {
  id: string;
  label: string;
  baseUrl: string;
  source: string;
}

export interface AssistantModelCatalogOptions {
  env?: EnvLike;
  fetch?: FetchLike;
  now?: () => Date;
  timeoutMs?: number;
}

const LOCAL_MODEL_DEFAULTS: LocalEndpointCandidate[] = [
  { id: 'lmstudio', label: 'LM Studio', baseUrl: 'http://127.0.0.1:1234/v1', source: 'default_lmstudio' },
  { id: 'ollama', label: 'Ollama', baseUrl: 'http://127.0.0.1:11434/v1', source: 'default_ollama' },
];

function idPart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 96) || 'model';
}

function modelId(provider: AssistantModelProvider, model: string): string {
  return `${provider}/${model}`;
}

function localModelId(model: string, endpointId = 'local'): string {
  return `local/${endpointId}/${model}`;
}

function cloudCapabilities(provider: 'google' | 'nvidia') {
  return {
    streaming: true,
    toolUse: true,
    reasoning: provider === 'google',
    local: false,
    privacy: 'provider' as const,
  };
}

function localCapabilities() {
  return {
    streaming: true,
    toolUse: false,
    reasoning: false,
    local: true,
    privacy: 'device' as const,
  };
}

function dedupeEndpoints(endpoints: LocalEndpointCandidate[]): LocalEndpointCandidate[] {
  const seen = new Set<string>();
  return endpoints.filter((endpoint) => {
    const normalized = normalizeLocalModelBaseUrl(endpoint.baseUrl);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    endpoint.baseUrl = normalized;
    return true;
  });
}

function localEndpointCandidates(config: AssistantResolvedModelConfig, env: EnvLike): LocalEndpointCandidate[] {
  const envBaseUrl = localBaseUrlFromEnv(env);
  return dedupeEndpoints([
    ...(config.localBaseUrl ? [{ id: 'configured', label: 'Configured local endpoint', baseUrl: config.localBaseUrl, source: 'plexus_settings' }] : []),
    ...(envBaseUrl ? [{ id: 'env', label: 'Local endpoint from environment', baseUrl: envBaseUrl, source: 'process_env' }] : []),
    ...LOCAL_MODEL_DEFAULTS,
  ]);
}

async function listEndpointModels(endpoint: LocalEndpointCandidate, fetchImpl: FetchLike, timeoutMs: number): Promise<{ models: string[]; state: AssistantModelCatalogState; message?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await fetchImpl(`${endpoint.baseUrl}/models`, { signal: controller.signal });
    if (!result.ok) return { models: [], state: 'offline', message: `${endpoint.label} did not return a model list.` };
    const body = await result.json();
    const data = Array.isArray((body as { data?: unknown }).data) ? (body as { data: unknown[] }).data : [];
    const models = data
      .map((item) => typeof item === 'string' ? item : typeof (item as { id?: unknown })?.id === 'string' ? (item as { id: string }).id : '')
      .map((item) => item.trim())
      .filter(Boolean);
    return { models: [...new Set(models)], state: models.length ? 'ready' : 'not_configured' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { models: [], state: 'offline', message };
  } finally {
    clearTimeout(timeout);
  }
}

function addCloudEntries(entries: AssistantModelCatalogEntry[], config: AssistantResolvedModelConfig): void {
  entries.push({
    id: modelId('google', config.googleModel),
    provider: 'google',
    model: config.googleModel,
    label: `Google / ${config.googleModel}`,
    origin: 'cloud',
    source: config.googleApiKey ? 'secure_settings_or_env' : 'not_configured',
    state: config.googleApiKey ? 'ready' : 'missing_auth',
    configured: Boolean(config.googleApiKey),
    selectable: Boolean(config.googleApiKey),
    selected: config.provider === 'google',
    requiresKey: true,
    capabilities: cloudCapabilities('google'),
    message: config.googleApiKey ? undefined : 'Google key is missing.',
  });
  entries.push({
    id: modelId('nvidia', config.nvidiaModel),
    provider: 'nvidia',
    model: config.nvidiaModel,
    label: `NVIDIA / ${config.nvidiaModel}`,
    origin: 'cloud',
    source: config.nvidiaApiKey ? 'secure_settings_or_env' : 'not_configured',
    state: config.nvidiaApiKey ? 'ready' : 'missing_auth',
    configured: Boolean(config.nvidiaApiKey),
    selectable: Boolean(config.nvidiaApiKey),
    selected: config.provider === 'nvidia',
    requiresKey: true,
    capabilities: cloudCapabilities('nvidia'),
    message: config.nvidiaApiKey ? undefined : 'NVIDIA key is missing.',
  });
}

export async function discoverAssistantModelCatalog(
  config: AssistantResolvedModelConfig,
  options: AssistantModelCatalogOptions = {},
): Promise<AssistantModelCatalog> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? 700;
  const entries: AssistantModelCatalogEntry[] = [
    {
      id: 'auto/recommended',
      provider: 'auto',
      model: 'recommended',
      label: 'Auto recommended',
      origin: 'auto',
      source: 'plexus_policy',
      state: 'ready',
      configured: true,
      selectable: true,
      selected: config.provider === 'auto',
      capabilities: {
        streaming: true,
        toolUse: true,
        reasoning: true,
        local: Boolean(config.localBaseUrl),
        privacy: 'routing',
      },
      message: 'Prefer healthy local models, then configured cloud fallbacks.',
    },
  ];

  for (const endpoint of localEndpointCandidates(config, env)) {
    const listed = await listEndpointModels(endpoint, fetchImpl, timeoutMs);
    const models = listed.models.length ? listed.models : endpoint.baseUrl === config.localBaseUrl && config.localModel !== ASSISTANT_DEFAULT_MODELS.local ? [config.localModel] : [];
    if (models.length === 0) {
      entries.push({
        id: `local/${idPart(endpoint.id)}/unavailable`,
        provider: 'local',
        model: ASSISTANT_DEFAULT_MODELS.local,
        label: endpoint.label,
        origin: 'local',
        source: endpoint.source,
        state: listed.state,
        configured: false,
        selectable: false,
        baseUrl: endpoint.baseUrl,
        capabilities: localCapabilities(),
        message: listed.message ?? 'No local models were reported.',
      });
      continue;
    }
    for (const model of models) {
      entries.push({
        id: localModelId(model, idPart(endpoint.id)),
        provider: 'local',
        model,
        label: `${endpoint.label} / ${model}`,
        origin: 'local',
        source: endpoint.source,
        state: listed.state,
        configured: true,
        selectable: true,
        selected: config.provider === 'local' && config.localBaseUrl === endpoint.baseUrl && config.localModel === model,
        baseUrl: endpoint.baseUrl,
        capabilities: localCapabilities(),
        message: listed.state === 'ready' ? 'Detected from local OpenAI-compatible model endpoint.' : listed.message,
      });
    }
  }

  addCloudEntries(entries, config);
  entries.push({
    id: modelId('mock', config.mockModel),
    provider: 'mock',
    model: config.mockModel,
    label: `Mock / ${config.mockModel}`,
    origin: 'deterministic',
    source: 'built_in',
    state: 'fallback_only',
    configured: true,
    selectable: true,
    selected: config.provider === 'mock',
    capabilities: {
      streaming: true,
      toolUse: false,
      reasoning: false,
      local: true,
      privacy: 'deterministic',
    },
    message: 'Deterministic fallback for tests and offline UI checks.',
  });

  const recommended = entries.find((entry) => entry.selected && entry.selectable)
    ?? entries.find((entry) => entry.id === 'auto/recommended')
    ?? entries.find((entry) => entry.selectable)
    ?? entries[0];
  return {
    selectedModelId: recommended?.id ?? null,
    recommendedModelId: 'auto/recommended',
    fallbackModelIds: entries.filter((entry) => entry.selectable && entry.id !== recommended?.id).map((entry) => entry.id),
    entries,
    generatedAt: now().toISOString(),
  };
}
