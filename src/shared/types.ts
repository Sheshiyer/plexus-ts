export interface TimeEntry {
  id: string;
  projectId: string;
  description: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  tags: string[];
  source: 'manual' | 'timer';
  syncedAt?: string;
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

export interface Session {
  employee: Employee;
  workspaceId: string;
  email: string;
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
  entryId?: string;
  startTime?: string;
  projectId?: string;
  description?: string;
}

export interface PlexusAPI {
  timerStart: (projectId: string, description: string) => Promise<TimeEntry>;
  timerStop: () => Promise<TimeEntry | null>;
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
  authLogout: () => Promise<void>;
  projectsSync: () => Promise<{ ok: boolean; count: number; message?: string }>;

  // Phase 6 — Agent Fabric Health
  fabricStatus: () => Promise<FabricStatus>;
  fabricHealthProbe: () => Promise<FabricStatus>;

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
