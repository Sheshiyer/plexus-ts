import { safeStorage, BrowserWindow } from 'electron';
import { getSetting, setSetting, listProjects, insertProject, updateProject, updateEntry, listUnsyncedEntries } from '../db/database.js';
import type { Project, Employee, Session, WorkerConfig, MemberProvisionBundle } from '../shared/types.js';

/**
 * TeamForge control-plane client.
 * Reads the canonical project graph + team snapshot from the Worker.
 * The bearer token is the single interim secret — stored via Electron
 * safeStorage (OS keychain), never in plaintext settings. Replaced by
 * Cloudflare Access in Phase 4.
 */

const DEFAULT_BASE_URL = 'https://plexus-api.thoughtseed.space';
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
async function setAccessJwt(jwt: string): Promise<void> {
  if (!jwt || !safeStorage.isEncryptionAvailable()) { await setSetting('tf.accessJwtEnc', ''); return; }
  await setSetting('tf.accessJwtEnc', safeStorage.encryptString(jwt).toString('base64'));
}
async function getAccessJwt(): Promise<string | null> {
  const enc = await getSetting('tf.accessJwtEnc');
  if (!enc) return null;
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'));
  } catch {
    return null;
  }
}

/** Build auth headers from whichever credential is present (Access JWT preferred). */
async function authHeaders(): Promise<Record<string, string> | null> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const accessJwt = await getAccessJwt();
  if (accessJwt) headers['Cf-Access-Jwt-Assertion'] = accessJwt;
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return accessJwt || token ? headers : null;
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
  if (!headers) throw new Error('Not connected — sign in or set the TeamForge token in Settings.');
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Worker responded ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
  }
  const json: any = await res.json();
  if (json && typeof json === 'object' && 'ok' in json) {
    if (json.ok === false) throw new Error(json.error?.message || 'Worker request failed.');
    return json.data as T;
  }
  return json as T;
}

async function wpost<T = any>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  if (!headers) throw new Error('Not connected — sign in or set the TeamForge token in Settings.');
  headers['Content-Type'] = 'application/json';
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Worker responded ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
  }
  const json: any = await res.json();
  if (json && typeof json === 'object' && 'ok' in json) {
    if (json.ok === false) throw new Error(json.error?.message || 'Worker request failed.');
    return json.data as T;
  }
  return json as T;
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

async function fetchEmployees(): Promise<(Employee & { workspaceId: string })[]> {
  const ws = (await getSetting('tf.workspaceId')) || '';
  const data = await wfetch(`/v1/team/snapshot${ws ? `?workspace_id=${encodeURIComponent(ws)}` : ''}`);
  return asArray(data, 'employees').map((e: any) => ({
    id: e.id,
    displayName: e.display_name ?? e.displayName ?? e.email ?? 'Unknown',
    email: (e.email ?? '').toLowerCase(),
    avatarUrl: e.avatar_url ?? e.avatarUrl ?? undefined,
    monthlyQuotaHours: e.monthly_quota_hours ?? e.monthlyQuotaHours ?? 160,
    workspaceId: e.workspace_id ?? e.workspaceId ?? ws,
  }));
}

async function fetchProjects(): Promise<any[]> {
  const data = await wfetch('/v1/projects');
  return asArray(data, 'projects', 'items', 'summaries');
}

// ── auth (email → employee identity) ──────────────────────────────
export async function login(email: string): Promise<{ ok: boolean; session?: Session; message?: string }> {
  const target = email.trim().toLowerCase();
  if (!target) return { ok: false, message: 'Enter your email.' };
  try {
    const employees = await fetchEmployees();
    const match = employees.find(e => e.email === target);
    if (!match) return { ok: false, message: `No active employee with email ${target} in this workspace.` };
    const { workspaceId, ...employee } = match;
    const session: Session = { employee, workspaceId, email: target, signedInAt: new Date().toISOString() };
    await setSetting('tf.session', JSON.stringify(session));
    if (workspaceId) await setSetting('tf.workspaceId', workspaceId);
    return { ok: true, session };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

export async function getSession(): Promise<Session | null> {
  const raw = await getSetting('tf.session');
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

export async function logout(): Promise<void> {
  await setSetting('tf.session', '');
}

// ── project sync (preload into local cache) ───────────────────────
export async function syncProjects(): Promise<{ ok: boolean; count: number; message?: string }> {
  try {
    const remote = await fetchProjects();
    const active = remote.filter(p => (p.status ?? 'active') === 'active');
    const existing = await listProjects();
    const byId = new Map(existing.map(p => [p.id, p]));
    let i = 0;
    for (const r of active) {
      const id = String(r.id ?? r.projectId ?? '');
      if (!id) continue;
      const name = r.name ?? r.displayName ?? 'Untitled';
      const clientName = r.clientName ?? r.client_name ?? undefined;
      const current = byId.get(id);
      if (current) {
        await updateProject(id, { name, clientName });
      } else {
        const project: Project = {
          id, name, clientName,
          color: PALETTE[i % PALETTE.length],
          archived: false,
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
        employeeId: session.employee.id,
        projectId: e.projectId,
        source: e.source,
        description: e.description,
        startTime: e.startTime,
        endTime: e.endTime,
        durationSeconds: e.durationSeconds,
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
export async function whoami(): Promise<{ email: string | null; access: boolean } | null> {
  try { return await wfetch('/v1/whoami'); } catch { return null; }
}

/**
 * Open a BrowserWindow to an Access-protected endpoint. Cloudflare Access
 * intercepts with its OTP/SSO login; on success it sets the CF_Authorization
 * cookie, which we capture as the Access JWT and store via safeStorage.
 */
export async function accessLogin(): Promise<{ ok: boolean; email?: string; message?: string }> {
  const base = await getBaseUrl();
  const target = `${base}/v1/whoami`;
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 460, height: 680, title: 'Sign in — Cloudflare Access', autoHideMenuBar: true,
      webPreferences: { partition: 'persist:tfaccess', contextIsolation: true, nodeIntegration: false },
    });
    let settled = false;
    const tryCapture = async () => {
      if (settled) return;
      try {
        const cookies = await win.webContents.session.cookies.get({ name: 'CF_Authorization' });
        const jwt = cookies.find(c => c.value)?.value;
        if (!jwt) return;
        settled = true;
        await setAccessJwt(jwt);
        win.removeAllListeners('closed');
        win.close();
        const who = await whoami();
        resolve(who?.email
          ? { ok: true, email: who.email }
          : { ok: false, message: 'Signed in, but no identity returned.' });
      } catch { /* keep waiting for the cookie */ }
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
  if (!al.ok || !al.email) return { ok: false, message: al.message ?? 'Access sign-in failed.' };
  return login(al.email);
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
    return await wfetch('/v1/member/preferences');
  } catch {
    return {};
  }
}

export async function setMemberPreferences(prefs: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  try {
    const headers = await authHeaders();
    if (!headers) return { ok: false, message: 'not connected' };
    headers['Content-Type'] = 'application/json';
    const base = await getBaseUrl();
    const res = await fetch(`${base}/v1/member/preferences`, { method: 'PUT', headers, body: JSON.stringify(prefs) });
    if (!res.ok) throw new Error(`Worker responded ${res.status}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
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
