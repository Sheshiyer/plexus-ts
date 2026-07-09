export type AssistantRole = 'user' | 'assistant' | 'system' | 'tool';

export type AssistantToolSafety = 'read_only' | 'confirm_required' | 'admin_only';

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
  | 'session_group'
  | 'infra'
  | 'app';

export type AssistantRouteKey =
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

export type AssistantModelProvider = 'google' | 'nvidia' | 'local' | 'auto' | 'mock';

export type AssistantConfiguredModelProvider = Exclude<AssistantModelProvider, 'auto'>;

export interface AssistantModelSettingsInput {
  provider?: AssistantModelProvider;
  googleModel?: string;
  nvidiaModel?: string;
  localModel?: string;
  localBaseUrl?: string;
  googleApiKey?: string | null;
  nvidiaApiKey?: string | null;
  clearGoogleKey?: boolean;
  clearNvidiaKey?: boolean;
}

export interface AssistantModelStatus {
  provider: AssistantModelProvider;
  googleModel: string;
  nvidiaModel: string;
  localModel: string;
  localBaseUrl: string | null;
  mockModel: string;
  selectedModelId: string | null;
  selectedProvider: AssistantConfiguredModelProvider | null;
  configuredProviders: AssistantConfiguredModelProvider[];
  hasGoogleKey: boolean;
  hasNvidiaKey: boolean;
}

export type AssistantModelOrigin = 'auto' | 'local' | 'cloud' | 'deterministic';

export type AssistantModelCatalogState =
  | 'ready'
  | 'missing_auth'
  | 'offline'
  | 'not_configured'
  | 'fallback_only';

export interface AssistantModelCapability {
  streaming: boolean;
  toolUse: boolean;
  reasoning: boolean;
  local: boolean;
  privacy: 'device' | 'provider' | 'deterministic' | 'routing';
}

export interface AssistantModelCatalogEntry {
  id: string;
  provider: AssistantModelProvider;
  model: string;
  label: string;
  origin: AssistantModelOrigin;
  source: string;
  state: AssistantModelCatalogState;
  configured: boolean;
  selectable: boolean;
  selected?: boolean;
  baseUrl?: string | null;
  requiresKey?: boolean;
  capabilities: AssistantModelCapability;
  message?: string;
}

export interface AssistantModelCatalog {
  selectedModelId: string | null;
  recommendedModelId: string;
  fallbackModelIds: string[];
  entries: AssistantModelCatalogEntry[];
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

export type AssistantStreamEvent =
  | { type: 'message_delta'; conversationId: string; delta: string }
  | { type: 'tool_call'; conversationId: string; toolId: AssistantToolId; callId: string; payload: Record<string, unknown> }
  | { type: 'tool_result'; conversationId: string; toolId: AssistantToolId; callId: string; result: Record<string, unknown> }
  | { type: 'suggestion'; conversationId: string; suggestion: AssistantSuggestion }
  | { type: 'error'; conversationId: string; message: string }
  | { type: 'done'; conversationId: string; messageId?: string };

export const ASSISTANT_DAILY_EVENT_SCHEMA = 'thoughtseed.plexus_daily_agent_event.v1' as const;

export type AssistantDailyEventStatus = 'queued' | 'sent' | 'failed';

export const ASSISTANT_DAILY_EVENT_STATUSES = [
  'queued',
  'sent',
  'failed',
] as const satisfies readonly AssistantDailyEventStatus[];

export interface AssistantDailyEvidenceSummary {
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
