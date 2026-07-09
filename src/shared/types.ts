import type {
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
}

export type RepoEvidenceStatus = 'missing' | 'unverified' | 'verified' | 'inaccessible' | 'legacy_unverified';
export type WorkEvidenceStatus = 'pending' | 'matched' | 'missing' | 'legacy_unverified' | 'sync_failed';
export type GitHubActivityKind = 'commit' | 'pull_request' | 'issue' | 'issue_comment' | 'review' | 'branch' | 'release' | 'file_change';
export type BreakworkCategory = 'mental_reset' | 'physical_reset' | 'eye_rest' | 'breathwork' | 'mobility' | 'hydration' | 'meeting_decompression' | 'transition';

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
  id?: string | null;
  fullName: string;
  url: string;
  source: 'worker' | 'project_cache' | 'manual';
  verifiedAt?: string | null;
}

export interface ProjectRepoVerification {
  ok: boolean;
  project?: Project;
  repo?: GitHubRepoOption;
  status: RepoEvidenceStatus;
  message?: string;
  remoteVerified?: boolean;
}

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

export interface StandupEvidenceRecord {
  id: string;
  date: string;
  totalSeconds: number;
  evidenceSummary: WorkEvidenceSummary;
  activity: GitHubActivity[];
  generatedAt: string;
}

export interface ReviewCycle {
  id: string;
  kind: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  evidenceSummary: WorkEvidenceSummary;
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
  proofStatus: ProofStatus;
}

export interface WeeklyReport {
  weekStart: string;
  days: DailyReport[];
  totalSeconds: number;
  entryCount: number;
  projectBreakdown: Record<string, number>;
  evidenceSummary: WorkEvidenceSummary;
  proofStatus: ProofStatus;
}

export interface MonthlyReport {
  month: string;
  weeks: WeeklyReport[];
  totalSeconds: number;
  entryCount: number;
  projectBreakdown: Record<string, number>;
  evidenceSummary: WorkEvidenceSummary;
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
  | 'assistant_daily_event';

export type ProofCustodyEvidenceType =
  | 'summary'
  | 'report'
  | 'standup'
  | 'review'
  | 'github_pr'
  | 'github_commit'
  | 'github_branch'
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
  multica?: {
    apiUrl?: string;
    appUrl?: string;
    workspaceId?: string;
  };
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
    source: 'assistant_worker' | 'assistant_local_queue';
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
  source: 'member_kpi' | 'unavailable';
  message?: string;
}

export interface TodayAssistantSnapshot {
  availability: AssistantAvailability | 'unknown';
  enabled: boolean | null;
  message?: string;
}

export interface TodayAgentSessionSnapshot {
  enabled: boolean | null;
  pending: number;
  ready: number;
  matched: number;
  needsProject: number;
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
  sourceHealth: {
    core: TodaySourceHealth;
    fabricTasks: TodaySourceHealth;
    standup: TodaySourceHealth;
    assistant: TodaySourceHealth;
    agentSessions: TodaySourceHealth;
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

export interface PlexusAPI {
  todaySnapshot: () => Promise<TodaySnapshot>;

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
  projectRepoOptions: (projectId?: string) => Promise<GitHubRepoOption[]>;
  projectVerifyRepo: (projectId: string, repoUrl: string) => Promise<ProjectRepoVerification>;
  projectScanVault: () => Promise<VaultProjectScanResult>;
  projectImportVault: () => Promise<VaultProjectScanResult>;

  agentSessionStatus: () => Promise<AgentSessionScanResult>;
  agentSessionScan: () => Promise<AgentSessionScanResult>;
  agentSessionSetConsent: (enabled: boolean) => Promise<PlexusSettings>;
  agentSessionAccept: (candidateId: string) => Promise<TimeEntry>;
  agentSessionDismiss: (candidateId: string) => Promise<void>;

  reportDaily: (date: string) => Promise<DailyReport>;
  reportWeekly: (weekStart: string) => Promise<WeeklyReport>;
  reportMonthly: (month: string) => Promise<MonthlyReport>;
  evidenceStatus: (from: string, to: string) => Promise<WorkEvidenceSummary>;
  githubActivitySync: (projectId: string, from: string, to: string) => Promise<{ ok: boolean; activity: GitHubActivity[]; message?: string }>;
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
  thoughtseedRedeemInvite: (input: { invite: string; bridgeApiUrl?: string }) => Promise<ThoughtseedBridgeRedeemResult>;
  thoughtseedSendHeartbeat: () => Promise<ThoughtseedBridgeHeartbeatResult>;
  thoughtseedPollDirectives: () => Promise<ThoughtseedBridgePollResult>;
  thoughtseedAckDirectives: (ids: string[]) => Promise<ThoughtseedBridgeAckResult>;
  thoughtseedRotateBridgeToken: () => Promise<ThoughtseedBridgeRotateResult>;
  thoughtseedDisconnectBridge: () => Promise<ThoughtseedBridgeStatus>;
  thoughtseedFabricTasks: () => Promise<ThoughtseedFabricTaskListResult>;
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
