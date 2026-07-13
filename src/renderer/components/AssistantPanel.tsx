import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AssistantContextScope,
  AssistantModelStatus,
  AssistantStreamEvent,
  AssistantSuggestion,
  AssistantTurnRequest,
  Project,
  TemperanceSkillRecommendation,
  TodaySnapshot,
} from '../../shared/types';
import { hasVerifiedGitHubRepository } from '../../shared/github-repository-authority';
import { Button, PageHeader, fmtHM, localDateString } from './ui';
import { IconSync } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  StatusChip,
} from './PlexusUI';
import AssistantActionConfirmModal, {
  type AssistantActionResult,
  type AssistantPendingIntent,
} from './AssistantActionConfirmModal';
import AssistantComposer from './AssistantComposer';
import AssistantContextDrawer, {
  type AssistantContextSection,
  type AssistantOptionalHelperStatus,
} from './AssistantContextDrawer';
import AssistantMessageList, { type AssistantUiMessage } from './AssistantMessageList';
import AssistantSuggestionRail from './AssistantSuggestionRail';

interface ConversationItem {
  id: string;
  title: string;
  detail: string;
  updatedAt: string;
}

interface AssistantRendererApi {
  assistantStatus?: () => Promise<{ ok?: boolean; state?: string; message?: string; enabled?: boolean }>;
  assistantAsk?: (input: AssistantTurnRequest) => Promise<unknown>;
  assistantSuggestions?: (input?: { contextScopes?: AssistantContextScope[]; limit?: number }) => Promise<unknown>;
  onAssistantEvent?: (callback: (event: AssistantStreamEvent) => void) => () => void;
}

interface AssistantContextState {
  sections: AssistantContextSection[];
  helpers: AssistantOptionalHelperStatus[];
  generatedAt: string | null;
  loading: boolean;
  error: string | null;
  todayEntries: number;
  totalSeconds: number;
  readySessions: number;
  workerConnected: boolean;
  temperanceRecommendations: TemperanceSkillRecommendation[];
}

const STARTER_CONVERSATIONS: ConversationItem[] = [
  { id: 'today', title: 'Today', detail: 'proof, timer, standup', updatedAt: new Date().toISOString() },
  { id: 'sessions', title: 'Sessions', detail: 'local AI review queue', updatedAt: new Date().toISOString() },
  { id: 'infra', title: 'Infra', detail: 'Worker, bridge, helpers', updatedAt: new Date().toISOString() },
];

export default function AssistantPanel({
  projects,
  surface = 'page',
  todaySnapshot,
}: {
  projects: Project[];
  surface?: 'page' | 'sidechat' | 'settings';
  todaySnapshot?: TodaySnapshot | null;
}) {
  const [conversations, setConversations] = useState<ConversationItem[]>(STARTER_CONVERSATIONS);
  const [conversationId, setConversationId] = useState(STARTER_CONVERSATIONS[0].id);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, AssistantUiMessage[]>>(() => ({
    today: seedMessages('today'),
    sessions: seedMessages('sessions'),
    infra: seedMessages('infra'),
  }));
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [pendingIntent, setPendingIntent] = useState<AssistantPendingIntent | null>(null);
  const [contextState, setContextState] = useState<AssistantContextState>(() => emptyContextState());
  const [runtimeState, setRuntimeState] = useState<{ label: string; tone: 'accent' | 'mint' | 'warning' | 'error' | 'idle'; message: string }>({
    label: 'local mode',
    tone: 'warning',
    message: 'Assistant IPC is optional in this build; renderer fallbacks are active.',
  });
  const [modelStatus, setModelStatus] = useState<AssistantModelStatus | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentMessages = messagesByConversation[conversationId] ?? [];
  const selectedConversation = conversations.find((item) => item.id === conversationId) ?? conversations[0];
  const todaySnapshotSeconds = todaySnapshot
    ? todaySnapshot.totals.trackedSeconds + todaySnapshot.totals.activeSeconds
    : null;
  const providerLabel = modelStatus?.selectedProvider
    ?? modelStatus?.provider
    ?? todaySnapshot?.assistant.modelProvider
    ?? runtimeState.label;

  const appendMessage = useCallback((targetId: string, message: AssistantUiMessage) => {
    setMessagesByConversation((current) => ({
      ...current,
      [targetId]: [...(current[targetId] ?? []), message],
    }));
    setConversations((current) => current.map((item) => (
      item.id === targetId ? { ...item, updatedAt: message.createdAt } : item
    )));
  }, []);

  const applyStreamEvent = useCallback((event: AssistantStreamEvent) => {
    if (event.conversationId !== conversationId) return;
    if (event.type === 'message_delta') {
      setMessagesByConversation((current) => {
        const messages = current[conversationId] ?? [];
        const last = messages[messages.length - 1];
        if (last?.id === `stream:${conversationId}`) {
          return {
            ...current,
            [conversationId]: [...messages.slice(0, -1), { ...last, content: `${last.content}${event.delta}` }],
          };
        }
        return {
          ...current,
          [conversationId]: [...messages, assistantMessage(event.delta, { id: `stream:${conversationId}`, status: 'streaming', provider: providerLabel })],
        };
      });
      return;
    }
    if (event.type === 'tool_call') {
      appendMessage(conversationId, toolMessage(`Requested ${event.toolId}; payload summary has ${Object.keys(event.payload).length} field${Object.keys(event.payload).length === 1 ? '' : 's'}.`, event.toolId));
      return;
    }
    if (event.type === 'tool_result') {
      appendMessage(conversationId, toolMessage(`Received ${event.toolId} result with ${Object.keys(event.result).length} field${Object.keys(event.result).length === 1 ? '' : 's'}.`, event.toolId));
      return;
    }
    if (event.type === 'suggestion') {
      setSuggestions((current) => mergeSuggestions(current, [event.suggestion]));
      return;
    }
    if (event.type === 'error') {
      appendMessage(conversationId, errorMessage(event.message));
      setStreaming(false);
      return;
    }
    if (event.type === 'done') {
      setStreaming(false);
      setMessagesByConversation((current) => {
        const messages = current[conversationId] ?? [];
        return {
          ...current,
          [conversationId]: messages.map((message) => (
            message.id === `stream:${conversationId}` ? { ...message, status: 'done' } : message
          )),
        };
      });
    }
  }, [appendMessage, conversationId, providerLabel]);

  const loadRuntime = useCallback(async () => {
    const api = window.plexus as typeof window.plexus & AssistantRendererApi;
    const hasAsk = typeof api.assistantAsk === 'function';
    try {
      const [runtime, model] = await Promise.allSettled([
        api.assistantStatus?.(),
        window.plexus.assistantModelStatus?.(),
      ]);
      if (model.status === 'fulfilled' && model.value) setModelStatus(model.value);
      if (runtime.status === 'fulfilled' && runtime.value) {
        const value = runtime.value;
        setRuntimeState({
          label: value.state ?? (value.enabled === false ? 'disabled' : hasAsk ? 'runtime ready' : 'local mode'),
          tone: value.enabled === false ? 'idle' : value.ok === false ? 'warning' : hasAsk ? 'accent' : 'warning',
          message: value.message ?? (hasAsk ? 'Assistant runtime IPC is available.' : 'Renderer fallbacks are active.'),
        });
      } else {
        setRuntimeState({
          label: hasAsk ? 'runtime ready' : 'local mode',
          tone: hasAsk ? 'accent' : 'warning',
          message: hasAsk ? 'Assistant ask method is available.' : 'Assistant IPC is not exposed yet; local state remains usable.',
        });
      }
    } catch (err: any) {
      setRuntimeState({ label: 'degraded', tone: 'error', message: err?.message ?? String(err) });
    }
  }, []);

  const loadContext = useCallback(async () => {
    setContextState((current) => ({ ...current, loading: true, error: null }));
    const today = localDateString();
    const from = `${today}T00:00:00.000Z`;
    const to = `${today}T23:59:59.999Z`;
    const [projectResult, entryResult, sessionResult, workerResult, bridgeResult, fabricResult, dispatchResult] = await Promise.allSettled([
      window.plexus.projectList(),
      window.plexus.entryList(from, to),
      window.plexus.agentSessionStatus(),
      window.plexus.workerStatus(),
      window.plexus.thoughtseedBridgeStatus(),
      window.plexus.fabricStatus(),
      window.plexus.thoughtseedDispatchLanes(),
    ]);

    const projectList = todaySnapshot?.projects ?? (projectResult.status === 'fulfilled' ? projectResult.value : projects);
    const entries = entryResult.status === 'fulfilled' ? entryResult.value : [];
    const sessions = sessionResult.status === 'fulfilled' ? sessionResult.value : null;
    const worker = workerResult.status === 'fulfilled' ? workerResult.value : null;
    const bridge = bridgeResult.status === 'fulfilled' ? bridgeResult.value : null;
    const fabric = fabricResult.status === 'fulfilled' ? fabricResult.value : null;
    const dispatch = dispatchResult.status === 'fulfilled' ? dispatchResult.value : null;
    const verifiedProjects = projectList.filter(hasVerifiedGitHubRepository).length;
    const totalSeconds = todaySnapshotSeconds ?? entries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
    const todayEntries = todaySnapshot?.totals.entryCount ?? entries.length;
    const readySessions = todaySnapshot?.sessions.ready ?? sessions?.readyPending ?? 0;
    const sessionsEnabled = todaySnapshot?.sessions.enabled ?? sessions?.enabled ?? false;
    const pendingSessions = todaySnapshot?.sessions.pending ?? sessions?.totalPending ?? 0;
    const sections: AssistantContextSection[] = [
      { key: 'today', label: 'Today work log', included: true, count: todayEntries, detail: `${fmtHM(totalSeconds)} from ${todaySnapshot ? 'Clio Today snapshot' : 'local entries'}`, tone: todayEntries ? 'accent' : 'idle' },
      { key: 'week', label: 'Week window', included: true, count: 'bounded', detail: 'available to runtime on request', tone: 'mint' },
      { key: 'project', label: 'Projects', included: true, count: projectList.length, detail: `${verifiedProjects} with repo proof`, tone: verifiedProjects ? 'accent' : 'warning' },
      { key: 'task', label: 'Bridge assignments', included: Boolean(todaySnapshot), count: todaySnapshot?.assignments.activeCount ?? 'check', detail: todaySnapshot?.assignments.current?.nextAction ?? 'available to runtime on request', tone: todaySnapshot?.assignments.activeCount ? 'mint' : 'idle' },
      { key: 'temperance', label: 'Temperance dispatch', included: Boolean(dispatch), count: dispatch?.recommendations.length ?? 'check', detail: dispatch?.recommendations[0]?.rationale ?? 'safe recommendations available to runtime on request', tone: dispatch?.recommendations.length ? 'warning' : 'idle' },
      { key: 'realtime', label: 'Co-working room', included: Boolean(todaySnapshot), count: todaySnapshot?.rooms.activeCount ?? 'check', detail: todaySnapshot?.rooms.current ? `${todaySnapshot.rooms.current.name} · ${todaySnapshot.rooms.current.observedState.replace('_', ' ')}` : 'no active room in Today snapshot', tone: todaySnapshot?.rooms.current ? 'mint' : 'idle' },
      { key: 'session_group', label: 'Session groups', included: Boolean(sessionsEnabled), count: pendingSessions, detail: sessionsEnabled ? `${readySessions} ready for review` : 'scanner disabled or unavailable', truncated: (sessions?.totalPending ?? 0) > (sessions?.candidates?.length ?? 0), tone: readySessions ? 'accent' : 'idle' },
      { key: 'infra', label: 'Infra status', included: true, count: worker?.connected ? 'online' : 'check', detail: bridge ? `bridge ${bridge.connected ? 'connected' : 'disconnected'}` : 'bridge unavailable', tone: worker?.connected ? 'accent' : 'warning' },
      { key: 'app', label: 'App route', included: true, count: 'assistant', detail: 'current renderer tab and local actions', tone: 'mint' },
    ];
    const helpers: AssistantOptionalHelperStatus[] = [
      {
        label: 'Fabric',
        state: fabric?.bridge.reachable ? 'reachable' : 'optional',
        detail: fabric ? `${fabric.summary.healthy}/${fabric.summary.total} agents healthy` : 'not required for assistant use',
        tone: fabric?.bridge.reachable ? 'mint' : 'idle',
      },
    ];
    setContextState({
      sections,
      helpers,
      generatedAt: new Date().toISOString(),
      loading: false,
      error: [projectResult, entryResult, sessionResult, workerResult, bridgeResult].some((item) => item.status === 'rejected')
        ? 'Some context providers are unavailable; bounded local mode is still active.'
        : null,
      todayEntries,
      totalSeconds,
      readySessions,
      workerConnected: Boolean(worker?.connected),
      temperanceRecommendations: dispatch?.recommendations ?? [],
    });
  }, [projects, todaySnapshot, todaySnapshotSeconds]);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const api = window.plexus as typeof window.plexus & AssistantRendererApi;
      let remote: AssistantSuggestion[] = [];
      if (typeof api.assistantSuggestions === 'function') {
        const value = await api.assistantSuggestions({ contextScopes: ['today', 'project', 'task', 'session_group', 'infra', 'app'], limit: 6 });
        remote = normalizeSuggestions(value);
      }
      setSuggestions(mergeSuggestions(remote, mergeSuggestions(buildTodaySnapshotSuggestions(todaySnapshot), buildLocalSuggestions(contextState))));
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setSuggestions((current) => mergeSuggestions(current, mergeSuggestions(buildTodaySnapshotSuggestions(todaySnapshot), buildLocalSuggestions(contextState))));
    } finally {
      setSuggestionsLoading(false);
    }
  }, [contextState, todaySnapshot]);

  useEffect(() => {
    void loadRuntime();
    void loadContext();
  }, [loadContext, loadRuntime]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    const api = window.plexus as typeof window.plexus & AssistantRendererApi;
    if (typeof api.onAssistantEvent !== 'function') return undefined;
    return api.onAssistantEvent(applyStreamEvent);
  }, [applyStreamEvent]);

  const submit = async (message: string, scopes: AssistantContextScope[]) => {
    setError(null);
    const user = userMessage(message);
    appendMessage(conversationId, user);
    setStreaming(true);
    const api = window.plexus as typeof window.plexus & AssistantRendererApi;
    if (typeof api.assistantAsk !== 'function') {
      appendMessage(conversationId, assistantMessage(localAssistantReply(contextState), { provider: 'local', fallbackProvider: 'ipc-pending' }));
      setStreaming(false);
      return;
    }
    try {
      const result = await api.assistantAsk({ conversationId, message, contextScopes: scopes, routeKey: 'assistant' });
      const parsed = parseAskResult(result);
      if (parsed.message) appendMessage(conversationId, assistantMessage(parsed.message, { provider: parsed.provider ?? providerLabel }));
      if (parsed.suggestions.length) setSuggestions((current) => mergeSuggestions(current, parsed.suggestions));
      if (parsed.events.length) parsed.events.forEach(applyStreamEvent);
      if (!parsed.message && parsed.events.length === 0) appendMessage(conversationId, assistantMessage('Assistant request accepted. Waiting for stream events.', { status: 'pending', provider: providerLabel }));
    } catch (err: any) {
      appendMessage(conversationId, errorMessage(err?.message ?? String(err)));
      setError(err?.message ?? String(err));
    } finally {
      setStreaming(false);
    }
  };

  const recordActionResult = (result: AssistantActionResult) => {
    appendMessage(conversationId, result.ok ? toolMessage(result.message, pendingIntent?.toolId) : errorMessage(result.message));
    void loadContext();
  };

  const contextMetricNote = useMemo(() => {
    if (contextState.todayEntries > 0) return `${contextState.todayEntries} entries / ${fmtHM(contextState.totalSeconds)}`;
    return 'no tracked entries today';
  }, [contextState.todayEntries, contextState.totalSeconds]);

  return (
    <div className={`px-fadein px-assistant-page surface-${surface}`}>
      <PageHeader
        title="Clio Workbench"
        sub="expanded assistant workspace"
        right={
          <CommandDock>
            <StatusChip tone={runtimeState.tone} title={runtimeState.message}>{runtimeState.label}</StatusChip>
            <StatusChip tone={modelStatus?.selectedProvider ? 'accent' : 'idle'}>{providerLabel}</StatusChip>
            <Button variant="ghost" onClick={() => { void loadRuntime(); void loadContext(); }} disabled={contextState.loading}>
              <IconSync s={14} /> {contextState.loading ? 'Refreshing' : 'Refresh'}
            </Button>
          </CommandDock>
        }
      />

      {error && <DegradedStatePanel title="Assistant degraded" message={error} tone="warning" onRetry={() => { setError(null); void loadRuntime(); void loadContext(); }} />}
      {contextState.error && <DegradedStatePanel title="Context partially available" message={contextState.error} tone="warning" />}

      <MetricRailGroup className="px-assistant-hero-metrics">
        <MetricRail label="runtime" value={runtimeState.label} tone={runtimeState.tone} hint={runtimeState.message} />
        <MetricRail label="context" value={contextMetricNote} tone={contextState.todayEntries ? 'accent' : 'idle'} hint="local snapshot" />
        <MetricRail label="sessions" value={contextState.readySessions} tone={contextState.readySessions ? 'accent' : 'idle'} hint="ready review" />
        <MetricRail label="actions" value={suggestions.filter((item) => !dismissedIds.has(item.id)).length} tone="mint" hint="suggested" />
      </MetricRailGroup>

      <div className="px-assistant-layout">
        <InstrumentPanel className="px-assistant-thread-list" label="conversation list" title="Work threads" note="Choose a bounded work context for this conversation.">
          <Ledger>
            {conversations.map((conversation, index) => (
              <LedgerRail
                key={conversation.id}
                index={String(index + 1).padStart(2, '0')}
                marker={<span className="px-swatch" style={{ background: conversation.id === conversationId ? 'var(--accent)' : 'var(--t4)' }} />}
                title={conversation.title}
                meta={conversation.detail}
                status={conversation.id === conversationId ? 'open' : 'ready'}
                statusTone={conversation.id === conversationId ? 'accent' : 'idle'}
                action={<Button variant="ghost" onClick={() => setConversationId(conversation.id)}>Open</Button>}
              />
            ))}
          </Ledger>
        </InstrumentPanel>

        <InstrumentPanel
          label="assistant thread"
          title={selectedConversation.title}
          note="Ask for proof checks, navigation, session review, project sync, or daily summary work."
          actions={<StatusChip tone={streaming ? 'accent' : 'idle'}>{streaming ? 'streaming' : 'ready'}</StatusChip>}
          trace
          className="px-assistant-thread-panel"
        >
          <AssistantMessageList messages={currentMessages} streaming={streaming} providerLabel={providerLabel} />
          <AssistantComposer streaming={streaming} onSubmit={submit} />
        </InstrumentPanel>

        <div className="px-assistant-right-rail">
          <AssistantContextDrawer
            sections={contextState.sections}
            helpers={contextState.helpers}
            generatedAt={contextState.generatedAt}
            loading={contextState.loading}
            recommendations={contextState.temperanceRecommendations}
          />
          <AssistantSuggestionRail
            suggestions={suggestions}
            dismissedIds={dismissedIds}
            loading={suggestionsLoading}
            onConfirm={setPendingIntent}
            onDismiss={(id) => setDismissedIds((current) => new Set([...current, id]))}
          />
        </div>
      </div>

      {pendingIntent && (
        <AssistantActionConfirmModal
          intent={pendingIntent}
          onClose={() => setPendingIntent(null)}
          onResult={recordActionResult}
        />
      )}
    </div>
  );
}

function emptyContextState(): AssistantContextState {
  return {
    sections: [],
    helpers: [],
    generatedAt: null,
    loading: false,
    error: null,
    todayEntries: 0,
    totalSeconds: 0,
    readySessions: 0,
    workerConnected: false,
    temperanceRecommendations: [],
  };
}

function seedMessages(kind: string): AssistantUiMessage[] {
  const content = kind === 'sessions'
    ? 'Session review is ready here. I can open the local AI queue, confirm imports, and keep raw session text out of the summary.'
    : kind === 'infra'
      ? 'Infra review is ready here. I can inspect Worker, bridge, and optional Fabric status without making Fabric a blocker.'
      : 'Today review is ready here. I can inspect local work, prepare standup proof, suggest navigation, and queue confirmed actions.';
  return [assistantMessage(content, { provider: 'local' })];
}

function userMessage(content: string): AssistantUiMessage {
  return { id: `user:${Date.now()}:${Math.random().toString(16).slice(2)}`, role: 'user', content, createdAt: new Date().toISOString(), status: 'done' };
}

function assistantMessage(content: string, options: Partial<AssistantUiMessage> = {}): AssistantUiMessage {
  return {
    id: options.id ?? `assistant:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    role: 'assistant',
    content,
    createdAt: new Date().toISOString(),
    status: options.status ?? 'done',
    provider: options.provider,
    fallbackProvider: options.fallbackProvider,
  };
}

function toolMessage(content: string, toolId?: AssistantUiMessage['toolId']): AssistantUiMessage {
  return { id: `tool:${Date.now()}:${Math.random().toString(16).slice(2)}`, role: 'tool', content, toolId, createdAt: new Date().toISOString(), status: 'done' };
}

function errorMessage(content: string): AssistantUiMessage {
  return { id: `error:${Date.now()}:${Math.random().toString(16).slice(2)}`, role: 'error', content, createdAt: new Date().toISOString(), status: 'failed' };
}

function localAssistantReply(context: AssistantContextState): string {
  const parts = [
    `Local renderer mode is active because assistantAsk IPC is not exposed yet.`,
    `I can still work with ${context.todayEntries} local entries, ${context.readySessions} ready sessions, and ${context.workerConnected ? 'connected' : 'degraded'} Worker status.`,
    'Use the suggestion rail to confirm navigation, standup generation, session review, or project sync.',
  ];
  return parts.join(' ');
}

function buildLocalSuggestions(context: AssistantContextState): AssistantSuggestion[] {
  const today = localDateString();
  const suggestions: AssistantSuggestion[] = [
    {
      id: 'local_open_reports',
      type: 'navigate_reports',
      title: 'Review proof report',
      body: 'Open reports to inspect local work totals, evidence coverage, and missing proof.',
      confidence: 0.78,
      safety: 'confirm_required',
      intent: { toolId: 'app.navigate', title: 'Open reports', payload: { routeKey: 'reports' } },
    },
  ];
  if (context.todayEntries > 0) {
    suggestions.unshift({
      id: `local_standup_${today}`,
      type: 'standup',
      title: 'Prepare daily proof',
      body: `Generate a standup draft from ${context.todayEntries} tracked entr${context.todayEntries === 1 ? 'y' : 'ies'} before sending anything.`,
      confidence: 0.9,
      safety: 'confirm_required',
      intent: { toolId: 'app.generateStandup', title: 'Generate standup proof', payload: { date: today } },
    });
  }
  if (context.readySessions > 0) {
    suggestions.push({
      id: 'local_review_sessions',
      type: 'session_grouping',
      title: 'Review local AI sessions',
      body: `${context.readySessions} session candidate${context.readySessions === 1 ? '' : 's'} can be reviewed against the work ledger.`,
      confidence: 0.86,
      safety: 'confirm_required',
      intent: { toolId: 'app.navigate', title: 'Review local AI sessions', payload: { routeKey: 'agents' } },
    });
  }
  suggestions.push({
    id: 'local_sync_projects',
    type: 'sync_projects',
    title: 'Sync project cache',
    body: 'Refresh project metadata before the assistant reasons over repo-backed work surfaces.',
    confidence: context.workerConnected ? 0.72 : 0.58,
    safety: 'confirm_required',
    intent: { toolId: 'app.syncProjects', title: 'Sync projects', payload: {} },
  });
  return suggestions;
}

function buildTodaySnapshotSuggestions(snapshot?: TodaySnapshot | null): AssistantSuggestion[] {
  if (!snapshot?.suggestions.length) return [];
  return snapshot.suggestions.map((suggestion): AssistantSuggestion => ({
    id: `today_${suggestion.id}`,
    title: suggestion.title,
    body: `${suggestion.detail} ${suggestion.rationale}`,
    confidence: suggestion.confidence,
    safety: suggestion.safety,
    ...(suggestion.taskId ? { projectId: snapshot.assignments.current?.projectId ?? null } : {}),
    ...(suggestion.routeKey ? {
      intent: {
        toolId: 'app.navigate',
        title: `Open ${suggestion.routeKey}`,
        payload: {
          routeKey: suggestion.routeKey,
          ...(suggestion.taskId ? { taskId: suggestion.taskId } : {}),
          ...(suggestion.skillHint ? { skillHint: suggestion.skillHint } : {}),
        },
      },
    } : {}),
    dedupeKey: `today:${suggestion.id}`,
    createdAt: snapshot.generatedAt,
  }));
}

function normalizeSuggestions(value: unknown): AssistantSuggestion[] {
  if (Array.isArray(value)) return value.filter(isSuggestion);
  if (value && typeof value === 'object' && Array.isArray((value as { suggestions?: unknown[] }).suggestions)) {
    return (value as { suggestions: unknown[] }).suggestions.filter(isSuggestion);
  }
  return [];
}

function isSuggestion(value: unknown): value is AssistantSuggestion {
  return Boolean(value && typeof value === 'object' && typeof (value as AssistantSuggestion).id === 'string' && typeof (value as AssistantSuggestion).title === 'string');
}

function mergeSuggestions(a: AssistantSuggestion[], b: AssistantSuggestion[]): AssistantSuggestion[] {
  const byId = new Map<string, AssistantSuggestion>();
  [...a, ...b].forEach((suggestion) => byId.set(suggestion.id, suggestion));
  return [...byId.values()].sort((left, right) => right.confidence - left.confidence || left.id.localeCompare(right.id)).slice(0, 8);
}

function parseAskResult(value: unknown): { message: string | null; provider?: string; suggestions: AssistantSuggestion[]; events: AssistantStreamEvent[] } {
  if (typeof value === 'string') return { message: value, suggestions: [], events: [] };
  if (!value || typeof value !== 'object') return { message: null, suggestions: [], events: [] };
  const record = value as Record<string, unknown>;
  const message = typeof record.message === 'string'
    ? record.message
    : typeof record.response === 'string'
      ? record.response
      : typeof record.content === 'string'
        ? record.content
        : null;
  const provider = typeof record.provider === 'string' ? record.provider : undefined;
  const suggestions = normalizeSuggestions(record.suggestions);
  const events = Array.isArray(record.events) ? record.events.filter(isStreamEvent) : [];
  return { message, provider, suggestions, events };
}

function isStreamEvent(value: unknown): value is AssistantStreamEvent {
  return Boolean(value && typeof value === 'object' && typeof (value as AssistantStreamEvent).type === 'string' && typeof (value as AssistantStreamEvent).conversationId === 'string');
}
