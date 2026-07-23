import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AssistantCapabilityCatalog,
  AssistantContextScope,
  AssistantModelStatus,
  AssistantStreamEvent,
  AssistantSuggestion,
  AssistantTurnRequest,
  Project,
} from '../../shared/types';
import { Button, fmtHM, localDateString } from './ui';
import AssistantActionConfirmModal, {
  type AssistantActionResult,
  type AssistantPendingIntent,
} from './AssistantActionConfirmModal';
import AssistantComposer from './AssistantComposer';
import AssistantContextDrawer, {
  type AssistantContextSection,
} from './AssistantContextDrawer';
import AssistantMessageList, { type AssistantUiMessage } from './AssistantMessageList';
import AssistantSuggestionChips from './AssistantSuggestionChips';
import AssistantStatusDot, { type ClioStatusTone } from './AssistantStatusDot';
import { humanizeToolEvent } from '../lib/assistant-thread-model';

interface AssistantRendererApi {
  assistantStatus?: () => Promise<{ ok?: boolean; state?: string; message?: string; enabled?: boolean }>;
  assistantCapabilities?: () => Promise<AssistantCapabilityCatalog>;
  assistantAsk?: (input: AssistantTurnRequest) => Promise<unknown>;
  assistantSuggestions?: (input?: { contextScopes?: AssistantContextScope[]; limit?: number }) => Promise<unknown>;
  onAssistantEvent?: (callback: (event: AssistantStreamEvent) => void) => () => void;
}

interface AssistantContextState {
  sections: AssistantContextSection[];
  generatedAt: string | null;
  loading: boolean;
  error: string | null;
  todayEntries: number;
  totalSeconds: number;
  readySessions: number;
  workerConnected: boolean;
}

const CLIO_CONVERSATION_ID = 'clio';
const WELCOME: AssistantUiMessage = {
  id: 'welcome',
  role: 'assistant',
  content: "I'm Clio. I can check today's work, prep standup proof, review sessions, or navigate the app.",
  createdAt: new Date().toISOString(),
  status: 'done',
  provider: 'local',
};

export default function AssistantPanel({ projects, surface = 'page' }: { projects: Project[]; surface?: 'page' | 'sidechat' | 'settings' }) {
  const [messages, setMessages] = useState<AssistantUiMessage[]>([WELCOME]);
  const [contextOpen, setContextOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [pendingIntent, setPendingIntent] = useState<AssistantPendingIntent | null>(null);
  const [contextState, setContextState] = useState<AssistantContextState>(() => emptyContextState());
  const [runtimeState, setRuntimeState] = useState<{ label: string; tone: 'accent' | 'mint' | 'warning' | 'error' | 'idle'; message: string }>({
    label: 'local mode',
    tone: 'warning',
    message: 'Clio is running in offline mode — answers use local data only.',
  });
  const [modelStatus, setModelStatus] = useState<AssistantModelStatus | null>(null);
  const [capabilityCatalog, setCapabilityCatalog] = useState<AssistantCapabilityCatalog | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamSeqRef = useRef(0);

  const providerLabel = modelStatus?.selectedProvider ?? modelStatus?.provider ?? runtimeState.label;

  const appendMessage = useCallback((message: AssistantUiMessage) => {
    setMessages((current) => [...current, message]);
  }, []);

  const statusTone: ClioStatusTone = runtimeState.tone === 'error'
    ? 'error'
    : contextState.error
      ? 'local'
      : runtimeState.tone === 'accent' || runtimeState.tone === 'mint' ? 'ready' : 'local';

  const statusMessage = [runtimeState.message, contextState.error, error].filter(Boolean).join(' ');

  const applyStreamEvent = useCallback((event: AssistantStreamEvent) => {
    if (event.conversationId !== CLIO_CONVERSATION_ID) return;
    if (event.type === 'run_start') {
      streamSeqRef.current += 1;
      setStreaming(true);
      setRuntimeState({
        label: event.mode === 'offline' ? 'offline turn' : 'model turn',
        tone: event.mode === 'offline' ? 'warning' : 'accent',
        message: `Run ${event.runId.slice(0, 8)} started.`,
      });
      return;
    }
    if (event.type === 'model_call_start') {
      setRuntimeState({ label: 'model call', tone: 'accent', message: 'The model call is streaming through the main process.' });
      return;
    }
    if (event.type === 'model_call_end') {
      setRuntimeState({
        label: event.status === 'succeeded' ? 'model complete' : 'model failed',
        tone: event.status === 'succeeded' ? 'mint' : 'warning',
        message: `Model call ${event.status}.`,
      });
      return;
    }
    if (event.type === 'approval_required') {
      setRuntimeState({ label: 'approval ready', tone: 'warning', message: `${event.toolId} is waiting for explicit confirmation.` });
      return;
    }
    if (event.type === 'run_end') {
      setStreaming(false);
      setRuntimeState({
        label: event.status === 'completed' ? 'runtime ready' : event.status,
        tone: event.status === 'completed' ? 'accent' : 'warning',
        message: `Clio run ${event.status}.`,
      });
      return;
    }
    if (event.type === 'message_delta') {
      const streamId = `stream:clio:${streamSeqRef.current}`;
      setMessages((current) => {
        const last = current[current.length - 1];
        if (last?.id === streamId) {
          return [...current.slice(0, -1), { ...last, content: `${last.content}${event.delta}` }];
        }
        return [...current, assistantMessage(event.delta, { id: streamId, status: 'streaming', provider: providerLabel })];
      });
      return;
    }
    if (event.type === 'tool_call') {
      appendMessage(toolMessage(humanizeToolEvent(event.toolId, 'call'), event.toolId));
      return;
    }
    if (event.type === 'tool_result') {
      appendMessage(toolMessage(humanizeToolEvent(event.toolId, 'result'), event.toolId));
      return;
    }
    if (event.type === 'suggestion') {
      setSuggestions((current) => mergeSuggestions(current, [event.suggestion]));
      return;
    }
    if (event.type === 'error') {
      appendMessage(errorMessage(event.message));
      setStreaming(false);
      return;
    }
    if (event.type === 'done') {
      setStreaming(false);
      const streamId = `stream:clio:${streamSeqRef.current}`;
      setMessages((current) => current.map((message) => (
        message.id === streamId ? { ...message, status: 'done' } : message
      )));
    }
  }, [appendMessage, providerLabel]);

  const loadRuntime = useCallback(async () => {
    const api = window.plexus as typeof window.plexus & AssistantRendererApi;
    const hasAsk = typeof api.assistantAsk === 'function';
    try {
      const [runtime, model, capabilities] = await Promise.allSettled([
        api.assistantStatus?.(),
        window.plexus.assistantModelStatus?.(),
        api.assistantCapabilities?.(),
      ]);
      if (model.status === 'fulfilled' && model.value) setModelStatus(model.value);
      if (capabilities.status === 'fulfilled' && capabilities.value) setCapabilityCatalog(capabilities.value);
      if (runtime.status === 'fulfilled' && runtime.value) {
        const value = runtime.value;
        setRuntimeState({
          label: value.state ?? (value.enabled === false ? 'disabled' : hasAsk ? 'runtime ready' : 'local mode'),
          tone: value.enabled === false ? 'idle' : value.ok === false ? 'warning' : hasAsk ? 'accent' : 'warning',
          message: value.message ?? (hasAsk ? 'Clio is connected and ready.' : 'Clio is running in offline mode — answers use local data only.'),
        });
      } else {
        setRuntimeState({
          label: hasAsk ? 'runtime ready' : 'local mode',
          tone: hasAsk ? 'accent' : 'warning',
          message: hasAsk ? 'Clio is connected and ready.' : 'Clio is running in offline mode — answers use local data only.',
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
    const [projectResult, entryResult, sessionResult, workerResult, bridgeResult] = await Promise.allSettled([
      window.plexus.projectList(),
      window.plexus.entryList(from, to),
      window.plexus.agentSessionStatus(),
      window.plexus.workerStatus(),
      window.plexus.thoughtseedBridgeStatus(),
    ]);

    const projectList = projectResult.status === 'fulfilled' ? projectResult.value : projects;
    const entries = entryResult.status === 'fulfilled' ? entryResult.value : [];
    const sessions = sessionResult.status === 'fulfilled' ? sessionResult.value : null;
    const worker = workerResult.status === 'fulfilled' ? workerResult.value : null;
    const bridge = bridgeResult.status === 'fulfilled' ? bridgeResult.value : null;
    const verifiedProjects = projectList.filter((project) => project.repoVerifiedAt || project.githubRepoFullName).length;
    const totalSeconds = entries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
    const readySessions = sessions?.readyPending ?? 0;
    const sections: AssistantContextSection[] = [
      { key: 'today', label: 'Today work log', included: true, count: entries.length, detail: `${fmtHM(totalSeconds)} tracked locally`, tone: entries.length ? 'accent' : 'idle' },
      { key: 'week', label: 'Week window', included: true, count: 'bounded', detail: 'available to runtime on request', tone: 'mint' },
      { key: 'project', label: 'Projects', included: true, count: projectList.length, detail: `${verifiedProjects} with repo proof`, tone: verifiedProjects ? 'accent' : 'warning' },
      { key: 'session_group', label: 'Session groups', included: Boolean(sessions?.enabled), count: sessions?.totalPending ?? 0, detail: sessions?.enabled ? `${readySessions} ready for review` : 'scanner disabled or unavailable', truncated: (sessions?.totalPending ?? 0) > (sessions?.candidates?.length ?? 0), tone: readySessions ? 'accent' : 'idle' },
      { key: 'infra', label: 'Infra status', included: true, count: worker?.connected ? 'online' : 'check', detail: bridge ? `bridge ${bridge.connected ? 'connected' : 'disconnected'}` : 'bridge unavailable', tone: worker?.connected ? 'accent' : 'warning' },
      { key: 'app', label: 'App route', included: true, count: 'assistant', detail: 'current renderer tab and local actions', tone: 'mint' },
    ];
    setContextState({
      sections,
      generatedAt: new Date().toISOString(),
      loading: false,
      error: [projectResult, entryResult, sessionResult, workerResult, bridgeResult].some((item) => item.status === 'rejected')
        ? 'Some context providers are unavailable; bounded local mode is still active.'
        : null,
      todayEntries: entries.length,
      totalSeconds,
      readySessions,
      workerConnected: Boolean(worker?.connected),
    });
  }, [projects]);

  const loadSuggestions = useCallback(async () => {
    try {
      const api = window.plexus as typeof window.plexus & AssistantRendererApi;
      let remote: AssistantSuggestion[] = [];
      if (typeof api.assistantSuggestions === 'function') {
        const value = await api.assistantSuggestions({ contextScopes: ['today', 'project', 'session_group', 'infra', 'app'], limit: 6 });
        remote = normalizeSuggestions(value);
      }
      setSuggestions(mergeSuggestions(remote, buildLocalSuggestions(contextState)));
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setSuggestions((current) => mergeSuggestions(current, buildLocalSuggestions(contextState)));
    }
  }, [contextState]);

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
    appendMessage(user);
    setStreaming(true);
    const api = window.plexus as typeof window.plexus & AssistantRendererApi;
    if (typeof api.assistantAsk !== 'function') {
      appendMessage(assistantMessage(localAssistantReply(contextState), { provider: 'local', fallbackProvider: 'ipc-pending' }));
      setStreaming(false);
      return;
    }
    try {
      const result = await api.assistantAsk({ conversationId: CLIO_CONVERSATION_ID, message, contextScopes: scopes, routeKey: 'assistant' });
      const parsed = parseAskResult(result);
      if (parsed.message) appendMessage(assistantMessage(parsed.message, { provider: parsed.provider ?? providerLabel }));
      if (parsed.suggestions.length) setSuggestions((current) => mergeSuggestions(current, parsed.suggestions));
      if (parsed.events.length) parsed.events.forEach(applyStreamEvent);
      if (!parsed.message && parsed.events.length === 0) appendMessage(assistantMessage('Clio accepted the request. Waiting for stream events.', { status: 'pending', provider: providerLabel }));
    } catch (err: any) {
      appendMessage(errorMessage(err?.message ?? String(err)));
      setError(err?.message ?? String(err));
    } finally {
      setStreaming(false);
    }
  };

  const recordActionResult = (result: AssistantActionResult) => {
    appendMessage(result.ok ? toolMessage(result.message, pendingIntent?.toolId) : errorMessage(result.message));
    void loadContext();
  };

  return (
    <div className={`px-fadein px-clio-page surface-${surface}`}>
      <header className="px-clio-head">
        <div className="px-clio-head-id">
          <strong>Clio</strong>
          <AssistantStatusDot
            tone={statusTone}
            runtimeLabel={runtimeState.label}
            runtimeMessage={statusMessage}
            provider={providerLabel}
            capabilityCount={capabilityCatalog?.capabilities.length ?? null}
            contextGeneratedAt={contextState.generatedAt}
            refreshing={contextState.loading}
            onRefresh={() => { void loadRuntime(); void loadContext(); }}
          />
        </div>
        <Button variant="ghost" onClick={() => setContextOpen((v) => !v)} aria-expanded={contextOpen}>
          {contextOpen ? 'Hide context' : 'What Clio can see'}
        </Button>
      </header>

      {contextOpen && (
        <AssistantContextDrawer
          sections={contextState.sections}
          generatedAt={contextState.generatedAt}
          loading={contextState.loading}
        />
      )}

      <div className="px-clio-thread">
        <AssistantMessageList messages={messages} streaming={streaming} />
      </div>

      <div className="px-clio-foot">
        <AssistantSuggestionChips
          suggestions={suggestions}
          dismissedIds={dismissedIds}
          onConfirm={setPendingIntent}
          onDismiss={(id) => setDismissedIds((current) => new Set([...current, id]))}
        />
        <AssistantComposer streaming={streaming} onSubmit={submit} />
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
    generatedAt: null,
    loading: false,
    error: null,
    todayEntries: 0,
    totalSeconds: 0,
    readySessions: 0,
    workerConnected: false,
  };
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
    `I'm in offline mode right now, so I'm answering from local data.`,
    `I can still work with ${context.todayEntries} local entries, ${context.readySessions} ready sessions, and ${context.workerConnected ? 'connected' : 'degraded'} Worker status.`,
    'Use the suggestion chips to confirm navigation, standup generation, session review, or project sync.',
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
    body: 'Refresh project metadata so Clio has fresh project data to work with.',
    confidence: context.workerConnected ? 0.72 : 0.58,
    safety: 'confirm_required',
    intent: { toolId: 'app.syncProjects', title: 'Sync projects', payload: {} },
  });
  return suggestions;
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
