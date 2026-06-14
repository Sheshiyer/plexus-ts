import React, { useEffect, useMemo, useState } from 'react';
import type { FabricStatus, Session, TimeEntry } from '../../shared/types';
import { Badge, fmtHMS } from './ui';

type NodeState = 'ok' | 'warn' | 'off';

interface Props {
  running: boolean;
  projectName: string | null;
  description: string | undefined;
  elapsedSeconds: number;
  todaySeconds: number;
  recentEntries: TimeEntry[];
  projectCount: number;
  session: Session | null;
}

function stateClass(state: NodeState): string {
  if (state === 'ok') return 'ok';
  if (state === 'warn') return 'warn';
  return 'off';
}

function countStates(session: Session | null) {
  const steps = session?.onboarding?.steps ?? [];
  return {
    requiredOpen: steps.filter((s) => s.requirement === 'required' && s.state !== 'completed').length,
    deferred: steps.filter((s) => s.state === 'deferred').length,
    skipped: steps.filter((s) => s.state === 'skipped').length,
  };
}

function healthLabel(status: FabricStatus | null): string {
  if (!status) return 'not scanned';
  const healthy = status.summary?.healthy ?? 0;
  const total = status.summary?.total ?? 0;
  if (!total) return 'no agents';
  return `${healthy}/${total} healthy`;
}

export default function AgentActivityHub({
  running,
  projectName,
  description,
  elapsedSeconds,
  todaySeconds,
  recentEntries,
  projectCount,
  session,
}: Props) {
  const [fabric, setFabric] = useState<FabricStatus | null>(null);
  const [fabricError, setFabricError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await window.plexus.fabricStatus();
        if (!cancelled) {
          setFabric(status);
          setFabricError(null);
        }
      } catch (err: any) {
        if (!cancelled) setFabricError(err?.message ?? 'fabric scan failed');
      }
    };
    refresh();
    const id = setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const onboarding = countStates(session);
  const latest = recentEntries[0];
  const portsUp = fabric?.ports.filter((p) => p.reachable).length ?? 0;
  const portsTotal = fabric?.ports.length ?? 0;
  const bridgeUp = Boolean(fabric?.bridge.reachable);
  const nodes = useMemo(
    () => [
      { label: 'Timer', state: running ? 'ok' : 'off' as NodeState, value: running ? fmtHMS(elapsedSeconds) : 'standby' },
      { label: 'Worker', state: session ? 'ok' : 'warn' as NodeState, value: session ? session.role : 'no session' },
      { label: 'Fabric', state: fabricError ? 'warn' : fabric ? 'ok' : 'off' as NodeState, value: fabricError ? 'check' : healthLabel(fabric) },
      { label: 'Bridge', state: bridgeUp ? 'ok' : 'warn' as NodeState, value: bridgeUp ? 'reachable' : 'offline' },
      { label: 'Projects', state: projectCount > 0 ? 'ok' : 'off' as NodeState, value: `${projectCount} touched` },
      { label: 'Onboarding', state: onboarding.requiredOpen === 0 ? 'ok' : 'warn' as NodeState, value: onboarding.requiredOpen ? `${onboarding.requiredOpen} required` : 'clear' },
    ],
    [bridgeUp, elapsedSeconds, fabric, fabricError, onboarding.requiredOpen, projectCount, running, session],
  );

  return (
    <div className="px-activity-hub">
      <div className="hub-head">
        <div>
          <div className="px-lbl">agent activity hub</div>
          <h3>{running ? 'Active work session' : 'Operational standby'}</h3>
        </div>
        <Badge tone={session?.role === 'admin' ? 'mint' : undefined}>
          {session?.role === 'admin' ? 'admin view' : 'member view'}
        </Badge>
      </div>

      <div className="hub-node-map" aria-label="Operational status map">
        {nodes.map((node) => (
          <div key={node.label} className={`hub-node ${stateClass(node.state)}`}>
            <span className="hub-dot" />
            <span className="hub-label">{node.label}</span>
            <span className="hub-value">{node.value}</span>
          </div>
        ))}
      </div>

      <div className="hub-grid">
        <div className="hub-card">
          <span className="px-lbl">current focus</span>
          <strong>{projectName ?? 'No active project'}</strong>
          <small>{running ? (description || 'Untitled session') : 'Start a timer to publish work signals.'}</small>
        </div>
        <div className="hub-card">
          <span className="px-lbl">tracked today</span>
          <strong>{fmtHMS(todaySeconds)}</strong>
          <small>{recentEntries.length} entries across {projectCount} projects</small>
        </div>
        <div className="hub-card">
          <span className="px-lbl">fabric runtime</span>
          <strong>{healthLabel(fabric)}</strong>
          <small>{portsTotal ? `${portsUp}/${portsTotal} ports reachable` : fabricError ?? 'probe pending'}</small>
        </div>
        <div className="hub-card">
          <span className="px-lbl">onboarding state</span>
          <strong>{onboarding.requiredOpen ? 'Required open' : 'Required clear'}</strong>
          <small>{onboarding.deferred} deferred · {onboarding.skipped} skipped optional</small>
        </div>
      </div>

      <div className="hub-stream">
        <div className="px-lbl">latest activity</div>
        {latest ? (
          <div className="hub-entry">
            <span>{latest.description}</span>
            <strong>{fmtHMS(latest.durationSeconds)}</strong>
          </div>
        ) : (
          <div className="hub-entry muted">
            <span>No completed entries today</span>
            <strong>--:--:--</strong>
          </div>
        )}
      </div>
    </div>
  );
}
