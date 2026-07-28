export type AssistantRole = 'user' | 'assistant' | 'system' | 'tool';

export type AssistantToolSafety = 'read_only' | 'confirm_required' | 'admin_only';

export type ProofStatus = 'pending' | 'verified' | 'partial' | 'missing' | 'legacy_unverified' | 'sync_failed';

export type AssistantIntentStatus =
  | 'draft'
  | 'confirmed'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type AssistantContextScope =
  | 'today'
  | 'week'
  | 'project'
  | 'task'
  | 'session_group'
  | 'infra'
  | 'app';

export type AssistantRouteKey =
  | 'today'
  | 'focus'
  | 'entries'
  | 'agents'
  | 'projects'
  | 'reports'
  | 'export'
  | 'assistant'
  | 'bridge'
  | 'realtime'
  | 'backups'
  | 'admin'
  | 'settings';

export const ASSISTANT_ROUTE_KEYS = [
  'today',
  'focus',
  'entries',
  'agents',
  'projects',
  'reports',
  'export',
  'assistant',
  'bridge',
  'realtime',
  'backups',
  'admin',
  'settings',
] as const satisfies readonly AssistantRouteKey[];

export interface AssistantNavigatePayload {
  routeKey: AssistantRouteKey;
}

export type AssistantToolId =
  | 'context.projects'
  | 'context.entries'
  | 'context.reports'
  | 'context.sessions'
  | 'context.infra'
  | 'app.navigate'
  | 'app.generateStandup'
  | 'app.acceptSession'
  | 'app.startTimer'
  | 'app.syncProjects'
  | 'daily.sendEvent'
  | 'admin.modelConfig'
  | 'admin.diagnostics';

export const ASSISTANT_READ_ONLY_TOOLS = [
  'context.projects',
  'context.entries',
  'context.reports',
  'context.sessions',
  'context.infra',
] as const satisfies readonly AssistantToolId[];

export const ASSISTANT_CONFIRM_REQUIRED_TOOLS = [
  'app.navigate',
  'app.generateStandup',
  'app.acceptSession',
  'app.startTimer',
  'app.syncProjects',
  'daily.sendEvent',
] as const satisfies readonly AssistantToolId[];

export const ASSISTANT_ADMIN_ONLY_TOOLS = [
  'admin.modelConfig',
  'admin.diagnostics',
] as const satisfies readonly AssistantToolId[];

export type AssistantModelProvider = 'auto' | 'omniroute' | 'mock';

export type AssistantConfiguredModelProvider =
  | Exclude<AssistantModelProvider, 'auto'>
  | 'google'
  | 'nvidia'
  | 'local';

export interface AssistantModelSettingsInput {
  provider?: AssistantModelProvider;
  laneId?: string;
}

export interface AssistantModelStatus {
  provider: AssistantModelProvider;
  laneId: string;
  mockModel: string;
  selectedModelId: string | null;
  selectedProvider: AssistantConfiguredModelProvider | null;
  configuredProviders: AssistantConfiguredModelProvider[];
  gatewayState: AssistantOmniRouteGatewayState;
  message?: string;
}

export type AssistantModelOrigin = 'governed' | 'deterministic';

export type AssistantModelCatalogState =
  | 'ready'
  | 'sign_in_required'
  | 'offline'
  | 'degraded'
  | 'fallback_only';

export interface AssistantModelCapability {
  streaming: boolean;
  toolUse: boolean;
  reasoning: boolean;
  privacy: 'governed_gateway' | 'deterministic';
}

export type AssistantOmniRouteLaneStrategy = 'priority' | 'fusion';
export type AssistantOmniRouteLaneHealth = 'healthy' | 'degraded' | 'offline' | 'unknown';
export type AssistantOmniRouteGatewayState = 'ready' | 'sign_in_required' | 'offline' | 'invalid_catalog';

export interface AssistantOmniRouteRankerEvidence {
  routedCalls: number;
  successRate: number;
  providers: number;
  lanes: number;
  rankedModels: number;
  sTier: number;
  aTier: number;
  bTier: number;
  observedAt: string;
  interpretation: string;
}

export interface AssistantOmniRouteReleaseMetadata {
  schema: 'thoughtseed.omniroute.model-portfolio.v1';
  status: 'live-verified';
  observedAt: string;
}

export interface AssistantModelCatalogEntry {
  id: string;
  provider: 'omniroute';
  model: string;
  label: string;
  purpose: string;
  strategy: AssistantOmniRouteLaneStrategy;
  members: string[];
  judgeModel?: string;
  rankerEvidence: AssistantOmniRouteRankerEvidence;
  release: AssistantOmniRouteReleaseMetadata;
  health: AssistantOmniRouteLaneHealth;
  lastVerifiedAt: string;
  origin: AssistantModelOrigin;
  source: string;
  state: AssistantModelCatalogState;
  configured: boolean;
  selectable: boolean;
  selected?: boolean;
  capabilities: AssistantModelCapability;
  message?: string;
}

export interface AssistantModelCatalog {
  selectedModelId: string | null;
  recommendedModelId: string;
  fallbackModelIds: string[];
  entries: AssistantModelCatalogEntry[];
  gatewayState: AssistantOmniRouteGatewayState;
  message?: string;
  generatedAt: string;
}

export type AssistantModelHealthState =
  | 'ok'
  | 'missing_auth'
  | 'offline'
  | 'quota'
  | 'not_configured'
  | 'error';

export interface AssistantModelHealthRequest {
  provider?: AssistantModelProvider;
  probeLive?: boolean;
}

export interface AssistantModelProviderHealth {
  provider: AssistantConfiguredModelProvider;
  model: string;
  state: AssistantModelHealthState;
  configured: boolean;
  checkedAt: string;
  message?: string;
}

export interface AssistantModelHealthResult {
  ok: boolean;
  provider: AssistantModelProvider;
  selectedProvider: AssistantConfiguredModelProvider | null;
  providers: AssistantModelProviderHealth[];
  checkedAt: string;
}

export const ASSISTANT_RECOMMENDED_LANE = 'te-build' as const;

const COMMAND_CODE_PROVIDER = 'openai-compatible-commandcode/';
const COMMAND_CODE_JUDGE = `${COMMAND_CODE_PROVIDER}moonshotai/Kimi-K3`;

export const ASSISTANT_OMNIROUTE_RANKER_EVIDENCE: AssistantOmniRouteRankerEvidence = Object.freeze({
  routedCalls: 8_685,
  successRate: 0.83,
  providers: 14,
  lanes: 15,
  rankedModels: 61,
  sTier: 11,
  aTier: 35,
  bTier: 15,
  observedAt: '2026-07-27T13:45:00.000Z',
  interpretation: 'Ranker evidence describes observed routing performance, not live model entitlement.',
});

export const ASSISTANT_OMNIROUTE_RELEASE: AssistantOmniRouteReleaseMetadata = Object.freeze({
  schema: 'thoughtseed.omniroute.model-portfolio.v1',
  status: 'live-verified',
  observedAt: '2026-07-27T19:16:00.000Z',
});

export interface AssistantGovernedLaneDefinition {
  id: string;
  label: string;
  purpose: string;
  strategy: AssistantOmniRouteLaneStrategy;
  members: readonly string[];
  judgeModel?: string;
}

export const PRODUCTION_OMNIROUTE_LANES = Object.freeze([
  {
    id: 'te-fast',
    label: 'Fast',
    purpose: 'Interactive low-latency coding',
    strategy: 'priority',
    members: ['moonshotai/Kimi-K2.7-Code-Highspeed', 'zai-org/GLM-5.2-Fast', 'deepseek/deepseek-v4-flash'],
  },
  {
    id: 'te-build',
    label: 'Build',
    purpose: 'Tool-capable implementation',
    strategy: 'priority',
    members: ['moonshotai/Kimi-K3', 'moonshotai/Kimi-K2.7-Code', 'deepseek/deepseek-v4-pro'],
  },
  {
    id: 'te-reason',
    label: 'Reason',
    purpose: 'Deliberate technical reasoning',
    strategy: 'priority',
    members: ['deepseek/deepseek-v4-pro', 'nvidia/nemotron-3-ultra-550b-a55b', 'Qwen/Qwen3.7-Max'],
  },
  {
    id: 'te-validate',
    label: 'Validate',
    purpose: 'Independent validation council',
    strategy: 'fusion',
    judgeModel: COMMAND_CODE_JUDGE,
    members: ['deepseek/deepseek-v4-pro', 'Qwen/Qwen3.7-Max', 'nvidia/nemotron-3-ultra-550b-a55b'],
  },
  {
    id: 'te-plan',
    label: 'Plan',
    purpose: 'Repository-grounded planning',
    strategy: 'priority',
    members: ['Qwen/Qwen3.7-Max', 'moonshotai/Kimi-K3', 'zai-org/GLM-5'],
  },
  {
    id: 'te-dispatch',
    label: 'Dispatch',
    purpose: 'Parallel agent dispatch',
    strategy: 'priority',
    members: ['deepseek/deepseek-v4-flash', 'moonshotai/Kimi-K2.7-Code-Highspeed', 'xai/grok-4.5'],
  },
  {
    id: 'te-creative',
    label: 'Creative',
    purpose: 'Creative technical briefs',
    strategy: 'priority',
    members: ['xiaomi/mimo-v2.5-pro', 'moonshotai/Kimi-K2.5', 'stepfun/Step-3.7-Flash'],
  },
  {
    id: 'te-write',
    label: 'Write',
    purpose: 'Primary drafting',
    strategy: 'priority',
    members: ['MiniMaxAI/MiniMax-M3', 'xiaomi/mimo-v2.5-pro', 'moonshotai/Kimi-K2.5'],
  },
  {
    id: 'te-write-critique',
    label: 'Write critique',
    purpose: 'Editorial critique',
    strategy: 'fusion',
    judgeModel: COMMAND_CODE_JUDGE,
    members: ['Qwen/Qwen3.7-Plus', 'deepseek/deepseek-v4-pro', 'zai-org/GLM-5.2'],
  },
  {
    id: 'te-write-research',
    label: 'Write research',
    purpose: 'Evidence-led research writing',
    strategy: 'fusion',
    judgeModel: COMMAND_CODE_JUDGE,
    members: ['deepseek/deepseek-v4-pro', 'nvidia/nemotron-3-ultra-550b-a55b', 'Qwen/Qwen3.6-Max-Preview'],
  },
  {
    id: 'te-write-media',
    label: 'Write media',
    purpose: 'Multimodal writing',
    strategy: 'priority',
    members: ['moonshotai/Kimi-K2.5', 'stepfun/Step-3.7-Flash', 'xiaomi/mimo-v2.5'],
  },
  {
    id: 'te-swarm-s',
    label: 'S-tier swarm',
    purpose: 'S-tier swarm work',
    strategy: 'priority',
    members: ['moonshotai/Kimi-K3', 'xai/grok-4.5', 'Qwen/Qwen3.7-Max'],
  },
  {
    id: 'te-review',
    label: 'Review',
    purpose: 'Code and architecture review',
    strategy: 'priority',
    members: ['deepseek/deepseek-v4-pro', 'moonshotai/Kimi-K2.7-Code', 'zai-org/GLM-5.2-Fast'],
  },
  {
    id: 'te-free-burst',
    label: 'Free burst',
    purpose: 'Bounded free-model burst',
    strategy: 'priority',
    members: ['poolside/laguna-s-2.1-free', 'deepseek/deepseek-v4-flash', 'moonshotai/Kimi-K2.6'],
  },
  {
    id: 'temperance-coding',
    label: 'Temperance coding',
    purpose: 'Compatible default coding lane',
    strategy: 'priority',
    members: ['moonshotai/Kimi-K2.7-Code', 'deepseek/deepseek-v4-pro', 'MiniMaxAI/MiniMax-M2.5'],
  },
] as const satisfies readonly AssistantGovernedLaneDefinition[]);

const PRODUCTION_LANE_IDS = new Set<string>(PRODUCTION_OMNIROUTE_LANES.map((lane) => lane.id));

export function normalizeAssistantModelProvider(value: unknown): AssistantModelProvider {
  return value === 'omniroute' || value === 'mock' || value === 'auto' ? value : 'auto';
}

export function isProductionOmniRouteLaneId(value: unknown): value is string {
  return typeof value === 'string' && PRODUCTION_LANE_IDS.has(value.trim());
}

export function normalizeAssistantLaneId(value: unknown): string {
  return isProductionOmniRouteLaneId(value) ? value.trim() : ASSISTANT_RECOMMENDED_LANE;
}

function catalogRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizedLaneHealth(value: unknown): AssistantOmniRouteLaneHealth {
  return value === 'healthy' || value === 'degraded' || value === 'offline' ? value : 'unknown';
}

function validIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export function normalizeAssistantOmniRouteCatalog(
  value: unknown,
  options: { now?: Date; selectedLaneId?: unknown } = {},
): AssistantModelCatalog {
  const now = (options.now ?? new Date()).toISOString();
  const record = catalogRecord(value);
  const rawEntries = Array.isArray(record?.data) ? record.data : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const candidate of rawEntries) {
    const item = catalogRecord(candidate);
    if (!item || !isProductionOmniRouteLaneId(item.id) || byId.has(item.id.trim())) continue;
    byId.set(item.id.trim(), item);
  }
  const complete = PRODUCTION_OMNIROUTE_LANES.every((lane) => byId.has(lane.id));
  const datesValid = complete && PRODUCTION_OMNIROUTE_LANES.every((lane) => {
    const item = byId.get(lane.id);
    return item?.lastVerifiedAt === undefined || validIsoDate(item.lastVerifiedAt) !== null;
  });
  if (!complete || !datesValid) {
    return {
      selectedModelId: null,
      recommendedModelId: ASSISTANT_RECOMMENDED_LANE,
      fallbackModelIds: [],
      entries: [],
      gatewayState: 'invalid_catalog',
      message: 'OmniRoute did not return the complete verified production lane catalog.',
      generatedAt: now,
    };
  }

  const selectedLaneId = normalizeAssistantLaneId(options.selectedLaneId);
  const entries = PRODUCTION_OMNIROUTE_LANES.map((lane): AssistantModelCatalogEntry => {
    const item = byId.get(lane.id)!;
    const health = normalizedLaneHealth(item.health);
    const lastVerifiedAt = validIsoDate(item.lastVerifiedAt) ?? ASSISTANT_OMNIROUTE_RELEASE.observedAt;
    return {
      id: lane.id,
      provider: 'omniroute',
      model: lane.id,
      label: lane.label,
      purpose: lane.purpose,
      strategy: lane.strategy,
      members: [...lane.members],
      ...('judgeModel' in lane && lane.judgeModel ? { judgeModel: lane.judgeModel } : {}),
      rankerEvidence: { ...ASSISTANT_OMNIROUTE_RANKER_EVIDENCE },
      release: { ...ASSISTANT_OMNIROUTE_RELEASE },
      health,
      lastVerifiedAt,
      origin: 'governed',
      source: 'omniroute_live_verified_portfolio',
      state: health === 'offline' ? 'offline' : health === 'degraded' ? 'degraded' : 'ready',
      configured: true,
      selectable: true,
      selected: lane.id === selectedLaneId,
      capabilities: {
        streaming: true,
        toolUse: true,
        reasoning: true,
        privacy: 'governed_gateway',
      },
    };
  });

  return {
    selectedModelId: selectedLaneId,
    recommendedModelId: ASSISTANT_RECOMMENDED_LANE,
    fallbackModelIds: [],
    entries,
    gatewayState: 'ready',
    generatedAt: now,
  };
}

export interface AssistantIntentDraft {
  intentId?: string;
  expiresAt?: string;
  toolId: AssistantToolId;
  title: string;
  body?: string;
  payload: Record<string, unknown>;
}

export type AssistantSuggestionType =
  | 'standup'
  | 'session_grouping'
  | 'missing_proof'
  | 'navigate_reports'
  | 'sync_projects'
  | 'check_settings';

export interface AssistantSuggestion {
  id: string;
  type?: AssistantSuggestionType;
  title: string;
  body: string;
  intent?: AssistantIntentDraft;
  confidence: number;
  safety: AssistantToolSafety;
  projectId?: string | null;
  date?: string;
  critical?: boolean;
  dedupeKey?: string;
  createdAt?: string;
}

export interface AssistantTurnRequest {
  conversationId: string;
  message: string;
  contextScopes: AssistantContextScope[];
  routeKey?: string;
}

export const ASSISTANT_EVENT_SCHEMA = 'thoughtseed.plexus_assistant_event.v1' as const;
export const ASSISTANT_CAPABILITY_CATALOG_SCHEMA = 'thoughtseed.plexus_assistant_capabilities.v1' as const;

export type AssistantRunMode = 'model' | 'offline';
export type AssistantRunStatus = 'completed' | 'offline' | 'failed';
export type AssistantModelCallStatus = 'succeeded' | 'failed';
export type AssistantCapabilityExecution = 'read_only' | 'intent' | 'admin';
export type AssistantCapabilityAvailability = 'available' | 'declared_only';

export interface AssistantCapabilityDescriptor {
  id: AssistantToolId;
  safety: AssistantToolSafety;
  description: string;
  requiresConfirmation: boolean;
  adminOnly: boolean;
  execution: AssistantCapabilityExecution;
  availability: AssistantCapabilityAvailability;
}

export interface AssistantCapabilityCatalog {
  schema: typeof ASSISTANT_CAPABILITY_CATALOG_SCHEMA;
  generatedAt: string;
  capabilities: AssistantCapabilityDescriptor[];
}

export type AssistantLifecycleEvent =
  | {
      type: 'run_start';
      schema: typeof ASSISTANT_EVENT_SCHEMA;
      conversationId: string;
      runId: string;
      mode: AssistantRunMode;
    }
  | {
      type: 'model_call_start';
      schema: typeof ASSISTANT_EVENT_SCHEMA;
      conversationId: string;
      runId: string;
    }
  | {
      type: 'model_call_end';
      schema: typeof ASSISTANT_EVENT_SCHEMA;
      conversationId: string;
      runId: string;
      status: AssistantModelCallStatus;
    }
  | {
      type: 'approval_required';
      schema: typeof ASSISTANT_EVENT_SCHEMA;
      conversationId: string;
      runId: string;
      toolId: AssistantToolId;
      intentId: string;
      safety: 'confirm_required';
    }
  | {
      type: 'run_end';
      schema: typeof ASSISTANT_EVENT_SCHEMA;
      conversationId: string;
      runId: string;
      status: AssistantRunStatus;
    };

export type AssistantStreamEvent =
  | { type: 'message_delta'; conversationId: string; delta: string }
  | { type: 'tool_call'; conversationId: string; toolId: AssistantToolId; callId: string; payload: Record<string, unknown> }
  | { type: 'tool_result'; conversationId: string; toolId: AssistantToolId; callId: string; result: Record<string, unknown> }
  | { type: 'suggestion'; conversationId: string; suggestion: AssistantSuggestion }
  | { type: 'error'; conversationId: string; message: string }
  | { type: 'done'; conversationId: string; messageId?: string }
  | AssistantLifecycleEvent;

export const ASSISTANT_DAILY_EVENT_SCHEMA = 'thoughtseed.plexus_daily_agent_event.v1' as const;

export type AssistantDailyEventStatus = 'queued' | 'sent' | 'failed';

export const ASSISTANT_DAILY_EVENT_STATUSES = [
  'queued',
  'sent',
  'failed',
] as const satisfies readonly AssistantDailyEventStatus[];

export interface AssistantDailyEvidenceSummary {
  proofStatus: ProofStatus;
  totalEntries: number;
  evidencedEntries: number;
  missingEvidenceEntries: number;
  legacyUnverifiedEntries: number;
  evidencedSeconds: number;
  missingEvidenceSeconds: number;
  projectRepoCoverage: Record<string, string>;
}

export interface AssistantDailyProjectSummary {
  projectId: string;
  name: string;
  clientName?: string;
  totalSeconds: number;
  entryCount: number;
  evidenceStatus?: string;
  repoFullName?: string | null;
}

export interface AssistantDailySessionGroup {
  id: string;
  label: string;
  projectId?: string | null;
  projectName?: string | null;
  repoFullName?: string | null;
  sessionCount: number;
  themes: string[];
  matchStatus: string;
}

export interface AssistantDailyBlocker {
  id: string;
  label: string;
  severity: 'info' | 'warning' | 'critical';
  source: 'evidence' | 'session_group' | 'infra' | 'standup';
}

export interface AssistantDailySuggestion {
  id: string;
  label: string;
  reason: string;
  toolId?: AssistantToolId;
}

export interface AssistantDailyEvent {
  schema: typeof ASSISTANT_DAILY_EVENT_SCHEMA;
  eventId: string;
  date: string;
  memberId: string;
  generatedAt: string;
  standupRecordId?: string | null;
  projectSummaries: AssistantDailyProjectSummary[];
  sessionGroups: AssistantDailySessionGroup[];
  blockers: AssistantDailyBlocker[];
  suggestions: AssistantDailySuggestion[];
  evidenceSummary: AssistantDailyEvidenceSummary;
  workSummary: {
    totalEntries: number;
    totalDurationSeconds: number;
    evidencedEntries: number;
    missingEvidenceEntries: number;
  };
}

export interface AssistantDailyDeliveryResult {
  ok: boolean;
  channel?: 'worker' | 'bridge';
  status?: AssistantDailyEventStatus | 'unknown';
  message?: string;
  artifactRef?: string;
  fallbackAllowed?: boolean;
  retryableFallback?: boolean;
  workerError?: string | null;
  bridgeError?: string | null;
}

export interface AssistantDailyConfirmation {
  ok: boolean;
  status: AssistantDailyEventStatus | 'unknown';
  date: string;
  artifactRef: string | null;
  message?: string;
  checkedAt: string;
}

export interface AssistantDailySummary {
  date: string;
  title: string;
  yesterday: string;
  today: string;
  blockers: string;
  topSessionGroups: string[];
  missingProofNote: string | null;
}
