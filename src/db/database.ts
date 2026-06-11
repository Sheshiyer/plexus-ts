import sqlite3 from 'sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { TimeEntry, Project, PlexusSettings } from '../shared/types';

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
      tags TEXT NOT NULL DEFAULT '[]',
      billable INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'timer',
      synced_at TEXT
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_entries_start ON time_entries(start_time)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_entries_project ON time_entries(project_id)`);

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
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
    hourlyRate: r.hourly_rate,
    currency: r.currency,
    archived: !!r.archived,
    createdAt: r.created_at,
  }));
}

export async function insertProject(p: Project) {
  await run(
    `INSERT INTO projects (id, name, client_name, color, hourly_rate, currency, archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.id, p.name, p.clientName ?? null, p.color, p.hourlyRate ?? null, p.currency ?? 'USD', p.archived ? 1 : 0, p.createdAt]
  );
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
  if (patch.clientName !== undefined) { sets.push('client_name = ?'); vals.push(patch.clientName); }
  if (patch.color !== undefined) { sets.push('color = ?'); vals.push(patch.color); }
  if (patch.hourlyRate !== undefined) { sets.push('hourly_rate = ?'); vals.push(patch.hourlyRate); }
  if (patch.currency !== undefined) { sets.push('currency = ?'); vals.push(patch.currency); }
  if (patch.archived !== undefined) { sets.push('archived = ?'); vals.push(patch.archived ? 1 : 0); }
  if (sets.length === 0) return;
  vals.push(id);
  await run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteProject(id: string) {
  await run('DELETE FROM projects WHERE id = ?', [id]);
}

// Entries
export async function listEntries(from: string, to: string): Promise<TimeEntry[]> {
  const rows = await all<any>(
    'SELECT * FROM time_entries WHERE start_time >= ? AND start_time < ? ORDER BY start_time DESC',
    [from, to]
  );
  return rows.map(r => ({
    id: r.id,
    projectId: r.project_id,
    description: r.description,
    startTime: r.start_time,
    endTime: r.end_time ?? undefined,
    durationSeconds: r.duration_seconds,
    tags: JSON.parse(r.tags),
    billable: !!r.billable,
    source: r.source as 'manual' | 'timer',
    syncedAt: r.synced_at ?? undefined,
  }));
}

export async function insertEntry(e: TimeEntry) {
  await run(
    `INSERT INTO time_entries (id, project_id, description, start_time, end_time, duration_seconds, tags, billable, source, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.projectId, e.description, e.startTime, e.endTime ?? null, e.durationSeconds, JSON.stringify(e.tags), e.billable ? 1 : 0, e.source, e.syncedAt ?? null]
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
  if (patch.tags !== undefined) { sets.push('tags = ?'); vals.push(JSON.stringify(patch.tags)); }
  if (patch.billable !== undefined) { sets.push('billable = ?'); vals.push(patch.billable ? 1 : 0); }
  if (patch.source !== undefined) { sets.push('source = ?'); vals.push(patch.source); }
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
  return {
    id: row.id,
    projectId: row.project_id,
    description: row.description,
    startTime: row.start_time,
    durationSeconds: row.duration_seconds,
    tags: JSON.parse(row.tags),
    billable: !!row.billable,
    source: row.source,
    syncedAt: row.synced_at ?? undefined,
  };
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  const row = await get<any>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}
