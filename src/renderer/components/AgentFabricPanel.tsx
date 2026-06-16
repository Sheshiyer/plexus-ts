import React, { useState, useEffect, useCallback } from 'react';
import {
  PageHeader, Panel, Button, Badge, SectionLabel, StatCard, Skeleton, EmptyState,
} from './ui';
import {
  IconBridge, IconSync, IconCheck, IconClose, IconCloud,
} from './Icons';
import type { FabricStatus, AgentHealth, PortStatus, OrgConfig, AgentSkillInfo, TaskFeedStatus } from '../../shared/types';

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
  if (a.status === 'stale') return '#C4A77D';
  return 'var(--rose)';
}

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
        <Badge tone={agent.status === 'healthy' ? 'mint' : agent.status === 'stale' ? undefined : 'rose'}>{agent.status}</Badge>
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
          <div className="px-lbl">yesterday <span style={{ color: 'var(--t2)' }}>{standup.yesterday || '—'}</span></div>
          <div className="px-lbl">today <span style={{ color: 'var(--t2)' }}>{standup.today || '—'}</span></div>
          <div className="px-lbl">blockers <span style={{ color: 'var(--rose)' }}>{standup.blockers || 'None'}</span></div>
        </>
      ) : (
        <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>No standup file found in vault.</div>
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
    <Panel raised pad crosshairs style={{ marginTop: 18, borderColor: 'var(--rose)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--rose)', fontWeight: 600 }}>
        <IconClose s={14} />
        Standup nudge: No time tracked today. Start the timer to become compliant.
      </div>
    </Panel>
  );
}

function OrgConfigPanel({ org }: { org?: OrgConfig }) {
  if (!org) return null;
  return (
    <Panel raised pad crosshairs style={{ marginTop: 18 }}>
      <SectionLabel style={{ marginBottom: 12 }}>organization</SectionLabel>
      <div className="px-specs px-specs-four" style={{ marginBottom: 12 }}>
        <div className="px-spec"><span className="l">org</span><span className="v">{org.orgName}</span></div>
        <div className="px-spec"><span className="l">manifest</span><span className="v">v{org.version}</span></div>
        <div className="px-spec"><span className="l">coordination</span><span className="v">{org.coordinationMethod}</span></div>
        <div className="px-spec"><span className="l">heartbeat</span><span className="v">{org.heartbeat}</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {org.departments.map((d) => (
          <div key={d.key} className="px-panel pad" style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
            <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>lead: {d.lead}</div>
            <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{d.description.slice(0, 60)}</div>
          </div>
        ))}
      </div>
      {org.standup && (
        <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 12, color: 'var(--t3)' }}>
          <span>standup: {org.standup.time}</span>
          <span>aggregator: {org.standup.aggregator}</span>
          <span>dispatcher: {org.standup.dispatcher}</span>
        </div>
      )}
    </Panel>
  );
}

function SkillsPanel({ skills }: { skills: AgentSkillInfo[] }) {
  if (!skills.length) return null;
  return (
    <Panel raised pad crosshairs style={{ marginTop: 18 }}>
      <SectionLabel style={{ marginBottom: 12 }}>agent skills</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {skills.map((s) => (
          <div key={s.agentId} className="px-panel pad" style={{ fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>{s.agentName}</span>
              <Badge>{s.department}</Badge>
            </div>
            {s.skills.length > 0 ? (
              <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>
                {s.skills.slice(0, 5).map((sk) => sk.replace('thoughtseed-', '')).join(', ')}
                {s.skills.length > 5 && ` +${s.skills.length - 5} more`}
              </div>
            ) : (
              <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)' }}>no skills assigned</div>
            )}
            {s.routingTags.length > 0 && (
              <div className="px-mono" style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                tags: {s.routingTags.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TaskFeedPanel({ feed }: { feed?: TaskFeedStatus }) {
  if (!feed) return null;
  return (
    <Panel raised pad crosshairs style={{ marginTop: 18 }}>
      <SectionLabel style={{ marginBottom: 12 }}>task feed</SectionLabel>
      <div className="px-specs px-specs-four">
        <div className="px-spec">
          <span className="l">feed sync</span>
          <span className="v" style={{ color: feed.feedSyncConfigured ? 'var(--accent)' : 'var(--rose)' }}>
            {feed.feedSyncConfigured ? 'configured' : 'not configured'}
          </span>
        </div>
        <div className="px-spec">
          <span className="l">pending</span>
          <span className="v" style={{ color: feed.pendingTasks > 0 ? 'var(--accent)' : 'var(--t3)' }}>
            {feed.pendingTasks}
          </span>
        </div>
        {feed.lastFeedAt && (
          <div className="px-spec">
            <span className="l">last sync</span>
            <span className="v">{new Date(feed.lastFeedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </Panel>
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
  const [agentSkills, setAgentSkills] = useState<AgentSkillInfo[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLastError(null);
    try {
      const [s, skills] = await Promise.all([
        window.plexus.fabricStatus(),
        window.plexus.fabricAgentSkills(),
      ]);
      setStatus(s);
      setAgentSkills(skills);
    } catch (e: any) {
      setLastError(e.message || 'Probe failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!autoRefresh) return;
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh, autoRefresh]);

  const summary = status?.summary;
  const allHealthy = summary && summary.healthy === summary.total && summary.total > 0;

  return (
    <div className="px-fadein">
      <PageHeader
        title="Agent Fabric"
        sub="local agent-orchestration health & telemetry"
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="ghost" onClick={() => setAutoRefresh((v) => !v)} disabled={loading}>
              {autoRefresh ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="accent" onClick={refresh} disabled={loading}>
              <IconSync s={14} /> {loading ? 'Scanning…' : 'Refresh'}
            </Button>
          </div>
        }
      />

      {/* Port tiles */}
      <Panel raised pad crosshairs>
        <SectionLabel style={{ marginBottom: 12 }}>ports</SectionLabel>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {status?.ports.map((p) => <PortTile key={p.port} port={p} />) ?? (
            <>
              <Skeleton lines={1} widths={['120px']} />
              <Skeleton lines={1} widths={['120px']} />
            </>
          )}
        </div>
      </Panel>

      {/* Summary bar */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <StatCard label="agents" value={`${summary.healthy}/${summary.total}`} accent={allHealthy} />
          <StatCard label="stale" value={summary.stale} />
          <StatCard label="uninit" value={summary.uninitialized} />
          <StatCard label="missing files" value={summary.missingFileAgents} />
          <StatCard label="bridge" value={status?.bridge.reachable ? 'up' : 'down'} />
          <StatCard label="standups" value={status?.vault.standups ?? 0} />
          <StatCard label="handoffs" value={status?.vault.handoffs ?? 0} />
        </div>
      )}

      {/* Nudge banner when not compliant */}
      <NudgeBanner kpi={status?.kpi} />

      {/* Standup tile */}
      <Panel raised pad crosshairs style={{ marginTop: 18 }}>
        <SectionLabel style={{ marginBottom: 12 }}>standup</SectionLabel>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StandupTile standup={status?.standup} kpi={status?.kpi} />
        </div>
      </Panel>

      {/* G1: Install status */}
      {status?.install && (
        <Panel raised pad crosshairs style={{ marginTop: 18 }}>
          <SectionLabel style={{ marginBottom: 12 }}>install status</SectionLabel>
          <div className="px-specs px-specs-four">
            <div className="px-spec">
              <span className="l">binary</span>
              <span className="v" style={{ color: status.install.binaryFound ? 'var(--accent)' : 'var(--rose)' }}>
                {status.install.binaryFound ? 'installed' : 'missing'}
              </span>
            </div>
            <div className="px-spec">
              <span className="l">repo</span>
              <span className="v" style={{ color: status.install.repoFound ? 'var(--accent)' : 'var(--rose)' }}>
                {status.install.repoFound ? 'found' : 'missing'}
              </span>
            </div>
            <div className="px-spec">
              <span className="l">config</span>
              <span className="v" style={{ color: status.install.configFound ? 'var(--accent)' : 'var(--rose)' }}>
                {status.install.configFound ? `port ${status.install.serverPort}` : 'default'}
              </span>
            </div>
          </div>
        </Panel>
      )}

      {/* G3: Org config */}
      <OrgConfigPanel org={status?.org} />

      {/* G4: Agent skills */}
      <SkillsPanel skills={agentSkills} />

      {/* G5/G6: Task feed */}
      <TaskFeedPanel feed={status?.taskFeed} />

      {/* Agent grid */}
      <Panel raised pad crosshairs style={{ marginTop: 18 }}>
        <SectionLabel style={{ marginBottom: 12 }}>agents</SectionLabel>
        {status?.agents.length === 0 && !loading && (
          <EmptyState icon={<IconBridge s={24} />}>
            No agents found. The Paperclip runtime may be offline or not yet provisioned.
          </EmptyState>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {status?.agents.map((a) => <AgentTile key={a.agentId} agent={a} />)}
        </div>
      </Panel>

      {/* Bridge + vault */}
      <Panel raised pad crosshairs style={{ marginTop: 18 }}>
        <SectionLabel style={{ marginBottom: 12 }}>bridge &amp; vault</SectionLabel>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="px-stat" style={{ minWidth: 180 }}>
            <div className="px-lbl">MultiCA bridge</div>
            <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 6, color: status?.bridge.reachable ? 'var(--accent)' : 'var(--rose)' }}>
              {status?.bridge.reachable ? <IconCheck s={14} /> : <IconClose s={14} />}
              {status?.bridge.message ?? 'unknown'}
            </div>
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
      </Panel>

      {/* Shell health-check output */}
      {status?.shellHealthCheck && (
        <Panel raised pad crosshairs style={{ marginTop: 18 }}>
          <SectionLabel style={{ marginBottom: 12 }}>shell health-check</SectionLabel>
          <pre className="px-mono" style={{ fontSize: 11, maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {status.shellHealthCheck.output}
          </pre>
        </Panel>
      )}

      {/* Error state */}
      {lastError && (
        <Panel raised pad crosshairs style={{ marginTop: 18, borderColor: 'var(--rose)' }}>
          <div style={{ color: 'var(--rose)', fontWeight: 600 }}>Probe error</div>
          <div className="px-mono" style={{ fontSize: 11, marginTop: 6 }}>{lastError}</div>
        </Panel>
      )}

      {/* Phase 7 — Install / Repair */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
            {setupLoading ? 'Running…' : 'Install / Repair'}
          </Button>
          <span className="px-lbl">per-member provisioning via setup-member.sh</span>
        </div>
        {setupOutput && (
          <pre className="px-mono" style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', background: 'var(--bg-1)', padding: 12, borderRadius: 6 }}>{setupOutput}</pre>
        )}
        {setupError && (
          <div className="px-mono" style={{ fontSize: 11, color: 'var(--rose)' }}>{setupError}</div>
        )}
      </div>
    </div>
  );
}
