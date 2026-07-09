import type {
  AdminDemoIdentity,
  AdminDemoOverview,
  AdminProofAction,
  AdminProofBlockerSignal,
  AdminProofCockpitSnapshot,
  AdminProofProjectGroup,
  AdminProofReportSignal,
  AdminProofSignalSnapshot,
  AdminProofSignalState,
  AdminProofSignalTone,
  AdminProofTaskEvidenceSignal,
  Project,
  ProofCustodyRecord,
  Session,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricTask,
  WorkEvidenceSummary,
} from './types.js';

export interface AdminProofCockpitInput {
  date: string;
  generatedAt: string;
  session: Session;
  overview?: AdminDemoOverview | null;
  overviewError?: string | null;
  projects: Project[];
  tasks?: ThoughtseedFabricTask[];
  tasksError?: string | null;
  evidenceSummary: WorkEvidenceSummary;
  proofCustodyRecords?: ProofCustodyRecord[];
  bridgeStatus?: ThoughtseedBridgeStatus | null;
  bridgeError?: string | null;
  releaseEvidenceReady?: boolean;
}

function signal(
  key: AdminProofSignalSnapshot['key'],
  label: string,
  value: string | number,
  detail: string,
  state: AdminProofSignalState,
  tone: AdminProofSignalTone,
  source: string,
  checkedAt: string,
): AdminProofSignalSnapshot {
  return {
    key,
    label,
    value: String(value),
    detail,
    state,
    tone,
    source,
    checkedAt,
  };
}

function isRepoVerified(project: Project): boolean {
  return project.repoEvidenceStatus === 'verified'
    || Boolean(project.githubRepoFullName && project.repoVerifiedAt && project.repoEvidenceStatus !== 'inaccessible');
}

function projectGroups(projects: readonly Project[], evidence: WorkEvidenceSummary): AdminProofProjectGroup[] {
  const groups: Record<AdminProofProjectGroup['key'], AdminProofProjectGroup> = {
    verified: { key: 'verified', label: 'Verified', count: 0, projectIds: [] },
    needs_repo: { key: 'needs_repo', label: 'Needs repo', count: 0, projectIds: [] },
    inaccessible: { key: 'inaccessible', label: 'Inaccessible', count: 0, projectIds: [] },
    missing_proof: { key: 'missing_proof', label: 'Missing proof', count: 0, projectIds: [] },
  };

  for (const project of projects) {
    const status = evidence.projectRepoCoverage[project.id] ?? project.repoEvidenceStatus ?? 'missing';
    let key: AdminProofProjectGroup['key'] = 'needs_repo';
    if (status === 'inaccessible') key = 'inaccessible';
    else if (isRepoVerified(project)) key = 'verified';
    else if (project.evidenceStatus === 'missing' || status === 'legacy_unverified') key = 'missing_proof';
    groups[key].count += 1;
    groups[key].projectIds.push(project.id);
  }

  return [groups.verified, groups.needs_repo, groups.inaccessible, groups.missing_proof];
}

function identitySummary(identities: readonly AdminDemoIdentity[] | undefined): AdminProofCockpitSnapshot['identities'] {
  const rows = identities ?? [];
  let onboardingComplete = 0;
  for (const identity of rows) {
    const steps = identity.onboarding.steps;
    if (steps.length > 0 && steps.every((step) => step.state === 'completed' || step.state === 'skipped')) {
      onboardingComplete += 1;
    }
  }
  return {
    total: rows.length,
    admins: rows.filter((identity) => identity.role === 'admin').length,
    employees: rows.filter((identity) => identity.role === 'employee').length,
    onboardingComplete,
    onboardingAttention: rows.length - onboardingComplete,
  };
}

function taskEvidence(tasks: readonly ThoughtseedFabricTask[] | undefined): AdminProofTaskEvidenceSignal {
  const rows = tasks ?? [];
  return {
    assigned: rows.filter((task) => task.status === 'assigned').length,
    active: rows.filter((task) => task.status === 'seen' || task.status === 'in_progress').length,
    blocked: rows.filter((task) => task.status === 'blocked').length,
    done: rows.filter((task) => task.status === 'done').length,
    verified: rows.filter((task) => task.proofStatus === 'verified' || task.evidenceStrength === 'verified_evidence' || task.evidence.some((evidence) => evidence.strength === 'verified_evidence')).length,
    weak: rows.filter((task) => task.proofStatus !== 'verified' && task.evidence.some((evidence) => evidence.strength === 'weak_evidence')).length,
    missingProof: rows.filter((task) => (task.status === 'done' && task.evidence.length === 0) || task.proofStatus === 'missing').length,
    total: rows.length,
  };
}

function reportSignal(records: readonly ProofCustodyRecord[] | undefined): AdminProofReportSignal {
  const rows = records ?? [];
  const dailyRows = rows.filter((row) => row.subjectType === 'daily_report');
  const assistantRows = rows.filter((row) => row.subjectType === 'assistant_daily_event');
  const reportRows = [...dailyRows, ...assistantRows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    dailyPackets: dailyRows.length,
    assistantDailyEvents: assistantRows.length,
    latestStatus: reportRows[0]?.proofStatus ?? 'none',
  };
}

function blockerSignal(tasks: AdminProofTaskEvidenceSignal, evidence: WorkEvidenceSummary): AdminProofBlockerSignal {
  const syncFailures = evidence.proofStatus === 'sync_failed' ? 1 : 0;
  const missingEvidence = evidence.missingEvidenceEntries + evidence.legacyUnverifiedEntries;
  const count = tasks.blocked + missingEvidence + syncFailures;
  let topBlocker: string | null = null;
  if (tasks.blocked > 0) topBlocker = `${tasks.blocked} Fabric task(s) are blocked.`;
  else if (missingEvidence > 0) topBlocker = `${missingEvidence} work record(s) need proof.`;
  else if (syncFailures > 0) topBlocker = `${syncFailures} evidence sync failure(s) need review.`;
  return {
    count,
    taskBlockers: tasks.blocked,
    missingEvidence,
    syncFailures,
    topBlocker,
  };
}

function bridgeSignal(status: ThoughtseedBridgeStatus | null | undefined, error?: string | null): {
  state: AdminProofSignalState;
  tone: AdminProofSignalTone;
  value: string;
  detail: string;
} {
  if (error) return { state: 'unavailable', tone: 'warning', value: 'manual', detail: error };
  if (!status) return { state: 'manual', tone: 'idle', value: 'unknown', detail: 'Bridge status has not been checked.' };
  if (status.connected) return { state: 'ready', tone: 'accent', value: 'connected', detail: status.memberId ? `member ${status.memberId}` : 'Thoughtseed bridge connected.' };
  if (status.configured) return { state: 'attention', tone: 'warning', value: 'degraded', detail: status.lastError ?? 'Bridge configured but not connected.' };
  return { state: 'manual', tone: 'idle', value: 'manual', detail: 'Bridge invite is not connected yet.' };
}

function actions(input: {
  tasks: AdminProofTaskEvidenceSignal;
  reports: AdminProofReportSignal;
  blockers: AdminProofBlockerSignal;
  releaseEvidenceReady: boolean;
}): AdminProofAction[] {
  const rows: AdminProofAction[] = [];
  if (input.blockers.count > 0) {
    rows.push({
      id: 'review-proof-blockers',
      title: 'Review proof blockers',
      detail: input.blockers.topBlocker ?? 'Proof cockpit has blockers that need review.',
      tone: 'warning',
      routeKey: 'reports',
    });
  }
  if (input.tasks.active > 0) {
    rows.push({
      id: 'inspect-fabric-assignments',
      title: 'Inspect Fabric assignments',
      detail: `${input.tasks.active} active task(s) need founder-visible proof movement.`,
      tone: 'mint',
      routeKey: 'bridge',
    });
  }
  if (input.reports.latestStatus === 'none') {
    rows.push({
      id: 'generate-daily-proof',
      title: 'Generate daily proof packet',
      detail: 'No daily proof custody packet is visible yet.',
      tone: 'accent',
      routeKey: 'reports',
    });
  }
  if (!input.releaseEvidenceReady) {
    rows.push({
      id: 'review-release-evidence',
      title: 'Review release evidence',
      detail: 'Release evidence policy is not visible to the cockpit.',
      tone: 'warning',
      routeKey: 'admin',
    });
  }
  return rows.slice(0, 5);
}

export function buildAdminProofCockpitSnapshot(input: AdminProofCockpitInput): AdminProofCockpitSnapshot {
  const taskCounts = taskEvidence(input.tasks);
  const reports = reportSignal(input.proofCustodyRecords);
  const blockers = blockerSignal(taskCounts, input.evidenceSummary);
  const bridge = bridgeSignal(input.bridgeStatus, input.bridgeError);
  const identities = identitySummary(input.overview?.identities);
  const releaseEvidenceReady = input.releaseEvidenceReady === true;
  const activeRoomsDetail = 'Active-room signal is typed and reserved for the next room aggregate slice.';
  const releaseState: AdminProofSignalState = releaseEvidenceReady ? 'ready' : 'manual';
  const releaseTone: AdminProofSignalTone = releaseEvidenceReady ? 'mint' : 'idle';

  const tasksState: AdminProofSignalState = taskCounts.blocked > 0 || taskCounts.missingProof > 0
    ? 'attention'
    : 'ready';
  const reportsState: AdminProofSignalState = reports.latestStatus === 'none'
    ? 'manual'
    : reports.latestStatus === 'verified'
      ? 'ready'
      : 'attention';
  const blockersState: AdminProofSignalState = blockers.count > 0 ? 'attention' : 'ready';

  return {
    date: input.date,
    generatedAt: input.generatedAt,
    workspaceId: input.overview?.workspaceId ?? input.session.workspaceId,
    viewer: {
      identityId: input.session.identityId,
      email: input.session.email,
      role: input.session.role,
      projectVisibility: input.session.projectVisibility,
    },
    signals: {
      tasksEvidence: signal(
        'tasksEvidence',
        'Tasks & evidence',
        `${taskCounts.verified}/${Math.max(taskCounts.total, 1)}`,
        `${taskCounts.active} active, ${taskCounts.blocked} blocked, ${taskCounts.missingProof} missing proof.`,
        tasksState,
        tasksState === 'attention' ? 'warning' : 'accent',
        input.tasksError ? 'degraded Fabric task cache' : 'Fabric task cache + evidence summary',
        input.generatedAt,
      ),
      activeRooms: signal(
        'activeRooms',
        'Active rooms',
        'manual',
        activeRoomsDetail,
        'manual',
        'idle',
        'reserved active-room contract',
        input.generatedAt,
      ),
      blockers: signal(
        'blockers',
        'Blockers',
        blockers.count,
        blockers.topBlocker ?? 'No immediate proof blockers detected.',
        blockersState,
        blockersState === 'attention' ? 'warning' : 'mint',
        'task/evidence blocker model',
        input.generatedAt,
      ),
      reports: signal(
        'reports',
        'Reports today',
        reports.dailyPackets + reports.assistantDailyEvents,
        reports.latestStatus === 'none' ? 'No report custody packet recorded yet.' : `Latest report proof is ${reports.latestStatus}.`,
        reportsState,
        reportsState === 'ready' ? 'accent' : reportsState === 'attention' ? 'warning' : 'idle',
        'proof custody records',
        input.generatedAt,
      ),
      bridgeHealth: signal(
        'bridgeHealth',
        'Bridge health',
        bridge.value,
        bridge.detail,
        bridge.state,
        bridge.tone,
        'Thoughtseed bridge status',
        input.generatedAt,
      ),
      releaseHealth: signal(
        'releaseHealth',
        'Release health',
        releaseEvidenceReady ? 'ready' : 'manual',
        releaseEvidenceReady ? 'Release evidence policy is present.' : 'Release/CI health remains a manual cockpit signal in this slice.',
        releaseState,
        releaseTone,
        'release evidence policy',
        input.generatedAt,
      ),
    },
    tasksEvidence: taskCounts,
    projectGroups: projectGroups(input.projects, input.evidenceSummary),
    identities,
    reports,
    blockers,
    actions: actions({
      tasks: taskCounts,
      reports,
      blockers,
      releaseEvidenceReady,
    }),
  };
}
