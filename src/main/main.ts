import { app, BrowserWindow, desktopCapturer, ipcMain, session, shell, systemPreferences } from 'electron';
import { createTray, updateTrayMenu, destroyTray } from './tray.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';
import { startIdleDetection, stopIdleDetection, handleIdleAction } from './idle.js';
import { startFocusNudgeLoop, stopFocusNudgeLoop } from './focus-nudge.js';
import { startApiServer, stopApiServer } from './api-server.js';
import { startAutoBackup, stopAutoBackup } from './backup.js';
import { getFabricStatus, getPaperclipInstallStatus } from './fabric.js';
import { initAutoUpdates, getUpdateStatus, checkForUpdates, downloadUpdate, installUpdateAndRestart } from './updates.js';
import {
  getTimerState,
  normalizeTargetSeconds,
  pauseRunningEntry,
  resumeRunningEntry,
  stopRunningEntry,
  timerStateFromEntry,
} from './timer-session.js';
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
  insertBreakworkPrompt, listGitHubActivity, upsertGitHubActivity, upsertReviewCycle, upsertStandupEvidenceRecord,
} from '../db/database.js';
import { computeEvidenceSummary, matchedActivityIdsForEntry } from './evidence.js';
import type {
  HandoffInput,
  HandoffStatus,
  BreakworkCategory,
  BreakworkPrompt,
  GitHubActivity,
  GitHubRepoOption,
  MediaCaptureKind,
  MediaCaptureStatus,
  MediaPermissionState,
  MediaRequestKind,
  OnboardingStateValue,
  TimeEntry,
  Project,
  PlexusSettings,
  RealtimeCloseoutPayload,
  RealtimeJoinInput,
  RealtimeTrackInput,
  ReviewCycle,
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
  TimerState,
  WorkEvidenceSummary,
} from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;

async function assertActiveAdminSession(): Promise<void> {
  const { getSession } = await import('./teamforge.js');
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    throw new Error('An active admin session is required for this action.');
  }
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openValidatedExternalUrl(url);
    return { action: 'deny' };
  });

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
    console.warn('[navigation] failed to open external URL', err);
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
    console.warn('[handoff] failed to record optional failure', err);
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
  for (const entry of entries.filter((item) => item.projectId === projectId)) {
    if (!entry.githubRepoFullName) {
      await updateEntry(entry.id, {
        evidenceStatus: 'legacy_unverified',
        evidenceCheckedAt: checkedAt,
        githubActivityIds: [],
      });
      continue;
    }
    const ids = matchedActivityIdsForEntry(entry, cachedActivity, new Date(checkedAt));
    if (ids.length > 0) matched += 1;
    await updateEntry(entry.id, {
      evidenceStatus: ids.length > 0 ? 'matched' : 'missing',
      evidenceCheckedAt: checkedAt,
      githubActivityIds: ids,
    });
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

// IPC Handlers
ipcMain.handle('timer:start', async (_event, projectId: string, description: string, targetSeconds?: number): Promise<TimeEntry> => {
  const project = await requireVerifiedRepoProject(projectId);
  const running = await getRunningEntry();
  if (running) {
    await stopRunningEntry();
  }
  const entry: TimeEntry = {
    id: randomUUID(),
    projectId,
    description,
    startTime: new Date().toISOString(),
    durationSeconds: 0,
    targetSeconds: normalizeTargetSeconds(targetSeconds),
    pausedSeconds: 0,
    tags: [],
    source: 'timer',
    githubRepoUrl: project.githubRepoUrl,
    githubRepoFullName: project.githubRepoFullName,
    evidenceStatus: 'pending',
    evidenceCheckedAt: null,
    githubActivityIds: [],
  };
  await insertEntry(entry);
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

ipcMain.handle('report:daily', async (_event, date: string) => {
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  const entries = await listEntries(from, to);
  const projects = await listProjects();
  const total = entries.reduce((s, e) => s + e.durationSeconds, 0);
  const projBreakdown: Record<string, number> = {};
  for (const e of entries) projBreakdown[e.projectId] = (projBreakdown[e.projectId] || 0) + e.durationSeconds;
  return { date, entries, totalSeconds: total, entryCount: entries.length, projectBreakdown: projBreakdown, evidenceSummary: computeEvidenceSummary(entries, projects) };
});

ipcMain.handle('report:weekly', async (_event, weekStart: string) => {
  const days: any[] = [];
  const projects = await listProjects();
  const start = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const from = `${dateStr}T00:00:00.000Z`;
    const to = `${dateStr}T23:59:59.999Z`;
    const entries = await listEntries(from, to);
    days.push({
      date: dateStr,
      entries,
      totalSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
    });
  }
  const total = days.reduce((s, d) => s + d.totalSeconds, 0);
  const allEntries = days.flatMap((d: any) => d.entries || []);
  const projBreakdown: Record<string, number> = {};
  for (const e of allEntries) projBreakdown[e.projectId] = (projBreakdown[e.projectId] || 0) + e.durationSeconds;
  return { weekStart, days, totalSeconds: total, entryCount: allEntries.length, projectBreakdown: projBreakdown, evidenceSummary: computeEvidenceSummary(allEntries, projects) };
});

ipcMain.handle('report:monthly', async (_event, month: string) => {
  const projects = await listProjects();
  const [year, mon] = month.split('-').map(Number);
  const weeks: any[] = [];
  const firstDay = new Date(Date.UTC(year, mon - 1, 1));
  const lastDay = new Date(Date.UTC(year, mon, 0));
  let current = new Date(firstDay);
  while (current.getDay() !== 1) {
    current.setDate(current.getDate() - 1);
  }
  while (current <= lastDay) {
    const ws = current.toISOString().slice(0, 10);
    const start = new Date(ws);
    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const from = `${ds}T00:00:00.000Z`;
      const to = `${ds}T23:59:59.999Z`;
      const entries = await listEntries(from, to);
      days.push({ date: ds, entries, totalSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0) });
    }
    const wTotal = days.reduce((s, d) => s + d.totalSeconds, 0);
    weeks.push({ weekStart: ws, days, totalSeconds: wTotal });
    current.setDate(current.getDate() + 7);
  }
  const allEntries = await listEntries(`${month}-01T00:00:00.000Z`, `${month}-31T23:59:59.999Z`);
  const projBreakdown: Record<string, number> = {};
  for (const e of allEntries) {
    projBreakdown[e.projectId] = (projBreakdown[e.projectId] || 0) + e.durationSeconds;
  }
  const total = weeks.reduce((s, w) => s + w.totalSeconds, 0);
  return { month, weeks, totalSeconds: total, entryCount: allEntries.length, projectBreakdown: projBreakdown, evidenceSummary: computeEvidenceSummary(allEntries, projects) };
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
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  const [entries, projects] = await Promise.all([listEntries(from, to), listProjects()]);
  const activity = (await Promise.all(
    projects
      .filter((project) => project.githubRepoFullName)
      .map((project) => listGitHubActivity(project.id, from, to)),
  )).flat();
  const record = {
    id: `standup_${date}`,
    date,
    totalSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
    evidenceSummary: computeEvidenceSummary(entries, projects),
    activity,
    generatedAt: new Date().toISOString(),
  };
  await upsertStandupEvidenceRecord(record);
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

async function readSettings(): Promise<PlexusSettings> {
  let breakworkCategories: BreakworkCategory[] = ['mental_reset', 'physical_reset', 'eye_rest'];
  let rhythmProfile = { enabled: false };
  let profile = {};
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
    agentSessionScanEnabled: (await getSetting('agentSessionScanEnabled')) === 'true',
    agentSessionConsentAt: (await getSetting('agentSessionConsentAt')) || null,
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
  return readSettings();
});

ipcMain.handle('updates:getStatus', async () => getUpdateStatus());
ipcMain.handle('updates:check', async () => checkForUpdates());
ipcMain.handle('updates:download', async () => downloadUpdate());
ipcMain.handle('updates:install', async () => installUpdateAndRestart());

// Workspace Worker control plane (Phase 1)
ipcMain.handle('worker:configGet', async () => {
  const { getWorkerConfig } = await import('./teamforge.js');
  return getWorkerConfig();
});
ipcMain.handle('worker:configSet', async (_event, cfg: { baseUrl?: string; workspaceId?: string; token?: string }) => {
  const { setWorkerConfig } = await import('./teamforge.js');
  return setWorkerConfig(cfg);
});
ipcMain.handle('worker:status', async () => {
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
ipcMain.handle('thoughtseed:bridgeStatus', async (): Promise<ThoughtseedBridgeStatus> => {
  const { getThoughtseedBridgeStatus } = await import('./thoughtseed-bridge.js');
  return getThoughtseedBridgeStatus();
});
ipcMain.handle('thoughtseed:redeemInvite', async (_event, input: { invite: string; bridgeApiUrl?: string }): Promise<ThoughtseedBridgeRedeemResult> => {
  try {
    const { redeemThoughtseedInvite } = await import('./thoughtseed-bridge.js');
    return await redeemThoughtseedInvite(normalizeBridgeRedeemInput(input));
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge invite redeem failed', err);
    throw err;
  }
});
ipcMain.handle('thoughtseed:sendHeartbeat', async (): Promise<ThoughtseedBridgeHeartbeatResult> => {
  try {
    const { sendThoughtseedHeartbeat } = await import('./thoughtseed-bridge.js');
    return await sendThoughtseedHeartbeat();
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge heartbeat failed', err);
    throw err;
  }
});
ipcMain.handle('thoughtseed:pollDirectives', async (): Promise<ThoughtseedBridgePollResult> => {
  try {
    const { pollThoughtseedDirectives } = await import('./thoughtseed-bridge.js');
    return await pollThoughtseedDirectives();
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge directive poll failed', err);
    throw err;
  }
});
ipcMain.handle('thoughtseed:ackDirectives', async (_event, ids: string[]): Promise<ThoughtseedBridgeAckResult> => {
  try {
    const { ackThoughtseedDirectives } = await import('./thoughtseed-bridge.js');
    return await ackThoughtseedDirectives(normalizeDirectiveIds(ids));
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge directive ack failed', err);
    throw err;
  }
});
ipcMain.handle('thoughtseed:rotateBridgeToken', async (): Promise<ThoughtseedBridgeRotateResult> => {
  try {
    const { rotateThoughtseedBridgeToken } = await import('./thoughtseed-bridge.js');
    return await rotateThoughtseedBridgeToken();
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed bridge token rotation failed', err);
    throw err;
  }
});
ipcMain.handle('thoughtseed:disconnectBridge', async (): Promise<ThoughtseedBridgeStatus> => {
  const { disconnectThoughtseedBridge } = await import('./thoughtseed-bridge.js');
  return disconnectThoughtseedBridge();
});
ipcMain.handle('thoughtseed:fabricTasks', async (): Promise<ThoughtseedFabricTaskListResult> => {
  const { listThoughtseedFabricTasks } = await import('./thoughtseed-bridge.js');
  return listThoughtseedFabricTasks();
});
ipcMain.handle('thoughtseed:syncFabricTasks', async (): Promise<ThoughtseedFabricTaskSyncResult> => {
  try {
    const { syncThoughtseedFabricTasks } = await import('./thoughtseed-bridge.js');
    return await syncThoughtseedFabricTasks();
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed Fabric task sync failed', err);
    throw err;
  }
});
ipcMain.handle('thoughtseed:setFabricTaskWorkMode', async (_event, taskId: string, workMode: ThoughtseedFabricTaskWorkMode): Promise<ThoughtseedFabricWorkModeResult> => {
  try {
    const { setThoughtseedFabricTaskWorkMode } = await import('./thoughtseed-bridge.js');
    return await setThoughtseedFabricTaskWorkMode(
      requiredString(taskId, 'Fabric task id', 512),
      fabricTaskWorkModeValue(workMode),
    );
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed Fabric task work mode update failed', err);
    throw err;
  }
});
ipcMain.handle('thoughtseed:reportFabricTask', async (_event, input: ThoughtseedFabricTaskReportInput): Promise<ThoughtseedFabricTaskReportResult> => {
  try {
    const { reportThoughtseedFabricTask } = await import('./thoughtseed-bridge.js');
    return await reportThoughtseedFabricTask(normalizeFabricTaskReportInput(input));
  } catch (err) {
    await recordThoughtseedBridgeFailure('Thoughtseed Fabric task report failed', err);
    throw err;
  }
});
ipcMain.handle('auth:login', async (_event, email: string) => {
  const m = await import('./teamforge.js');
  const res = await m.login(email);
  if (res.ok) m.flushTimeEntries().catch(() => {});
  return res;
});
ipcMain.handle('auth:accessLogin', async () => {
  const m = await import('./teamforge.js');
  const res = await m.loginWithAccess();
  if (res.ok) m.flushTimeEntries().catch(() => {});
  return res;
});
ipcMain.handle('auth:session', async () => {
  const { getSession } = await import('./teamforge.js');
  return getSession();
});
ipcMain.handle('auth:refreshSession', async () => {
  const { refreshSession } = await import('./teamforge.js');
  return refreshSession();
});
ipcMain.handle('auth:logout', async () => {
  const { logout } = await import('./teamforge.js');
  return logout();
});
// Debug: test JWT directly
ipcMain.handle('auth:testJwt', async () => {
  const { testJwt } = await import('./teamforge.js');
  return testJwt();
});
ipcMain.handle('projects:sync', async () => {
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
ipcMain.handle('backup:list', async () => {
  const { listBackups } = await import('./backup.js');
  return listBackups();
});

ipcMain.handle('backup:restore', async (_event, backupPath: string) => {
  const { restoreBackup } = await import('./backup.js');
  return restoreBackup(backupPath);
});

ipcMain.handle('backup:run', async () => {
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
  ipcMain.handle('member:provision', async () => {
    const { provisionMember } = await import('./teamforge.js');
    return provisionMember();
  });
  ipcMain.handle('member:setup', async () => {
    try {
      const { provisionMember } = await import('./teamforge.js');
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
      const accessJwt = await getSetting('tf.accessJwt');
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
