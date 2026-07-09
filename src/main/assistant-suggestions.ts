import { getSetting, setSetting } from '../db/database.js';
import type { AssistantContextSnapshot, AssistantContextSources } from './assistant-context.js';
import { buildAssistantContext } from './assistant-context.js';
import { buildOfflineAssistantSuggestions } from './assistant-runtime.js';
import type {
  AssistantSuggestion,
  AssistantSuggestionType,
  AssistantToolSafety,
} from '../shared/native-assistant.js';

export const ASSISTANT_SUGGESTION_DISMISSALS_SETTING_KEY = 'assistant.suggestionDismissals';
export const DEFAULT_ASSISTANT_SUGGESTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface AssistantSuggestionDismissal {
  dedupeKey: string;
  dismissedAt: string;
  cooldownUntil: string;
  type?: AssistantSuggestionType;
  projectId?: string | null;
  date?: string;
}

export interface AssistantSuggestionStorage {
  getDismissals(): Promise<AssistantSuggestionDismissal[]>;
  setDismissals(dismissals: AssistantSuggestionDismissal[]): Promise<void>;
}

export interface AssistantSuggestionStorageSettings {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

export interface BuildProactiveAssistantSuggestionsOptions {
  offlineSuggestions?: readonly AssistantSuggestion[];
  now?: Date | string | (() => Date);
  maxSuggestions?: number;
}

export interface ListProactiveAssistantSuggestionsOptions extends BuildProactiveAssistantSuggestionsOptions {
  storage?: AssistantSuggestionStorage | null;
}

export interface DismissAssistantSuggestionOptions {
  storage?: AssistantSuggestionStorage;
  now?: Date | string | (() => Date);
  cooldownMs?: number;
}

export interface FocusNudgeAssistantSuggestionsOptions extends ListProactiveAssistantSuggestionsOptions {
  context?: AssistantContextSnapshot;
  sources?: Partial<AssistantContextSources>;
}

interface SuggestionDraft {
  type: AssistantSuggestionType;
  title: string;
  body: string;
  confidence: number;
  safety: AssistantToolSafety;
  projectId?: string | null;
  date?: string;
  critical?: boolean;
  intent?: AssistantSuggestion['intent'];
  id?: string;
}

function toDate(value: Date | string | (() => Date) | undefined): Date {
  const next = typeof value === 'function' ? value() : value;
  const date = next instanceof Date ? new Date(next) : new Date(next ?? Date.now());
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Assistant suggestions require a valid date.');
  }
  return date;
}

function dateFromContext(context: AssistantContextSnapshot): string {
  return context.dateRange.from.slice(0, 10);
}

function safePart(value: string | null | undefined): string {
  return (value ?? 'global').replace(/[^a-zA-Z0-9_-]+/g, '_');
}

export function assistantSuggestionDedupeKey(input: {
  type: AssistantSuggestionType;
  projectId?: string | null;
  date?: string;
}): string {
  return [input.type, input.projectId ?? 'global', input.date ?? 'any'].join(':');
}

function suggestionId(input: {
  type: AssistantSuggestionType;
  projectId?: string | null;
  date?: string;
}): string {
  return `proactive_${safePart(input.type)}_${safePart(input.projectId)}_${safePart(input.date ?? 'any')}`;
}

function completeSuggestion(draft: SuggestionDraft, createdAt: string): AssistantSuggestion {
  const dedupeKey = assistantSuggestionDedupeKey(draft);
  return {
    id: draft.id ?? suggestionId(draft),
    type: draft.type,
    title: draft.title,
    body: draft.body,
    confidence: Math.max(0, Math.min(1, draft.confidence)),
    safety: draft.safety,
    ...(draft.intent ? { intent: draft.intent } : {}),
    ...(draft.projectId !== undefined ? { projectId: draft.projectId } : {}),
    ...(draft.date ? { date: draft.date } : {}),
    ...(draft.critical !== undefined ? { critical: draft.critical } : {}),
    dedupeKey,
    createdAt,
  };
}

function inferSuggestionType(suggestion: AssistantSuggestion): AssistantSuggestionType | null {
  if (suggestion.type) return suggestion.type;
  const toolId = suggestion.intent?.toolId;
  if (toolId === 'app.generateStandup') return 'standup';
  if (toolId === 'context.sessions' || toolId === 'app.acceptSession') return 'session_grouping';
  if (toolId === 'context.reports' || suggestion.id.includes('proof')) return 'missing_proof';
  if (toolId === 'app.navigate') {
    return suggestion.intent?.payload.routeKey === 'settings' ? 'check_settings' : 'navigate_reports';
  }
  if (toolId === 'app.syncProjects') return 'sync_projects';
  if (toolId === 'admin.modelConfig' || toolId === 'admin.diagnostics') return 'check_settings';
  return null;
}

function normalizeExternalSuggestion(
  suggestion: AssistantSuggestion,
  context: AssistantContextSnapshot,
  createdAt: string,
): AssistantSuggestion | null {
  const type = inferSuggestionType(suggestion);
  if (!type) return null;
  const date = suggestion.date
    ?? (typeof suggestion.intent?.payload.date === 'string' ? suggestion.intent.payload.date : undefined)
    ?? (type === 'standup' || type === 'missing_proof' ? dateFromContext(context) : undefined);
  const projectId = suggestion.projectId
    ?? (typeof suggestion.intent?.payload.projectId === 'string' ? suggestion.intent.payload.projectId : undefined);
  return {
    ...suggestion,
    type,
    ...(projectId !== undefined ? { projectId } : {}),
    ...(date ? { date } : {}),
    critical: suggestion.critical ?? type === 'missing_proof',
    dedupeKey: suggestion.dedupeKey ?? assistantSuggestionDedupeKey({ type, projectId, date }),
    createdAt: suggestion.createdAt ?? createdAt,
  };
}

function hasProjectSyncCandidate(context: AssistantContextSnapshot): boolean {
  const workerConnected = context.infra?.worker.connected === true;
  if (!workerConnected) return false;
  return context.projects.some((project) => (
    project.repo.required
    && (!project.repo.fullName || project.repo.status === 'missing' || project.repo.status === 'unverified')
  ));
}

function hasMissingProjectProof(context: AssistantContextSnapshot): boolean {
  return context.projects.some((project) => (
    project.evidenceStatus === 'missing'
    || project.evidenceStatus === 'sync_failed'
    || project.evidenceStatus === 'legacy_unverified'
  ));
}

function missingProofProjectIds(context: AssistantContextSnapshot): string[] {
  const ids = new Set<string>();
  for (const entry of context.entries) {
    if (
      entry.evidenceStatus === 'missing'
      || entry.evidenceStatus === 'sync_failed'
      || entry.evidenceStatus === 'legacy_unverified'
    ) {
      ids.add(entry.projectId);
    }
  }
  for (const project of context.projects) {
    if (
      project.evidenceStatus === 'missing'
      || project.evidenceStatus === 'sync_failed'
      || project.evidenceStatus === 'legacy_unverified'
    ) {
      ids.add(project.id);
    }
  }
  return [...ids].sort();
}

function offlineSuggestionsFromContext(
  context: AssistantContextSnapshot,
  now: Date,
): AssistantSuggestion[] {
  return buildOfflineAssistantSuggestions({
    todayDate: dateFromContext(context),
    todayEntries: context.entries.map((entry) => ({
      id: entry.id,
      description: entry.description,
      durationSeconds: entry.durationSeconds,
    })),
    hasStandupProofToday: Boolean(context.evidence?.standupEvidence),
    sessionScan: {
      totalPending: context.agentSessions.totalPending,
      readyPending: context.agentSessions.readyPending,
      candidates: context.agentSessions.candidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
      })),
    },
    bridgeStatus: {
      connected: context.infra?.thoughtseedBridge?.connected === true || context.infra?.worker.connected === true,
    },
    projectCache: { stale: hasProjectSyncCandidate(context) },
  }, () => now);
}

function localSuggestionDrafts(context: AssistantContextSnapshot): SuggestionDraft[] {
  const date = dateFromContext(context);
  const drafts: SuggestionDraft[] = [];
  const missingProjectIds = missingProofProjectIds(context);
  const hasMissingProof = missingProjectIds.length > 0 || hasMissingProjectProof(context);

  if (missingProjectIds.length > 0) {
    for (const projectId of missingProjectIds) {
      const project = context.projects.find((item) => item.id === projectId);
      drafts.push({
        type: 'missing_proof',
        projectId,
        date,
        critical: true,
        title: 'Repair missing proof',
        body: project
          ? `${project.name} has work that still needs evidence review for ${date}.`
          : `A work entry still needs evidence review for ${date}.`,
        confidence: 0.95,
        safety: 'read_only',
        intent: {
          toolId: 'context.reports',
          title: 'Review proof gaps',
          payload: { period: 'daily', date, projectId },
        },
      });
    }
  }

  if (context.workSummary.totalEntries > 0 && context.route?.routeKey !== 'reports') {
    drafts.push({
      type: 'navigate_reports',
      date,
      title: hasMissingProof ? 'Open proof reports' : 'Open today report',
      body: hasMissingProof
        ? 'Jump to reports to review the daily proof gap before standup.'
        : "Open today's report while the work context is still fresh.",
      confidence: hasMissingProof ? 0.82 : 0.68,
      safety: 'confirm_required',
      intent: {
        toolId: 'app.navigate',
        title: 'Open reports',
        payload: { routeKey: 'reports' },
      },
    });
  }

  if (context.infra && (
    context.infra.thoughtseedBridge?.configured !== true
    || context.infra.thoughtseedBridge?.connected !== true
    || context.agentSessions.enabled === false
  )) {
    drafts.push({
      type: 'check_settings',
      title: 'Check assistant settings',
      body: 'Assistant context is missing bridge connectivity or local session consent.',
      confidence: 0.72,
      safety: 'confirm_required',
      intent: {
        toolId: 'app.navigate',
        title: 'Open settings',
        payload: { routeKey: 'settings' },
      },
    });
  }

  return drafts;
}

function sortSuggestions(suggestions: readonly AssistantSuggestion[]): AssistantSuggestion[] {
  return [...suggestions].sort((a, b) => {
    const critical = Number(b.critical === true) - Number(a.critical === true);
    if (critical !== 0) return critical;
    const confidence = b.confidence - a.confidence;
    if (confidence !== 0) return confidence;
    return a.id.localeCompare(b.id);
  });
}

export function dedupeAssistantSuggestions(
  suggestions: readonly AssistantSuggestion[],
): AssistantSuggestion[] {
  const byKey = new Map<string, AssistantSuggestion>();
  for (const suggestion of suggestions) {
    const key = suggestion.dedupeKey;
    if (!key) continue;
    const existing = byKey.get(key);
    if (
      !existing
      || Number(suggestion.critical === true) > Number(existing.critical === true)
      || suggestion.confidence > existing.confidence
      || (suggestion.confidence === existing.confidence && suggestion.id < existing.id)
    ) {
      byKey.set(key, suggestion);
    }
  }
  return sortSuggestions([...byKey.values()]);
}

export function buildProactiveAssistantSuggestions(
  context: AssistantContextSnapshot,
  options: BuildProactiveAssistantSuggestionsOptions = {},
): AssistantSuggestion[] {
  const now = toDate(options.now ?? context.generatedAt);
  const createdAt = now.toISOString();
  const offline = options.offlineSuggestions
    ? [...options.offlineSuggestions]
    : offlineSuggestionsFromContext(context, now);
  const normalizedOffline = offline.flatMap((suggestion) => {
    const normalized = normalizeExternalSuggestion(suggestion, context, createdAt);
    return normalized ? [normalized] : [];
  });
  const local = localSuggestionDrafts(context).map((draft) => completeSuggestion(draft, createdAt));
  const suggestions = dedupeAssistantSuggestions([...normalizedOffline, ...local]);
  return typeof options.maxSuggestions === 'number'
    ? suggestions.slice(0, Math.max(0, Math.floor(options.maxSuggestions)))
    : suggestions;
}

function parseDismissals(raw: string | null): AssistantSuggestionDismissal[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): AssistantSuggestionDismissal[] => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Partial<AssistantSuggestionDismissal>;
      if (typeof row.dedupeKey !== 'string' || typeof row.dismissedAt !== 'string' || typeof row.cooldownUntil !== 'string') {
        return [];
      }
      return [{
        dedupeKey: row.dedupeKey,
        dismissedAt: row.dismissedAt,
        cooldownUntil: row.cooldownUntil,
        ...(row.type ? { type: row.type } : {}),
        ...(row.projectId !== undefined ? { projectId: row.projectId } : {}),
        ...(row.date ? { date: row.date } : {}),
      }];
    });
  } catch {
    return [];
  }
}

export function createSettingsAssistantSuggestionStorage(
  settings: AssistantSuggestionStorageSettings = { getSetting, setSetting },
): AssistantSuggestionStorage {
  return {
    async getDismissals() {
      return parseDismissals(await settings.getSetting(ASSISTANT_SUGGESTION_DISMISSALS_SETTING_KEY));
    },
    async setDismissals(dismissals) {
      await settings.setSetting(ASSISTANT_SUGGESTION_DISMISSALS_SETTING_KEY, JSON.stringify(dismissals));
    },
  };
}

function activeDismissals(
  dismissals: readonly AssistantSuggestionDismissal[],
  now: Date,
): AssistantSuggestionDismissal[] {
  const nowMs = now.getTime();
  return dismissals.filter((dismissal) => {
    const untilMs = Date.parse(dismissal.cooldownUntil);
    return Number.isFinite(untilMs) && untilMs > nowMs;
  });
}

export async function filterDismissedAssistantSuggestions(
  suggestions: readonly AssistantSuggestion[],
  storage: AssistantSuggestionStorage,
  nowInput: Date | string | (() => Date) = new Date(),
): Promise<AssistantSuggestion[]> {
  const now = toDate(nowInput);
  const dismissals = await storage.getDismissals();
  const active = activeDismissals(dismissals, now);
  if (active.length !== dismissals.length) {
    await storage.setDismissals(active);
  }
  const hidden = new Set(active.map((dismissal) => dismissal.dedupeKey));
  return suggestions.filter((suggestion) => !suggestion.dedupeKey || !hidden.has(suggestion.dedupeKey));
}

function nextUtcDayStart(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function cooldownUntilForSuggestion(
  suggestion: AssistantSuggestion,
  now: Date,
  cooldownMs: number,
): string {
  if (suggestion.type === 'missing_proof' && suggestion.critical && suggestion.date) {
    const nextDay = nextUtcDayStart(suggestion.date);
    if (nextDay) return nextDay;
  }
  return new Date(now.getTime() + cooldownMs).toISOString();
}

export async function dismissAssistantSuggestion(
  suggestion: AssistantSuggestion,
  options: DismissAssistantSuggestionOptions = {},
): Promise<AssistantSuggestionDismissal> {
  const now = toDate(options.now);
  const storage = options.storage ?? createSettingsAssistantSuggestionStorage();
  const dedupeKey = suggestion.dedupeKey
    ?? (suggestion.type
      ? assistantSuggestionDedupeKey({
        type: suggestion.type,
        projectId: suggestion.projectId,
        date: suggestion.date,
      })
      : suggestion.id);
  const dismissal: AssistantSuggestionDismissal = {
    dedupeKey,
    dismissedAt: now.toISOString(),
    cooldownUntil: cooldownUntilForSuggestion(
      suggestion,
      now,
      options.cooldownMs ?? DEFAULT_ASSISTANT_SUGGESTION_COOLDOWN_MS,
    ),
    ...(suggestion.type ? { type: suggestion.type } : {}),
    ...(suggestion.projectId !== undefined ? { projectId: suggestion.projectId } : {}),
    ...(suggestion.date ? { date: suggestion.date } : {}),
  };
  const existing = activeDismissals(await storage.getDismissals(), now)
    .filter((item) => item.dedupeKey !== dedupeKey);
  await storage.setDismissals([...existing, dismissal]);
  return dismissal;
}

export async function listProactiveAssistantSuggestions(
  context: AssistantContextSnapshot,
  options: ListProactiveAssistantSuggestionsOptions = {},
): Promise<AssistantSuggestion[]> {
  const now = toDate(options.now ?? context.generatedAt);
  const suggestions = buildProactiveAssistantSuggestions(context, { ...options, now });
  const storage = options.storage === undefined ? createSettingsAssistantSuggestionStorage() : options.storage;
  const filtered = storage
    ? await filterDismissedAssistantSuggestions(suggestions, storage, now)
    : suggestions;
  return typeof options.maxSuggestions === 'number'
    ? filtered.slice(0, Math.max(0, Math.floor(options.maxSuggestions)))
    : filtered;
}

export async function buildFocusNudgeAssistantSuggestions(
  options: FocusNudgeAssistantSuggestionsOptions = {},
): Promise<AssistantSuggestion[]> {
  const now = toDate(options.now);
  const context = options.context ?? await buildAssistantContext({
    contextScopes: ['today', 'project', 'task', 'session_group', 'infra', 'app'],
    dateRangeScope: 'today',
    now,
    sources: options.sources,
  });
  return listProactiveAssistantSuggestions(context, {
    ...options,
    now,
    maxSuggestions: options.maxSuggestions ?? 3,
  });
}
