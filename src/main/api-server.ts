import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { safeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import {
  listProjects,
  listEntries,
  getRunningEntry,
  getSetting,
  listGitHubActivity,
  setSetting,
  upsertReviewCycle,
  upsertStandupEvidenceRecord,
} from '../db/database.js';
import { computeEvidenceSummary } from './evidence.js';
import { calculateActiveSeconds } from './timer-session.js';
import type { ReviewCycle } from '../shared/types.js';
import { redactForLog } from './redaction.js';

const app = express();
const PORT = 31339;
const ISO_UTC_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
export const LOCAL_API_TOKEN_SETTING_KEYS = {
  tokenEnc: 'apiTokenEnc',
  legacyToken: 'apiToken',
} as const;

let server: ReturnType<typeof app.listen> | null = null;

class LocalApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalApiValidationError';
  }
}

function badRequest(message: string): never {
  throw new LocalApiValidationError(message);
}

function singleQueryString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') return value[0];
  badRequest(`${label} must be a single string.`);
}

function isoDay(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    badRequest(`${label} must be YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    badRequest(`${label} must be a valid calendar date.`);
  }
  return value;
}

function isoMonth(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    badRequest(`${label} must be YYYY-MM.`);
  }
  const [year, month] = value.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    badRequest(`${label} must be a valid calendar month.`);
  }
  return value;
}

function parseDateBound(value: unknown, label: string): string {
  const text = singleQueryString(value, label);
  if (!text) badRequest(`${label} is required when a date range is provided.`);
  const match = text.match(ISO_UTC_DATETIME_RE);
  if (!match) badRequest(`${label} must be an ISO UTC datetime.`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, msText = '0'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const ms = Number(msText.padEnd(3, '0'));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    badRequest(`${label} must be a valid ISO UTC datetime.`);
  }
  return date.toISOString();
}

function dayRange(day: string): { from: string; to: string } {
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  return { from: start.toISOString(), to: end.toISOString() };
}

function queryDateRange(req: Request): { from: string; to: string } {
  const fromInput = singleQueryString(req.query.from, 'from');
  const toInput = singleQueryString(req.query.to, 'to');
  if (!fromInput && !toInput) badRequest('from and to are required.');
  if (!fromInput || !toInput) badRequest('from and to must be provided together.');
  const from = parseDateBound(fromInput, 'from');
  const to = parseDateBound(toInput, 'to');
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (toMs <= fromMs) badRequest('to must be after from.');
  if (toMs - fromMs > 31 * 24 * 60 * 60 * 1000) badRequest('date range cannot exceed 31 days.');
  return { from, to };
}

function projectIdParam(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(value)) {
    badRequest('projectId must be a safe project identifier.');
  }
  return value;
}

function localApiErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof LocalApiValidationError) {
    res.status(400).json({ error: 'bad_request', message: error.message });
    return;
  }
  console.error('[local-api] request failed', redactForLog(error));
  res.status(500).json({ error: 'internal_error' });
}

function encryptedToBase64(value: Buffer | Uint8Array | string): string {
  return typeof value === 'string'
    ? Buffer.from(value, 'utf-8').toString('base64')
    : Buffer.from(value).toString('base64');
}

async function clearStoredApiTokens(): Promise<void> {
  await Promise.all([
    setSetting(LOCAL_API_TOKEN_SETTING_KEYS.tokenEnc, ''),
    setSetting(LOCAL_API_TOKEN_SETTING_KEYS.legacyToken, ''),
  ]);
}

async function setEncryptedApiToken(token: string): Promise<boolean> {
  if (!safeStorage.isEncryptionAvailable()) return false;
  await setSetting(LOCAL_API_TOKEN_SETTING_KEYS.tokenEnc, encryptedToBase64(safeStorage.encryptString(token)));
  await setSetting(LOCAL_API_TOKEN_SETTING_KEYS.legacyToken, '');
  return true;
}

export async function loadOrCreateLocalApiToken(): Promise<string> {
  const encrypted = await getSetting(LOCAL_API_TOKEN_SETTING_KEYS.tokenEnc);
  if (encrypted) {
    try {
      const token = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      if (token) return token;
    } catch {
      await clearStoredApiTokens();
    }
  }

  const legacy = ((await getSetting(LOCAL_API_TOKEN_SETTING_KEYS.legacyToken)) || '').trim();
  if (legacy) {
    if (await setEncryptedApiToken(legacy)) return legacy;
    await setSetting(LOCAL_API_TOKEN_SETTING_KEYS.legacyToken, '');
  }

  const token = randomBytes(24).toString('hex');
  await setEncryptedApiToken(token);
  await setSetting(LOCAL_API_TOKEN_SETTING_KEYS.legacyToken, '');
  return token;
}

export async function startApiServer() {
  const token = await loadOrCreateLocalApiToken();

  app.use(cors({ origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
  app.use(express.json());

  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    if (req.headers.authorization === `Bearer ${token}`) return next();
    res.status(401).json({ error: 'unauthorized' });
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'plexus-api', version: '0.1.0' });
  });

  // Current timer state
  app.get('/api/timer', async (_req, res) => {
    const running = await getRunningEntry();
    if (!running) {
      res.json({ running: false });
      return;
    }
    const elapsed = calculateActiveSeconds(running);
    res.json({
      running: true,
      paused: Boolean(running.pausedAt),
      entryId: running.id,
      projectId: running.projectId,
      description: running.description,
      startTime: running.startTime,
      elapsedSeconds: elapsed,
      activeSeconds: elapsed,
      targetSeconds: running.targetSeconds,
      pausedAt: running.pausedAt,
      pausedSeconds: running.pausedSeconds ?? 0,
    });
  });

  // List projects
  app.get('/api/projects', async (_req, res) => {
    const projects = await listProjects();
    res.json(projects);
  });

  // List entries
  app.get('/api/entries', async (req, res) => {
    const { from, to } = queryDateRange(req);
    const entries = await listEntries(from, to);
    res.json(entries);
  });

  app.get('/api/evidence/status', async (req, res) => {
    const { from, to } = queryDateRange(req);
    const [entries, projects] = await Promise.all([listEntries(from, to), listProjects()]);
    res.json(computeEvidenceSummary(entries, projects));
  });

  app.get('/api/evidence/activity/:projectId', async (req, res) => {
    const projectId = projectIdParam(req.params.projectId);
    const { from, to } = queryDateRange(req);
    res.json(await listGitHubActivity(projectId, from, to));
  });

  app.get('/api/standups/:date', async (req, res) => {
    const date = isoDay(req.params.date, 'date');
    const { from, to } = dayRange(date);
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
    res.json(record);
  });

  app.get('/api/reviews/:kind/:periodStart', async (req, res) => {
    if (req.params.kind !== 'weekly' && req.params.kind !== 'monthly') badRequest('review kind must be weekly or monthly.');
    const kind: ReviewCycle['kind'] = req.params.kind;
    const periodStart = isoDay(req.params.periodStart, 'periodStart');
    const start = new Date(`${periodStart}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + (kind === 'weekly' ? 7 : 31));
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
        `${evidenceSummary.evidencedEntries}/${evidenceSummary.totalEntries} work records have matched GitHub activity.`,
        `${evidenceSummary.legacyUnverifiedEntries} legacy work records remain unverified.`,
      ],
      generatedAt: new Date().toISOString(),
    };
    await upsertReviewCycle(record);
    res.json(record);
  });

  // Daily report
  app.get('/api/reports/daily/:date', async (req, res) => {
    const date = isoDay(req.params.date, 'date');
    const { from, to } = dayRange(date);
    const entries = await listEntries(from, to);
    const total = entries.reduce((s, e) => s + e.durationSeconds, 0);
    res.json({ date, entries, totalSeconds: total });
  });

  // Weekly report
  app.get('/api/reports/weekly/:weekStart', async (req, res) => {
    const weekStart = isoDay(req.params.weekStart, 'weekStart');
    const start = new Date(`${weekStart}T00:00:00.000Z`);
    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const { from, to } = dayRange(ds);
      const entries = await listEntries(from, to);
      days.push({
        date: ds,
        entries,
        totalSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
      });
    }
    const total = days.reduce((s, d) => s + d.totalSeconds, 0);
    res.json({ weekStart, days, totalSeconds: total });
  });

  // Monthly report
  app.get('/api/reports/monthly/:month', async (req, res) => {
    const month = isoMonth(req.params.month, 'month');
    const { from, to } = monthRange(month);
    const allEntries = await listEntries(from, to);
    const projBreakdown: Record<string, number> = {};
    for (const e of allEntries) {
      projBreakdown[e.projectId] = (projBreakdown[e.projectId] || 0) + e.durationSeconds;
    }
    const total = allEntries.reduce((s, e) => s + e.durationSeconds, 0);
    res.json({ month, totalSeconds: total, projectBreakdown: projBreakdown, entryCount: allEntries.length });
  });

  app.use(localApiErrorHandler);

  server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const next = app.listen(PORT, '127.0.0.1');
    next.once('error', reject);
    next.once('listening', () => {
      console.log(`Plexus API listening on http://127.0.0.1:${PORT}`);
      console.log('Plexus API bearer token is configured in secure storage.');
      resolve(next);
    });
  });
}

export function stopApiServer(): Promise<void> {
  if (!server) return Promise.resolve();
  const closing = server;
  server = null;
  return new Promise((resolve) => {
    closing.close(() => resolve());
  });
}
