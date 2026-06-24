import React, { useState, useEffect, useCallback } from 'react';
import {
  PageHeader, Button, Skeleton, Select, Textarea, Input,
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
  PortStatus,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricEvidenceType,
  ThoughtseedFabricTask,
  ThoughtseedFabricTaskStatus,
  ThoughtseedFabricTaskWorkMode,
} from '../../shared/types';
import { HandoffRow } from '../lib/resilience';

/* ── Helpers ─────────────────────────────────────────────── */

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const sec = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function portColor(p: PortStatus): string {
  return p.reachable ? 'var(--accent)' : 'var(--rose)';
}

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

function PortTile({ port }: { port: PortStatus }) {
  return (
    <div className="px-stat" style={{ minWidth: 140 }}>
      <div className="px-lbl">{port.label} <span style={{ color: 'var(--t3)' }}>:{port.port}</span></div>
      <div className="v" style={{ color: portColor(port), display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className={`px-dot${port.reachable ? '' : ' idle'}`} style={{ background: portColor(port) }} />
        {port.reachable ? 'up' : 'down'}
      </div>
      {port.latencyMs != null && port.reachable && (
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>{port.latencyMs}ms</div>
      )}
    </div>
  );
}

function AgentTile({ agent }: { agent: AgentHealth }) {
  const color = agentColor(agent);
  return (
    <div className="px-panel pad" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="px-dot" style={{ background: color }} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>{agent.agentName}</div>
        <StatusChip tone={agent.status === 'healthy' ? 'accent' : agent.status === 'stale' ? 'warning' : 'error'}>{agent.status}</StatusChip>
      </div>
      <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>
        heartbeat: {ago(agent.lastCycle)}
      </div>
      {agent.outcome && (
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>outcome: {agent.outcome}</div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <div className="px-lbl">steps <span style={{ color: 'var(--t2)' }}>{agent.steps}</span></div>
        <div className="px-lbl">blocked <span style={{ color: agent.blocked > 0 ? 'var(--rose)' : 'var(--t2)' }}>{agent.blocked}</span></div>
      </div>
      {agent.missingFiles > 0 && (
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--rose)' }}>{agent.missingFiles} missing files</div>
      )}
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
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>No standup submitted today in the Paperclip vault.</div>
      )}
      {kpi && (
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <div className="px-lbl">hours <span style={{ color: 'var(--accent)' }}>{todayH}h {todayM}m</span></div>
          <div className="px-lbl">compliant <span style={{ color: kpi.standupCompliant ? 'var(--accent)' : 'var(--rose)' }}>{kpi.standupCompliant ? 'yes' : 'no'}</span></div>
        </div>
      )}
    </div>
  );
}

function NudgeBanner({ kpi }: { kpi?: any }) {
  if (!kpi || kpi.standupCompliant) return null;
  return (
    <DegradedStatePanel
      title="Standup nudge"
      message="No verified work captured today. Start a repo-backed focus session to become ready."
      tone="warning"
    />
  );
}

function HermesTaskCard({
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
  const recentHistory = task.history.slice(-3);
  return (
    <div className="px-panel pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>{task.title}</span>
            <StatusChip tone={statusTone(task.status)}>{task.status.replace('_', ' ')}</StatusChip>
            <StatusChip tone={task.workMode ? 'mint' : 'idle'}>{task.workMode ?? 'mode unset'}</StatusChip>
            <StatusChip tone={evidenceTone(task)}>{task.evidenceStrength.replace('_', ' ')}</StatusChip>
          </div>
          <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
            {task.projectName ?? task.projectId ?? 'no project id'} · {task.clientName ?? 'no client'} · {task.priority ?? 'normal'}
          </div>
          {task.description && (
            <div className="px-lbl" style={{ color: 'var(--t2)', marginTop: 8 }}>{task.description}</div>
          )}
        </div>
        <div className="px-mono" style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'right' }}>
          {task.taskId}<br />events {task.history.length}
        </div>
      </div>

      {!task.workMode && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" disabled={busy} onClick={() => onMode(task.taskId, 'manual')}>Manual</Button>
          <Button variant="ghost" disabled={busy} onClick={() => onMode(task.taskId, 'delegated')}>Delegated</Button>
          <span className="px-lbl" style={{ alignSelf: 'center' }}>choose once; Hermes/admin override required after selection</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) minmax(0, 1fr)', gap: 10 }}>
        <Select
          value={draft.evidenceType}
          onChange={(e) => onDraft(task.taskId, { evidenceType: e.target.value as ThoughtseedFabricEvidenceType })}
          aria-label="Evidence type"
        >
          <option value="github_pr">GitHub PR</option>
          <option value="github_commit">Commit</option>
          <option value="github_branch">Branch</option>
          <option value="deploy_url">Deploy URL</option>
          <option value="figma_url">Figma URL</option>
          <option value="canva_url">Canva URL</option>
          <option value="doc_url">Doc URL</option>
          <option value="file_path">File path</option>
          <option value="note">Note</option>
        </Select>
        <Input
          value={draft.evidenceValue}
          onChange={(e) => onDraft(task.taskId, { evidenceValue: e.target.value })}
          placeholder="PR, branch, commit, Figma/Canva/doc URL, deploy URL, or proof path"
          aria-label="Evidence value"
        />
      </div>
      <Textarea
        value={draft.note}
        onChange={(e) => onDraft(task.taskId, { note: e.target.value })}
        rows={2}
        placeholder="Status note or completion summary"
        aria-label="Task note"
      />
      <Input
        value={draft.blocker}
        onChange={(e) => onDraft(task.taskId, { blocker: e.target.value })}
        placeholder="Blocker, access gap, or missing context"
        aria-label="Task blocker"
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="ghost" disabled={busy} onClick={() => onReport(task.taskId, 'seen')}>Seen</Button>
        <Button variant="ghost" disabled={busy || !canReportProgress} onClick={() => onReport(task.taskId, 'in_progress')}>In Progress</Button>
        <Button variant="ghost" disabled={busy || !canReportProgress} onClick={() => onReport(task.taskId, 'blocked')}>Blocked</Button>
        <Button variant="accent" disabled={busy || !canReportProgress || !hasDoneProof} onClick={() => onReport(task.taskId, 'done')}>Done</Button>
      </div>

      {task.evidence.length > 0 && (
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>
          evidence: {task.evidence.slice(-3).map((item) => `${item.type}:${item.status ?? item.strength ?? 'weak_evidence'}`).join(' · ')}
        </div>
      )}
      {recentHistory.length > 0 && (
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>
          history: {recentHistory.map((event) => `${event.type}${typeof event.payload.status === 'string' ? `:${event.payload.status}` : ''}`).join(' · ')}
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
    } catch (e: any) {
      setBridgeMessage(e?.message ?? 'Could not read Thoughtseed Bridge status.');
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
    } catch (e: any) {
      setTaskMessage(e?.message ?? 'Could not load Hermes task cards.');
    }
  }, []);

  const loadHandoffs = useCallback(async () => {
    try {
      setHandoffs(await window.plexus.handoffList());
      setHandoffError('');
    } catch (e: any) {
      setHandoffError(e?.message ?? 'Could not load handoffs.');
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLastError(null);
    try {
      const s = await window.plexus.fabricStatus();
      setStatus(s);
      await Promise.all([loadHandoffs(), loadBridgeStatus(), loadFabricTasks()]);
    } catch (e: any) {
      setLastError(e.message || 'Probe failed');
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
    } catch (e: any) {
      setHandoffError(e?.message ?? 'Retry failed.');
      await loadHandoffs();
    } finally {
      setRetryingHandoffId(null);
    }
  };

  const sendBridgeHeartbeat = async () => {
    setBridgeBusy('heartbeat');
    setBridgeMessage('');
    try {
      const result = await window.plexus.thoughtseedSendHeartbeat();
      setBridgeMessage(`Heartbeat sent: ${result.id}`);
      await loadBridgeStatus();
    } catch (e: any) {
      setBridgeMessage(e?.message ?? 'Thoughtseed Bridge heartbeat failed.');
      await loadBridgeStatus();
    } finally {
      setBridgeBusy('');
    }
  };

  const pollBridgeDirectives = async () => {
    setBridgeBusy('poll');
    setBridgeMessage('');
    try {
      const result = await window.plexus.thoughtseedPollDirectives();
      setBridgeMessage(`${result.directives.length} directive${result.directives.length === 1 ? '' : 's'} pending`);
      await loadBridgeStatus();
    } catch (e: any) {
      setBridgeMessage(e?.message ?? 'Thoughtseed Bridge directive poll failed.');
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
      setTaskMessage(`${result.ingestedDirectiveIds.length} task directive${result.ingestedDirectiveIds.length === 1 ? '' : 's'} synced${result.conflictCount ? ` · ${result.conflictCount} conflict${result.conflictCount === 1 ? '' : 's'} reported` : ''}`);
      await loadBridgeStatus();
    } catch (e: any) {
      setTaskMessage(e?.message ?? 'Hermes task sync failed.');
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
      setTaskMessage(`Work mode locked as ${mode}`);
    } catch (e: any) {
      setTaskMessage(e?.message ?? 'Could not set work mode.');
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
      setTaskMessage(`Report sent: ${statusValue.replace('_', ' ')}`);
      await loadBridgeStatus();
    } catch (e: any) {
      setTaskMessage(e?.message ?? 'Could not report task status.');
      await loadBridgeStatus();
    } finally {
      setTaskBusy(null);
    }
  };

  return (
    <div className="px-fadein">
      <PageHeader
        title="Agent Fabric"
        sub="local agent-orchestration health & telemetry"
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

      {/* Port tiles */}
      <InstrumentPanel
        label="ports"
        title="Runtime endpoints"
        note="Local service probes for agent fabric dependencies."
        trace
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {status?.ports.map((p) => <PortTile key={p.port} port={p} />) ?? (
            <>
              <Skeleton lines={1} widths={['120px']} />
              <Skeleton lines={1} widths={['120px']} />
            </>
          )}
        </div>
      </InstrumentPanel>

      {/* Summary bar */}
      {summary && (
        <MetricRailGroup>
          <MetricRail label="agents" value={`${summary.healthy}/${summary.total}`} tone={allHealthy ? 'accent' : 'warning'} hint="healthy / total" />
          <MetricRail label="stale" value={summary.stale} tone={summary.stale ? 'warning' : 'idle'} hint="needs cycle" />
          <MetricRail label="uninit" value={summary.uninitialized} tone={summary.uninitialized ? 'warning' : 'idle'} hint="not started" />
          <MetricRail label="missing files" value={summary.missingFileAgents} tone={summary.missingFileAgents ? 'error' : 'idle'} hint="agent proof" />
          <MetricRail label="bridge" value={status?.bridge.reachable ? 'up' : 'down'} tone={status?.bridge.reachable ? 'accent' : 'error'} hint="paperclip" />
          <MetricRail label="standups" value={status?.vault.standups ?? 0} tone="mint" hint="vault" />
          <MetricRail label="handoffs" value={status?.vault.handoffs ?? 0} tone="mint" hint="vault" />
        </MetricRailGroup>
      )}

      {/* Nudge banner when not compliant */}
      <NudgeBanner kpi={status?.kpi} />

      <InstrumentPanel
        label="Hermes tasks"
        title="Member-scoped assignments"
        note="Tasks come from Cambium/Hermes; Plexus displays and reports status, but does not execute them."
        actions={(
          <>
            <StatusChip tone={fabricTasks.length ? 'warning' : 'idle'}>{fabricTasks.length} cards</StatusChip>
            <Button variant="ghost" onClick={syncFabricTasks} disabled={!bridgeStatus?.connected || !!taskBusy}>
              {taskBusy === 'sync' ? 'Syncing' : 'Sync'}
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
            title="No Hermes task cards synced"
            message="Sync pulls member-scoped assignments from the Thoughtseed bridge when connected."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {fabricTasks.map((task) => (
              <HermesTaskCard
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
        label="standup"
        title="Daily proof pulse"
        note="Standup and KPI state from the Paperclip vault."
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StandupTile standup={status?.standup} kpi={status?.kpi} />
        </div>
      </InstrumentPanel>

      {/* G1: Install status */}
      {status?.install && (
        <InstrumentPanel
          label="install status"
          title="Local Paperclip runtime"
          note="Binary and config checks before agent fabric health can be trusted."
        >
          <MetricRailGroup>
            <MetricRail label="binary" value={status.install.binaryFound ? 'installed' : 'missing'} tone={status.install.binaryFound ? 'accent' : 'error'} hint="paperclipai" />
            <MetricRail label="config" value={status.install.configFound ? `port ${status.install.serverPort}` : 'not found'} tone={status.install.configFound ? 'accent' : 'error'} hint="runtime" />
          </MetricRailGroup>
        </InstrumentPanel>
      )}

      {/* Agent grid */}
      <InstrumentPanel
        label="agents"
        title="Local agent health"
        note="Heartbeat, missing-file, and blocked-step state from the fabric probe."
      >
        {status?.agents.length === 0 && !loading && (
          <EmptyStatePanel
            icon={<IconBridge s={24} />}
            title="No agents found"
            message="The Paperclip runtime may be offline or not yet provisioned."
          />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {status?.agents.map((a) => <AgentTile key={a.agentId} agent={a} />)}
        </div>
      </InstrumentPanel>

      {/* Bridge + vault */}
      <InstrumentPanel
        label="bridge & vault"
        title="Transport and persistence"
        note="Paperclip bridge, Thoughtseed bridge, and local vault counters."
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="px-stat" style={{ minWidth: 180 }}>
            <div className="px-lbl">Paperclip bridge</div>
            <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 6, color: status?.bridge.reachable ? 'var(--accent)' : 'var(--rose)' }}>
              {status?.bridge.reachable ? <IconCheck s={14} /> : <IconClose s={14} />}
              {status?.bridge.message ?? 'Bridge has not been checked yet'}
            </div>
          </div>
          <div className="px-stat" style={{ minWidth: 220 }}>
            <div className="px-lbl">Thoughtseed Bridge</div>
            <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 6, color: bridgeStatus?.connected ? 'var(--accent)' : 'var(--rose)' }}>
              {bridgeStatus?.connected ? <IconCheck s={14} /> : <IconClose s={14} />}
              {bridgeStatus?.connected ? `Cambium:${bridgeStatus.memberId}` : 'not connected'}
            </div>
            <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
              {bridgeStatus?.lastSeenAt ? `last seen ${ago(bridgeStatus.lastSeenAt)}` : bridgeStatus?.configured ? 'awaiting first heartbeat' : 'redeem in Settings'}
            </div>
            {bridgeMessage && (
              <div className="px-mono" style={{ fontSize: 11, color: bridgeStatus?.lastError ? 'var(--rose)' : 'var(--t3)', marginTop: 6 }}>
                {bridgeMessage}
              </div>
            )}
            <CommandDock align="start">
              <Button variant="ghost" onClick={sendBridgeHeartbeat} disabled={!bridgeStatus?.connected || !!bridgeBusy}>
                {bridgeBusy === 'heartbeat' ? 'Sending' : 'Heartbeat'}
              </Button>
              <Button variant="ghost" onClick={pollBridgeDirectives} disabled={!bridgeStatus?.connected || !!bridgeBusy}>
                {bridgeBusy === 'poll' ? 'Polling' : 'Poll'}
              </Button>
            </CommandDock>
          </div>
          <div className="px-stat" style={{ minWidth: 140 }}>
            <div className="px-lbl">vault standups</div>
            <div className="v">{status?.vault.standups ?? 0}</div>
          </div>
          <div className="px-stat" style={{ minWidth: 140 }}>
            <div className="px-lbl">vault handoffs</div>
            <div className="v">{status?.vault.handoffs ?? 0}</div>
          </div>
        </div>
      </InstrumentPanel>

      <InstrumentPanel
        label="handoffs"
        title="Retry queue"
        note="Optional sync, Paperclip, standup, preferences, and closeout work that can be retried."
        actions={<StatusChip tone={activeHandoffs.length ? 'warning' : 'accent'}>{activeHandoffs.length} active</StatusChip>}
      >
        {handoffError && (
          <DegradedStatePanel title="Handoffs unavailable" message={handoffError} tone="error" onRetry={loadHandoffs} />
        )}
        {!handoffs.length && !handoffError && (
          <EmptyStatePanel
            icon={<IconBridge s={24} />}
            title="No retryable handoffs"
            message="The queue is clear."
          />
        )}
        {handoffs.length > 0 && (
          <Ledger>
            {handoffs.slice(0, 8).map((record) => (
              <HandoffRow
                key={record.id}
                record={record}
                onRetry={retryHandoff}
                busy={retryingHandoffId === record.id}
              />
            ))}
          </Ledger>
        )}
      </InstrumentPanel>

      {/* Shell health-check output */}
      {status?.shellHealthCheck && (
        <InstrumentPanel
          label="shell health-check"
          title="Probe output"
          note="Raw local command output for diagnosing runtime setup."
        >
          <pre className="px-mono" style={{ fontSize: 11, maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {status.shellHealthCheck.output}
          </pre>
        </InstrumentPanel>
      )}

      {/* Error state */}
      {lastError && (
        <DegradedStatePanel title="Probe error" message={lastError} tone="error" onRetry={refresh} busy={loading} />
      )}

      {/* Phase 7 — Install / Repair */}
      <InstrumentPanel
        label="install / repair"
        title="Per-member provisioning"
        note="Runs setup-member.sh for local Paperclip provisioning."
      >
        <CommandDock align="start">
          <Button variant="ghost" disabled={setupLoading} onClick={async () => {
            setSetupLoading(true); setSetupOutput(''); setSetupError('');
            try {
              const res = await window.plexus.memberSetup();
              if (res.ok) {
                setSetupOutput(res.output || 'Setup complete.');
                refresh();
              } else {
                setSetupError(res.message || 'Setup failed');
              }
            } catch (e: any) {
              setSetupError(e.message);
            } finally {
              setSetupLoading(false);
            }
          }}>
            {setupLoading ? 'Running...' : 'Install / Repair'}
          </Button>
        </CommandDock>
        {setupOutput && (
          <pre className="px-mono" style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', background: 'var(--bg-1)', padding: 12 }}>{setupOutput}</pre>
        )}
        {setupError && (
          <DegradedStatePanel title="Setup failed" message={setupError} tone="error" />
        )}
      </InstrumentPanel>
    </div>
  );
}
