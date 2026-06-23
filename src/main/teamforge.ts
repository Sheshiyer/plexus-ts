import { safeStorage, BrowserWindow, session as electronSession } from 'electron';
import path from 'node:path';
import { getSetting, setSetting, listProjects, insertProject, updateProject, updateEntry, listUnsyncedEntries } from '../db/database.js';
import type {
  AdminDemoOverview,
  MemberProvisionBundle,
  OnboardingStateValue,
  Project,
  GitHubActivity,
  GitHubRepoOption,
  ProjectRepoVerification,
  RealtimeCloseoutPayload,
  RealtimeJoinInput,
  RealtimeJoinResponse,
  RealtimeMediaTrack,
  RealtimeMeetingRecord,
  CoWorkingRingState,
  FloorPresence,
  RealtimeRoom,
  RealtimeRoomDetail,
  RealtimeTrackInput,
  Session,
  WorkerConfig,
} from '../shared/types.js';

/**
 * Workspace Worker compatibility client.
 * Reads the canonical project graph + team snapshot from the Worker.
 * The bearer token is the single interim secret — stored via Electron
 * safeStorage (OS keychain), never in plaintext settings. Replaced by
 * Cloudflare Access in Phase 4.
 */

const DEFAULT_BASE_URL = 'https://plexus-api.thoughtseed.space';
const PLEXUS_ACCESS_AUD = '5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200';
const PALETTE = ['#E0FF4F', '#D6FFF6', '#6E5BB0', '#56C8B0', '#B8E04F', '#9FE8D8', '#8A7AC0', '#F0A0A0'];

// ── token (safeStorage) ───────────────────────────────────────────
async function setToken(token: string): Promise<void> {
  if (!token) { await setSetting('tf.tokenEnc', ''); return; }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is unavailable; cannot store the token safely.');
  }
  await setSetting('tf.tokenEnc', safeStorage.encryptString(token).toString('base64'));
}
async function getToken(): Promise<string | null> {
  const enc = await getSetting('tf.tokenEnc');
  if (!enc) return null;
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'));
  } catch {
    return null;
  }
}

// ── Cloudflare Access JWT (Phase 4) ───────────────────────────────
// NOTE: Using plain text storage for JWT during testing to avoid safeStorage
// keychain issues on macOS. Will revert to safeStorage once the keychain is fixed.
async function setAccessJwt(jwt: string): Promise<void> {
  if (!jwt) { await setSetting('tf.accessJwt', ''); return; }
  await setSetting('tf.accessJwt', jwt);
}
async function getAccessJwt(): Promise<string | null> {
  const jwt = (await getSetting('tf.accessJwt')) || null;
  if (!jwt) return null;
  if (isUsableAccessJwt(jwt)) return jwt;

  console.log('[getAccessJwt] existing token is not a Plexus app Access JWT; clearing stale tf.accessJwt');
  await setSetting('tf.accessJwt', '');
  return null;
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

async function getBaseUrl(): Promise<string> {
  return (await getSetting('tf.baseUrl')) || DEFAULT_BASE_URL;
}

export async function getWorkerConfig(): Promise<WorkerConfig> {
  return {
    baseUrl: await getBaseUrl(),
    workspaceId: (await getSetting('tf.workspaceId')) || '',
    hasToken: !!(await getToken()),
  };
}

export async function setWorkerConfig(cfg: { baseUrl?: string; workspaceId?: string; token?: string }): Promise<WorkerConfig> {
  if (cfg.baseUrl !== undefined) await setSetting('tf.baseUrl', cfg.baseUrl.trim().replace(/\/+$/, ''));
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
    if (json.ok === false) throw new Error(json.error?.message || 'Worker request failed.');
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
    if (json.ok === false) throw new Error(json.error?.message || 'Worker request failed.');
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
    if (json.ok === false) throw new Error(json.error?.message || 'Worker request failed.');
    return json.data as T;
  }
  return json as T;
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
    const message =
      json?.error?.message ??
      json?.message ??
      JSON.stringify(json).slice(0, 160);
    throw new Error(`Worker responded ${res.status}${message ? `: ${message}` : ''}`);
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

// ── reads ─────────────────────────────────────────────────────────
function asArray(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  for (const k of keys) if (Array.isArray(data?.[k])) return data[k];
  return [];
}

async function fetchProjects(): Promise<any[]> {
  const graphProjects = await fetchProjectMappings().catch((err) => {
    console.warn('[teamforge] project graph sync unavailable; falling back to project summaries', err?.message ?? err);
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
  const repoVerifiedAt = raw.repoVerifiedAt ?? raw.repo_verified_at ?? raw.githubRepoVerifiedAt ?? raw.github_repo_verified_at ?? link?.verifiedAt ?? link?.verified_at ?? link?.updatedAt ?? link?.updated_at ?? link?.createdAt ?? link?.created_at ?? raw.updatedAt ?? raw.updated_at ?? null;
  const status = raw.repoEvidenceStatus ?? raw.repo_evidence_status ?? raw.repoStatus ?? raw.repo_status ?? (link ? 'verified' : repoVerifiedAt ? 'verified' : repoUrl ? 'unverified' : 'missing');
  return {
    githubRepoUrl: repoUrl ?? undefined,
    githubRepoFullName: repoFullName ?? undefined,
    githubRepoId: raw.githubRepoId ?? raw.github_repo_id ?? raw.repoId ?? raw.repo_id ?? link?.id ?? link?.nodeId ?? link?.node_id ?? undefined,
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

function normalizeManualGitHubUrl(repoUrl: string): GitHubRepoOption | null {
  const fullName = parseGitHubFullName(repoUrl);
  if (!fullName) return null;
  return {
    fullName,
    url: `https://github.com/${fullName}`,
    source: 'manual',
  };
}

async function verifyPublicGitHubRepo(
  projectId: string,
  manual: GitHubRepoOption,
  workerMessage: string,
): Promise<ProjectRepoVerification> {
  const [owner, repoName] = manual.fullName.split('/');
  const existing = (await listProjects()).find((project) => project.id === projectId);
  const verifiedAt = new Date().toISOString();

  let repoId: string | undefined;
  let verifiedUrl = manual.url;
  let verifiedFullName = manual.fullName;
  let reachable = false;
  let detail = '';

  try {
    const api = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Plexus-Work-Coordination',
      },
    });
    if (api.ok) {
      const data: any = await api.json();
      reachable = true;
      repoId = data.id ? String(data.id) : undefined;
      verifiedUrl = String(data.html_url ?? manual.url);
      verifiedFullName = String(data.full_name ?? manual.fullName);
    } else {
      detail = `GitHub API returned ${api.status}`;
    }
  } catch (err: any) {
    detail = err?.message ?? 'GitHub API check failed';
  }

  if (!reachable) {
    try {
      const html = await fetch(manual.url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Plexus-Work-Coordination' },
        redirect: 'follow',
      });
      reachable = html.ok;
      if (!reachable && !detail) detail = `GitHub URL returned ${html.status}`;
    } catch (err: any) {
      if (!detail) detail = err?.message ?? 'GitHub URL check failed';
    }
  }

  if (!reachable) {
    return {
      ok: false,
      status: 'inaccessible',
      repo: manual,
      message: `${workerMessage} Local public GitHub check also failed${detail ? `: ${detail}` : ''}. Private repos need the workspace GitHub integration.`,
    };
  }

  const project: Project = {
    id: projectId,
    name: existing?.name ?? `Project ${projectId.slice(0, 8)}`,
    clientName: existing?.clientName,
    color: existing?.color ?? '#56C8B0',
    archived: existing?.archived ?? false,
    createdAt: existing?.createdAt ?? verifiedAt,
    githubRepoUrl: verifiedUrl,
    githubRepoFullName: verifiedFullName,
    githubRepoId: repoId,
    repoVerifiedAt: verifiedAt,
    repoEvidenceStatus: 'verified',
    repoRequired: true,
    evidenceStatus: 'pending',
  };

  return {
    ok: true,
    status: 'verified',
    repo: {
      ...manual,
      id: repoId ?? null,
      fullName: verifiedFullName,
      url: verifiedUrl,
      verifiedAt,
    },
    project,
    remoteVerified: false,
    message: `${workerMessage} Verified public GitHub repo locally and cached the binding.`,
  };
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
  await setSetting('tf.accessJwt', '');
  await clearAccessBrowserSession();
}

async function clearAccessBrowserSession(): Promise<void> {
  // Fully reset the CF Access partition: every cookie, LocalStorage,
  // sessionStorage, IndexedDB, ServiceWorker, and cache. Removing only the
  // CF_Authorization cookie (the previous behavior) left CF Access tracking
  // cookies that paired the next OTP with stale auth state and surfaced as
  // "This One-Time Pin has already been used" on a fresh code.
  const accessSession = electronSession.fromPartition('persist:tfaccess');
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

export async function listGitHubRepoOptions(projectId?: string): Promise<GitHubRepoOption[]> {
  const localProjects = await listProjects();
  const options = new Map<string, GitHubRepoOption>();
  const addOption = (option: GitHubRepoOption) => {
    const key = `${option.fullName}:${option.url}`;
    if (!options.has(key)) options.set(key, option);
  };

  try {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const data = await wfetch<any>(`/v1/github/repos${query}`);
    const repos = asArray(data, 'repos', 'repositories', 'items');
    repos
      .map((repo) => {
        const url = repo.url ?? repo.htmlUrl ?? repo.html_url ?? repo.githubRepoUrl ?? null;
        const fullName = repo.fullName ?? repo.full_name ?? repo.nameWithOwner ?? parseGitHubFullName(url);
        if (!url || !fullName) return null;
        return {
          id: repo.id ? String(repo.id) : null,
          fullName: String(fullName),
          url: String(url),
          source: 'worker' as const,
          verifiedAt: repo.verifiedAt ?? repo.verified_at ?? null,
        };
      })
      .filter(Boolean)
      .forEach((option) => addOption(option as GitHubRepoOption));
  } catch {
    // Worker repo discovery is additive. Keep trying project graph links below.
  }

  try {
    const mappings = (await fetchProjectMappings()).map(normalizeProjectPayload);
    for (const mapping of mappings) {
      if (projectId && String(mapping.id ?? mapping.projectId ?? '') !== projectId) continue;
      const repo = normalizeGitHubRepo(mapping);
      if (!repo.githubRepoUrl || !repo.githubRepoFullName) continue;
      addOption({
        id: repo.githubRepoId ?? null,
        fullName: repo.githubRepoFullName,
        url: repo.githubRepoUrl,
        source: 'worker',
        verifiedAt: repo.repoVerifiedAt ?? null,
      });
    }
  } catch {
    // Project graph links are also additive. Local cache remains the offline fallback.
  }

  localProjects
    .filter((project) => !projectId || project.id === projectId)
    .filter((project) => project.githubRepoUrl && project.githubRepoFullName)
    .forEach((project) => addOption({
      id: project.githubRepoId ?? null,
      fullName: project.githubRepoFullName!,
      url: project.githubRepoUrl!,
      source: 'project_cache',
      verifiedAt: project.repoVerifiedAt ?? null,
    }));

  return Array.from(options.values());
}

export async function verifyProjectRepo(projectId: string, repoUrl: string): Promise<ProjectRepoVerification> {
  const manual = normalizeManualGitHubUrl(repoUrl);
  if (!manual) {
    return { ok: false, status: 'unverified', message: 'Enter a valid GitHub repository URL such as https://github.com/org/repo.' };
  }

  try {
    const data = await wpost<any>(`/v1/projects/${encodeURIComponent(projectId)}/github-repo/verify`, {
      repoUrl: manual.url,
      repoFullName: manual.fullName,
    });
    const projectPayload = data.project ?? data;
    const verifiedAt = projectPayload.repoVerifiedAt ?? projectPayload.repo_verified_at ?? new Date().toISOString();
    const project: Project = {
      id: projectId,
      name: String(projectPayload.name ?? ''),
      clientName: projectPayload.clientName ?? projectPayload.client_name ?? undefined,
      color: projectPayload.color ?? '#3b82f6',
      archived: Boolean(projectPayload.archived ?? false),
      createdAt: projectPayload.createdAt ?? projectPayload.created_at ?? new Date().toISOString(),
      githubRepoUrl: projectPayload.githubRepoUrl ?? projectPayload.github_repo_url ?? manual.url,
      githubRepoFullName: projectPayload.githubRepoFullName ?? projectPayload.github_repo_full_name ?? manual.fullName,
      githubRepoId: projectPayload.githubRepoId ?? projectPayload.github_repo_id ?? undefined,
      repoVerifiedAt: verifiedAt,
      repoEvidenceStatus: 'verified',
      repoRequired: true,
      evidenceStatus: 'pending',
    };
    return { ok: true, status: 'verified', repo: { ...manual, source: 'worker', verifiedAt }, project, remoteVerified: true };
  } catch (err: any) {
    const workerMessage = err?.message ?? 'Could not verify this GitHub repository through the workspace service.';
    return verifyPublicGitHubRepo(projectId, manual, workerMessage);
  }
}

export async function syncGitHubActivity(projectId: string, from: string, to: string): Promise<{ ok: boolean; activity?: GitHubActivity[]; message?: string }> {
  try {
    const data = await wpost<any>(`/v1/projects/${encodeURIComponent(projectId)}/github-activity/sync`, { from, to });
    return { ok: true, activity: asArray(data, 'activity', 'items') as GitHubActivity[] };
  } catch (err: any) {
    return { ok: false, message: err?.message ?? 'GitHub activity sync failed.' };
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
    console.error('[whoami] Error:', err);
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
    console.log('[accessLogin] cookie candidate found but not app token:', nonApp.substring(0, 20));
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
    console.error('[testJwt] Error:', err);
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
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 460, height: 680, title: 'Sign in — Cloudflare Access', autoHideMenuBar: true,
      webPreferences: { partition: 'persist:tfaccess', contextIsolation: true, nodeIntegration: false },
    });
    let settled = false;
    const rejectedTokens = new Set<string>();
    const tryCapture = async () => {
      if (settled) return;
      let jwt: string | null = null;
      try {
        jwt = await findAppAccessTokenFromCookies(win.webContents.session, target, rejectedTokens);
        if (!jwt) return;
        const session = await whoamiWithJwt(jwt);
        settled = true;
        await setAccessJwt(jwt);
        win.removeAllListeners('closed');
        win.close();
        if (session) await persistSession(session);
        resolve({ ok: true, session });
      } catch (err) {
        if (jwt) rejectedTokens.add(jwt);
        console.error('[accessLogin] Error in tryCapture:', err);
        /* keep waiting for the cookie */
      }
    };
    win.webContents.on('did-navigate', tryCapture);
    win.webContents.on('did-redirect-navigation', tryCapture);
    win.webContents.on('did-finish-load', tryCapture);
    win.on('closed', () => { if (!settled) resolve({ ok: false, message: 'Sign-in cancelled.' }); });
    win.loadURL(target).catch((e: any) => { if (!settled) { settled = true; resolve({ ok: false, message: e.message }); } });
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
    const bundle = await wfetch<MemberProvisionBundle>('/v1/member/provision');
    // Persist the provisioned config locally (no secrets, just paths)
    if (bundle.paperclipRepoRoot) {
      await setSetting('tf.paperclipRepoRoot', bundle.paperclipRepoRoot);
    }
    if (bundle.multica?.apiUrl) {
      await setSetting('tf.multicaApiUrl', bundle.multica.apiUrl);
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
    const [accessJwt, baseUrl] = await Promise.all([
      getSetting('tf.accessJwt'),
      getSetting('tf.baseUrl'),
    ]);
    const child = spawn('bash', [script], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...(accessJwt ? { CF_ACCESS_JWT: accessJwt } : {}),
        ...(baseUrl ? { TF_API_BASE_URL: baseUrl } : {}),
      },
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

export async function emitUsageSignal(signal: any): Promise<{ ok: boolean; message?: string }> {
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
    return { ok: true, detail };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function joinRealtimeRoom(
  roomId: string,
  input: RealtimeJoinInput,
): Promise<{ ok: boolean; joined?: RealtimeJoinResponse; message?: string }> {
  try {
    const joined = await wpost<RealtimeJoinResponse>(`/v1/realtime/rooms/${encodeURIComponent(roomId)}/join`, input);
    return { ok: true, joined };
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

// ── 0.4.0: Co-working presence aggregation ────────────────────────
// The Co-working floor is derived from the existing /v1/realtime/* surface
// — no new endpoints. We fan out across every visible room, dedupe
// participants by identity, and rank a per-person ringState so the same
// human shows up once with their most-active room as context.

function makeInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function rankRing(s: CoWorkingRingState): number {
  return s === 'lounge' ? 3 : s === 'timing' ? 2 : s === 'online' ? 1 : 0;
}

export async function getCoworkingFloor(): Promise<{ ok: boolean; floor: FloorPresence[]; message?: string }> {
  try {
    const roomsResult = await listRealtimeRooms();
    if (!roomsResult.ok) return { ok: false, floor: [], message: roomsResult.message };
    const rooms = roomsResult.rooms;
    if (rooms.length === 0) return { ok: true, floor: [] };

    const detailResults = await Promise.all(
      rooms.map(async (room) => {
        try {
          const detail = await wfetch<RealtimeRoomDetail>(`/v1/realtime/rooms/${encodeURIComponent(room.id)}`);
          return { room, detail };
        } catch {
          return { room, detail: null as RealtimeRoomDetail | null };
        }
      }),
    );

    const byIdentity = new Map<string, FloorPresence>();

    for (const { room, detail } of detailResults) {
      if (!detail) continue;
      const isLounge = room.roomType === 'workspace_lobby';
      const hasActiveCall = Boolean(room.activeCallId);

      for (const participant of detail.participants) {
        const speaking = detail.tracks.some(
          (t) => t.participantId === participant.id && t.trackKind === 'audio' && t.state === 'live',
        );

        const ringState: CoWorkingRingState = isLounge
          ? 'lounge'
          : hasActiveCall
            ? 'timing'
            : 'online';

        const projectTag = room.projectName
          ? room.projectName.toUpperCase()
          : room.name
            ? room.name.toUpperCase()
            : null;

        const key = participant.identityId || participant.id;
        const existing = byIdentity.get(key);
        if (!existing || rankRing(ringState) > rankRing(existing.ringState)) {
          byIdentity.set(key, {
            participantId: participant.id,
            displayName: participant.displayName,
            initials: makeInitials(participant.displayName),
            ringState,
            roomId: room.id,
            roomName: room.name,
            projectTag,
            isSpeaking: speaking,
          });
        } else if (speaking && !existing.isSpeaking) {
          // Carry "is speaking" forward even if the better room ranking wins.
          existing.isSpeaking = true;
        }
      }
    }

    return { ok: true, floor: Array.from(byIdentity.values()) };
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
