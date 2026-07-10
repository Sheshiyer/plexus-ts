import type {
  AdminProofActiveRoomSignal,
  AdminDemoIdentity,
  AdminDemoOverview,
  AdminProofAction,
  AdminProofBridgeFabricHermesSignal,
  AdminProofBlockerSignal,
  AdminProofCockpitSnapshot,
  AdminProofDailyOutboxItem,
  AdminProofProjectGroup,
  AdminProofReportSignal,
  AdminProofReleaseHealthSignal,
  AdminProofSignalSnapshot,
  AdminProofSignalState,
  AdminProofSignalTone,
  FabricStatus,
  AdminProofTaskEvidenceSignal,
  Project,
  ProofCustodyRecord,
  RealtimeRoom,
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
  dailyOutboxRecords?: AdminProofDailyOutboxItem[];
  dailyOutboxError?: string | null;
  realtimeRooms?: RealtimeRoom[];
  realtimeRoomsError?: string | null;
  bridgeStatus?: ThoughtseedBridgeStatus | null;
  bridgeError?: string | null;
  fabricStatus?: FabricStatus | null;
  fabricError?: string | null;
  releaseEvidenceReady?: boolean;
  releaseHealth?: AdminProofReleaseHealthSignal | null;
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
    if (steps.length > 0 && steps.every((step) => step.state === 'completed' || step.state === 'skipped' || step.state === 'deferred')) {
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

function stepDone(state: AdminDemoIdentity['onboarding']['steps'][number]['state']): boolean {
  return state === 'completed' || state === 'skipped' || state === 'deferred';
}

function latestStepUpdate(identity: AdminDemoIdentity): string | null {
  const updates = identity.onboarding.steps
    .map((step) => step.updatedAt)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
  return updates[0] ?? null;
}

function identityRows(identities: readonly AdminDemoIdentity[] | undefined): AdminProofCockpitSnapshot['identityRows'] {
  return (identities ?? []).map((identity) => {
    const steps = identity.onboarding.steps;
    const required = steps.filter((step) => step.requirement === 'required');
    const optional = steps.filter((step) => step.requirement === 'optional');
    const onboardingDone = steps.filter((step) => stepDone(step.state)).length;
    const requiredDone = required.filter((step) => stepDone(step.state)).length;
    const optionalDone = optional.filter((step) => stepDone(step.state)).length;
    const hasFailed = steps.some((step) => step.state === 'failed');
    const hasPendingRequired = requiredDone < required.length;
    const setupState = hasFailed ? 'blocked' : hasPendingRequired ? 'attention' : 'ready';
    const proofState = setupState === 'ready'
      ? 'ready'
      : setupState === 'blocked'
        ? 'blocked'
        : 'attention';
    return {
      identityId: identity.identityId,
      displayName: identity.displayName,
      email: identity.email,
      role: identity.role,
      onboardingDone,
      onboardingTotal: steps.length,
      requiredDone,
      requiredTotal: required.length,
      optionalDone,
      optionalTotal: optional.length,
      setupState,
      proofState,
      lastUpdatedAt: latestStepUpdate(identity),
      testModeAvailable: identity.role === 'employee',
    };
  });
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

function taskProofQueue(tasks: readonly ThoughtseedFabricTask[] | undefined): AdminProofCockpitSnapshot['taskProofQueue'] {
  const score = (task: ThoughtseedFabricTask): number => {
    if (task.status === 'blocked') return 0;
    if (task.proofStatus === 'missing') return 1;
    if (task.status === 'done' && task.evidence.length === 0) return 2;
    if (task.status === 'in_progress' || task.status === 'seen') return 3;
    if (task.status === 'assigned') return 4;
    return 5;
  };
  return [...(tasks ?? [])]
    .sort((a, b) => {
      const priority = score(a) - score(b);
      return priority !== 0 ? priority : b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 5)
    .map((task) => ({
      taskId: task.taskId,
      title: task.title,
      projectName: task.projectName ?? task.projectId ?? null,
      status: task.status,
      proofStatus: task.proofStatus ?? 'none',
      evidenceStrength: task.evidenceStrength,
      source: task.source ?? 'unknown',
      updatedAt: task.updatedAt,
    }));
}

function activeRoomSignal(
  rooms: readonly RealtimeRoom[] | undefined,
  checkedAt: string,
  error?: string | null,
): AdminProofActiveRoomSignal {
  if (error) {
    return {
      openRooms: 0,
      liveCalls: 0,
      participants: 0,
      screenShares: 0,
      staleRooms: 0,
      topRoomName: null,
      sourceState: 'unavailable',
      sourceMessage: error,
    };
  }
  const rows = (rooms ?? []).filter((room) => room.state === 'open');
  const liveCalls = rows.filter((room) => Boolean(room.activeCallId || room.activeCall)).length;
  const participants = rows.reduce((sum, room) => sum + Math.max(0, room.presence?.participants ?? 0), 0);
  const screenShares = rows.reduce((sum, room) => sum + Math.max(0, room.presence?.screenShares ?? 0), 0);
  const staleRooms = rows.filter((room) => !room.activeCallId && !room.activeCall && (room.presence?.participants ?? 0) === 0).length;
  const topRoom = [...rows].sort((a, b) => {
    const score = (room: RealtimeRoom) => ((room.presence?.participants ?? 0) * 10)
      + ((room.presence?.screenShares ?? 0) * 3)
      + (room.activeCallId || room.activeCall ? 5 : 0);
    const delta = score(b) - score(a);
    return delta !== 0 ? delta : b.lastActivityAt.localeCompare(a.lastActivityAt);
  })[0];
  return {
    openRooms: rows.length,
    liveCalls,
    participants,
    screenShares,
    staleRooms,
    topRoomName: topRoom?.name ?? null,
    sourceState: 'ready',
    sourceMessage: rows.length > 0
      ? `${rows.length} room(s) loaded at ${checkedAt}.`
      : 'Realtime source reachable; no active rooms are open.',
  };
}

function reportSignal(
  records: readonly ProofCustodyRecord[] | undefined,
  date: string,
  outbox: readonly AdminProofDailyOutboxItem[] | undefined,
): AdminProofReportSignal {
  const outboxRows = (outbox ?? []).filter((row) => row.date === date);
  const outboxIds = new Set(outboxRows.map((row) => row.id));
  const rows = (records ?? []).filter((row) => {
    if (row.subjectId === date) return true;
    if (outboxIds.has(row.subjectId)) return true;
    const payloadDate = row.payload && typeof row.payload === 'object' && 'date' in row.payload
      ? row.payload.date
      : null;
    return payloadDate === date;
  });
  const dailyRows = rows.filter((row) => row.subjectType === 'daily_report');
  const assistantRows = rows.filter((row) => row.subjectType === 'assistant_daily_event');
  const queued = outboxRows.filter((row) => row.status === 'pending' || row.status === 'queued' || row.status === 'sending').length;
  const failed = outboxRows.filter((row) => row.status === 'failed').length;
  const sent = outboxRows.filter((row) => row.status === 'sent').length;
  const reportRows = [...dailyRows, ...assistantRows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const submitted = dailyRows.length + assistantRows.length + sent;
  return {
    dailyPackets: dailyRows.length,
    assistantDailyEvents: assistantRows.length,
    submitted,
    queued,
    failed,
    missing: submitted === 0 && queued === 0 ? 1 : 0,
    latestStatus: reportRows[0]?.proofStatus ?? 'none',
    latestUpdatedAt: reportRows[0]?.updatedAt ?? outboxRows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.updatedAt ?? null,
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

function bridgeFabricHermesSignal(input: {
  bridgeStatus?: ThoughtseedBridgeStatus | null;
  bridgeError?: string | null;
  fabricStatus?: FabricStatus | null;
  fabricError?: string | null;
  tasks?: readonly ThoughtseedFabricTask[];
  tasksError?: string | null;
  checkedAt: string;
}): AdminProofBridgeFabricHermesSignal {
  const bridge = bridgeSignal(input.bridgeStatus, input.bridgeError);
  const fabric = input.fabricStatus;
  const reachablePorts = fabric?.ports.filter((port) => port.reachable).length ?? 0;
  const totalPorts = fabric?.ports.length ?? 0;
  const counts = fabric?.summaryCounts ?? fabric?.summary ?? {};
  const healthyAgents = Number(counts.healthy ?? 0);
  const totalAgents = Number(counts.total ?? fabric?.agents.length ?? 0);
  const degradedAgents = Number(counts.degraded ?? 0) + Number(counts.stale ?? 0) + Number(counts.uninitialized ?? 0) + Number(counts.missingFileAgents ?? 0);
  const fabricState: AdminProofSignalState = input.fabricError
    ? 'unavailable'
    : fabric
      ? (reachablePorts > 0 && degradedAgents === 0 ? 'ready' : reachablePorts > 0 ? 'attention' : 'manual')
      : 'manual';
  const fabricValue = input.fabricError
    ? 'offline'
    : fabric
      ? `${reachablePorts}/${Math.max(totalPorts, 1)} ports`
      : 'unknown';
  const fabricDetail = input.fabricError
    ? input.fabricError
    : fabric
      ? `${healthyAgents}/${Math.max(totalAgents, 1)} Fabric agent(s) healthy; ${fabric.bridge.message ?? 'bridge status unknown'}.`
      : 'Fabric status has not been checked.';

  const taskRows = input.tasks ?? [];
  const hermesTasks = taskRows.filter((task) => task.source === 'hermes' || task.assignedBy === 'hermes');
  const hermesBlocked = hermesTasks.filter((task) => task.status === 'blocked').length;
  const hermesState: AdminProofSignalState = input.tasksError
    ? 'unavailable'
    : hermesBlocked > 0
      ? 'attention'
      : hermesTasks.length > 0
        ? 'ready'
        : 'manual';
  const hermesValue = input.tasksError ? 'offline' : `${hermesTasks.length} task(s)`;
  const hermesDetail = input.tasksError
    ? input.tasksError
    : hermesTasks.length > 0
      ? `${hermesBlocked} blocked Hermes-assigned task(s).`
      : 'No Hermes-assigned Fabric tasks are visible.';
  const states = [bridge.state, fabricState, hermesState];
  const overallState: AdminProofSignalState = states.includes('unavailable')
    ? 'unavailable'
    : states.includes('attention')
      ? 'attention'
      : states.includes('manual')
        ? 'manual'
        : 'ready';
  return {
    bridge: {
      state: bridge.state,
      value: bridge.value,
      detail: bridge.detail,
      checkedAt: input.bridgeStatus?.lastSeenAt ?? input.checkedAt,
    },
    fabric: {
      state: fabricState,
      value: fabricValue,
      detail: fabricDetail,
      checkedAt: fabric?.checkedAt ?? input.checkedAt,
      reachablePorts,
      totalPorts,
      healthyAgents,
      totalAgents,
    },
    hermes: {
      state: hermesState,
      value: hermesValue,
      detail: hermesDetail,
      checkedAt: input.checkedAt,
      tasks: hermesTasks.length,
      blocked: hermesBlocked,
    },
    overallState,
    overallValue: overallState === 'ready'
      ? 'connected'
      : overallState === 'attention'
        ? 'degraded'
        : overallState === 'unavailable'
          ? 'offline'
          : 'manual',
  };
}

function fallbackReleaseHealth(
  checkedAt: string,
  releaseEvidenceReady?: boolean,
): AdminProofReleaseHealthSignal {
  const ready = releaseEvidenceReady === true;
  return {
    gate: ready ? 'green' : 'unknown',
    source: 'release evidence policy',
    checkedAt,
    detail: ready ? 'Release evidence policy is present.' : 'Release/CI health remains a manual cockpit signal in this slice.',
    ciWorkflow: ready,
    releaseWorkflow: ready,
    releaseEvidencePolicy: ready,
    releaseGateEvidence: ready,
  };
}

function actions(input: {
  tasks: AdminProofTaskEvidenceSignal;
  reports: AdminProofReportSignal;
  blockers: AdminProofBlockerSignal;
  activeRooms: AdminProofActiveRoomSignal;
  bridgeFabricHermes: AdminProofBridgeFabricHermesSignal;
  releaseHealth: AdminProofReleaseHealthSignal;
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
  if (input.activeRooms.staleRooms > 0) {
    rows.push({
      id: 'review-active-rooms',
      title: 'Review room health',
      detail: `${input.activeRooms.staleRooms} room(s) are open without presence or a live call.`,
      tone: 'warning',
      routeKey: 'realtime',
    });
  }
  if (input.reports.missing > 0 || input.reports.failed > 0) {
    rows.push({
      id: 'generate-daily-proof',
      title: 'Generate daily proof packet',
      detail: input.reports.failed > 0
        ? `${input.reports.failed} daily proof event(s) failed delivery.`
        : 'No daily proof custody packet is visible yet.',
      tone: input.reports.failed > 0 ? 'warning' : 'accent',
      routeKey: 'reports',
    });
  }
  if (input.bridgeFabricHermes.overallState !== 'ready') {
    rows.push({
      id: 'review-bridge-fabric-hermes',
      title: 'Review bridge/Fabric/Hermes health',
      detail: `Health is ${input.bridgeFabricHermes.overallValue}; inspect the degraded/manual source before dispatch.`,
      tone: input.bridgeFabricHermes.overallState === 'attention' ? 'warning' : 'idle',
      routeKey: 'admin',
    });
  }
  if (input.releaseHealth.gate !== 'green') {
    rows.push({
      id: 'review-release-evidence',
      title: 'Review release evidence',
      detail: input.releaseHealth.detail,
      tone: input.releaseHealth.gate === 'red' ? 'error' : 'warning',
      routeKey: 'admin',
    });
  }
  return rows.slice(0, 5);
}

function opsDrilldowns(releaseHealth: AdminProofReleaseHealthSignal): AdminProofCockpitSnapshot['opsDrilldowns'] {
  return [
    {
      id: 'release_docs',
      title: 'Open release docs',
      detail: releaseHealth.detail,
      target: 'docs/RELEASE_EVIDENCE.md',
      tone: releaseHealth.gate === 'green' ? 'mint' : releaseHealth.gate === 'red' ? 'error' : 'warning',
      routeKey: 'diagnostics',
    },
    {
      id: 'ci_evidence',
      title: 'Open CI evidence',
      detail: releaseHealth.ciWorkflow ? 'CI workflow is present; review the latest run receipt before release.' : 'CI workflow evidence is missing.',
      target: '.github/workflows/ci.yml',
      tone: releaseHealth.ciWorkflow ? 'accent' : 'warning',
      routeKey: 'diagnostics',
    },
    {
      id: 'issue_hub',
      title: 'Open issue hub',
      detail: 'Production roadmap hub carries the selected phase checklist and sync receipts.',
      target: 'GitHub issue #49',
      tone: 'accent',
      routeKey: 'reports',
    },
  ];
}

export function buildAdminProofCockpitSnapshot(input: AdminProofCockpitInput): AdminProofCockpitSnapshot {
  const taskCounts = taskEvidence(input.tasks);
  const activeRooms = activeRoomSignal(input.realtimeRooms, input.generatedAt, input.realtimeRoomsError);
  const reports = reportSignal(input.proofCustodyRecords, input.date, input.dailyOutboxRecords);
  const blockers = blockerSignal(taskCounts, input.evidenceSummary);
  const bridgeFabricHermes = bridgeFabricHermesSignal({
    bridgeStatus: input.bridgeStatus,
    bridgeError: input.bridgeError,
    fabricStatus: input.fabricStatus,
    fabricError: input.fabricError,
    tasks: input.tasks,
    tasksError: input.tasksError,
    checkedAt: input.generatedAt,
  });
  const identities = identitySummary(input.overview?.identities);
  const identityProofRows = identityRows(input.overview?.identities);
  const releaseHealth = input.releaseHealth ?? fallbackReleaseHealth(input.generatedAt, input.releaseEvidenceReady);
  const releaseState: AdminProofSignalState = releaseHealth.gate === 'green'
    ? 'ready'
    : releaseHealth.gate === 'red'
      ? 'blocked'
      : 'manual';
  const releaseTone: AdminProofSignalTone = releaseHealth.gate === 'green'
    ? 'mint'
    : releaseHealth.gate === 'red'
      ? 'error'
      : 'idle';

  const tasksState: AdminProofSignalState = taskCounts.blocked > 0 || taskCounts.missingProof > 0
    ? 'attention'
    : 'ready';
  const activeRoomsState: AdminProofSignalState = activeRooms.sourceState !== 'ready'
    ? activeRooms.sourceState
    : activeRooms.staleRooms > 0
      ? 'attention'
      : 'ready';
  const reportsState: AdminProofSignalState = reports.failed > 0
    ? 'blocked'
    : reports.queued > 0
      ? 'attention'
      : reports.latestStatus === 'none'
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
        activeRooms.openRooms,
        activeRooms.sourceMessage ?? `${activeRooms.participants} participant(s), ${activeRooms.liveCalls} live call(s), ${activeRooms.screenShares} screen share(s).`,
        activeRoomsState,
        activeRoomsState === 'attention' ? 'warning' : activeRoomsState === 'ready' ? 'mint' : 'idle',
        input.realtimeRoomsError ? 'degraded realtime room source' : 'realtime room aggregate',
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
        reports.submitted,
        reports.failed > 0
          ? `${reports.failed} failed, ${reports.queued} queued, ${reports.submitted} submitted.`
          : reports.queued > 0
            ? `${reports.queued} queued, ${reports.submitted} submitted.`
            : reports.latestStatus === 'none'
              ? 'No report custody packet recorded yet.'
              : `Latest report proof is ${reports.latestStatus}.`,
        reportsState,
        reportsState === 'ready' ? 'accent' : reportsState === 'attention' || reportsState === 'blocked' ? 'warning' : 'idle',
        input.dailyOutboxError ? `proof custody records + degraded daily outbox: ${input.dailyOutboxError}` : 'proof custody records + daily outbox',
        input.generatedAt,
      ),
      bridgeHealth: signal(
        'bridgeHealth',
        'Bridge health',
        bridgeFabricHermes.overallValue,
        `${bridgeFabricHermes.bridge.value} bridge, ${bridgeFabricHermes.fabric.value} Fabric, ${bridgeFabricHermes.hermes.value} Hermes.`,
        bridgeFabricHermes.overallState,
        bridgeFabricHermes.overallState === 'ready'
          ? 'accent'
          : bridgeFabricHermes.overallState === 'attention' || bridgeFabricHermes.overallState === 'unavailable'
            ? 'warning'
            : 'idle',
        'Thoughtseed bridge + Fabric health + Hermes task source',
        input.generatedAt,
      ),
      releaseHealth: signal(
        'releaseHealth',
        'Release health',
        releaseHealth.gate,
        releaseHealth.detail,
        releaseState,
        releaseTone,
        releaseHealth.source,
        releaseHealth.checkedAt,
      ),
    },
    tasksEvidence: taskCounts,
    activeRooms,
    projectGroups: projectGroups(input.projects, input.evidenceSummary),
    identities,
    identityRows: identityProofRows,
    reports,
    bridgeFabricHermes,
    releaseHealth,
    blockers,
    actions: actions({
      tasks: taskCounts,
      reports,
      blockers,
      activeRooms,
      bridgeFabricHermes,
      releaseHealth,
    }),
    taskProofQueue: taskProofQueue(input.tasks),
    opsDrilldowns: opsDrilldowns(releaseHealth),
  };
}
