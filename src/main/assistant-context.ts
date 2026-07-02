import { isSecretLikeKey, MAX_CONTEXT_ITEMS, MAX_SESSION_EXCERPT_CHARS, MAX_TEXT_CHARS_PER_ITEM } from './assistant-policy.js';
import { computeEvidenceSummary } from './evidence.js';
import type { AssistantContextScope } from '../shared/native-assistant.js';
import type {
  AgentSessionCandidate,
  AgentSessionMatchStatus,
  AgentSessionProvider,
  AgentSessionScanResult,
  FabricStatus,
  GitHubActivity,
  PaperclipInstallStatus,
  Project,
  StandupEvidenceRecord,
  ThoughtseedBridgeStatus,
  TimeEntry,
  UpdateStatus,
  WorkEvidenceSummary,
} from '../shared/types.js';

export type AssistantDateRangeScope = 'today' | 'week' | 'month';

export interface AssistantDateRange {
  scope: AssistantDateRangeScope;
  from: string;
  to: string;
}

export interface AssistantBudgetMetadata {
  limit: number;
  totalItems: number;
  droppedItems: number;
}

export interface AssistantBudgetResult<T> {
  items: T[];
  budget: AssistantBudgetMetadata;
}

export interface AssistantTextBudgetResult {
  text: string;
  maxChars: number;
  originalChars: number;
  truncated: boolean;
  omittedChars: number;
}

export interface AssistantProjectContext {
  id: string;
  name: string;
  clientName?: string;
  archived: boolean;
  evidenceStatus?: string;
  repo: {
    fullName?: string | null;
    url?: string | null;
    verifiedAt?: string | null;
    status?: string;
    required: boolean;
  };
}

export interface AssistantWorkEntryContext {
  id: string;
  projectId: string;
  description: string;
  startTime: string;
  endTime?: string | null;
  durationSeconds: number;
  targetSeconds?: number;
  tags: string[];
  evidenceStatus?: string;
  githubActivityIds: string[];
}

export interface AssistantWorkSummary {
  totalEntries: number;
  totalDurationSeconds: number;
  evidencedEntries: number;
  missingEvidenceEntries: number;
}

export interface AssistantTimerContext {
  running: boolean;
  entryId?: string;
  projectId?: string;
  description?: string;
  startTime?: string;
  targetSeconds?: number;
  elapsedSeconds?: number;
  paused?: boolean;
}

export interface AssistantEvidenceContext {
  summary: WorkEvidenceSummary;
  standupEvidence?: {
    id: string;
    date: string;
    totalSeconds: number;
    generatedAt: string;
  } | null;
}

export interface AssistantGitHubActivityContext {
  id: string;
  projectId: string;
  repoFullName: string;
  kind: GitHubActivity['kind'];
  title: string;
  url: string;
  actor?: string | null;
  occurredAt: string;
  metadata: unknown;
}

export interface AssistantAgentSessionContext {
  id: string;
  provider: AgentSessionProvider;
  providerSessionId?: string | null;
  sourceLabel: string;
  sourcePath?: string;
  repoRoot?: string | null;
  repoFullName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  startedAt: string;
  endedAt: string;
  lastSeenAt: string;
  title: string;
  summary?: string | null;
  confidence: number;
  confidenceReasons: string[];
  matchStatus: AgentSessionMatchStatus;
  status: AgentSessionCandidate['status'];
  durationSeconds: number;
  themes: string[];
}

export interface AssistantSessionGroup {
  id: string;
  key: string;
  label: string;
  projectId?: string | null;
  projectName?: string | null;
  repoRoot?: string | null;
  repoFullName?: string | null;
  normalizedTitle?: string;
  sessionCount: number;
  providerCounts: Partial<Record<AgentSessionProvider, number>>;
  earliestStartedAt: string;
  latestEndedAt: string;
  averageConfidence: number;
  matchStatus: AgentSessionMatchStatus;
  themes: string[];
  sessionIds: string[];
}

export interface AssistantAgentSessionsContext {
  enabled: boolean;
  consentState: 'enabled' | 'disabled';
  scanned: number;
  imported: number;
  totalPending: number;
  matchedPending: number;
  readyPending: number;
  message?: string;
  candidates: AssistantAgentSessionContext[];
  groups: AssistantSessionGroup[];
}

export interface AssistantInfraContext {
  worker: { connected: boolean; message?: string };
  thoughtseedBridge: {
    configured: boolean;
    connected: boolean;
    bridgeApiUrl: string;
    tenantId: string;
    memberId: string;
    credentialExpiresAt?: string | null;
    lastSeenAt?: string | null;
    lastError?: string | null;
  } | null;
  updates: {
    state: UpdateStatus['state'];
    currentVersion: string;
    channel: string;
    availableVersion?: string;
    updatedAt: string;
    message?: string;
    error?: string;
  } | null;
  optionalHelpers: {
    fabric?: {
      checkedAt: string;
      bridgeReachable: boolean;
      summary: FabricStatus['summary'];
      reachablePorts: number;
    };
    paperclip?: PaperclipInstallStatus;
  };
}

export interface AssistantRouteContext {
  routeKey: string;
  selectedProjectId?: string | null;
  updatedAt: string;
}

export interface AssistantContextSnapshot {
  generatedAt: string;
  requestedScopes: AssistantContextScope[];
  dateRange: AssistantDateRange;
  projects: AssistantProjectContext[];
  entries: AssistantWorkEntryContext[];
  workSummary: AssistantWorkSummary;
  timer: AssistantTimerContext;
  evidence: AssistantEvidenceContext | null;
  githubActivity: AssistantGitHubActivityContext[];
  agentSessions: AssistantAgentSessionsContext;
  sessionGroups: AssistantSessionGroup[];
  infra: AssistantInfraContext | null;
  route: AssistantRouteContext | null;
  budget: Record<string, AssistantBudgetMetadata>;
}

export interface AssistantContextSources {
  listProjects: () => Promise<Project[]>;
  listEntries: (from: string, to: string) => Promise<TimeEntry[]>;
  getRunningEntry: () => Promise<TimeEntry | null>;
  listGitHubActivity: (projectId: string, from: string, to: string) => Promise<GitHubActivity[]>;
  agentSessionStatus: () => Promise<AgentSessionScanResult>;
  workerStatus: () => Promise<{ connected: boolean; message?: string }>;
  thoughtseedBridgeStatus: () => Promise<ThoughtseedBridgeStatus>;
  getUpdateStatus: () => Promise<UpdateStatus> | UpdateStatus;
  getStandupEvidenceRecord?: (date: string) => Promise<StandupEvidenceRecord | null> | StandupEvidenceRecord | null;
  getFabricStatus?: () => Promise<FabricStatus>;
  getPaperclipInstallStatus?: () => Promise<PaperclipInstallStatus>;
}

export interface BuildAssistantContextInput {
  contextScopes?: AssistantContextScope[];
  dateRangeScope?: AssistantDateRangeScope;
  now?: Date | string;
  projectId?: string;
  includeAdminDiagnostics?: boolean;
  includeOptionalHelpers?: boolean;
  routeState?: AssistantRouteContext | null;
  sources?: Partial<AssistantContextSources>;
}

const EMPTY_BUDGET: AssistantBudgetMetadata = { limit: MAX_CONTEXT_ITEMS, totalItems: 0, droppedItems: 0 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_CONTEXT_RANGE_DAYS = 31;

let currentRouteState: AssistantRouteContext | null = null;

export function defaultAssistantContextSources(): AssistantContextSources {
  return {
    async listProjects() {
      const database = await import('../db/database.js');
      return database.listProjects();
    },
    async listEntries(from, to) {
      const database = await import('../db/database.js');
      return database.listEntries(from, to);
    },
    async getRunningEntry() {
      const database = await import('../db/database.js');
      return database.getRunningEntry();
    },
    async listGitHubActivity(projectId, from, to) {
      const database = await import('../db/database.js');
      return database.listGitHubActivity(projectId, from, to);
    },
    async agentSessionStatus() {
      const sessions = await import('./agent-sessions.js');
      return sessions.agentSessionStatus();
    },
    async workerStatus() {
      const teamforge = await import('./teamforge.js');
      return teamforge.workerStatus();
    },
    async thoughtseedBridgeStatus() {
      const bridge = await import('./thoughtseed-bridge.js');
      return bridge.getThoughtseedBridgeStatus();
    },
    async getUpdateStatus() {
      const updates = await import('./updates.js');
      return updates.getUpdateStatus();
    },
    async getFabricStatus() {
      const fabric = await import('./fabric.js');
      return fabric.getFabricStatus();
    },
    async getPaperclipInstallStatus() {
      const fabric = await import('./fabric.js');
      return fabric.getPaperclipInstallStatus();
    },
  };
}

export function assistantDateRange(scope: AssistantDateRangeScope = 'today', now: Date | string = new Date()): AssistantDateRange {
  const base = typeof now === 'string' ? new Date(now) : new Date(now);
  if (!Number.isFinite(base.getTime())) {
    throw new Error('Assistant context date range requires a valid now value.');
  }

  let start: Date;
  let end: Date;
  if (scope === 'month') {
    start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  } else {
    const todayStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0));
    if (scope === 'week') {
      const day = todayStart.getUTCDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      start = new Date(todayStart.getTime() + mondayOffset * MS_PER_DAY);
      end = new Date(start.getTime() + 7 * MS_PER_DAY);
    } else {
      start = todayStart;
      end = new Date(start.getTime() + MS_PER_DAY);
    }
  }

  const range = { scope, from: start.toISOString(), to: end.toISOString() };
  validateAssistantDateRange(range.from, range.to);
  return range;
}

export function validateAssistantDateRange(from: string, to: string): void {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    throw new Error('Assistant context date range must use valid ISO timestamps.');
  }
  if (toMs <= fromMs) {
    throw new Error('Assistant context date range must end after it starts.');
  }
  if (toMs - fromMs > MAX_CONTEXT_RANGE_DAYS * MS_PER_DAY) {
    throw new Error('Assistant context date range cannot exceed 31 days.');
  }
}

export function limitAssistantItems<T>(items: readonly T[], limit = MAX_CONTEXT_ITEMS): AssistantBudgetResult<T> {
  const safeLimit = Math.max(0, Math.floor(limit));
  const next = items.slice(0, safeLimit);
  return {
    items: next,
    budget: {
      limit: safeLimit,
      totalItems: items.length,
      droppedItems: Math.max(0, items.length - next.length),
    },
  };
}

export function limitAssistantText(text: string, maxChars = MAX_TEXT_CHARS_PER_ITEM): AssistantTextBudgetResult {
  const safeMax = Math.max(0, Math.floor(maxChars));
  const next = text.length > safeMax ? text.slice(0, safeMax) : text;
  return {
    text: next,
    maxChars: safeMax,
    originalChars: text.length,
    truncated: next.length !== text.length,
    omittedChars: Math.max(0, text.length - next.length),
  };
}

export function redactForAssistant(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}

export function updateAssistantRouteContext(
  route: { routeKey: string; selectedProjectId?: string | null },
  now: Date | string = new Date(),
): AssistantRouteContext {
  const updatedAt = isoNow(now);
  currentRouteState = {
    routeKey: limitAssistantText(route.routeKey, 160).text,
    selectedProjectId: route.selectedProjectId ?? null,
    updatedAt,
  };
  return currentRouteState;
}

export function getAssistantRouteContext(): AssistantRouteContext | null {
  return currentRouteState ? { ...currentRouteState } : null;
}

export async function buildAssistantContext(input: BuildAssistantContextInput = {}): Promise<AssistantContextSnapshot> {
  const generatedAt = isoNow(input.now ?? new Date());
  const requestedScopes = [...new Set(input.contextScopes ?? [])];
  const scopeSet = new Set(requestedScopes);
  const dateRange = assistantDateRange(input.dateRangeScope ?? (scopeSet.has('week') ? 'week' : 'today'), generatedAt);
  const sources = { ...defaultAssistantContextSources(), ...input.sources };
  const budget: Record<string, AssistantBudgetMetadata> = {};

  const shouldLoadTemporalContext = scopeSet.has('today') || scopeSet.has('week');
  const shouldLoadProjects = scopeSet.has('project') || shouldLoadTemporalContext;

  let projects: Project[] = [];
  if (shouldLoadProjects) {
    projects = filterProjects(await sources.listProjects(), input.projectId);
  }

  let entries: TimeEntry[] = [];
  if (shouldLoadTemporalContext) {
    entries = filterEntriesByProject(await sources.listEntries(dateRange.from, dateRange.to), input.projectId);
  }

  const projectBudget = limitAssistantItems(projectsToContext(projects), MAX_CONTEXT_ITEMS);
  budget.projects = projectBudget.budget;

  const entryBudget = limitAssistantItems(entries.map(entryToContext), MAX_CONTEXT_ITEMS);
  budget.entries = entryBudget.budget;

  const workSummary = summarizeWork(entryBudget.items);
  const timer = shouldLoadTemporalContext
    ? timerToContext(await sources.getRunningEntry(), generatedAt)
    : { running: false };

  const evidence = shouldLoadTemporalContext
    ? await buildEvidenceContext(entries, projects, dateRange, sources)
    : null;

  const githubActivity = shouldLoadTemporalContext
    ? await buildGitHubActivityContext(projects, dateRange, sources)
    : { items: [], budget: EMPTY_BUDGET };
  budget.githubActivity = githubActivity.budget;

  const agentSessionScan = scopeSet.has('session_group') ? await sources.agentSessionStatus() : null;
  const agentSessions = agentSessionScan
    ? buildAgentSessionsContext(agentSessionScan, input.includeAdminDiagnostics === true)
    : emptyAgentSessionsContext();
  budget.agentSessions = agentSessionScan
    ? limitAssistantItems(agentSessionScan.candidates, MAX_CONTEXT_ITEMS).budget
    : EMPTY_BUDGET;
  budget.sessionGroups = agentSessionScan
    ? limitAssistantItems(groupAssistantSessions(agentSessionScan.candidates), MAX_CONTEXT_ITEMS).budget
    : EMPTY_BUDGET;

  const infra = scopeSet.has('infra')
    ? await buildInfraContext(sources, input.includeOptionalHelpers === true)
    : null;

  const route = scopeSet.has('app')
    ? input.routeState ?? getAssistantRouteContext()
    : null;

  return {
    generatedAt,
    requestedScopes,
    dateRange,
    projects: projectBudget.items,
    entries: entryBudget.items,
    workSummary,
    timer,
    evidence,
    githubActivity: githubActivity.items,
    agentSessions,
    sessionGroups: agentSessions.groups,
    infra,
    route,
    budget,
  };
}

export function groupAssistantSessions(candidates: readonly AgentSessionCandidate[]): AssistantSessionGroup[] {
  const groups = new Map<string, AgentSessionCandidate[]>();
  for (const candidate of candidates) {
    const key = sessionGroupKey(candidate);
    const existing = groups.get(key) ?? [];
    existing.push(candidate);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .map(([key, rows]) => sessionGroupFromCandidates(key, rows))
    .sort((a, b) => {
      const latest = Date.parse(b.latestEndedAt) - Date.parse(a.latestEndedAt);
      if (latest !== 0) return latest;
      return a.label.localeCompare(b.label);
    });
}

export function extractAssistantSessionThemes(candidate: Pick<AgentSessionCandidate, 'title' | 'projectName' | 'repoFullName' | 'confidenceReasons'>): string[] {
  const haystack = [
    candidate.title,
    candidate.projectName ?? '',
    candidate.repoFullName ?? '',
    ...candidate.confidenceReasons,
  ].join(' ').toLowerCase();

  const themeRules: [string, RegExp][] = [
    ['release', /\b(release|ship|shipping|publish|version|ota)\b/],
    ['review', /\b(review|audit|critique|readiness)\b/],
    ['bugfix', /\b(bug|bugfix|fix|failure|error|regression|issue|crash)\b/],
    ['design', /\b(design|ux|ui|visual|brand|layout)\b/],
    ['planning', /\b(plan|planning|roadmap|spec|architecture|proposal)\b/],
    ['deploy', /\b(deploy|deployment|production|vercel|cloudflare|release workflow)\b/],
    ['docs', /\b(doc|docs|documentation|readme|guide)\b/],
    ['test', /\b(test|tests|vitest|playwright|smoke|typecheck)\b/],
    ['assistant', /\b(assistant|runtime|context|gateway|model)\b/],
    ['infra', /\b(infra|worker|bridge|ipc|database|migration|schema)\b/],
  ];

  const matches = themeRules.flatMap(([theme, pattern]) => pattern.test(haystack) ? [theme] : []);
  return matches.length > 0 ? matches : ['work'];
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return limitAssistantText(value, MAX_TEXT_CHARS_PER_ITEM).text;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSecretLikeKey(key) ? '[redacted]' : redactValue(item, seen);
  }
  return output;
}

function projectsToContext(projects: readonly Project[]): AssistantProjectContext[] {
  return [...projects]
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name))
    .map((project) => ({
      id: project.id,
      name: limitAssistantText(project.name, 240).text,
      clientName: project.clientName ? limitAssistantText(project.clientName, 240).text : undefined,
      archived: project.archived,
      evidenceStatus: project.evidenceStatus,
      repo: {
        fullName: project.githubRepoFullName ?? null,
        url: project.githubRepoUrl ?? null,
        verifiedAt: project.repoVerifiedAt ?? null,
        status: project.repoEvidenceStatus,
        required: project.repoRequired !== false,
      },
    }));
}

function entryToContext(entry: TimeEntry): AssistantWorkEntryContext {
  return {
    id: entry.id,
    projectId: entry.projectId,
    description: limitAssistantText(entry.description, MAX_TEXT_CHARS_PER_ITEM).text,
    startTime: entry.startTime,
    endTime: entry.endTime ?? null,
    durationSeconds: entry.durationSeconds,
    targetSeconds: entry.targetSeconds,
    tags: [...entry.tags],
    evidenceStatus: entry.evidenceStatus,
    githubActivityIds: [...(entry.githubActivityIds ?? [])],
  };
}

function summarizeWork(entries: readonly AssistantWorkEntryContext[]): AssistantWorkSummary {
  return {
    totalEntries: entries.length,
    totalDurationSeconds: entries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
    evidencedEntries: entries.filter((entry) => entry.evidenceStatus === 'matched').length,
    missingEvidenceEntries: entries.filter((entry) => entry.evidenceStatus && entry.evidenceStatus !== 'matched').length,
  };
}

function timerToContext(entry: TimeEntry | null, nowIso: string): AssistantTimerContext {
  if (!entry) return { running: false };
  const end = entry.pausedAt ?? nowIso;
  const elapsedSeconds = Math.max(0, Math.floor((Date.parse(end) - Date.parse(entry.startTime)) / 1000) - (entry.pausedSeconds ?? 0));
  return {
    running: true,
    paused: Boolean(entry.pausedAt),
    entryId: entry.id,
    projectId: entry.projectId,
    description: limitAssistantText(entry.description, MAX_TEXT_CHARS_PER_ITEM).text,
    startTime: entry.startTime,
    targetSeconds: entry.targetSeconds,
    elapsedSeconds: Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0,
  };
}

async function buildEvidenceContext(
  entries: readonly TimeEntry[],
  projects: readonly Project[],
  range: AssistantDateRange,
  sources: AssistantContextSources,
): Promise<AssistantEvidenceContext> {
  const summary = computeEvidenceSummary([...entries], [...projects]);
  const date = range.from.slice(0, 10);
  const standup = await sources.getStandupEvidenceRecord?.(date) ?? null;
  return {
    summary,
    standupEvidence: standup ? {
      id: standup.id,
      date: standup.date,
      totalSeconds: standup.totalSeconds,
      generatedAt: standup.generatedAt,
    } : null,
  };
}

async function buildGitHubActivityContext(
  projects: readonly Project[],
  range: AssistantDateRange,
  sources: AssistantContextSources,
): Promise<AssistantBudgetResult<AssistantGitHubActivityContext>> {
  const activity = (await Promise.all(projects.map((project) => sources.listGitHubActivity(project.id, range.from, range.to)))).flat();
  const sorted = activity.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return limitAssistantItems(sorted.map((item) => ({
    id: item.id,
    projectId: item.projectId,
    repoFullName: item.repoFullName,
    kind: item.kind,
    title: limitAssistantText(item.title, MAX_TEXT_CHARS_PER_ITEM).text,
    url: item.url,
    actor: item.actor ?? null,
    occurredAt: item.occurredAt,
    metadata: redactForAssistant(item.metadata),
  })), MAX_CONTEXT_ITEMS);
}

function buildAgentSessionsContext(scan: AgentSessionScanResult, includeAdminDiagnostics: boolean): AssistantAgentSessionsContext {
  const candidateBudget = limitAssistantItems(scan.candidates.map((candidate) => agentSessionToContext(candidate, includeAdminDiagnostics)), MAX_CONTEXT_ITEMS);
  const groupBudget = limitAssistantItems(groupAssistantSessions(scan.candidates), MAX_CONTEXT_ITEMS);
  return {
    enabled: scan.enabled,
    consentState: scan.enabled ? 'enabled' : 'disabled',
    scanned: scan.scanned,
    imported: scan.imported,
    totalPending: scan.totalPending,
    matchedPending: scan.matchedPending,
    readyPending: scan.readyPending,
    message: scan.message,
    candidates: candidateBudget.items,
    groups: groupBudget.items,
  };
}

function emptyAgentSessionsContext(): AssistantAgentSessionsContext {
  return {
    enabled: false,
    consentState: 'disabled',
    scanned: 0,
    imported: 0,
    totalPending: 0,
    matchedPending: 0,
    readyPending: 0,
    candidates: [],
    groups: [],
  };
}

function agentSessionToContext(candidate: AgentSessionCandidate, includeAdminDiagnostics: boolean): AssistantAgentSessionContext {
  const durationSeconds = Math.max(0, Math.floor((Date.parse(candidate.endedAt) - Date.parse(candidate.startedAt)) / 1000));
  const context: AssistantAgentSessionContext = {
    id: candidate.id,
    provider: candidate.provider,
    providerSessionId: candidate.providerSessionId ?? null,
    sourceLabel: limitAssistantText(candidate.sourceLabel, MAX_TEXT_CHARS_PER_ITEM).text,
    repoFullName: candidate.repoFullName ?? null,
    projectId: candidate.projectId ?? null,
    projectName: candidate.projectName ?? null,
    startedAt: candidate.startedAt,
    endedAt: candidate.endedAt,
    lastSeenAt: candidate.lastSeenAt,
    title: limitAssistantText(candidate.title, MAX_SESSION_EXCERPT_CHARS).text,
    summary: candidate.summary ? limitAssistantText(candidate.summary, MAX_SESSION_EXCERPT_CHARS).text : null,
    confidence: candidate.confidence,
    confidenceReasons: candidate.confidenceReasons.map((reason) => limitAssistantText(reason, MAX_TEXT_CHARS_PER_ITEM).text),
    matchStatus: candidate.matchStatus,
    status: candidate.status,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    themes: extractAssistantSessionThemes(candidate),
  };
  if (includeAdminDiagnostics) {
    context.sourcePath = candidate.sourcePath;
    context.repoRoot = candidate.repoRoot ?? null;
  }
  return context;
}

function sessionGroupFromCandidates(key: string, candidates: AgentSessionCandidate[]): AssistantSessionGroup {
  const sorted = [...candidates].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const first = sorted[0];
  const providerCounts: Partial<Record<AgentSessionProvider, number>> = {};
  for (const candidate of sorted) {
    providerCounts[candidate.provider] = (providerCounts[candidate.provider] ?? 0) + 1;
  }
  const themes = unique(sorted.flatMap(extractAssistantSessionThemes));
  const averageConfidence = Math.round(sorted.reduce((sum, candidate) => sum + candidate.confidence, 0) / sorted.length);
  const latestEndedAt = sorted.reduce((latest, candidate) => Date.parse(candidate.endedAt) > Date.parse(latest) ? candidate.endedAt : latest, first.endedAt);
  const normalizedTitle = normalizedTitleFor(first.title);

  return {
    id: `group_${stableSlug(key)}`,
    key,
    label: first.projectName ?? first.repoFullName ?? normalizedTitle,
    projectId: first.projectId ?? null,
    projectName: first.projectName ?? null,
    repoRoot: first.repoRoot ?? null,
    repoFullName: first.repoFullName ?? null,
    normalizedTitle,
    sessionCount: sorted.length,
    providerCounts,
    earliestStartedAt: first.startedAt,
    latestEndedAt,
    averageConfidence,
    matchStatus: rollupMatchStatus(sorted),
    themes,
    sessionIds: sorted.map((candidate) => candidate.id),
  };
}

function sessionGroupKey(candidate: AgentSessionCandidate): string {
  if (candidate.projectId) return `project:${candidate.projectId}`;
  if (candidate.repoRoot) return `repoRoot:${candidate.repoRoot.toLowerCase()}`;
  if (candidate.repoFullName) return `repo:${candidate.repoFullName.toLowerCase()}`;
  return `title:${normalizedTitleFor(candidate.title)}`;
}

function normalizedTitleFor(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !['agent', 'assistant', 'session', 'work', 'the', 'and', 'for'].includes(word))
    .slice(0, 6);
  return words.join(' ') || 'untitled';
}

function rollupMatchStatus(candidates: readonly AgentSessionCandidate[]): AgentSessionMatchStatus {
  if (candidates.every((candidate) => candidate.matchStatus === 'ready')) return 'ready';
  if (candidates.some((candidate) => candidate.matchStatus === 'needs_project')) return 'needs_project';
  if (candidates.some((candidate) => candidate.matchStatus === 'repo_unverified')) return 'repo_unverified';
  return 'low_confidence';
}

async function buildInfraContext(sources: AssistantContextSources, includeOptionalHelpers: boolean): Promise<AssistantInfraContext> {
  const [worker, bridge, updates] = await Promise.all([
    sources.workerStatus(),
    sources.thoughtseedBridgeStatus().catch(() => null),
    Promise.resolve(sources.getUpdateStatus()).catch(() => null),
  ]);

  const optionalHelpers: AssistantInfraContext['optionalHelpers'] = {};
  if (includeOptionalHelpers && sources.getFabricStatus) {
    const fabric = await sources.getFabricStatus().catch(() => null);
    if (fabric) {
      optionalHelpers.fabric = {
        checkedAt: fabric.checkedAt,
        bridgeReachable: fabric.bridge.reachable,
        summary: fabric.summary,
        reachablePorts: fabric.ports.filter((port) => port.reachable).length,
      };
    }
  }
  if (includeOptionalHelpers && sources.getPaperclipInstallStatus) {
    const paperclip = await sources.getPaperclipInstallStatus().catch(() => null);
    if (paperclip) optionalHelpers.paperclip = paperclip;
  }

  return {
    worker,
    thoughtseedBridge: bridge ? {
      configured: bridge.configured,
      connected: bridge.connected,
      bridgeApiUrl: bridge.bridgeApiUrl,
      tenantId: bridge.tenantId,
      memberId: bridge.memberId,
      credentialExpiresAt: bridge.tokenExpiresAt ?? null,
      lastSeenAt: bridge.lastSeenAt ?? null,
      lastError: bridge.lastError ?? null,
    } : null,
    updates: updates ? {
      state: updates.state,
      currentVersion: updates.currentVersion,
      channel: updates.channel,
      availableVersion: updates.availableVersion,
      updatedAt: updates.updatedAt,
      message: updates.message,
      error: updates.error,
    } : null,
    optionalHelpers,
  };
}

function filterProjects(projects: readonly Project[], projectId?: string): Project[] {
  return projectId ? projects.filter((project) => project.id === projectId) : [...projects];
}

function filterEntriesByProject(entries: readonly TimeEntry[], projectId?: string): TimeEntry[] {
  return projectId ? entries.filter((entry) => entry.projectId === projectId) : [...entries];
}

function isoNow(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Assistant context requires a valid timestamp.');
  return date.toISOString();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function stableSlug(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug.slice(0, 80) || 'session';
}
