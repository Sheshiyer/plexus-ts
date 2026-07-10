import React from 'react';
import type { AdminProofCockpitSnapshot, AdminProofSignalTone } from '../../shared/types';
import { IconBridge, IconEntries, IconProjects, IconReports, IconSync, IconUsers } from './Icons';
import {
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  StatusChip,
  type PlexusTone,
} from './PlexusUI';

const SIGNAL_ICONS = {
  tasksEvidence: IconEntries,
  activeRooms: IconUsers,
  blockers: IconSync,
  reports: IconReports,
  bridgeHealth: IconBridge,
  releaseHealth: IconProjects,
} as const;

function tone(value: AdminProofSignalTone): PlexusTone {
  return value;
}

function stateTone(value: string): PlexusTone {
  if (value === 'ready') return 'accent';
  if (value === 'attention' || value === 'blocked' || value === 'unavailable') return 'warning';
  return 'idle';
}

export default function AdminProofCockpitPanel({
  snapshot,
  onOpenSection,
}: {
  snapshot: AdminProofCockpitSnapshot;
  onOpenSection: (section: 'reports' | 'diagnostics') => void;
}) {
  const signals = [
    snapshot.signals.tasksEvidence,
    snapshot.signals.activeRooms,
    snapshot.signals.blockers,
    snapshot.signals.reports,
    snapshot.signals.bridgeHealth,
    snapshot.signals.releaseHealth,
  ];
  const projectTotal = snapshot.projectGroups.reduce((sum, group) => sum + group.count, 0);
  const verifiedProjects = snapshot.projectGroups.find((group) => group.key === 'verified')?.count ?? 0;
  const coveragePercent = projectTotal > 0 ? Math.round((verifiedProjects / projectTotal) * 100) : 0;

  return (
    <>
      <MetricRailGroup>
        {signals.map((signal) => (
          <MetricRail
            key={signal.key}
            label={signal.label}
            value={signal.value}
            tone={tone(signal.tone)}
            hint={signal.state}
          />
        ))}
      </MetricRailGroup>

      <div className="px-proof-coverage-strip" aria-label="Project proof coverage">
        <div className="px-proof-coverage-copy">
          <span className="px-lbl">workspace coverage map</span>
          <strong>Project proof coverage</strong>
          <small>{verifiedProjects}/{Math.max(projectTotal, 1)} projects are verified before founder review.</small>
        </div>
        <div className="px-proof-coverage-meter" aria-label={`${coveragePercent}% project proof coverage`}>
          <strong>{coveragePercent}%</strong>
          <span>coverage</span>
        </div>
        <div className="px-proof-group-rail" aria-label="Coverage groups">
          <span className="px-proof-group-rail-title">Coverage groups</span>
          {snapshot.projectGroups.map((group) => (
            <div key={group.key} className={`px-proof-group-chip ${group.key}`}>
              <span>{group.label}</span>
              <strong>{group.count}</strong>
            </div>
          ))}
        </div>
        <div className="px-proof-action-summary" aria-label="Next founder actions">
          <span className="px-lbl">action queue</span>
          <strong>Next founder actions</strong>
          <small>{snapshot.actions.length ? `${snapshot.actions.length} queued before diagnostics.` : 'No queued founder actions.'}</small>
        </div>
      </div>

      <div className="px-admin-layout px-proof-first-grid">
        <InstrumentPanel
          label="action queue"
          title="Next founder actions"
          note={snapshot.blockers.topBlocker ?? 'No proof blockers detected in this slice.'}
          actions={<StatusChip tone={snapshot.actions.length ? 'warning' : 'accent'}>{snapshot.actions.length ? `${snapshot.actions.length} queued` : 'clear'}</StatusChip>}
          trace
        >
          <Ledger>
            {snapshot.actions.map((action, index) => (
                <LedgerRail
                  key={action.id}
                  index={String(index + 1).padStart(2, '0')}
                  title={action.title}
                  meta={action.detail}
                  status={action.routeKey ?? 'review'}
                  statusTone={tone(action.tone)}
                  action={action.routeKey === 'reports'
                    ? <button type="button" className="px-mini-btn" onClick={() => onOpenSection('reports')}>Open</button>
                    : action.routeKey === 'admin'
                      ? <button type="button" className="px-mini-btn" onClick={() => onOpenSection('diagnostics')}>Open</button>
                      : undefined}
                />
            ))}
          </Ledger>
        </InstrumentPanel>

        <InstrumentPanel
          label="proof cockpit"
          title="Founder proof cockpit"
          note="Tasks, evidence, rooms, blockers, reports, bridge/Fabric/Hermes, and release posture stay visible before diagnostics."
          actions={<StatusChip tone={snapshot.blockers.count ? 'warning' : 'accent'}>{snapshot.blockers.count ? 'attention' : 'ready'}</StatusChip>}
          trace
        >
          <Ledger>
            {signals.map((signal, index) => {
              const Icon = SIGNAL_ICONS[signal.key];
              return (
              <LedgerRail
                key={signal.key}
                index={String(index + 1).padStart(2, '0')}
                icon={<Icon s={12} />}
                title={signal.label}
                meta={signal.detail}
                status={signal.value}
                statusTone={tone(signal.tone)}
              />
              );
            })}
          </Ledger>
        </InstrumentPanel>
      </div>

      <div className="px-admin-layout">
        <InstrumentPanel
          label="task/evidence signal"
          title="Assigned work proof"
          note="Founder-visible task state comes from Fabric task records and today's evidence summary."
          actions={<StatusChip tone="mint">{snapshot.tasksEvidence.total} tasks</StatusChip>}
        >
          <MetricRailGroup>
            <MetricRail label="assigned" value={snapshot.tasksEvidence.assigned} tone="mint" hint="new/seen" />
            <MetricRail label="active" value={snapshot.tasksEvidence.active} tone="accent" hint="not done" />
            <MetricRail label="blocked" value={snapshot.tasksEvidence.blocked} tone={snapshot.tasksEvidence.blocked ? 'warning' : 'idle'} hint="needs help" />
            <MetricRail label="done" value={snapshot.tasksEvidence.done} tone="mint" hint="finished" />
            <MetricRail label="verified" value={snapshot.tasksEvidence.verified} tone="accent" hint="strong proof" />
            <MetricRail label="weak proof" value={snapshot.tasksEvidence.weak} tone={snapshot.tasksEvidence.weak ? 'warning' : 'idle'} hint="review" />
          </MetricRailGroup>
        </InstrumentPanel>

        <InstrumentPanel
          label="active-room signal"
          title="Room health"
          note={snapshot.activeRooms.topRoomName ? `${snapshot.activeRooms.topRoomName} is the busiest active room.` : 'Realtime source is reachable even when no room is active.'}
          actions={<StatusChip tone={snapshot.activeRooms.sourceState === 'ready' ? 'accent' : 'warning'}>{snapshot.activeRooms.sourceState}</StatusChip>}
        >
          <MetricRailGroup>
            <MetricRail label="open" value={snapshot.activeRooms.openRooms} tone="accent" hint="rooms" />
            <MetricRail label="live" value={snapshot.activeRooms.liveCalls} tone={snapshot.activeRooms.liveCalls ? 'mint' : 'idle'} hint="calls" />
            <MetricRail label="present" value={snapshot.activeRooms.participants} tone={snapshot.activeRooms.participants ? 'accent' : 'idle'} hint="people" />
            <MetricRail label="sharing" value={snapshot.activeRooms.screenShares} tone={snapshot.activeRooms.screenShares ? 'mint' : 'idle'} hint="screens" />
            <MetricRail label="idle" value={snapshot.activeRooms.staleRooms} tone={snapshot.activeRooms.staleRooms ? 'warning' : 'idle'} hint="rooms" />
          </MetricRailGroup>
        </InstrumentPanel>

        <InstrumentPanel
          label="reports-today signal"
          title="Daily proof packets"
          note={snapshot.reports.latestUpdatedAt ? `Latest custody update ${snapshot.reports.latestUpdatedAt}.` : 'No daily proof custody update has been recorded today.'}
          actions={<StatusChip tone={snapshot.reports.failed ? 'warning' : snapshot.reports.submitted ? 'accent' : 'idle'}>{snapshot.reports.latestStatus}</StatusChip>}
        >
          <MetricRailGroup>
            <MetricRail label="submitted" value={snapshot.reports.submitted} tone={snapshot.reports.submitted ? 'accent' : 'idle'} hint="today" />
            <MetricRail label="queued" value={snapshot.reports.queued} tone={snapshot.reports.queued ? 'warning' : 'idle'} hint="outbox" />
            <MetricRail label="failed" value={snapshot.reports.failed} tone={snapshot.reports.failed ? 'warning' : 'idle'} hint="outbox" />
            <MetricRail label="missing" value={snapshot.reports.missing} tone={snapshot.reports.missing ? 'warning' : 'idle'} hint="packet" />
          </MetricRailGroup>
        </InstrumentPanel>

        <InstrumentPanel
          label="bridge/fabric/hermes signal"
          title="Source health"
          note="Connected, degraded, manual, and offline states are kept explicit for dispatch safety."
          actions={<StatusChip tone={snapshot.bridgeFabricHermes.overallState === 'ready' ? 'accent' : 'warning'}>{snapshot.bridgeFabricHermes.overallValue}</StatusChip>}
        >
          <Ledger>
            <LedgerRail
              index="01"
              icon={<IconBridge s={12} />}
              title="Thoughtseed bridge"
              meta={snapshot.bridgeFabricHermes.bridge.detail}
              status={snapshot.bridgeFabricHermes.bridge.value}
              statusTone={tone(snapshot.bridgeFabricHermes.bridge.state === 'ready' ? 'accent' : snapshot.bridgeFabricHermes.bridge.state === 'attention' ? 'warning' : 'idle')}
            />
            <LedgerRail
              index="02"
              icon={<IconSync s={12} />}
              title="Fabric"
              meta={snapshot.bridgeFabricHermes.fabric.detail}
              status={snapshot.bridgeFabricHermes.fabric.value}
              statusTone={tone(snapshot.bridgeFabricHermes.fabric.state === 'ready' ? 'accent' : snapshot.bridgeFabricHermes.fabric.state === 'attention' ? 'warning' : 'idle')}
            />
            <LedgerRail
              index="03"
              icon={<IconEntries s={12} />}
              title="Hermes"
              meta={snapshot.bridgeFabricHermes.hermes.detail}
              status={snapshot.bridgeFabricHermes.hermes.value}
              statusTone={tone(snapshot.bridgeFabricHermes.hermes.state === 'ready' ? 'accent' : snapshot.bridgeFabricHermes.hermes.state === 'attention' ? 'warning' : 'idle')}
            />
          </Ledger>
        </InstrumentPanel>

        <InstrumentPanel
          label="release/ci/ops signal"
          title="Release gate"
          note={`${snapshot.releaseHealth.source} · ${snapshot.releaseHealth.checkedAt}`}
          actions={<StatusChip tone={snapshot.releaseHealth.gate === 'green' ? 'accent' : snapshot.releaseHealth.gate === 'red' ? 'warning' : 'idle'}>{snapshot.releaseHealth.gate}</StatusChip>}
        >
          <MetricRailGroup>
            <MetricRail label="CI" value={snapshot.releaseHealth.ciWorkflow ? 'yes' : 'no'} tone={snapshot.releaseHealth.ciWorkflow ? 'accent' : 'warning'} hint="workflow" />
            <MetricRail label="release" value={snapshot.releaseHealth.releaseWorkflow ? 'yes' : 'no'} tone={snapshot.releaseHealth.releaseWorkflow ? 'accent' : 'warning'} hint="workflow" />
            <MetricRail label="policy" value={snapshot.releaseHealth.releaseEvidencePolicy ? 'yes' : 'no'} tone={snapshot.releaseHealth.releaseEvidencePolicy ? 'accent' : 'warning'} hint="evidence" />
            <MetricRail label="receipt" value={snapshot.releaseHealth.releaseGateEvidence ? 'yes' : 'no'} tone={snapshot.releaseHealth.releaseGateEvidence ? 'accent' : 'idle'} hint="gate" />
          </MetricRailGroup>
        </InstrumentPanel>

        <InstrumentPanel
          label="identity setup map"
          title="Identity proof setup"
          note={`${snapshot.identities.employees} employees, ${snapshot.identities.admins} admins, ${snapshot.identities.onboardingAttention} onboarding attention item(s).`}
          actions={<StatusChip tone={snapshot.identities.onboardingAttention ? 'warning' : 'accent'}>{snapshot.identities.total} identities</StatusChip>}
        >
          <MetricRailGroup>
            <MetricRail label="employees" value={snapshot.identities.employees} tone="mint" hint="people" />
            <MetricRail label="admins" value={snapshot.identities.admins} tone="accent" hint="people" />
            <MetricRail label="complete" value={snapshot.identities.onboardingComplete} tone="accent" hint="setup" />
            <MetricRail label="attention" value={snapshot.identities.onboardingAttention} tone={stateTone(snapshot.identities.onboardingAttention ? 'attention' : 'ready')} hint="setup" />
          </MetricRailGroup>
        </InstrumentPanel>
      </div>
    </>
  );
}
