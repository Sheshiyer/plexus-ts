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
  ThoughtseedBridgeStatus,
  ThoughtseedFabricEvidenceType,
  ThoughtseedFabricTask,
  ThoughtseedFabricTaskStatus,
  ThoughtseedFabricTaskWorkMode,
} from '../../shared/types';

/* ── Helpers ─────────────────────────────────────────────── */

function agentColor(a: AgentHealth): string {
  if (a.status === 'healthy') return 'var(--accent)';
  if (a.status === 'stale') return 'var(--warn)';
  return 'var(--rose)';
}

function standupValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed !== '—' ? trimmed : fallback;
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
    ? 'Ready for local work.'
    : 'Check local helpers or ask an admin for help.';
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

/* ── Sub-components ──────────────────────────────────────── */

function AgentTile({ agent }: { agent: AgentHealth }) {
  const color = agentColor(agent);
  return (
    <div className="px-panel pad" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="px-dot" style={{ background: color }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{agent.agentName}</div>
        <StatusChip tone={agent.status === 'healthy' ? 'accent' : 'error'}>{helperLabel(agent)}</StatusChip>
      </div>
      <div className="px-lbl" style={{ color: 'var(--t2)' }}>{helperDetail(agent)}</div>
    </div>
  );
}

function StandupTile({ standup, kpi }: { standup?: any; kpi?: any }) {
  if (!standup && !kpi) return null;
  const todayH = kpi ? Math.floor((kpi.todaySeconds ?? 0) / 3600) : 0;
  const todayM = kpi ? Math.floor(((kpi.todaySeconds ?? 0) % 3600) / 60) : 0;
  return (
    <div className="px-panel pad" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="px-dot" style={{ background: 'var(--accent)' }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>Today's standup</div>
      </div>
      {standup ? (
        <>
          <div className="px-lbl">yesterday <span style={{ color: 'var(--t2)' }}>{standupValue(standup.yesterday, 'Not recorded in today\'s standup')}</span></div>
          <div className="px-lbl">today <span style={{ color: 'var(--t2)' }}>{standupValue(standup.today, 'Not recorded in today\'s standup')}</span></div>
          <div className="px-lbl">blockers <span style={{ color: 'var(--rose)' }}>{standupValue(standup.blockers, 'No blockers recorded')}</span></div>
        </>
      ) : (
        <div className="px-lbl" style={{ color: 'var(--t3)' }}>No daily proof submitted yet.</div>
      )}
      {kpi && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <div className="px-lbl">hours <span style={{ color: 'var(--accent)' }}>{todayH}h {todayM}m</span></div>
          <div className="px-lbl">proof <span style={{ color: kpi.standupCompliant ? 'var(--accent)' : 'var(--rose)' }}>{kpi.standupCompliant ? 'ready' : 'needed'}</span></div>
        </div>
      )}
    </div>
  );
}

function NudgeBanner({ kpi }: { kpi?: any }) {
  if (!kpi || kpi.standupCompliant) return null;
  return (
    <DegradedStatePanel
      title="Daily proof reminder"
      message="Add a short proof note for today's work when you are ready."
      tone="warning"
    />
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
  const canReportProgress = Boolean(task.workMode || task.status === 'assigned' || task.status === 'seen');
  const hasDoneProof = draft.note.trim() || draft.evidenceValue.trim();
  return (
    <div className="px-panel pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>{task.title}</span>
            <StatusChip tone={statusTone(task.status)}>{statusLabel(task.status)}</StatusChip>
            <StatusChip tone={task.workMode ? 'mint' : 'idle'}>{modeLabel(task.workMode)}</StatusChip>
            <StatusChip tone={evidenceTone(task)}>{proofLabel(task)}</StatusChip>
          </div>
          <div className="px-lbl" style={{ color: 'var(--t3)', marginTop: 6 }}>
            {task.projectName ?? 'Assigned project'} · {task.clientName ?? 'Workspace task'} · {task.priority ?? 'normal'}
          </div>
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
        <Button variant="accent" disabled={busy || !canReportProgress || !hasDoneProof} onClick={() => onReport(task.taskId, 'done')}>Done</Button>
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

  const loadBridgeStatus = useCallback(async () => {
    try {
      setBridgeStatus(await window.plexus.thoughtseedBridgeStatus());
    } catch {
      setBridgeMessage('Task updates are unavailable.');
    }
  }, []);

  const loadFabricTasks = useCallback(async () => {
    try {
      const result = await window.plexus.thoughtseedFabricTasks();
      setFabricTasks(result.tasks);
      setTaskDrafts((prev) => {
        const next = { ...prev };
        for (const task of result.tasks) {
          if (!next[task.taskId]) next[task.taskId] = { ...DEFAULT_DRAFT };
        }
        return next;
      });
    } catch {
      setTaskMessage('Could not load task assignments.');
    }
  }, []);

  const loadHandoffs = useCallback(async () => {
    try {
      setHandoffs(await window.plexus.handoffList());
      setHandoffError('');
    } catch {
      setHandoffError('Could not load follow-ups.');
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLastError(null);
    try {
      const s = await window.plexus.fabricStatus();
      setStatus(s);
      await Promise.all([loadHandoffs(), loadBridgeStatus(), loadFabricTasks()]);
    } catch {
      setLastError('Local helpers are unavailable.');
    } finally {
      setLoading(false);
    }
  }, [loadBridgeStatus, loadFabricTasks, loadHandoffs]);

  useEffect(() => {
    refresh();
    if (!autoRefresh) return;
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh, autoRefresh]);

  const summary = status?.summary;
  const allHealthy = summary && summary.healthy === summary.total && summary.total > 0;
  const activeHandoffs = handoffs.filter((handoff) => handoff.status !== 'sent' && handoff.status !== 'skipped');
  const retryHandoff = async (record: HandoffRecord) => {
    setRetryingHandoffId(record.id);
    try {
      await window.plexus.handoffRetry(record.id);
      await loadHandoffs();
      await refresh();
    } catch {
      setHandoffError('Could not retry this follow-up.');
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
    } catch {
      setBridgeMessage('Task updates are unavailable.');
      await loadBridgeStatus();
    } finally {
      setBridgeBusy('');
    }
  };

  const pollBridgeDirectives = async () => {
    setBridgeBusy('poll');
    setBridgeMessage('');
    try {
      await window.plexus.thoughtseedPollDirectives();
      setBridgeMessage('Task assignments refreshed.');
      await loadBridgeStatus();
    } catch {
      setBridgeMessage('Task assignments could not be refreshed.');
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
      setFabricTasks(result.tasks);
      setTaskMessage(result.conflictCount ? 'Task assignments synced. Some updates need admin review.' : 'Task assignments synced.');
      await loadBridgeStatus();
    } catch {
      setTaskMessage('Task assignments could not be synced.');
      await loadBridgeStatus();
    } finally {
      setTaskBusy(null);
    }
  };

  const chooseTaskMode = async (taskId: string, mode: ThoughtseedFabricTaskWorkMode) => {
    setTaskBusy(taskId);
    setTaskMessage('');
    try {
      const result = await window.plexus.thoughtseedSetFabricTaskWorkMode(taskId, mode);
      setFabricTasks((prev) => prev.map((task) => task.taskId === taskId ? result.task : task));
      setTaskMessage(`Task handling saved: ${modeLabel(mode)}.`);
    } catch {
      setTaskMessage('Could not save how you will handle this task.');
    } finally {
      setTaskBusy(null);
    }
  };

  const reportTask = async (taskId: string, statusValue: ThoughtseedFabricTaskStatus) => {
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
    } catch {
      setTaskMessage('Could not send this task update.');
      await loadBridgeStatus();
    } finally {
      setTaskBusy(null);
    }
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Task Assignments"
        sub="task updates and local helper status"
        right={
          <CommandDock>
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
          <MetricRail label="daily proof" value={status?.kpi?.standupCompliant ? 'ready' : 'needed'} tone={status?.kpi?.standupCompliant ? 'accent' : 'warning'} hint="proof" />
          <MetricRail label="follow-ups" value={activeHandoffs.length ? 'check' : 'clear'} tone={activeHandoffs.length ? 'warning' : 'accent'} hint="queue" />
        </MetricRailGroup>
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
            title={/failed|Could not|requires|not found|conflict/i.test(taskMessage) ? 'Task sync degraded' : 'Task sync'}
            message={taskMessage}
            tone={/failed|Could not|requires|not found|conflict/i.test(taskMessage) ? 'error' : 'accent'}
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
        title="Daily proof"
        note="Today's work proof and readiness."
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StandupTile standup={status?.standup} kpi={status?.kpi} />
        </div>
      </InstrumentPanel>

      {/* G1: Install status */}
      {status?.install && (
        <InstrumentPanel
          label="local helpers"
          title="Local helper setup"
          note="Checks whether optional local helpers are ready for assigned work."
        >
          <MetricRailGroup>
            <MetricRail label="helper app" value={status.install.binaryFound ? 'connected' : 'unavailable'} tone={status.install.binaryFound ? 'accent' : 'error'} hint="availability" />
            <MetricRail label="helper setup" value={status.install.configFound ? 'connected' : 'unavailable'} tone={status.install.configFound ? 'accent' : 'error'} hint="readiness" />
          </MetricRailGroup>
        </InstrumentPanel>
      )}

      {/* Agent grid */}
      <InstrumentPanel
        label="local helpers"
        title="Local helpers"
        note="Current helper availability for assigned work."
      >
        {status?.agents.length === 0 && !loading && (
          <EmptyStatePanel
            icon={<IconBridge s={24} />}
            title="No local helpers available"
            message="Check local helpers if this workspace should use them."
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
        note="Check whether task updates and daily proof can sync."
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="px-stat" style={{ minWidth: 180 }}>
            <div className="px-lbl">Workspace connection</div>
            <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 6, color: status?.bridge.reachable ? 'var(--accent)' : 'var(--rose)' }}>
              {status?.bridge.reachable ? <IconCheck s={14} /> : <IconClose s={14} />}
              {connectionLabel(status?.bridge.reachable)}
            </div>
          </div>
          <div className="px-stat" style={{ minWidth: 220 }}>
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
            <div className="px-lbl">Daily proof</div>
            <div className="v">{status?.kpi?.standupCompliant ? 'ready' : 'needed'}</div>
          </div>
          <div className="px-stat" style={{ minWidth: 140 }}>
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
        <DegradedStatePanel title="Local helpers unavailable" message={lastError} tone="error" onRetry={refresh} busy={loading} />
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
                setSetupOutput('Local helpers are ready.');
                refresh();
              } else {
                setSetupError('Local helpers could not be checked.');
              }
            } catch {
              setSetupError('Local helpers could not be checked.');
            } finally {
              setSetupLoading(false);
            }
          }}>
            {setupLoading ? 'Checking...' : 'Check helpers'}
          </Button>
        </CommandDock>
        {setupOutput && (
          <DegradedStatePanel title="Local helpers ready" message={setupOutput} tone="accent" />
        )}
        {setupError && (
          <DegradedStatePanel title="Local helpers unavailable" message={setupError} tone="error" />
        )}
      </InstrumentPanel>
    </div>
  );
}
