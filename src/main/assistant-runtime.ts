import { randomUUID } from 'node:crypto';
import { jsonSchema } from 'ai';
import {
  ASSISTANT_ADMIN_ONLY_TOOLS,
  ASSISTANT_CAPABILITY_CATALOG_SCHEMA,
  ASSISTANT_CONFIRM_REQUIRED_TOOLS,
  ASSISTANT_EVENT_SCHEMA,
  ASSISTANT_READ_ONLY_TOOLS,
  type AssistantCapabilityAvailability,
  type AssistantCapabilityCatalog,
  type AssistantCapabilityExecution,
  type AssistantLifecycleEvent,
  type AssistantConfiguredModelProvider,
  type AssistantStreamEvent,
  type AssistantSuggestion,
  type AssistantToolId,
  type AssistantToolSafety,
  type AssistantTurnRequest,
} from '../shared/native-assistant.js';
import { getAssistantToolPermission } from './assistant-permissions.js';
import { executeAssistantTool, redactAssistantToolData } from './assistant-tools.js';
import {
  classifyAssistantModelError,
  redactAssistantModelError,
  type AssistantModelFailureKind,
  type AssistantModelMessage,
  type AssistantModelRouter,
  type AssistantModelStreamChunk,
  type AssistantModelUsage,
} from './assistant-models.js';

export interface AssistantToolSchema {
  id: AssistantToolId;
  safety: AssistantToolSafety;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: boolean;
  };
}

const TOOL_DEFINITIONS = {
  'context.projects': {
    safety: 'read_only',
    description: 'Read bounded project metadata and repo verification state.',
    properties: {},
  },
  'context.entries': {
    safety: 'read_only',
    description: 'Read bounded work log entries for the requested date range.',
    properties: { from: { type: 'string' }, to: { type: 'string' } },
    required: ['from', 'to'],
  },
  'context.reports': {
    safety: 'read_only',
    description: 'Read existing daily, weekly, or monthly proof summaries.',
    properties: { period: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } },
    required: ['period'],
  },
  'context.sessions': {
    safety: 'read_only',
    description: 'Read bounded local AI session candidates after consent.',
    properties: {},
  },
  'context.infra': {
    safety: 'read_only',
    description: 'Read Thoughtseed bridge and Worker connectivity status.',
    properties: {},
  },
  'app.navigate': {
    safety: 'confirm_required',
    description: 'Suggest navigation to an existing Plexus route.',
    properties: { routeKey: { type: 'string' } },
    required: ['routeKey'],
  },
  'app.generateStandup': {
    safety: 'confirm_required',
    description: 'Create a daily standup proof draft from local evidence.',
    properties: { date: { type: 'string' } },
    required: ['date'],
  },
  'app.acceptSession': {
    safety: 'confirm_required',
    description: 'Accept a local AI session candidate into the work log.',
    properties: { candidateId: { type: 'string' } },
    required: ['candidateId'],
  },
  'app.startTimer': {
    safety: 'confirm_required',
    description: 'Start a Plexus timer for a selected project.',
    properties: { projectId: { type: 'string' }, description: { type: 'string' } },
    required: ['projectId', 'description'],
  },
  'app.syncProjects': {
    safety: 'confirm_required',
    description: 'Sync project metadata with the configured Worker.',
    properties: {},
  },
  'daily.sendEvent': {
    safety: 'confirm_required',
    description: 'Send a confirmed daily work event to Thoughtseed infra.',
    properties: {
      date: { type: 'string' },
      memberId: { type: 'string' },
      standupRecordId: { type: ['string', 'null'] },
    },
    required: ['date', 'memberId'],
  },
  'admin.modelConfig': {
    safety: 'admin_only',
    description: 'Inspect or update assistant model configuration diagnostics.',
    properties: {},
  },
  'admin.diagnostics': {
    safety: 'admin_only',
    description: 'Read assistant runtime diagnostics for admin review.',
    properties: {},
  },
} as const satisfies Record<AssistantToolId, {
  safety: AssistantToolSafety;
  description: string;
  properties: Record<string, unknown>;
  required?: readonly string[];
}>;

export function buildAssistantToolSchemas(input: { includeActions?: boolean; includeAdmin?: boolean } = {}): AssistantToolSchema[] {
  const ids: readonly AssistantToolId[] = input.includeActions
    ? [...ASSISTANT_READ_ONLY_TOOLS, ...ASSISTANT_CONFIRM_REQUIRED_TOOLS, ...(input.includeAdmin ? ASSISTANT_ADMIN_ONLY_TOOLS : [])]
    : input.includeAdmin ? [...ASSISTANT_READ_ONLY_TOOLS, ...ASSISTANT_ADMIN_ONLY_TOOLS] : ASSISTANT_READ_ONLY_TOOLS;
  return ids.map((id) => {
    const definition = TOOL_DEFINITIONS[id];
    return {
      id,
      safety: definition.safety,
      description: definition.description,
      parameters: {
        type: 'object',
        properties: definition.properties,
        ...('required' in definition ? { required: [...definition.required] } : {}),
        additionalProperties: false,
      },
    };
  });
}

export function buildAssistantCapabilityCatalog(now: () => Date = () => new Date()): AssistantCapabilityCatalog {
  const capabilities = buildAssistantToolSchemas({ includeActions: true, includeAdmin: true })
    .map((schema) => {
      const permission = getAssistantToolPermission(schema.id);
      const execution: AssistantCapabilityExecution = permission.adminOnly
        ? 'admin'
        : permission.requiresConfirmation ? 'intent' : 'read_only';
      const availability: AssistantCapabilityAvailability = permission.adminOnly || schema.id === 'daily.sendEvent'
        ? 'declared_only'
        : 'available';
      return {
        id: schema.id,
        safety: schema.safety,
        description: schema.description,
        requiresConfirmation: permission.requiresConfirmation,
        adminOnly: permission.adminOnly,
        execution,
        availability,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  return { schema: ASSISTANT_CAPABILITY_CATALOG_SCHEMA, generatedAt: now().toISOString(), capabilities };
}

export function buildAssistantToolSet(): Record<string, unknown> {
  return Object.fromEntries(buildAssistantToolSchemas().map((schema) => [
    schema.id,
    {
      description: schema.description,
      inputSchema: jsonSchema(schema.parameters as Parameters<typeof jsonSchema>[0]),
      execute: async (input: Record<string, unknown>) => {
        const execution = await executeAssistantTool(schema.id, input, { role: 'system' });
        return execution.result;
      },
    },
  ]));
}

export interface AssistantPromptContext {
  routeKey?: string;
  selectedProjectName?: string;
  todayEntryCount?: number;
  taskSummaries?: {
    taskId: string;
    title: string;
    status: string;
    workMode?: string | null;
    proofStatus?: string;
    conflictCount?: number;
    correlationId?: string | null;
  }[];
  pendingSessionCount?: number;
  bridgeConnected?: boolean;
  paperclipStatus?: string | null;
}

export function buildAssistantSystemPrompt(context: AssistantPromptContext = {}): string {
  const taskSummaryText = context.taskSummaries?.slice(0, 5)
    .map((task) => {
      const trace = [
        task.workMode ? `mode ${task.workMode}` : null,
        task.proofStatus ? `proof ${task.proofStatus}` : null,
        task.conflictCount ? `${task.conflictCount} conflict${task.conflictCount === 1 ? '' : 's'}` : null,
        task.correlationId ? `corr ${task.correlationId}` : null,
      ].filter(Boolean).join(', ');
      return `${task.title} (${task.status}${trace ? `, ${trace}` : ''})`;
    })
    .join('; ');
  const facts = [
    context.routeKey ? `Current route: ${context.routeKey}.` : null,
    context.selectedProjectName ? `Selected project: ${context.selectedProjectName}.` : null,
    typeof context.todayEntryCount === 'number' ? `Today has ${context.todayEntryCount} logged work entries.` : null,
    taskSummaryText ? `Task summaries: ${taskSummaryText}.` : null,
    typeof context.pendingSessionCount === 'number' ? `Pending local AI sessions: ${context.pendingSessionCount}.` : null,
    typeof context.bridgeConnected === 'boolean' ? `Thoughtseed bridge connected: ${context.bridgeConnected ? 'yes' : 'no'}.` : null,
    context.paperclipStatus ? `Paperclip is optional helper context only: ${context.paperclipStatus}.` : null,
  ].filter(Boolean);

  return [
    'You are the Plexus-native work assistant running in the Electron main process.',
    'Treat local app context as read-only unless the user explicitly confirms a tool intent.',
    'Prefer app navigation, daily proof, session review, and project sync suggestions over generic chat.',
    'Never expose model keys, bridge tokens, cookies, JWTs, private session files, or full raw transcripts.',
    'Fabric and Paperclip are optional helper layers, not required runtime dependencies.',
    ...facts,
  ].join('\n');
}

export interface AssistantOfflineContext {
  todayDate?: string;
  todayEntries?: { id: string; description?: string; durationSeconds?: number }[];
  hasStandupProofToday?: boolean;
  memberId?: string | null;
  standupRecordId?: string | null;
  sessionScan?: { totalPending?: number; readyPending?: number; candidates?: { id: string; title?: string }[] };
  bridgeStatus?: { connected?: boolean };
  projectCache?: { stale?: boolean };
}

function todayIso(now: () => Date): string {
  return now().toISOString().slice(0, 10);
}

const ASSISTANT_RUNTIME_INTENT_TTL_MS = 15 * 60 * 1000;

function intentExpiresAt(now: Date): string {
  return new Date(now.getTime() + ASSISTANT_RUNTIME_INTENT_TTL_MS).toISOString();
}

export function buildOfflineAssistantSuggestions(
  context: AssistantOfflineContext,
  now: () => Date = () => new Date(),
): AssistantSuggestion[] {
  const date = context.todayDate ?? todayIso(now);
  const suggestions: AssistantSuggestion[] = [];
  if ((context.todayEntries?.length ?? 0) > 0 && !context.hasStandupProofToday) {
    suggestions.push({
      id: `offline_standup_${date}`,
      type: 'standup',
      title: 'Prepare daily proof',
      body: "Generate persisted standup evidence from today's logged work before sending anything.",
      confidence: 0.93,
      safety: 'confirm_required',
      date,
      intent: {
        toolId: 'app.generateStandup',
        title: 'Generate standup proof',
        payload: { date },
      },
    });
  }

  const readyPending = context.sessionScan?.readyPending ?? context.sessionScan?.totalPending ?? 0;
  if (readyPending > 0) {
    suggestions.push({
      id: 'offline_review_sessions',
      title: 'Review local AI sessions',
      body: `${readyPending} session candidate${readyPending === 1 ? '' : 's'} can be reviewed against the current work log.`,
      confidence: 0.86,
      safety: 'read_only',
      intent: {
        toolId: 'context.sessions',
        title: 'Review sessions',
        payload: {},
      },
    });
  }

  if (context.bridgeStatus?.connected && context.projectCache?.stale) {
    suggestions.push({
      id: 'offline_sync_projects',
      title: 'Sync project cache',
      body: 'Thoughtseed infra is connected and local project metadata looks stale.',
      confidence: 0.74,
      safety: 'confirm_required',
      intent: {
        toolId: 'app.syncProjects',
        title: 'Sync projects',
        payload: {},
      },
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
}

function textDeltaFromChunk(chunk: AssistantModelStreamChunk | string): string | null {
  if (typeof chunk === 'string') return chunk;
  return chunk.type === 'text-delta' ? chunk.delta : null;
}

function assistantToolId(value: string): AssistantToolId | null {
  return buildAssistantToolSchemas({ includeActions: true, includeAdmin: true }).some((schema) => schema.id === value)
    ? value as AssistantToolId
    : null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : { value };
}

export async function* normalizeAssistantModelStream(input: {
  conversationId: string;
  stream: AsyncIterable<AssistantModelStreamChunk | string>;
}): AsyncGenerator<AssistantStreamEvent> {
  try {
    for await (const chunk of input.stream) {
      const delta = textDeltaFromChunk(chunk);
      if (delta) {
        yield { type: 'message_delta', conversationId: input.conversationId, delta };
      }
      if (typeof chunk !== 'string' && chunk.type === 'tool-call') {
        const toolName = chunk.toolName ?? chunk.toolId;
        const callId = chunk.toolCallId ?? chunk.callId;
        if (toolName && callId) {
          const toolId = assistantToolId(toolName);
          if (!toolId) {
            yield { type: 'error', conversationId: input.conversationId, message: `Unknown assistant tool requested: ${toolName}.` };
          } else {
            yield {
              type: 'tool_call',
              conversationId: input.conversationId,
              toolId,
              callId,
              payload: redactAssistantToolData(recordValue(chunk.input ?? chunk.payload)),
            };
          }
        }
      }
      if (typeof chunk !== 'string' && chunk.type === 'tool-result') {
        const toolId = assistantToolId(chunk.toolName);
        if (toolId) {
          yield {
            type: 'tool_result',
            conversationId: input.conversationId,
            toolId,
            callId: chunk.toolCallId,
            result: redactAssistantToolData(recordValue(chunk.output)),
          };
        }
      }
      if (typeof chunk !== 'string' && chunk.type === 'tool-error') {
        yield { type: 'error', conversationId: input.conversationId, message: redactAssistantModelError(chunk.error) };
      }
      if (typeof chunk !== 'string' && chunk.type === 'error') {
        yield { type: 'error', conversationId: input.conversationId, message: redactAssistantModelError(chunk.message) };
      }
    }
  } catch (error) {
    yield {
      type: 'error',
      conversationId: input.conversationId,
      message: redactAssistantModelError(error),
    };
  }
  yield { type: 'done', conversationId: input.conversationId };
}

export interface AssistantRuntimeContext extends AssistantOfflineContext, AssistantPromptContext {}

export interface AssistantPersistedMessage {
  id: string;
}

export interface AssistantPersistedIntent {
  id: string;
}

export interface AssistantModelUsagePersistenceInput {
  conversationId: string;
  provider: AssistantConfiguredModelProvider;
  model: string;
  status: 'succeeded' | 'failed';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  usage?: AssistantModelUsage;
  finishReason?: string | null;
  failureKind?: AssistantModelFailureKind | null;
  fallback: boolean;
  primaryProvider?: AssistantConfiguredModelProvider | null;
  finalProvider?: AssistantConfiguredModelProvider | null;
  attempts: Array<{
    provider: AssistantConfiguredModelProvider;
    status: 'failed';
    kind: AssistantModelFailureKind;
  }>;
  metadata?: Record<string, unknown>;
}

export interface AssistantRuntimePersistence {
  saveMessage(input: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<AssistantPersistedMessage>;
  saveIntent?(input: {
    conversationId: string;
    toolId: AssistantToolId;
    payload: Record<string, unknown>;
    status: 'draft';
    expiresAt: string;
  }): Promise<AssistantPersistedIntent>;
  saveModelUsage?(input: AssistantModelUsagePersistenceInput): Promise<void>;
}

export interface AssistantRuntimeDependencies {
  router: Pick<AssistantModelRouter, 'isConfigured' | 'stream'> | null;
  persistence: AssistantRuntimePersistence;
  loadContext(input: AssistantTurnRequest): Promise<AssistantRuntimeContext>;
  executeReadOnlyTool?: (
    toolId: Extract<AssistantToolId, `context.${string}`>,
    payload: Record<string, unknown>,
    context: { conversationId: string; callId: string; signal: AbortSignal },
  ) => Promise<Record<string, unknown>>;
  toolTimeoutMs?: number;
  now?: () => Date;
}

const ASSISTANT_MAX_MODEL_ROUNDS = 4;
const ASSISTANT_MAX_TOOL_CALLS_PER_ROUND = 8;
const ASSISTANT_DEFAULT_TOOL_TIMEOUT_MS = 5_000;
const ASSISTANT_MAX_TOOL_TIMEOUT_MS = 10_000;
const ASSISTANT_MAX_RESULT_STRING = 2_000;
const ASSISTANT_MAX_RESULT_ITEMS = 50;
const ASSISTANT_MAX_RESULT_DEPTH = 5;

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function secretKey(key: string): boolean {
  return /(?:api[_-]?key|authorization|bearer|cookie|jwt|password|secret|token)/i.test(key);
}

function boundedToolValue(value: unknown, depth = 0): unknown {
  if (depth >= ASSISTANT_MAX_RESULT_DEPTH) return '[truncated]';
  if (typeof value === 'string') {
    return redactAssistantModelError(value).slice(0, ASSISTANT_MAX_RESULT_STRING);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, ASSISTANT_MAX_RESULT_ITEMS).map((item) => boundedToolValue(item, depth + 1));
  }
  if (plainObject(value)) {
    return Object.fromEntries(Object.entries(value).slice(0, ASSISTANT_MAX_RESULT_ITEMS).map(([key, item]) => [
      key,
      secretKey(key) ? '[redacted]' : boundedToolValue(item, depth + 1),
    ]));
  }
  return String(value).slice(0, ASSISTANT_MAX_RESULT_STRING);
}

function boundedToolResult(value: unknown): Record<string, unknown> {
  const bounded = boundedToolValue(value);
  return plainObject(bounded) ? bounded : { value: bounded };
}

function schemaTypeMatches(value: unknown, type: unknown): boolean {
  const allowed = Array.isArray(type) ? type : [type];
  return allowed.some((candidate) => (
    candidate === 'string' ? typeof value === 'string'
      : candidate === 'number' ? typeof value === 'number' && Number.isFinite(value)
        : candidate === 'boolean' ? typeof value === 'boolean'
          : candidate === 'null' ? value === null
            : candidate === 'object' ? plainObject(value)
              : candidate === 'array' ? Array.isArray(value)
                : false
  ));
}

type ValidatedToolCall = {
  callId: string;
  toolId: AssistantToolId;
  payload: Record<string, unknown>;
  schema: AssistantToolSchema;
};

function validateModelToolCall(
  chunk: Extract<AssistantModelStreamChunk, { type: 'tool-call' }>,
): { call: ValidatedToolCall | null; feedback: Record<string, unknown> } {
  const rawCallId = chunk.toolCallId ?? chunk.callId;
  const rawToolId = chunk.toolName ?? chunk.toolId;
  const rawPayload = chunk.input ?? chunk.payload;
  const callId = typeof rawCallId === 'string' && rawCallId.length > 0 && rawCallId.length <= 128
    ? rawCallId
    : 'invalid_call';
  const schema = buildAssistantToolSchemas({ includeActions: true })
    .find((candidate) => candidate.id === rawToolId);
  if (!schema) return { call: null, feedback: { status: 'rejected', error: 'Unknown or unavailable assistant tool.' } };
  if (!plainObject(rawPayload)) {
    return { call: null, feedback: { status: 'rejected', error: 'Assistant tool payload must be an object.' } };
  }
  const payload: Record<string, unknown> = rawPayload;
  const keys = Object.keys(payload);
  if (keys.some((key) => !(key in schema.parameters.properties))) {
    return { call: null, feedback: { status: 'rejected', error: 'Assistant tool payload contains unsupported fields.' } };
  }
  if (schema.parameters.required?.some((key) => !(key in payload))) {
    return { call: null, feedback: { status: 'rejected', error: 'Assistant tool payload is missing required fields.' } };
  }
  for (const [key, value] of Object.entries(payload)) {
    const property = schema.parameters.properties[key];
    if (!plainObject(property) || !schemaTypeMatches(value, property.type)) {
      return { call: null, feedback: { status: 'rejected', error: 'Assistant tool payload has an invalid field type.' } };
    }
    if (Array.isArray(property.enum) && !property.enum.includes(value)) {
      return { call: null, feedback: { status: 'rejected', error: 'Assistant tool payload has an unsupported field value.' } };
    }
  }
  return {
    call: { callId, toolId: schema.id, payload, schema },
    feedback: {},
  };
}

async function withToolDeadline<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Assistant tool execution timed out.'));
        }, timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const CONFIGURED_MODEL_PROVIDERS = ['local', 'google', 'nvidia', 'mock'] as const satisfies readonly AssistantConfiguredModelProvider[];

function configuredProvider(value: unknown): AssistantConfiguredModelProvider | null {
  return typeof value === 'string' && CONFIGURED_MODEL_PROVIDERS.includes(value as AssistantConfiguredModelProvider)
    ? value as AssistantConfiguredModelProvider
    : null;
}

function modelAttempts(metadata?: Record<string, unknown>): AssistantModelUsagePersistenceInput['attempts'] {
  const attempts = Array.isArray(metadata?.attempts) ? metadata.attempts : [];
  return attempts.flatMap((attempt) => {
    if (!attempt || typeof attempt !== 'object') return [];
    const value = attempt as Record<string, unknown>;
    const provider = configuredProvider(value.provider);
    const kind = typeof value.kind === 'string' ? value.kind as AssistantModelFailureKind : null;
    return provider && kind
      ? [{ provider, status: 'failed' as const, kind }]
      : [];
  });
}

function modelUsageEnvelope(
  chunk: Extract<AssistantModelStreamChunk, { type: 'done' }>,
): Pick<AssistantModelUsagePersistenceInput, 'fallback' | 'primaryProvider' | 'finalProvider' | 'attempts' | 'metadata'> {
  const metadata = chunk.metadata ?? {};
  const attempts = modelAttempts(metadata);
  return {
    fallback: metadata.fallback === true,
    primaryProvider: configuredProvider(metadata.primaryProvider),
    finalProvider: configuredProvider(metadata.finalProvider) ?? chunk.provider,
    attempts,
    metadata: attempts.length > 0 ? { attempts } : {},
  };
}

function durationMs(startedAt: string, endedAt: string): number {
  return Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
}

export class AssistantRuntime {
  private readonly now: () => Date;

  constructor(private readonly deps: AssistantRuntimeDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  private async materializeSuggestionIntent(
    conversationId: string,
    suggestion: AssistantSuggestion,
  ): Promise<AssistantSuggestion> {
    if (!suggestion.intent || suggestion.safety !== 'confirm_required' || !this.deps.persistence.saveIntent) {
      return suggestion;
    }
    const expiresAt = intentExpiresAt(this.now());
    const saved = await this.deps.persistence.saveIntent({
      conversationId,
      toolId: suggestion.intent.toolId,
      payload: suggestion.intent.payload,
      status: 'draft',
      expiresAt,
    });
    return {
      ...suggestion,
      intent: {
        ...suggestion.intent,
        intentId: saved.id,
        expiresAt,
      },
    };
  }

  async *runTurn(request: AssistantTurnRequest): AsyncGenerator<AssistantStreamEvent> {
    const router = this.deps.router;
    const hasModel = Boolean(router?.isConfigured());
    const runId = randomUUID();
    yield {
      type: 'run_start',
      schema: ASSISTANT_EVENT_SCHEMA,
      conversationId: request.conversationId,
      runId,
      mode: hasModel ? 'model' : 'offline',
    } satisfies AssistantLifecycleEvent;

    let context: AssistantRuntimeContext;
    try {
      await this.deps.persistence.saveMessage({
        conversationId: request.conversationId,
        role: 'user',
        content: request.message,
        metadata: { routeKey: request.routeKey, contextScopes: request.contextScopes },
      });
      context = await this.deps.loadContext(request);
    } catch (error) {
      yield { type: 'error', conversationId: request.conversationId, message: redactAssistantModelError(error) };
      yield {
        type: 'run_end',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
        status: 'failed',
      } satisfies AssistantLifecycleEvent;
      return;
    }

    if (!router?.isConfigured()) {
      try {
        const suggestions = buildOfflineAssistantSuggestions(context, this.now);
        for (const suggestion of suggestions) {
          const materialized = await this.materializeSuggestionIntent(request.conversationId, suggestion);
          if (materialized.intent?.intentId && materialized.safety === 'confirm_required') {
            yield {
              type: 'approval_required',
              schema: ASSISTANT_EVENT_SCHEMA,
              conversationId: request.conversationId,
              runId,
              toolId: materialized.intent.toolId,
              intentId: materialized.intent.intentId,
              safety: 'confirm_required',
            } satisfies AssistantLifecycleEvent;
          }
          yield { type: 'suggestion', conversationId: request.conversationId, suggestion: materialized };
        }
        const saved = await this.deps.persistence.saveMessage({
          conversationId: request.conversationId,
          role: 'assistant',
          content: suggestions.map((suggestion) => suggestion.title).join('\n') || 'No offline suggestions available.',
          metadata: { mode: 'offline_suggestions' },
        });
        yield { type: 'done', conversationId: request.conversationId, messageId: saved.id };
        yield {
          type: 'run_end',
          schema: ASSISTANT_EVENT_SCHEMA,
          conversationId: request.conversationId,
          runId,
          status: 'offline',
        } satisfies AssistantLifecycleEvent;
      } catch (error) {
        yield { type: 'error', conversationId: request.conversationId, message: redactAssistantModelError(error) };
        yield { type: 'done', conversationId: request.conversationId };
        yield {
          type: 'run_end',
          schema: ASSISTANT_EVENT_SCHEMA,
          conversationId: request.conversationId,
          runId,
          status: 'failed',
        } satisfies AssistantLifecycleEvent;
      }
      return;
    }

    const messages: AssistantModelMessage[] = [
      { role: 'system', content: buildAssistantSystemPrompt(context) },
      { role: 'user', content: request.message },
    ];

    let finalText = '';
    let doneChunk: Extract<AssistantModelStreamChunk, { type: 'done' }> | null = null;
    let modelStartedAt = this.now().toISOString();
    let modelCallFailed = false;
    try {
      yield {
        type: 'model_call_start',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
      } satisfies AssistantLifecycleEvent;
      for (let round = 0; round < ASSISTANT_MAX_MODEL_ROUNDS; round += 1) {
        modelStartedAt = this.now().toISOString();
        doneChunk = null;
        let roundText = '';
        const toolCalls: Array<Extract<AssistantModelStreamChunk, { type: 'tool-call' }>> = [];
        const stream = await router.stream({
          messages,
          tools: buildAssistantToolSchemas({ includeActions: true }),
          maxToolSteps: ASSISTANT_MAX_MODEL_ROUNDS,
        });
        for await (const chunk of stream) {
          const delta = textDeltaFromChunk(chunk);
          if (delta) {
            roundText += delta;
            finalText += delta;
            yield { type: 'message_delta', conversationId: request.conversationId, delta };
            continue;
          }
          if (typeof chunk === 'string') continue;
          if (chunk.type === 'tool-call') {
            if (toolCalls.length < ASSISTANT_MAX_TOOL_CALLS_PER_ROUND) toolCalls.push(chunk);
            continue;
          }
          if (chunk.type === 'done') doneChunk = chunk;
        }

        const modelEndedAt = this.now().toISOString();
        if (doneChunk) {
          const envelope = modelUsageEnvelope(doneChunk);
          await this.deps.persistence.saveModelUsage?.({
            conversationId: request.conversationId,
            provider: doneChunk.provider,
            model: doneChunk.model,
            status: 'succeeded',
            startedAt: modelStartedAt,
            endedAt: modelEndedAt,
            durationMs: durationMs(modelStartedAt, modelEndedAt),
            usage: doneChunk.usage,
            finishReason: doneChunk.finishReason ?? null,
            failureKind: null,
            ...envelope,
          });
        }

        if (toolCalls.length === 0) break;

        const assistantToolCalls: NonNullable<AssistantModelMessage['toolCalls']> = [];
        const toolFeedback: AssistantModelMessage[] = [];
        for (const chunk of toolCalls) {
          const validation = validateModelToolCall(chunk);
          if (!validation.call) {
            const rawCallId = chunk.toolCallId ?? chunk.callId;
            const rawToolId = chunk.toolName ?? chunk.toolId;
            const callId = typeof rawCallId === 'string' && rawCallId.length <= 128
              ? rawCallId
              : 'invalid_call';
            const toolId = typeof rawToolId === 'string'
              ? rawToolId.slice(0, 128)
              : 'invalid_tool';
            assistantToolCalls.push({ callId, toolId, payload: { status: 'redacted_invalid_payload' } });
            toolFeedback.push({
              role: 'tool',
              content: JSON.stringify(validation.feedback),
              toolCallId: callId,
              toolId,
            });
            continue;
          }

          const { callId, toolId, payload, schema } = validation.call;
          assistantToolCalls.push({ callId, toolId, payload });
          yield { type: 'tool_call', conversationId: request.conversationId, toolId, callId, payload };

          let result: Record<string, unknown>;
          if (schema.safety === 'confirm_required') {
            const suggestion = await this.materializeSuggestionIntent(request.conversationId, {
              id: `model_intent_${callId}`,
              title: `Review ${toolId}`,
              body: schema.description,
              confidence: 1,
              safety: 'confirm_required',
              intent: { toolId, title: `Confirm ${toolId}`, payload },
            });
            if (suggestion.intent?.intentId) {
              yield {
                type: 'approval_required',
                schema: ASSISTANT_EVENT_SCHEMA,
                conversationId: request.conversationId,
                runId,
                toolId,
                intentId: suggestion.intent.intentId,
                safety: 'confirm_required',
              } satisfies AssistantLifecycleEvent;
            }
            yield { type: 'suggestion', conversationId: request.conversationId, suggestion };
            result = boundedToolResult({
              status: 'confirmation_required',
              intentId: suggestion.intent?.intentId,
              expiresAt: suggestion.intent?.expiresAt,
            });
          } else {
            try {
              if (!this.deps.executeReadOnlyTool) throw new Error('Read-only assistant tool executor is unavailable.');
              const timeoutMs = Math.min(
                ASSISTANT_MAX_TOOL_TIMEOUT_MS,
                Math.max(100, this.deps.toolTimeoutMs ?? ASSISTANT_DEFAULT_TOOL_TIMEOUT_MS),
              );
              const rawResult = await withToolDeadline(timeoutMs, (signal) => this.deps.executeReadOnlyTool!(
                toolId as Extract<AssistantToolId, `context.${string}`>,
                payload,
                { conversationId: request.conversationId, callId, signal },
              ));
              result = boundedToolResult({ status: 'succeeded', result: rawResult });
            } catch (error) {
              result = boundedToolResult({
                status: 'failed',
                error: redactAssistantModelError(error),
              });
            }
          }

          yield { type: 'tool_result', conversationId: request.conversationId, toolId, callId, result };
          toolFeedback.push({
            role: 'tool',
            content: JSON.stringify(result),
            toolCallId: callId,
            toolId,
          });
        }
        messages.push({ role: 'assistant', content: roundText, toolCalls: assistantToolCalls }, ...toolFeedback);
      }

      if (finalText) {
        const saved = await this.deps.persistence.saveMessage({
          conversationId: request.conversationId,
          role: 'assistant',
          content: finalText,
          metadata: {
            mode: 'model',
            provider: doneChunk?.provider,
            model: doneChunk?.model,
            usage: doneChunk?.usage,
            finishReason: doneChunk?.finishReason,
          },
        });
        yield { type: 'done', conversationId: request.conversationId, messageId: saved.id };
      } else {
        yield { type: 'done', conversationId: request.conversationId };
      }
      yield {
        type: 'model_call_end',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
        status: 'succeeded',
      } satisfies AssistantLifecycleEvent;
      yield {
        type: 'run_end',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
        status: 'completed',
      } satisfies AssistantLifecycleEvent;
    } catch (error) {
      modelCallFailed = true;
      const modelEndedAt = this.now().toISOString();
      const classified = classifyAssistantModelError(error);
      if (classified.provider) {
        await this.deps.persistence.saveModelUsage?.({
          conversationId: request.conversationId,
          provider: classified.provider,
          model: 'unknown',
          status: 'failed',
          startedAt: modelStartedAt,
          endedAt: modelEndedAt,
          durationMs: durationMs(modelStartedAt, modelEndedAt),
          failureKind: classified.kind,
          fallback: false,
          primaryProvider: classified.provider,
          finalProvider: classified.provider,
          attempts: [],
          metadata: { retryable: classified.retryable },
        });
      }
      yield {
        type: 'error',
        conversationId: request.conversationId,
        message: redactAssistantModelError(error),
      };
      const suggestions = buildOfflineAssistantSuggestions(context, this.now);
      for (const suggestion of suggestions) {
        yield {
          type: 'suggestion',
          conversationId: request.conversationId,
          suggestion: await this.materializeSuggestionIntent(request.conversationId, suggestion),
        };
      }
      yield { type: 'done', conversationId: request.conversationId };
      yield {
        type: 'model_call_end',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
        status: modelCallFailed ? 'failed' : 'succeeded',
      } satisfies AssistantLifecycleEvent;
      yield {
        type: 'run_end',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
        status: 'failed',
      } satisfies AssistantLifecycleEvent;
    }
  }
}

export function createAssistantRuntime(deps: AssistantRuntimeDependencies): AssistantRuntime {
  return new AssistantRuntime(deps);
}
