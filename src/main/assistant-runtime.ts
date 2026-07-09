import {
  ASSISTANT_CONFIRM_REQUIRED_TOOLS,
  ASSISTANT_READ_ONLY_TOOLS,
  type AssistantConfiguredModelProvider,
  type AssistantStreamEvent,
  type AssistantSuggestion,
  type AssistantToolId,
  type AssistantToolSafety,
  type AssistantTurnRequest,
} from '../shared/native-assistant.js';
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
  },
  'context.reports': {
    safety: 'read_only',
    description: 'Read existing daily, weekly, or monthly proof summaries.',
    properties: { period: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } },
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
  },
  'app.generateStandup': {
    safety: 'confirm_required',
    description: 'Create a daily standup proof draft from local evidence.',
    properties: { date: { type: 'string' } },
  },
  'app.acceptSession': {
    safety: 'confirm_required',
    description: 'Accept a local AI session candidate into the work log.',
    properties: { candidateId: { type: 'string' } },
  },
  'app.startTimer': {
    safety: 'confirm_required',
    description: 'Start a Plexus timer for a selected project.',
    properties: { projectId: { type: 'string' }, description: { type: 'string' } },
  },
  'app.syncProjects': {
    safety: 'confirm_required',
    description: 'Sync project metadata with the configured Worker.',
    properties: {},
  },
  'daily.sendEvent': {
    safety: 'confirm_required',
    description: 'Send a confirmed daily work event to Thoughtseed infra.',
    properties: { eventType: { type: 'string' } },
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
}>;

export function buildAssistantToolSchemas(input: { includeActions?: boolean } = {}): AssistantToolSchema[] {
  const ids: readonly AssistantToolId[] = input.includeActions
    ? [...ASSISTANT_READ_ONLY_TOOLS, ...ASSISTANT_CONFIRM_REQUIRED_TOOLS]
    : ASSISTANT_READ_ONLY_TOOLS;
  return ids.map((id) => {
    const definition = TOOL_DEFINITIONS[id];
    return {
      id,
      safety: definition.safety,
      description: definition.description,
      parameters: {
        type: 'object',
        properties: definition.properties,
        additionalProperties: false,
      },
    };
  });
}

export interface AssistantPromptContext {
  routeKey?: string;
  selectedProjectName?: string;
  todayEntryCount?: number;
  taskSummaries?: { taskId: string; title: string; status: string; proofStatus?: string }[];
  pendingSessionCount?: number;
  bridgeConnected?: boolean;
  paperclipStatus?: string | null;
}

export function buildAssistantSystemPrompt(context: AssistantPromptContext = {}): string {
  const taskSummaryText = context.taskSummaries?.slice(0, 5)
    .map((task) => `${task.title} (${task.status}${task.proofStatus ? `, proof ${task.proofStatus}` : ''})`)
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
      title: 'Prepare daily proof',
      body: "Generate a standup summary from today's logged work before sending anything.",
      confidence: 0.92,
      safety: 'confirm_required',
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
  now?: () => Date;
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
    await this.deps.persistence.saveMessage({
      conversationId: request.conversationId,
      role: 'user',
      content: request.message,
      metadata: { routeKey: request.routeKey, contextScopes: request.contextScopes },
    });

    const context = await this.deps.loadContext(request);
    const router = this.deps.router;
    if (!router?.isConfigured()) {
      const suggestions = buildOfflineAssistantSuggestions(context, this.now);
      for (const suggestion of suggestions) {
        yield {
          type: 'suggestion',
          conversationId: request.conversationId,
          suggestion: await this.materializeSuggestionIntent(request.conversationId, suggestion),
        };
      }
      const saved = await this.deps.persistence.saveMessage({
        conversationId: request.conversationId,
        role: 'assistant',
        content: suggestions.map((suggestion) => suggestion.title).join('\n') || 'No offline suggestions available.',
        metadata: { mode: 'offline_suggestions' },
      });
      yield { type: 'done', conversationId: request.conversationId, messageId: saved.id };
      return;
    }

    const messages: AssistantModelMessage[] = [
      { role: 'system', content: buildAssistantSystemPrompt(context) },
      { role: 'user', content: request.message },
    ];

    let finalText = '';
    let doneChunk: Extract<AssistantModelStreamChunk, { type: 'done' }> | null = null;
    const modelStartedAt = this.now().toISOString();
    try {
      const stream = await router.stream({
        messages,
        tools: buildAssistantToolSchemas(),
      });
      for await (const chunk of stream) {
        const delta = textDeltaFromChunk(chunk);
        if (delta) {
          finalText += delta;
          yield { type: 'message_delta', conversationId: request.conversationId, delta };
          continue;
        }
        if (typeof chunk !== 'string' && chunk.type === 'done') {
          doneChunk = chunk;
        }
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
    } catch (error) {
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
    }
  }
}

export function createAssistantRuntime(deps: AssistantRuntimeDependencies): AssistantRuntime {
  return new AssistantRuntime(deps);
}
