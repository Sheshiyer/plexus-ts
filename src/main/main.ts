import { app, BrowserWindow, desktopCapturer, ipcMain, session, shell, systemPreferences } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { createTray, updateTrayMenu, destroyTray } from './tray.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';
import { startIdleDetection, stopIdleDetection, handleIdleAction } from './idle.js';
import { startFocusNudgeLoop, stopFocusNudgeLoop } from './focus-nudge.js';
import { startApiServer, stopApiServer } from './api-server.js';
import { startAutoBackup, stopAutoBackup } from './backup.js';
import { expectSinglePayload, guardedIpcHandle } from './ipc-security.js';
import { bindWindowObservability, installMainProcessObservability } from './observability.js';
import { redactForLog } from './redaction.js';
import { getFabricStatus, getPaperclipInstallStatus } from './fabric.js';
import { initAutoUpdates, getUpdateStatus, checkForUpdates, downloadUpdate, installUpdateAndRestart } from './updates.js';
import { assistantDateRange, buildAssistantContext, type AssistantContextSnapshot } from './assistant-context.js';
import { createElectronAssistantModelSecretStore } from './assistant-model-settings.js';
import {
  AssistantModelRouter,
  assistantModelHealth,
  assistantModelStatusFromConfig,
  createAssistantModelProviders,
  resolveAssistantModelConfig,
} from './assistant-models.js';
import { discoverAssistantModelCatalog } from './assistant-model-catalog.js';
import { createAssistantRuntime, type AssistantRuntimeContext } from './assistant-runtime.js';
import { listProactiveAssistantSuggestions } from './assistant-suggestions.js';
import { buildAdminProofCockpitSnapshot } from '../shared/admin-proof-cockpit.js';
import { buildTodaySnapshot } from '../shared/today-snapshot.js';
import {
  getTimerState,
  pauseRunningEntry,
  resumeRunningEntry,
  startTimerEntry,
  stopRunningEntry,
  timerStateFromEntry,
} from './timer-session.js';
import { assistantIntentExpiresAt, cancelAssistantIntent, confirmAssistantIntent, generateStandupEvidenceRecord } from './assistant-tools.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import {
  getDb, listProjects, insertProject, updateProject, deleteProject,
  getProject, listEntries, insertEntry, updateEntry, deleteEntry, getRunningEntry,
  getSetting, setSetting,
  getHandoff, listHandoffs, recordHandoff, updateHandoff,
  insertAssistantIntent, insertAssistantMessage,
  getDailyProofPacketByDate, insertBreakworkPrompt, listFabricTasks, listGitHubActivity, upsertDailyProofPacket, upsertFabricTask, upsertGitHubActivity, upsertProofCustodyRecord, upsertReviewCycle,
} from '../db/database.js';
import { computeEvidenceSummary, matchedActivitiesForEntry, provenanceForGitHubActivities } from './evidence.js';
import { buildDailyProofPacket, buildFabricTaskProofSummary, filterFabricTasksForEntries, upgradeFabricTasksWithGitHubEvidence } from './proof-report.js';
import type {
  AssistantAskResult,
  AssistantContextScope,
  AssistantIntentActionResult,
  AssistantModelCatalog,
  AssistantModelHealthRequest,
  AssistantModelHealthResult,
  AssistantModelProvider,
  AssistantModelSettingsInput,
  AssistantModelStatus,
  AssistantStatus,
  AssistantStreamEvent,
  AssistantSuggestion,
  AssistantSuggestionsRequest,
  AssistantTurnRequest,
  AdminProofCockpitSnapshot,
  HandoffInput,
  HandoffStatus,
  BreakworkCategory,
  BreakworkPrompt,
  DailyProofPacket,
  DailyReport,
  GitHubActivity,
  GitHubRepoOption,
  MediaCaptureKind,
  MediaCaptureStatus,
  MediaPermissionState,
  MediaRequestKind,
  MonthlyReport,
  OnboardingStateValue,
  ProofCustodySubjectType,
  TodaySnapshot,
  TimeEntry,
  Project,
  PlexusSettings,
  RealtimeCloseoutPayload,
  RealtimeJoinInput,
  RealtimeTrackInput,
  ReviewCycle,
  Session,
  StandupEvidenceRecord,
  ThoughtseedBridgeAckResult,
  ThoughtseedFabricTaskListResult,
  ThoughtseedFabricTaskReportInput,
  ThoughtseedFabricTaskReportResult,
  ThoughtseedFabricTaskSyncResult,
  ThoughtseedFabricTaskWorkMode,
  ThoughtseedFabricWorkModeResult,
  ThoughtseedBridgeHeartbeatResult,
  ThoughtseedBridgePollResult,
  ThoughtseedBridgeRedeemResult,
  ThoughtseedBridgeRotateResult,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricTask,
  TimerState,
  WeeklyReport,
  WorkEvidenceSummary,
} from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let allowedIpcRendererOrigin = isDev
  ? safeUrlOrigin(process.env.PLEXUS_DEV_SERVER_URL?.trim() || 'http://127.0.0.1:5173', 'http://127.0.0.1:5173')
  : 'file://';

installMainProcessObservability(app);

function guardedHandle<Args extends unknown[], Result>(
  channel: string,
  schema: ((args: readonly unknown[], channel: string) => Args) | undefined,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => Result | Promise<Result>,
): void {
  guardedIpcHandle(ipcMain, channel, {
    getAllowedRendererOrigin: () => allowedIpcRendererOrigin,
    getAllowedSenderId: () => mainWindow?.webContents.id,
    ...(schema ? { schema } : {}),
  }, handler);
}

async function activeAdminSession(): Promise<Session> {
  const { getSession } = await import('./teamforge.js');
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    throw new Error('An active admin session is required for this action.');
  }
  return session;
}

async function assertActiveAdminSession(): Promise<void> {
  await activeAdminSession();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else if (app.isReady()) {
      createWindow();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1180,
    minHeight: 760,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const devServerUrl = process.env.PLEXUS_DEV_SERVER_URL?.trim() || 'http://127.0.0.1:5173';
  const allowedRendererOrigin = isDev ? safeUrlOrigin(devServerUrl, 'http://127.0.0.1:5173') : 'file://';
  allowedIpcRendererOrigin = allowedRendererOrigin;

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openValidatedExternalUrl(url);
    return { action: 'deny' };
  });
  bindWindowObservability(mainWindow);

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedRendererNavigation(url, allowedRendererOrigin)) return;
    event.preventDefault();
    void openValidatedExternalUrl(url);
  });

  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    if (process.env.PLEXUS_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  initAutoUpdates(mainWindow);
}

function safeUrlOrigin(url: string, fallback: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return new URL(fallback).origin;
  }
}

function isAllowedRendererNavigation(url: string, allowedRendererOrigin: string): boolean {
  try {
    const parsed = new URL(url);
    if (allowedRendererOrigin === 'file://') return parsed.protocol === 'file:';
    return parsed.origin === allowedRendererOrigin;
  } catch {
    return false;
  }
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

async function openValidatedExternalUrl(url: string): Promise<void> {
  if (!isSafeExternalUrl(url)) {
    console.warn('[navigation] blocked external URL', url);
    return;
  }
  try {
    await shell.openExternal(url);
  } catch (err) {
    console.warn('[navigation] failed to open external URL', redactForLog(err));
  }
}

app.whenReady().then(async () => {
  await getDb();
  registerDisplayMediaHandler();
  createWindow();
  startTimerTicker();
  if (mainWindow) {
    createTray(mainWindow);
    registerShortcuts(mainWindow);
    startIdleDetection(mainWindow);
    startFocusNudgeLoop(mainWindow);
  }
  await startApiServer();
  startAutoBackup();
  setInterval(() => { import('./teamforge.js').then(m => m.flushTimeEntries()).catch(() => {}); }, 5 * 60 * 1000);
  import('./assistant-daily.js').then(m => m.flushAssistantDailyEvents()).catch(() => {});
  setInterval(() => { import('./assistant-daily.js').then(m => m.flushAssistantDailyEvents()).catch(() => {}); }, 5 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (timerInterval) clearInterval(timerInterval);
  destroyTray();
  unregisterShortcuts();
  stopIdleDetection();
  stopFocusNudgeLoop();
  stopApiServer();
  stopAutoBackup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  await stopRunningEntry();
});

let activeProjectId: string | null = null;

function startTimerTicker() {
  timerInterval = setInterval(async () => {
    const running = await getRunningEntry();
    if (running && mainWindow) {
      if (!activeProjectId) activeProjectId = running.projectId;
      mainWindow.webContents.send('timer:tick', timerStateFromEntry(running));
      await updateTrayMenu(mainWindow);
    } else {
      activeProjectId = null;
    }
  }, 1000);
}

async function recordOptionalFailure(input: HandoffInput): Promise<void> {
  try {
    await recordHandoff({ ...input, status: input.status ?? 'failed' });
  } catch (err) {
    console.warn('[handoff] failed to record optional failure', redactForLog(err));
  }
}

function hasVerifiedRepo(project: Project | null): boolean {
  if (!project) return false;
  if (project.repoRequired === false) return true;
  return Boolean(
    project.githubRepoUrl &&
    project.githubRepoFullName &&
    project.repoVerifiedAt &&
    project.repoEvidenceStatus !== 'inaccessible',
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value: unknown, label: string, maxLength = 512): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  const next = value.trim();
  if (!next) throw new Error(`${label} is required.`);
  if (next.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or less.`);
  return next;
}

function optionalString(value: unknown, label: string, maxLength = 2048): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  const next = value.trim();
  if (!next) return undefined;
  if (next.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or less.`);
  return next;
}

function optionalSettingString(value: unknown, label: string, maxLength = 2048): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  const next = value.trim();
  if (next.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or less.`);
  return next;
}

function safeMetadata(value: unknown, label = 'metadata'): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isPlainRecord(value)) throw new Error(`${label} must be an object.`);
  let encoded = '';
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new Error(`${label} must be serializable.`);
  }
  if (encoded.length > 4096) throw new Error(`${label} must be 4096 characters or less.`);
  return value;
}

function onboardingStateValue(value: unknown): OnboardingStateValue {
  if (value === 'required' || value === 'optional' || value === 'skipped' || value === 'deferred' || value === 'completed' || value === 'failed') {
    return value;
  }
  throw new Error('Onboarding state is invalid.');
}

function fabricTaskWorkModeValue(value: unknown): ThoughtseedFabricTaskWorkMode {
  if (value === 'manual' || value === 'delegated') return value;
  throw new Error('Fabric task work mode must be manual or delegated.');
}

function fabricTaskStatusValue(value: unknown): ThoughtseedFabricTaskReportInput['status'] {
  if (value === 'assigned' || value === 'seen' || value === 'in_progress' || value === 'blocked' || value === 'done') return value;
  throw new Error('Fabric task status is invalid.');
}

function fabricEvidenceTypeValue(value: unknown): NonNullable<ThoughtseedFabricTaskReportInput['evidence']>['type'] {
  if (value === 'github_pr'
    || value === 'github_commit'
    || value === 'github_branch'
    || value === 'deploy_url'
    || value === 'figma_url'
    || value === 'canva_url'
    || value === 'doc_url'
    || value === 'file_path'
    || value === 'note') return value;
  throw new Error('Fabric evidence type is invalid.');
}

function normalizeBridgeRedeemInput(value: unknown): { invite: string; bridgeApiUrl?: string } {
  if (!isPlainRecord(value)) throw new Error('Bridge invite payload is invalid.');
  return {
    invite: requiredString(value.invite, 'Invite token', 2048),
    bridgeApiUrl: optionalString(value.bridgeApiUrl, 'Bridge API URL', 2048),
  };
}

function normalizeWorkerConfigInput(value: unknown): { baseUrl?: string; workspaceId?: string; token?: string } {
  if (!isPlainRecord(value)) throw new Error('Worker config payload is invalid.');
  const config: { baseUrl?: string; workspaceId?: string; token?: string } = {};
  const baseUrl = optionalSettingString(value.baseUrl, 'Worker base URL', 2048);
  const workspaceId = optionalSettingString(value.workspaceId, 'Worker workspace id', 512);
  const token = optionalSettingString(value.token, 'Worker token', 8192);
  if (baseUrl !== undefined) config.baseUrl = baseUrl;
  if (workspaceId !== undefined) config.workspaceId = workspaceId;
  if (token !== undefined) config.token = token;
  return config;
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}

function optionalNullableSettingString(value: unknown, label: string, maxLength = 2048): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return optionalSettingString(value, label, maxLength);
}

function normalizeAssistantModelSettingsInput(value: unknown): AssistantModelSettingsInput {
  if (!isPlainRecord(value)) throw new Error('Assistant model settings payload is invalid.');
  const settings: AssistantModelSettingsInput = {};
  if (value.provider !== undefined) settings.provider = assistantModelProviderFromInput(value.provider);
  const googleModel = optionalSettingString(value.googleModel, 'Google model', 256);
  const nvidiaModel = optionalSettingString(value.nvidiaModel, 'NVIDIA model', 256);
  const localModel = optionalSettingString(value.localModel, 'Local model', 256);
  const localBaseUrl = optionalSettingString(value.localBaseUrl, 'Local model base URL', 2048);
  const googleApiKey = optionalNullableSettingString(value.googleApiKey, 'Google API key', 8192);
  const nvidiaApiKey = optionalNullableSettingString(value.nvidiaApiKey, 'NVIDIA API key', 8192);
  const clearGoogleKey = optionalBoolean(value.clearGoogleKey, 'Clear Google key');
  const clearNvidiaKey = optionalBoolean(value.clearNvidiaKey, 'Clear NVIDIA key');
  if (googleModel !== undefined) settings.googleModel = googleModel;
  if (nvidiaModel !== undefined) settings.nvidiaModel = nvidiaModel;
  if (localModel !== undefined) settings.localModel = localModel;
  if (localBaseUrl !== undefined) settings.localBaseUrl = localBaseUrl;
  if (googleApiKey !== undefined) settings.googleApiKey = googleApiKey;
  if (nvidiaApiKey !== undefined) settings.nvidiaApiKey = nvidiaApiKey;
  if (clearGoogleKey !== undefined) settings.clearGoogleKey = clearGoogleKey;
  if (clearNvidiaKey !== undefined) settings.clearNvidiaKey = clearNvidiaKey;
  return settings;
}

function normalizeDirectiveIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Directive ids must be a list.');
  const ids = value.map((id, index) => requiredString(id, `Directive id ${index + 1}`, 512));
  if (ids.length === 0) throw new Error('At least one directive id is required.');
  return [...new Set(ids)];
}

function normalizeFabricTaskReportInput(value: unknown): ThoughtseedFabricTaskReportInput {
  if (!isPlainRecord(value)) throw new Error('Fabric task report payload is invalid.');
  const report: ThoughtseedFabricTaskReportInput = {
    taskId: requiredString(value.taskId, 'Fabric task id', 512),
    status: fabricTaskStatusValue(value.status),
    note: optionalString(value.note, 'Fabric task note', 5000),
    blocker: optionalString(value.blocker, 'Fabric task blocker', 2000),
  };
  if (value.evidence !== undefined && value.evidence !== null) {
    if (!isPlainRecord(value.evidence)) throw new Error('Fabric evidence must be an object.');
    const evidenceValue = requiredString(value.evidence.value, 'Fabric evidence value', 2048);
    report.evidence = {
      type: fabricEvidenceTypeValue(value.evidence.type),
      value: evidenceValue,
      label: optionalString(value.evidence.label, 'Fabric evidence label', 160),
    };
  }
  return report;
}

async function requireVerifiedRepoProject(projectId: string): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error('Project not found in the local workspace cache. Sync projects before starting work.');
  if (!hasVerifiedRepo(project)) {
    const name = project.name || `Project ${projectId.slice(0, 8)}`;
    throw new Error(`${name} needs a verified GitHub repo before Plexus can create a work record.`);
  }
  return project;
}

async function refreshEntryEvidenceForProjectRange(projectId: string, from: string, to: string, activity?: GitHubActivity[]): Promise<number> {
  const checkedAt = new Date().toISOString();
  const [entries, cachedActivity] = await Promise.all([
    listEntries(from, to),
    activity ? Promise.resolve(activity) : listGitHubActivity(projectId, from, to),
  ]);
  let matched = 0;
  const matchedEntries: TimeEntry[] = [];
  for (const entry of entries.filter((item) => item.projectId === projectId)) {
    if (!entry.githubRepoFullName) {
      await updateEntry(entry.id, {
        evidenceStatus: 'legacy_unverified',
        evidenceCheckedAt: checkedAt,
        githubActivityIds: [],
        evidenceProvenance: [],
      });
      continue;
    }
    const matches = matchedActivitiesForEntry(entry, cachedActivity, new Date(checkedAt));
    const ids = matches.map((item) => item.id);
    const evidenceProvenance = provenanceForGitHubActivities(matches, checkedAt);
    if (ids.length > 0) matched += 1;
    if (ids.length > 0) {
      matchedEntries.push({
        ...entry,
        evidenceStatus: 'matched',
        evidenceCheckedAt: checkedAt,
        githubActivityIds: ids,
        evidenceProvenance,
      });
    }
    await updateEntry(entry.id, {
      evidenceStatus: ids.length > 0 ? 'matched' : 'missing',
      evidenceCheckedAt: checkedAt,
      githubActivityIds: ids,
      evidenceProvenance,
    });
  }
  if (matchedEntries.length > 0) {
    const tasks = await listFabricTasks({ projectId, limit: 1000 });
    const upgradedTasks = upgradeFabricTasksWithGitHubEvidence({
      tasks,
      entries: matchedEntries,
      activity: cachedActivity,
      checkedAt,
    });
    for (const task of upgradedTasks) {
      await upsertFabricTask(task);
      for (const evidence of task.evidence.filter((item) => item.source === 'github' && item.addedAt === checkedAt)) {
        await upsertProofCustodyRecord({
          subjectType: 'fabric_task',
          subjectId: task.taskId,
          proofStatus: 'verified',
          evidenceType: evidence.type,
          strength: evidence.strength ?? task.evidenceStrength,
          artifactRef: evidence.value,
          payload: {
            taskId: task.taskId,
            workEntryId: task.workEntryId ?? null,
            evidenceId: evidence.id,
            artifactRef: evidence.value,
            checkedAt,
          },
        });
      }
    }
  }
  return matched;
}

async function retryHandoff(id: string) {
  const current = await getHandoff(id);
  if (!current) throw new Error('Handoff record not found.');
  const retrying = await updateHandoff(id, {
    status: 'retrying',
    attempts: current.attempts + 1,
    error: null,
  });

  try {
    let ok = false;
    let message = '';
    if (retrying.kind === 'project_sync') {
      const { syncProjects } = await import('./teamforge.js');
      const result = await syncProjects();
      ok = result.ok;
      message = result.message ?? '';
    } else if (retrying.kind === 'time_sync') {
      const { flushTimeEntries } = await import('./teamforge.js');
      const result = await flushTimeEntries();
      ok = result.ok;
      message = result.message ?? '';
    } else if (retrying.kind === 'usage_signal' || retrying.kind === 'standup_sync') {
      const { emitUsageSignal } = await import('./teamforge.js');
      const signal = retrying.payload.signal;
      if (!signal || typeof signal !== 'object') throw new Error('Handoff is missing usage signal payload.');
      const result = await emitUsageSignal(signal);
      ok = result.ok;
      message = 'Usage signal sent.';
    } else if (retrying.kind === 'github_repo_verify') {
      const { verifyProjectRepo } = await import('./teamforge.js');
      const projectId = typeof retrying.payload.projectId === 'string' ? retrying.payload.projectId : '';
      const repoUrl = typeof retrying.payload.repoUrl === 'string' ? retrying.payload.repoUrl : '';
      if (!projectId || !repoUrl) throw new Error('Handoff is missing GitHub repo verification payload.');
      const result = await verifyProjectRepo(projectId, repoUrl);
      ok = result.ok && result.remoteVerified !== false;
      message = result.remoteVerified === false
        ? 'Repo is locally verified, but workspace GitHub verification is still pending.'
        : (result.message ?? '');
    } else if (retrying.kind === 'github_activity_sync') {
      const { syncGitHubActivity } = await import('./teamforge.js');
      const projectId = typeof retrying.payload.projectId === 'string' ? retrying.payload.projectId : '';
      const from = typeof retrying.payload.from === 'string' ? retrying.payload.from : '';
      const to = typeof retrying.payload.to === 'string' ? retrying.payload.to : '';
      if (!projectId || !from || !to) throw new Error('Handoff is missing GitHub activity sync payload.');
      const result = await syncGitHubActivity(projectId, from, to);
      ok = result.ok;
      message = result.message ?? '';
    } else if (retrying.kind === 'standup_evidence_sync' || retrying.kind === 'review_rollup_sync' || retrying.kind === 'breakwork_audio_generation') {
      ok = false;
      message = 'This handoff records a server-side evidence or audio generation request. Re-run the action from its Plexus page.';
    } else if (retrying.kind === 'preferences_save') {
      const { setMemberPreferences } = await import('./teamforge.js');
      const prefs = retrying.payload.preferences;
      if (!prefs || typeof prefs !== 'object') throw new Error('Handoff is missing preferences payload.');
      const result = await setMemberPreferences(prefs as Record<string, unknown>);
      ok = result.ok;
      message = result.message ?? '';
    } else if (retrying.kind === 'paperclip_closeout' || retrying.kind === 'paperclip_memory') {
      const { closeoutRealtimeCall } = await import('./teamforge.js');
      const callId = typeof retrying.payload.callId === 'string' ? retrying.payload.callId : '';
      const payload = retrying.payload.payload;
      if (!callId || !payload || typeof payload !== 'object') throw new Error('Handoff is missing closeout payload.');
      const result = await closeoutRealtimeCall(callId, payload as RealtimeCloseoutPayload);
      ok = result.ok && (retrying.kind === 'paperclip_closeout' || result.meeting?.paperclipStatus !== 'failed');
      message = result.message ?? (result.meeting?.paperclipStatus === 'failed' ? 'Paperclip handoff failed.' : '');
    } else if (retrying.kind === 'assistant_daily_event') {
      const { flushAssistantDailyEvents } = await import('./assistant-daily.js');
      const eventId = typeof retrying.payload.dailyEventId === 'string' ? retrying.payload.dailyEventId : '';
      if (!eventId) throw new Error('Handoff is missing daily event id.');
      const result = await flushAssistantDailyEvents({ eventId, recordFailureHandoff: false });
      ok = result.ok && result.sent > 0;
      message = result.message ?? (ok ? 'Daily assistant event sent.' : 'Daily assistant event retry failed.');
    } else {
      throw new Error(`No retry handler for ${retrying.kind}.`);
    }

    return updateHandoff(id, {
      status: ok ? 'sent' : 'failed',
      error: ok ? null : (message || 'Retry failed.'),
      nextRetryAt: ok ? null : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  } catch (err: any) {
    return updateHandoff(id, {
      status: 'failed',
      error: err?.message ?? String(err),
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  }
}

async function getMediaCaptureStatus(): Promise<MediaCaptureStatus> {
  const permissionFor = (kind: 'microphone' | 'camera' | 'screen'): MediaPermissionState => {
    try {
      return systemPreferences.getMediaAccessStatus(kind);
    } catch {
      return 'unknown';
    }
  };

  const status: MediaCaptureStatus = {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    isPackaged: app.isPackaged,
    permissions: {
      microphone: permissionFor('microphone'),
      camera: permissionFor('camera'),
      screen: permissionFor('screen'),
    },
    desktopCapture: {
      available: false,
      sourceCount: 0,
      screenCount: 0,
      windowCount: 0,
    },
    renderer: {},
    notes: [],
  };

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false,
    });
    status.desktopCapture.available = true;
    status.desktopCapture.sourceCount = sources.length;
    status.desktopCapture.screenCount = sources.filter((source) => source.id.startsWith('screen:')).length;
    status.desktopCapture.windowCount = sources.filter((source) => source.id.startsWith('window:')).length;
  } catch (error: any) {
    status.desktopCapture.error = error?.message ?? String(error);
  }

  if (process.platform === 'darwin' && status.permissions.screen !== 'granted') {
    status.notes.push('Screen Recording permission is managed in macOS System Settings and cannot be requested directly from this panel.');
  }
  if (status.permissions.microphone === 'not-determined') {
    status.notes.push('Microphone permission can be requested before joining a realtime room.');
  }
  if (status.permissions.camera === 'not-determined') {
    status.notes.push('Camera permission can be requested before joining a realtime room.');
  }
  if (!status.desktopCapture.available || status.desktopCapture.sourceCount === 0) {
    status.notes.push('Desktop capture source discovery is unavailable or blocked; screen sharing should render a recoverable failure state.');
  }

  return status;
}

async function requestMediaAccess(kind: MediaRequestKind): Promise<MediaCaptureStatus> {
  try {
    await systemPreferences.askForMediaAccess(kind);
  } catch {
    // Non-macOS platforms and some denied states do not expose a prompt path.
  }
  return getMediaCaptureStatus();
}

// Electron requires the main process to answer renderer getDisplayMedia() calls.
// Without this handler, navigator.mediaDevices.getDisplayMedia() is inert even when
// macOS Screen Recording permission is granted. useSystemPicker shows the native
// macOS screen picker where supported; the desktopCapturer path is the fallback.
function registerDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        callback(sources.length > 0 ? { video: sources[0] } : {});
      })
      .catch(() => callback({}));
  }, { useSystemPicker: true });
}

const ASSISTANT_CONTEXT_SCOPES = [
  'today',
  'week',
  'project',
  'session_group',
  'infra',
  'app',
] as const satisfies readonly AssistantContextScope[];

const DEFAULT_ASSISTANT_CONTEXT_SCOPES: AssistantContextScope[] = [
  'today',
  'project',
  'session_group',
  'infra',
  'app',
];

const ASSISTANT_MODEL_PROVIDERS = ['google', 'nvidia', 'local', 'auto', 'mock'] as const satisfies readonly AssistantModelProvider[];

function assistantModelProviderFromSetting(value: string | null): AssistantModelProvider | undefined {
  return ASSISTANT_MODEL_PROVIDERS.includes(value as AssistantModelProvider)
    ? value as AssistantModelProvider
    : undefined;
}

function normalizeAssistantContextScopes(
  scopes: readonly AssistantContextScope[] | undefined,
  fallback: readonly AssistantContextScope[] = DEFAULT_ASSISTANT_CONTEXT_SCOPES,
): AssistantContextScope[] {
  const allowed = new Set<AssistantContextScope>(ASSISTANT_CONTEXT_SCOPES);
  const next = (Array.isArray(scopes) ? scopes : [])
    .filter((scope): scope is AssistantContextScope => allowed.has(scope as AssistantContextScope));
  return next.length > 0 ? [...new Set(next)] : [...fallback];
}

function normalizeAssistantTurnRequest(input: AssistantTurnRequest): AssistantTurnRequest {
  const request = (input ?? {}) as Partial<AssistantTurnRequest>;
  const conversationId = typeof request.conversationId === 'string' && request.conversationId.trim()
    ? request.conversationId.trim()
    : `assistant_conversation_${randomUUID()}`;
  const message = typeof request.message === 'string' ? request.message.trim() : '';
  if (!message) throw new Error('Assistant message is required.');
  return {
    conversationId,
    message,
    contextScopes: normalizeAssistantContextScopes(request.contextScopes),
    ...(typeof request.routeKey === 'string' && request.routeKey.trim() ? { routeKey: request.routeKey.trim() } : {}),
  };
}

function normalizeAssistantSuggestionsRequest(input?: AssistantSuggestionsRequest): Required<Pick<AssistantSuggestionsRequest, 'conversationId' | 'contextScopes'>> & {
  projectId?: string;
  maxSuggestions?: number;
} {
  const request = (input ?? {}) as AssistantSuggestionsRequest;
  const conversationId = typeof request.conversationId === 'string' && request.conversationId.trim()
    ? request.conversationId.trim()
    : `assistant_suggestions_${randomUUID()}`;
  const maxSuggestions = typeof request.maxSuggestions === 'number' && Number.isFinite(request.maxSuggestions)
    ? Math.max(0, Math.floor(request.maxSuggestions))
    : typeof request.limit === 'number' && Number.isFinite(request.limit)
      ? Math.max(0, Math.floor(request.limit))
    : undefined;
  return {
    conversationId,
    contextScopes: normalizeAssistantContextScopes(request.contextScopes),
    ...(typeof request.projectId === 'string' && request.projectId.trim() ? { projectId: request.projectId.trim() } : {}),
    ...(maxSuggestions !== undefined ? { maxSuggestions } : {}),
  };
}

async function readAssistantModelConfig() {
  const [providerSetting, googleModel, nvidiaModel, localModel, localBaseUrl, secrets] = await Promise.all([
    getSetting('assistantModelProvider'),
    getSetting('assistantGoogleModel'),
    getSetting('assistantNvidiaModel'),
    getSetting('assistantLocalModel'),
    getSetting('assistantLocalBaseUrl'),
    createElectronAssistantModelSecretStore()
      .then((store) => store.readSecrets())
      .catch(() => ({ googleApiKey: null, nvidiaApiKey: null })),
  ]);
  return resolveAssistantModelConfig({
    provider: assistantModelProviderFromSetting(providerSetting),
    googleModel,
    nvidiaModel,
    localModel,
    localBaseUrl,
    googleApiKey: secrets.googleApiKey,
    nvidiaApiKey: secrets.nvidiaApiKey,
  });
}

function assistantModelProviderFromInput(value: unknown): AssistantModelProvider {
  if (typeof value === 'string' && ASSISTANT_MODEL_PROVIDERS.includes(value as AssistantModelProvider)) {
    return value as AssistantModelProvider;
  }
  throw new Error('Assistant model provider is not supported.');
}

function settingString(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function applyAssistantModelSettings(input: AssistantModelSettingsInput): Promise<AssistantModelStatus> {
  if (input.provider !== undefined) await setSetting('assistantModelProvider', assistantModelProviderFromInput(input.provider));
  if (input.googleModel !== undefined) await setSetting('assistantGoogleModel', settingString(input.googleModel));
  if (input.nvidiaModel !== undefined) await setSetting('assistantNvidiaModel', settingString(input.nvidiaModel));
  if (input.localModel !== undefined) await setSetting('assistantLocalModel', settingString(input.localModel));
  if (input.localBaseUrl !== undefined) await setSetting('assistantLocalBaseUrl', settingString(input.localBaseUrl));
  if (
    input.googleApiKey !== undefined
    || input.nvidiaApiKey !== undefined
    || input.clearGoogleKey !== undefined
    || input.clearNvidiaKey !== undefined
  ) {
    const secretStore = await createElectronAssistantModelSecretStore();
    await secretStore.applySettings(input);
  }
  return assistantModelStatusFromConfig(await readAssistantModelConfig());
}

async function assistantStatus(): Promise<AssistantStatus> {
  const enabled = (await getSetting('assistantEnabled')) !== 'false';
  const config = await readAssistantModelConfig();
  const model = assistantModelStatusFromConfig(config);
  const needsModelKey = enabled
    && !model.selectedProvider
    && (model.provider === 'google' || model.provider === 'nvidia');
  const availability = !enabled
    ? 'disabled'
    : model.selectedProvider
      ? 'ready'
      : needsModelKey
        ? 'needs_model_key'
        : 'offline_suggestions';
  return {
    ok: enabled && availability !== 'needs_model_key',
    state: availability === 'ready'
      ? 'runtime ready'
      : availability === 'disabled'
        ? 'disabled'
        : availability === 'needs_model_key'
          ? 'needs model key'
          : 'offline suggestions',
    enabled,
    availability,
    checkedAt: new Date().toISOString(),
    model,
    offlineSuggestionsAvailable: enabled,
    needsModelKey,
    message: availability === 'ready'
      ? `Assistant is ready using ${model.selectedProvider}.`
      : availability === 'disabled'
        ? 'Assistant is disabled in local settings.'
        : needsModelKey
          ? 'Assistant needs a model key before live model turns are available.'
          : 'Assistant will use offline local suggestions until a live model is configured.',
  };
}

async function createAssistantRuntimeForRequest() {
  const config = await readAssistantModelConfig();
  const router = config.selectedProvider
    ? new AssistantModelRouter(config, createAssistantModelProviders(config))
    : null;
  return createAssistantRuntime({
    router,
    persistence: {
      async saveMessage(input) {
        return insertAssistantMessage({
          id: randomUUID(),
          ...input,
        });
      },
      async saveIntent(input) {
        return insertAssistantIntent({
          id: randomUUID(),
          ...input,
        });
      },
    },
    loadContext: loadAssistantRuntimeContext,
  });
}

async function loadAssistantRuntimeContext(request: AssistantTurnRequest): Promise<AssistantRuntimeContext> {
  const snapshot = await buildAssistantContext({
    contextScopes: normalizeAssistantContextScopes(request.contextScopes),
    includeOptionalHelpers: true,
    projectId: undefined,
    routeState: request.routeKey
      ? {
          routeKey: request.routeKey,
          selectedProjectId: null,
          updatedAt: new Date().toISOString(),
        }
      : undefined,
  });
  return runtimeContextFromSnapshot(snapshot, request);
}

function runtimeContextFromSnapshot(
  snapshot: AssistantContextSnapshot,
  request: AssistantTurnRequest,
): AssistantRuntimeContext {
  const bridgeConnected = snapshot.infra?.thoughtseedBridge?.connected === true || snapshot.infra?.worker.connected === true;
  return {
    routeKey: snapshot.route?.routeKey ?? request.routeKey,
    todayEntryCount: snapshot.entries.length,
    pendingSessionCount: snapshot.agentSessions.totalPending,
    bridgeConnected,
    paperclipStatus: snapshot.infra?.optionalHelpers.paperclip
      ? (snapshot.infra.optionalHelpers.paperclip.binaryFound ? 'installed' : 'missing')
      : null,
    todayDate: snapshot.dateRange.from.slice(0, 10),
    todayEntries: snapshot.entries.map((entry) => ({
      id: entry.id,
      description: entry.description,
      durationSeconds: entry.durationSeconds,
    })),
    hasStandupProofToday: Boolean(snapshot.evidence?.standupEvidence),
    sessionScan: {
      totalPending: snapshot.agentSessions.totalPending,
      readyPending: snapshot.agentSessions.readyPending,
      candidates: snapshot.agentSessions.candidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
      })),
    },
    bridgeStatus: { connected: bridgeConnected },
    projectCache: {
      stale: snapshot.projects.some((project) => (
        project.repo.required
        && (!project.repo.fullName || project.repo.status === 'missing' || project.repo.status === 'unverified')
      )),
    },
  };
}

function sendAssistantEvent(event: AssistantStreamEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('assistant:event', event);
}

async function materializeAssistantSuggestionIntents(
  conversationId: string,
  suggestions: readonly AssistantSuggestion[],
): Promise<AssistantSuggestion[]> {
  return Promise.all(suggestions.map(async (suggestion) => {
    if (suggestion.safety !== 'confirm_required' || !suggestion.intent || suggestion.intent.intentId) {
      return suggestion;
    }
    const expiresAt = assistantIntentExpiresAt(new Date());
    const intent = await insertAssistantIntent({
      id: randomUUID(),
      conversationId,
      toolId: suggestion.intent.toolId,
      payload: suggestion.intent.payload,
      status: 'draft',
      expiresAt,
    });
    return {
      ...suggestion,
      intent: {
        ...suggestion.intent,
        intentId: intent.id,
        expiresAt,
      },
    };
  }));
}

// IPC Handlers
ipcMain.handle('timer:start', async (_event, projectId: string, description: string, targetSeconds?: number): Promise<TimeEntry> => {
  const entry = await startTimerEntry({ projectId, description, targetSeconds });
  activeProjectId = projectId;
  if (mainWindow) {
    mainWindow.webContents.send('timer:tick', timerStateFromEntry(entry));
    await updateTrayMenu(mainWindow);
  }
  return entry;
});

ipcMain.handle('timer:stop', async (): Promise<TimeEntry | null> => {
  const stopped = await stopRunningEntry();
  if (!stopped) return null;
  import('./teamforge.js')
    .then((m) => m.flushTimeEntries())
    .then((result) => {
      if (!result.ok) {
        return recordOptionalFailure({
          kind: 'time_sync',
          status: 'failed',
          title: 'Timer entry Worker sync failed',
          payload: { entryId: stopped.id },
          error: result.message ?? 'Worker time-entry sync failed.',
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });
      }
      return undefined;
    })
    .catch((err: any) => {
      void recordOptionalFailure({
        kind: 'time_sync',
        status: 'failed',
        title: 'Timer entry Worker sync failed',
        payload: { entryId: stopped.id },
        error: err?.message ?? String(err),
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    });

  // Phase 9: emit usage signal (best-effort, non-blocking)
  try {
    const now = stopped.endTime ?? new Date().toISOString();
    const duration = stopped.durationSeconds;
    const sessionDurationMin = Math.floor(duration / 60);
    const signal = {
      timestamp: now,
      activeProject: activeProjectId || stopped.projectId,
      dailyTotalSeconds: duration,
      standupCompliant: duration >= 60, // >= 1 minute counts as compliance
      sessionDurationMinutes: sessionDurationMin,
    };
    import('./teamforge.js')
      .then((m) => m.emitUsageSignal(signal))
      .then((result) => {
        if (!result.ok) {
          return recordOptionalFailure({
            kind: 'standup_sync',
            status: 'failed',
            title: 'Timer standup signal failed',
            payload: { signal },
            error: 'Timer stopped locally, but the standup/usage signal was not accepted by the workspace service.',
            nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          });
        }
        return undefined;
      })
      .catch((err: any) => {
        void recordOptionalFailure({
          kind: 'standup_sync',
          status: 'failed',
          title: 'Timer standup signal failed',
          payload: { signal },
          error: err?.message ?? String(err),
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });
      });
  } catch { /* ignore */ }

  activeProjectId = null;
  if (mainWindow) {
    mainWindow.webContents.send('timer:tick', { running: false } satisfies TimerState);
    await updateTrayMenu(mainWindow);
  }

  return stopped;
});

ipcMain.handle('timer:pause', async (): Promise<TimerState> => {
  const state = await pauseRunningEntry();
  if (mainWindow) {
    mainWindow.webContents.send('timer:tick', state);
    await updateTrayMenu(mainWindow);
  }
  return state;
});

ipcMain.handle('timer:resume', async (): Promise<TimerState> => {
  const state = await resumeRunningEntry();
  if (mainWindow) {
    mainWindow.webContents.send('timer:tick', state);
    await updateTrayMenu(mainWindow);
  }
  return state;
});

ipcMain.handle('timer:getState', async (): Promise<TimerState> => {
  return getTimerState();
});

ipcMain.handle('entry:list', async (_event, from: string, to: string): Promise<TimeEntry[]> => {
  return listEntries(from, to);
});

ipcMain.handle('entry:create', async (_event, entry): Promise<TimeEntry> => {
  const project = await requireVerifiedRepoProject(entry.projectId);
  const e: TimeEntry = {
    id: randomUUID(),
    ...entry,
    durationSeconds: entry.durationSeconds ?? 0,
    githubRepoUrl: project.githubRepoUrl,
    githubRepoFullName: project.githubRepoFullName,
    evidenceStatus: 'pending',
    evidenceCheckedAt: null,
    githubActivityIds: [],
  };
  if (entry.startTime && entry.endTime) {
    e.durationSeconds = Math.floor((new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 1000);
  }
  await insertEntry(e);
  import('./teamforge.js')
    .then((m) => m.flushTimeEntries())
    .then((result) => {
      if (!result.ok) {
        return recordOptionalFailure({
          kind: 'time_sync',
          status: 'failed',
          title: 'Manual entry Worker sync failed',
          payload: { entryId: e.id },
          error: result.message ?? 'Worker time-entry sync failed.',
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });
      }
      return undefined;
    })
    .catch((err: any) => {
      void recordOptionalFailure({
        kind: 'time_sync',
        status: 'failed',
        title: 'Manual entry Worker sync failed',
        payload: { entryId: e.id },
        error: err?.message ?? String(err),
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    });
  return e;
});

ipcMain.handle('entry:update', async (_event, id: string, patch: Partial<TimeEntry>): Promise<TimeEntry> => {
  if (patch.projectId) {
    const project = await requireVerifiedRepoProject(patch.projectId);
    patch.githubRepoUrl = project.githubRepoUrl;
    patch.githubRepoFullName = project.githubRepoFullName;
    patch.evidenceStatus = 'pending';
    patch.evidenceCheckedAt = null;
    patch.githubActivityIds = [];
  }
  await updateEntry(id, patch);
  const all = await listEntries('1970-01-01', '2099-12-31');
  return all.find(e => e.id === id)!;
});

ipcMain.handle('entry:delete', async (_event, id: string) => {
  await deleteEntry(id);
});

ipcMain.handle('project:list', async (): Promise<Project[]> => {
  return listProjects();
});

ipcMain.handle('project:create', async (_event, project): Promise<Project> => {
  const p: Project = {
    id: randomUUID(),
    ...project,
    createdAt: new Date().toISOString(),
  };
  await insertProject(p);
  return p;
});

ipcMain.handle('project:update', async (_event, id: string, patch: Partial<Project>): Promise<Project> => {
  await updateProject(id, patch);
  return (await listProjects()).find(p => p.id === id)!;
});

ipcMain.handle('project:delete', async (_event, id: string) => {
  await deleteProject(id);
});

ipcMain.handle('project:repoOptions', async (_event, projectId?: string): Promise<GitHubRepoOption[]> => {
  const { listGitHubRepoOptions } = await import('./teamforge.js');
  return listGitHubRepoOptions(projectId);
});

ipcMain.handle('project:verifyRepo', async (_event, projectId: string, repoUrl: string) => {
  const { verifyProjectRepo } = await import('./teamforge.js');
  const result = await verifyProjectRepo(projectId, repoUrl);
  if (result.ok && result.project) {
    await updateProject(projectId, {
      githubRepoUrl: result.project.githubRepoUrl,
      githubRepoFullName: result.project.githubRepoFullName,
      githubRepoId: result.project.githubRepoId,
      repoVerifiedAt: result.project.repoVerifiedAt,
      repoEvidenceStatus: result.project.repoEvidenceStatus,
      evidenceStatus: result.project.evidenceStatus,
    });
    if (result.remoteVerified === false) {
      await recordOptionalFailure({
        kind: 'github_repo_verify',
        status: 'pending',
        title: 'Workspace GitHub verification pending',
        payload: {
          projectId,
          repoUrl: result.project.githubRepoUrl ?? repoUrl,
          repoFullName: result.project.githubRepoFullName,
        },
        error: result.message ?? 'Repo was verified locally; workspace verification still needs to be retried.',
        nextRetryAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    }
    const project = await getProject(projectId);
    return { ...result, project: project ?? result.project };
  }
  await recordOptionalFailure({
    kind: 'github_repo_verify',
    status: 'failed',
    title: 'GitHub repo verification failed',
    payload: { projectId, repoUrl },
    error: result.message ?? 'Could not verify GitHub repository.',
    nextRetryAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  await updateProject(projectId, {
    githubRepoUrl: repoUrl,
    repoEvidenceStatus: result.status,
    evidenceStatus: 'missing',
  }).catch(() => {});
  return result;
});

ipcMain.handle('project:scanVault', async () => {
  const { scanVaultProjects } = await import('./vault-projects.js');
  return scanVaultProjects();
});

ipcMain.handle('project:importVault', async () => {
  const { importVaultProjects } = await import('./vault-projects.js');
  return importVaultProjects();
});

ipcMain.handle('agentSessions:status', async () => {
  const { agentSessionStatus } = await import('./agent-sessions.js');
  return agentSessionStatus();
});

ipcMain.handle('agentSessions:scan', async () => {
  const { scanAgentSessions } = await import('./agent-sessions.js');
  return scanAgentSessions();
});

ipcMain.handle('agentSessions:setConsent', async (_event, enabled: boolean): Promise<PlexusSettings> => {
  await setSetting('agentSessionScanEnabled', String(Boolean(enabled)));
  await setSetting('agentSessionConsentAt', enabled ? new Date().toISOString() : '');
  return readSettings();
});

ipcMain.handle('agentSessions:accept', async (_event, candidateId: string): Promise<TimeEntry> => {
  const { acceptAgentSession } = await import('./agent-sessions.js');
  return acceptAgentSession(candidateId);
});

ipcMain.handle('agentSessions:dismiss', async (_event, candidateId: string): Promise<void> => {
  const { dismissAgentSession } = await import('./agent-sessions.js');
  await dismissAgentSession(candidateId);
});

guardedHandle('today:snapshot', undefined, async (): Promise<TodaySnapshot> => {
  const generatedAt = new Date().toISOString();
  const range = assistantDateRange('today', generatedAt);
  const date = range.from.slice(0, 10);
  const [projects, entries, runningEntry] = await Promise.all([
    listProjects(),
    listEntries(range.from, range.to),
    getRunningEntry(),
  ]);
  const timerState = timerStateFromEntry(runningEntry, new Date(generatedAt));
  const evidenceSummary = computeEvidenceSummary(entries, projects);

  const tasksResult = await (async () => {
    try {
      const { listThoughtseedFabricTasks } = await import('./thoughtseed-bridge.js');
      const result = await listThoughtseedFabricTasks();
      return {
        tasks: result.tasks,
        error: result.ok ? null : 'Fabric tasks unavailable',
      };
    } catch (error) {
      return { tasks: [], error: (error as Error)?.message ?? String(error) };
    }
  })();
  const assistantResult = await assistantStatus()
    .then((status) => ({ status, error: null }))
    .catch((error) => ({ status: null, error: (error as Error)?.message ?? String(error) }));
  const sessionsResult = await (async () => {
    try {
      const { agentSessionStatus } = await import('./agent-sessions.js');
      return { status: await agentSessionStatus(), error: null };
    } catch (error) {
      return { status: null, error: (error as Error)?.message ?? String(error) };
    }
  })();
  const kpiResult = await (async () => {
    try {
      const { getMemberKpiSummary } = await import('./teamforge.js');
      const result = await getMemberKpiSummary();
      return result.ok && result.data
        ? { kpi: result.data, error: null }
        : { kpi: null, error: result.message ?? 'KPI unavailable' };
    } catch (error) {
      return { kpi: null, error: (error as Error)?.message ?? String(error) };
    }
  })();

  return buildTodaySnapshot({
    date,
    generatedAt,
    timerState,
    entries,
    projects,
    tasks: tasksResult.tasks,
    evidenceSummary,
    assistantStatus: assistantResult.status,
    assistantError: assistantResult.error,
    agentSessionStatus: sessionsResult.status,
    agentSessionError: sessionsResult.error,
    memberKpi: kpiResult.kpi,
    memberKpiError: kpiResult.error,
    fabricTasksError: tasksResult.error,
  });
});

guardedHandle('adminProofCockpit:snapshot', undefined, async (): Promise<AdminProofCockpitSnapshot> => {
  const session = await activeAdminSession();
  const generatedAt = new Date().toISOString();
  const range = assistantDateRange('today', generatedAt);
  const date = range.from.slice(0, 10);
  const [projects, entries] = await Promise.all([
    listProjects(),
    listEntries(range.from, range.to),
  ]);
  const evidenceSummary = computeEvidenceSummary(entries, projects);

  const overviewResult = await (async () => {
    try {
      const { getAdminDemoOverview } = await import('./teamforge.js');
      const result = await getAdminDemoOverview();
      return result.ok && result.overview
        ? { overview: result.overview, error: null }
        : { overview: null, error: result.message ?? 'Admin overview unavailable' };
    } catch (error) {
      return { overview: null, error: (error as Error)?.message ?? String(error) };
    }
  })();
  const tasksResult = await (async () => {
    try {
      const { listFabricTasks } = await import('../db/database.js');
      return { tasks: await listFabricTasks({ limit: 200 }), error: null };
    } catch (error) {
      return { tasks: [], error: (error as Error)?.message ?? String(error) };
    }
  })();
  const bridgeResult = await (async () => {
    try {
      const { getThoughtseedBridgeStatus } = await import('./thoughtseed-bridge.js');
      return { status: await getThoughtseedBridgeStatus(), error: null };
    } catch (error) {
      return { status: null, error: (error as Error)?.message ?? String(error) };
    }
  })();
  const proofCustodyRecords = await (async () => {
    try {
      const { listProofCustodyRecords } = await import('../db/database.js');
      return await listProofCustodyRecords({ limit: 100 });
    } catch {
      return [];
    }
  })();

  return buildAdminProofCockpitSnapshot({
    date,
    generatedAt,
    session,
    overview: overviewResult.overview,
    overviewError: overviewResult.error,
    projects,
    tasks: tasksResult.tasks,
    tasksError: tasksResult.error,
    evidenceSummary,
    proofCustodyRecords,
    bridgeStatus: bridgeResult.status,
    bridgeError: bridgeResult.error,
    releaseEvidenceReady: existsSync(path.join(process.cwd(), 'docs/evidence/2026-07-02-assistant-runtime-release-gates.md')),
  });
});

function projectBreakdownForEntries(entries: readonly TimeEntry[]): Record<string, number> {
  const projectBreakdown: Record<string, number> = {};
  for (const entry of entries) {
    projectBreakdown[entry.projectId] = (projectBreakdown[entry.projectId] || 0) + entry.durationSeconds;
  }
  return projectBreakdown;
}

function dailyReportFromEntries(date: string, entries: TimeEntry[], projects: Project[], fabricTasks: ThoughtseedFabricTask[] = []): DailyReport {
  const evidenceSummary = computeEvidenceSummary(entries, projects);
  const fabricTaskProof = buildFabricTaskProofSummary(filterFabricTasksForEntries(fabricTasks, entries));
  const totalSeconds = entries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
  const entryCount = entries.length;
  const proofPacket = buildDailyProofPacket({
    date,
    totalSeconds,
    entryCount,
    evidenceSummary,
    fabricTaskProof,
    standupEvidenceRecordId: `standup_${date}`,
  });
  return {
    date,
    entries,
    totalSeconds,
    entryCount,
    projectBreakdown: projectBreakdownForEntries(entries),
    evidenceSummary,
    fabricTaskProof,
    proofStatus: proofPacket.proofStatus,
    proofPacket,
  };
}

function weeklyReportFromDays(weekStart: string, days: DailyReport[], projects: Project[], fabricTasks: ThoughtseedFabricTask[] = []): WeeklyReport {
  const allEntries = days.flatMap((day) => day.entries);
  const evidenceSummary = computeEvidenceSummary(allEntries, projects);
  const fabricTaskProof = buildFabricTaskProofSummary(filterFabricTasksForEntries(fabricTasks, allEntries));
  const totalSeconds = days.reduce((sum, day) => sum + day.totalSeconds, 0);
  return {
    weekStart,
    days,
    totalSeconds,
    entryCount: allEntries.length,
    projectBreakdown: projectBreakdownForEntries(allEntries),
    evidenceSummary,
    fabricTaskProof,
    proofStatus: buildDailyProofPacket({
      date: weekStart,
      totalSeconds,
      entryCount: allEntries.length,
      evidenceSummary,
      fabricTaskProof,
    }).proofStatus,
  };
}

async function recordReportProofCustody(
  subjectType: Extract<ProofCustodySubjectType, 'daily_report' | 'weekly_report' | 'monthly_report'>,
  subjectId: string,
  report: DailyReport | WeeklyReport | MonthlyReport,
): Promise<void> {
  await upsertProofCustodyRecord({
    subjectType,
    subjectId,
    proofStatus: report.proofStatus,
    evidenceType: 'report',
    payload: {
      subjectId,
      proofStatus: report.proofStatus,
      totalSeconds: report.totalSeconds,
      entryCount: report.entryCount,
      evidenceSummary: report.evidenceSummary,
      fabricTaskProof: report.fabricTaskProof,
      projectBreakdown: report.projectBreakdown,
      proofPacket: 'proofPacket' in report ? report.proofPacket : undefined,
    },
  });
  if (subjectType === 'daily_report' && 'proofPacket' in report) {
    await upsertDailyProofPacket(report.proofPacket);
  }
}

ipcMain.handle('report:daily', async (_event, date: string): Promise<DailyReport> => {
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  const [entries, projects, fabricTasks] = await Promise.all([listEntries(from, to), listProjects(), listFabricTasks({ limit: 1000 })]);
  const report = dailyReportFromEntries(date, entries, projects, fabricTasks);
  await recordReportProofCustody('daily_report', date, report);
  return report;
});

ipcMain.handle('report:dailyProofPacket', async (_event, date: string): Promise<DailyProofPacket> => {
  const existing = await getDailyProofPacketByDate(date);
  if (existing) return existing;
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  const [entries, projects, fabricTasks] = await Promise.all([listEntries(from, to), listProjects(), listFabricTasks({ limit: 1000 })]);
  const report = dailyReportFromEntries(date, entries, projects, fabricTasks);
  await recordReportProofCustody('daily_report', date, report);
  return report.proofPacket;
});

ipcMain.handle('report:weekly', async (_event, weekStart: string): Promise<WeeklyReport> => {
  const days: DailyReport[] = [];
  const [projects, fabricTasks] = await Promise.all([listProjects(), listFabricTasks({ limit: 1000 })]);
  const start = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const from = `${dateStr}T00:00:00.000Z`;
    const to = `${dateStr}T23:59:59.999Z`;
    const entries = await listEntries(from, to);
    days.push(dailyReportFromEntries(dateStr, entries, projects, fabricTasks));
  }
  const report = weeklyReportFromDays(weekStart, days, projects, fabricTasks);
  await recordReportProofCustody('weekly_report', weekStart, report);
  return report;
});

ipcMain.handle('report:monthly', async (_event, month: string): Promise<MonthlyReport> => {
  const [projects, fabricTasks] = await Promise.all([listProjects(), listFabricTasks({ limit: 1000 })]);
  const [year, mon] = month.split('-').map(Number);
  const weeks: WeeklyReport[] = [];
  const firstDay = new Date(Date.UTC(year, mon - 1, 1));
  const lastDay = new Date(Date.UTC(year, mon, 0));
  let current = new Date(firstDay);
  while (current.getDay() !== 1) {
    current.setDate(current.getDate() - 1);
  }
  while (current <= lastDay) {
    const ws = current.toISOString().slice(0, 10);
    const start = new Date(ws);
    const days: DailyReport[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const from = `${ds}T00:00:00.000Z`;
      const to = `${ds}T23:59:59.999Z`;
      const entries = await listEntries(from, to);
      days.push(dailyReportFromEntries(ds, entries, projects, fabricTasks));
    }
    weeks.push(weeklyReportFromDays(ws, days, projects, fabricTasks));
    current.setDate(current.getDate() + 7);
  }
  const allEntries = await listEntries(`${month}-01T00:00:00.000Z`, `${month}-31T23:59:59.999Z`);
  const evidenceSummary = computeEvidenceSummary(allEntries, projects);
  const fabricTaskProof = buildFabricTaskProofSummary(filterFabricTasksForEntries(fabricTasks, allEntries));
  const totalSeconds = weeks.reduce((sum, week) => sum + week.totalSeconds, 0);
  const report: MonthlyReport = {
    month,
    weeks,
    totalSeconds,
    entryCount: allEntries.length,
    projectBreakdown: projectBreakdownForEntries(allEntries),
    evidenceSummary,
    fabricTaskProof,
    proofStatus: buildDailyProofPacket({
      date: month,
      totalSeconds,
      entryCount: allEntries.length,
      evidenceSummary,
      fabricTaskProof,
    }).proofStatus,
  };
  await recordReportProofCustody('monthly_report', month, report);
  return report;
});

ipcMain.handle('evidence:status', async (_event, from: string, to: string): Promise<WorkEvidenceSummary> => {
  const [entries, projects] = await Promise.all([listEntries(from, to), listProjects()]);
  return computeEvidenceSummary(entries, projects);
});

ipcMain.handle('github:activitySync', async (_event, projectId: string, from: string, to: string): Promise<{ ok: boolean; activity: GitHubActivity[]; message?: string }> => {
  const project = await requireVerifiedRepoProject(projectId);
  const { syncGitHubActivity } = await import('./teamforge.js');
  const result = await syncGitHubActivity(projectId, from, to);
  if (!result.ok) {
    await recordOptionalFailure({
      kind: 'github_activity_sync',
      status: 'failed',
      title: `GitHub activity sync failed: ${project.name}`,
      payload: { projectId, from, to, repoFullName: project.githubRepoFullName, repoUrl: project.githubRepoUrl },
      error: result.message ?? 'GitHub activity sync failed.',
    });
    return { ok: false, activity: await listGitHubActivity(projectId, from, to), message: result.message };
  }
  const activity = result.activity ?? [];
  await upsertGitHubActivity(activity);
  const matchedEntries = await refreshEntryEvidenceForProjectRange(projectId, from, to, activity);
  await updateProject(projectId, {
    evidenceStatus: matchedEntries > 0 ? 'matched' : 'missing',
    repoEvidenceStatus: 'verified',
  });
  return { ok: true, activity, message: `${matchedEntries} work records matched GitHub activity.` };
});

ipcMain.handle('standup:generate', async (_event, date: string): Promise<StandupEvidenceRecord> => {
  const record = await generateStandupEvidenceRecord(date);
  await upsertProofCustodyRecord({
    subjectType: 'standup',
    subjectId: record.id,
    proofStatus: record.evidenceSummary.proofStatus,
    evidenceType: 'standup',
    payload: {
      date: record.date,
      totalSeconds: record.totalSeconds,
      evidenceSummary: record.evidenceSummary,
      activityIds: record.activity.map((activity) => activity.id),
      generatedAt: record.generatedAt,
    },
  });
  return record;
});

ipcMain.handle('review:generate', async (_event, kind: 'weekly' | 'monthly', periodStart: string): Promise<ReviewCycle> => {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setDate(end.getDate() + (kind === 'weekly' ? 7 : 31));
  const [entries, projects] = await Promise.all([listEntries(start.toISOString(), end.toISOString()), listProjects()]);
  const evidenceSummary = computeEvidenceSummary(entries, projects);
  const record = {
    id: `review_${kind}_${periodStart}`,
    kind,
    periodStart,
    periodEnd: end.toISOString().slice(0, 10),
    evidenceSummary,
    blockers: evidenceSummary.missingEvidenceEntries > 0 ? ['Evidence activity sync is incomplete for this period.'] : [],
    appraisalSignals: [
      `${evidenceSummary.evidencedEntries}/${evidenceSummary.totalEntries} entries have matched GitHub activity.`,
      `${evidenceSummary.legacyUnverifiedEntries} legacy entries remain unverified.`,
    ],
    generatedAt: new Date().toISOString(),
  };
  await upsertReviewCycle(record);
  await upsertProofCustodyRecord({
    subjectType: 'review',
    subjectId: record.id,
    proofStatus: record.evidenceSummary.proofStatus,
    evidenceType: 'review',
    payload: {
      kind,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      evidenceSummary,
      blockers: record.blockers,
      appraisalSignals: record.appraisalSignals,
    },
  });
  return record;
});

ipcMain.handle('breakwork:generatePrompt', async (_event, input: { category: BreakworkCategory; triggerReason: string }): Promise<BreakworkPrompt> => {
  const now = new Date().toISOString();
  const titleByCategory: Record<BreakworkCategory, string> = {
    mental_reset: 'Mental reset',
    physical_reset: 'Physical reset',
    eye_rest: 'Eye rest',
    breathwork: 'Breathwork reset',
    mobility: 'Mobility reset',
    hydration: 'Hydration cue',
    meeting_decompression: 'Meeting decompression',
    transition: 'Transition cue',
  };
  const prompt: BreakworkPrompt = {
    id: `breakwork_${now.replace(/[-:.TZ]/g, '')}_${Math.random().toString(16).slice(2, 8)}`,
    category: input.category,
    title: titleByCategory[input.category],
    promptText: 'Pause your work session, relax your shoulders, take three slow breaths, and return with one clear next action.',
    audioFileRef: null,
    triggerReason: input.triggerReason,
    generatedAt: now,
  };
  await insertBreakworkPrompt(prompt);
  await recordOptionalFailure({
    kind: 'breakwork_audio_generation',
    status: 'pending',
    title: 'Breakwork voice generation pending',
    payload: { prompt },
    error: 'ElevenLabs audio generation must run through the Worker; local prompt text was saved without audio.',
  });
  return prompt;
});

ipcMain.handle('assistant:status', async (): Promise<AssistantStatus> => {
  return assistantStatus();
});

ipcMain.handle('assistant:modelStatus', async (): Promise<AssistantModelStatus> => {
  return assistantModelStatusFromConfig(await readAssistantModelConfig());
});

guardedHandle('assistant:modelSetConfig', (args, channel) => expectSinglePayload(args, channel, normalizeAssistantModelSettingsInput), async (_event, input: AssistantModelSettingsInput): Promise<AssistantModelStatus> => {
  return applyAssistantModelSettings(input);
});

ipcMain.handle('assistant:modelHealth', async (_event, input?: AssistantModelHealthRequest): Promise<AssistantModelHealthResult> => {
  const config = await readAssistantModelConfig();
  return assistantModelHealth(config, createAssistantModelProviders(config), input ?? {});
});

ipcMain.handle('assistant:modelCatalog', async (): Promise<AssistantModelCatalog> => {
  return discoverAssistantModelCatalog(await readAssistantModelConfig());
});

ipcMain.handle('assistant:ask', async (_event, input: AssistantTurnRequest): Promise<AssistantAskResult> => {
  const request = normalizeAssistantTurnRequest(input);
  let eventCount = 0;
  let done = false;
  let error: string | undefined;
  try {
    const runtime = await createAssistantRuntimeForRequest();
    for await (const event of runtime.runTurn(request)) {
      eventCount += 1;
      if (event.type === 'done') done = true;
      if (event.type === 'error') error = event.message;
      sendAssistantEvent(event);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    const errorEvent: AssistantStreamEvent = {
      type: 'error',
      conversationId: request.conversationId,
      message: error || 'Assistant request failed.',
    };
    const doneEvent: AssistantStreamEvent = {
      type: 'done',
      conversationId: request.conversationId,
    };
    sendAssistantEvent(errorEvent);
    sendAssistantEvent(doneEvent);
    eventCount += 2;
    done = true;
  }
  return {
    ok: !error,
    conversationId: request.conversationId,
    eventCount,
    done,
    ...(error ? { error } : {}),
  };
});

ipcMain.handle('assistant:suggestions', async (_event, input?: AssistantSuggestionsRequest): Promise<AssistantSuggestion[]> => {
  const request = normalizeAssistantSuggestionsRequest(input);
  const context = await buildAssistantContext({
    contextScopes: request.contextScopes,
    includeOptionalHelpers: true,
    projectId: request.projectId,
  });
  const suggestions = await listProactiveAssistantSuggestions(context, {
    maxSuggestions: request.maxSuggestions,
  });
  return materializeAssistantSuggestionIntents(request.conversationId, suggestions);
});

ipcMain.handle('assistant:confirmIntent', async (_event, intentId: string): Promise<AssistantIntentActionResult> => {
  if (typeof intentId !== 'string' || !intentId.trim()) throw new Error('Assistant intent id is required.');
  const execution = await confirmAssistantIntent(intentId.trim(), {
    actorId: 'local-user',
    role: 'user',
  });
  return {
    intentId: execution.intentId ?? intentId.trim(),
    status: 'succeeded',
    toolId: execution.toolId,
    result: execution.result,
  };
});

ipcMain.handle('assistant:cancelIntent', async (_event, intentId: string): Promise<AssistantIntentActionResult> => {
  if (typeof intentId !== 'string' || !intentId.trim()) throw new Error('Assistant intent id is required.');
  const cancelled = await cancelAssistantIntent(intentId.trim(), {
    actorId: 'local-user',
    role: 'user',
  });
  return {
    intentId: cancelled.id,
    status: cancelled.status,
    toolId: cancelled.toolId,
    result: cancelled.result,
  };
});

async function readSettings(): Promise<PlexusSettings> {
  let breakworkCategories: BreakworkCategory[] = ['mental_reset', 'physical_reset', 'eye_rest'];
  let rhythmProfile = { enabled: false };
  let profile = {};
  const assistantModel = assistantModelStatusFromConfig(await readAssistantModelConfig());
  try {
    const raw = await getSetting('breakworkCategories');
    if (raw) breakworkCategories = JSON.parse(raw);
  } catch {
    breakworkCategories = ['mental_reset', 'physical_reset', 'eye_rest'];
  }
  try {
    const raw = await getSetting('rhythmProfile');
    if (raw) rhythmProfile = JSON.parse(raw);
  } catch {
    rhythmProfile = { enabled: false };
  }
  try {
    const raw = await getSetting('profile');
    if (raw) profile = JSON.parse(raw);
  } catch {
    profile = {};
  }
  const agentSessionScanEnabled = (await getSetting('agentSessionScanEnabled')) === 'true';
  const assistantSessionScanSetting = await getSetting('assistantSessionScanEnabled');
  return {
    memberId: (await getSetting('memberId')) || 'anonymous',
    theme: ((await getSetting('theme')) as any) || 'system',
    defaultProjectId: (await getSetting('defaultProjectId')) || undefined,
    reminderIntervalMinutes: Number(await getSetting('reminderIntervalMinutes')) || 15,
    syncEnabled: (await getSetting('syncEnabled')) === 'true',
    soundNotificationsEnabled: (await getSetting('soundNotificationsEnabled')) !== 'false',
    voiceBreakworkEnabled: (await getSetting('voiceBreakworkEnabled')) === 'true',
    notificationVolume: Number(await getSetting('notificationVolume')) || 60,
    quietHoursStart: (await getSetting('quietHoursStart')) || '18:00',
    quietHoursEnd: (await getSetting('quietHoursEnd')) || '09:00',
    breakworkSnoozeMinutes: Number(await getSetting('breakworkSnoozeMinutes')) || 15,
    breakworkCategories,
    rhythmProfile,
    profile,
    agentSessionScanEnabled,
    agentSessionConsentAt: (await getSetting('agentSessionConsentAt')) || null,
    assistantEnabled: (await getSetting('assistantEnabled')) !== 'false',
    assistantModelProvider: assistantModel.provider,
    assistantGoogleModel: assistantModel.googleModel,
    assistantNvidiaModel: assistantModel.nvidiaModel,
    assistantLocalModel: assistantModel.localModel,
    assistantLocalBaseUrl: assistantModel.localBaseUrl ?? undefined,
    assistantHasGoogleKey: assistantModel.hasGoogleKey,
    assistantHasNvidiaKey: assistantModel.hasNvidiaKey,
    assistantSessionScanEnabled: assistantSessionScanSetting == null
      ? agentSessionScanEnabled
      : assistantSessionScanSetting === 'true',
    assistantPaperclipEnrichmentEnabled: (await getSetting('assistantPaperclipEnrichmentEnabled')) !== 'false',
  };
}

ipcMain.handle('settings:get', async (): Promise<PlexusSettings> => {
  return readSettings();
});

ipcMain.handle('settings:set', async (_event, settings: Partial<PlexusSettings>): Promise<PlexusSettings> => {
  if (settings.memberId) await setSetting('memberId', settings.memberId);
  if (settings.theme) await setSetting('theme', settings.theme);
  if (settings.defaultProjectId) await setSetting('defaultProjectId', settings.defaultProjectId);
  if (settings.reminderIntervalMinutes !== undefined) await setSetting('reminderIntervalMinutes', String(settings.reminderIntervalMinutes));
  if (settings.syncEnabled !== undefined) await setSetting('syncEnabled', String(settings.syncEnabled));
  if (settings.soundNotificationsEnabled !== undefined) await setSetting('soundNotificationsEnabled', String(settings.soundNotificationsEnabled));
  if (settings.voiceBreakworkEnabled !== undefined) await setSetting('voiceBreakworkEnabled', String(settings.voiceBreakworkEnabled));
  if (settings.notificationVolume !== undefined) await setSetting('notificationVolume', String(settings.notificationVolume));
  if (settings.quietHoursStart !== undefined) await setSetting('quietHoursStart', settings.quietHoursStart);
  if (settings.quietHoursEnd !== undefined) await setSetting('quietHoursEnd', settings.quietHoursEnd);
  if (settings.breakworkSnoozeMinutes !== undefined) await setSetting('breakworkSnoozeMinutes', String(settings.breakworkSnoozeMinutes));
  if (settings.breakworkCategories !== undefined) await setSetting('breakworkCategories', JSON.stringify(settings.breakworkCategories));
  if (settings.rhythmProfile !== undefined) await setSetting('rhythmProfile', JSON.stringify(settings.rhythmProfile));
  if (settings.profile !== undefined) await setSetting('profile', JSON.stringify(settings.profile));
  if (settings.agentSessionScanEnabled !== undefined) await setSetting('agentSessionScanEnabled', String(settings.agentSessionScanEnabled));
  if (settings.agentSessionConsentAt !== undefined) await setSetting('agentSessionConsentAt', settings.agentSessionConsentAt ?? '');
  if (settings.assistantEnabled !== undefined) await setSetting('assistantEnabled', String(Boolean(settings.assistantEnabled)));
  await applyAssistantModelSettings({
    ...(settings.assistantModelProvider !== undefined ? { provider: settings.assistantModelProvider } : {}),
    ...(settings.assistantGoogleModel !== undefined ? { googleModel: settings.assistantGoogleModel } : {}),
    ...(settings.assistantNvidiaModel !== undefined ? { nvidiaModel: settings.assistantNvidiaModel } : {}),
    ...(settings.assistantLocalModel !== undefined ? { localModel: settings.assistantLocalModel } : {}),
    ...(settings.assistantLocalBaseUrl !== undefined ? { localBaseUrl: settings.assistantLocalBaseUrl } : {}),
    ...(settings.assistantGoogleApiKey !== undefined ? { googleApiKey: settings.assistantGoogleApiKey } : {}),
    ...(settings.assistantNvidiaApiKey !== undefined ? { nvidiaApiKey: settings.assistantNvidiaApiKey } : {}),
    ...(settings.assistantClearGoogleKey !== undefined ? { clearGoogleKey: settings.assistantClearGoogleKey } : {}),
    ...(settings.assistantClearNvidiaKey !== undefined ? { clearNvidiaKey: settings.assistantClearNvidiaKey } : {}),
  });
  if (settings.assistantSessionScanEnabled !== undefined) {
    const enabled = Boolean(settings.assistantSessionScanEnabled);
    await setSetting('assistantSessionScanEnabled', String(enabled));
    await setSetting('agentSessionScanEnabled', String(enabled));
    await setSetting('agentSessionConsentAt', enabled ? new Date().toISOString() : '');
  }
  if (settings.assistantPaperclipEnrichmentEnabled !== undefined) {
    await setSetting('assistantPaperclipEnrichmentEnabled', String(Boolean(settings.assistantPaperclipEnrichmentEnabled)));
  }
  return readSettings();
});

ipcMain.handle('updates:getStatus', async () => getUpdateStatus());
ipcMain.handle('updates:check', async () => checkForUpdates());
ipcMain.handle('updates:download', async () => downloadUpdate());
ipcMain.handle('updates:install', async () => installUpdateAndRestart());

// Workspace Worker control plane (Phase 1)
guardedHandle('worker:configGet', undefined, async () => {
  const { getWorkerConfig } = await import('./teamforge.js');
  return getWorkerConfig();
});
guardedHandle('worker:configSet', (args, channel) => expectSinglePayload(args, channel, normalizeWorkerConfigInput), async (_event, cfg: { baseUrl?: string; workspaceId?: string; token?: string }) => {
  const { setWorkerConfig } = await import('./teamforge.js');
  return setWorkerConfig(cfg);
});
guardedHandle('worker:status', undefined, async () => {
  const { workerStatus } = await import('./teamforge.js');
  return workerStatus();
});
async function recordThoughtseedBridgeFailure(title: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await recordOptionalFailure({
    kind: 'thoughtseed_bridge',
    status: 'failed',
    title,
    payload: {},
    error: message,
    nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
}
guardedHandle('thoughtseed:bridgeStatus', undefined, async (): Promise<ThoughtseedBridgeStatus> => {
  const { getThoughtseedBridgeStatus } = await import('./thoughtseed-bridge.js');
  return getThoughtseedBridgeStatus();
});
guardedHandle('thoughtseed:redeemInvite', (args, channel) => expectSinglePayload(args, channel, normalizeBridgeRedeemInput), async (_event, input: { invite: string; bridgeApiUrl?: string }): Promise<ThoughtseedBridgeRedeemResult> => {
  try {
    const { redeemThoughtseedInvite } = await import('./thoughtseed-bridge.js');
    return await redeemThoughtseedInvite(input);
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge invite redeem failed', err);
    throw err;
  }
});
guardedHandle('thoughtseed:sendHeartbeat', undefined, async (): Promise<ThoughtseedBridgeHeartbeatResult> => {
  try {
    const { sendThoughtseedHeartbeat } = await import('./thoughtseed-bridge.js');
    return await sendThoughtseedHeartbeat();
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge heartbeat failed', err);
    throw err;
  }
});
guardedHandle('thoughtseed:pollDirectives', undefined, async (): Promise<ThoughtseedBridgePollResult> => {
  try {
    const { pollThoughtseedDirectives } = await import('./thoughtseed-bridge.js');
    return await pollThoughtseedDirectives();
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge directive poll failed', err);
    throw err;
  }
});
guardedHandle('thoughtseed:ackDirectives', (args, channel) => expectSinglePayload(args, channel, normalizeDirectiveIds), async (_event, ids: string[]): Promise<ThoughtseedBridgeAckResult> => {
  try {
    const { ackThoughtseedDirectives } = await import('./thoughtseed-bridge.js');
    return await ackThoughtseedDirectives(ids);
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge directive ack failed', err);
    throw err;
  }
});
guardedHandle('thoughtseed:rotateBridgeToken', undefined, async (): Promise<ThoughtseedBridgeRotateResult> => {
  try {
    const { rotateThoughtseedBridgeToken } = await import('./thoughtseed-bridge.js');
    return await rotateThoughtseedBridgeToken();
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge token rotation failed', err);
    throw err;
  }
});
guardedHandle('thoughtseed:disconnectBridge', undefined, async (): Promise<ThoughtseedBridgeStatus> => {
  const { disconnectThoughtseedBridge } = await import('./thoughtseed-bridge.js');
  return disconnectThoughtseedBridge();
});
guardedHandle('thoughtseed:fabricTasks', undefined, async (): Promise<ThoughtseedFabricTaskListResult> => {
  const { listThoughtseedFabricTasks } = await import('./thoughtseed-bridge.js');
  return listThoughtseedFabricTasks();
});
guardedHandle('thoughtseed:syncFabricTasks', undefined, async (): Promise<ThoughtseedFabricTaskSyncResult> => {
  try {
    const { syncThoughtseedFabricTasks } = await import('./thoughtseed-bridge.js');
    return await syncThoughtseedFabricTasks();
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed Fabric task sync failed', err);
    throw err;
  }
});
guardedHandle('thoughtseed:setFabricTaskWorkMode', (args, channel): [string, ThoughtseedFabricTaskWorkMode] => {
  if (args.length !== 2) throw new Error(`${channel} expects task id and work mode.`);
  return [
    requiredString(args[0], 'Fabric task id', 512),
    fabricTaskWorkModeValue(args[1]),
  ];
}, async (_event, taskId: string, workMode: ThoughtseedFabricTaskWorkMode): Promise<ThoughtseedFabricWorkModeResult> => {
  try {
    const { setThoughtseedFabricTaskWorkMode } = await import('./thoughtseed-bridge.js');
    return await setThoughtseedFabricTaskWorkMode(taskId, workMode);
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed Fabric task work mode update failed', err);
    throw err;
  }
});
guardedHandle('thoughtseed:reportFabricTask', (args, channel) => expectSinglePayload(args, channel, normalizeFabricTaskReportInput), async (_event, input: ThoughtseedFabricTaskReportInput): Promise<ThoughtseedFabricTaskReportResult> => {
  try {
    const { reportThoughtseedFabricTask } = await import('./thoughtseed-bridge.js');
    return await reportThoughtseedFabricTask(input);
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed Fabric task report failed', err);
    throw err;
  }
});
guardedHandle('auth:login', (args, channel) => expectSinglePayload(args, channel, (value) => requiredString(value, 'Email', 320)), async (_event, email: string) => {
  const m = await import('./teamforge.js');
  const res = await m.login(email);
  if (res.ok) m.flushTimeEntries().catch(() => {});
  return res;
});
guardedHandle('auth:accessLogin', undefined, async () => {
  const m = await import('./teamforge.js');
  const res = await m.loginWithAccess();
  if (res.ok) m.flushTimeEntries().catch(() => {});
  return res;
});
guardedHandle('auth:session', undefined, async () => {
  const { getSession } = await import('./teamforge.js');
  return getSession();
});
guardedHandle('auth:refreshSession', undefined, async () => {
  const { refreshSession } = await import('./teamforge.js');
  return refreshSession();
});
guardedHandle('auth:logout', undefined, async () => {
  const { logout } = await import('./teamforge.js');
  return logout();
});
guardedHandle('projects:sync', undefined, async () => {
  const { syncProjects } = await import('./teamforge.js');
  const result = await syncProjects();
  if (!result.ok) {
    await recordOptionalFailure({
      kind: 'project_sync',
      status: 'failed',
      title: 'Project sync failed',
      payload: {},
      error: result.message ?? 'Workspace project sync failed.',
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  }
  return result;
});
ipcMain.handle('onboarding:update', async (_event, stepId: string, state: OnboardingStateValue, metadata?: Record<string, unknown>) => {
  const { updateOnboarding } = await import('./teamforge.js');
  return updateOnboarding(
    requiredString(stepId, 'Onboarding step id', 256),
    onboardingStateValue(state),
    safeMetadata(metadata),
  );
});
ipcMain.handle('adminDemo:overview', async () => {
  await assertActiveAdminSession();
  const { getAdminDemoOverview } = await import('./teamforge.js');
  return getAdminDemoOverview();
});
ipcMain.handle('adminDemo:onboardingUpdate', async (_event, identityId: string, stepId: string, state: OnboardingStateValue, metadata?: Record<string, unknown>) => {
  await assertActiveAdminSession();
  const { updateAdminDemoOnboarding } = await import('./teamforge.js');
  return updateAdminDemoOnboarding(
    requiredString(identityId, 'Admin demo identity id', 256),
    requiredString(stepId, 'Onboarding step id', 256),
    onboardingStateValue(state),
    safeMetadata(metadata),
  );
});

// Idle handling
ipcMain.handle('idle:action', async (_event, entryId: string, action: 'keep' | 'discard' | 'trim', idleMs: number) => {
  await handleIdleAction(entryId, action, idleMs);
});

// Backup
guardedHandle('backup:list', undefined, async () => {
  const { listBackups } = await import('./backup.js');
  return listBackups();
});

guardedHandle('backup:restore', (args, channel) => expectSinglePayload(args, channel, (value) => requiredString(value, 'Backup path', 4096)), async (_event, backupPath: string) => {
  const { restoreBackup } = await import('./backup.js');
  return restoreBackup(backupPath);
});

guardedHandle('backup:run', undefined, async () => {
  const { runBackup } = await import('./backup.js');
  runBackup();
});

// Phase 8 — Standup + KPI
ipcMain.handle('member:kpi', async () => {
  const { getMemberKpiSummary } = await import('./teamforge.js');
  // teamforge wraps the worker call as { ok, data }. Unwrap to the MemberKpiSummary
  // the renderer expects; throw on failure so the renderer surfaces an error instead
  // of rendering the wrapper's undefined fields as NaN.
  const res = await getMemberKpiSummary();
  if (!res.ok || !res.data) throw new Error(res.message ?? 'KPI unavailable');
  return res.data;
});

// Phase 9 — Usage Signals
ipcMain.handle('member:emitUsageSignal', async (_event, signal) => {
  const { emitUsageSignal } = await import('./teamforge.js');
  const result = await emitUsageSignal(signal);
  if (!result.ok) {
    await recordOptionalFailure({
      kind: 'usage_signal',
      status: 'failed',
      title: 'Usage signal failed',
      payload: { signal },
      error: 'Usage signal was not accepted by the workspace service.',
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  }
  return result;
});

  // Phase 6 — Agent Fabric Health
  ipcMain.handle('fabric:status', async () => getFabricStatus());
  ipcMain.handle('fabric:healthProbe', async () => getFabricStatus());
  ipcMain.handle('fabric:installStatus', async () => getPaperclipInstallStatus());

  // Phase 14 — Realtime Capture Capability Proof
  ipcMain.handle('media:captureStatus', async () => getMediaCaptureStatus());
  ipcMain.handle('media:requestAccess', async (_event, kind: MediaRequestKind) => requestMediaAccess(kind));
  ipcMain.handle('media:openPrivacySettings', async (_event, kind: MediaCaptureKind) => {
    if (process.platform !== 'darwin') return;
    const anchor =
      kind === 'microphone' ? 'Privacy_Microphone'
      : kind === 'camera' ? 'Privacy_Camera'
      : 'Privacy_ScreenCapture';
    await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${anchor}`);
  });
  ipcMain.handle('realtime:rooms', async () => {
    const { listRealtimeRooms } = await import('./teamforge.js');
    return listRealtimeRooms();
  });
  ipcMain.handle('realtime:roomDetail', async (_event, roomId: string) => {
    const { getRealtimeRoomDetail } = await import('./teamforge.js');
    return getRealtimeRoomDetail(roomId);
  });
  ipcMain.handle('realtime:joinRoom', async (_event, roomId: string, input: RealtimeJoinInput) => {
    const { joinRealtimeRoom } = await import('./teamforge.js');
    return joinRealtimeRoom(roomId, input);
  });
  ipcMain.handle('realtime:publishTrack', async (_event, callId: string, input: RealtimeTrackInput) => {
    const { publishRealtimeTrack } = await import('./teamforge.js');
    return publishRealtimeTrack(callId, input);
  });
  ipcMain.handle('realtime:closeTrack', async (_event, callId: string, trackId: string) => {
    const { closeRealtimeTrack } = await import('./teamforge.js');
    return closeRealtimeTrack(callId, trackId);
  });
  ipcMain.handle('realtime:leaveCall', async (_event, callId: string, participantId: string) => {
    const { leaveRealtimeCall } = await import('./teamforge.js');
    return leaveRealtimeCall(callId, participantId);
  });
  ipcMain.handle('realtime:endCall', async (_event, callId: string) => {
    const { endRealtimeCall } = await import('./teamforge.js');
    return endRealtimeCall(callId);
  });
  ipcMain.handle('realtime:closeout', async (_event, callId: string, payload: RealtimeCloseoutPayload) => {
    const { closeoutRealtimeCall } = await import('./teamforge.js');
    const result = await closeoutRealtimeCall(callId, payload);
    if (!result.ok) {
      await recordOptionalFailure({
        kind: 'paperclip_closeout',
        status: 'failed',
        title: 'Meeting closeout failed',
        payload: { callId, payload },
        error: result.message ?? 'Meeting closeout failed.',
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    } else if (payload.sendToPaperclip && result.meeting?.paperclipStatus === 'failed') {
      await recordOptionalFailure({
        kind: 'paperclip_memory',
        status: 'failed',
        title: 'Paperclip meeting memory failed',
        payload: { callId, payload, meetingId: result.meeting.id },
        error: 'Meeting record saved, but Paperclip handoff failed.',
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    } else if (payload.sendToPaperclip && result.meeting?.paperclipStatus === 'queued') {
      await recordHandoff({
        kind: 'paperclip_memory',
        status: 'pending',
        title: 'Paperclip meeting memory queued',
        payload: { callId, payload, meetingId: result.meeting.id },
        error: null,
      });
    }
    return result;
  });

  // 0.4.0 — Co-working presence
  ipcMain.handle('coworking:floor', async () => {
    const { getCoworkingFloor } = await import('./teamforge.js');
    return getCoworkingFloor();
  });
  ipcMain.handle('coworking:lounge', async () => {
    const { getCoworkingLounge } = await import('./teamforge.js');
    return getCoworkingLounge();
  });

  // Phase 7 — Member Provisioning
  guardedHandle('member:provision', undefined, async () => {
    const { provisionMember } = await import('./teamforge.js');
    return provisionMember();
  });
  guardedHandle('member:setup', undefined, async () => {
    try {
      const { getAccessJwt, provisionMember } = await import('./teamforge.js');
      const provisioned = await provisionMember();
      if (!provisioned.ok || !provisioned.bundle) return { ok: false, message: provisioned.message || 'Provision failed' };
      const { memberId, memberName } = provisioned.bundle;
      const memberEmail = provisioned.bundle.email ?? '';
      const repoRoot = await getSetting('tf.paperclipRepoRoot');
      if (!repoRoot) return { ok: false, message: 'Paperclip repo root not configured. Provision first.' };
      const script = path.join(repoRoot, 'scripts', 'setup-member.sh');
      if (!existsSync(script)) return { ok: false, message: `setup-member.sh not found at ${script}` };
      const setupArgs = [script, '--id', memberId, '--name', memberName];
      if (memberEmail) setupArgs.push('--email', memberEmail);
      const accessJwt = await getAccessJwt();
      const baseUrl = await getSetting('tf.baseUrl');
      const result = await new Promise<{ ok: boolean; output: string }>((resolve) => {
        const child = spawn('bash', setupArgs, {
          cwd: repoRoot,
          env: {
            ...process.env,
            PAPERCLIP_MEMBER_ID: memberId,
            PAPERCLIP_MEMBER_NAME: memberName,
            ...(memberEmail ? { PAPERCLIP_MEMBER_EMAIL: memberEmail } : {}),
            ...(accessJwt ? { CF_ACCESS_JWT: accessJwt } : {}),
            ...(baseUrl ? { TF_API_BASE_URL: baseUrl } : {}),
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const finish = (r: { ok: boolean; output: string }) => {
          if (!settled) {
            settled = true;
            if (timeout) clearTimeout(timeout);
            resolve(r);
          }
        };
        timeout = setTimeout(() => { child.kill('SIGTERM'); finish({ ok: false, output: [stdout, stderr, 'Timed out after 60s'].filter(Boolean).join('\n') }); }, 60000);
        child.stdout.on('data', (c) => { stdout += c; });
        child.stderr.on('data', (c) => { stderr += c; });
        child.on('error', (e) => finish({ ok: false, output: String(e) }));
        child.on('close', (code) => finish({ ok: code === 0, output: [stdout.trim(), stderr.trim()].filter(Boolean).join('\n') }));
      });
      return { ok: result.ok, output: result.output, message: result.ok ? `Setup complete for ${memberName}` : 'Setup failed' };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  });

  // Phase 9 — Member Preferences
  ipcMain.handle('member:preferencesGet', async () => {
    const { getMemberPreferences } = await import('./teamforge.js');
    return getMemberPreferences();
  });
  ipcMain.handle('member:preferencesSet', async (_event, prefs: Record<string, unknown>) => {
    const { setMemberPreferences } = await import('./teamforge.js');
    const result = await setMemberPreferences(prefs);
    if (!result.ok) {
      await recordOptionalFailure({
        kind: 'preferences_save',
        status: 'failed',
        title: 'Preferences save failed',
        payload: { preferences: prefs },
        error: result.message ?? 'Workspace preferences save failed.',
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }
    return result;
  });

  // App-wide resilience handoffs
  ipcMain.handle('handoff:list', async (_event, status?: HandoffStatus) => listHandoffs(status));
  ipcMain.handle('handoff:record', async (_event, input: HandoffInput) => recordHandoff(input));
  ipcMain.handle('handoff:retry', async (_event, id: string) => retryHandoff(id));
