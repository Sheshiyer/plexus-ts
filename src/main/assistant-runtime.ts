import { randomUUID } from 'node:crypto';
import { jsonSchema } from 'ai';
import {
  ASSISTANT_ADMIN_ONLY_TOOLS,
  ASSISTANT_CAPABILITY_CATALOG_SCHEMA,
  ASSISTANT_CONFIRM_REQUIRED_TOOLS,
  ASSISTANT_EVENT_SCHEMA,
  ASSISTANT_READ_ONLY_TOOLS,
  type AssistantCapabilityCatalog,
  type AssistantCapabilityAvailability,
  type AssistantCapabilityExecution,
  type AssistantLifecycleEvent,
  type AssistantStreamEvent,
  type AssistantSuggestion,
  type AssistantToolId,
  type AssistantToolSafety,
  type AssistantTurnRequest,
} from '../shared/native-assistant.js';
import { getAssistantToolPermission } from './assistant-permissions.js';
import { executeAssistantTool, redactAssistantToolData } from './assistant-tools.js';
import {
  redactAssistantModelError,
  type AssistantModelMessage,
  type AssistantModelRouter,
  type AssistantModelStreamChunk,
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

export function buildAssistantToolSchemas(input: { includeActions?: boolean; includeAdmin?: boolean } = {}): AssistantToolSchema[] {
  const ids: readonly AssistantToolId[] = input.includeActions
    ? [
        ...ASSISTANT_READ_ONLY_TOOLS,
        ...ASSISTANT_CONFIRM_REQUIRED_TOOLS,
        ...(input.includeAdmin ? ASSISTANT_ADMIN_ONLY_TOOLS : []),
      ]
    : input.includeAdmin
      ? [...ASSISTANT_READ_ONLY_TOOLS, ...ASSISTANT_ADMIN_ONLY_TOOLS]
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

export function buildAssistantCapabilityCatalog(now: () => Date = () => new Date()): AssistantCapabilityCatalog {
  const capabilities = buildAssistantToolSchemas({ includeActions: true, includeAdmin: true })
    .map((schema) => {
      const permission = getAssistantToolPermission(schema.id);
      const execution: AssistantCapabilityExecution = permission.adminOnly
        ? 'admin'
        : permission.requiresConfirmation
          ? 'intent'
          : 'read_only';
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

  return {
    schema: ASSISTANT_CAPABILITY_CATALOG_SCHEMA,
    generatedAt: now().toISOString(),
    capabilities,
  };
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
  pendingSessionCount?: number;
  bridgeConnected?: boolean;
}

export function buildAssistantSystemPrompt(context: AssistantPromptContext = {}): string {
  const facts = [
    context.routeKey ? `Current route: ${context.routeKey}.` : null,
    context.selectedProjectName ? `Selected project: ${context.selectedProjectName}.` : null,
    typeof context.todayEntryCount === 'number' ? `Today has ${context.todayEntryCount} logged work entries.` : null,
    typeof context.pendingSessionCount === 'number' ? `Pending local AI sessions: ${context.pendingSessionCount}.` : null,
    typeof context.bridgeConnected === 'boolean' ? `Thoughtseed bridge connected: ${context.bridgeConnected ? 'yes' : 'no'}.` : null,
  ].filter(Boolean);

  return [
    'You are the Plexus-native work assistant running in the Electron main process.',
    'Treat local app context as read-only unless the user explicitly confirms a tool intent.',
    'Prefer app navigation, daily proof, session review, and project sync suggestions over generic chat.',
    'Never expose model keys, bridge tokens, cookies, JWTs, private session files, or full raw transcripts.',
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

function assistantToolId(value: string): AssistantToolId | null {
  return Object.prototype.hasOwnProperty.call(TOOL_DEFINITIONS, value) ? value as AssistantToolId : null;
}

function recordValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return { value };
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
        const toolId = assistantToolId(chunk.toolName);
        if (!toolId) {
          yield {
            type: 'error',
            conversationId: input.conversationId,
            message: `Unknown assistant tool requested: ${chunk.toolName}.`,
          };
        } else {
          yield {
            type: 'tool_call',
            conversationId: input.conversationId,
            toolId,
            callId: chunk.toolCallId,
            payload: redactAssistantToolData(recordValue(chunk.input)),
          };
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
        yield {
          type: 'error',
          conversationId: input.conversationId,
          message: redactAssistantModelError(chunk.error),
        };
      }
      if (typeof chunk !== 'string' && chunk.type === 'error') {
        yield {
          type: 'error',
          conversationId: input.conversationId,
          message: redactAssistantModelError(chunk.message),
        };
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
  }): Promise<AssistantPersistedIntent>;
}

export interface AssistantRuntimeDependencies {
  router: Pick<AssistantModelRouter, 'isConfigured' | 'stream'> | null;
  persistence: AssistantRuntimePersistence;
  loadContext(input: AssistantTurnRequest): Promise<AssistantRuntimeContext>;
  now?: () => Date;
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
    const saved = await this.deps.persistence.saveIntent({
      conversationId,
      toolId: suggestion.intent.toolId,
      payload: suggestion.intent.payload,
      status: 'draft',
    });
    return {
      ...suggestion,
      intent: {
        ...suggestion.intent,
        intentId: saved.id,
      },
    };
  }

  async *runTurn(request: AssistantTurnRequest): AsyncGenerator<AssistantStreamEvent> {
    const runId = randomUUID();
    const router = this.deps.router;
    const hasModel = Boolean(router?.isConfigured());
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
      yield {
        type: 'error',
        conversationId: request.conversationId,
        message: redactAssistantModelError(error),
      };
      yield {
        type: 'run_end',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
        status: 'failed',
      } satisfies AssistantLifecycleEvent;
      return;
    }
    if (!router || !hasModel) {
      yield {
        type: 'error',
        conversationId: request.conversationId,
        message: 'No AI model is configured — add a key in Settings → Clio.',
      };
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
          yield {
            type: 'suggestion',
            conversationId: request.conversationId,
            suggestion: materialized,
          };
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
        yield {
          type: 'error',
          conversationId: request.conversationId,
          message: redactAssistantModelError(error),
        };
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
    let hadError = false;
    try {
      yield {
        type: 'model_call_start',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
      } satisfies AssistantLifecycleEvent;
      const stream = await router.stream({
        messages,
        tools: buildAssistantToolSet(),
        maxToolSteps: 2,
      });
      for await (const event of normalizeAssistantModelStream({ conversationId: request.conversationId, stream })) {
        if (event.type === 'message_delta') finalText += event.delta;
        if (event.type === 'error') hadError = true;
        if (event.type === 'done') {
          if (finalText) {
            const saved = await this.deps.persistence.saveMessage({
              conversationId: request.conversationId,
              role: 'assistant',
              content: finalText,
              metadata: { mode: 'model', hadError },
            });
            yield { ...event, messageId: saved.id };
          } else {
            yield event;
          }
        } else {
          yield event;
        }
      }
      yield {
        type: 'model_call_end',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
        status: hadError ? 'failed' : 'succeeded',
      } satisfies AssistantLifecycleEvent;
      yield {
        type: 'run_end',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
        status: hadError ? 'failed' : 'completed',
      } satisfies AssistantLifecycleEvent;
    } catch (error) {
      yield {
        type: 'model_call_end',
        schema: ASSISTANT_EVENT_SCHEMA,
        conversationId: request.conversationId,
        runId,
        status: 'failed',
      } satisfies AssistantLifecycleEvent;
      yield {
        type: 'error',
        conversationId: request.conversationId,
        message: redactAssistantModelError(error),
      };
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
        yield {
          type: 'suggestion',
          conversationId: request.conversationId,
          suggestion: materialized,
        };
      }
      yield { type: 'done', conversationId: request.conversationId };
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
