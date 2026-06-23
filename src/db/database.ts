import sqlite3 from 'sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type {
  BreakworkPrompt,
  GitHubActivity,
  HandoffInput,
  HandoffRecord,
  HandoffStatus,
  Project,
  ReviewCycle,
  StandupEvidenceRecord,
  TimeEntry,
} from '../shared/types.js';

const DB_DIR = path.join(os.homedir(), '.plexus');
const DB_PATH = path.join(DB_DIR, 'plexus.db');

let db: sqlite3.Database | null = null;

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

export function getDb(): Promise<sqlite3.Database> {
  if (db) return Promise.resolve(db);
  ensureDir();
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      db = database;
      migrate().then(() => resolve(database)).catch(reject);
    });
  });
}

function run(sql: string, params: any[] = []): Promise<void> {
  return getDb().then(d => new Promise((resolve, reject) => {
    d.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve();
    });
  }));
}

function all<T>(sql: string, params: any[] = []): Promise<T[]> {
  return getDb().then(d => new Promise((resolve, reject) => {
    d.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  }));
}

function get<T>(sql: string, params: any[] = []): Promise<T | null> {
  return getDb().then(d => new Promise((resolve, reject) => {
    d.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  }));
}

async function migrate() {
  await run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_name TEXT,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      hourly_rate REAL,
      currency TEXT DEFAULT 'USD',
      archived INTEGER NOT NULL DEFAULT 0,
      github_repo_url TEXT,
      github_repo_full_name TEXT,
      github_repo_id TEXT,
      repo_verified_at TEXT,
      repo_evidence_status TEXT NOT NULL DEFAULT 'missing',
      repo_required INTEGER NOT NULL DEFAULT 1,
      evidence_status TEXT NOT NULL DEFAULT 'missing',
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      description TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      target_seconds INTEGER,
      paused_at TEXT,
      paused_seconds INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      billable INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'timer',
      github_repo_url TEXT,
      github_repo_full_name TEXT,
      evidence_status TEXT NOT NULL DEFAULT 'legacy_unverified',
      evidence_checked_at TEXT,
      github_activity_ids TEXT NOT NULL DEFAULT '[]',
      synced_at TEXT
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_entries_start ON time_entries(start_time)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_entries_project ON time_entries(project_id)`);
  await ensureColumn('time_entries', 'target_seconds', 'INTEGER');
  await ensureColumn('time_entries', 'paused_at', 'TEXT');
  await ensureColumn('time_entries', 'paused_seconds', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('time_entries', 'github_repo_url', 'TEXT');
  await ensureColumn('time_entries', 'github_repo_full_name', 'TEXT');
  await ensureColumn('time_entries', 'evidence_status', "TEXT NOT NULL DEFAULT 'legacy_unverified'");
  await ensureColumn('time_entries', 'evidence_checked_at', 'TEXT');
  await ensureColumn('time_entries', 'github_activity_ids', "TEXT NOT NULL DEFAULT '[]'");

  await ensureColumn('projects', 'github_repo_url', 'TEXT');
  await ensureColumn('projects', 'github_repo_full_name', 'TEXT');
  await ensureColumn('projects', 'github_repo_id', 'TEXT');
  await ensureColumn('projects', 'repo_verified_at', 'TEXT');
  await ensureColumn('projects', 'repo_evidence_status', "TEXT NOT NULL DEFAULT 'missing'");
  await ensureColumn('projects', 'repo_required', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn('projects', 'evidence_status', "TEXT NOT NULL DEFAULT 'missing'");

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS handoffs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      next_retry_at TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoffs(status, updated_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_handoffs_kind ON handoffs(kind, updated_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS github_activity (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      repo_full_name TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      actor TEXT,
      occurred_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_github_activity_project_time ON github_activity(project_id, occurred_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_github_activity_repo_time ON github_activity(repo_full_name, occurred_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS standup_evidence_records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      evidence_summary TEXT NOT NULL DEFAULT '{}',
      activity TEXT NOT NULL DEFAULT '[]',
      generated_at TEXT NOT NULL
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_standup_evidence_date ON standup_evidence_records(date)`);

  await run(`
    CREATE TABLE IF NOT EXISTS review_cycles (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      evidence_summary TEXT NOT NULL DEFAULT '{}',
      blockers TEXT NOT NULL DEFAULT '[]',
      appraisal_signals TEXT NOT NULL DEFAULT '[]',
      generated_at TEXT NOT NULL
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_review_cycles_kind_period ON review_cycles(kind, period_start)`);

  await run(`
    CREATE TABLE IF NOT EXISTS breakwork_prompts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      audio_file_ref TEXT,
      trigger_reason TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      completed_at TEXT,
      snoozed_until TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_breakwork_prompts_generated ON breakwork_prompts(generated_at)`);
}

async function ensureColumn(table: string, column: string, definition: string) {
  const rows = await all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!rows.some(r => r.name === column)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

// Projects
export async function listProjects(): Promise<Project[]> {
  const rows = await all<any>('SELECT * FROM projects WHERE archived = 0 ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    clientName: r.client_name,
    color: r.color,
    archived: !!r.archived,
    createdAt: r.created_at,
    githubRepoUrl: r.github_repo_url ?? undefined,
    githubRepoFullName: r.github_repo_full_name ?? undefined,
    githubRepoId: r.github_repo_id ?? undefined,
    repoVerifiedAt: r.repo_verified_at ?? undefined,
    repoEvidenceStatus: r.repo_evidence_status ?? (r.github_repo_url ? 'unverified' : 'missing'),
    repoRequired: r.repo_required === undefined ? true : !!r.repo_required,
    evidenceStatus: r.evidence_status ?? (r.github_repo_url ? 'pending' : 'missing'),
  }));
}

export async function getProject(id: string): Promise<Project | null> {
  const row = await get<any>('SELECT * FROM projects WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    color: row.color,
    archived: !!row.archived,
    createdAt: row.created_at,
    githubRepoUrl: row.github_repo_url ?? undefined,
    githubRepoFullName: row.github_repo_full_name ?? undefined,
    githubRepoId: row.github_repo_id ?? undefined,
    repoVerifiedAt: row.repo_verified_at ?? undefined,
    repoEvidenceStatus: row.repo_evidence_status ?? (row.github_repo_url ? 'unverified' : 'missing'),
    repoRequired: row.repo_required === undefined ? true : !!row.repo_required,
    evidenceStatus: row.evidence_status ?? (row.github_repo_url ? 'pending' : 'missing'),
  };
}

export async function insertProject(p: Project) {
  await run(
    `INSERT INTO projects (id, name, client_name, color, archived, github_repo_url, github_repo_full_name, github_repo_id, repo_verified_at, repo_evidence_status, repo_required, evidence_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id,
      p.name,
      p.clientName ?? null,
      p.color,
      p.archived ? 1 : 0,
      p.githubRepoUrl ?? null,
      p.githubRepoFullName ?? null,
      p.githubRepoId ?? null,
      p.repoVerifiedAt ?? null,
      p.repoEvidenceStatus ?? (p.githubRepoUrl ? 'unverified' : 'missing'),
      p.repoRequired === false ? 0 : 1,
      p.evidenceStatus ?? (p.githubRepoUrl ? 'pending' : 'missing'),
      p.createdAt,
    ]
  );
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
  if (patch.clientName !== undefined) { sets.push('client_name = ?'); vals.push(patch.clientName); }
  if (patch.color !== undefined) { sets.push('color = ?'); vals.push(patch.color); }
  if (patch.archived !== undefined) { sets.push('archived = ?'); vals.push(patch.archived ? 1 : 0); }
  if (patch.githubRepoUrl !== undefined) { sets.push('github_repo_url = ?'); vals.push(patch.githubRepoUrl ?? null); }
  if (patch.githubRepoFullName !== undefined) { sets.push('github_repo_full_name = ?'); vals.push(patch.githubRepoFullName ?? null); }
  if (patch.githubRepoId !== undefined) { sets.push('github_repo_id = ?'); vals.push(patch.githubRepoId ?? null); }
  if (patch.repoVerifiedAt !== undefined) { sets.push('repo_verified_at = ?'); vals.push(patch.repoVerifiedAt ?? null); }
  if (patch.repoEvidenceStatus !== undefined) { sets.push('repo_evidence_status = ?'); vals.push(patch.repoEvidenceStatus); }
  if (patch.repoRequired !== undefined) { sets.push('repo_required = ?'); vals.push(patch.repoRequired ? 1 : 0); }
  if (patch.evidenceStatus !== undefined) { sets.push('evidence_status = ?'); vals.push(patch.evidenceStatus); }
  if (sets.length === 0) return;
  vals.push(id);
  await run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteProject(id: string) {
  await run('DELETE FROM projects WHERE id = ?', [id]);
}

// Entries
function rowToEntry(r: any): TimeEntry {
  let activityIds: string[] = [];
  try {
    activityIds = JSON.parse(r.github_activity_ids || '[]');
  } catch {
    activityIds = [];
  }
  return {
    id: r.id,
    projectId: r.project_id,
    description: r.description,
    startTime: r.start_time,
    endTime: r.end_time ?? undefined,
    durationSeconds: r.duration_seconds,
    targetSeconds: r.target_seconds ?? undefined,
    pausedAt: r.paused_at ?? undefined,
    pausedSeconds: r.paused_seconds ?? 0,
    tags: JSON.parse(r.tags),
    source: r.source as 'manual' | 'timer',
    githubRepoUrl: r.github_repo_url ?? undefined,
    githubRepoFullName: r.github_repo_full_name ?? undefined,
    evidenceStatus: r.evidence_status ?? 'legacy_unverified',
    evidenceCheckedAt: r.evidence_checked_at ?? undefined,
    githubActivityIds: activityIds,
    syncedAt: r.synced_at ?? undefined,
  };
}

export async function listEntries(from: string, to: string): Promise<TimeEntry[]> {
  const rows = await all<any>(
    'SELECT * FROM time_entries WHERE start_time >= ? AND start_time < ? ORDER BY start_time DESC',
    [from, to]
  );
  return rows.map(rowToEntry);
}

export async function listUnsyncedEntries(): Promise<TimeEntry[]> {
  const rows = await all<any>(
    'SELECT * FROM time_entries WHERE synced_at IS NULL AND end_time IS NOT NULL ORDER BY start_time ASC LIMIT 200'
  );
  return rows.map(rowToEntry);
}

export async function insertEntry(e: TimeEntry) {
  await run(
    `INSERT INTO time_entries (id, project_id, description, start_time, end_time, duration_seconds, target_seconds, paused_at, paused_seconds, tags, source, github_repo_url, github_repo_full_name, evidence_status, evidence_checked_at, github_activity_ids, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.id,
      e.projectId,
      e.description,
      e.startTime,
      e.endTime ?? null,
      e.durationSeconds,
      e.targetSeconds ?? null,
      e.pausedAt ?? null,
      e.pausedSeconds ?? 0,
      JSON.stringify(e.tags),
      e.source,
      e.githubRepoUrl ?? null,
      e.githubRepoFullName ?? null,
      e.evidenceStatus ?? 'pending',
      e.evidenceCheckedAt ?? null,
      JSON.stringify(e.githubActivityIds ?? []),
      e.syncedAt ?? null,
    ]
  );
}

export async function updateEntry(id: string, patch: Partial<TimeEntry>) {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.projectId !== undefined) { sets.push('project_id = ?'); vals.push(patch.projectId); }
  if (patch.description !== undefined) { sets.push('description = ?'); vals.push(patch.description); }
  if (patch.startTime !== undefined) { sets.push('start_time = ?'); vals.push(patch.startTime); }
  if (patch.endTime !== undefined) { sets.push('end_time = ?'); vals.push(patch.endTime ?? null); }
  if (patch.durationSeconds !== undefined) { sets.push('duration_seconds = ?'); vals.push(patch.durationSeconds); }
  if (patch.targetSeconds !== undefined) { sets.push('target_seconds = ?'); vals.push(patch.targetSeconds ?? null); }
  if (patch.pausedAt !== undefined) { sets.push('paused_at = ?'); vals.push(patch.pausedAt ?? null); }
  if (patch.pausedSeconds !== undefined) { sets.push('paused_seconds = ?'); vals.push(patch.pausedSeconds ?? 0); }
  if (patch.tags !== undefined) { sets.push('tags = ?'); vals.push(JSON.stringify(patch.tags)); }
  if (patch.source !== undefined) { sets.push('source = ?'); vals.push(patch.source); }
  if (patch.githubRepoUrl !== undefined) { sets.push('github_repo_url = ?'); vals.push(patch.githubRepoUrl ?? null); }
  if (patch.githubRepoFullName !== undefined) { sets.push('github_repo_full_name = ?'); vals.push(patch.githubRepoFullName ?? null); }
  if (patch.evidenceStatus !== undefined) { sets.push('evidence_status = ?'); vals.push(patch.evidenceStatus); }
  if (patch.evidenceCheckedAt !== undefined) { sets.push('evidence_checked_at = ?'); vals.push(patch.evidenceCheckedAt ?? null); }
  if (patch.githubActivityIds !== undefined) { sets.push('github_activity_ids = ?'); vals.push(JSON.stringify(patch.githubActivityIds)); }
  if (patch.syncedAt !== undefined) { sets.push('synced_at = ?'); vals.push(patch.syncedAt ?? null); }
  if (sets.length === 0) return;
  vals.push(id);
  await run(`UPDATE time_entries SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteEntry(id: string) {
  await run('DELETE FROM time_entries WHERE id = ?', [id]);
}

export async function getRunningEntry(): Promise<TimeEntry | null> {
  const row = await get<any>('SELECT * FROM time_entries WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1');
  if (!row) return null;
  return rowToEntry(row);
}

// Evidence records
export async function upsertGitHubActivity(records: GitHubActivity[]): Promise<void> {
  for (const record of records) {
    await run(
      `INSERT OR REPLACE INTO github_activity (id, project_id, repo_full_name, repo_url, kind, title, url, actor, occurred_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.projectId,
        record.repoFullName,
        record.repoUrl,
        record.kind,
        record.title,
        record.url,
        record.actor ?? null,
        record.occurredAt,
        JSON.stringify(record.metadata ?? {}),
      ],
    );
  }
}

export async function listGitHubActivity(projectId: string, from: string, to: string): Promise<GitHubActivity[]> {
  const rows = await all<any>(
    'SELECT * FROM github_activity WHERE project_id = ? AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at DESC',
    [projectId, from, to],
  );
  return rows.map((r) => {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(r.metadata || '{}');
    } catch {
      metadata = {};
    }
    return {
      id: r.id,
      projectId: r.project_id,
      repoFullName: r.repo_full_name,
      repoUrl: r.repo_url,
      kind: r.kind,
      title: r.title,
      url: r.url,
      actor: r.actor ?? null,
      occurredAt: r.occurred_at,
      metadata,
    };
  });
}

export async function upsertStandupEvidenceRecord(record: StandupEvidenceRecord): Promise<void> {
  await run(
    `INSERT OR REPLACE INTO standup_evidence_records (id, date, total_seconds, evidence_summary, activity, generated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.date,
      record.totalSeconds,
      JSON.stringify(record.evidenceSummary),
      JSON.stringify(record.activity ?? []),
      record.generatedAt,
    ],
  );
}

export async function upsertReviewCycle(record: ReviewCycle): Promise<void> {
  await run(
    `INSERT OR REPLACE INTO review_cycles (id, kind, period_start, period_end, evidence_summary, blockers, appraisal_signals, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.kind,
      record.periodStart,
      record.periodEnd,
      JSON.stringify(record.evidenceSummary),
      JSON.stringify(record.blockers ?? []),
      JSON.stringify(record.appraisalSignals ?? []),
      record.generatedAt,
    ],
  );
}

export async function insertBreakworkPrompt(record: BreakworkPrompt): Promise<void> {
  await run(
    `INSERT OR REPLACE INTO breakwork_prompts (id, category, title, prompt_text, audio_file_ref, trigger_reason, generated_at, completed_at, snoozed_until)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.category,
      record.title,
      record.promptText,
      record.audioFileRef ?? null,
      record.triggerReason,
      record.generatedAt,
      record.completedAt ?? null,
      record.snoozedUntil ?? null,
    ],
  );
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  const row = await get<any>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

// Resilience handoffs
function rowToHandoff(r: any): HandoffRecord {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(r.payload || '{}');
  } catch {
    payload = {};
  }
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    title: r.title,
    payload,
    error: r.error ?? null,
    attempts: r.attempts ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    nextRetryAt: r.next_retry_at ?? null,
  };
}

export async function listHandoffs(status?: HandoffStatus): Promise<HandoffRecord[]> {
  const rows = status
    ? await all<any>('SELECT * FROM handoffs WHERE status = ? ORDER BY updated_at DESC LIMIT 100', [status])
    : await all<any>('SELECT * FROM handoffs ORDER BY updated_at DESC LIMIT 100');
  return rows.map(rowToHandoff);
}

export async function getHandoff(id: string): Promise<HandoffRecord | null> {
  const row = await get<any>('SELECT * FROM handoffs WHERE id = ?', [id]);
  return row ? rowToHandoff(row) : null;
}

export async function recordHandoff(input: HandoffInput): Promise<HandoffRecord> {
  const now = new Date().toISOString();
  const id = `handoff_${now.replace(/[-:.TZ]/g, '')}_${Math.random().toString(16).slice(2, 10)}`;
  await run(
    `INSERT INTO handoffs (id, kind, status, title, payload, error, attempts, created_at, updated_at, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.kind,
      input.status,
      input.title,
      JSON.stringify(input.payload ?? {}),
      input.error ?? null,
      0,
      now,
      now,
      input.nextRetryAt ?? null,
    ],
  );
  const created = await getHandoff(id);
  if (!created) throw new Error('Could not create handoff record.');
  return created;
}

export async function updateHandoff(
  id: string,
  patch: Partial<Pick<HandoffRecord, 'status' | 'title' | 'payload' | 'error' | 'attempts' | 'nextRetryAt'>>,
): Promise<HandoffRecord> {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.status !== undefined) { sets.push('status = ?'); vals.push(patch.status); }
  if (patch.title !== undefined) { sets.push('title = ?'); vals.push(patch.title); }
  if (patch.payload !== undefined) { sets.push('payload = ?'); vals.push(JSON.stringify(patch.payload)); }
  if (patch.error !== undefined) { sets.push('error = ?'); vals.push(patch.error); }
  if (patch.attempts !== undefined) { sets.push('attempts = ?'); vals.push(patch.attempts); }
  if (patch.nextRetryAt !== undefined) { sets.push('next_retry_at = ?'); vals.push(patch.nextRetryAt); }
  sets.push('updated_at = ?');
  vals.push(new Date().toISOString());
  vals.push(id);
  await run(`UPDATE handoffs SET ${sets.join(', ')} WHERE id = ?`, vals);
  const updated = await getHandoff(id);
  if (!updated) throw new Error('Handoff record no longer exists.');
  return updated;
}
