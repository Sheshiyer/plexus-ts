import React, { useState, useEffect, useCallback } from 'react';
import {
  PageHeader, Button, Select, Textarea, Input,
} from './ui';
import {
  IconBridge, IconSync, IconCheck, IconClose,
} from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  InstrumentPanel,
  Ledger,
  MetricRail,
  MetricRailGroup,
  StatusChip,
  type PlexusTone,
} from './PlexusUI';
import type {
  FabricStatus,
  AgentHealth,
  HandoffRecord,
  Session,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricEvidenceType,
  ThoughtseedFabricTask,
  ThoughtseedFabricTaskStatus,
  ThoughtseedFabricTaskWorkMode,
} from '../../shared/types';
import { readAdminEmployeeModeContext } from '../adminEmployeeMode';

/* ── Helpers ─────────────────────────────────────────────── */

function agentColor(a: AgentHealth): string {
  if (a.status === 'healthy') return 'var(--accent)';
  if (a.status === 'stale') return 'var(--warn)';
  return 'var(--warn)';
}

function openAssistantForDailyWork() {
  window.dispatchEvent(new CustomEvent('plexus:assistant-navigate', { detail: { routeKey: 'assistant' } }));
}

function statusTone(status: ThoughtseedFabricTaskStatus): PlexusTone {
  if (status === 'done') return 'accent';
  if (status === 'blocked') return 'error';
  if (status === 'in_progress') return 'warning';
  return 'idle';
}

function evidenceTone(task: ThoughtseedFabricTask): PlexusTone {
  if (task.evidenceStrength === 'verified_evidence') return 'accent';
  if (task.status === 'done') return 'warning';
  return 'idle';
}

function connectionLabel(connected?: boolean | null): string {
  return connected ? 'connected' : 'unavailable';
}

function helperLabel(agent: AgentHealth): string {
  return agent.status === 'healthy' ? 'connected' : 'unavailable';
}

function helperDetail(agent: AgentHealth): string {
  return agent.status === 'healthy'
    ? 'Ready for optional helper work.'
    : 'Optional helper is not ready; Clio daily work can continue.';
}

function statusLabel(status: ThoughtseedFabricTaskStatus): string {
  if (status === 'in_progress') return 'working';
  return status.replace('_', ' ');
}

function modeLabel(mode?: ThoughtseedFabricTaskWorkMode): string {
  if (mode === 'manual') return "I'll handle it";
  if (mode === 'delegated') return 'use local helper';
  return 'choose helper use';
}

function sourceLabel(task: ThoughtseedFabricTask): string {
  if (task.source === 'paperclip') return 'Paperclip';
  if (task.source === 'cambium') return 'Cambium';
  return 'Hermes';
}

function proofLabel(task: ThoughtseedFabricTask): string {
  if (task.evidenceStrength === 'verified_evidence') return 'proof verified';
  if (task.evidence.length > 0 || task.status === 'done') return 'proof submitted';
  return 'proof needed';
}

function followUpTone(status: HandoffRecord['status']): PlexusTone {
  if (status === 'sent' || status === 'skipped') return 'accent';
  if (status === 'failed') return 'error';
  return 'warning';
}

function followUpLabel(status: HandoffRecord['status']): string {
  if (status === 'sent' || status === 'skipped') return 'clear';
  if (status === 'failed') return 'needs attention';
  if (status === 'retrying') return 'trying again';
  return 'waiting';
}

type TaskDraft = {
  note: string;
  blocker: string;
  evidenceValue: string;
  evidenceType: ThoughtseedFabricEvidenceType;
};

const DEFAULT_DRAFT: TaskDraft = {
  note: '',
  blocker: '',
  evidenceValue: '',
  evidenceType: 'github_pr',
};

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isDegradedMessage(message: string): boolean {
  return /blocked|cannot|could not|expired|failed|invalid|not connected|not found|required|requires|unavailable|refusing/i.test(message);
}

/* ── Sub-components ──────────────────────────────────────── */

function AgentTile({ agent }: { agent: AgentHealth }) {
  const color = agentColor(agent);
  return (
    <div className="px-panel pad" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="px-dot" style={{ background: color }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{agent.agentName}</div>
        <StatusChip tone={agent.status === 'healthy' ? 'accent' : 'warning'}>{helperLabel(agent)}</StatusChip>
      </div>
      <div className="px-lbl" style={{ color: 'var(--t2)' }}>{helperDetail(agent)}</div>
    </div>
  );
}

function StandupTile({ status }: { status: FabricStatus }) {
  const kpi = status.kpi;
  if (!kpi && !status.dailyProof) return null;
  const todayH = kpi ? Math.floor((kpi.todaySeconds ?? 0) / 3600) : 0;
  const todayM = kpi ? Math.floor(((kpi.todaySeconds ?? 0) % 3600) / 60) : 0;
  return (
    <div className="px-panel pad" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="px-dot" style={{ background: 'var(--accent)' }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>Clio daily proof</div>
      </div>
      {status.dailyProof && (
        <div className="px-lbl">
          status <span style={{ color: status.dailyProof.ready ? 'var(--accent)' : 'var(--warn)' }}>{status.dailyProof.label}</span>
        </div>
      )}
      {kpi && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <div className="px-lbl">hours <span style={{ color: 'var(--accent)' }}>{todayH}h {todayM}m</span></div>
          <div className="px-lbl">worker proof <span style={{ color: kpi.standupCompliant ? 'var(--accent)' : 'var(--rose)' }}>{kpi.standupCompliant ? 'ready' : 'needed'}</span></div>
        </div>
      )}
      <div className="px-lbl" style={{ color: 'var(--t3)' }}>{status.dailyProof?.message}</div>
    </div>
  );
}

function NudgeBanner({ kpi }: { kpi?: any }) {
  if (!kpi || kpi.standupCompliant) return null;
  return (
    <DegradedStatePanel
      title="Clio proof reminder"
      message="Open Clio to prepare today's work proof when you are ready."
      tone="warning"
    />
  );
}

function BranchMissionContext({ task }: { task: ThoughtseedFabricTask }) {
  const primary = [
    task.branchId ? `Branch ${task.branchId}` : null,
    task.arcId ? `Arc ${task.arcId}` : null,
    task.missionId ? `Mission ${task.missionId}` : null,
    task.kpiIds?.length ? `KPI ${task.kpiIds.join(', ')}` : null,
    task.gateId ? `Gate ${task.gateId}` : null,
    task.promotionState ? `Promotion ${task.promotionState}` : null,
  ].filter(Boolean);
  const secondary = [
    task.proofRequired ? `Proof required: ${task.proofRequired}` : null,
    task.proofFoldback ? `Foldback: ${task.proofFoldback}` : null,
    task.autonomyBoundary ? `Boundary: ${task.autonomyBoundary}` : null,
    task.approvalsRequired?.length ? `Approvals: ${task.approvalsRequired.join(', ')}` : null,
  ].filter(Boolean);
  if (!primary.length && !secondary.length) return null;
  return (
    <div className="px-lbl" style={{ color: 'var(--t2)', marginTop: 8, display: 'grid', gap: 4 }}>
      {primary.length > 0 && <span>{primary.join(' · ')}</span>}
      {secondary.map((line) => <span key={line}>{line}</span>)}
    </div>
  );
}

function AssignmentCard({
  task,
  draft,
  busy,
  onDraft,
  onMode,
  onReport,
}: {
  task: ThoughtseedFabricTask;
  draft: TaskDraft;
  busy: boolean;
  onDraft: (taskId: string, patch: Partial<TaskDraft>) => void;
  onMode: (taskId: string, mode: ThoughtseedFabricTaskWorkMode) => void;
  onReport: (taskId: string, status: ThoughtseedFabricTaskStatus) => void;
}) {
  const canReportProgress = Boolean(task.workMode);
  const hasDoneProof = draft.note.trim() || draft.evidenceValue.trim();
  const canMarkDone = Boolean(canReportProgress && hasDoneProof);
  return (
    <div className="px-panel pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>{task.title}</span>
            <StatusChip tone={task.source === 'paperclip' ? 'mint' : 'idle'}>{sourceLabel(task)}</StatusChip>
            <StatusChip tone={statusTone(task.status)}>{statusLabel(task.status)}</StatusChip>
            <StatusChip tone={task.workMode ? 'mint' : 'idle'}>{modeLabel(task.workMode)}</StatusChip>
            <StatusChip tone={evidenceTone(task)}>{proofLabel(task)}</StatusChip>
          </div>
          <div className="px-lbl" style={{ color: 'var(--t3)', marginTop: 6 }}>
            {task.projectName ?? 'Assigned project'} · {task.clientName ?? 'Workspace task'} · {task.priority ?? 'normal'}
          </div>
          <BranchMissionContext task={task} />
          {task.description && (
            <div className="px-lbl" style={{ color: 'var(--t2)', marginTop: 8 }}>{task.description}</div>
          )}
        </div>
      </div>

      {!task.workMode && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" disabled={busy} onClick={() => onMode(task.taskId, 'manual')}>I'll handle it</Button>
          <Button variant="ghost" disabled={busy} onClick={() => onMode(task.taskId, 'delegated')}>Use local helper</Button>
          <span className="px-lbl" style={{ alignSelf: 'center' }}>Choose how you'll handle this task. Ask an admin to change it later.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) minmax(0, 1fr)', gap: 10 }}>
        <Select
          value={draft.evidenceType}
          onChange={(e) => onDraft(task.taskId, { evidenceType: e.target.value as ThoughtseedFabricEvidenceType })}
          aria-label="Proof type"
        >
          <option value="github_pr">GitHub PR</option>
          <option value="github_commit">Commit</option>
          <option value="github_branch">Branch</option>
          <option value="deploy_url">Deployment</option>
          <option value="figma_url">Figma</option>
          <option value="canva_url">Canva</option>
          <option value="doc_url">Document</option>
          <option value="file_path">Local file</option>
          <option value="note">Note</option>
        </Select>
        <Input
          value={draft.evidenceValue}
          onChange={(e) => onDraft(task.taskId, { evidenceValue: e.target.value })}
          placeholder="Link to proof or add a short note"
          aria-label="Proof"
        />
      </div>
      <Textarea
        value={draft.note}
        onChange={(e) => onDraft(task.taskId, { note: e.target.value })}
        rows={2}
        placeholder="Progress note or completion summary"
        aria-label="Task note"
      />
      <Input
        value={draft.blocker}
        onChange={(e) => onDraft(task.taskId, { blocker: e.target.value })}
        placeholder="What is blocking this task?"
        aria-label="Task blocker"
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="ghost" disabled={busy} onClick={() => onReport(task.taskId, 'seen')}>Acknowledge</Button>
        <Button variant="ghost" disabled={busy || !canReportProgress} onClick={() => onReport(task.taskId, 'in_progress')}>Working</Button>
        <Button variant="ghost" disabled={busy || !canReportProgress} onClick={() => onReport(task.taskId, 'blocked')}>Blocked</Button>
        <Button variant={canMarkDone ? 'accent' : 'ghost'} disabled={busy || !canMarkDone} onClick={() => onReport(task.taskId, 'done')}>Done</Button>
      </div>

      {task.evidence.length > 0 && (
        <div className="px-lbl" style={{ color: 'var(--t3)' }}>
          Proof has been added for this task.
        </div>
      )}
    </div>
  );
}

export default function AgentFabricPanel() {
  const [status, setStatus] = useState<FabricStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupOutput, setSetupOutput] = useState('');
  const [setupError, setSetupError] = useState('');
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>([]);
  const [handoffError, setHandoffError] = useState('');
  const [retryingHandoffId, setRetryingHandoffId] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<ThoughtseedBridgeStatus | null>(null);
  const [bridgeBusy, setBridgeBusy] = useState<'heartbeat' | 'poll' | ''>('');
  const [bridgeMessage, setBridgeMessage] = useState('');
  const [fabricTasks, setFabricTasks] = useState<ThoughtseedFabricTask[]>([]);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({});
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [testModeIdentityId, setTestModeIdentityId] = useState<string | null>(null);
  const [guardedOverrideAvailable, setGuardedOverrideAvailable] = useState(false);

  const applyFabricTasks = useCallback((tasks: ThoughtseedFabricTask[]) => {
    setFabricTasks(tasks);
    setTaskDrafts((prev) => {
      const next: Record<string, TaskDraft> = {};
      for (const task of tasks) {
        next[task.taskId] = prev[task.taskId] ?? { ...DEFAULT_DRAFT };
      }
      return next;
    });
  }, []);

  const loadBridgeStatus = useCallback(async () => {
    try {
      setBridgeStatus(await window.plexus.thoughtseedBridgeStatus());
    } catch (err) {
      setBridgeMessage(errorText(err, 'Task updates are unavailable.'));
    }
  }, []);

  const loadFabricTasks = useCallback(async () => {
    try {
      const result = await window.plexus.thoughtseedFabricTasks();
      applyFabricTasks(result.tasks);
    } catch (err) {
      setTaskMessage(errorText(err, 'Could not load task assignments.'));
    }
  }, [applyFabricTasks]);

  const loadHandoffs = useCallback(async () => {
    try {
      setHandoffs(await window.plexus.handoffList());
      setHandoffError('');
    } catch (err) {
      setHandoffError(errorText(err, 'Could not load follow-ups.'));
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLastError(null);
    try {
      // Optional local-helper (Fabric) status has no main-process source since the
      // Paperclip runtime retirement; status stays null until Task 2 removes this panel.
      await Promise.all([loadHandoffs(), loadBridgeStatus(), loadFabricTasks()]);
    } catch (err) {
      setLastError(errorText(err, 'Local helpers are unavailable.'));
    } finally {
      setLoading(false);
    }
  }, [loadBridgeStatus, loadFabricTasks, loadHandoffs]);

  useEffect(() => {
    refresh();
    window.plexus.authSession().then(setSession).catch(() => {});
    const syncEmployeeMode = () => {
      const context = readAdminEmployeeModeContext();
      setTestModeIdentityId(context?.role === 'employee' ? context.identityId : null);
    };
    syncEmployeeMode();
    window.addEventListener('plexus:admin-employee-mode-changed', syncEmployeeMode);
    const id = autoRefresh ? setInterval(refresh, 10000) : null;
    return () => {
      if (id) clearInterval(id);
      window.removeEventListener('plexus:admin-employee-mode-changed', syncEmployeeMode);
    };
  }, [refresh, autoRefresh]);

  const summary = status?.summary;
  const allHealthy = summary && summary.healthy === summary.total && summary.total > 0;
  const activeHandoffs = handoffs.filter((handoff) => handoff.status !== 'sent' && handoff.status !== 'skipped');
  const isAdminEmployeeTestMode = Boolean(session?.role === 'admin' && testModeIdentityId);
  const writesBlockedBySafety = Boolean(isAdminEmployeeTestMode && !status?.safety.writesAllowed);
  const canWriteWithOverride = !writesBlockedBySafety || guardedOverrideAvailable;
  const consumeOverride = () => {
    if (writesBlockedBySafety && guardedOverrideAvailable) setGuardedOverrideAvailable(false);
  };
  const retryHandoff = async (record: HandoffRecord) => {
    setRetryingHandoffId(record.id);
    try {
      await window.plexus.handoffRetry(record.id);
      await loadHandoffs();
      await refresh();
    } catch (err) {
      setHandoffError(errorText(err, 'Could not retry this follow-up.'));
      await loadHandoffs();
    } finally {
      setRetryingHandoffId(null);
    }
  };

  const sendBridgeHeartbeat = async () => {
    setBridgeBusy('heartbeat');
    setBridgeMessage('');
    try {
      await window.plexus.thoughtseedSendHeartbeat();
      setBridgeMessage('Workspace connection checked.');
      await loadBridgeStatus();
    } catch (err) {
      setBridgeMessage(errorText(err, 'Task updates are unavailable.'));
      await loadBridgeStatus();
    } finally {
      setBridgeBusy('');
    }
  };

  const pollBridgeDirectives = async () => {
    setBridgeBusy('poll');
    setBridgeMessage('');
    try {
      const result = await window.plexus.thoughtseedSyncFabricTasks();
      applyFabricTasks(result.tasks);
      setBridgeMessage(result.conflictCount
        ? 'Task assignments refreshed. Some updates need admin review.'
        : 'Task assignments refreshed.');
      await loadBridgeStatus();
    } catch (err) {
      setBridgeMessage(errorText(err, 'Task assignments could not be refreshed.'));
      await loadBridgeStatus();
    } finally {
      setBridgeBusy('');
    }
  };

  const updateTaskDraft = (taskId: string, patch: Partial<TaskDraft>) => {
    setTaskDrafts((prev) => ({ ...prev, [taskId]: { ...(prev[taskId] ?? DEFAULT_DRAFT), ...patch } }));
  };

  const syncFabricTasks = async () => {
    setTaskBusy('sync');
    setTaskMessage('');
    try {
      const result = await window.plexus.thoughtseedSyncFabricTasks();
      applyFabricTasks(result.tasks);
      setTaskMessage(result.conflictCount ? 'Task assignments synced. Some updates need admin review.' : 'Task assignments synced.');
      await loadBridgeStatus();
    } catch (err) {
      setTaskMessage(errorText(err, 'Task assignments could not be synced.'));
      await loadBridgeStatus();
    } finally {
      setTaskBusy(null);
    }
  };

  const chooseTaskMode = async (taskId: string, mode: ThoughtseedFabricTaskWorkMode) => {
    if (!canWriteWithOverride) {
      setTaskMessage('Task updates are blocked for this test-mode target. Use a one-time guarded override.');
      return;
    }
    setTaskBusy(taskId);
    setTaskMessage('');
    try {
      const result = await window.plexus.thoughtseedSetFabricTaskWorkMode(taskId, mode);
      setFabricTasks((prev) => prev.map((task) => task.taskId === taskId ? result.task : task));
      setTaskMessage(`Task handling saved: ${modeLabel(mode)}.`);
      consumeOverride();
    } catch (err) {
      setTaskMessage(errorText(err, 'Could not save how you will handle this task.'));
    } finally {
      setTaskBusy(null);
    }
  };

  const reportTask = async (taskId: string, statusValue: ThoughtseedFabricTaskStatus) => {
    if (!canWriteWithOverride) {
      setTaskMessage('Task updates are blocked for this test-mode target. Use a one-time guarded override.');
      return;
    }
    const draft = taskDrafts[taskId] ?? DEFAULT_DRAFT;
    setTaskBusy(taskId);
    setTaskMessage('');
    try {
      const result = await window.plexus.thoughtseedReportFabricTask({
        taskId,
        status: statusValue,
        note: draft.note,
        blocker: draft.blocker,
        evidence: draft.evidenceValue.trim()
          ? { type: draft.evidenceType, value: draft.evidenceValue.trim() }
          : undefined,
      });
      setFabricTasks((prev) => prev.map((task) => task.taskId === taskId ? result.task : task));
      setTaskDrafts((prev) => ({ ...prev, [taskId]: { ...DEFAULT_DRAFT } }));
      setTaskMessage(`Task update sent: ${statusLabel(statusValue)}.`);
      await loadBridgeStatus();
      consumeOverride();
    } catch (err) {
      setTaskMessage(errorText(err, 'Could not send this task update.'));
      await loadBridgeStatus();
    } finally {
      setTaskBusy(null);
    }
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Optional Helpers"
        sub="task assignments and optional local helper status"
        right={
          <CommandDock>
            <Button variant="ghost" onClick={openAssistantForDailyWork}>
              Open Clio
            </Button>
            <Button variant="ghost" onClick={() => setAutoRefresh((v) => !v)} disabled={loading}>
              {autoRefresh ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="accent" onClick={refresh} disabled={loading}>
              <IconSync s={14} /> {loading ? 'Scanning...' : 'Refresh'}
            </Button>
          </CommandDock>
        }
      />

      {/* Summary bar */}
      {summary && (
        <MetricRailGroup>
          <MetricRail label="local helpers" value={allHealthy ? 'connected' : 'unavailable'} tone={allHealthy ? 'accent' : 'warning'} hint="availability" />
          <MetricRail label="task updates" value={connectionLabel(bridgeStatus?.connected)} tone={bridgeStatus?.connected ? 'accent' : 'error'} hint="assignments" />
          <MetricRail label="clio proof" value={status?.dailyProof?.ready ? 'ready' : 'needed'} tone={status?.dailyProof?.ready ? 'accent' : 'warning'} hint="clio" />
          <MetricRail label="follow-ups" value={activeHandoffs.length ? 'check' : 'clear'} tone={activeHandoffs.length ? 'warning' : 'accent'} hint="queue" />
        </MetricRailGroup>
      )}

      {isAdminEmployeeTestMode && (
        <DegradedStatePanel
          title="Admin employee test-mode lane"
          message={writesBlockedBySafety
            ? `${status?.safety.reason} ${guardedOverrideAvailable ? 'One-time guarded override is armed for the next update.' : 'Use one guarded override to send exactly one update while testing.'}`
            : 'Disposable test company detected. Test-mode writes are permitted.'}
          tone={writesBlockedBySafety ? 'warning' : 'accent'}
          onRetry={writesBlockedBySafety && !guardedOverrideAvailable ? () => setGuardedOverrideAvailable(true) : undefined}
        />
      )}

      {/* Nudge banner when not compliant */}
      <NudgeBanner kpi={status?.kpi} />

      <InstrumentPanel
        label="task assignments"
        title="Task assignments"
        note="Review assigned work, choose how you'll handle it, and send proof when ready."
        actions={(
          <>
            <StatusChip tone={fabricTasks.length ? 'warning' : 'idle'}>{fabricTasks.length ? 'assigned' : 'none assigned'}</StatusChip>
            <Button variant="ghost" onClick={syncFabricTasks} disabled={!bridgeStatus?.connected || !!taskBusy}>
              {taskBusy === 'sync' ? 'Syncing' : 'Sync assignments'}
            </Button>
          </>
        )}
      >
        {taskMessage && (
          <DegradedStatePanel
            title={isDegradedMessage(taskMessage) ? 'Task sync degraded' : 'Task sync'}
            message={taskMessage}
            tone={isDegradedMessage(taskMessage) ? 'error' : 'accent'}
          />
        )}
        {fabricTasks.length === 0 ? (
          <EmptyStatePanel
            icon={<IconBridge s={24} />}
            title="No task assignments"
            message="New assignments appear here when task updates are connected."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {fabricTasks.map((task) => (
              <AssignmentCard
                key={task.taskId}
                task={task}
                draft={taskDrafts[task.taskId] ?? DEFAULT_DRAFT}
                busy={taskBusy === task.taskId}
                onDraft={updateTaskDraft}
                onMode={chooseTaskMode}
                onReport={reportTask}
              />
            ))}
          </div>
        )}
      </InstrumentPanel>

      {/* Standup tile */}
      <InstrumentPanel
        label="proof"
        title="Clio daily proof"
        note="Clio and Worker status are primary; helper standups are optional enrichment."
        actions={<Button variant="ghost" onClick={openAssistantForDailyWork}>Open Clio</Button>}
      >
        {status ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StandupTile status={status} />
          </div>
        ) : (
          <EmptyStatePanel title="Daily proof status loading" message="Clio daily proof appears after refresh." />
        )}
      </InstrumentPanel>

      {/* Agent grid */}
      <InstrumentPanel
        label="local helpers"
        title="Local helpers"
        note="Current helper availability for assigned work."
      >
        {status?.agents.length === 0 && !loading && (
          <EmptyStatePanel
            icon={<IconBridge s={24} />}
            title="No optional helpers available"
            message="Clio daily work can continue; check helpers only if assigned work needs them."
          />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {status?.agents.map((a) => <AgentTile key={a.agentId} agent={a} />)}
        </div>
      </InstrumentPanel>

      {/* Connection + proof */}
      <InstrumentPanel
        label="connection"
        title="Workspace connection"
        note="Check whether task updates can sync; daily proof starts in Clio."
      >
        <div className="px-fabric-connection-grid">
          <div className="px-stat">
            <div className="px-lbl">Workspace connection</div>
            <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 6, color: status?.bridge.reachable ? 'var(--accent)' : 'var(--rose)' }}>
              {status?.bridge.reachable ? <IconCheck s={14} /> : <IconClose s={14} />}
              {connectionLabel(status?.bridge.reachable)}
            </div>
          </div>
          <div className="px-stat primary">
            <div className="px-lbl">Task updates</div>
            <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 6, color: bridgeStatus?.connected ? 'var(--accent)' : 'var(--rose)' }}>
              {bridgeStatus?.connected ? <IconCheck s={14} /> : <IconClose s={14} />}
              {connectionLabel(bridgeStatus?.connected)}
            </div>
            {bridgeMessage && (
              <div className="px-lbl" style={{ color: bridgeStatus?.lastError ? 'var(--rose)' : 'var(--t3)', marginTop: 6 }}>
                {bridgeMessage}
              </div>
            )}
            <CommandDock align="start">
              <Button variant="ghost" onClick={sendBridgeHeartbeat} disabled={!bridgeStatus?.connected || !!bridgeBusy}>
                {bridgeBusy === 'heartbeat' ? 'Checking' : 'Check connection'}
              </Button>
              <Button variant="ghost" onClick={pollBridgeDirectives} disabled={!bridgeStatus?.connected || !!bridgeBusy}>
                {bridgeBusy === 'poll' ? 'Refreshing' : 'Refresh assignments'}
              </Button>
            </CommandDock>
          </div>
          <div className="px-stat" style={{ minWidth: 140 }}>
            <div className="px-lbl">Clio proof</div>
            <div className="v">{status?.dailyProof?.ready ? 'ready' : 'needed'}</div>
          </div>
          <div className="px-stat">
            <div className="px-lbl">Follow-ups</div>
            <div className="v">{activeHandoffs.length ? 'check' : 'clear'}</div>
          </div>
        </div>
      </InstrumentPanel>

      <InstrumentPanel
        label="follow-ups"
        title="Follow-up queue"
        note="Items that can be retried when task updates or proof need another attempt."
        actions={<StatusChip tone={activeHandoffs.length ? 'warning' : 'accent'}>{activeHandoffs.length ? 'needs attention' : 'clear'}</StatusChip>}
      >
        {handoffError && (
          <DegradedStatePanel title="Follow-ups unavailable" message={handoffError} tone="error" onRetry={loadHandoffs} />
        )}
        {!handoffs.length && !handoffError && (
          <EmptyStatePanel
            icon={<IconBridge s={24} />}
            title="No follow-ups"
            message="The queue is clear."
          />
        )}
        {handoffs.length > 0 && (
          <Ledger>
            {handoffs.slice(0, 8).map((record) => (
              <div className="px-handoff-row" key={record.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="desc">{record.title || 'Follow-up item'}</div>
                  <div className="meta">{followUpLabel(record.status)}</div>
                </div>
                <StatusChip tone={followUpTone(record.status)}>{followUpLabel(record.status)}</StatusChip>
                {(record.status === 'failed' || record.status === 'pending') && (
                  <Button type="button" variant="ghost" onClick={() => retryHandoff(record)} disabled={retryingHandoffId === record.id}>
                    <IconSync s={12} /> {retryingHandoffId === record.id ? 'Trying' : 'Try again'}
                  </Button>
                )}
              </div>
            ))}
          </Ledger>
        )}
      </InstrumentPanel>

      {/* Error state */}
      {lastError && (
        <DegradedStatePanel title="Optional helpers unavailable" message={lastError} tone="warning" onRetry={refresh} busy={loading} />
      )}

      <InstrumentPanel
        label="local helpers"
        title="Check local helpers"
        note="Runs a local readiness check for this member workspace."
      >
        <CommandDock align="start">
          <Button variant="ghost" disabled={setupLoading} onClick={async () => {
            setSetupLoading(true); setSetupOutput(''); setSetupError('');
            try {
              const res = await window.plexus.memberSetup();
              if (res.ok) {
                setSetupOutput('Optional helpers are ready.');
                refresh();
              } else {
                setSetupError(res.message || 'Local helpers could not be checked.');
              }
            } catch (err) {
              setSetupError(errorText(err, 'Local helpers could not be checked.'));
            } finally {
              setSetupLoading(false);
            }
          }}>
            {setupLoading ? 'Checking...' : 'Check helpers'}
          </Button>
        </CommandDock>
        {setupOutput && (
          <DegradedStatePanel title="Optional helpers ready" message={setupOutput} tone="accent" />
        )}
        {setupError && (
          <DegradedStatePanel title="Optional helpers unavailable" message={setupError} tone="warning" />
        )}
      </InstrumentPanel>
    </div>
  );
}
