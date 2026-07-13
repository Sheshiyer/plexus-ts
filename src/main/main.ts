import { app, BrowserWindow, desktopCapturer, ipcMain, session, shell, systemPreferences } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { createTray, updateTrayMenu, destroyTray } from './tray.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';
import { startIdleDetection, stopIdleDetection, handleIdleAction } from './idle.js';
import { startFocusNudgeLoop, stopFocusNudgeLoop } from './focus-nudge.js';
import { startApiServer, stopApiServer } from './api-server.js';
import { startAutoBackup, stopAutoBackup } from './backup.js';
import {
  expectPayloadCount,
  expectSinglePayload,
  guardedIpcHandle,
  isAllowedIpcSenderUrl,
  type IpcPayloadSchema,
} from './ipc-security.js';
import { registerDefaultSessionMediaAuthorization } from './media-authorization.js';
import { bindWindowObservability, installMainProcessObservability } from './observability.js';
import { redactForLog } from './redaction.js';
import { getFabricStatus, getPaperclipInstallStatus } from './fabric.js';
import { initAutoUpdates, getUpdateStatus, checkForUpdates, downloadUpdate, installUpdateAndRestart, stopAutomaticUpdateChecks } from './updates.js';
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
import { assistantIntentExpiresAt, cancelAssistantIntent, confirmAssistantIntent, executeAssistantTool, generateStandupEvidenceRecord } from './assistant-tools.js';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { sanitizedChildProcessEnv } from './child-process-environment.js';
import { validatedGitHubOAuthAuthorizeUrl } from './github-oauth-authorization.js';
import {
  closeDb, getDb, listProjects, insertProject, updateProject, deleteProject,
  getProject, listEntries, insertEntry, updateEntry, deleteEntry, getRunningEntry,
  getSetting, setSetting,
  getHandoff, listHandoffs, recordHandoff, updateHandoff,
  countAssistantDailyEventsByStatus, insertAssistantIntent, insertAssistantMessage, insertAssistantModelUsage,
  getDailyProofPacketByDate, getStandupEvidenceRecord, insertBreakworkPrompt, listAssistantDailyEvents, listAssistantModelUsage, listFabricTasks, listGitHubActivity, upsertDailyProofPacket, upsertFabricTask, upsertGitHubActivity, upsertProofCustodyRecord,
} from '../db/database.js';
import { computeEvidenceSummary, matchedActivitiesForEntry, provenanceForGitHubActivities } from './evidence.js';
import { buildDailyProofPacket, buildDailyReport, buildFabricTaskProofSummary, filterFabricTasksForEntries, upgradeFabricTasksWithGitHubEvidence, utcReportDayRange } from './proof-report.js';
import { hasVerifiedGitHubRepository, projectPatchAfterGitHubActivityFailure } from '../shared/github-repository-authority.js';
import { persistGitHubCiEvidence } from './github-ci-evidence.js';
import { normalizeMemberUsageSignal, prepareTimerStopUsageSignal, retryUsageSignalFromHandoffPayload } from './usage-signal.js';
import { generateReviewCycle } from './review-cycle.js';
import type {
  AssistantAskResult,
  AssistantContextScope,
  AssistantContextDiagnosticsSnapshot,
  AssistantDailyOutboxDiagnostics,
  AssistantIntentActionResult,
  AssistantModelCatalog,
  AssistantModelHealthRequest,
  AssistantModelHealthResult,
  AssistantModelProvider,
  AssistantModelSettingsInput,
  AssistantModelStatus,
  AssistantModelUsageRecord,
  AssistantStatus,
  AssistantStreamEvent,
  AssistantSuggestion,
  AssistantSuggestionsRequest,
  AssistantTurnRequest,
  AdminProofCockpitSnapshot,
  AdminProofOpsDrilldownOpenResult,
  AdminProofOpsDrilldownTarget,
  AdminProofReleaseHealthSignal,
  HandoffInput,
  HandoffStatus,
  BreakworkCategory,
  BreakworkPrompt,
  DailyProofPacket,
  DailyReport,
  GitHubActivity,
  GitHubActivitySyncResult,
  FounderGitHubSetupIntent,
  GitHubActorEnrollStartResult,
  GitHubActorStatus,
  GitHubConnectionStatus,
  GitHubConnectStartResult,
  GitHubRepositoryListResult,
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
  TemperanceDispatchLaneStatusResult,
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
import {
  argvRequestsFounderGitHubSetup,
  founderGitHubSetupIntent,
  isFounderGitHubSetupRequest,
} from '../shared/founder-github-setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const productionRendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
const productionRendererUrl = pathToFileURL(productionRendererPath).href;

let mainWindow: BrowserWindow | null = null;
let pendingFounderGitHubSetup = argvRequestsFounderGitHubSetup(process.argv);
let timerInterval: ReturnType<typeof setInterval> | null = null;
let monthlyReviewDirectiveInterval: ReturnType<typeof setInterval> | null = null;
let monthlyReviewDirectivePollInFlight = false;
let allowedIpcRendererLocation = isDev
  ? safeUrlOrigin(process.env.PLEXUS_DEV_SERVER_URL?.trim() || 'http://127.0.0.1:5173', 'http://127.0.0.1:5173')
  : productionRendererUrl;

installMainProcessObservability(app);

function guardedHandle<Args extends unknown[], Result>(
  channel: string,
  schema: ((args: readonly unknown[], channel: string) => Args) | undefined,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => Result | Promise<Result>,
): void {
  guardedIpcHandle(ipcMain, channel, {
    getAllowedRendererOrigin: () => allowedIpcRendererLocation,
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

async function activeMemberSession(): Promise<Session> {
  const { getSession } = await import('./teamforge.js');
  const session = await getSession();
  if (!session) throw new Error('An active workspace session is required for this action.');
  return session;
}

async function assertActiveAdminSession(): Promise<void> {
  await activeAdminSession();
}

function buildAdminReleaseHealthSnapshot(checkedAt: string): AdminProofReleaseHealthSignal {
  const ciWorkflow = existsSync(path.join(process.cwd(), '.github/workflows/ci.yml'));
  const releaseWorkflow = existsSync(path.join(process.cwd(), '.github/workflows/release.yml'));
  const releaseEvidencePolicy = existsSync(path.join(process.cwd(), 'docs/RELEASE_EVIDENCE.md'));
  const releaseGateEvidence = existsSync(path.join(process.cwd(), 'docs/evidence/2026-07-02-assistant-runtime-release-gates.md'));
  const criticalReady = ciWorkflow && releaseWorkflow && releaseEvidencePolicy;
  const gate: AdminProofReleaseHealthSignal['gate'] = criticalReady && releaseGateEvidence
    ? 'green'
    : criticalReady
      ? 'unknown'
      : 'red';
  const missing = [
    ['CI workflow', ciWorkflow],
    ['Release workflow', releaseWorkflow],
    ['release evidence policy', releaseEvidencePolicy],
    ['release gate evidence', releaseGateEvidence],
  ].filter(([, present]) => !present).map(([label]) => label);
  return {
    gate,
    source: 'local release policy files',
    checkedAt,
    detail: gate === 'green'
      ? 'CI workflow, release workflow, evidence policy, and release gate evidence are present.'
      : gate === 'unknown'
        ? `Release policy is present; ${missing.join(', ')} still needs a live receipt.`
        : `Release gate is red: missing ${missing.join(', ')}.`,
    ciWorkflow,
    releaseWorkflow,
    releaseEvidencePolicy,
    releaseGateEvidence,
    ciEvidenceCount: 0,
    ciSuccessfulCount: 0,
    ciFailedCount: 0,
    ciPendingCount: 0,
    ciLatestConclusion: 'none',
    ciEvidenceCheckedAt: null,
  };
}

const ADMIN_PROOF_DRILLDOWN_TARGETS: Record<AdminProofOpsDrilldownTarget, {
  kind: 'file' | 'url';
  target: string;
}> = {
  release_docs: {
    kind: 'file',
    target: 'docs/RELEASE_EVIDENCE.md',
  },
  ci_evidence: {
    kind: 'file',
    target: '.github/workflows/ci.yml',
  },
  issue_hub: {
    kind: 'url',
    target: 'https://github.com/Sheshiyer/plexus-ts/issues/49',
  },
};

async function openAdminProofDrilldownTarget(id: AdminProofOpsDrilldownTarget): Promise<AdminProofOpsDrilldownOpenResult> {
  const target = ADMIN_PROOF_DRILLDOWN_TARGETS[id];
  if (target.kind === 'url') {
    await shell.openExternal(target.target);
    return { ok: true, id, target: target.target };
  }

  const absolutePath = path.resolve(process.cwd(), target.target);
  if (!existsSync(absolutePath)) {
    return { ok: false, id, target: target.target, message: `${target.target} is not present in this checkout.` };
  }
  const message = await shell.openPath(absolutePath);
  return { ok: !message, id, target: target.target, ...(message ? { message } : {}) };
}

function dispatchFounderGitHubSetup(): void {
  const intent = founderGitHubSetupIntent();
  if (!mainWindow || mainWindow.webContents.isLoading()) {
    pendingFounderGitHubSetup = true;
    return;
  }
  pendingFounderGitHubSetup = false;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('github:founderSetupRequested', intent);
}

app.on('open-url', (event, url) => {
  let protocol = '';
  try {
    protocol = new URL(url).protocol;
  } catch {
    return;
  }
  if (protocol !== 'plexus:') return;
  event.preventDefault();
  if (!isFounderGitHubSetupRequest(url)) {
    console.warn('[github-founder-setup] rejected unsupported Plexus protocol route');
    return;
  }
  dispatchFounderGitHubSetup();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (argvRequestsFounderGitHubSetup(argv)) {
      dispatchFounderGitHubSetup();
      return;
    }
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
  const allowedRendererLocation = isDev
    ? safeUrlOrigin(devServerUrl, 'http://127.0.0.1:5173')
    : productionRendererUrl;
  allowedIpcRendererLocation = allowedRendererLocation;

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openValidatedExternalUrl(url);
    return { action: 'deny' };
  });
  bindWindowObservability(mainWindow);

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedRendererNavigation(url, allowedRendererLocation)) return;
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

  initAutoUpdates(mainWindow, {
    beforeInstall: async () => {
      await stopRunningEntry();
    },
  });
}

function safeUrlOrigin(url: string, fallback: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return new URL(fallback).origin;
  }
}

function isAllowedRendererNavigation(url: string, allowedRendererLocation: string): boolean {
  return isAllowedIpcSenderUrl(url, allowedRendererLocation);
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

async function openWorkerGitHubOAuth(rawAuthorizeUrl: unknown): Promise<void> {
  const { getWorkerConfig } = await import('./teamforge.js');
  const worker = await getWorkerConfig();
  const authorizeUrl = validatedGitHubOAuthAuthorizeUrl(rawAuthorizeUrl, worker.baseUrl);
  if (!authorizeUrl) throw new Error('Workspace Worker returned an invalid GitHub OAuth authorization request.');
  await shell.openExternal(authorizeUrl);
}

app.whenReady().then(async () => {
  if (app.isPackaged) app.setAsDefaultProtocolClient('plexus');
  await getDb();
  if (process.env.PLEXUS_PACKAGED_SQLITE_SMOKE === '1') {
    console.log('[packaged-sqlite-smoke] database initialized');
    await closeDb();
    app.exit(0);
    return;
  }
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
  startMonthlyReviewDirectiveLoop();
  setInterval(() => { import('./teamforge.js').then(m => m.flushTimeEntries()).catch(() => {}); }, 5 * 60 * 1000);
  import('./assistant-daily.js').then(m => m.flushAssistantDailyEvents()).catch(() => {});
  setInterval(() => { import('./assistant-daily.js').then(m => m.flushAssistantDailyEvents()).catch(() => {}); }, 5 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err) => {
  console.error('[startup] failed before application readiness', redactForLog(err));
  app.exit(1);
});

app.on('window-all-closed', () => {
  if (timerInterval) clearInterval(timerInterval);
  destroyTray();
  unregisterShortcuts();
  stopIdleDetection();
  stopFocusNudgeLoop();
  stopApiServer();
  stopAutoBackup();
  if (process.platform !== 'darwin') {
    stopMonthlyReviewDirectiveLoop();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopAutomaticUpdateChecks();
  stopMonthlyReviewDirectiveLoop();
  void stopRunningEntry().catch((err) => {
    console.warn('[lifecycle] failed to stop the running entry before quit', redactForLog(err));
  });
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

function startMonthlyReviewDirectiveLoop(): void {
  if (monthlyReviewDirectiveInterval) return;
  const poll = () => {
    if (monthlyReviewDirectivePollInFlight) return;
    monthlyReviewDirectivePollInFlight = true;
    import('./thoughtseed-bridge.js')
      .then(async (bridge) => {
        const status = await bridge.getThoughtseedBridgeStatus();
        if (status.connected) await bridge.processThoughtseedMonthlyReviewDirectives();
      })
      .catch((err) => console.warn('[monthly-review] directive poll failed', redactForLog(err)))
      .finally(() => { monthlyReviewDirectivePollInFlight = false; });
  };
  poll();
  monthlyReviewDirectiveInterval = setInterval(poll, 5 * 60 * 1000);
}

function stopMonthlyReviewDirectiveLoop(): void {
  if (!monthlyReviewDirectiveInterval) return;
  clearInterval(monthlyReviewDirectiveInterval);
  monthlyReviewDirectiveInterval = null;
}

async function recordOptionalFailure(input: HandoffInput): Promise<void> {
  try {
    await recordHandoff({ ...input, status: input.status ?? 'failed' });
  } catch (err) {
    console.warn('[handoff] failed to record optional failure', redactForLog(err));
  }
}

function hasVerifiedRepo(project: Project | null): boolean {
  return hasVerifiedGitHubRepository(project);
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

function boundedRecord(value: unknown, label: string, maxLength = 65_536): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new Error(`${label} must be an object.`);
  let encoded = '';
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new Error(`${label} must be serializable.`);
  }
  if (encoded.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or less.`);
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}

function finiteNumber(
  value: unknown,
  label: string,
  options: { minimum?: number; maximum?: number; integer?: boolean } = {},
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  if (options.integer && !Number.isInteger(value)) throw new Error(`${label} must be an integer.`);
  if (options.minimum !== undefined && value < options.minimum) throw new Error(`${label} must be at least ${options.minimum}.`);
  if (options.maximum !== undefined && value > options.maximum) throw new Error(`${label} must be at most ${options.maximum}.`);
  return value;
}

function optionalFiniteNumber(
  value: unknown,
  label: string,
  options: { minimum?: number; maximum?: number; integer?: boolean } = {},
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return finiteNumber(value, label, options);
}

function optionalNullableString(value: unknown, label: string, maxLength = 2048): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return optionalSettingString(value, label, maxLength) ?? '';
}

function stringList(value: unknown, label: string, maximumItems = 100, maximumItemLength = 512): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list.`);
  if (value.length > maximumItems) throw new Error(`${label} must contain ${maximumItems} items or less.`);
  return value.map((item, index) => requiredString(item, `${label} item ${index + 1}`, maximumItemLength));
}

function enumValue<const T extends readonly string[]>(value: unknown, label: string, allowed: T): T[number] {
  if (typeof value === 'string' && allowed.includes(value)) return value as T[number];
  throw new Error(`${label} is invalid.`);
}

function singleStringSchema(label: string, maxLength = 512): IpcPayloadSchema<[string]> {
  return (args, channel) => expectSinglePayload(args, channel, value => requiredString(value, label, maxLength));
}

function optionalStringSchema(label: string, maxLength = 512): IpcPayloadSchema<[string | undefined]> {
  return (args, channel) => {
    expectPayloadCount(args, channel, 0, 1);
    return [optionalString(args[0], label, maxLength)];
  };
}

function twoStringSchema(
  firstLabel: string,
  secondLabel: string,
  firstMaxLength = 512,
  secondMaxLength = 2048,
): IpcPayloadSchema<[string, string]> {
  return (args, channel) => {
    expectPayloadCount(args, channel, 2);
    return [
      requiredString(args[0], firstLabel, firstMaxLength),
      requiredString(args[1], secondLabel, secondMaxLength),
    ];
  };
}

function recordSchema<T>(normalize: (value: unknown) => T): IpcPayloadSchema<[T]> {
  return (args, channel) => expectSinglePayload(args, channel, normalize);
}

type TimeEntryCreateInput = Omit<TimeEntry, 'id' | 'durationSeconds'> & { durationSeconds?: number };

function normalizeTimeEntryCreateInput(value: unknown): TimeEntryCreateInput {
  const input = boundedRecord(value, 'Time entry');
  const source = enumValue(input.source, 'Time entry source', ['manual', 'timer'] as const);
  const endTime = optionalNullableString(input.endTime, 'Time entry end time', 64);
  const targetSeconds = optionalFiniteNumber(input.targetSeconds, 'Target seconds', { minimum: 1, maximum: 31_536_000, integer: true });
  const durationSeconds = optionalFiniteNumber(input.durationSeconds, 'Duration seconds', { minimum: 0, maximum: 31_536_000, integer: true });
  return {
    projectId: requiredString(input.projectId, 'Project id', 512),
    description: requiredString(input.description, 'Time entry description', 5000),
    startTime: requiredString(input.startTime, 'Time entry start time', 64),
    ...(endTime !== undefined ? { endTime } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    ...(targetSeconds !== undefined ? { targetSeconds } : {}),
    tags: input.tags === undefined ? [] : stringList(input.tags, 'Time entry tags', 50, 160),
    source,
  };
}

function normalizeTimeEntryPatch(value: unknown): Partial<TimeEntry> {
  const input = boundedRecord(value, 'Time entry patch');
  const patch: Partial<TimeEntry> = {};
  if (input.projectId !== undefined) patch.projectId = requiredString(input.projectId, 'Project id', 512);
  if (input.description !== undefined) patch.description = requiredString(input.description, 'Time entry description', 5000);
  if (input.startTime !== undefined) patch.startTime = requiredString(input.startTime, 'Time entry start time', 64);
  if (input.endTime !== undefined) patch.endTime = optionalNullableString(input.endTime, 'Time entry end time', 64);
  if (input.durationSeconds !== undefined) patch.durationSeconds = finiteNumber(input.durationSeconds, 'Duration seconds', { minimum: 0, maximum: 31_536_000, integer: true });
  if (input.targetSeconds !== undefined) patch.targetSeconds = finiteNumber(input.targetSeconds, 'Target seconds', { minimum: 1, maximum: 31_536_000, integer: true });
  if (input.pausedAt !== undefined) patch.pausedAt = optionalNullableString(input.pausedAt, 'Pause timestamp', 64);
  if (input.pausedSeconds !== undefined) patch.pausedSeconds = finiteNumber(input.pausedSeconds, 'Paused seconds', { minimum: 0, maximum: 31_536_000, integer: true });
  if (input.tags !== undefined) patch.tags = stringList(input.tags, 'Time entry tags', 50, 160);
  if (input.source !== undefined) patch.source = enumValue(input.source, 'Time entry source', ['manual', 'timer'] as const);
  return patch;
}

function normalizeProjectCreateInput(value: unknown): Omit<Project, 'id' | 'createdAt'> {
  const input = boundedRecord(value, 'Project');
  const clientName = optionalString(input.clientName, 'Client name', 512);
  const githubRepoUrl = optionalNullableString(input.githubRepoUrl, 'GitHub repo URL', 2048);
  const repoEvidenceStatus = input.repoEvidenceStatus === undefined
    ? undefined
    : enumValue(input.repoEvidenceStatus, 'Repo evidence status', ['missing', 'unverified', 'verified', 'inaccessible', 'legacy_unverified'] as const);
  const evidenceStatus = input.evidenceStatus === undefined
    ? undefined
    : enumValue(input.evidenceStatus, 'Evidence status', ['pending', 'matched', 'missing', 'legacy_unverified', 'sync_failed'] as const);
  return {
    name: requiredString(input.name, 'Project name', 512),
    ...(clientName ? { clientName } : {}),
    color: requiredString(input.color, 'Project color', 64),
    archived: booleanValue(input.archived, 'Project archived state'),
    ...(githubRepoUrl !== undefined ? { githubRepoUrl } : {}),
    ...(repoEvidenceStatus !== undefined ? { repoEvidenceStatus } : {}),
    ...(input.repoRequired !== undefined ? { repoRequired: booleanValue(input.repoRequired, 'Project repo-required state') } : {}),
    ...(evidenceStatus !== undefined ? { evidenceStatus } : {}),
  };
}

function normalizeProjectPatch(value: unknown): Partial<Project> {
  const input = boundedRecord(value, 'Project patch');
  const patch: Partial<Project> = {};
  if (input.name !== undefined) patch.name = requiredString(input.name, 'Project name', 512);
  if (input.clientName !== undefined) patch.clientName = optionalString(input.clientName, 'Client name', 512);
  if (input.color !== undefined) patch.color = requiredString(input.color, 'Project color', 64);
  if (input.archived !== undefined) patch.archived = booleanValue(input.archived, 'Project archived state');
  if (input.repoRequired !== undefined) patch.repoRequired = booleanValue(input.repoRequired, 'Project repo-required state');
  return patch;
}

function normalizeAgentSessionAcceptInput(value: unknown): string | { candidateId: string; taskId?: string } {
  if (typeof value === 'string') return requiredString(value, 'Agent session candidate id', 512);
  const input = boundedRecord(value, 'Agent session acceptance');
  const taskId = optionalString(input.taskId, 'Task id', 512);
  return {
    candidateId: requiredString(input.candidateId, 'Agent session candidate id', 512),
    ...(taskId ? { taskId } : {}),
  };
}

function onboardingStateValue(value: unknown): OnboardingStateValue {
  if (value === 'required' || value === 'optional' || value === 'skipped' || value === 'deferred' || value === 'completed' || value === 'failed') {
    return value;
  }
  throw new Error('Onboarding state is invalid.');
}

function normalizeAdminDemoOnboardingUpdateArgs(args: readonly unknown[], channel: string): [string, string, OnboardingStateValue, Record<string, unknown> | undefined] {
  if (args.length < 3 || args.length > 4) throw new Error(`${channel} expects identity id, step id, state, and optional metadata.`);
  return [
    requiredString(args[0], 'Admin demo identity id', 256),
    requiredString(args[1], 'Onboarding step id', 256),
    onboardingStateValue(args[2]),
    safeMetadata(args[3]),
  ];
}

function adminProofOpsDrilldownTarget(value: unknown): AdminProofOpsDrilldownTarget {
  const id = requiredString(value, 'Admin proof drill-through target', 64);
  if (id === 'release_docs' || id === 'ci_evidence' || id === 'issue_hub') return id;
  throw new Error('Admin proof drill-through target is invalid.');
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

function normalizeBridgeRedeemInput(value: unknown): { invite: string } {
  if (!isPlainRecord(value)) throw new Error('Bridge invite payload is invalid.');
  return {
    invite: requiredString(value.invite, 'Invite token', 2048),
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

function normalizeSettingsPatch(value: unknown): Partial<PlexusSettings> {
  const input = boundedRecord(value, 'Settings patch', 131_072);
  const settings: Partial<PlexusSettings> = {};
  if (input.memberId !== undefined) settings.memberId = requiredString(input.memberId, 'Member id', 512);
  if (input.theme !== undefined) settings.theme = enumValue(input.theme, 'Theme', ['light', 'dark', 'system'] as const);
  if (input.defaultProjectId !== undefined) settings.defaultProjectId = requiredString(input.defaultProjectId, 'Default project id', 512);
  if (input.reminderIntervalMinutes !== undefined) settings.reminderIntervalMinutes = finiteNumber(input.reminderIntervalMinutes, 'Reminder interval', { minimum: 1, maximum: 1440, integer: true });
  if (input.syncEnabled !== undefined) settings.syncEnabled = booleanValue(input.syncEnabled, 'Sync enabled');
  if (input.soundNotificationsEnabled !== undefined) settings.soundNotificationsEnabled = booleanValue(input.soundNotificationsEnabled, 'Sound notifications enabled');
  if (input.voiceBreakworkEnabled !== undefined) settings.voiceBreakworkEnabled = booleanValue(input.voiceBreakworkEnabled, 'Voice breakwork enabled');
  if (input.notificationVolume !== undefined) settings.notificationVolume = finiteNumber(input.notificationVolume, 'Notification volume', { minimum: 0, maximum: 100 });
  if (input.quietHoursStart !== undefined) settings.quietHoursStart = optionalSettingString(input.quietHoursStart, 'Quiet hours start', 16);
  if (input.quietHoursEnd !== undefined) settings.quietHoursEnd = optionalSettingString(input.quietHoursEnd, 'Quiet hours end', 16);
  if (input.breakworkSnoozeMinutes !== undefined) settings.breakworkSnoozeMinutes = finiteNumber(input.breakworkSnoozeMinutes, 'Breakwork snooze', { minimum: 1, maximum: 120, integer: true });
  if (input.breakworkCategories !== undefined) {
    settings.breakworkCategories = stringList(input.breakworkCategories, 'Breakwork categories', 16, 64)
      .map(category => enumValue(category, 'Breakwork category', [
        'mental_reset', 'physical_reset', 'eye_rest', 'breathwork', 'mobility', 'hydration', 'meeting_decompression', 'transition',
      ] as const));
  }
  if (input.rhythmProfile !== undefined) settings.rhythmProfile = boundedRecord(input.rhythmProfile, 'Rhythm profile', 32_768) as unknown as PlexusSettings['rhythmProfile'];
  if (input.profile !== undefined) settings.profile = boundedRecord(input.profile, 'Member profile', 32_768) as unknown as PlexusSettings['profile'];
  if (input.agentSessionScanEnabled !== undefined) settings.agentSessionScanEnabled = booleanValue(input.agentSessionScanEnabled, 'Agent session scan enabled');
  if (input.agentSessionConsentAt !== undefined) settings.agentSessionConsentAt = optionalNullableString(input.agentSessionConsentAt, 'Agent session consent timestamp', 64);
  if (input.assistantEnabled !== undefined) settings.assistantEnabled = booleanValue(input.assistantEnabled, 'Assistant enabled');
  if (input.assistantModelProvider !== undefined) settings.assistantModelProvider = assistantModelProviderFromInput(input.assistantModelProvider);
  if (input.assistantGoogleModel !== undefined) settings.assistantGoogleModel = optionalSettingString(input.assistantGoogleModel, 'Google model', 256);
  if (input.assistantNvidiaModel !== undefined) settings.assistantNvidiaModel = optionalSettingString(input.assistantNvidiaModel, 'NVIDIA model', 256);
  if (input.assistantLocalModel !== undefined) settings.assistantLocalModel = optionalSettingString(input.assistantLocalModel, 'Local model', 256);
  if (input.assistantLocalBaseUrl !== undefined) settings.assistantLocalBaseUrl = optionalSettingString(input.assistantLocalBaseUrl, 'Local model base URL', 2048);
  if (input.assistantGoogleApiKey !== undefined) settings.assistantGoogleApiKey = optionalSettingString(input.assistantGoogleApiKey, 'Google API key', 8192);
  if (input.assistantNvidiaApiKey !== undefined) settings.assistantNvidiaApiKey = optionalSettingString(input.assistantNvidiaApiKey, 'NVIDIA API key', 8192);
  if (input.assistantClearGoogleKey !== undefined) settings.assistantClearGoogleKey = booleanValue(input.assistantClearGoogleKey, 'Clear Google key');
  if (input.assistantClearNvidiaKey !== undefined) settings.assistantClearNvidiaKey = booleanValue(input.assistantClearNvidiaKey, 'Clear NVIDIA key');
  if (input.assistantSessionScanEnabled !== undefined) settings.assistantSessionScanEnabled = booleanValue(input.assistantSessionScanEnabled, 'Assistant session scan enabled');
  if (input.assistantPaperclipEnrichmentEnabled !== undefined) settings.assistantPaperclipEnrichmentEnabled = booleanValue(input.assistantPaperclipEnrichmentEnabled, 'Assistant Paperclip enrichment enabled');
  return settings;
}

function normalizeRealtimeJoinInput(value: unknown): RealtimeJoinInput {
  const input = boundedRecord(value, 'Realtime join input', 262_144);
  let media: RealtimeJoinInput['media'];
  if (input.media !== undefined) {
    const rawMedia = boundedRecord(input.media, 'Realtime media selection', 4096);
    media = {
      ...(rawMedia.audio !== undefined ? { audio: booleanValue(rawMedia.audio, 'Realtime audio selection') } : {}),
      ...(rawMedia.video !== undefined ? { video: booleanValue(rawMedia.video, 'Realtime video selection') } : {}),
      ...(rawMedia.screen !== undefined ? { screen: booleanValue(rawMedia.screen, 'Realtime screen selection') } : {}),
    };
  }
  return {
    clientInstanceId: requiredString(input.clientInstanceId, 'Realtime client instance id', 512),
    intent: enumValue(input.intent, 'Realtime join intent', ['presence_only', 'media'] as const),
    ...(input.sessionDescription !== undefined ? { sessionDescription: input.sessionDescription } : {}),
    ...(media ? { media } : {}),
  };
}

function normalizeRealtimeTrackInput(value: unknown): RealtimeTrackInput {
  const input = boundedRecord(value, 'Realtime track input', 262_144);
  const participantId = optionalString(input.participantId, 'Realtime participant id', 512);
  const direction = input.direction === undefined
    ? undefined
    : enumValue(input.direction, 'Realtime track direction', ['publish', 'subscribe'] as const);
  const sourceId = optionalNullableString(input.sourceId, 'Realtime source id', 2048);
  const cloudflareSessionId = optionalNullableString(input.cloudflareSessionId, 'Cloudflare session id', 2048);
  const cloudflareTrackId = optionalNullableString(input.cloudflareTrackId, 'Cloudflare track id', 2048);
  return {
    ...(participantId ? { participantId } : {}),
    trackKind: enumValue(input.trackKind, 'Realtime track kind', ['audio', 'camera', 'screen'] as const),
    ...(direction ? { direction } : {}),
    ...(input.sdp !== undefined ? { sdp: optionalSettingString(input.sdp, 'Realtime SDP', 131_072) } : {}),
    ...(input.label !== undefined ? { label: optionalSettingString(input.label, 'Realtime track label', 512) } : {}),
    ...(sourceId !== undefined ? { sourceId } : {}),
    ...(cloudflareSessionId !== undefined ? { cloudflareSessionId } : {}),
    ...(cloudflareTrackId !== undefined ? { cloudflareTrackId } : {}),
    ...(input.targetTrackIds !== undefined ? { targetTrackIds: stringList(input.targetTrackIds, 'Target track ids', 256, 512) } : {}),
    ...(input.metadata !== undefined ? { metadata: boundedRecord(input.metadata, 'Realtime track metadata', 32_768) } : {}),
  };
}

function normalizeRealtimeCloseoutPayload(value: unknown): RealtimeCloseoutPayload {
  const input = boundedRecord(value, 'Realtime closeout payload', 131_072);
  const title = optionalString(input.title, 'Meeting title', 512);
  const timeEntryId = optionalNullableString(input.timeEntryId, 'Time entry id', 512);
  return {
    ...(title ? { title } : {}),
    manualNotes: optionalSettingString(input.manualNotes, 'Meeting notes', 32_768) ?? '',
    decisions: stringList(input.decisions, 'Meeting decisions', 200, 2000),
    actionItems: stringList(input.actionItems, 'Meeting action items', 200, 2000),
    linkedTimeEntryIds: stringList(input.linkedTimeEntryIds, 'Linked time entry ids', 500, 512),
    linkedIssueIds: stringList(input.linkedIssueIds, 'Linked issue ids', 500, 512),
    ...(timeEntryId !== undefined ? { timeEntryId } : {}),
    sendToPaperclip: booleanValue(input.sendToPaperclip, 'Send-to-Paperclip state'),
  };
}

function normalizeHandoffStatus(value: unknown): HandoffStatus {
  return enumValue(value, 'Handoff status', ['pending', 'sent', 'failed', 'retrying', 'skipped'] as const);
}

function normalizeHandoffInput(value: unknown): HandoffInput {
  const input = boundedRecord(value, 'Handoff input', 131_072);
  const kind = enumValue(input.kind, 'Handoff kind', [
    'project_sync', 'time_sync', 'usage_signal', 'standup_sync', 'paperclip_closeout', 'paperclip_memory',
    'preferences_save', 'github_repo_verify', 'github_activity_sync', 'standup_evidence_sync', 'review_rollup_sync',
    'breakwork_audio_generation', 'thoughtseed_bridge', 'parallel_agent_dispatch', 'assistant_daily_event',
  ] as const);
  return {
    kind,
    status: normalizeHandoffStatus(input.status),
    title: requiredString(input.title, 'Handoff title', 1000),
    ...(input.payload !== undefined ? { payload: boundedRecord(input.payload, 'Handoff payload', 65_536) } : {}),
    ...(input.error !== undefined ? { error: optionalNullableString(input.error, 'Handoff error', 5000) } : {}),
    ...(input.nextRetryAt !== undefined ? { nextRetryAt: optionalNullableString(input.nextRetryAt, 'Handoff retry timestamp', 64) } : {}),
  };
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
    } else if (retrying.kind === 'usage_signal') {
      const { emitUsageSignal } = await import('./teamforge.js');
      const signal = await retryUsageSignalFromHandoffPayload(retrying.payload, {
        listEntries,
        getStandupEvidenceRecord,
      });
      const result = await emitUsageSignal(signal);
      ok = result.ok;
      message = result.message ?? 'Usage signal sent.';
    } else if (retrying.kind === 'standup_sync') {
      const { emitUsageSignal } = await import('./teamforge.js');
      const signal = normalizeMemberUsageSignal(retrying.payload.signal);
      const result = await emitUsageSignal(signal);
      ok = result.ok;
      message = result.message ?? 'Usage signal sent.';
    } else if (retrying.kind === 'github_repo_verify') {
      const { verifyProjectRepo } = await import('./teamforge.js');
      const projectId = typeof retrying.payload.projectId === 'string' ? retrying.payload.projectId : '';
      const repositoryId = Number(retrying.payload.repositoryId);
      if (!projectId || !Number.isSafeInteger(repositoryId) || repositoryId <= 0) {
        throw new Error('Handoff is missing its numeric GitHub repository id. Select the repository again from Projects.');
      }
      const result = await verifyProjectRepo(projectId, repositoryId);
      ok = result.ok;
      message = result.message ?? '';
    } else if (retrying.kind === 'github_activity_sync') {
      const { syncGitHubActivity } = await import('./teamforge.js');
      const projectId = typeof retrying.payload.projectId === 'string' ? retrying.payload.projectId : '';
      const from = typeof retrying.payload.from === 'string' ? retrying.payload.from : '';
      const to = typeof retrying.payload.to === 'string' ? retrying.payload.to : '';
      if (!projectId || !from || !to) throw new Error('Handoff is missing GitHub activity sync payload.');
      const result = await syncGitHubActivity(projectId, from, to);
      if (result.ok) await persistGitHubCiEvidence(projectId, result.ciEvidence);
      ok = result.ok;
      message = result.message ?? '';
    } else if (retrying.kind === 'review_rollup_sync') {
      const { retryMonthlyReviewCycleHandoff } = await import('./review-cycle.js');
      const result = await retryMonthlyReviewCycleHandoff(retrying.payload);
      ok = result.ok;
      message = result.message ?? (result.ok ? 'Monthly review sent through the member bridge.' : 'Monthly review bridge retry failed.');
    } else if (retrying.kind === 'standup_evidence_sync' || retrying.kind === 'breakwork_audio_generation') {
      ok = false;
      message = 'This handoff records a server-side evidence or audio generation request. Re-run the action from its Plexus page.';
    } else if (retrying.kind === 'parallel_agent_dispatch') {
      ok = false;
      message = 'This handoff records delegated agent dispatch proof. Re-run dispatch from the task assignment.';
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
  registerDefaultSessionMediaAuthorization({
    session: session.defaultSession,
    getSources: (options) => desktopCapturer.getSources(options),
    getTrustedWebContents: () => mainWindow?.webContents ?? null,
    getAllowedRendererLocation: () => allowedIpcRendererLocation,
  });
}

const ASSISTANT_CONTEXT_SCOPES = [
  'today',
  'week',
  'project',
  'task',
  'session_group',
  'infra',
  'app',
] as const satisfies readonly AssistantContextScope[];

const DEFAULT_ASSISTANT_CONTEXT_SCOPES: AssistantContextScope[] = [
  'today',
  'project',
  'task',
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
      async saveModelUsage(input) {
        await insertAssistantModelUsage({
          id: randomUUID(),
          conversationId: input.conversationId,
          provider: input.provider,
          model: input.model,
          status: input.status,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          durationMs: input.durationMs,
          inputTokens: input.usage?.inputTokens ?? null,
          outputTokens: input.usage?.outputTokens ?? null,
          totalTokens: input.usage?.totalTokens ?? null,
          finishReason: input.finishReason ?? null,
          failureKind: input.failureKind ?? null,
          fallback: input.fallback,
          primaryProvider: input.primaryProvider ?? null,
          finalProvider: input.finalProvider ?? null,
          attemptCount: input.attempts.length,
          metadata: input.metadata ?? {},
        });
      },
    },
    loadContext: loadAssistantRuntimeContext,
    async executeReadOnlyTool(toolId, payload, execution) {
      if (execution.signal.aborted) throw new Error('Assistant tool execution was cancelled.');
      const output = await executeAssistantTool(toolId, payload);
      if (execution.signal.aborted) throw new Error('Assistant tool execution was cancelled.');
      return output.result;
    },
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

async function buildAssistantContextDiagnostics(): Promise<AssistantContextDiagnosticsSnapshot> {
  const snapshot = await buildAssistantContext({
    contextScopes: DEFAULT_ASSISTANT_CONTEXT_SCOPES,
    includeOptionalHelpers: true,
  });
  return {
    generatedAt: snapshot.generatedAt,
    requestedScopes: snapshot.requestedScopes,
    dateRange: snapshot.dateRange,
    budget: snapshot.budget,
    sourceHealth: snapshot.sourceHealth,
    taskSummaries: snapshot.tasks,
  };
}

async function buildAssistantDailyOutboxDiagnostics(): Promise<AssistantDailyOutboxDiagnostics> {
  const checkedAt = new Date().toISOString();
  const [events, counts] = await Promise.all([
    listAssistantDailyEvents(50),
    countAssistantDailyEventsByStatus(),
  ]);
  const dueRetry = (event: { status: string; nextRetryAt: string | null }) => (
    event.status === 'failed' && (!event.nextRetryAt || event.nextRetryAt <= checkedAt)
  );
  return {
    checkedAt,
    counts,
    dueRetryCount: events.filter(dueRetry).length,
    events: events.map((event) => ({
      id: event.id,
      date: event.date,
      status: event.status,
      error: event.error,
      artifactRef: event.artifactRef,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      nextRetryAt: event.nextRetryAt,
      retryable: event.status !== 'sent',
    })),
  };
}

function runtimeContextFromSnapshot(
  snapshot: AssistantContextSnapshot,
  request: AssistantTurnRequest,
): AssistantRuntimeContext {
  const bridgeConnected = snapshot.infra?.thoughtseedBridge?.connected === true || snapshot.infra?.worker.connected === true;
  return {
    routeKey: snapshot.route?.routeKey ?? request.routeKey,
    todayEntryCount: snapshot.entries.length,
    taskSummaries: snapshot.tasks.map((task) => ({
      taskId: task.taskId,
      title: task.title,
      status: task.status,
      workMode: task.workMode,
      proofStatus: task.proofStatus,
      conflictCount: task.conflictCount,
      correlationId: task.correlationId,
    })),
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
guardedHandle('timer:start', (args, channel): [string, string, number | undefined] => {
  expectPayloadCount(args, channel, 2, 3);
  return [
    requiredString(args[0], 'Project id', 512),
    requiredString(args[1], 'Timer description', 5000),
    optionalFiniteNumber(args[2], 'Target seconds', { minimum: 1, maximum: 31_536_000, integer: true }),
  ];
}, async (_event, projectId: string, description: string, targetSeconds?: number): Promise<TimeEntry> => {
  const entry = await startTimerEntry({ projectId, description, targetSeconds });
  activeProjectId = projectId;
  if (mainWindow) {
    mainWindow.webContents.send('timer:tick', timerStateFromEntry(entry));
    await updateTrayMenu(mainWindow);
  }
  return entry;
});

guardedHandle('timer:stop', undefined, async (): Promise<TimeEntry | null> => {
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
  const usageInput = {
    timestamp: stopped.endTime ?? new Date().toISOString(),
    activeProject: activeProjectId || stopped.projectId,
    stoppedDurationSeconds: stopped.durationSeconds,
  };
  void (async () => {
    let signal;
    try {
      signal = await prepareTimerStopUsageSignal(usageInput, { listEntries, getStandupEvidenceRecord });
    } catch (err: any) {
      await recordOptionalFailure({
        kind: 'usage_signal',
        status: 'failed',
        title: 'Timer usage signal preparation failed',
        payload: { usageInput },
        error: err?.message ?? String(err),
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      return;
    }
    try {
      const worker = await import('./teamforge.js');
      const result = await worker.emitUsageSignal(signal);
      if (result.ok) return;
      await recordOptionalFailure({
        kind: 'usage_signal',
        status: 'failed',
        title: 'Timer usage signal failed',
        payload: { signal },
        error: result.message ?? 'Timer stopped locally, but the usage signal was not accepted by the workspace service.',
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    } catch (err: any) {
      await recordOptionalFailure({
        kind: 'usage_signal',
        status: 'failed',
        title: 'Timer usage signal failed',
        payload: { signal },
        error: err?.message ?? String(err),
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }
  })();

  activeProjectId = null;
  if (mainWindow) {
    mainWindow.webContents.send('timer:tick', { running: false } satisfies TimerState);
    await updateTrayMenu(mainWindow);
  }

  return stopped;
});

guardedHandle('timer:pause', undefined, async (): Promise<TimerState> => {
  const state = await pauseRunningEntry();
  if (mainWindow) {
    mainWindow.webContents.send('timer:tick', state);
    await updateTrayMenu(mainWindow);
  }
  return state;
});

guardedHandle('timer:resume', undefined, async (): Promise<TimerState> => {
  const state = await resumeRunningEntry();
  if (mainWindow) {
    mainWindow.webContents.send('timer:tick', state);
    await updateTrayMenu(mainWindow);
  }
  return state;
});

guardedHandle('timer:getState', undefined, async (): Promise<TimerState> => {
  return getTimerState();
});

guardedHandle('entry:list', twoStringSchema('Entry range start', 'Entry range end', 64, 64), async (_event, from: string, to: string): Promise<TimeEntry[]> => {
  return listEntries(from, to);
});

guardedHandle('entry:create', recordSchema(normalizeTimeEntryCreateInput), async (_event, entry): Promise<TimeEntry> => {
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

guardedHandle('entry:update', (args, channel): [string, Partial<TimeEntry>] => {
  expectPayloadCount(args, channel, 2);
  return [requiredString(args[0], 'Time entry id', 512), normalizeTimeEntryPatch(args[1])];
}, async (_event, id: string, patch: Partial<TimeEntry>): Promise<TimeEntry> => {
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

guardedHandle('entry:delete', singleStringSchema('Time entry id'), async (_event, id: string) => {
  await deleteEntry(id);
});

guardedHandle('project:list', undefined, async (): Promise<Project[]> => {
  return listProjects();
});

guardedHandle('project:create', recordSchema(normalizeProjectCreateInput), async (_event, project): Promise<Project> => {
  const p: Project = {
    id: randomUUID(),
    ...project,
    createdAt: new Date().toISOString(),
  };
  await insertProject(p);
  return p;
});

guardedHandle('project:update', (args, channel): [string, Partial<Project>] => {
  expectPayloadCount(args, channel, 2);
  return [requiredString(args[0], 'Project id', 512), normalizeProjectPatch(args[1])];
}, async (_event, id: string, patch: Partial<Project>): Promise<Project> => {
  await updateProject(id, patch);
  return (await listProjects()).find(p => p.id === id)!;
});

guardedHandle('project:delete', singleStringSchema('Project id'), async (_event, id: string) => {
  await deleteProject(id);
});

guardedHandle('github:connectionStatus', undefined, async (): Promise<GitHubConnectionStatus> => {
  await activeAdminSession();
  const { getGitHubConnectionStatus } = await import('./teamforge.js');
  return getGitHubConnectionStatus();
});

guardedHandle('github:connectStart', undefined, async (): Promise<GitHubConnectStartResult> => {
  await activeAdminSession();
  const { startGitHubConnection } = await import('./teamforge.js');
  const result = await startGitHubConnection();
  const { authorizeUrl: rawAuthorizeUrl, ...rendererResult } = result;
  if (rawAuthorizeUrl !== undefined || result.status === 'pending') await openWorkerGitHubOAuth(rawAuthorizeUrl);
  return rendererResult;
});

guardedHandle('github:actorStatus', undefined, async (): Promise<GitHubActorStatus> => {
  await activeMemberSession();
  const { getGitHubActorStatus } = await import('./teamforge.js');
  return getGitHubActorStatus();
});

guardedHandle('github:actorEnrollStart', undefined, async (): Promise<GitHubActorEnrollStartResult> => {
  await activeAdminSession();
  const { startGitHubActorEnrollment } = await import('./teamforge.js');
  const result = await startGitHubActorEnrollment();
  const { authorizeUrl: rawAuthorizeUrl, ...rendererResult } = result;
  if (rawAuthorizeUrl !== undefined || result.status === 'pending') await openWorkerGitHubOAuth(rawAuthorizeUrl);
  return rendererResult;
});

guardedHandle('github:founderSetupIntent', undefined, (): FounderGitHubSetupIntent | null => {
  if (!pendingFounderGitHubSetup) return null;
  pendingFounderGitHubSetup = false;
  return founderGitHubSetupIntent();
});

guardedHandle('github:repositories', undefined, async (): Promise<GitHubRepositoryListResult> => {
  await activeAdminSession();
  const { listGitHubRepositories } = await import('./teamforge.js');
  return listGitHubRepositories();
});

guardedHandle('project:verifyRepo', (args, channel): [string, number] => {
  expectPayloadCount(args, channel, 2);
  return [
    requiredString(args[0], 'Project id', 512),
    finiteNumber(args[1], 'GitHub repository id', { minimum: 1, maximum: Number.MAX_SAFE_INTEGER, integer: true }),
  ];
}, async (_event, projectId: string, repositoryId: number) => {
  await activeAdminSession();
  const { verifyProjectRepo } = await import('./teamforge.js');
  const result = await verifyProjectRepo(projectId, repositoryId);
  if (result.ok && result.project) {
    await updateProject(projectId, {
      githubRepoUrl: result.project.githubRepoUrl,
      githubRepoFullName: result.project.githubRepoFullName,
      githubRepoId: result.project.githubRepoId,
      repoVerifiedAt: result.project.repoVerifiedAt,
      repoEvidenceStatus: result.project.repoEvidenceStatus,
      evidenceStatus: result.project.evidenceStatus,
    });
    const project = await getProject(projectId);
    return { ...result, project: project ?? result.project };
  }
  await recordOptionalFailure({
    kind: 'github_repo_verify',
    status: 'failed',
    title: 'GitHub repo verification failed',
    payload: { projectId, repositoryId },
    error: result.message ?? 'Could not verify GitHub repository.',
    nextRetryAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  await updateProject(projectId, {
    repoEvidenceStatus: result.status === 'forbidden' || result.status === 'suspended' ? 'inaccessible' : 'unverified',
    evidenceStatus: 'missing',
  }).catch(() => {});
  return result;
});

guardedHandle('project:scanVault', undefined, async () => {
  const { scanVaultProjects } = await import('./vault-projects.js');
  return scanVaultProjects();
});

guardedHandle('project:importVault', undefined, async () => {
  const { importVaultProjects } = await import('./vault-projects.js');
  return importVaultProjects();
});

guardedHandle('agentSessions:status', undefined, async () => {
  const { agentSessionStatus } = await import('./agent-sessions.js');
  return agentSessionStatus();
});

guardedHandle('agentSessions:scan', undefined, async () => {
  const { scanAgentSessions } = await import('./agent-sessions.js');
  return scanAgentSessions();
});

guardedHandle('agentSessions:setConsent', recordSchema(value => booleanValue(value, 'Agent session consent')), async (_event, enabled: boolean): Promise<PlexusSettings> => {
  await setSetting('agentSessionScanEnabled', String(Boolean(enabled)));
  await setSetting('agentSessionConsentAt', enabled ? new Date().toISOString() : '');
  return readSettings();
});

guardedHandle('agentSessions:accept', recordSchema(normalizeAgentSessionAcceptInput), async (_event, input: string | { candidateId: string; taskId?: string }): Promise<TimeEntry> => {
  const { acceptAgentSession } = await import('./agent-sessions.js');
  return acceptAgentSession(input);
});

guardedHandle('agentSessions:dismiss', singleStringSchema('Agent session candidate id'), async (_event, candidateId: string): Promise<void> => {
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
  const standupEvidenceResult = await getStandupEvidenceRecord(date)
    .then((record) => ({ record, error: null }))
    .catch((error) => ({ record: null, error: (error as Error)?.message ?? String(error) }));
  const realtimeRoomsResult = await (async () => {
    try {
      const { listRealtimeRooms } = await import('./teamforge.js');
      const result = await listRealtimeRooms();
      return {
        rooms: result.rooms,
        error: result.ok ? null : result.message ?? 'Realtime rooms unavailable',
      };
    } catch (error) {
      return { rooms: [], error: (error as Error)?.message ?? String(error) };
    }
  })();
  const suggestionsResult = await (async () => {
    try {
      const scannedSessions = sessionsResult.status;
      const context = await buildAssistantContext({
        contextScopes: ['today', 'project', 'task', 'session_group', 'infra', 'app'],
        dateRangeScope: 'today',
        now: generatedAt,
        sources: {
          listProjects: async () => projects,
          listEntries: async () => entries,
          getRunningEntry: async () => runningEntry,
          listFabricTasks: async () => tasksResult.tasks,
          ...(scannedSessions ? { agentSessionStatus: async () => scannedSessions } : {}),
        },
      });
      return {
        suggestions: await listProactiveAssistantSuggestions(context, {
          storage: null,
          now: generatedAt,
          maxSuggestions: 3,
        }),
        error: null,
      };
    } catch (error) {
      return { suggestions: [], error: (error as Error)?.message ?? String(error) };
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
    assistantSuggestions: suggestionsResult.suggestions,
    assistantSuggestionsError: suggestionsResult.error,
    agentSessionStatus: sessionsResult.status,
    agentSessionError: sessionsResult.error,
    memberKpi: kpiResult.kpi,
    memberKpiError: kpiResult.error,
    standupEvidence: standupEvidenceResult.record,
    standupEvidenceError: standupEvidenceResult.error,
    fabricTasksError: tasksResult.error,
    realtimeRooms: realtimeRoomsResult.rooms,
    realtimeRoomsError: realtimeRoomsResult.error,
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
  const realtimeRoomsResult = await (async () => {
    try {
      const { listRealtimeRooms } = await import('./teamforge.js');
      const result = await listRealtimeRooms();
      return {
        rooms: result.rooms ?? [],
        error: result.ok ? null : result.message ?? 'Realtime rooms unavailable',
      };
    } catch (error) {
      return { rooms: [], error: (error as Error)?.message ?? String(error) };
    }
  })();
  const fabricResult = await (async () => {
    try {
      return { status: await getFabricStatus(), error: null };
    } catch (error) {
      return { status: null, error: (error as Error)?.message ?? String(error) };
    }
  })();
  const dailyOutboxResult = await (async () => {
    try {
      const events = await listAssistantDailyEvents(100);
      return {
        events: events.map((event) => ({
          id: event.id,
          date: event.date,
          status: event.status,
          updatedAt: event.updatedAt,
          nextRetryAt: event.nextRetryAt,
        })),
        error: null,
      };
    } catch (error) {
      return { events: [], error: (error as Error)?.message ?? String(error) };
    }
  })();
  const proofCustodyRecords = await (async () => {
    try {
      const { listProofCustodyRecords, listLatestGitHubCiSummaryRecords } = await import('../db/database.js');
      const [records, ciSummaries] = await Promise.all([
        listProofCustodyRecords({ limit: 100 }),
        listLatestGitHubCiSummaryRecords(100),
      ]);
      const ciIds = new Set(ciSummaries.map((record) => record.id));
      return [...ciSummaries, ...records.filter((record) => !ciIds.has(record.id))];
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
    dailyOutboxRecords: dailyOutboxResult.events,
    dailyOutboxError: dailyOutboxResult.error,
    realtimeRooms: realtimeRoomsResult.rooms,
    realtimeRoomsError: realtimeRoomsResult.error,
    bridgeStatus: bridgeResult.status,
    bridgeError: bridgeResult.error,
    fabricStatus: fabricResult.status,
    fabricError: fabricResult.error,
    releaseHealth: buildAdminReleaseHealthSnapshot(generatedAt),
  });
});

guardedHandle('adminProofCockpit:openDrilldown', (args, channel) => expectSinglePayload(args, channel, adminProofOpsDrilldownTarget), async (_event, id): Promise<AdminProofOpsDrilldownOpenResult> => {
  await assertActiveAdminSession();
  return openAdminProofDrilldownTarget(id);
});

function projectBreakdownForEntries(entries: readonly TimeEntry[]): Record<string, number> {
  const projectBreakdown: Record<string, number> = {};
  for (const entry of entries) {
    projectBreakdown[entry.projectId] = (projectBreakdown[entry.projectId] || 0) + entry.durationSeconds;
  }
  return projectBreakdown;
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

guardedHandle('report:daily', singleStringSchema('Report date', 32), async (_event, date: string): Promise<DailyReport> => {
  const { from, to } = utcReportDayRange(date);
  const [entries, projects, fabricTasks, standupEvidence] = await Promise.all([
    listEntries(from, to),
    listProjects(),
    listFabricTasks({ limit: 1000 }),
    getStandupEvidenceRecord(date),
  ]);
  const report = buildDailyReport({ date, entries, projects, fabricTasks, standupEvidenceRecordId: standupEvidence?.id ?? null });
  await recordReportProofCustody('daily_report', date, report);
  return report;
});

guardedHandle('report:dailyProofPacket', singleStringSchema('Report date', 32), async (_event, date: string): Promise<DailyProofPacket> => {
  const existing = await getDailyProofPacketByDate(date);
  if (existing) return existing;
  const { from, to } = utcReportDayRange(date);
  const [entries, projects, fabricTasks, standupEvidence] = await Promise.all([
    listEntries(from, to),
    listProjects(),
    listFabricTasks({ limit: 1000 }),
    getStandupEvidenceRecord(date),
  ]);
  const report = buildDailyReport({ date, entries, projects, fabricTasks, standupEvidenceRecordId: standupEvidence?.id ?? null });
  await recordReportProofCustody('daily_report', date, report);
  return report.proofPacket;
});

guardedHandle('report:weekly', singleStringSchema('Week start', 32), async (_event, weekStart: string): Promise<WeeklyReport> => {
  const days: DailyReport[] = [];
  const [projects, fabricTasks] = await Promise.all([listProjects(), listFabricTasks({ limit: 1000 })]);
  const start = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const { from, to } = utcReportDayRange(dateStr);
    const [entries, standupEvidence] = await Promise.all([listEntries(from, to), getStandupEvidenceRecord(dateStr)]);
    days.push(buildDailyReport({
      date: dateStr,
      entries,
      projects,
      fabricTasks,
      standupEvidenceRecordId: standupEvidence?.id ?? null,
    }));
  }
  const report = weeklyReportFromDays(weekStart, days, projects, fabricTasks);
  await recordReportProofCustody('weekly_report', weekStart, report);
  return report;
});

guardedHandle('report:monthly', singleStringSchema('Report month', 32), async (_event, month: string): Promise<MonthlyReport> => {
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
      const { from, to } = utcReportDayRange(ds);
      const [entries, standupEvidence] = await Promise.all([listEntries(from, to), getStandupEvidenceRecord(ds)]);
      days.push(buildDailyReport({
        date: ds,
        entries,
        projects,
        fabricTasks,
        standupEvidenceRecordId: standupEvidence?.id ?? null,
      }));
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

guardedHandle('evidence:status', twoStringSchema('Evidence range start', 'Evidence range end', 64, 64), async (_event, from: string, to: string): Promise<WorkEvidenceSummary> => {
  const [entries, projects] = await Promise.all([listEntries(from, to), listProjects()]);
  return computeEvidenceSummary(entries, projects);
});

guardedHandle('github:activitySync', (args, channel): [string, string, string] => {
  expectPayloadCount(args, channel, 3);
  return [
    requiredString(args[0], 'Project id', 512),
    requiredString(args[1], 'Activity range start', 64),
    requiredString(args[2], 'Activity range end', 64),
  ];
}, async (_event, projectId: string, from: string, to: string): Promise<GitHubActivitySyncResult> => {
  await activeMemberSession();
  const project = await requireVerifiedRepoProject(projectId);
  const { syncGitHubActivity } = await import('./teamforge.js');
  const result = await syncGitHubActivity(projectId, from, to);
  if (!result.ok) {
    await updateProject(projectId, projectPatchAfterGitHubActivityFailure(result.status));
    await recordOptionalFailure({
      kind: 'github_activity_sync',
      status: 'failed',
      title: `GitHub activity sync failed: ${project.name}`,
      payload: { projectId, from, to, repoFullName: project.githubRepoFullName, repoUrl: project.githubRepoUrl },
      error: result.message ?? 'GitHub activity sync failed.',
    });
    return { ok: false, status: result.status, activity: await listGitHubActivity(projectId, from, to), ciEvidence: result.ciEvidence, message: result.message };
  }
  const activity = result.activity ?? [];
  const ciEvidence = result.ciEvidence;
  await upsertGitHubActivity(activity);
  await persistGitHubCiEvidence(projectId, ciEvidence);
  const matchedEntries = await refreshEntryEvidenceForProjectRange(projectId, from, to, activity);
  await updateProject(projectId, {
    evidenceStatus: matchedEntries > 0 ? 'matched' : 'missing',
    repoEvidenceStatus: 'verified',
  });
  return {
    ok: true,
    status: 'synced',
    activity,
    ciEvidence,
    message: `${matchedEntries} work records matched GitHub activity. ${ciEvidence.items.length} CI proof item${ciEvidence.items.length === 1 ? '' : 's'} stored separately.`,
  };
});

guardedHandle('standup:generate', singleStringSchema('Standup date', 32), async (_event, date: string): Promise<StandupEvidenceRecord> => {
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

guardedHandle('review:generate', (args, channel): ['weekly' | 'monthly', string] => {
  expectPayloadCount(args, channel, 2);
  return [
    enumValue(args[0], 'Review kind', ['weekly', 'monthly'] as const),
    requiredString(args[1], 'Review period start', 32),
  ];
}, async (_event, kind: 'weekly' | 'monthly', periodStart: string): Promise<ReviewCycle> => {
  return generateReviewCycle(kind, periodStart);
});

guardedHandle('breakwork:generatePrompt', recordSchema((value): { category: BreakworkCategory; triggerReason: string } => {
  const input = boundedRecord(value, 'Breakwork prompt input');
  return {
    category: enumValue(input.category, 'Breakwork category', [
      'mental_reset', 'physical_reset', 'eye_rest', 'breathwork', 'mobility', 'hydration', 'meeting_decompression', 'transition',
    ] as const),
    triggerReason: requiredString(input.triggerReason, 'Breakwork trigger reason', 2000),
  };
}), async (_event, input: { category: BreakworkCategory; triggerReason: string }): Promise<BreakworkPrompt> => {
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

guardedHandle('assistant:status', undefined, async (): Promise<AssistantStatus> => {
  return assistantStatus();
});

guardedHandle('assistant:modelStatus', undefined, async (): Promise<AssistantModelStatus> => {
  return assistantModelStatusFromConfig(await readAssistantModelConfig());
});

guardedHandle('assistant:modelSetConfig', (args, channel) => expectSinglePayload(args, channel, normalizeAssistantModelSettingsInput), async (_event, input: AssistantModelSettingsInput): Promise<AssistantModelStatus> => {
  return applyAssistantModelSettings(input);
});

guardedHandle('assistant:modelHealth', (args, channel): [AssistantModelHealthRequest | undefined] => {
  expectPayloadCount(args, channel, 0, 1);
  return [args[0] === undefined ? undefined : boundedRecord(args[0], 'Assistant model health request') as unknown as AssistantModelHealthRequest];
}, async (_event, input?: AssistantModelHealthRequest): Promise<AssistantModelHealthResult> => {
  const config = await readAssistantModelConfig();
  return assistantModelHealth(config, createAssistantModelProviders(config), input ?? {});
});

guardedHandle('assistant:modelCatalog', undefined, async (): Promise<AssistantModelCatalog> => {
  return discoverAssistantModelCatalog(await readAssistantModelConfig());
});

guardedHandle('assistant:contextDiagnostics', undefined, async (): Promise<AssistantContextDiagnosticsSnapshot> => {
  return buildAssistantContextDiagnostics();
});

guardedHandle('assistant:dailyOutbox', undefined, async (): Promise<AssistantDailyOutboxDiagnostics> => {
  return buildAssistantDailyOutboxDiagnostics();
});

guardedHandle('assistant:retryDailyOutbox', optionalStringSchema('Assistant daily event id'), async (_event, eventId?: string): Promise<{ attempted: number; sent: number; failed: number }> => {
  const { flushAssistantDailyEvents } = await import('./assistant-daily.js');
  const result = await flushAssistantDailyEvents({
    eventId: typeof eventId === 'string' && eventId.trim() ? eventId.trim() : undefined,
    recordFailureHandoff: false,
  });
  return {
    attempted: result.attempted,
    sent: result.sent,
    failed: result.failed,
  };
});

guardedHandle('assistant:modelUsage', undefined, async (): Promise<AssistantModelUsageRecord[]> => {
  return listAssistantModelUsage(25);
});

guardedHandle('assistant:ask', recordSchema(value => normalizeAssistantTurnRequest(
  boundedRecord(value, 'Assistant turn request', 65_536) as unknown as AssistantTurnRequest,
)), async (_event, input: AssistantTurnRequest): Promise<AssistantAskResult> => {
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

guardedHandle('assistant:suggestions', (args, channel): [AssistantSuggestionsRequest | undefined] => {
  expectPayloadCount(args, channel, 0, 1);
  return [args[0] === undefined
    ? undefined
    : boundedRecord(args[0], 'Assistant suggestions request') as unknown as AssistantSuggestionsRequest];
}, async (_event, input?: AssistantSuggestionsRequest): Promise<AssistantSuggestion[]> => {
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

guardedHandle('assistant:confirmIntent', singleStringSchema('Assistant intent id'), async (_event, intentId: string): Promise<AssistantIntentActionResult> => {
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

guardedHandle('assistant:cancelIntent', singleStringSchema('Assistant intent id'), async (_event, intentId: string): Promise<AssistantIntentActionResult> => {
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

guardedHandle('settings:get', undefined, async (): Promise<PlexusSettings> => {
  return readSettings();
});

guardedHandle('settings:set', recordSchema(normalizeSettingsPatch), async (_event, settings: Partial<PlexusSettings>): Promise<PlexusSettings> => {
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

guardedHandle('updates:getStatus', undefined, async () => getUpdateStatus());
guardedHandle('updates:check', undefined, async () => checkForUpdates());
guardedHandle('updates:download', undefined, async () => downloadUpdate());
guardedHandle('updates:install', undefined, async () => installUpdateAndRestart());

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
guardedHandle('thoughtseed:redeemInvite', (args, channel) => expectSinglePayload(args, channel, normalizeBridgeRedeemInput), async (_event, input: { invite: string }): Promise<ThoughtseedBridgeRedeemResult> => {
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
guardedHandle('thoughtseed:dispatchLanes', undefined, async (): Promise<TemperanceDispatchLaneStatusResult> => {
  const { listThoughtseedDispatchLanes } = await import('./thoughtseed-bridge.js');
  return listThoughtseedDispatchLanes();
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
guardedHandle('onboarding:update', (args, channel): [string, OnboardingStateValue, Record<string, unknown> | undefined] => {
  expectPayloadCount(args, channel, 2, 3);
  return [
    requiredString(args[0], 'Onboarding step id', 256),
    onboardingStateValue(args[1]),
    safeMetadata(args[2]),
  ];
}, async (_event, stepId: string, state: OnboardingStateValue, metadata?: Record<string, unknown>) => {
  const { updateOnboarding } = await import('./teamforge.js');
  return updateOnboarding(
    requiredString(stepId, 'Onboarding step id', 256),
    onboardingStateValue(state),
    safeMetadata(metadata),
  );
});
guardedHandle('adminDemo:overview', undefined, async () => {
  await assertActiveAdminSession();
  const { getAdminDemoOverview } = await import('./teamforge.js');
  return getAdminDemoOverview();
});
guardedHandle('adminDemo:onboardingUpdate', normalizeAdminDemoOnboardingUpdateArgs, async (_event, identityId, stepId, state, metadata) => {
  await assertActiveAdminSession();
  const { updateAdminDemoOnboarding } = await import('./teamforge.js');
  return updateAdminDemoOnboarding(identityId, stepId, state, metadata);
});

// Idle handling
guardedHandle('idle:action', (args, channel): [string, 'keep' | 'discard' | 'trim', number] => {
  expectPayloadCount(args, channel, 3);
  return [
    requiredString(args[0], 'Time entry id', 512),
    enumValue(args[1], 'Idle action', ['keep', 'discard', 'trim'] as const),
    finiteNumber(args[2], 'Idle milliseconds', { minimum: 0, maximum: 31_536_000_000, integer: true }),
  ];
}, async (_event, entryId: string, action: 'keep' | 'discard' | 'trim', idleMs: number) => {
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
guardedHandle('member:kpi', undefined, async () => {
  const { getMemberKpiSummary } = await import('./teamforge.js');
  // teamforge wraps the worker call as { ok, data }. Unwrap to the MemberKpiSummary
  // the renderer expects; throw on failure so the renderer surfaces an error instead
  // of rendering the wrapper's undefined fields as NaN.
  const res = await getMemberKpiSummary();
  if (!res.ok || !res.data) throw new Error(res.message ?? 'KPI unavailable');
  return res.data;
});

// Phase 9 — Usage Signals
guardedHandle('member:emitUsageSignal', recordSchema(normalizeMemberUsageSignal), async (_event, signal) => {
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
  guardedHandle('fabric:status', undefined, async () => getFabricStatus());
  guardedHandle('fabric:healthProbe', undefined, async () => getFabricStatus());
  guardedHandle('fabric:installStatus', undefined, async () => getPaperclipInstallStatus());

  // Phase 14 — Realtime Capture Capability Proof
  guardedHandle('media:captureStatus', undefined, async () => getMediaCaptureStatus());
  guardedHandle('media:requestAccess', recordSchema(value => enumValue(value, 'Media request kind', ['microphone', 'camera'] as const)), async (_event, kind: MediaRequestKind) => requestMediaAccess(kind));
  guardedHandle('media:openPrivacySettings', recordSchema(value => enumValue(value, 'Media capture kind', ['microphone', 'camera', 'screen'] as const)), async (_event, kind: MediaCaptureKind) => {
    if (process.platform !== 'darwin') return;
    const anchor =
      kind === 'microphone' ? 'Privacy_Microphone'
      : kind === 'camera' ? 'Privacy_Camera'
      : 'Privacy_ScreenCapture';
    await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${anchor}`);
  });
  guardedHandle('realtime:rooms', undefined, async () => {
    const { listRealtimeRooms } = await import('./teamforge.js');
    return listRealtimeRooms();
  });
  guardedHandle('realtime:roomDetail', singleStringSchema('Realtime room id'), async (_event, roomId: string) => {
    const { getRealtimeRoomDetail } = await import('./teamforge.js');
    return getRealtimeRoomDetail(roomId);
  });
  guardedHandle('realtime:joinRoom', (args, channel): [string, RealtimeJoinInput] => {
    expectPayloadCount(args, channel, 2);
    return [requiredString(args[0], 'Realtime room id', 512), normalizeRealtimeJoinInput(args[1])];
  }, async (_event, roomId: string, input: RealtimeJoinInput) => {
    const { joinRealtimeRoom } = await import('./teamforge.js');
    return joinRealtimeRoom(roomId, input);
  });
  guardedHandle('realtime:publishTrack', (args, channel): [string, RealtimeTrackInput] => {
    expectPayloadCount(args, channel, 2);
    return [requiredString(args[0], 'Realtime call id', 512), normalizeRealtimeTrackInput(args[1])];
  }, async (_event, callId: string, input: RealtimeTrackInput) => {
    const { publishRealtimeTrack } = await import('./teamforge.js');
    return publishRealtimeTrack(callId, input);
  });
  guardedHandle('realtime:closeTrack', twoStringSchema('Realtime call id', 'Realtime track id', 512, 512), async (_event, callId: string, trackId: string) => {
    const { closeRealtimeTrack } = await import('./teamforge.js');
    return closeRealtimeTrack(callId, trackId);
  });
  guardedHandle('realtime:leaveCall', twoStringSchema('Realtime call id', 'Realtime participant id', 512, 512), async (_event, callId: string, participantId: string) => {
    const { leaveRealtimeCall } = await import('./teamforge.js');
    return leaveRealtimeCall(callId, participantId);
  });
  guardedHandle('realtime:endCall', singleStringSchema('Realtime call id'), async (_event, callId: string) => {
    const { endRealtimeCall } = await import('./teamforge.js');
    return endRealtimeCall(callId);
  });
  guardedHandle('realtime:closeout', (args, channel): [string, RealtimeCloseoutPayload] => {
    expectPayloadCount(args, channel, 2);
    return [requiredString(args[0], 'Realtime call id', 512), normalizeRealtimeCloseoutPayload(args[1])];
  }, async (_event, callId: string, payload: RealtimeCloseoutPayload) => {
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
  guardedHandle('coworking:floor', undefined, async () => {
    const { getCoworkingFloor } = await import('./teamforge.js');
    return getCoworkingFloor();
  });
  guardedHandle('coworking:lounge', undefined, async () => {
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
      const { getWorkerConfig, provisionMember } = await import('./teamforge.js');
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
      const { baseUrl } = await getWorkerConfig();
      const childEnv = sanitizedChildProcessEnv(process.env, {
        PAPERCLIP_MEMBER_ID: memberId,
        PAPERCLIP_MEMBER_NAME: memberName,
        ...(memberEmail ? { PAPERCLIP_MEMBER_EMAIL: memberEmail } : {}),
        ...(baseUrl ? { TF_API_BASE_URL: baseUrl } : {}),
      });
      const result = await new Promise<{ ok: boolean; output: string }>((resolve) => {
        const child = spawn('bash', setupArgs, {
          cwd: repoRoot,
          env: childEnv,
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
  guardedHandle('member:preferencesGet', undefined, async () => {
    const { getMemberPreferences } = await import('./teamforge.js');
    return getMemberPreferences();
  });
  guardedHandle('member:preferencesSet', recordSchema(value => boundedRecord(value, 'Member preferences', 65_536)), async (_event, prefs: Record<string, unknown>) => {
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
  guardedHandle('handoff:list', (args, channel): [HandoffStatus | undefined] => {
    expectPayloadCount(args, channel, 0, 1);
    return [args[0] === undefined ? undefined : normalizeHandoffStatus(args[0])];
  }, async (_event, status?: HandoffStatus) => listHandoffs(status));
  guardedHandle('handoff:record', recordSchema(normalizeHandoffInput), async (_event, input: HandoffInput) => recordHandoff(input));
  guardedHandle('handoff:retry', singleStringSchema('Handoff id'), async (_event, id: string) => retryHandoff(id));
