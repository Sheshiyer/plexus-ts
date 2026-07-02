import { randomUUID } from 'node:crypto';
import {
  ASSISTANT_ROUTE_KEYS,
  type AssistantRouteKey,
  type AssistantToolId,
} from '../shared/native-assistant.js';
import type {
  StandupEvidenceRecord,
  TimeEntry,
} from '../shared/types.js';
import type {
  AssistantIntentRecord,
  AssistantToolAuditInput,
  AssistantToolAuditRecord,
} from '../db/database.js';
import {
  buildAssistantContext,
  type BuildAssistantContextInput,
  type AssistantContextSnapshot,
} from './assistant-context.js';
import { isSecretLikeKey } from './assistant-policy.js';
import { getAssistantToolPermission } from './assistant-permissions.js';

export interface AssistantToolActor {
  actorId?: string;
  role?: 'user' | 'admin' | 'system';
  intentId?: string;
}

export interface AssistantStartTimerInput {
  projectId: string;
  description: string;
  targetSeconds?: number;
}

export interface AssistantToolDependencies {
  loadContext?: (input: BuildAssistantContextInput) => Promise<AssistantContextSnapshot>;
  generateStandupEvidence?: (date: string) => Promise<StandupEvidenceRecord>;
  acceptAgentSession?: (candidateId: string) => Promise<TimeEntry>;
  startTimer?: (input: AssistantStartTimerInput) => Promise<TimeEntry>;
  syncProjects?: () => Promise<{ ok: boolean; count: number; message?: string }>;
  dispatchNavigation?: (routeKey: AssistantRouteKey) => Promise<void> | void;
  getIntent?: (intentId: string) => Promise<AssistantIntentRecord | null>;
  updateIntent?: (
    intentId: string,
    patch: { status?: AssistantIntentRecord['status']; result?: Record<string, unknown>; updatedAt?: string },
  ) => Promise<AssistantIntentRecord>;
  recordToolAudit?: (input: AssistantToolAuditInput) => Promise<AssistantToolAuditRecord>;
  now?: () => Date;
}

export interface AssistantToolExecution {
  toolId: AssistantToolId;
  result: Record<string, unknown>;
  intentId?: string;
}

export async function generateStandupEvidenceRecord(date: string): Promise<StandupEvidenceRecord> {
  assertDate(date);
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  const database = await import('../db/database.js');
  const evidence = await import('./evidence.js');
  const [entries, projects] = await Promise.all([database.listEntries(from, to), database.listProjects()]);
  const activity = (await Promise.all(
    projects
      .filter((project) => project.githubRepoFullName)
      .map((project) => database.listGitHubActivity(project.id, from, to)),
  )).flat();
  const record: StandupEvidenceRecord = {
    id: `standup_${date}`,
    date,
    totalSeconds: entries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
    evidenceSummary: evidence.computeEvidenceSummary(entries, projects),
    activity,
    generatedAt: new Date().toISOString(),
  };
  await database.upsertStandupEvidenceRecord(record);
  return record;
}

export async function executeAssistantTool(
  toolId: AssistantToolId,
  payload: Record<string, unknown> = {},
  actor: AssistantToolActor = {},
  dependencies: AssistantToolDependencies = {},
): Promise<AssistantToolExecution> {
  const deps = assistantToolDependencies(dependencies);
  const permission = getAssistantToolPermission(toolId);
  if (permission.adminOnly && actor.role !== 'admin') {
    throw new Error(`${toolId} requires an admin assistant actor.`);
  }

  let intent: AssistantIntentRecord | null = null;
  if (permission.requiresConfirmation) {
    if (!actor.intentId) throw new Error(`${toolId} requires a confirmed assistant intent id.`);
    intent = await deps.getIntent(actor.intentId);
    if (!intent) throw new Error('Confirmed assistant intent was not found.');
    if (intent.toolId !== toolId) throw new Error('Confirmed assistant intent does not match the requested tool.');
    if (intent.status !== 'confirmed') throw new Error(`${toolId} cannot run until the assistant intent is confirmed.`);
    if (!sameAssistantToolPayload(payload, intent.payload)) {
      throw new Error('Assistant tool payload does not match the confirmed intent.');
    }
    await deps.updateIntent(intent.id, { status: 'running', updatedAt: deps.now().toISOString() });
  }

  const startedAt = deps.now().toISOString();
  const redactedInput = redactAssistantToolData(payload);
  try {
    const rawResult = await runAssistantTool(toolId, payload, deps);
    const result = redactAssistantToolData(rawResult);
    if (permission.requiresConfirmation && intent) {
      const endedAt = deps.now().toISOString();
      await deps.updateIntent(intent.id, {
        status: 'succeeded',
        result,
        updatedAt: endedAt,
      });
      await deps.recordToolAudit({
        id: randomUUID(),
        intentId: intent.id,
        toolId,
        status: 'succeeded',
        actorId: actor.actorId ?? null,
        startedAt,
        endedAt,
        input: redactedInput,
        output: result,
      });
    }
    return { toolId, result, intentId: intent?.id };
  } catch (error) {
    const message = redactedErrorMessage(error);
    if (permission.requiresConfirmation && intent) {
      const endedAt = deps.now().toISOString();
      await deps.updateIntent(intent.id, {
        status: 'failed',
        result: { error: message },
        updatedAt: endedAt,
      });
      await deps.recordToolAudit({
        id: randomUUID(),
        intentId: intent.id,
        toolId,
        status: 'failed',
        actorId: actor.actorId ?? null,
        startedAt,
        endedAt,
        input: redactedInput,
        output: {},
        error: message,
      });
    }
    throw new Error(message, { cause: error });
  }
}

export async function confirmAssistantIntent(
  intentId: string,
  actor: Omit<AssistantToolActor, 'intentId'> = {},
  dependencies: AssistantToolDependencies = {},
): Promise<AssistantToolExecution> {
  const deps = assistantToolDependencies(dependencies);
  const intent = await deps.getIntent(intentId);
  if (!intent) throw new Error('Assistant intent was not found.');
  if (intent.status !== 'draft' && intent.status !== 'confirmed') {
    throw new Error(`Assistant intent cannot be confirmed from ${intent.status}.`);
  }
  if (intent.status === 'draft') {
    await deps.updateIntent(intent.id, { status: 'confirmed', updatedAt: deps.now().toISOString() });
  }
  return executeAssistantTool(intent.toolId, intent.payload, { ...actor, intentId }, deps);
}

export async function cancelAssistantIntent(
  intentId: string,
  actor: Omit<AssistantToolActor, 'intentId'> = {},
  dependencies: AssistantToolDependencies = {},
): Promise<AssistantIntentRecord> {
  const deps = assistantToolDependencies(dependencies);
  const intent = await deps.getIntent(intentId);
  if (!intent) throw new Error('Assistant intent was not found.');
  if (intent.status === 'running') {
    throw new Error('Assistant intent is already running and cannot be cancelled.');
  }
  if (intent.status === 'succeeded' || intent.status === 'failed' || intent.status === 'cancelled') {
    throw new Error(`Assistant intent cannot be cancelled from ${intent.status}.`);
  }
  return deps.updateIntent(intent.id, {
    status: 'cancelled',
    result: {
      cancelled: true,
      ...(actor.actorId ? { actorId: actor.actorId } : {}),
      cancelledAt: deps.now().toISOString(),
    },
    updatedAt: deps.now().toISOString(),
  });
}

async function runAssistantTool(
  toolId: AssistantToolId,
  payload: Record<string, unknown>,
  deps: Required<AssistantToolDependencies>,
): Promise<Record<string, unknown>> {
  switch (toolId) {
    case 'context.projects':
      return readContextProjects(payload, deps);
    case 'context.entries':
      return readContextEntries(payload, deps);
    case 'context.reports':
      return readContextReports(payload, deps);
    case 'context.sessions':
      return readContextSessions(payload, deps);
    case 'context.infra':
      return readContextInfra(payload, deps);
    case 'app.navigate':
      return navigate(payload, deps);
    case 'app.generateStandup':
      return generateStandup(payload, deps);
    case 'app.acceptSession':
      return acceptSession(payload, deps);
    case 'app.startTimer':
      return startTimer(payload, deps);
    case 'app.syncProjects':
      return syncProjects(deps);
    case 'daily.sendEvent':
      throw new Error('Daily event sending is not available in this assistant tool slice.');
    case 'admin.modelConfig':
    case 'admin.diagnostics':
      throw new Error(`${toolId} is registered for admin diagnostics but has no executor in this task slice.`);
    default:
      assertNever(toolId);
  }
}

async function readContextProjects(payload: Record<string, unknown>, deps: Required<AssistantToolDependencies>) {
  const snapshot = await deps.loadContext(contextInput(payload, ['project']));
  return { projects: snapshot.projects, budget: snapshot.budget.projects };
}

async function readContextEntries(payload: Record<string, unknown>, deps: Required<AssistantToolDependencies>) {
  const snapshot = await deps.loadContext(contextInput(payload, ['today']));
  return {
    entries: snapshot.entries,
    workSummary: snapshot.workSummary,
    timer: snapshot.timer,
    budget: snapshot.budget.entries,
  };
}

async function readContextReports(payload: Record<string, unknown>, deps: Required<AssistantToolDependencies>) {
  const snapshot = await deps.loadContext(contextInput(payload, ['today', 'week']));
  return { evidence: snapshot.evidence, githubActivity: snapshot.githubActivity };
}

async function readContextSessions(payload: Record<string, unknown>, deps: Required<AssistantToolDependencies>) {
  const snapshot = await deps.loadContext(contextInput(payload, ['session_group']));
  return { agentSessions: snapshot.agentSessions, sessionGroups: snapshot.sessionGroups };
}

async function readContextInfra(payload: Record<string, unknown>, deps: Required<AssistantToolDependencies>) {
  const snapshot = await deps.loadContext(contextInput(payload, ['infra', 'app']));
  return { infra: snapshot.infra, route: snapshot.route };
}

async function navigate(payload: Record<string, unknown>, deps: Required<AssistantToolDependencies>) {
  const routeKey = assistantRouteKey(payload.routeKey);
  await deps.dispatchNavigation(routeKey);
  return { routeKey, event: 'assistant:navigate' };
}

async function generateStandup(payload: Record<string, unknown>, deps: Required<AssistantToolDependencies>) {
  const date = stringPayload(payload, 'date');
  assertDate(date);
  const record = await deps.generateStandupEvidence(date);
  return {
    recordId: record.id,
    date: record.date,
    totalSeconds: record.totalSeconds,
    generatedAt: record.generatedAt,
  };
}

async function acceptSession(payload: Record<string, unknown>, deps: Required<AssistantToolDependencies>) {
  const candidateId = stringPayload(payload, 'candidateId');
  const entry = await deps.acceptAgentSession(candidateId);
  return { entryId: entry.id, candidateId, projectId: entry.projectId, durationSeconds: entry.durationSeconds };
}

async function startTimer(payload: Record<string, unknown>, deps: Required<AssistantToolDependencies>) {
  const projectId = stringPayload(payload, 'projectId');
  const description = stringPayload(payload, 'description').trim();
  if (!description) throw new Error('Assistant timer start requires a description.');
  const targetSeconds = optionalNumberPayload(payload, 'targetSeconds');
  const entry = await deps.startTimer({ projectId, description, targetSeconds });
  return { entryId: entry.id, projectId: entry.projectId, description: entry.description, startTime: entry.startTime };
}

async function syncProjects(deps: Required<AssistantToolDependencies>) {
  const result = await deps.syncProjects();
  return { ok: result.ok, count: result.count, message: result.message ?? null };
}

function contextInput(payload: Record<string, unknown>, contextScopes: BuildAssistantContextInput['contextScopes']): BuildAssistantContextInput {
  return {
    contextScopes,
    projectId: typeof payload.projectId === 'string' ? payload.projectId : undefined,
    dateRangeScope: payload.period === 'week' ? 'week' : payload.period === 'month' ? 'month' : 'today',
    includeOptionalHelpers: true,
  };
}

function assistantToolDependencies(input: AssistantToolDependencies): Required<AssistantToolDependencies> {
  return {
    loadContext: input.loadContext ?? ((contextInput) => buildAssistantContext(contextInput)),
    generateStandupEvidence: input.generateStandupEvidence ?? generateStandupEvidenceRecord,
    acceptAgentSession: input.acceptAgentSession ?? (async (candidateId) => {
      const sessions = await import('./agent-sessions.js');
      return sessions.acceptAgentSession(candidateId);
    }),
    startTimer: input.startTimer ?? (async (timerInput) => {
      const timer = await import('./timer-session.js');
      return timer.startTimerEntry(timerInput);
    }),
    syncProjects: input.syncProjects ?? (async () => {
      const teamforge = await import('./teamforge.js');
      return teamforge.syncProjects();
    }),
    dispatchNavigation: input.dispatchNavigation ?? (() => undefined),
    getIntent: input.getIntent ?? (async (intentId) => {
      const database = await import('../db/database.js');
      return database.getAssistantIntent(intentId);
    }),
    updateIntent: input.updateIntent ?? (async (intentId, patch) => {
      const database = await import('../db/database.js');
      return database.updateAssistantIntent(intentId, patch);
    }),
    recordToolAudit: input.recordToolAudit ?? (async (audit) => {
      const database = await import('../db/database.js');
      return database.insertAssistantToolAudit(audit);
    }),
    now: input.now ?? (() => new Date()),
  };
}

export function redactAssistantToolData<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== 'object') return value;
  const redacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    redacted[key] = isSecretLikeKey(key) ? '[REDACTED]' : redactValue(item);
  }
  return redacted;
}

function sameAssistantToolPayload(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return stableJson(a) === stableJson(b);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(',')}}`;
}

function redactedErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? 'Assistant tool failed.');
  const redacted = redactAssistantToolData({ message }).message;
  return typeof redacted === 'string' && redacted.trim() ? redacted : 'Assistant tool failed.';
}

function stringPayload(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Assistant tool payload requires ${key}.`);
  return value;
}

function optionalNumberPayload(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Assistant tool payload ${key} must be a number.`);
  return value;
}

function assistantRouteKey(value: unknown): AssistantRouteKey {
  if (typeof value !== 'string' || !ASSISTANT_ROUTE_KEYS.includes(value as AssistantRouteKey)) {
    throw new Error('Assistant navigation routeKey is invalid.');
  }
  return value as AssistantRouteKey;
}

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Assistant standup generation requires a YYYY-MM-DD date.');
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled assistant tool: ${value}`);
}
