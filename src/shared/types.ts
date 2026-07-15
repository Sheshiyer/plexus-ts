import type {
  AssistantConfiguredModelProvider,
  AssistantContextScope,
  AssistantIntentStatus,
  AssistantModelCatalog,
  AssistantModelHealthRequest,
  AssistantModelHealthResult,
  AssistantModelProvider,
  AssistantModelSettingsInput,
  AssistantModelStatus,
  AssistantRouteKey,
  ProofStatus,
  AssistantStreamEvent,
  AssistantSuggestion,
  AssistantToolId,
  AssistantToolSafety,
  AssistantTurnRequest,
} from './native-assistant.js';

export type {
  AssistantContextScope,
  AssistantIntentStatus,
  AssistantConfiguredModelProvider,
  AssistantModelCatalog,
  AssistantModelCatalogEntry,
  AssistantModelCatalogState,
  AssistantModelCapability,
  AssistantModelHealthRequest,
  AssistantModelHealthResult,
  AssistantModelOrigin,
  AssistantModelProvider,
  AssistantModelProviderHealth,
  AssistantModelSettingsInput,
  AssistantModelStatus,
  AssistantRouteKey,
  AssistantRole,
  AssistantStreamEvent,
  AssistantSuggestion,
  AssistantSuggestionType,
  AssistantToolId,
  AssistantToolSafety,
  AssistantTurnRequest,
  ProofStatus,
} from './native-assistant.js';

export interface TimeEntry {
  id: string;
  projectId: string;
  description: string;
  startTime: string;
  endTime?: string | null;
  durationSeconds: number;
  targetSeconds?: number;
  pausedAt?: string | null;
  pausedSeconds?: number;
  tags: string[];
  source: 'manual' | 'timer';
  syncedAt?: string | null;
  githubRepoUrl?: string | null;
  githubRepoFullName?: string | null;
  evidenceStatus?: WorkEvidenceStatus;
  evidenceCheckedAt?: string | null;
  githubActivityIds?: string[];
  evidenceProvenance?: WorkEvidenceProvenance[];
}

export type RepoEvidenceStatus = 'missing' | 'unverified' | 'verified' | 'inaccessible' | 'legacy_unverified';
export type WorkEvidenceStatus = 'pending' | 'matched' | 'missing' | 'legacy_unverified' | 'sync_failed';
export type GitHubActivityKind = 'commit' | 'pull_request' | 'issue' | 'issue_comment' | 'review' | 'branch' | 'release' | 'file_change';
export type GitHubConnectionState = 'unconfigured' | 'pending' | 'connected' | 'suspended' | 'forbidden';
export type GitHubRepoVerificationStatus = 'unconfigured' | 'pending' | 'suspended' | 'forbidden' | 'verified';
export type GitHubActivitySyncStatus = 'unconfigured' | 'pending' | 'suspended' | 'forbidden' | 'synced';
export type GitHubInstallationAccountType = 'Organization' | 'User';
export type BreakworkCategory = 'mental_reset' | 'physical_reset' | 'eye_rest' | 'breathwork' | 'mobility' | 'hydration' | 'meeting_decompression' | 'transition';

export type WorkEvidenceProvenanceSource = 'github' | 'fabric' | 'standup' | 'worker' | 'bridge' | 'manual';

export interface WorkEvidenceProvenance {
  source: WorkEvidenceProvenanceSource;
  artifactType: string;
  artifactId: string;
  artifactRef: string;
  checkedAt: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface Project {
  id: string;
  name: string;
  clientName?: string;
  color: string;
  archived: boolean;
  createdAt: string;
  githubRepoUrl?: string | null;
  githubRepoFullName?: string | null;
  repoFullName?: string | null;
  githubRepoId?: string | null;
  repoVerifiedAt?: string | null;
  repoEvidenceStatus?: RepoEvidenceStatus;
  repoRequired?: boolean;
  evidenceStatus?: WorkEvidenceStatus;
}

export interface GitHubRepoOption {
  id: number;
  installationId: number;
  account: GitHubInstallationTarget;
  fullName: string;
  url: string;
  source: 'worker';
  private: boolean;
  verifiedAt?: string | null;
}

export interface GitHubInstallationTarget {
  id: number;
  login: string;
  type: GitHubInstallationAccountType;
}

export interface GitHubInstallationSummary {
  installationId: number;
  status: GitHubConnectionState;
  account: GitHubInstallationTarget;
}

export interface GitHubConnectionStatus {
  status: GitHubConnectionState;
  installations: GitHubInstallationSummary[];
  allowedTargets: GitHubInstallationTarget[];
  repositoryCount: number;
  message?: string;
  updatedAt?: string | null;
}

export interface GitHubConnectStartResult {
  status: GitHubConnectionState;
  target?: GitHubInstallationTarget;
  message?: string;
}

export type GitHubActorState = 'unconfigured' | 'not_enrolled' | 'pending' | 'verified' | 'forbidden';

export interface GitHubActorStatus {
  status: GitHubActorState;
  allowedLogins: string[];
  actor?: {
    id: number;
    login: string;
    verifiedAt: string;
  } | null;
  message?: string;
}

export interface GitHubActorEnrollStartResult {
  status: GitHubActorState;
  allowedLogins: string[];
  message?: string;
}

export interface FounderGitHubSetupIntent {
  version: 1;
  organizationLogin: string;
  allowedLogins: string[];
  installationTargets: GitHubInstallationTarget[];
}

export interface GitHubConnectionReturnIntent {
  version: 1;
  accountId: number;
}

export interface GitHubRepositoryListResult {
  status: GitHubConnectionState;
  repositories: GitHubRepoOption[];
  message?: string;
}

export interface ProjectRepoVerification {
  ok: boolean;
  project?: Project;
  repo?: GitHubRepoOption;
  status: GitHubRepoVerificationStatus;
  message?: string;
}

export type GitHubCiEvidenceType = 'workflow_run' | 'check_run';

export interface GitHubCiEvidence {
  id: string;
  externalId: number;
  projectId: string;
  repoFullName: string;
  evidenceClass: 'ci';
  evidenceType: GitHubCiEvidenceType;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | 'stale' | 'startup_failure' | null;
  url: string;
  headSha: string;
  attempt: number | null;
  event: string | null;
  branch: string | null;
  actor: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface GitHubCiEvidenceBatch {
  items: GitHubCiEvidence[];
  truncated: boolean;
  checkedShas: string[];
}

export type GitHubActivitySyncResult = {
  ok: true;
  status: 'synced';
  activity: GitHubActivity[];
  ciEvidence: GitHubCiEvidenceBatch;
  message?: string;
} | {
  ok: false;
  status: Exclude<GitHubActivitySyncStatus, 'synced'>;
  activity: GitHubActivity[];
  ciEvidence: GitHubCiEvidenceBatch;
  message?: string;
};

export interface VaultProjectCandidate {
  code: string;
  projectId: string;
  name: string;
  status: string;
  sourcePath: string;
  githubRepoFullName?: string | null;
  githubRepoUrl?: string | null;
  cachedProjectId?: string | null;
  cachedRepoStatus?: RepoEvidenceStatus | null;
}

export interface VaultProjectScanResult {
  ok: boolean;
  repoRoot?: string | null;
  candidates: VaultProjectCandidate[];
  imported: number;
  message?: string;
}

export interface GitHubActivity {
  id: string;
  projectId: string;
  repoFullName: string;
  repoUrl: string;
  kind: GitHubActivityKind;
  title: string;
  url: string;
  actor?: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export type AgentSessionProvider = 'codex' | 'claude' | 'cursor' | 'opencode';
export type AgentSessionCandidateStatus = 'pending' | 'accepted' | 'dismissed' | 'ignored';
export type AgentSessionMatchStatus = 'ready' | 'needs_project' | 'repo_unverified' | 'low_confidence';

export interface AgentSessionCandidate {
  id: string;
  provider: AgentSessionProvider;
  providerSessionId?: string | null;
  sourcePath: string;
  sourceLabel: string;
  sourceHash: string;
  repoRoot?: string | null;
  repoFullName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  startedAt: string;
  endedAt: string;
  lastSeenAt: string;
  title: string;
  summary?: string | null;
  confidence: number;
  confidenceReasons: string[];
  matchStatus: AgentSessionMatchStatus;
  status: AgentSessionCandidateStatus;
  createdEntryId?: string | null;
}

export interface AgentSessionScanResult {
  ok: boolean;
  enabled: boolean;
  scanned: number;
  imported: number;
  totalPending: number;
  matchedPending: number;
  readyPending: number;
  candidates: AgentSessionCandidate[];
  roots: { provider: AgentSessionProvider; path: string; exists: boolean }[];
  message?: string;
}

export type AgentSessionAcceptInput = string | {
  candidateId: string;
  taskId?: string;
};

export interface WorkEvidenceSummary {
  proofStatus: ProofStatus;
  totalEntries: number;
  evidencedEntries: number;
  missingEvidenceEntries: number;
  legacyUnverifiedEntries: number;
  evidencedSeconds: number;
  missingEvidenceSeconds: number;
  projectRepoCoverage: Record<string, RepoEvidenceStatus>;
}

export interface FabricTaskProofBlocker {
  taskId: string;
  title: string;
  status: ThoughtseedFabricTaskStatus;
  blocker?: string | null;
}

export interface FabricTaskProofSummary {
  proofStatus: ProofStatus;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  verifiedTasks: number;
  weakEvidenceTasks: number;
  missingProofTasks: number;
  proofStrength: Record<ThoughtseedFabricEvidenceStrength, number>;
  blockers: FabricTaskProofBlocker[];
}

export interface DailyProofPacket {
  id: string;
  date: string;
  generatedAt: string;
  proofStatus: ProofStatus;
  reportSubjectId: string;
  standupEvidenceRecordId?: string | null;
  totalSeconds: number;
  entryCount: number;
  taskCount: number;
  missingProofCount: number;
  blockerCount: number;
  evidenceSummary: WorkEvidenceSummary;
  fabricTaskProof: FabricTaskProofSummary;
  dailyEventId?: string | null;
  deliveryStatus?: string | null;
  deliveryChannel?: string | null;
  artifactRef?: string | null;
  nextRetryAt?: string | null;
}

export interface StandupEvidenceRecord {
  id: string;
  date: string;
  totalSeconds: number;
  evidenceSummary: WorkEvidenceSummary;
  activity: GitHubActivity[];
  generatedAt: string;
}

export interface StandupComplianceSummary {
  trackedDays: number;
  compliantDays: number;
  missedDays: number;
  rate: number | null;
}

export interface ReviewCycle {
  id: string;
  kind: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  evidenceSummary: WorkEvidenceSummary;
  standupCompliance: StandupComplianceSummary;
  blockers: string[];
  appraisalSignals: string[];
  generatedAt: string;
}

export interface RhythmProfile {
  enabled: boolean;
  birthdate?: string;
  privateConsentAt?: string | null;
  updatedAt?: string | null;
}

export interface MemberProfileSettings {
  displayName?: string;
  title?: string;
  handle?: string;
  status?: string;
  avatarUrl?: string;
  updatedAt?: string | null;
}

export interface BreakworkPrompt {
  id: string;
  category: BreakworkCategory;
  title: string;
  promptText: string;
  audioFileRef?: string | null;
  triggerReason: string;
  generatedAt: string;
  completedAt?: string | null;
  snoozedUntil?: string | null;
}

export interface Employee {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  monthlyQuotaHours: number;
}

export type PlexusRole = 'employee' | 'admin';
export type ProjectVisibility = 'active' | 'all' | 'assigned';
export type OnboardingRequirement = 'required' | 'optional';
export type OnboardingStateValue = 'required' | 'optional' | 'skipped' | 'deferred' | 'completed' | 'failed';

export interface OnboardingStepState {
  stepId: string;
  label: string;
  requirement: OnboardingRequirement;
  state: OnboardingStateValue;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface SessionOnboarding {
  steps: OnboardingStepState[];
  requiredComplete: boolean;
  completed: boolean;
}

export interface Session {
  employee: Employee;
  identityId: string;
  employeeId: string | null;
  adminId: string | null;
  workspaceId: string;
  email: string;
  role: PlexusRole;
  displayName: string;
  projectVisibility: ProjectVisibility;
  capabilities: Record<string, boolean>;
  onboarding: SessionOnboarding;
  signedInAt: string;
}

export interface WorkerConfig {
  baseUrl: string;
  workspaceId: string;
  hasToken: boolean;
}

export interface ThoughtseedBridgeStatus {
  configured: boolean;
  connected: boolean;
  bridgeApiUrl: string;
  tenantId: string;
  memberId: string;
  tokenExpiresAt?: string | null;
  lastSeenAt?: string | null;
  lastError?: string | null;
}

export interface ThoughtseedBridgeDirective {
  id: string;
  memberId?: string;
  tenantId?: string;
  payload: Record<string, unknown>;
  createdAt?: string;
  issuedAt?: string;
  ackedAt?: string | null;
}

export type ThoughtseedFabricTaskStatus = 'assigned' | 'seen' | 'in_progress' | 'blocked' | 'done';
export type ThoughtseedFabricTaskWorkMode = 'manual' | 'delegated';
export type ThoughtseedFabricEvidenceStrength = 'weak_evidence' | 'verified_evidence';
export type ThoughtseedFabricEvidenceType =
  | 'github_pr'
  | 'github_commit'
  | 'github_branch'
  | 'deploy_url'
  | 'figma_url'
  | 'canva_url'
  | 'doc_url'
  | 'file_path'
  | 'note';
export type ThoughtseedFabricHistoryEventType =
  | 'assigned'
  | 'seen'
  | 'workMode_selected'
  | 'status_changed'
  | 'blocked'
  | 'done'
  | 'evidence_added'
  | 'candidate_evidence_found'
  | 'candidate_review_pending'
  | 'candidate_accepted'
  | 'candidate_rejected'
  | 'workMode_override'
  | 'completion_upgraded'
  | 'bridge_conflict';
export type ThoughtseedFabricHistorySource =
  | 'plexus'
  | 'hermes'
  | 'cambium'
  | 'paperclip'
  | 'github'
  | 'figma'
  | 'canva'
  | 'deploy'
  | 'manual';

export interface ThoughtseedFabricEvidence {
  id: string;
  type: ThoughtseedFabricEvidenceType;
  value: string;
  label?: string;
  source?: ThoughtseedFabricHistorySource;
  strength?: ThoughtseedFabricEvidenceStrength;
  status?: 'verified_evidence' | 'review_pending' | 'rejected_candidate';
  addedAt: string;
}

export interface ThoughtseedFabricTaskHistoryEvent {
  eventId: string;
  timestamp: string;
  actor: string;
  source: ThoughtseedFabricHistorySource;
  type: ThoughtseedFabricHistoryEventType;
  payloadHash: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

export interface ThoughtseedFabricTask {
  taskId: string;
  directiveId?: string;
  correlationId?: string;
  projectId?: string;
  projectName?: string;
  workEntryId?: string;
  questId?: string;
  branchId?: string;
  arcId?: string;
  missionId?: string;
  kpiIds?: string[];
  gateId?: string;
  proofRequired?: string;
  proofFoldback?: string;
  promotionState?: string;
  autonomyBoundary?: string;
  approvalsRequired?: string[];
  skillHints?: unknown[];
  clientId?: string;
  clientName?: string;
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  taskType?: 'engineering' | 'design' | 'marketing' | 'operations' | 'research' | 'general';
  assigneeMemberId: string;
  assignedBy?: string;
  source?: 'hermes' | 'cambium' | 'paperclip';
  status: ThoughtseedFabricTaskStatus;
  proofStatus?: ProofStatus;
  workMode?: ThoughtseedFabricTaskWorkMode;
  workModeLocked: boolean;
  overrideCount: number;
  evidenceStrength: ThoughtseedFabricEvidenceStrength;
  evidence: ThoughtseedFabricEvidence[];
  history: ThoughtseedFabricTaskHistoryEvent[];
  updatedAt: string;
}

export interface ThoughtseedFabricTaskListResult {
  ok: boolean;
  tasks: ThoughtseedFabricTask[];
}

export interface ThoughtseedFabricTaskSyncResult extends ThoughtseedFabricTaskListResult {
  ingestedDirectiveIds: string[];
  conflictCount: number;
}

export interface ThoughtseedFabricWorkModeResult {
  ok: boolean;
  task: ThoughtseedFabricTask;
}

export interface ThoughtseedFabricTaskReportInput {
  taskId: string;
  status: ThoughtseedFabricTaskStatus;
  note?: string;
  blocker?: string;
  evidence?: {
    type: ThoughtseedFabricEvidenceType;
    value: string;
    label?: string;
  };
}

export interface ThoughtseedFabricTaskReportResult {
  ok: boolean;
  task: ThoughtseedFabricTask;
  reportId: string;
  response: Record<string, unknown>;
}

export type TemperanceDispatchEventKind =
  | 'assignment'
  | 'mode'
  | 'status'
  | 'evidence'
  | 'conflict'
  | 'completion';
export type TemperanceDispatchLaneKey = 'assigned' | 'delegated' | 'blocked' | 'done';
export type TemperanceDispatchFailureKind = 'auth' | 'quota' | 'network' | 'validation' | 'conflict' | 'user_cancel' | 'unknown';
export type TemperanceDispatchToolPermission = 'read_only' | 'write' | 'admin';
export type TemperanceSkillRecommendationSource = 'skillHints' | 'taskThemes' | 'sessionThemes';

export interface TemperanceDispatchEvent {
  eventId: string;
  taskId: string;
  kind: TemperanceDispatchEventKind;
  historyType: ThoughtseedFabricHistoryEventType;
  source: ThoughtseedFabricHistorySource;
  actor: string;
  timestamp: string;
  correlationId: string | null;
  status: ThoughtseedFabricTaskStatus | null;
  workMode: ThoughtseedFabricTaskWorkMode | null;
  evidenceStrength: ThoughtseedFabricEvidenceStrength | null;
  conflict: boolean;
  payloadSummary: string;
}

export interface TemperanceSkillRecommendation {
  id: string;
  taskId: string;
  skillName: string;
  label: string;
  known: boolean;
  confidence: number;
  rationale: string;
  safety: AssistantToolSafety;
  source: TemperanceSkillRecommendationSource;
}

export interface TemperanceDispatchLaneTask {
  taskId: string;
  title: string;
  status: ThoughtseedFabricTaskStatus;
  workMode: ThoughtseedFabricTaskWorkMode | null;
  evidenceStrength: ThoughtseedFabricEvidenceStrength;
  proofStatus: ProofStatus | null;
  updatedAt: string;
  conflictCount: number;
}

export interface TemperanceDispatchLaneSummary {
  key: TemperanceDispatchLaneKey;
  label: string;
  count: number;
  tasks: TemperanceDispatchLaneTask[];
}

export interface TemperanceDispatchSessionLink {
  id: string;
  taskId: string;
  candidateId: string;
  provider: AgentSessionProvider;
  title: string;
  status: AgentSessionCandidateStatus;
  matchReason: 'project' | 'project_name' | 'theme';
  confidence: number;
  evidenceStrength: ThoughtseedFabricEvidenceStrength;
  artifactRefs: string[];
  correlationId: string | null;
}

export interface TemperanceDispatchDiagnostics {
  totalTasks: number;
  activeTasks: number;
  delegatedTasks: number;
  blockedTasks: number;
  doneTasks: number;
  conflictCount: number;
  recommendationCount: number;
  linkedSessionCount: number;
  lastEventAt: string | null;
}

export interface TemperanceDispatchConflictInput {
  taskId: string;
  eventId: string;
  existingPayloadHash: string | null;
  incomingPayloadHash: string;
  incomingPayload?: Record<string, unknown>;
  createdAt: string;
}

export interface TemperanceDispatchConflictRecord {
  id: string;
  taskId: string;
  eventId: string;
  createdAt: string;
  correlationId: string | null;
  existingPayloadHash: string | null;
  incomingPayloadHash: string;
  payloadSummary: string;
  status: 'needs_review';
}

export interface TemperanceDispatchLocalSmokeCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface TemperanceDispatchLocalSmokeResult {
  ok: boolean;
  checkedAt: string;
  checks: TemperanceDispatchLocalSmokeCheck[];
  boundary: string;
}

export interface TemperanceDispatchSupportPacket {
  packetId: string;
  generatedAt: string;
  localOnly: true;
  summary: {
    totalTasks: number;
    activeTasks: number;
    delegatedTasks: number;
    conflictCount: number;
    recommendationCount: number;
    linkedSessionCount: number;
    lastEventAt: string | null;
  };
  correlationIds: string[];
  conflictEventIds: string[];
  redactions: string[];
  boundary: string;
}

export interface TemperanceDispatchRuntimeDiagnostics {
  correlationIds: string[];
  conflicts: TemperanceDispatchConflictRecord[];
  supportPacket: TemperanceDispatchSupportPacket;
  localSmoke: TemperanceDispatchLocalSmokeResult;
}

export interface TemperanceToolHarnessRunPlan {
  visible: true;
  permissions: TemperanceDispatchToolPermission[];
  auditRequired: true;
  timeoutMs: number;
  redactionRequired: true;
  failureKinds: TemperanceDispatchFailureKind[];
  copy: string;
  invariants: string[];
}

export interface TemperanceParallelAgentHandoffRecord {
  id: string;
  parentTaskId: string;
  childSessionId: string;
  owner: string;
  status: 'assigned' | 'running' | 'blocked' | 'done';
  evidenceRequired: true;
  evidenceStrength: ThoughtseedFabricEvidenceStrength;
  artifactRefs: string[];
  correlationId: string | null;
}

export interface TemperanceDispatchLaneStatusResult {
  ok: boolean;
  generatedAt: string;
  lanes: TemperanceDispatchLaneSummary[];
  recommendations: TemperanceSkillRecommendation[];
  sessionLinks: TemperanceDispatchSessionLink[];
  recentEvents: TemperanceDispatchEvent[];
  diagnostics: TemperanceDispatchDiagnostics;
  runtime: TemperanceDispatchRuntimeDiagnostics;
  toolHarnessPlan: TemperanceToolHarnessRunPlan;
}

export interface ThoughtseedBridgeRedeemResult {
  ok: boolean;
  status: ThoughtseedBridgeStatus;
  message?: string;
}

export interface ThoughtseedBridgeHeartbeatResult {
  ok: boolean;
  id: string;
  response: Record<string, unknown>;
}

export interface ThoughtseedBridgePollResult {
  ok: boolean;
  directives: ThoughtseedBridgeDirective[];
}

export interface ThoughtseedBridgeAckResult {
  ok: boolean;
  ackedIds: string[];
  response: Record<string, unknown>;
}

export interface ThoughtseedBridgeRotateResult {
  ok: boolean;
  status: ThoughtseedBridgeStatus;
}

export interface DailyReport {
  date: string;
  entries: TimeEntry[];
  totalSeconds: number;
  entryCount: number;
  projectBreakdown: Record<string, number>;
  evidenceSummary: WorkEvidenceSummary;
  fabricTaskProof: FabricTaskProofSummary;
  proofStatus: ProofStatus;
  proofPacket: DailyProofPacket;
}

export interface WeeklyReport {
  weekStart: string;
  days: DailyReport[];
  totalSeconds: number;
  entryCount: number;
  projectBreakdown: Record<string, number>;
  evidenceSummary: WorkEvidenceSummary;
  fabricTaskProof: FabricTaskProofSummary;
  proofStatus: ProofStatus;
}

export interface MonthlyReport {
  month: string;
  weeks: WeeklyReport[];
  totalSeconds: number;
  entryCount: number;
  projectBreakdown: Record<string, number>;
  evidenceSummary: WorkEvidenceSummary;
  fabricTaskProof: FabricTaskProofSummary;
  proofStatus: ProofStatus;
}

export interface StandupData {
  date: string;
  yesterday: string;
  today: string;
  blockers: string;
  source: 'vault' | 'worker' | 'none';
}

export interface MemberKpiSummary {
  todaySeconds: number;
  weekSeconds: number;
  projectBreakdown: Record<string, number>;
  standupCompliant: boolean;
}

export interface UsageSignal {
  timestamp: string;
  activeProject?: string;
  dailyTotalSeconds: number;
  standupCompliant: boolean;
  sessionDurationMinutes: number;
}

export type HandoffKind =
  | 'project_sync'
  | 'time_sync'
  | 'usage_signal'
  | 'standup_sync'
  | 'paperclip_closeout'
  | 'paperclip_memory'
  | 'preferences_save'
  | 'github_repo_verify'
  | 'github_activity_sync'
  | 'standup_evidence_sync'
  | 'review_rollup_sync'
  | 'breakwork_audio_generation'
  | 'thoughtseed_bridge'
  | 'parallel_agent_dispatch'
  | 'assistant_daily_event';

export type HandoffStatus = 'pending' | 'sent' | 'failed' | 'retrying' | 'skipped';

export interface HandoffRecord {
  id: string;
  kind: HandoffKind;
  status: HandoffStatus;
  title: string;
  payload: Record<string, unknown>;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextRetryAt: string | null;
}

export interface HandoffInput {
  kind: HandoffKind;
  status: HandoffStatus;
  title: string;
  payload?: Record<string, unknown>;
  error?: string | null;
  nextRetryAt?: string | null;
}

export type ProofCustodySubjectType =
  | 'daily_report'
  | 'weekly_report'
  | 'monthly_report'
  | 'standup'
  | 'review'
  | 'fabric_task'
  | 'project'
  | 'assistant_daily_event';

export type ProofCustodyEvidenceType =
  | 'summary'
  | 'report'
  | 'standup'
  | 'review'
  | 'github_pr'
  | 'github_commit'
  | 'github_branch'
  | 'github_ci_summary'
  | 'github_workflow_run'
  | 'github_check_run'
  | 'deploy_url'
  | 'figma_url'
  | 'canva_url'
  | 'doc_url'
  | 'file_path'
  | 'note'
  | 'daily_event';

export interface ProofCustodyRecord {
  id: string;
  subjectType: ProofCustodySubjectType;
  subjectId: string;
  proofStatus: ProofStatus;
  evidenceType: ProofCustodyEvidenceType;
  strength: ThoughtseedFabricEvidenceStrength | null;
  artifactRef: string | null;
  payloadHash: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProofCustodyInput {
  id?: string;
  subjectType: ProofCustodySubjectType;
  subjectId: string;
  proofStatus: ProofStatus;
  evidenceType: ProofCustodyEvidenceType;
  strength?: ThoughtseedFabricEvidenceStrength | null;
  artifactRef?: string | null;
  payload?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemberProvisionBundle {
  memberId: string;
  memberName: string;
  email?: string;
  workspaceId: string;
  paperclipRepoRoot?: string;
  features?: {
    agentFabricEnabled?: boolean;
    standupEnabled?: boolean;
    weeklyReportEnabled?: boolean;
  };
}

export interface AdminDemoIdentity {
  identityId: string;
  employeeId: string | null;
  email: string;
  displayName: string;
  role: PlexusRole;
  projectVisibility: ProjectVisibility;
  capabilities: Record<string, boolean>;
  onboarding: {
    steps: OnboardingStepState[];
  };
}

export interface AdminDemoOverview {
  workspaceId: string;
  viewer: Omit<Session, 'employee' | 'signedInAt'> & { access: true };
  projects: unknown[];
  identities: AdminDemoIdentity[];
}

export type AdminProofSignalKey =
  | 'tasksEvidence'
  | 'activeRooms'
  | 'blockers'
  | 'reports'
  | 'bridgeHealth'
  | 'releaseHealth';

export type AdminProofSignalState = 'ready' | 'attention' | 'blocked' | 'manual' | 'unavailable';
export type AdminProofSignalTone = 'accent' | 'mint' | 'warning' | 'error' | 'idle';

export interface AdminProofSignalSnapshot {
  key: AdminProofSignalKey;
  label: string;
  value: string;
  detail: string;
  state: AdminProofSignalState;
  tone: AdminProofSignalTone;
  source: string;
  checkedAt: string;
}

export interface AdminProofTaskEvidenceSignal {
  assigned: number;
  active: number;
  blocked: number;
  done: number;
  verified: number;
  weak: number;
  missingProof: number;
  total: number;
}

export interface AdminProofActiveRoomSignal {
  openRooms: number;
  liveCalls: number;
  participants: number;
  screenShares: number;
  staleRooms: number;
  topRoomName: string | null;
  sourceState: AdminProofSignalState;
  sourceMessage: string | null;
}

export type AdminProofProjectGroupKey = 'verified' | 'needs_repo' | 'inaccessible' | 'missing_proof';

export interface AdminProofProjectGroup {
  key: AdminProofProjectGroupKey;
  label: string;
  count: number;
  projectIds: string[];
}

export interface AdminProofIdentitySummary {
  total: number;
  admins: number;
  employees: number;
  onboardingComplete: number;
  onboardingAttention: number;
}

export type AdminProofIdentitySetupState = 'ready' | 'attention' | 'blocked';

export interface AdminProofIdentityRow {
  identityId: string;
  displayName: string;
  email: string;
  role: PlexusRole;
  onboardingDone: number;
  onboardingTotal: number;
  requiredDone: number;
  requiredTotal: number;
  optionalDone: number;
  optionalTotal: number;
  setupState: AdminProofIdentitySetupState;
  proofState: AdminProofSignalState;
  lastUpdatedAt: string | null;
  testModeAvailable: boolean;
}

export interface AdminProofReportSignal {
  dailyPackets: number;
  assistantDailyEvents: number;
  submitted: number;
  queued: number;
  failed: number;
  missing: number;
  latestStatus: ProofStatus | 'none';
  latestUpdatedAt: string | null;
}

export type AdminProofDailyOutboxStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'failed';

export interface AdminProofDailyOutboxItem {
  id: string;
  date: string;
  status: AdminProofDailyOutboxStatus;
  updatedAt: string;
  nextRetryAt: string | null;
}

export interface AdminProofSourceHealth {
  state: AdminProofSignalState;
  value: string;
  detail: string;
  checkedAt: string;
}

export interface AdminProofBridgeFabricHermesSignal {
  bridge: AdminProofSourceHealth;
  fabric: AdminProofSourceHealth & {
    reachablePorts: number;
    totalPorts: number;
    healthyAgents: number;
    totalAgents: number;
  };
  hermes: AdminProofSourceHealth & {
    tasks: number;
    blocked: number;
  };
  overallState: AdminProofSignalState;
  overallValue: string;
}

export interface AdminProofReleaseHealthSignal {
  gate: 'green' | 'red' | 'unknown';
  source: string;
  checkedAt: string;
  detail: string;
  ciWorkflow: boolean;
  releaseWorkflow: boolean;
  releaseEvidencePolicy: boolean;
  releaseGateEvidence: boolean;
  ciEvidenceCount: number;
  ciSuccessfulCount: number;
  ciFailedCount: number;
  ciPendingCount: number;
  ciLatestConclusion: string;
  ciEvidenceCheckedAt: string | null;
}

export interface AdminProofBlockerSignal {
  count: number;
  taskBlockers: number;
  missingEvidence: number;
  syncFailures: number;
  topBlocker: string | null;
}

export interface AdminProofBlockerReport {
  generatedAt: string;
  visibleWithinMs: number;
  topBlocker: string | null;
  topBlockerTaskId: string | null;
  topBlockerTitle: string | null;
  nextAction: string;
  nextActionDetail: string;
  nextActionRouteKey: AssistantRouteKey;
}

export interface AdminProofAction {
  id: string;
  title: string;
  detail: string;
  tone: AdminProofSignalTone;
  routeKey?: AssistantRouteKey;
}

export interface AdminProofTaskQueueItem {
  taskId: string;
  title: string;
  projectName: string | null;
  status: ThoughtseedFabricTaskStatus;
  proofStatus: ProofStatus | 'none';
  evidenceStrength: ThoughtseedFabricEvidenceStrength;
  source: ThoughtseedFabricTask['source'] | 'unknown';
  updatedAt: string;
}

export type AdminProofOpsDrilldownTarget = 'release_docs' | 'ci_evidence' | 'issue_hub';

export interface AdminProofOpsDrilldown {
  id: AdminProofOpsDrilldownTarget;
  title: string;
  detail: string;
  target: string;
  tone: AdminProofSignalTone;
  routeKey?: 'reports' | 'diagnostics';
}

export interface AdminProofOpsDrilldownOpenResult {
  ok: boolean;
  id: AdminProofOpsDrilldownTarget;
  target: string;
  message?: string;
}

export interface AdminProofSnapshotHandoff {
  source: 'admin_proof_cockpit';
  target: 'reports' | 'export';
  actionId: string;
  title: string;
  detail: string;
  date: string;
  generatedAt: string;
  workspaceId: string;
  topBlocker: string | null;
  nextAction: string;
}

export interface AdminProofCockpitSnapshot {
  date: string;
  generatedAt: string;
  workspaceId: string;
  viewer: {
    identityId: string;
    email: string;
    role: PlexusRole;
    projectVisibility: ProjectVisibility;
  };
  signals: Record<AdminProofSignalKey, AdminProofSignalSnapshot>;
  tasksEvidence: AdminProofTaskEvidenceSignal;
  activeRooms: AdminProofActiveRoomSignal;
  projectGroups: AdminProofProjectGroup[];
  identities: AdminProofIdentitySummary;
  identityRows: AdminProofIdentityRow[];
  reports: AdminProofReportSignal;
  bridgeFabricHermes: AdminProofBridgeFabricHermesSignal;
  releaseHealth: AdminProofReleaseHealthSignal;
  blockers: AdminProofBlockerSignal;
  blockerReport: AdminProofBlockerReport;
  actions: AdminProofAction[];
  taskProofQueue: AdminProofTaskQueueItem[];
  opsDrilldowns: AdminProofOpsDrilldown[];
}

/* ── Phase 6: Agent Fabric Health ─────────────────────────── */

export interface PortStatus {
  port: number;
  label: string;
  reachable: boolean;
  latencyMs?: number;
  lastCheckedAt: string;
}

export interface AgentHealth {
  agentId: string;
  agentName: string;
  department?: string;
  role?: string;
  status: 'healthy' | 'stale' | 'uninitialized';
  lastCycle: string | null;
  outcome: string | null;
  steps: number;
  blocked: number;
  missingFiles: number;
  staleSeconds?: number;
}

export interface FabricStatus {
  ok?: boolean;
  checkedAt: string;
  ports: PortStatus[];
  agents: AgentHealth[];
  summary: any;
  summaryCounts?: {
    healthy: number;
    degraded: number;
    uninitialized: number;
    stale: number;
    missingFileAgents: number;
    total: number;
  };
  bridge: {
    reachable: boolean;
    message?: string;
  };
  safety: {
    mode: 'strict_with_guarded_override';
    targetCompanyId: string | null;
    targetCompanyName: string | null;
    targetCompanyPrefix: string | null;
    selectionSource: 'configured' | 'thoughtseed_default' | 'first_available' | 'unknown';
    thoughtseedOrg: boolean | null;
    testCompany: boolean | null;
    writesAllowed: boolean;
    reason: string;
  };
  vault: {
    standups: number;
    handoffs: number;
  };
  dailyProof?: {
    ready: boolean;
    source: 'assistant_local_evidence';
    label: string;
    message: string;
  };
  optionalHelperProof?: {
    paperclipStandup?: StandupData;
    paperclipStandupCount: number;
    handoffCount: number;
    message: string;
  };
  shellHealthCheck?: {
    ok: boolean;
    exitCode: number | null;
    output: string;
  };
  standup?: StandupData;
  kpi?: MemberKpiSummary;
  install?: PaperclipInstallStatus;
}

/* ── G1/G8: Paperclip Install Detection ──────────────────── */

export interface PaperclipInstallStatus {
  binaryFound: boolean;
  binaryPath?: string;
  configFound: boolean;
  serverPort?: number;
  serverHost?: string;
  adapterPort?: number;
}

/* ── G2: Dynamic port config from Paperclip config.json ──── */

export interface PaperclipPortConfig {
  host: string;
  uiPort: number;
  adapterPort: number;
  source: 'config.json' | 'default';
}

export type MediaPermissionState = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';
export type MediaCaptureKind = 'microphone' | 'camera' | 'screen';
export type MediaRequestKind = 'microphone' | 'camera';

export interface DesktopCaptureSummary {
  available: boolean;
  sourceCount: number;
  screenCount: number;
  windowCount: number;
  error?: string;
}

export interface MediaCaptureStatus {
  checkedAt: string;
  platform: NodeJS.Platform;
  isPackaged: boolean;
  permissions: Record<MediaCaptureKind, MediaPermissionState>;
  desktopCapture: DesktopCaptureSummary;
  renderer: {
    mediaDevicesAvailable?: boolean;
    enumerateDevicesAvailable?: boolean;
    audioInputs?: number;
    audioOutputs?: number;
    videoInputs?: number;
    error?: string;
  };
  notes: string[];
}

export type RealtimeRoomType = 'workspace_lobby' | 'project_room' | 'ad_hoc';
export type RealtimeRoomState = 'open' | 'archived';
export type RealtimeCallState = 'live' | 'ended' | 'failed';
export type RealtimeParticipantRole = 'host' | 'participant' | 'viewer' | 'agent_observer';
export type RealtimeParticipantState = 'joined' | 'left' | 'removed';
export type RealtimeTrackKind = 'audio' | 'camera' | 'screen';
export type RealtimeTrackDirection = 'publish' | 'subscribe';
export type RealtimeTrackState = 'live' | 'closed' | 'failed';

export interface RealtimePresenceSummary {
  participants: number;
  screenShares: number;
}

export interface RealtimeCall {
  id: string;
  workspaceId: string;
  roomId: string;
  projectId: string | null;
  state: RealtimeCallState;
  createdByIdentityId: string;
  meetingRecordId: string | null;
  provider: string;
  metadata: Record<string, unknown>;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RealtimeRoom {
  id: string;
  workspaceId: string;
  projectId: string | null;
  projectName?: string | null;
  name: string;
  slug: string;
  roomType: RealtimeRoomType;
  state: RealtimeRoomState;
  visibility: string;
  activeCallId: string | null;
  activeCall: RealtimeCall | null;
  presence: RealtimePresenceSummary;
  metadata: Record<string, unknown>;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RealtimeParticipant {
  id: string;
  workspaceId: string;
  roomId: string;
  callSessionId: string;
  identityId: string;
  employeeId: string | null;
  displayName: string;
  role: RealtimeParticipantRole;
  state: RealtimeParticipantState;
  clientInstanceId: string;
  cloudflareSessionId: string | null;
  media: {
    audio: boolean;
    video: boolean;
    screen: boolean;
  };
  joinedAt: string;
  leftAt: string | null;
  lastSeenAt: string;
  metadata: Record<string, unknown>;
}

export interface RealtimeMediaTrack {
  id: string;
  workspaceId: string;
  roomId: string;
  callSessionId: string;
  participantId: string;
  identityId: string;
  trackKind: RealtimeTrackKind;
  direction: RealtimeTrackDirection;
  state: RealtimeTrackState;
  label: string | null;
  sourceId: string | null;
  cloudflareSessionId: string | null;
  cloudflareTrackId: string | null;
  targetTrackIds: string[];
  metadata: Record<string, unknown>;
  startedAt: string;
  endedAt: string | null;
  updatedAt: string;
}

export interface RealtimeCloudflareSession {
  configured: boolean;
  appId: string | null;
  sessionId: string | null;
  sessionDescription: unknown | null;
  stunUrls: string[];
  negotiation: string;
}

export interface RealtimeRoomDetail {
  room: RealtimeRoom;
  call: RealtimeCall | null;
  participants: RealtimeParticipant[];
  tracks: RealtimeMediaTrack[];
}

export interface RealtimeJoinInput {
  clientInstanceId: string;
  intent: 'presence_only' | 'media';
  sessionDescription?: unknown;
  media?: {
    audio?: boolean;
    video?: boolean;
    screen?: boolean;
  };
}

export interface RealtimeJoinResponse {
  room: RealtimeRoom;
  call: RealtimeCall;
  participant: RealtimeParticipant;
  cloudflare: RealtimeCloudflareSession;
}

export interface RealtimeTrackInput {
  participantId?: string;
  trackKind: RealtimeTrackKind;
  direction?: RealtimeTrackDirection;
  sdp?: string;
  label?: string;
  sourceId?: string | null;
  cloudflareSessionId?: string | null;
  cloudflareTrackId?: string | null;
  targetTrackIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface RealtimeTrackResponse {
  track: RealtimeMediaTrack;
  cloudflare: {
    appId: string | null;
    stunUrls: string[];
    negotiation: string;
  };
}

export interface RealtimeCloseoutPayload {
  title?: string;
  manualNotes: string;
  decisions: string[];
  actionItems: string[];
  linkedTimeEntryIds: string[];
  linkedIssueIds: string[];
  timeEntryId?: string | null;
  sendToPaperclip: boolean;
}

export type CoWorkingRecordingZoneType = 'project_zone' | 'promoted_lounge_session';
export type CoWorkingRecordingSessionState = 'starting' | 'recording' | 'stopped' | 'finalized' | 'failed';
export type CoWorkingVisibleRecordingState = 'recording_starting' | 'recording' | 'recording_stopping';

export interface CoWorkingRecordingCaptureScope {
  trackKinds: RealtimeTrackKind[];
  participantIds: string[];
  trackIds?: string[];
  composedPlaybackRequested?: boolean;
}

export interface CoWorkingRecordingConsentParticipant {
  participantId: string;
  identityId?: string | null;
  displayName: string;
  consented: boolean;
  consentedAt: string | null;
  revokedAt: string | null;
}

export interface CoWorkingRecordingConsentSnapshot {
  capturedAt: string;
  visibleRecordingState: CoWorkingVisibleRecordingState;
  participants: CoWorkingRecordingConsentParticipant[];
}

export interface CoWorkingRecordingStartInput {
  projectId: string;
  zoneType: CoWorkingRecordingZoneType;
  sessionName?: string;
  captureScope: CoWorkingRecordingCaptureScope;
  consentSnapshot: CoWorkingRecordingConsentSnapshot;
  retentionPolicy?: string;
}

export interface CoWorkingProjectVaultRef {
  storage: 'project_vault';
  ref: string;
  prefix: string;
  key: string;
  version?: string | null;
  checksum?: string | null;
  status?: string;
}

export interface CoWorkingRecordingRawTrackRef {
  trackId: string;
  participantId: string;
  identityId?: string | null;
  kind: RealtimeTrackKind;
  objectKey: string;
  startedAt: string;
  stoppedAt: string | null;
  byteSize?: number | null;
  checksum?: string | null;
  providerStatus?: string;
}

export interface CoWorkingRecordingSession {
  id: string;
  callId: string;
  workspaceId: string;
  roomId: string;
  projectId: string;
  zoneType: CoWorkingRecordingZoneType;
  sessionName?: string | null;
  state: CoWorkingRecordingSessionState;
  captureScope: CoWorkingRecordingCaptureScope;
  consentSnapshot: CoWorkingRecordingConsentSnapshot;
  manifestRef: CoWorkingProjectVaultRef;
  rawTrackRefs: CoWorkingRecordingRawTrackRef[];
  composedPlaybackRef: CoWorkingProjectVaultRef | null;
  meetingRecordingRef?: string | null;
  startedAt: string;
  stoppedAt: string | null;
  finalizedAt: string | null;
}

// Phase 0.4.0 — Co-working surface (presence-first ambient view)
// FloorPresence is the per-employee tile shown in §01 · TODAY'S FLOOR.
// Computed server-side from realtime presence + active timer state.
export type CoWorkingRingState = 'timing' | 'online' | 'lounge' | 'idle';

export interface FloorPresence {
  participantId: string;
  displayName: string;
  initials: string; // 2-3 mono caps, e.g. "PK", "BR"
  ringState: CoWorkingRingState;
  roomId: string | null;
  roomName: string | null;
  projectTag: string | null; // e.g. "MAYDECK CRM · 47m"
  isSpeaking: boolean;
}

export interface RealtimeMeetingRecord {
  id: string;
  workspaceId: string;
  roomId: string;
  callSessionId: string;
  projectId: string | null;
  timeEntryId: string | null;
  title: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  manualNotes: string;
  decisions: unknown[];
  actionItems: unknown[];
  participantSnapshot: unknown[];
  linkedTimeEntryIds: string[];
  linkedIssueIds: string[];
  screenShareSummary: unknown[];
  paperclipStatus: 'not_requested' | 'queued' | 'sent' | 'failed';
  paperclipPayload: Record<string, unknown>;
  paperclipArtifactRef: string | null;
  transcriptRef: string | null;
  recordingRef: string | null;
  createdByIdentityId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlexusSettings {
  memberId: string;
  theme: 'light' | 'dark' | 'system';
  defaultProjectId?: string;
  reminderIntervalMinutes: number;
  syncEnabled: boolean;
  soundNotificationsEnabled: boolean;
  voiceBreakworkEnabled: boolean;
  notificationVolume: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  breakworkSnoozeMinutes: number;
  breakworkCategories: BreakworkCategory[];
  rhythmProfile: RhythmProfile;
  profile: MemberProfileSettings;
  agentSessionScanEnabled: boolean;
  agentSessionConsentAt?: string | null;
  assistantEnabled?: boolean;
  assistantModelProvider?: AssistantModelProvider;
  assistantGoogleModel?: string;
  assistantNvidiaModel?: string;
  assistantLocalModel?: string;
  assistantLocalBaseUrl?: string;
  assistantHasGoogleKey?: boolean;
  assistantHasNvidiaKey?: boolean;
  assistantGoogleApiKey?: string;
  assistantNvidiaApiKey?: string;
  assistantClearGoogleKey?: boolean;
  assistantClearNvidiaKey?: boolean;
  assistantSessionScanEnabled?: boolean;
  assistantPaperclipEnrichmentEnabled?: boolean;
}

export interface TimerState {
  running: boolean;
  paused?: boolean;
  entryId?: string;
  startTime?: string;
  projectId?: string;
  description?: string;
  activeSeconds?: number;
  targetSeconds?: number;
  pausedAt?: string;
  pausedSeconds?: number;
}

export type TodayProofRisk = 'clear' | 'needs_project' | 'needs_evidence' | 'sync_attention';
export type TodaySourceState = 'ready' | 'unavailable';
export type TodayActionTone = 'accent' | 'mint' | 'warning' | 'error' | 'idle';

export interface TodaySourceHealth {
  state: TodaySourceState;
  checkedAt: string;
  message?: string;
}

export interface TodayTimerSnapshot {
  running: boolean;
  paused: boolean;
  entryId: string | null;
  projectId: string | null;
  projectName: string | null;
  description: string | null;
  activeSeconds: number;
  targetSeconds: number | null;
  raw: TimerState;
}

export interface TodayProofSnapshot {
  status: ProofStatus;
  risk: TodayProofRisk;
  missingEvidenceEntries: number;
  evidencedEntries: number;
  legacyUnverifiedEntries: number;
  syncFailedEntries: number;
  unverifiedProjectCount: number;
  verifiedProjectCount: number;
  summary: WorkEvidenceSummary;
}

export interface TodayStandupSnapshot {
  state: 'ready' | 'needed' | 'unavailable';
  compliant: boolean | null;
  todaySeconds: number | null;
  weekSeconds: number | null;
  source: 'persisted_evidence' | 'unavailable';
  message?: string;
}

export interface TodayAssistantSnapshot {
  availability: AssistantAvailability | 'unknown';
  enabled: boolean | null;
  state: string;
  modelProvider: AssistantConfiguredModelProvider | AssistantModelProvider | null;
  selectedModelId: string | null;
  configuredProviderCount: number;
  degraded: boolean;
  message?: string;
}

export interface TodayAgentSessionSnapshot {
  enabled: boolean | null;
  pending: number;
  ready: number;
  matched: number;
  needsProject: number;
}

export interface TodayAssignmentSnapshot {
  taskId: string;
  title: string;
  status: ThoughtseedFabricTaskStatus;
  source: ThoughtseedFabricTask['source'] | 'unknown';
  proofRequired: string | null;
  proofStatus: ProofStatus | null;
  nextAction: string;
  projectId: string | null;
  projectName: string | null;
  workMode: ThoughtseedFabricTaskWorkMode | null;
  evidenceStrength: ThoughtseedFabricEvidenceStrength;
  updatedAt: string;
}

export interface TodayAssignmentAggregateSnapshot {
  activeCount: number;
  current: TodayAssignmentSnapshot | null;
}

export interface TodayRoomSnapshot {
  roomId: string;
  roomType: RealtimeRoomType;
  name: string;
  projectId: string | null;
  projectName: string | null;
  observedState: 'active_call' | 'screen_share' | 'presence' | 'quiet';
  joinState: 'unknown' | 'presence_only' | 'not_joined';
  participantCount: number;
  screenShareCount: number;
  activeCall: boolean;
  lastActivityAt: string;
}

export interface TodayRoomAggregateSnapshot {
  activeCount: number;
  current: TodayRoomSnapshot | null;
}

export interface TodaySuggestionSnapshot {
  id: string;
  title: string;
  detail: string;
  source: 'assistant' | 'temperance';
  safety: AssistantToolSafety;
  confidence: number;
  rationale: string;
  taskId?: string;
  toolId?: AssistantToolId;
  routeKey?: AssistantRouteKey;
  skillHint?: string;
}

export interface TodayActionSnapshot {
  id: string;
  title: string;
  detail: string;
  tone: TodayActionTone;
  routeKey?: AssistantRouteKey;
}

export interface TodaySnapshot {
  date: string;
  generatedAt: string;
  timer: TodayTimerSnapshot;
  entries: TimeEntry[];
  projects: Project[];
  tasks: ThoughtseedFabricTask[];
  totals: {
    trackedSeconds: number;
    activeSeconds: number;
    entryCount: number;
    projectCount: number;
    activeTaskCount: number;
  };
  proof: TodayProofSnapshot;
  standup: TodayStandupSnapshot;
  assistant: TodayAssistantSnapshot;
  sessions: TodayAgentSessionSnapshot;
  assignments: TodayAssignmentAggregateSnapshot;
  rooms: TodayRoomAggregateSnapshot;
  suggestions: TodaySuggestionSnapshot[];
  sourceHealth: {
    core: TodaySourceHealth;
    fabricTasks: TodaySourceHealth;
    standup: TodaySourceHealth;
    assistant: TodaySourceHealth;
    agentSessions: TodaySourceHealth;
    realtimeRooms: TodaySourceHealth;
    recommendations: TodaySourceHealth;
  };
  nextActions: TodayActionSnapshot[];
}

export type UpdateState =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  channel: string;
  feedUrl?: string;
  availableVersion?: string;
  releaseDate?: string;
  percent?: number;
  transferredBytes?: number;
  totalBytes?: number;
  message?: string;
  error?: string;
  updatedAt: string;
  canCheck: boolean;
  canDownload: boolean;
  canInstall: boolean;
}

export type AssistantAvailability = 'ready' | 'needs_model_key' | 'offline_suggestions' | 'disabled';

export interface AssistantStatus {
  ok: boolean;
  state: string;
  enabled: boolean;
  availability: AssistantAvailability;
  checkedAt: string;
  model: AssistantModelStatus;
  offlineSuggestionsAvailable: boolean;
  needsModelKey: boolean;
  message?: string;
}

export interface AssistantAskResult {
  ok: boolean;
  conversationId: string;
  eventCount: number;
  done: boolean;
  error?: string;
}

export interface AssistantSuggestionsRequest {
  conversationId?: string;
  contextScopes?: AssistantContextScope[];
  projectId?: string;
  maxSuggestions?: number;
  limit?: number;
}

export interface AssistantIntentActionResult {
  intentId: string;
  status: AssistantIntentStatus;
  toolId?: AssistantToolId;
  result?: Record<string, unknown>;
}

export interface AssistantContextBudgetDiagnostic {
  limit: number;
  totalItems: number;
  droppedItems: number;
}

export type AssistantContextSourceDiagnosticState = 'ready' | 'skipped' | 'failed';

export interface AssistantContextSourceDiagnostic {
  state: AssistantContextSourceDiagnosticState;
  checkedAt: string;
  itemCount?: number;
  message?: string;
  error?: string;
}

export interface AssistantTaskContextSummary {
  taskId: string;
  title: string;
  description?: string;
  projectId?: string | null;
  projectName?: string | null;
  workEntryId?: string | null;
  status: ThoughtseedFabricTaskStatus;
  workMode?: ThoughtseedFabricTaskWorkMode | null;
  proofStatus?: ProofStatus;
  evidenceStrength: ThoughtseedFabricEvidenceStrength;
  evidenceCount: number;
  conflictCount: number;
  correlationId?: string | null;
  updatedAt: string;
}

export interface AssistantContextDiagnosticsSnapshot {
  generatedAt: string;
  requestedScopes: AssistantContextScope[];
  dateRange: {
    scope: 'today' | 'week' | 'month';
    from: string;
    to: string;
  };
  budget: Record<string, AssistantContextBudgetDiagnostic>;
  sourceHealth: Record<string, AssistantContextSourceDiagnostic>;
  taskSummaries: AssistantTaskContextSummary[];
}

export type AssistantDailyOutboxStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'failed';

export interface AssistantDailyOutboxEventDiagnostic {
  id: string;
  date: string;
  status: AssistantDailyOutboxStatus;
  error: string | null;
  artifactRef: string | null;
  createdAt: string;
  updatedAt: string;
  nextRetryAt: string | null;
  retryable: boolean;
}

export interface AssistantDailyOutboxDiagnostics {
  checkedAt: string;
  counts: Record<AssistantDailyOutboxStatus, number>;
  dueRetryCount: number;
  events: AssistantDailyOutboxEventDiagnostic[];
}

export type AssistantModelUsageStatus = 'succeeded' | 'failed';

export interface AssistantModelUsageRecord {
  id: string;
  conversationId: string | null;
  provider: AssistantConfiguredModelProvider;
  model: string;
  status: AssistantModelUsageStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  finishReason: string | null;
  failureKind: string | null;
  fallback: boolean;
  primaryProvider: AssistantConfiguredModelProvider | null;
  finalProvider: AssistantConfiguredModelProvider | null;
  attemptCount: number;
  metadata: Record<string, unknown>;
}

export type AppWindowMode = 'standard' | 'compact';

export interface AppWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppWindowModeState {
  mode: AppWindowMode;
  bounds: AppWindowBounds;
  alwaysOnTop: boolean;
}

export interface PlexusAPI {
  appWindowModeGet: () => Promise<AppWindowModeState>;
  appWindowModeSet: (mode: AppWindowMode) => Promise<AppWindowModeState>;
  todaySnapshot: () => Promise<TodaySnapshot>;
  adminProofCockpitSnapshot: () => Promise<AdminProofCockpitSnapshot>;
  adminProofCockpitOpenDrilldown: (id: AdminProofOpsDrilldownTarget) => Promise<AdminProofOpsDrilldownOpenResult>;

  timerStart: (projectId: string, description: string, targetSeconds?: number) => Promise<TimeEntry>;
  timerStop: () => Promise<TimeEntry | null>;
  timerPause: () => Promise<TimerState>;
  timerResume: () => Promise<TimerState>;
  timerGetState: () => Promise<TimerState>;

  entryList: (from: string, to: string) => Promise<TimeEntry[]>;
  entryCreate: (entry: Omit<TimeEntry, 'id' | 'durationSeconds'>) => Promise<TimeEntry>;
  entryUpdate: (id: string, patch: Partial<TimeEntry>) => Promise<TimeEntry>;
  entryDelete: (id: string) => Promise<void>;

  projectList: () => Promise<Project[]>;
  projectCreate: (project: Omit<Project, 'id' | 'createdAt'>) => Promise<Project>;
  projectUpdate: (id: string, patch: Partial<Project>) => Promise<Project>;
  projectDelete: (id: string) => Promise<void>;
  githubConnectionStatus: () => Promise<GitHubConnectionStatus>;
  githubConnectStart: (accountId: number) => Promise<GitHubConnectStartResult>;
  githubActorStatus: () => Promise<GitHubActorStatus>;
  githubActorEnrollStart: () => Promise<GitHubActorEnrollStartResult>;
  githubFounderSetupIntent: () => Promise<FounderGitHubSetupIntent | null>;
  onGitHubFounderSetupRequested: (callback: (intent: FounderGitHubSetupIntent) => void) => () => void;
  githubConnectionReturnIntent: () => Promise<GitHubConnectionReturnIntent | null>;
  onGitHubConnectionReturnRequested: (callback: (intent: GitHubConnectionReturnIntent) => void) => () => void;
  githubRepositories: () => Promise<GitHubRepositoryListResult>;
  projectVerifyRepo: (projectId: string, installationId: number, repositoryId: number) => Promise<ProjectRepoVerification>;
  projectScanVault: () => Promise<VaultProjectScanResult>;
  projectImportVault: () => Promise<VaultProjectScanResult>;

  agentSessionStatus: () => Promise<AgentSessionScanResult>;
  agentSessionScan: () => Promise<AgentSessionScanResult>;
  agentSessionSetConsent: (enabled: boolean) => Promise<PlexusSettings>;
  agentSessionAccept: (input: AgentSessionAcceptInput) => Promise<TimeEntry>;
  agentSessionDismiss: (candidateId: string) => Promise<void>;

  reportDaily: (date: string) => Promise<DailyReport>;
  reportDailyProofPacket: (date: string) => Promise<DailyProofPacket>;
  reportWeekly: (weekStart: string) => Promise<WeeklyReport>;
  reportMonthly: (month: string) => Promise<MonthlyReport>;
  evidenceStatus: (from: string, to: string) => Promise<WorkEvidenceSummary>;
  githubActivitySync: (projectId: string, from: string, to: string) => Promise<GitHubActivitySyncResult>;
  standupGenerate: (date: string) => Promise<StandupEvidenceRecord>;
  reviewGenerate: (kind: 'weekly' | 'monthly', periodStart: string) => Promise<ReviewCycle>;
  breakworkGeneratePrompt: (input: { category: BreakworkCategory; triggerReason: string }) => Promise<BreakworkPrompt>;
  assistantStatus: () => Promise<AssistantStatus>;
  assistantAsk: (request: AssistantTurnRequest) => Promise<AssistantAskResult>;
  assistantSuggestions: (input?: AssistantSuggestionsRequest) => Promise<AssistantSuggestion[]>;
  assistantConfirmIntent: (intentId: string) => Promise<AssistantIntentActionResult>;
  assistantCancelIntent: (intentId: string) => Promise<AssistantIntentActionResult>;
  onAssistantEvent: (callback: (event: AssistantStreamEvent) => void) => () => void;

  settingsGet: () => Promise<PlexusSettings>;
  settingsSet: (settings: Partial<PlexusSettings>) => Promise<PlexusSettings>;
  assistantModelStatus: () => Promise<AssistantModelStatus>;
  assistantModelSetConfig: (input: AssistantModelSettingsInput) => Promise<AssistantModelStatus>;
  assistantModelHealth: (input?: AssistantModelHealthRequest) => Promise<AssistantModelHealthResult>;
  assistantModelCatalog: () => Promise<AssistantModelCatalog>;
  assistantContextDiagnostics: () => Promise<AssistantContextDiagnosticsSnapshot>;
  assistantDailyOutbox: () => Promise<AssistantDailyOutboxDiagnostics>;
  assistantRetryDailyOutboxEvent: (eventId?: string) => Promise<{ attempted: number; sent: number; failed: number }>;
  assistantModelUsage: () => Promise<AssistantModelUsageRecord[]>;

  updatesGetStatus: () => Promise<UpdateStatus>;
  updatesCheck: () => Promise<UpdateStatus>;
  updatesDownload: () => Promise<UpdateStatus>;
  updatesInstall: () => Promise<UpdateStatus>;
  onUpdatesStatus: (callback: (status: UpdateStatus) => void) => () => void;

  onTimerTick: (callback: (state: TimerState) => void) => () => void;
  onIdleDetected: (callback: (data: { idleDuration: number; activeDuration: number; entryId: string }) => void) => () => void;
  idleAction: (entryId: string, action: 'keep' | 'discard' | 'trim', idleMs: number) => Promise<void>;

  backupList: () => Promise<{ name: string; path: string; size: number; date: string }[]>;
  backupRestore: (path: string) => Promise<boolean>;
  backupRun: () => Promise<void>;

  // Work coordination control planes
  workerConfigGet: () => Promise<WorkerConfig>;
  workerConfigSet: (cfg: { baseUrl?: string; workspaceId?: string; token?: string }) => Promise<WorkerConfig>;
  workerStatus: () => Promise<{ connected: boolean; message?: string }>;
  thoughtseedBridgeStatus: () => Promise<ThoughtseedBridgeStatus>;
  thoughtseedRedeemInvite: (input: { invite: string }) => Promise<ThoughtseedBridgeRedeemResult>;
  thoughtseedSendHeartbeat: () => Promise<ThoughtseedBridgeHeartbeatResult>;
  thoughtseedPollDirectives: () => Promise<ThoughtseedBridgePollResult>;
  thoughtseedAckDirectives: (ids: string[]) => Promise<ThoughtseedBridgeAckResult>;
  thoughtseedRotateBridgeToken: () => Promise<ThoughtseedBridgeRotateResult>;
  thoughtseedDisconnectBridge: () => Promise<ThoughtseedBridgeStatus>;
  thoughtseedFabricTasks: () => Promise<ThoughtseedFabricTaskListResult>;
  thoughtseedDispatchLanes: () => Promise<TemperanceDispatchLaneStatusResult>;
  thoughtseedSyncFabricTasks: () => Promise<ThoughtseedFabricTaskSyncResult>;
  thoughtseedSetFabricTaskWorkMode: (taskId: string, workMode: ThoughtseedFabricTaskWorkMode) => Promise<ThoughtseedFabricWorkModeResult>;
  thoughtseedReportFabricTask: (input: ThoughtseedFabricTaskReportInput) => Promise<ThoughtseedFabricTaskReportResult>;
  authLogin: (email: string) => Promise<{ ok: boolean; session?: Session; message?: string }>;
  authAccessLogin: () => Promise<{ ok: boolean; session?: Session; message?: string }>;
  authSession: () => Promise<Session | null>;
  authRefreshSession: () => Promise<{ ok: boolean; session?: Session; message?: string }>;
  authLogout: () => Promise<void>;
  projectsSync: () => Promise<{ ok: boolean; count: number; message?: string }>;
  onboardingUpdate: (stepId: string, state: OnboardingStateValue, metadata?: Record<string, unknown>) => Promise<{ ok: boolean; session?: Session; message?: string }>;
  adminDemoOverview: () => Promise<{ ok: boolean; overview?: AdminDemoOverview; message?: string }>;
  adminDemoOnboardingUpdate: (identityId: string, stepId: string, state: OnboardingStateValue, metadata?: Record<string, unknown>) => Promise<{ ok: boolean; overview?: AdminDemoOverview; message?: string }>;

  // Phase 6 — Agent Fabric Health
  fabricStatus: () => Promise<FabricStatus>;
  fabricHealthProbe: () => Promise<FabricStatus>;
  fabricInstallStatus: () => Promise<PaperclipInstallStatus>;

  // Phase 14 — Realtime Capture Capability Proof
  mediaCaptureStatus: () => Promise<MediaCaptureStatus>;
  mediaRequestAccess: (kind: MediaRequestKind) => Promise<MediaCaptureStatus>;
  mediaOpenPrivacySettings: (kind: MediaCaptureKind) => Promise<void>;
  realtimeRooms: () => Promise<{ ok: boolean; rooms: RealtimeRoom[]; message?: string }>;
  realtimeRoomDetail: (roomId: string) => Promise<{ ok: boolean; detail?: RealtimeRoomDetail; message?: string }>;
  realtimeJoinRoom: (roomId: string, input: RealtimeJoinInput) => Promise<{ ok: boolean; joined?: RealtimeJoinResponse; message?: string }>;
  realtimePublishTrack: (callId: string, input: RealtimeTrackInput) => Promise<{ ok: boolean; track?: RealtimeMediaTrack; cloudflare?: { appId: string | null; stunUrls: string[]; negotiation: string }; message?: string }>;
  realtimeCloseTrack: (callId: string, trackId: string) => Promise<{ ok: boolean; message?: string }>;
  realtimeLeaveCall: (callId: string, participantId: string) => Promise<{ ok: boolean; ended?: boolean; message?: string }>;
  realtimeEndCall: (callId: string) => Promise<{ ok: boolean; message?: string }>;
  realtimeCloseout: (callId: string, payload: RealtimeCloseoutPayload) => Promise<{ ok: boolean; meeting?: RealtimeMeetingRecord; message?: string }>;
  recordingStart: (roomId: string, input: CoWorkingRecordingStartInput) => Promise<{ ok: boolean; recording?: CoWorkingRecordingSession; message?: string }>;
  recordingStop: (recordingId: string) => Promise<{ ok: boolean; recording?: CoWorkingRecordingSession; message?: string }>;
  recordingFinalize: (recordingId: string) => Promise<{ ok: boolean; manifest?: CoWorkingProjectVaultRef; message?: string }>;

  // Phase 0.4.0 — Co-working surface (Phase C wires these handlers in main)
  coworkingFloor: () => Promise<{ ok: boolean; floor: FloorPresence[]; message?: string }>;
  coworkingLounge: () => Promise<{ ok: boolean; room?: RealtimeRoom; message?: string }>;

  // Phase 7 — Member Provisioning
  memberProvision: () => Promise<{ ok: boolean; bundle?: MemberProvisionBundle; message?: string }>;
  memberSetup: () => Promise<{ ok: boolean; output?: string; message?: string }>;

  // Phase 8 — Standup + KPI
  memberKpi: () => Promise<MemberKpiSummary>;

  // Phase 9 — Preferences
  memberPreferencesGet: () => Promise<Record<string, unknown>>;
  memberPreferencesSet: (prefs: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>;
  emitUsageSignal: (signal: UsageSignal) => Promise<{ ok: boolean }>;

  // App-wide resilience handoffs
  handoffList: (status?: HandoffStatus) => Promise<HandoffRecord[]>;
  handoffRecord: (input: HandoffInput) => Promise<HandoffRecord>;
  handoffRetry: (id: string) => Promise<HandoffRecord>;
}

declare global {
  interface Window {
    plexus: PlexusAPI;
  }
}
