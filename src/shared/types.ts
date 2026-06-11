export interface TimeEntry {
  id: string;
  projectId: string;
  description: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  tags: string[];
  billable: boolean;
  source: 'manual' | 'timer';
  syncedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  clientName?: string;
  color: string;
  hourlyRate?: number;
  currency?: string;
  archived: boolean;
  createdAt: string;
}

export interface DailyReport {
  date: string;
  entries: TimeEntry[];
  totalSeconds: number;
  billableSeconds: number;
}

export interface WeeklyReport {
  weekStart: string;
  days: DailyReport[];
  totalSeconds: number;
  billableSeconds: number;
}

export interface MonthlyReport {
  month: string;
  weeks: WeeklyReport[];
  totalSeconds: number;
  billableSeconds: number;
  projectBreakdown: Record<string, number>;
}

export interface PaperclipSyncPayload {
  memberId: string;
  entries: TimeEntry[];
  reportMonth: string;
  generatedAt: string;
}

export interface MultiCAMessage {
  type: 'time_report' | 'status_ping' | 'directive_response';
  memberId: string;
  payload: unknown;
  timestamp: string;
  hmac?: string;
}

export interface BridgeConfig {
  multicaApiUrl: string;
  multicaToken: string;
  paperclipPath: string;
  teamforgeFeedUrl?: string;
  r2Endpoint?: string;
  r2Bucket?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
}

export interface PlexusSettings {
  memberId: string;
  theme: 'light' | 'dark' | 'system';
  defaultProjectId?: string;
  reminderIntervalMinutes: number;
  syncEnabled: boolean;
  bridge: BridgeConfig;
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

  syncToPaperclip: (month: string) => Promise<{ success: boolean; message: string }>;
  pushToMultiCA: (month: string) => Promise<{ success: boolean; message: string }>;
  archiveToR2: (month: string) => Promise<{ success: boolean; url?: string }>;

  settingsGet: () => Promise<PlexusSettings>;
  settingsSet: (settings: Partial<PlexusSettings>) => Promise<PlexusSettings>;

  onTimerTick: (callback: (state: TimerState) => void) => () => void;
  onBridgeStatus: (callback: (status: { connected: boolean; lastSync?: string }) => void) => () => void;
}

declare global {
  interface Window {
    plexus: PlexusAPI;
  }
}
