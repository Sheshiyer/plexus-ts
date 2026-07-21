import { safeStorage, BrowserWindow, session as electronSession } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import path from 'node:path';
import { getSetting, setSetting, listProjects, insertProject, updateProject, updateEntry, listUnsyncedEntries } from '../db/database.js';
import type {
  AdminDemoOverview,
  MemberProvisionBundle,
  OnboardingStateValue,
  Project,
  GitHubActivity,
  GitHubCiEvidence,
  GitHubCiEvidenceBatch,
  GitHubActivitySyncResult,
  GitHubActorEnrollStartResult,
  GitHubActorState,
  GitHubActorStatus,
  GitHubConnectionState,
  GitHubConnectionStatus,
  GitHubConnectStartResult,
  GitHubInstallationSummary,
  GitHubInstallationTarget,
  GitHubRepoOption,
  GitHubRepositoryListResult,
  GitHubRepoVerificationStatus,
  ProjectRepoVerification,
  RealtimeCloseoutPayload,
  RealtimeJoinInput,
  RealtimeJoinResponse,
  RealtimeMediaTrack,
  RealtimeMeetingRecord,
  RealtimeParticipant,
  FloorPresence,
  RealtimeRoom,
  RealtimeRoomDetail,
  RealtimeTrackInput,
  Session,
  UsageSignal,
  WorkerConfig,
} from '../shared/types.js';
import {
  floorPresenceFromLease,
  normalizeCoworkingPresenceMembers,
  type CoworkingPresenceActivity,
} from '../shared/coworking-presence.js';
import { sanitizedChildProcessEnv } from './child-process-environment.js';
import { THOUGHTSEED_GITHUB_FOUNDERS, THOUGHTSEED_GITHUB_INSTALLATION_TARGETS } from '../shared/founder-github-setup.js';
import { normalizeGitHubConnectionTargets } from '../shared/github-connection-status.js';
import type {
  AssistantDailyConfirmation,
  AssistantDailyDeliveryResult,
  AssistantDailyEvent,
} from '../shared/native-assistant.js';
import { redactForLog } from './redaction.js';

/**
 * Workspace Worker compatibility client.
 * Reads the canonical project graph + team snapshot from the Worker.
 * The bearer token is the single interim secret — stored via Electron
 * safeStorage (OS keychain), never in plaintext settings. Replaced by
 * Cloudflare Access in Phase 4.
 */

const DEFAULT_BASE_URL = 'https://plexus-api.thoughtseed.space';
const DEFAULT_WORKER_ORIGIN = new URL(DEFAULT_BASE_URL).origin;
const WORKER_BASE_URL_OVERRIDE_ENV = 'PLEXUS_WORKER_BASE_URL';
export const DAILY_ASSISTANT_EVENT_PATH = '/v1/member/daily-agent-events';
export const ACCESS_LOGIN_PARTITION = 'persist:tfaccess';
export const ACCESS_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const PLEXUS_ACCESS_AUD = '5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200';
const PALETTE = ['#E0FF4F', '#D6FFF6', '#6E5BB0', '#56C8B0', '#B8E04F', '#9FE8D8', '#8A7AC0', '#F0A0A0'];
const WORKER_TOKEN_KEY = 'tf.tokenEnc';
const LEGACY_WORKER_TOKEN_KEY = 'tf.token';
const ACCESS_JWT_KEY = 'tf.accessJwtEnc';
const LEGACY_ACCESS_JWT_KEY = 'tf.accessJwt';

// ── token (safeStorage) ───────────────────────────────────────────
function encryptedToBase64(value: Buffer | Uint8Array | string): string {
  return typeof value === 'string'
    ? Buffer.from(value, 'utf-8').toString('base64')
    : Buffer.from(value).toString('base64');
}

async function setEncryptedCredential(key: string, value: string, unavailableMessage: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(unavailableMessage);
  }
  await setSetting(key, encryptedToBase64(safeStorage.encryptString(value)));
}

async function getEncryptedCredential(key: string): Promise<string | null> {
  const enc = await getSetting(key);
  if (!enc) return null;
  return safeStorage.decryptString(Buffer.from(enc, 'base64'));
}

async function setToken(token: string): Promise<void> {
  if (!token) {
    await Promise.all([
      setSetting(WORKER_TOKEN_KEY, ''),
      setSetting(LEGACY_WORKER_TOKEN_KEY, ''),
    ]);
    return;
  }
  await setEncryptedCredential(
    WORKER_TOKEN_KEY,
    token,
    'OS secure storage is unavailable; cannot store the token safely.',
  );
  await setSetting(LEGACY_WORKER_TOKEN_KEY, '');
}
async function getToken(): Promise<string | null> {
  try {
    const token = await getEncryptedCredential(WORKER_TOKEN_KEY);
    if (token) return token;
  } catch {
    return null;
  }

  const legacyToken = ((await getSetting(LEGACY_WORKER_TOKEN_KEY)) || '').trim();
  if (!legacyToken) return null;
  try {
    await setToken(legacyToken);
    return legacyToken;
  } catch {
    await setSetting(LEGACY_WORKER_TOKEN_KEY, '');
    return null;
  }
}

// ── Cloudflare Access JWT (safeStorage) ───────────────────────────
async function clearAccessJwt(): Promise<void> {
  await Promise.all([
    setSetting(ACCESS_JWT_KEY, ''),
    setSetting(LEGACY_ACCESS_JWT_KEY, ''),
  ]);
}

async function setAccessJwt(jwt: string): Promise<void> {
  if (!jwt) {
    await clearAccessJwt();
    return;
  }
  await setEncryptedCredential(
    ACCESS_JWT_KEY,
    jwt,
    'OS secure storage is unavailable; cannot store the Access JWT safely.',
  );
  await setSetting(LEGACY_ACCESS_JWT_KEY, '');
}

export async function getAccessJwt(): Promise<string | null> {
  try {
    const encryptedJwt = await getEncryptedCredential(ACCESS_JWT_KEY);
    if (encryptedJwt) {
      if (isUsableAccessJwt(encryptedJwt)) return encryptedJwt;
      console.log('[getAccessJwt] existing token is not a Plexus app Access JWT; clearing stored Access JWT');
      await clearAccessJwt();
      return null;
    }
  } catch {
    console.log('[getAccessJwt] stored Access JWT could not be decrypted; clearing stored Access JWT');
    await clearAccessJwt();
    return null;
  }

  const legacyJwt = (await getSetting(LEGACY_ACCESS_JWT_KEY)) || null;
  if (!legacyJwt) return null;
  if (!isUsableAccessJwt(legacyJwt)) {
    console.log('[getAccessJwt] existing token is not a Plexus app Access JWT; clearing stale tf.accessJwt');
    await setSetting(LEGACY_ACCESS_JWT_KEY, '');
    return null;
  }
  try {
    await setAccessJwt(legacyJwt);
    return legacyJwt;
  } catch {
    console.log('[getAccessJwt] secure storage unavailable; clearing plaintext Access JWT');
    await setSetting(LEGACY_ACCESS_JWT_KEY, '');
    return null;
  }
}

function jwtAudiences(payload: Record<string, unknown>): string[] {
  const aud = payload.aud;
  if (Array.isArray(aud)) return aud.map(String);
  if (typeof aud === 'string') return [aud];
  return [];
}

function jwtEmail(payload: Record<string, unknown>): string | null {
  if (typeof payload.email === 'string' && payload.email.includes('@')) return payload.email;
  if (typeof payload.identity === 'string' && payload.identity.includes('@')) return payload.identity;
  return null;
}

function isUsableAccessJwt(jwt: string): boolean {
  const payload = decodeJwtPayload(jwt);
  if (!payload || typeof payload !== 'object') return false;
  if (payload.type === 'meta' || payload.type === 'org') return false;
  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  if (exp && exp < Math.floor(Date.now() / 1000)) return false;
  if (!jwtAudiences(payload).includes(PLEXUS_ACCESS_AUD)) return false;
  return Boolean(jwtEmail(payload));
}

/** Build auth headers from whichever credential is present (Access JWT preferred). */
async function authHeaders(): Promise<Record<string, string> | null> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const accessJwt = await getAccessJwt();
  const token = await getToken();
  const hasAccessJwt = !!accessJwt && isUsableAccessJwt(accessJwt);
  if (hasAccessJwt) {
    headers['Cf-Access-Jwt-Assertion'] = accessJwt;
    headers['Cookie'] = `CF_Authorization=${accessJwt}`;
  } else if (accessJwt) {
    console.log('[authHeaders] ignoring unusable Access JWT');
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!hasAccessJwt && !token) {
    return null;
  }
  return headers;
}

function normalizedWorkerOrigin(value: string, allowLoopbackHttp: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Workspace Worker URL must be a valid URL.');
  }

  const loopback = url.hostname === 'localhost'
    || url.hostname === '127.0.0.1'
    || url.hostname === '[::1]';
  const allowedProtocol = url.protocol === 'https:'
    || (allowLoopbackHttp && loopback && url.protocol === 'http:');
  if (!allowedProtocol) {
    throw new Error('Workspace Worker URL must use HTTPS; only an environment-owned loopback override may use HTTP.');
  }
  if (url.username || url.password || (url.pathname !== '' && url.pathname !== '/') || url.search || url.hash) {
    throw new Error('Workspace Worker URL must be an origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}

function environmentWorkerBaseUrl(): string | null {
  // Development overrides are process-owner configuration. Renderer IPC can
  // only select the canonical production origin through setWorkerConfig().
  const override = process.env[WORKER_BASE_URL_OVERRIDE_ENV]?.trim();
  return override ? normalizedWorkerOrigin(override, true) : null;
}

function canonicalWorkerBaseUrl(value: string): string {
  const origin = normalizedWorkerOrigin(value, false);
  if (origin !== DEFAULT_WORKER_ORIGIN) {
    throw new Error(`Workspace Worker URL is managed by Plexus. Use ${WORKER_BASE_URL_OVERRIDE_ENV} for an environment-owned development override.`);
  }
  return DEFAULT_BASE_URL;
}

async function getBaseUrl(): Promise<string> {
  const environmentOverride = environmentWorkerBaseUrl();
  if (environmentOverride) return environmentOverride;

  const stored = (await getSetting('tf.baseUrl'))?.trim();
  if (!stored) return DEFAULT_BASE_URL;
  try {
    return canonicalWorkerBaseUrl(stored);
  } catch {
    await setSetting('tf.baseUrl', '');
    console.warn('[worker] Cleared non-canonical stored Workspace Worker URL.');
    return DEFAULT_BASE_URL;
  }
}

export async function getWorkerConfig(): Promise<WorkerConfig> {
  return {
    baseUrl: await getBaseUrl(),
    workspaceId: (await getSetting('tf.workspaceId')) || '',
    hasToken: !!(await getToken()),
  };
}

export async function setWorkerConfig(cfg: { baseUrl?: string; workspaceId?: string; token?: string }): Promise<WorkerConfig> {
  if (cfg.baseUrl !== undefined) await setSetting('tf.baseUrl', canonicalWorkerBaseUrl(cfg.baseUrl.trim()));
  if (cfg.workspaceId !== undefined) await setSetting('tf.workspaceId', cfg.workspaceId.trim());
  if (cfg.token !== undefined) await setToken(cfg.token.trim());
  return getWorkerConfig();
}

// ── envelope-aware fetch ──────────────────────────────────────────
async function wfetch<T = any>(path: string): Promise<T> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Not connected — sign in with Cloudflare Access first.');
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, { headers });
  const json: any = await parseWorkerJson(res, `${base}${path}`);
  if (json && typeof json === 'object' && 'ok' in json) {
    if (json.ok === false) throw new WorkerRequestError(res.status, typeof json.error?.code === 'string' ? json.error.code : null, json.error?.message || 'Worker request failed.');
    return json.data as T;
  }
  return json as T;
}

async function wpost<T = any>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Not connected — sign in with Cloudflare Access first.');
  headers['Content-Type'] = 'application/json';
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json: any = await parseWorkerJson(res, `${base}${path}`);
  if (json && typeof json === 'object' && 'ok' in json) {
    if (json.ok === false) throw new WorkerRequestError(res.status, typeof json.error?.code === 'string' ? json.error.code : null, json.error?.message || 'Worker request failed.');
    return json.data as T;
  }
  return json as T;
}

async function wdelete<T = any>(path: string): Promise<T> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Not connected — sign in with Cloudflare Access first.');
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, { method: 'DELETE', headers });
  const json: any = await parseWorkerJson(res, `${base}${path}`);
  if (json && typeof json === 'object' && 'ok' in json) {
    if (json.ok === false) throw new WorkerRequestError(res.status, typeof json.error?.code === 'string' ? json.error.code : null, json.error?.message || 'Worker request failed.');
    return json.data as T;
  }
  return json as T;
}

async function wput<T = any>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Not connected — sign in with Cloudflare Access first.');
  headers['Content-Type'] = 'application/json';
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  const json: any = await parseWorkerJson(res, `${base}${path}`);
  if (json && typeof json === 'object' && 'ok' in json) {
    if (json.ok === false) throw new WorkerRequestError(res.status, typeof json.error?.code === 'string' ? json.error.code : null, json.error?.message || 'Worker request failed.');
    return json.data as T;
  }
  return json as T;
}

class WorkerRequestError extends Error {
  readonly httpStatus: number;
  readonly code: string | null;

  constructor(httpStatus: number, code: string | null, message: string) {
    super(message);
    this.name = 'WorkerRequestError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

async function parseWorkerJson(res: Response, url: string): Promise<unknown> {
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    const contentType = res.headers.get('content-type') ?? 'unknown content type';
    throw new Error(`Worker returned ${res.status} non-JSON from ${url} (${contentType}). Cloudflare Access did not return the Plexus app session JSON.`);
  }

  if (!res.ok) {
    const code = typeof json?.error?.code === 'string'
      ? json.error.code
      : typeof json?.code === 'string' ? json.code : null;
    const message =
      json?.error?.message ??
      json?.message ??
      JSON.stringify(json).slice(0, 160);
    throw new WorkerRequestError(res.status, code, `Worker responded ${res.status}${message ? `: ${message}` : ''}`);
  }
  return json;
}

export async function workerStatus(): Promise<{ connected: boolean; message?: string }> {
  if (!(await authHeaders())) return { connected: false, message: 'Not signed in' };
  try {
    await wfetch('/v1/projects');
    return { connected: true };
  } catch (err: any) {
    return { connected: false, message: err.message };
  }
}

function artifactRefFrom(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  const direct = record.artifactRef ?? record.artifact_ref ?? record.ref;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const artifact = record.artifact;
  if (artifact && typeof artifact === 'object') {
    const nested = artifact as Record<string, unknown>;
    const ref = nested.ref ?? nested.url ?? nested.key;
    if (typeof ref === 'string' && ref.trim()) return ref.trim();
  }
  return undefined;
}

function statusFrom(data: unknown): AssistantDailyConfirmation['status'] {
  if (!data || typeof data !== 'object') return 'unknown';
  const status = (data as Record<string, unknown>).status;
  return status === 'queued' || status === 'sent' || status === 'failed'
    ? status
    : 'unknown';
}

function messageFrom(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const message = (data as Record<string, unknown>).message;
  return typeof message === 'string' && message.trim() ? message.trim() : undefined;
}

export async function sendDailyAssistantEvent(event: AssistantDailyEvent): Promise<AssistantDailyDeliveryResult> {
  try {
    const data = await wpost<Record<string, unknown>>(DAILY_ASSISTANT_EVENT_PATH, event);
    return {
      ok: true,
      channel: 'worker',
      status: 'sent',
      message: messageFrom(data),
      artifactRef: artifactRefFrom(data),
    };
  } catch (err: any) {
    return {
      ok: false,
      channel: 'worker',
      status: 'failed',
      message: err?.message ?? String(err),
    };
  }
}

export async function getDailyAssistantEventStatus(input: { date: string; artifactRef?: string | null }): Promise<AssistantDailyConfirmation> {
  const params = new URLSearchParams({ date: input.date });
  if (input.artifactRef) params.set('artifact_ref', input.artifactRef);
  const checkedAt = new Date().toISOString();
  try {
    const data = await wfetch<Record<string, unknown>>(`${DAILY_ASSISTANT_EVENT_PATH}/status?${params.toString()}`);
    const artifactRef = artifactRefFrom(data) ?? input.artifactRef ?? null;
    return {
      ok: true,
      status: statusFrom(data),
      date: input.date,
      artifactRef,
      message: messageFrom(data),
      checkedAt,
    };
  } catch (err: any) {
    const message = err?.message ?? String(err);
    const endpointMissing = /404|not found/i.test(message);
    return {
      ok: endpointMissing,
      status: 'unknown',
      date: input.date,
      artifactRef: input.artifactRef ?? null,
      message: endpointMissing ? 'Daily assistant event status endpoint is unavailable.' : message,
      checkedAt,
    };
  }
}

// ── reads ─────────────────────────────────────────────────────────
function asArray(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  for (const k of keys) if (Array.isArray(data?.[k])) return data[k];
  return [];
}

async function fetchProjects(): Promise<any[]> {
  const graphProjects = await fetchProjectMappings().catch((err) => {
    console.warn('[teamforge] project graph sync unavailable; falling back to project summaries', redactForLog(err?.message ?? err));
    return [] as any[];
  });
  if (graphProjects.length > 0) return graphProjects;

  const data = await wfetch('/v1/projects');
  return asArray(data, 'projects', 'items', 'summaries');
}

async function workspaceQueryPath(pathname: string): Promise<string> {
  const workspaceId = await getSetting('tf.workspaceId');
  if (!workspaceId) return pathname;
  return `${pathname}?workspace_id=${encodeURIComponent(workspaceId)}`;
}

async function fetchProjectMappings(): Promise<any[]> {
  const data = await wfetch(await workspaceQueryPath('/v1/project-mappings'));
  return asArray(data, 'projects', 'items', 'mappings');
}

function normalizeProjectPayload(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const project = raw.project ?? raw.Project ?? raw;
  return {
    ...project,
    githubLinks: raw.githubLinks ?? raw.github_links ?? project.githubLinks ?? project.github_links ?? [],
    hulyLinks: raw.hulyLinks ?? raw.huly_links ?? project.hulyLinks ?? project.huly_links ?? [],
    artifacts: raw.artifacts ?? project.artifacts ?? [],
    policy: raw.policy ?? project.policy ?? null,
    clientProfile: raw.clientProfile ?? raw.client_profile ?? project.clientProfile ?? project.client_profile ?? null,
  };
}

function firstGitHubLink(raw: any): any | null {
  const links = asArray(raw.githubLinks ?? raw.github_links ?? raw.repositories ?? raw.repoLinks ?? raw.repo_links ?? raw.githubRepos ?? raw.github_repos);
  if (!links.length) return null;
  return links.find((link) => Boolean(link?.isPrimary ?? link?.is_primary)) ?? links[0];
}

function repoFullNameFromLink(link: any): string | null {
  const direct = link?.repo ?? link?.fullName ?? link?.full_name ?? link?.nameWithOwner ?? link?.name_with_owner ?? link?.repoFullName ?? link?.repo_full_name;
  if (typeof direct === 'string' && direct.includes('/')) return direct.trim().replace(/^https:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  const owner = link?.repoOwner ?? link?.repo_owner ?? link?.owner ?? link?.organization ?? null;
  const name = link?.repoName ?? link?.repo_name ?? link?.name ?? null;
  if (owner && name) return `${String(owner).trim()}/${String(name).trim()}`;
  return parseGitHubFullName(link?.url ?? link?.htmlUrl ?? link?.html_url ?? link?.repoUrl ?? link?.repo_url ?? link?.githubRepoUrl ?? link?.github_repo_url);
}

function normalizeGitHubRepo(raw: any): Partial<Project> {
  const link = firstGitHubLink(raw);
  const linkFullName = link ? repoFullNameFromLink(link) : null;
  const linkUrl = link?.url ?? link?.htmlUrl ?? link?.html_url ?? link?.repoUrl ?? link?.repo_url ?? link?.githubRepoUrl ?? link?.github_repo_url ?? (linkFullName ? `https://github.com/${linkFullName}` : null);
  const repoUrl = raw.githubRepoUrl ?? raw.github_repo_url ?? raw.repoUrl ?? raw.repo_url ?? raw.repositoryUrl ?? raw.repository_url ?? linkUrl ?? null;
  const repoFullName = raw.githubRepoFullName ?? raw.github_repo_full_name ?? raw.repoFullName ?? raw.repo_full_name ?? raw.repositoryFullName ?? raw.repository_full_name ?? linkFullName ?? parseGitHubFullName(repoUrl);
  const numericRepoId = positiveGitHubId(raw.githubRepoId ?? raw.github_repo_id ?? raw.repoId ?? raw.repo_id ?? link?.id);
  const declaredStatus = raw.repoEvidenceStatus ?? raw.repo_evidence_status ?? raw.repoStatus ?? raw.repo_status ?? link?.status ?? link?.repoStatus ?? link?.repo_status;
  const workerVerifiedAt = validWorkerTimestamp(raw.repoVerifiedAt ?? raw.repo_verified_at ?? raw.githubRepoVerifiedAt ?? raw.github_repo_verified_at ?? link?.verifiedAt ?? link?.verified_at);
  const verified = declaredStatus === 'verified' && numericRepoId !== null && Boolean(repoUrl && repoFullName && workerVerifiedAt);
  const repoVerifiedAt = verified ? workerVerifiedAt : null;
  const status = verified ? 'verified' : repoUrl ? 'unverified' : 'missing';
  return {
    githubRepoUrl: repoUrl ?? undefined,
    githubRepoFullName: repoFullName ?? undefined,
    githubRepoId: numericRepoId === null ? undefined : String(numericRepoId),
    repoVerifiedAt: repoVerifiedAt ?? undefined,
    repoEvidenceStatus: status,
    repoRequired: raw.repoRequired ?? raw.repo_required ?? true,
    evidenceStatus: status === 'verified' ? 'pending' : 'missing',
  };
}

function parseGitHubFullName(repoUrl: string | null | undefined): string | null {
  if (!repoUrl) return null;
  const trimmed = repoUrl.trim();
  const match = trimmed.match(/github\.com[:/]+([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
}

function normalizeSession(raw: any): Session {
  const email = String(raw.email ?? '').toLowerCase();
  const displayName = String(raw.displayName ?? raw.display_name ?? (email || 'Thoughtseed Member'));
  const identityId = String(raw.identityId ?? raw.identity_id ?? raw.adminId ?? raw.employeeId ?? email);
  const employeeId = raw.employeeId ?? raw.employee_id ?? null;
  const role = raw.role === 'admin' ? 'admin' : 'employee';
  return {
    employee: {
      id: String(employeeId ?? identityId),
      displayName,
      email,
      avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? undefined,
      monthlyQuotaHours: Number(raw.monthlyQuotaHours ?? raw.monthly_quota_hours ?? 160),
    },
    identityId,
    employeeId,
    adminId: raw.adminId ?? raw.admin_id ?? (role === 'admin' ? identityId : null),
    workspaceId: String(raw.workspaceId ?? raw.workspace_id ?? ''),
    email,
    role,
    displayName,
    projectVisibility: raw.projectVisibility ?? raw.project_visibility ?? (role === 'admin' ? 'all' : 'active'),
    capabilities: raw.capabilities ?? {},
    onboarding: raw.onboarding ?? { steps: [], requiredComplete: false, completed: false },
    signedInAt: new Date().toISOString(),
  };
}

async function persistSession(session: Session): Promise<void> {
  await setSetting('tf.session', JSON.stringify(session));
  if (session.workspaceId) await setSetting('tf.workspaceId', session.workspaceId);
}

const ONBOARDING_STEP_DEFAULTS: Record<string, { label: string; requirement: 'required' | 'optional' }> = {
  identity_projects: { label: 'Identity and project access', requirement: 'required' },
  preferences: { label: 'Personal preferences', requirement: 'optional' },
  paperclip: { label: 'Paperclip / Vapor Clip agent fabric', requirement: 'optional' },
  daily_agent: { label: 'Daily agent and standup', requirement: 'optional' },
};

function isClosedOnboardingState(state: OnboardingStateValue): boolean {
  return state === 'completed' || state === 'skipped' || state === 'deferred';
}

async function persistLocalOnboardingUpdate(
  stepId: string,
  state: OnboardingStateValue,
  metadata: Record<string, unknown>,
  reason: string,
): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  const now = new Date().toISOString();
  const fallback = ONBOARDING_STEP_DEFAULTS[stepId] ?? {
    label: stepId.replace(/_/g, ' '),
    requirement: state === 'required' ? 'required' : 'optional',
  };
  const existingSteps = session.onboarding?.steps ?? [];
  const steps = existingSteps.some((step) => step.stepId === stepId)
    ? existingSteps.map((step) => step.stepId === stepId
      ? {
        ...step,
        state,
        updatedAt: now,
        metadata: {
          ...(step.metadata ?? {}),
          ...metadata,
          localOnly: true,
          pendingRemoteSync: true,
          localSavedAt: now,
          localReason: reason,
        },
      }
      : step)
    : [
      ...existingSteps,
      {
        stepId,
        label: fallback.label,
        requirement: fallback.requirement,
        state,
        updatedAt: now,
        metadata: {
          ...metadata,
          localOnly: true,
          pendingRemoteSync: true,
          localSavedAt: now,
          localReason: reason,
        },
      },
    ];
  const requiredComplete = steps.every((step) => step.requirement !== 'required' || step.state === 'completed');
  const completed = requiredComplete && steps.every((step) => isClosedOnboardingState(step.state));
  const next: Session = {
    ...session,
    onboarding: {
      steps,
      requiredComplete,
      completed,
    },
  };
  await persistSession(next);
  return next;
}

// ── auth (Cloudflare Access → role-aware Plexus session) ──────────
export async function login(email: string): Promise<{ ok: boolean; session?: Session; message?: string }> {
  const target = email.trim().toLowerCase();
  if (!target) return { ok: false, message: 'Enter your email.' };
  const session = await whoami();
  if (!session) return { ok: false, message: 'Sign in with Cloudflare Access first.' };
  if (session.email !== target) return { ok: false, message: `Signed in as ${session.email}, not ${target}.` };
  await persistSession(session);
  return { ok: true, session };
}

export async function getSession(): Promise<Session | null> {
  const raw = await getSetting('tf.session');
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

export async function logout(): Promise<void> {
  await setSetting('tf.session', '');
  await clearAccessJwt();
  await clearAccessBrowserSession();
}

async function clearAccessBrowserSession(): Promise<void> {
  // Fully reset the CF Access partition: every cookie, LocalStorage,
  // sessionStorage, IndexedDB, ServiceWorker, and cache. Removing only the
  // CF_Authorization cookie (the previous behavior) left CF Access tracking
  // cookies that paired the next OTP with stale auth state and surfaced as
  // "This One-Time Pin has already been used" on a fresh code.
  const accessSession = electronSession.fromPartition(ACCESS_LOGIN_PARTITION);
  await accessSession.clearStorageData();
  await accessSession.clearCache();
}

// ── project sync (preload into local cache) ───────────────────────
export async function syncProjects(): Promise<{ ok: boolean; count: number; message?: string }> {
  try {
    const remote = (await fetchProjects()).map(normalizeProjectPayload);
    const active = remote.filter(p => (p.status ?? 'active') === 'active');
    const existing = await listProjects();
    const byId = new Map(existing.map(p => [p.id, p]));
    let i = 0;
    for (const r of active) {
      const id = String(r.id ?? r.projectId ?? '');
      if (!id) continue;
      const name = r.name ?? r.displayName ?? `Project ${id.slice(0, 8)}`;
      const clientName = r.clientName ?? r.client_name ?? undefined;
      const repo = normalizeGitHubRepo(r);
      const current = byId.get(id);
      if (current) {
        await updateProject(id, {
          name,
          clientName,
          ...(repo.githubRepoUrl ? repo : {}),
        });
      } else {
        const project: Project = {
          id, name, clientName,
          color: PALETTE[i % PALETTE.length],
          archived: false,
          ...repo,
          createdAt: new Date().toISOString(),
        };
        await insertProject(project);
      }
      i++;
    }
    return { ok: true, count: active.length };
  } catch (err: any) {
    return { ok: false, count: 0, message: err.message };
  }
}

const GITHUB_CONNECTION_STATES = new Set<GitHubConnectionState>([
  'unconfigured',
  'pending',
  'connected',
  'suspended',
  'forbidden',
]);

const GITHUB_VERIFICATION_STATES = new Set<GitHubRepoVerificationStatus>([
  'unconfigured',
  'pending',
  'suspended',
  'forbidden',
  'verified',
]);

function githubConnectionState(value: unknown, fallback: GitHubConnectionState): GitHubConnectionState {
  return typeof value === 'string' && GITHUB_CONNECTION_STATES.has(value as GitHubConnectionState)
    ? value as GitHubConnectionState
    : fallback;
}

function githubVerificationState(value: unknown, fallback: GitHubRepoVerificationStatus): GitHubRepoVerificationStatus {
  return typeof value === 'string' && GITHUB_VERIFICATION_STATES.has(value as GitHubRepoVerificationStatus)
    ? value as GitHubRepoVerificationStatus
    : fallback;
}

function githubConnectionStateFromError(error: unknown): Exclude<GitHubConnectionState, 'connected'> {
  const requestError = error instanceof WorkerRequestError ? error : null;
  const signal = `${requestError?.code ?? ''} ${requestError?.message ?? String(error)}`.toLowerCase();
  if (requestError?.httpStatus === 403 || /forbidden|admin_required|permission/.test(signal)) return 'forbidden';
  if (/suspend|installation_inactive|installation_deleted/.test(signal)) return 'suspended';
  if (/unconfigured|not_configured|app_not_configured|installation_missing/.test(signal)) return 'unconfigured';
  return 'pending';
}

function githubVerificationStateFromError(error: unknown): Exclude<GitHubRepoVerificationStatus, 'verified'> {
  return githubConnectionStateFromError(error);
}

function githubConnectionMessage(status: GitHubConnectionState): string {
  if (status === 'unconfigured') return 'The workspace GitHub App is not configured yet.';
  if (status === 'pending') return 'The GitHub connection is waiting for installation or workspace confirmation.';
  if (status === 'suspended') return 'The workspace GitHub App installation is suspended.';
  if (status === 'forbidden') return 'An administrator must manage the workspace GitHub connection.';
  return 'The workspace GitHub connection is ready.';
}

function githubVerificationMessage(status: GitHubRepoVerificationStatus): string {
  if (status === 'unconfigured') return 'Connect the workspace GitHub App before verifying repositories.';
  if (status === 'pending') return 'Repository access is waiting for the GitHub installation to finish syncing.';
  if (status === 'suspended') return 'Repository verification is blocked because the GitHub installation is suspended.';
  if (status === 'forbidden') return 'This repository is not available to the authenticated workspace.';
  return 'Repository access was verified through the workspace GitHub App.';
}

function positiveGitHubId(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function validWorkerTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = value.trim();
  return Number.isFinite(Date.parse(timestamp)) ? timestamp : null;
}

function safeGitHubFullName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const fullName = value.trim();
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName) ? fullName : null;
}

function safeGitHubRepositoryUrl(value: unknown, fullName: string): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || path.toLowerCase() !== fullName.toLowerCase()) return null;
    return `https://github.com/${fullName}`;
  } catch {
    return null;
  }
}

const PINNED_GITHUB_TARGET_BY_ID = new Map<number, GitHubInstallationTarget>(
  THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.map((target) => [target.id, { ...target }]),
);
const PINNED_FOUNDER_ID_BY_LOGIN = new Map(
  THOUGHTSEED_GITHUB_INSTALLATION_TARGETS
    .filter((target) => target.type === 'User' && (THOUGHTSEED_GITHUB_FOUNDERS as readonly string[]).includes(target.login))
    .map((target) => [target.login.toLowerCase(), target.id]),
);

function exactFounderLogins(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length !== THOUGHTSEED_GITHUB_FOUNDERS.length) return null;
  const normalized = raw.map((value) => typeof value === 'string' ? value.toLowerCase() : null);
  if (normalized.some((value) => !value)) return null;
  const uniqueLogins = new Set(normalized as string[]);
  if (uniqueLogins.size !== THOUGHTSEED_GITHUB_FOUNDERS.length
    || !THOUGHTSEED_GITHUB_FOUNDERS.every((login) => uniqueLogins.has(login.toLowerCase()))) return null;
  return [...THOUGHTSEED_GITHUB_FOUNDERS];
}

function normalizeGitHubInstallationTarget(raw: any): GitHubInstallationTarget | null {
  const id = positiveGitHubId(raw?.id ?? raw?.accountId ?? raw?.account_id);
  const login = typeof (raw?.login ?? raw?.accountLogin ?? raw?.account_login) === 'string'
    ? String(raw?.login ?? raw?.accountLogin ?? raw?.account_login).trim()
    : '';
  const type = raw?.type ?? raw?.accountType ?? raw?.account_type;
  const pinned = id ? PINNED_GITHUB_TARGET_BY_ID.get(id) : null;
  if (!pinned || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login)
    || pinned.type !== type || pinned.login.toLowerCase() !== login.toLowerCase()) return null;
  return { ...pinned };
}

function exactPinnedGitHubInstallationTargets(raw: unknown): GitHubInstallationTarget[] | null {
  if (!Array.isArray(raw) || raw.length !== THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.length) return null;
  const normalized = raw.map(normalizeGitHubInstallationTarget);
  if (normalized.some((target) => !target)) return null;
  const allowedTargets = normalized as GitHubInstallationTarget[];
  const uniqueIds = new Set(allowedTargets.map((target) => target.id));
  if (uniqueIds.size !== THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.length
    || !THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.every((target) => uniqueIds.has(target.id))) return null;
  return allowedTargets;
}

function optionalGitHubRepositorySelection(raw: any): 'selected' | 'all' | undefined | null {
  const value = raw?.repositorySelection ?? raw?.repository_selection;
  if (value === undefined || value === null) return undefined;
  return value === 'selected' || value === 'all' ? value : null;
}

function normalizeGitHubRepoOption(raw: any): GitHubRepoOption | null {
  const id = positiveGitHubId(raw?.id ?? raw?.repositoryId ?? raw?.repository_id);
  const installationId = positiveGitHubId(raw?.installationId ?? raw?.installation_id);
  const account = normalizeGitHubInstallationTarget(raw?.account);
  const repositorySelection = optionalGitHubRepositorySelection(raw);
  const fullName = safeGitHubFullName(raw?.fullName ?? raw?.full_name ?? raw?.nameWithOwner);
  const ownerLogin = fullName?.split('/')[0] ?? '';
  const url = fullName
    ? safeGitHubRepositoryUrl(raw?.url ?? raw?.htmlUrl ?? raw?.html_url ?? `https://github.com/${fullName}`, fullName)
    : null;
  if (!id || !installationId || !account || !fullName || !url || repositorySelection === null
    || ownerLogin.toLowerCase() !== account.login.toLowerCase()) return null;
  return {
    id,
    installationId,
    ...(repositorySelection ? { repositorySelection } : {}),
    account,
    fullName,
    url,
    source: 'worker',
    private: raw?.private !== false,
    verifiedAt: typeof raw?.verifiedAt === 'string'
      ? raw.verifiedAt
      : typeof raw?.verified_at === 'string' ? raw.verified_at : null,
  };
}

export async function getGitHubConnectionStatus(): Promise<GitHubConnectionStatus> {
  try {
    const data = await wfetch<any>('/v1/github/connection');
    const connection = data?.connection ?? data ?? {};
    const status = githubConnectionState(connection.status ?? connection.state, 'pending');
    const installations = (Array.isArray(connection.installations) ? connection.installations : [])
      .flatMap((raw: any): GitHubInstallationSummary[] => {
        const installationId = positiveGitHubId(raw?.installationId ?? raw?.installation_id);
        const account = normalizeGitHubInstallationTarget(raw?.account);
        const installationStatus = githubConnectionState(raw?.status ?? raw?.state, 'forbidden');
        const repositorySelection = optionalGitHubRepositorySelection(raw);
        return installationId && account && repositorySelection !== null
          ? [{ installationId, ...(repositorySelection ? { repositorySelection } : {}), account, status: installationStatus }]
          : [];
      });
    const exactAllowedTargets = exactPinnedGitHubInstallationTargets(connection.allowedTargets);
    const policyComplete = Boolean(exactAllowedTargets);
    const allowedTargets = exactAllowedTargets ?? [];
    const targets = normalizeGitHubConnectionTargets(connection.targets);
    const normalizedStatus: GitHubConnectionState = policyComplete ? status : 'forbidden';
    const repositoryCount = Math.max(0, Number.isSafeInteger(Number(connection.repositoryCount ?? connection.repository_count))
      ? Number(connection.repositoryCount ?? connection.repository_count)
      : 0);
    const updatedAt = typeof connection.updatedAt === 'string'
      ? connection.updatedAt
      : typeof connection.updated_at === 'string' ? connection.updated_at : null;
    return {
      status: normalizedStatus,
      installations,
      allowedTargets,
      ...(targets ? { targets } : {}),
      repositoryCount,
      updatedAt,
      message: policyComplete
        ? githubConnectionMessage(normalizedStatus)
        : 'The Worker did not return the complete pinned GitHub installation-owner policy.',
    };
  } catch (error) {
    const status = githubConnectionStateFromError(error);
    return { status, installations: [], allowedTargets: [], repositoryCount: 0, message: githubConnectionMessage(status) };
  }
}

export async function startGitHubConnection(accountId: number): Promise<GitHubConnectStartResult & { authorizeUrl?: string }> {
  if (!Number.isSafeInteger(accountId) || accountId <= 0 || !PINNED_GITHUB_TARGET_BY_ID.has(accountId)) {
    return { status: 'forbidden', message: 'Choose an exact allowlisted GitHub installation owner.' };
  }
  try {
    const data = await wpost<any>('/v1/github/connect/start', { accountId });
    const status = githubConnectionState(data?.status ?? data?.state, 'pending');
    const authorizeUrl = typeof (data?.authorizeUrl ?? data?.authorize_url) === 'string'
      ? String(data?.authorizeUrl ?? data?.authorize_url)
      : undefined;
    const target = normalizeGitHubInstallationTarget(data?.target);
    if (!authorizeUrl || !target || target.id !== accountId) {
      return { status: 'forbidden', message: 'The Worker did not confirm the requested GitHub installation owner.' };
    }
    return { status, target, authorizeUrl, message: githubConnectionMessage(status) };
  } catch (error) {
    const status = githubConnectionStateFromError(error);
    return { status, message: githubConnectionMessage(status) };
  }
}

function githubActorState(value: unknown, fallback: GitHubActorState): GitHubActorState {
  return value === 'unconfigured'
    || value === 'not_enrolled'
    || value === 'pending'
    || value === 'verified'
    || value === 'forbidden'
    ? value
    : fallback;
}

function githubActorMessage(status: GitHubActorState): string {
  if (status === 'unconfigured') return 'The workspace GitHub App must be connected before founder verification.';
  if (status === 'not_enrolled') return 'Verify this Plexus member with an allowed Thoughtseed Labs GitHub identity.';
  if (status === 'pending') return 'Founder verification is waiting for GitHub authorization.';
  if (status === 'forbidden') return 'This Plexus member is not permitted to enroll a founder identity.';
  return 'This Plexus member has a verified founder GitHub identity.';
}

function normalizeGitHubActorStatus(data: any): GitHubActorStatus {
  const payload = data?.actorStatus ?? data?.actor_status ?? data ?? {};
  const status = githubActorState(payload.status ?? payload.state, 'not_enrolled');
  const allowedRaw = Array.isArray(payload.allowedLogins)
    ? payload.allowedLogins
    : Array.isArray(payload.allowed_logins) ? payload.allowed_logins : [];
  const exactAllowedLogins = exactFounderLogins(allowedRaw);
  const policyComplete = Boolean(exactAllowedLogins);
  const allowedLogins = exactAllowedLogins ?? [];
  const rawActor = payload.actor;
  const actorId = Number(rawActor?.id);
  const actorLogin = typeof rawActor?.login === 'string' && /^[A-Za-z0-9-]{1,39}$/.test(rawActor.login)
    ? rawActor.login
    : '';
  const actorVerifiedAt = typeof rawActor?.verifiedAt === 'string'
    ? rawActor.verifiedAt
    : typeof rawActor?.verified_at === 'string' ? rawActor.verified_at : '';
  const actorMatchesPinnedIdentity = PINNED_FOUNDER_ID_BY_LOGIN.get(actorLogin.toLowerCase()) === actorId;
  const normalizedStatus: GitHubActorState = policyComplete && (status !== 'verified' || actorMatchesPinnedIdentity)
    ? status
    : 'forbidden';
  return {
    status: normalizedStatus,
    allowedLogins,
    actor: normalizedStatus === 'verified' && Number.isSafeInteger(actorId) && actorId > 0 && actorLogin && actorVerifiedAt
      ? { id: actorId, login: actorLogin, verifiedAt: actorVerifiedAt }
      : null,
    message: policyComplete && (status !== 'verified' || actorMatchesPinnedIdentity)
      ? githubActorMessage(normalizedStatus)
      : 'The Worker did not return the complete pinned founder identity policy.',
  };
}

export async function getGitHubActorStatus(): Promise<GitHubActorStatus> {
  try {
    return normalizeGitHubActorStatus(await wfetch<any>('/v1/github/actor'));
  } catch (error) {
    const connectionState = githubConnectionStateFromError(error);
    const status: GitHubActorState = connectionState === 'unconfigured'
      ? 'unconfigured'
      : connectionState === 'forbidden' ? 'forbidden' : 'pending';
    return {
      status,
      allowedLogins: ['Sheshiyer', 'psychon7'],
      message: githubActorMessage(status),
    };
  }
}

export async function startGitHubActorEnrollment(): Promise<GitHubActorEnrollStartResult & { authorizeUrl?: string }> {
  try {
    const data = await wpost<any>('/v1/github/actor/enroll/start', {});
    const status = githubActorState(data?.status ?? data?.state, 'pending');
    const authorizeUrl = typeof (data?.authorizeUrl ?? data?.authorize_url) === 'string'
      ? String(data?.authorizeUrl ?? data?.authorize_url)
      : undefined;
    const allowedRaw = Array.isArray(data?.allowedLogins)
      ? data.allowedLogins
      : Array.isArray(data?.allowed_logins) ? data.allowed_logins : [];
    const allowedLogins = exactFounderLogins(allowedRaw);
    if (!allowedLogins) {
      return {
        status: 'forbidden',
        allowedLogins: [],
        message: 'The Worker did not return the complete pinned founder identity policy.',
      };
    }
    return {
      status,
      allowedLogins,
      ...(authorizeUrl ? { authorizeUrl } : {}),
      message: githubActorMessage(status),
    };
  } catch (error) {
    const connectionState = githubConnectionStateFromError(error);
    const status: GitHubActorState = connectionState === 'unconfigured'
      ? 'unconfigured'
      : connectionState === 'forbidden' ? 'forbidden' : 'pending';
    return {
      status,
      allowedLogins: ['Sheshiyer', 'psychon7'],
      message: githubActorMessage(status),
    };
  }
}

export async function listGitHubRepositories(): Promise<GitHubRepositoryListResult> {
  try {
    const data = await wfetch<any>('/v1/github/repositories');
    const status = githubConnectionState(data?.status ?? data?.state, 'pending');
    if (status !== 'connected') return { status, repositories: [], message: githubConnectionMessage(status) };
    const normalized = asArray(data, 'repositories', 'repos', 'items')
      .map(normalizeGitHubRepoOption)
      .filter((repository): repository is GitHubRepoOption => Boolean(repository));
    const repositories = [...new Map(normalized.map((repository) => [`${repository.installationId}:${repository.id}`, repository])).values()]
      .sort((left, right) => left.fullName.localeCompare(right.fullName) || left.id - right.id);
    return { status, repositories, message: githubConnectionMessage(status) };
  } catch (error) {
    const status = githubConnectionStateFromError(error);
    return { status, repositories: [], message: githubConnectionMessage(status) };
  }
}

export async function verifyProjectRepo(projectId: string, installationId: number, repositoryId: number): Promise<ProjectRepoVerification> {
  if (!Number.isSafeInteger(installationId) || installationId <= 0 || !Number.isSafeInteger(repositoryId) || repositoryId <= 0) {
    return { ok: false, status: 'forbidden', message: githubVerificationMessage('forbidden') };
  }

  try {
    const data = await wpost<any>(`/v1/projects/${encodeURIComponent(projectId)}/github-repo/verify`, { installationId, repositoryId });
    const status = githubVerificationState(data?.status ?? data?.state, 'pending');
    if (status !== 'verified') return { ok: false, status, message: githubVerificationMessage(status) };

    const repository = normalizeGitHubRepoOption(data?.repository ?? data?.repo ?? data?.project ?? data);
    if (!repository || repository.id !== repositoryId || repository.installationId !== installationId) {
      return { ok: false, status: 'forbidden', message: githubVerificationMessage('forbidden') };
    }

    const existing = (await listProjects()).find((project) => project.id === projectId);
    const projectPayload = data?.project ?? {};
    const verifiedAt = validWorkerTimestamp(
      projectPayload.repoVerifiedAt
      ?? projectPayload.repo_verified_at
      ?? repository.verifiedAt,
    );
    if (!verifiedAt) {
      return { ok: false, status: 'pending', message: githubVerificationMessage('pending') };
    }
    const project: Project = {
      id: projectId,
      name: existing?.name ?? (typeof projectPayload.name === 'string' ? projectPayload.name : `Project ${projectId.slice(0, 8)}`),
      clientName: existing?.clientName,
      color: existing?.color ?? '#56C8B0',
      archived: existing?.archived ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      githubRepoUrl: repository.url,
      githubRepoFullName: repository.fullName,
      githubRepoId: String(repository.id),
      repoVerifiedAt: verifiedAt,
      repoEvidenceStatus: 'verified',
      repoRequired: true,
      evidenceStatus: 'pending',
    };
    return {
      ok: true,
      status: 'verified',
      repo: { ...repository, verifiedAt },
      project,
      message: githubVerificationMessage('verified'),
    };
  } catch (error) {
    const status = githubVerificationStateFromError(error);
    return { ok: false, status, message: githubVerificationMessage(status) };
  }
}

const GITHUB_CI_STATUSES = new Set<GitHubCiEvidence['status']>([
  'queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending',
]);
const GITHUB_CI_CONCLUSIONS = new Set<Exclude<GitHubCiEvidence['conclusion'], null>>([
  'success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required', 'stale', 'startup_failure',
]);

export function emptyGitHubCiEvidence(): GitHubCiEvidenceBatch {
  return { items: [], truncated: false, checkedShas: [] };
}

function boundedWorkerString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function nullableWorkerString(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  const normalized = boundedWorkerString(value, maxLength);
  return normalized ?? undefined;
}

function safeGitHubArtifactUrl(value: unknown, fullName: string): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const repoPrefix = `/${fullName.toLowerCase()}/`;
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.toLowerCase().startsWith(repoPrefix)) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeGitHubActivityItem(raw: unknown, projectId: string): GitHubActivity | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const id = boundedWorkerString(item.id, 512);
  const repoFullName = safeGitHubFullName(item.repoFullName);
  const repoUrl = repoFullName ? safeGitHubRepositoryUrl(item.repoUrl, repoFullName) : null;
  const kind = item.kind;
  const title = boundedWorkerString(item.title, 1024);
  const url = repoFullName ? safeGitHubArtifactUrl(item.url, repoFullName) : null;
  const occurredAt = validWorkerTimestamp(item.occurredAt);
  const occurredMs = Date.parse(occurredAt ?? '');
  const actor = nullableWorkerString(item.actor, 255);
  if (!id || item.projectId !== projectId || !repoFullName || !repoUrl || !title || !url || !occurredAt
    || !Number.isFinite(occurredMs)
    || (kind !== 'commit' && kind !== 'pull_request' && kind !== 'issue') || actor === undefined) return null;
  return {
    id,
    projectId,
    repoFullName,
    repoUrl,
    kind,
    title,
    url,
    actor,
    occurredAt,
    metadata: item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? item.metadata as Record<string, unknown>
      : {},
  };
}

export function normalizeGitHubCiEvidence(
  value: unknown,
  projectId: string,
  from?: string,
  to?: string,
): GitHubCiEvidenceBatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyGitHubCiEvidence();
  const raw = value as Record<string, unknown>;
  const fromMs = from ? Date.parse(from) : Number.NEGATIVE_INFINITY;
  const toMs = to ? Date.parse(to) : Number.POSITIVE_INFINITY;
  const items = Array.isArray(raw.items) ? raw.items : [];
  const normalized = items.flatMap((candidate): GitHubCiEvidence[] => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    const externalId = positiveGitHubId(item.externalId);
    const repoFullName = safeGitHubFullName(item.repoFullName);
    const evidenceType = item.evidenceType === 'workflow_run' || item.evidenceType === 'check_run' ? item.evidenceType : null;
    const expectedKind = evidenceType === 'workflow_run' ? 'workflow' : evidenceType === 'check_run' ? 'check' : null;
    const id = boundedWorkerString(item.id, 512);
    const name = boundedWorkerString(item.name, 512);
    const status = GITHUB_CI_STATUSES.has(item.status as GitHubCiEvidence['status']) ? item.status as GitHubCiEvidence['status'] : null;
    const conclusion = item.conclusion === null || item.conclusion === undefined
      ? null
      : GITHUB_CI_CONCLUSIONS.has(item.conclusion as Exclude<GitHubCiEvidence['conclusion'], null>)
        ? item.conclusion as Exclude<GitHubCiEvidence['conclusion'], null>
        : undefined;
    const url = repoFullName ? safeGitHubArtifactUrl(item.url, repoFullName) : null;
    const headSha = typeof item.headSha === 'string' && /^[a-f0-9]{40}$/i.test(item.headSha) ? item.headSha.toLowerCase() : null;
    const attempt = item.attempt === null || item.attempt === undefined ? null : positiveGitHubId(item.attempt);
    const event = nullableWorkerString(item.event, 255);
    const branch = nullableWorkerString(item.branch, 255);
    const actor = nullableWorkerString(item.actor, 255);
    const occurredAt = validWorkerTimestamp(item.occurredAt);
    const occurredMs = Date.parse(occurredAt ?? '');
    const idPattern = externalId && expectedKind ? `github:${'\\d+'}:${expectedKind}:${externalId}` : '';
    if (!externalId || item.projectId !== projectId || item.evidenceClass !== 'ci' || !evidenceType || !id
      || !new RegExp(`^${idPattern}$`).test(id) || !repoFullName || !name || !status || conclusion === undefined || !url || !headSha
      || (item.attempt !== null && item.attempt !== undefined && attempt === null)
      || event === undefined || branch === undefined || actor === undefined || !occurredAt
      || !Number.isFinite(occurredMs) || occurredMs < fromMs || occurredMs >= toMs) return [];
    return [{
      id,
      externalId,
      projectId,
      repoFullName,
      evidenceClass: 'ci',
      evidenceType,
      name,
      status,
      conclusion,
      url,
      headSha,
      attempt,
      event,
      branch,
      actor,
      occurredAt,
      metadata: item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
        ? item.metadata as Record<string, unknown>
        : {},
    }];
  });
  const checkedShas = Array.isArray(raw.checkedShas)
    ? [...new Set(raw.checkedShas.filter((sha): sha is string => typeof sha === 'string' && /^[a-f0-9]{40}$/i.test(sha)).map((sha) => sha.toLowerCase()))].slice(0, 25)
    : [];
  return { items: normalized, truncated: raw.truncated === true, checkedShas };
}

export async function syncGitHubActivity(projectId: string, from: string, to: string): Promise<GitHubActivitySyncResult> {
  try {
    const data = await wpost<any>(`/v1/projects/${encodeURIComponent(projectId)}/github-activity/sync`, { from, to });
    const rawStatus = data?.status ?? data?.state;
    if (rawStatus !== 'synced') {
      const blockedStatus: Exclude<GitHubRepoVerificationStatus, 'verified'> =
        rawStatus === 'unconfigured' || rawStatus === 'suspended' || rawStatus === 'forbidden'
          ? rawStatus
          : 'pending';
      return { ok: false, status: blockedStatus, activity: [], ciEvidence: emptyGitHubCiEvidence(), message: githubVerificationMessage(blockedStatus) };
    }
    const activity = asArray(data, 'activity', 'items')
      .map((item) => normalizeGitHubActivityItem(item, projectId))
      .filter((item): item is GitHubActivity => Boolean(item));
    return {
      ok: true,
      status: 'synced',
      activity,
      ciEvidence: normalizeGitHubCiEvidence(data?.ciEvidence, projectId, from, to),
    };
  } catch (error) {
    const status = githubVerificationStateFromError(error);
    return { ok: false, status, activity: [], ciEvidence: emptyGitHubCiEvidence(), message: githubVerificationMessage(status) };
  }
}

// ── time-entry write-back (offline-tolerant queue via synced_at) ──
let flushing = false;
export async function flushTimeEntries(): Promise<{ ok: boolean; pushed: number; message?: string }> {
  if (flushing) return { ok: true, pushed: 0 };
  flushing = true;
  try {
    if (!(await authHeaders())) return { ok: false, pushed: 0, message: 'not connected' };
    const session = await getSession();
    if (!session) return { ok: false, pushed: 0, message: 'no session' };
    const unsynced = await listUnsyncedEntries();
    if (!unsynced.length) return { ok: true, pushed: 0 };
    await wpost('/v1/time-entries', {
      workspaceId: session.workspaceId,
      entries: unsynced.map(e => ({
        id: e.id,
        employeeId: session.employeeId ?? session.employee.id,
        projectId: e.projectId,
        source: e.source,
        description: e.description,
        startTime: e.startTime,
        endTime: e.endTime,
        durationSeconds: e.durationSeconds,
        githubRepoUrl: e.githubRepoUrl,
        githubRepoFullName: e.githubRepoFullName,
        evidenceStatus: e.evidenceStatus ?? 'pending',
        githubActivityIds: e.githubActivityIds ?? [],
      })),
    });
    const ts = new Date().toISOString();
    for (const e of unsynced) await updateEntry(e.id, { syncedAt: ts });
    return { ok: true, pushed: unsynced.length };
  } catch (err: any) {
    return { ok: false, pushed: 0, message: err.message };
  } finally {
    flushing = false;
  }
}

// ── Cloudflare Access OTP sign-in (Phase 4) ───────────────────────
export async function whoami(): Promise<Session | null> {
  try {
    const result = await wfetch('/v1/whoami');
    return normalizeSession(result);
  } catch (err) {
    console.error('[whoami] Error:', redactForLog(err));
    return null;
  }
}

export async function refreshSession(): Promise<{ ok: boolean; session?: Session; message?: string }> {
  try {
    const session = await whoami();
    if (!session) return { ok: false, message: 'No role-aware identity returned.' };
    await persistSession(session);
    return { ok: true, session };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

/** Decode JWT payload (no verification — just for diagnostics). */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = 4 - (b64.length % 4);
    const padded = b64 + (pad < 4 ? '='.repeat(pad) : '');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function findAppAccessTokenFromCookies(
  session: Electron.Session,
  origin: string,
  rejectedTokens: Set<string> = new Set(),
): Promise<string | null> {
  const appHost = new URL(origin).hostname;
  const scheme = new URL(origin).protocol;
  const hostScoped = await session.cookies.get({ name: 'CF_Authorization', url: `${scheme}//${appHost}` });
  const hostMatch = hostScoped.find(c => c.value && !rejectedTokens.has(c.value) && isUsableAccessJwt(c.value));
  if (hostMatch?.value) {
    return hostMatch.value;
  }

  const all = await session.cookies.get({ name: 'CF_Authorization' });
  const any = all.find(c => c.value && !rejectedTokens.has(c.value) && isUsableAccessJwt(c.value))?.value;
  if (any) {
    return any;
  }
  const nonApp = all.find(c => c.value)?.value;
  if (nonApp) {
    console.log('[accessLogin] cookie candidate found but not usable app token.');
  }
  return null;
}

async function whoamiWithJwt(jwt: string): Promise<Session> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/v1/whoami`, {
    headers: {
      Accept: 'application/json',
      'Cf-Access-Jwt-Assertion': jwt,
      Cookie: `CF_Authorization=${jwt}`,
    },
  });
  const json: any = await parseWorkerJson(res, `${base}/v1/whoami`);
  const data = json && typeof json === 'object' && 'ok' in json ? json.data : json;
  return normalizeSession(data);
}

function configuredAccessLoginOrigins(): string[] {
  return (process.env.PLEXUS_ACCESS_LOGIN_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function normalizedOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isAllowedAccessLoginNavigation(url: string, target: string): boolean {
  try {
    const candidate = new URL(url);
    const targetOrigin = normalizedOrigin(target);
    if (targetOrigin && candidate.origin === targetOrigin) return true;

    if (candidate.protocol === 'https:' && (
      candidate.hostname === 'cloudflareaccess.com'
      || candidate.hostname.endsWith('.cloudflareaccess.com')
    )) {
      return true;
    }

    return configuredAccessLoginOrigins().some(origin => normalizedOrigin(origin) === candidate.origin);
  } catch {
    return false;
  }
}

export function createAccessLoginWindow(target: string): BrowserWindow {
  const win = new BrowserWindow(accessLoginWindowOptions());
  configureAccessLoginWindow(win, target);
  return win;
}

function accessLoginWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 460,
    height: 680,
    title: 'Sign in — Cloudflare Access',
    autoHideMenuBar: true,
    webPreferences: {
      partition: ACCESS_LOGIN_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
    },
  };
}

function configureAccessLoginWindow(win: BrowserWindow, target: string): void {
  const denyBlockedNavigation = (event: Electron.Event, url: string) => {
    if (isAllowedAccessLoginNavigation(url, target)) return;
    event.preventDefault();
  };

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', denyBlockedNavigation);
  win.webContents.on('will-redirect', denyBlockedNavigation);
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  win.webContents.session.setPermissionCheckHandler(() => false);
}


export async function testJwt(): Promise<{ ok: boolean; email?: string; message?: string }> {
  try {
    const jwt = await getAccessJwt();
    if (!jwt) return { ok: false, message: 'No JWT in database' };

    const base = await getBaseUrl();
    const res1 = await fetch(`${base}/v1/whoami`, {
      headers: {
        'Accept': 'application/json',
        'Cf-Access-Jwt-Assertion': jwt,
        'Cookie': `CF_Authorization=${jwt}`,
      },
    });
    const body1 = await res1.text();
    return { ok: res1.ok, message: `whoami ${res1.status}: ${body1.substring(0, 160)}` };
  } catch (err: any) {
    console.error('[testJwt] Error:', redactForLog(err));
    return { ok: false, message: err.message ?? 'Unknown error' };
  }
}

/**
 * Open a BrowserWindow to an Access-protected endpoint. Cloudflare Access
 * intercepts with its OTP/SSO login; on success it sets the CF_Authorization
 * cookie, which we capture as the Access JWT and store via safeStorage.
 */
export async function accessLogin(): Promise<{ ok: boolean; session?: Session; message?: string }> {
  const base = await getBaseUrl();
  const target = `${base}/v1/whoami`;
  if (normalizedOrigin(target)?.startsWith('https://') !== true) {
    return { ok: false, message: 'Cloudflare Access sign-in requires an HTTPS workspace URL.' };
  }
  return new Promise((resolve) => {
    const win = createAccessLoginWindow(target);
    let settled = false;
    const rejectedTokens = new Set<string>();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const settle = (result: { ok: boolean; session?: Session; message?: string }, closeWindow: boolean) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      win.webContents.removeListener('did-navigate', tryCapture);
      win.webContents.removeListener('did-redirect-navigation', tryCapture);
      win.webContents.removeListener('did-finish-load', tryCapture);
      win.removeListener('closed', onClosed);
      if (closeWindow && !win.isDestroyed()) win.close();
      resolve(result);
    };
    const onClosed = () => settle({ ok: false, message: 'Sign-in cancelled.' }, false);
    const tryCapture = async () => {
      if (settled) return;
      let jwt: string | null = null;
      try {
        jwt = await findAppAccessTokenFromCookies(win.webContents.session, target, rejectedTokens);
        if (!jwt) return;
        const session = await whoamiWithJwt(jwt);
        await setAccessJwt(jwt);
        if (session) await persistSession(session);
        settle({ ok: true, session }, true);
      } catch (err) {
        if (jwt) rejectedTokens.add(jwt);
        console.error('[accessLogin] Error in tryCapture:', redactForLog(err));
        /* keep waiting for the cookie */
      }
    };
    win.webContents.on('did-navigate', tryCapture);
    win.webContents.on('did-redirect-navigation', tryCapture);
    win.webContents.on('did-finish-load', tryCapture);
    win.on('closed', onClosed);
    timeout = setTimeout(() => {
      settle({ ok: false, message: 'Sign-in timed out.' }, true);
    }, ACCESS_LOGIN_TIMEOUT_MS);
    win.loadURL(target).catch((e: any) => {
      settle({ ok: false, message: e.message }, true);
    });
  });
}

export async function loginWithAccess(): Promise<{ ok: boolean; session?: Session; message?: string }> {
  const al = await accessLogin();
  if (!al.ok || !al.session) return { ok: false, message: al.message ?? 'Access sign-in failed.' };
  return { ok: true, session: al.session };
}

// ── Phase 7: Member Provisioning (email-only, no device secrets) ──
export async function provisionMember(): Promise<{ ok: boolean; bundle?: MemberProvisionBundle; message?: string }> {
  try {
    const legacyBundle = await wfetch<MemberProvisionBundle & { multica?: unknown }>('/v1/member/provision');
    const { multica: _retiredMultiCa, ...bundle } = legacyBundle;
    // Persist the provisioned config locally (no secrets, just paths)
    if (bundle.paperclipRepoRoot) {
      await setSetting('tf.paperclipRepoRoot', bundle.paperclipRepoRoot);
    }
    return { ok: true, bundle };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

// ── Phase 9: Member Preferences ─────────────────────────────────
export async function getMemberPreferences(): Promise<Record<string, unknown>> {
  try {
    const prefs = await wfetch('/v1/member/preferences');
    await setSetting('tf.memberPreferences', JSON.stringify(prefs ?? {}));
    await setSetting('tf.memberPreferencesPendingSync', 'false');
    return prefs ?? {};
  } catch {
    const cached = await getSetting('tf.memberPreferences');
    if (!cached) return {};
    try {
      return JSON.parse(cached);
    } catch {
      return {};
    }
  }
}

export async function setMemberPreferences(prefs: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  await setSetting('tf.memberPreferences', JSON.stringify(prefs ?? {}));
  await setSetting('tf.memberPreferencesPendingSync', 'true');
  try {
    const headers = await authHeaders();
    if (!headers) return { ok: true, message: 'Preferences saved locally. Workspace sync will retry when online.' };
    headers['Content-Type'] = 'application/json';
    const base = await getBaseUrl();
    const res = await fetch(`${base}/v1/member/preferences`, { method: 'PUT', headers, body: JSON.stringify(prefs) });
    if (!res.ok) throw new Error(`Worker responded ${res.status}`);
    await setSetting('tf.memberPreferencesPendingSync', 'false');

    // Phase 9: best-effort local CONTEXT.md sync (non-blocking)
    syncMemberContext().catch(() => {});

    return { ok: true };
  } catch (err: any) {
    return { ok: true, message: `Preferences saved locally. Workspace sync failed: ${err.message}` };
  }
}

export async function updateOnboarding(
  stepId: string,
  state: OnboardingStateValue,
  metadata: Record<string, unknown> = {},
): Promise<{ ok: boolean; session?: Session; message?: string }> {
  try {
    await wput('/v1/member/onboarding', { stepId, state, metadata });
    return refreshSession();
  } catch (err: any) {
    const session = await persistLocalOnboardingUpdate(stepId, state, metadata, err.message);
    if (session) {
      return {
        ok: true,
        session,
        message: `Saved onboarding step locally. Workspace sync failed: ${err.message}`,
      };
    }
    return { ok: false, message: err.message };
  }
}

export async function getAdminDemoOverview(): Promise<{ ok: boolean; overview?: AdminDemoOverview; message?: string }> {
  try {
    const overview = await wfetch<AdminDemoOverview>('/v1/admin/demo');
    return { ok: true, overview };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function updateAdminDemoOnboarding(
  identityId: string,
  stepId: string,
  state: OnboardingStateValue,
  metadata: Record<string, unknown> = {},
): Promise<{ ok: boolean; overview?: AdminDemoOverview; message?: string }> {
  try {
    await wput('/v1/admin/demo/onboarding', { identityId, stepId, state, metadata });
    return getAdminDemoOverview();
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

/** Phase 9: Trigger member-context-sync.sh to write latest prefs into agents/ceo/CONTEXT.md */
async function syncMemberContext(): Promise<void> {
  try {
    const repoRoot = await getSetting('tf.paperclipRepoRoot');
    if (!repoRoot) return;
    const script = path.join(repoRoot, 'scripts', 'member-context-sync.sh');
    const { existsSync } = await import('node:fs');
    if (!existsSync(script)) return;
    const { spawn } = await import('node:child_process');
    const baseUrl = await getBaseUrl();
    const childEnv = sanitizedChildProcessEnv(process.env, {
      ...(baseUrl ? { TF_API_BASE_URL: baseUrl } : {}),
    });
    const child = spawn('bash', [script], {
      cwd: repoRoot,
      env: childEnv,
      stdio: 'ignore',
    });
    child.on('error', () => {});
  } catch { /* ignore */ }
}

// ── Phase 8: KPI Summary from canonical D1 ──────────────────────
export async function getMemberKpiSummary(): Promise<{ ok: boolean; data?: { todaySeconds: number; weekSeconds: number; projectBreakdown: Record<string, number>; standupCompliant: boolean }; message?: string }> {
  try {
    const data = await wfetch('/v1/member/kpi');
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function emitUsageSignal(signal: UsageSignal): Promise<{ ok: boolean; message?: string }> {
  try {
    await wpost('/v1/member/usage-signal', signal);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

// ── Phase 14: Realtime rooms/calls/meeting records ─────────────────
export async function listRealtimeRooms(): Promise<{ ok: boolean; rooms: RealtimeRoom[]; message?: string }> {
  try {
    const data = await wfetch<{ rooms?: RealtimeRoom[] }>('/v1/realtime/rooms');
    return { ok: true, rooms: data.rooms ?? [] };
  } catch (err: any) {
    return { ok: false, rooms: [], message: err.message };
  }
}

export async function getRealtimeRoomDetail(roomId: string): Promise<{ ok: boolean; detail?: RealtimeRoomDetail; message?: string }> {
  try {
    const detail = await wfetch<RealtimeRoomDetail>(`/v1/realtime/rooms/${encodeURIComponent(roomId)}`);
    return { ok: true, detail: sanitizeRealtimeRoomDetail(detail) };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function joinRealtimeRoom(
  roomId: string,
  input: RealtimeJoinInput & { clientInstanceId: string; presenceSessionId: string },
): Promise<{ ok: boolean; joined?: RealtimeJoinResponse; message?: string }> {
  try {
    const joined = await wpost<RealtimeJoinResponse>(`/v1/realtime/rooms/${encodeURIComponent(roomId)}/join`, input);
    return {
      ok: true,
      joined: {
        ...joined,
        participant: sanitizeRealtimeParticipant(joined.participant),
      },
    };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function publishRealtimeTrack(
  callId: string,
  input: RealtimeTrackInput,
): Promise<{ ok: boolean; track?: RealtimeMediaTrack; cloudflare?: { appId: string | null; stunUrls: string[]; negotiation: string }; message?: string }> {
  try {
    const data = await wpost<{ track?: RealtimeMediaTrack; cloudflare?: { appId: string | null; stunUrls: string[]; negotiation: string } }>(`/v1/realtime/calls/${encodeURIComponent(callId)}/tracks`, input);
    if (!data.track) return { ok: false, message: 'Worker did not return realtime track metadata.' };
    return { ok: true, track: data.track, cloudflare: data.cloudflare };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function closeRealtimeTrack(callId: string, trackId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await wpost(`/v1/realtime/calls/${encodeURIComponent(callId)}/tracks/${encodeURIComponent(trackId)}/close`, {});
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function leaveRealtimeCall(callId: string, participantId: string): Promise<{ ok: boolean; ended?: boolean; message?: string }> {
  try {
    const data = await wpost<{ ended?: boolean }>(`/v1/realtime/calls/${encodeURIComponent(callId)}/leave`, { participantId });
    return { ok: true, ended: Boolean(data.ended) };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function endRealtimeCall(callId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await wpost(`/v1/realtime/calls/${encodeURIComponent(callId)}/end`, {});
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function closeoutRealtimeCall(
  callId: string,
  payload: RealtimeCloseoutPayload,
): Promise<{ ok: boolean; meeting?: RealtimeMeetingRecord; message?: string }> {
  try {
    const data = await wpost<{ meeting?: RealtimeMeetingRecord }>(`/v1/realtime/calls/${encodeURIComponent(callId)}/closeout`, payload);
    return { ok: true, meeting: data.meeting };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

function sanitizeRealtimeParticipant(participant: RealtimeParticipant): RealtimeParticipant {
  const {
    clientInstanceId: _clientInstanceId,
    presenceSessionId: _presenceSessionId,
    ...safeParticipant
  } = participant as RealtimeParticipant & { clientInstanceId?: string; presenceSessionId?: string };
  return safeParticipant;
}

function sanitizeRealtimeRoomDetail(detail: RealtimeRoomDetail): RealtimeRoomDetail {
  return {
    ...detail,
    participants: detail.participants.map(sanitizeRealtimeParticipant),
  };
}

export interface CoworkingPresenceSessionReference {
  clientInstanceId: string;
  presenceSessionId: string;
}

export interface CoworkingPresenceHeartbeatInput extends CoworkingPresenceSessionReference {
  sequence: number;
  activity: CoworkingPresenceActivity;
}

export async function openCoworkingPresenceSession(
  clientInstanceId: string,
): Promise<{ ok: true; presenceSessionId: string } | { ok: false; message: string }> {
  try {
    const data = await wpost<{ presenceSessionId?: string }>('/v1/realtime/presence/session', { clientInstanceId });
    if (!data.presenceSessionId) {
      return { ok: false, message: 'Worker did not return a presence session.' };
    }
    return { ok: true, presenceSessionId: data.presenceSessionId };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function heartbeatCoworkingPresence(
  input: CoworkingPresenceHeartbeatInput,
): Promise<{ ok: true } | { ok: false; sessionInvalid?: boolean; message: string }> {
  try {
    await wpost('/v1/realtime/presence/heartbeat', input);
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      ...(err instanceof WorkerRequestError && err.httpStatus === 409 ? { sessionInvalid: true } : {}),
      message: err.message,
    };
  }
}

export async function disconnectCoworkingPresence(
  session: CoworkingPresenceSessionReference,
): Promise<{ ok: boolean; disconnected?: boolean; message?: string }> {
  try {
    const data = await wdelete<{ disconnected?: boolean }>(
      `/v1/realtime/presence/${encodeURIComponent(session.clientInstanceId)}/${encodeURIComponent(session.presenceSessionId)}`,
    );
    return { ok: true, disconnected: Boolean(data.disconnected) };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function getCoworkingFloor(): Promise<{ ok: boolean; floor: FloorPresence[]; message?: string }> {
  try {
    const data = await wfetch<unknown>('/v1/realtime/presence');
    const floor = normalizeCoworkingPresenceMembers(data).map(floorPresenceFromLease);
    return { ok: true, floor };
  } catch (err: any) {
    return { ok: false, floor: [], message: err.message };
  }
}

export async function getCoworkingLounge(): Promise<{ ok: boolean; room?: RealtimeRoom; message?: string }> {
  try {
    const roomsResult = await listRealtimeRooms();
    if (!roomsResult.ok) return { ok: false, message: roomsResult.message };
    // Lounge = a workspace_lobby room (first visible match). If none exists
    // the UI shows idle state and the Worker side can seed one later.
    const lounge = roomsResult.rooms.find((r) => r.roomType === 'workspace_lobby');
    return { ok: true, room: lounge };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}
