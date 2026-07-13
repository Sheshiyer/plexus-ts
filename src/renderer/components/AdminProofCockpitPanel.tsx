import React from 'react';
import type { AdminProofCockpitSnapshot, AdminProofOpsDrilldownTarget, AdminProofSignalTone, AdminProofSnapshotHandoff } from '../../shared/types';
import { IconBridge, IconEntries, IconLink, IconProjects, IconReports, IconSync, IconUsers } from './Icons';
import {
  CommandDock,
  InstrumentPanel,
  Ledger,
  LedgerRail,
  MetricRail,
  MetricRailGroup,
  EmptyStatePanel,
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

type AdminProofSectionTarget = 'reports' | 'diagnostics' | 'overview' | 'export';

function sectionForAction(routeKey: string | undefined): AdminProofSectionTarget | undefined {
  if (routeKey === 'reports') return 'reports';
  if (routeKey === 'export') return 'export';
  if (routeKey === 'admin' || routeKey === 'bridge' || routeKey === 'realtime') return 'diagnostics';
  return undefined;
}

function fmtDate(value: string | null): string {
  if (!value) return 'not updated';
  return value.slice(0, 16).replace('T', ' ');
}

function taskProofTone(task: AdminProofCockpitSnapshot['taskProofQueue'][number]): PlexusTone {
  if (task.proofStatus === 'verified') return 'accent';
  if (task.status === 'blocked' || task.proofStatus === 'missing') return 'warning';
  return 'idle';
}

function proofHandoff(
  snapshot: AdminProofCockpitSnapshot,
  target: 'reports' | 'export',
  actionId: string,
): AdminProofSnapshotHandoff {
  return {
    source: 'admin_proof_cockpit',
    target,
    actionId,
    title: target === 'export' ? 'Read-only proof snapshot export' : 'Proof cockpit report context',
    detail: snapshot.blockerReport.nextActionDetail,
    date: snapshot.date,
    generatedAt: snapshot.generatedAt,
    workspaceId: snapshot.workspaceId,
    topBlocker: snapshot.blockerReport.topBlocker,
    nextAction: snapshot.blockerReport.nextAction,
  };
}

export default function AdminProofCockpitPanel({
  snapshot,
  onOpenSection,
  onTestIdentity,
  onOpenDrilldown,
}: {
  snapshot: AdminProofCockpitSnapshot;
  onOpenSection: (section: AdminProofSectionTarget, context?: AdminProofSnapshotHandoff) => void;
  onTestIdentity?: (identityId: string) => void;
  onOpenDrilldown?: (id: AdminProofOpsDrilldownTarget) => void | Promise<void>;
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

      <div className="px-proof-blocker-report" aria-label="Blocker report fixture">
        <div className="px-proof-blocker-copy">
          <span className="px-lbl">blocker report fixture</span>
          <strong>Top blocker</strong>
          <small>{snapshot.blockerReport.topBlocker ?? 'No founder blocker is waiting right now.'}</small>
        </div>
        <div className="px-proof-blocker-copy">
          <span className="px-lbl">next action · within 5s</span>
          <strong>Next action</strong>
          <small>{snapshot.blockerReport.nextAction}</small>
        </div>
        <CommandDock align="end">
          <button
            type="button"
            className="px-mini-btn"
            onClick={() => onOpenSection('reports', proofHandoff(snapshot, 'reports', 'open-reports-with-blocker-context'))}
          >
            Open Reports
          </button>
          <button
            type="button"
            className="px-mini-btn"
            onClick={() => onOpenSection('export', proofHandoff(snapshot, 'export', 'export-readonly-proof-snapshot'))}
          >
            Export snapshot
          </button>
        </CommandDock>
      </div>

      <div className="px-admin-layout px-proof-first-grid">
        <InstrumentPanel
          density="dense"
          label="action queue"
          title="Next founder actions"
          note={snapshot.blockers.topBlocker ?? 'No proof blockers detected in this slice.'}
          actions={<StatusChip tone={snapshot.actions.length ? 'warning' : 'accent'}>{snapshot.actions.length ? `${snapshot.actions.length} queued` : 'clear'}</StatusChip>}
          trace
        >
          <Ledger>
            {snapshot.actions.map((action, index) => {
              const section = sectionForAction(action.routeKey);
              return (
                <LedgerRail
                  key={action.id}
                  index={String(index + 1).padStart(2, '0')}
                  title={action.title}
                  meta={action.detail}
                  status={action.routeKey ?? 'review'}
                  statusTone={tone(action.tone)}
                  action={section
                    ? <button type="button" className="px-mini-btn" onClick={() => onOpenSection(section, section === 'reports' || section === 'export' ? proofHandoff(snapshot, section, action.id) : undefined)}>Open</button>
                    : undefined}
                />
              );
            })}
          </Ledger>
        </InstrumentPanel>

        <InstrumentPanel
          density="dense"
          label="proof cockpit"
          title="Founder proof cockpit"
          note="Tasks, evidence, rooms, blockers, reports, bridge/Hermes reporting, optional helper diagnostics, and release posture stay visible before diagnostics."
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

      <div className="px-admin-layout px-proof-detail-grid">
        <InstrumentPanel
          density="dense"
          label="fabric proof queue"
          title="Task proof queue preview"
          note="The founder can scan task proof state without opening the dense Fabric diagnostics page first."
          actions={<StatusChip tone={snapshot.taskProofQueue.length ? 'warning' : 'accent'}>{snapshot.taskProofQueue.length ? `${snapshot.taskProofQueue.length} visible` : 'clear'}</StatusChip>}
        >
          <Ledger>
            {snapshot.taskProofQueue.length === 0 && (
              <EmptyStatePanel
                title="Task proof queue clear"
                message="No blocked, missing, or active Fabric proof items are waiting for founder review."
              />
            )}
            {snapshot.taskProofQueue.map((task, index) => (
              <LedgerRail
                key={task.taskId}
                index={String(index + 1).padStart(2, '0')}
                icon={<IconEntries s={12} />}
                title={task.title}
                meta={`${task.projectName ?? 'No project'} · ${task.source} · ${fmtDate(task.updatedAt)}`}
                status={`${task.status} · proof ${task.proofStatus}`}
                statusTone={taskProofTone(task)}
                action={<button type="button" className="px-mini-btn" onClick={() => onOpenSection('reports')}>Proof</button>}
              />
            ))}
          </Ledger>
        </InstrumentPanel>

        <InstrumentPanel
          density="dense"
          label="ops drill-through"
          title="Release and issue drill-through"
          note="Release docs, CI evidence, and the roadmap issue hub stay one click from the cockpit."
          actions={<StatusChip tone={snapshot.releaseHealth.gate === 'green' ? 'accent' : 'warning'}>{snapshot.releaseHealth.gate}</StatusChip>}
        >
          <Ledger>
            {snapshot.opsDrilldowns.map((item, index) => (
              <LedgerRail
                key={item.id}
                index={String(index + 1).padStart(2, '0')}
                icon={<IconLink s={12} />}
                title={item.title}
                meta={`${item.detail} Target: ${item.target}.`}
                status={item.target}
                statusTone={tone(item.tone)}
                action={(
                  <button
                    type="button"
                    className="px-mini-btn"
                    onClick={() => {
                      void onOpenDrilldown?.(item.id);
                      if (item.routeKey) onOpenSection(item.routeKey);
                    }}
                  >
                    Open
                  </button>
                )}
              />
            ))}
          </Ledger>
        </InstrumentPanel>
      </div>

      <div className="px-admin-layout">
        <InstrumentPanel
          density="dense"
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
          density="dense"
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
          density="dense"
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
          density="dense"
          label="bridge/hermes reporting + optional helper diagnostics"
          title="Reporting and helper health"
          note="Bridge and Hermes determine reporting readiness; Fabric/Paperclip remains optional diagnostics."
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
              icon={<IconEntries s={12} />}
              title="Hermes"
              meta={snapshot.bridgeFabricHermes.hermes.detail}
              status={snapshot.bridgeFabricHermes.hermes.value}
              statusTone={tone(snapshot.bridgeFabricHermes.hermes.state === 'ready' ? 'accent' : snapshot.bridgeFabricHermes.hermes.state === 'attention' ? 'warning' : 'idle')}
            />
            <LedgerRail
              index="OPT"
              icon={<IconSync s={12} />}
              title="Optional Fabric/Paperclip helper"
              meta={snapshot.bridgeFabricHermes.fabric.detail}
              status={snapshot.bridgeFabricHermes.fabric.value}
              statusTone={tone(snapshot.bridgeFabricHermes.fabric.state === 'ready' ? 'accent' : snapshot.bridgeFabricHermes.fabric.state === 'attention' ? 'warning' : 'idle')}
            />
          </Ledger>
        </InstrumentPanel>

        <InstrumentPanel
          density="dense"
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
          density="dense"
          label="identity setup map"
          title="Identity proof ledger"
          note={`${snapshot.identities.employees} employees, ${snapshot.identities.admins} admins, ${snapshot.identities.onboardingAttention} onboarding attention item(s).`}
          actions={<StatusChip tone={snapshot.identities.onboardingAttention ? 'warning' : 'accent'}>{snapshot.identities.total} identities</StatusChip>}
        >
          <Ledger>
            {snapshot.identityRows.map((identity, index) => (
              <LedgerRail
                key={identity.identityId}
                index={String(index + 1).padStart(2, '0')}
                icon={<IconUsers s={12} />}
                title={(
                  <span className="px-ledger-title-inline">
                    <span>{identity.displayName}</span>
                    <StatusChip tone={identity.role === 'admin' ? 'accent' : 'idle'}>{identity.role}</StatusChip>
                    <StatusChip tone={stateTone(identity.setupState)}>setup {identity.setupState}</StatusChip>
                  </span>
                )}
                meta={(
                  <span className="px-ledger-meta-wrap">
                    <span>{identity.email}</span>
                    <span>required {identity.requiredDone}/{identity.requiredTotal}</span>
                    <span>optional {identity.optionalDone}/{identity.optionalTotal}</span>
                    <span>updated {fmtDate(identity.lastUpdatedAt)}</span>
                  </span>
                )}
                status={`proof ${identity.proofState}`}
                statusTone={stateTone(identity.proofState)}
                value={`${identity.onboardingDone}/${identity.onboardingTotal}`}
                action={identity.testModeAvailable
                  ? <button type="button" className="px-mini-btn" onClick={() => onTestIdentity?.(identity.identityId)}>Test</button>
                  : undefined}
                wrapTitle
              />
            ))}
          </Ledger>
        </InstrumentPanel>
      </div>
    </>
  );
}
