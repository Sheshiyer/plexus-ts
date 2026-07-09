import { createHash } from 'node:crypto';
import type {
  DailyProofPacket,
  FabricTaskProofBlocker,
  FabricTaskProofSummary,
  GitHubActivity,
  ProofStatus,
  ThoughtseedFabricEvidence,
  ThoughtseedFabricEvidenceType,
  ThoughtseedFabricTask,
  ThoughtseedFabricTaskHistoryEvent,
  TimeEntry,
  WorkEvidenceSummary,
} from '../shared/types.js';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashRecord(value: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function latestBlocker(task: ThoughtseedFabricTask): string | null {
  const event = [...task.history]
    .reverse()
    .find((item) => item.type === 'blocked' || item.payload.blocker);
  const blocker = event?.payload.blocker ?? event?.payload.note ?? event?.payload.reason;
  return typeof blocker === 'string' && blocker.trim() ? blocker.trim() : null;
}

export function buildFabricTaskProofSummary(tasks: readonly ThoughtseedFabricTask[] = []): FabricTaskProofSummary {
  const proofStrength = {
    weak_evidence: 0,
    verified_evidence: 0,
  };
  const blockers: FabricTaskProofBlocker[] = [];
  let doneTasks = 0;
  let inProgressTasks = 0;
  let blockedTasks = 0;
  let verifiedTasks = 0;
  let weakEvidenceTasks = 0;
  let missingProofTasks = 0;

  for (const task of tasks) {
    proofStrength[task.evidenceStrength] = (proofStrength[task.evidenceStrength] ?? 0) + 1;
    if (task.status === 'done') doneTasks += 1;
    if (task.status === 'seen' || task.status === 'in_progress') inProgressTasks += 1;
    if (task.status === 'blocked') {
      blockedTasks += 1;
      blockers.push({
        taskId: task.taskId,
        title: task.title,
        status: task.status,
        blocker: latestBlocker(task),
      });
    }
    const hasVerifiedEvidence = task.proofStatus === 'verified' || task.evidenceStrength === 'verified_evidence';
    if (hasVerifiedEvidence) {
      verifiedTasks += 1;
    } else if (task.evidence.length > 0) {
      weakEvidenceTasks += 1;
    } else {
      missingProofTasks += 1;
    }
  }

  let proofStatus: ProofStatus = 'pending';
  if (tasks.length > 0 && verifiedTasks === tasks.length) proofStatus = 'verified';
  else if (verifiedTasks > 0 || weakEvidenceTasks > 0) proofStatus = 'partial';
  else if (blockedTasks > 0 || missingProofTasks > 0) proofStatus = 'missing';

  return {
    proofStatus,
    totalTasks: tasks.length,
    doneTasks,
    inProgressTasks,
    blockedTasks,
    verifiedTasks,
    weakEvidenceTasks,
    missingProofTasks,
    proofStrength,
    blockers,
  };
}

export function filterFabricTasksForEntries(
  tasks: readonly ThoughtseedFabricTask[] = [],
  entries: readonly TimeEntry[] = [],
): ThoughtseedFabricTask[] {
  if (tasks.length === 0 || entries.length === 0) return [];
  const entryIds = new Set(entries.map((entry) => entry.id));
  const projectIds = new Set(entries.map((entry) => entry.projectId));
  return tasks.filter((task) => {
    if (task.workEntryId && entryIds.has(task.workEntryId)) return true;
    return Boolean(task.projectId && projectIds.has(task.projectId));
  });
}

function reportProofStatus(evidenceSummary: WorkEvidenceSummary, fabricTaskProof: FabricTaskProofSummary): ProofStatus {
  if (evidenceSummary.proofStatus === 'sync_failed') return 'sync_failed';
  if (evidenceSummary.proofStatus === 'verified' && (fabricTaskProof.totalTasks === 0 || fabricTaskProof.proofStatus === 'verified')) {
    return 'verified';
  }
  if (evidenceSummary.proofStatus === 'pending' && fabricTaskProof.proofStatus === 'pending') return 'pending';
  if (evidenceSummary.proofStatus === 'missing' && fabricTaskProof.verifiedTasks === 0 && fabricTaskProof.weakEvidenceTasks === 0) return 'missing';
  if (evidenceSummary.proofStatus === 'legacy_unverified' && fabricTaskProof.verifiedTasks === 0) return 'legacy_unverified';
  return 'partial';
}

export function buildDailyProofPacket(input: {
  date: string;
  generatedAt?: string;
  totalSeconds: number;
  entryCount: number;
  evidenceSummary: WorkEvidenceSummary;
  fabricTaskProof: FabricTaskProofSummary;
  standupEvidenceRecordId?: string | null;
}): DailyProofPacket {
  const proofStatus = reportProofStatus(input.evidenceSummary, input.fabricTaskProof);
  return {
    id: `daily_proof_${input.date}`,
    date: input.date,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    proofStatus,
    reportSubjectId: input.date,
    standupEvidenceRecordId: input.standupEvidenceRecordId ?? null,
    totalSeconds: input.totalSeconds,
    entryCount: input.entryCount,
    taskCount: input.fabricTaskProof.totalTasks,
    missingProofCount: input.evidenceSummary.missingEvidenceEntries
      + input.evidenceSummary.legacyUnverifiedEntries
      + input.fabricTaskProof.missingProofTasks,
    blockerCount: input.fabricTaskProof.blockedTasks,
    evidenceSummary: input.evidenceSummary,
    fabricTaskProof: input.fabricTaskProof,
  };
}

function fabricEvidenceTypeForActivity(activity: GitHubActivity): ThoughtseedFabricEvidenceType {
  if (activity.kind === 'commit' || activity.kind === 'file_change') return 'github_commit';
  if (activity.kind === 'pull_request' || activity.kind === 'review') return 'github_pr';
  if (activity.kind === 'branch') return 'github_branch';
  if (activity.kind === 'release') return 'deploy_url';
  return 'doc_url';
}

function activityEvidence(activity: GitHubActivity, checkedAt: string): ThoughtseedFabricEvidence {
  return {
    id: `github_${activity.id}`,
    type: fabricEvidenceTypeForActivity(activity),
    value: activity.url,
    label: activity.title,
    source: 'github',
    strength: 'verified_evidence',
    status: 'verified_evidence',
    addedAt: checkedAt,
  };
}

function evidenceEvent(
  task: ThoughtseedFabricTask,
  entry: TimeEntry,
  activity: GitHubActivity,
  checkedAt: string,
): ThoughtseedFabricTaskHistoryEvent {
  const payload = {
    taskId: task.taskId,
    workEntryId: entry.id,
    activityId: activity.id,
    artifactRef: activity.url,
    artifactType: activity.kind,
    title: activity.title,
    checkedAt,
  };
  return {
    eventId: `github_evidence_${createHash('sha1').update(`${task.taskId}:${activity.id}`).digest('hex').slice(0, 24)}`,
    timestamp: checkedAt,
    actor: activity.actor ?? 'github',
    source: 'github',
    type: 'evidence_added',
    payloadHash: hashRecord(payload),
    payload,
    correlationId: task.correlationId,
  };
}

export function upgradeFabricTasksWithGitHubEvidence(input: {
  tasks: readonly ThoughtseedFabricTask[];
  entries: readonly TimeEntry[];
  activity: readonly GitHubActivity[];
  checkedAt: string;
}): ThoughtseedFabricTask[] {
  const activityById = new Map(input.activity.map((activity) => [activity.id, activity]));
  const tasksByEntry = new Map<string, ThoughtseedFabricTask[]>();
  for (const task of input.tasks) {
    if (!task.workEntryId) continue;
    const tasks = tasksByEntry.get(task.workEntryId) ?? [];
    tasks.push(task);
    tasksByEntry.set(task.workEntryId, tasks);
  }
  const updated = new Map<string, ThoughtseedFabricTask>();
  for (const entry of input.entries) {
    const activityIds = entry.githubActivityIds ?? [];
    if (activityIds.length === 0) continue;
    const tasks = tasksByEntry.get(entry.id) ?? [];
    for (const task of tasks) {
      let next: ThoughtseedFabricTask | null = null;
      for (const activityId of activityIds) {
        const activity = activityById.get(activityId);
        if (!activity) continue;
        const evidence = activityEvidence(activity, input.checkedAt);
        const current: ThoughtseedFabricTask = next ?? updated.get(task.taskId) ?? {
          ...task,
          evidence: [...task.evidence],
          history: [...task.history],
        };
        if (!current.evidence.some((item) => item.id === evidence.id || item.value === evidence.value)) {
          current.evidence.push(evidence);
          current.history.push(evidenceEvent(current, entry, activity, input.checkedAt));
          current.evidenceStrength = 'verified_evidence';
          current.proofStatus = 'verified';
          current.updatedAt = input.checkedAt;
          next = current;
        }
      }
      if (next) updated.set(task.taskId, next);
    }
  }
  return [...updated.values()];
}
