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
}

export interface Project {
  id: string;
  name: string;
  clientName?: string;
  color: string;
  archived: boolean;
  createdAt: string;
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

export interface DailyReport {
  date: string;
  entries: TimeEntry[];
  totalSeconds: number;}

export interface WeeklyReport {
  weekStart: string;
  days: DailyReport[];
  totalSeconds: number;}

export interface MonthlyReport {
  month: string;
  weeks: WeeklyReport[];
  totalSeconds: number;  projectBreakdown: Record<string, number>;
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

export interface MemberProvisionBundle {
  memberId: string;
  memberName: string;
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
  checkedAt: string;
  ports: PortStatus[];
  agents: AgentHealth[];
  summary: {
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
  vault: {
    standups: number;
    handoffs: number;
  };
  shellHealthCheck?: {
    ok: boolean;
    exitCode: number | null;
    output: string;
  };
  standup?: StandupData;
  kpi?: MemberKpiSummary;
  install?: PaperclipInstallStatus;
  org?: OrgConfig;
  taskFeed?: TaskFeedStatus;
}

/* ── G1/G8: Paperclip Install Detection ──────────────────── */

export interface PaperclipInstallStatus {
  binaryFound: boolean;
  binaryPath?: string;
  repoFound: boolean;
  repoRoot?: string;
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

/* ── G3: Org config from manifest.yaml ───────────────────── */

export interface OrgDepartment {
  key: string;
  name: string;
  icon: string;
  lead: string;
  description: string;
}

export interface OrgConfig {
  orgName: string;
  version: string;
  departments: OrgDepartment[];
  coordinationMethod: string;
  heartbeat: string;
  standup?: {
    time: string;
    aggregator: string;
    dispatcher: string;
  };
}

/* ── G4: Per-agent skill info ────────────────────────────── */

export interface AgentSkillInfo {
  agentId: string;
  agentName: string;
  department: string;
  skills: string[];
  routingTags: string[];
}

/* ── G5/G6: Standup + task feed status ───────────────────── */

export interface TaskFeedStatus {
  feedSyncConfigured: boolean;
  feedSyncScript?: string;
  lastFeedFile?: string;
  lastFeedAt?: string;
  pendingTasks: number;
}

/* ── G7: Project detail enrichment from vault ────────────── */

export interface ProjectVaultDetail {
  projectCode: string;
  contextFiles: string[];
  decisionFiles: string[];
  handoffFiles: string[];
  inboxFiles: string[];
  totalFiles: number;
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

export interface PlexusAPI {
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

  reportDaily: (date: string) => Promise<DailyReport>;
  reportWeekly: (weekStart: string) => Promise<WeeklyReport>;
  reportMonthly: (month: string) => Promise<MonthlyReport>;

  settingsGet: () => Promise<PlexusSettings>;
  settingsSet: (settings: Partial<PlexusSettings>) => Promise<PlexusSettings>;

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

  // TeamForge control plane (Phase 1)
  workerConfigGet: () => Promise<WorkerConfig>;
  workerConfigSet: (cfg: { baseUrl?: string; workspaceId?: string; token?: string }) => Promise<WorkerConfig>;
  workerStatus: () => Promise<{ connected: boolean; message?: string }>;
  authLogin: (email: string) => Promise<{ ok: boolean; session?: Session; message?: string }>;
  authAccessLogin: () => Promise<{ ok: boolean; session?: Session; message?: string }>;
  authSession: () => Promise<Session | null>;
  authRefreshSession: () => Promise<{ ok: boolean; session?: Session; message?: string }>;
  authLogout: () => Promise<void>;
  authTestJwt: () => Promise<{ ok: boolean; message?: string }>;
  projectsSync: () => Promise<{ ok: boolean; count: number; message?: string }>;
  onboardingUpdate: (stepId: string, state: OnboardingStateValue, metadata?: Record<string, unknown>) => Promise<{ ok: boolean; session?: Session; message?: string }>;
  adminDemoOverview: () => Promise<{ ok: boolean; overview?: AdminDemoOverview; message?: string }>;
  adminDemoOnboardingUpdate: (identityId: string, stepId: string, state: OnboardingStateValue, metadata?: Record<string, unknown>) => Promise<{ ok: boolean; overview?: AdminDemoOverview; message?: string }>;

  // Phase 6 — Agent Fabric Health
  fabricStatus: () => Promise<FabricStatus>;
  fabricHealthProbe: () => Promise<FabricStatus>;
  fabricInstallStatus: () => Promise<PaperclipInstallStatus>;
  fabricOrgConfig: () => Promise<OrgConfig | null>;
  fabricAgentSkills: () => Promise<AgentSkillInfo[]>;
  fabricProjectVault: (projectCode: string) => Promise<ProjectVaultDetail | null>;
  fabricAllProjectVaults: () => Promise<ProjectVaultDetail[]>;
  fabricTaskFeed: () => Promise<TaskFeedStatus>;

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

  // Phase 7 — Member Provisioning
  memberProvision: () => Promise<{ ok: boolean; bundle?: MemberProvisionBundle; message?: string }>;
  memberSetup: () => Promise<{ ok: boolean; output?: string; message?: string }>;

  // Phase 8 — Standup + KPI
  memberKpi: () => Promise<MemberKpiSummary>;

  // Phase 9 — Preferences
  memberPreferencesGet: () => Promise<Record<string, unknown>>;
  memberPreferencesSet: (prefs: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>;
  emitUsageSignal: (signal: UsageSignal) => Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    plexus: PlexusAPI;
  }
}
