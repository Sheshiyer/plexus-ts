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

      <InstrumentPanel
        label="proof cockpit"
        title="Founder proof cockpit"
        note="Tasks, evidence, rooms, blockers, reports, bridge health, and release posture stay visible before diagnostics."
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
          label="action queue"
          title="Next founder actions"
          note={snapshot.blockers.topBlocker ?? 'No proof blockers detected in this slice.'}
          actions={<StatusChip tone={snapshot.reports.latestStatus === 'verified' ? 'accent' : 'idle'}>{snapshot.reports.latestStatus}</StatusChip>}
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
      </div>

      <InstrumentPanel
        label="workspace coverage"
        title="Project and identity proof groups"
        note={`${snapshot.identities.employees} employees, ${snapshot.identities.admins} admins, ${snapshot.identities.onboardingAttention} onboarding attention item(s).`}
      >
        <MetricRailGroup>
          {snapshot.projectGroups.map((group) => (
            <MetricRail
              key={group.key}
              label={group.label}
              value={group.count}
              tone={group.key === 'verified' ? 'accent' : group.count ? 'warning' : 'idle'}
              hint="projects"
            />
          ))}
        </MetricRailGroup>
      </InstrumentPanel>
    </>
  );
}
