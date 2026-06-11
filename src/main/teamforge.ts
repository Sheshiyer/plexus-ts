import { safeStorage } from 'electron';
import { getSetting, setSetting, listProjects, insertProject, updateProject, updateEntry, listUnsyncedEntries } from '../db/database.js';
import type { Project, Employee, Session, WorkerConfig } from '../shared/types.js';

/**
 * TeamForge control-plane client.
 * Reads the canonical project graph + team snapshot from the Worker.
 * The bearer token is the single interim secret — stored via Electron
 * safeStorage (OS keychain), never in plaintext settings. Replaced by
 * Cloudflare Access in Phase 4.
 */

const DEFAULT_BASE_URL = 'https://teamforge-api.sheshnarayan-iyer.workers.dev';
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
  const token = await getToken();
  if (!token) throw new Error('Not connected — set the TeamForge token in Settings.');
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
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
  const token = await getToken();
  if (!token) throw new Error('Not connected — set the TeamForge token in Settings.');
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
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
  const token = await getToken();
  if (!token) return { connected: false, message: 'No token set' };
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
    if (!(await getToken())) return { ok: false, pushed: 0, message: 'not connected' };
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
