import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { closeDb, getDatabasePath, getDb } from '../db/database.js';

const MAX_BACKUPS = 10;
const BACKUP_FILE_RE = /^plexus-[\w-]+\.db$/;

let backupInterval: ReturnType<typeof setInterval> | null = null;

function dbPath(): string {
  return getDatabasePath();
}

function backupDir(): string {
  return path.join(path.dirname(dbPath()), 'backups');
}

function isFileDatabasePath(value: string): boolean {
  return Boolean(value) && value !== ':memory:';
}

export function startAutoBackup() {
  ensureDir();
  // Run immediately
  runBackup();
  // Then every 6 hours
  backupInterval = setInterval(runBackup, 6 * 60 * 60 * 1000);
}

export function stopAutoBackup() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}

export function runBackup() {
  const databasePath = dbPath();
  if (!isFileDatabasePath(databasePath) || !fs.existsSync(databasePath)) return;

  ensureDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir(), `plexus-${timestamp}.db`);

  fs.copyFileSync(databasePath, backupPath);
  cleanupOldBackups();

  console.log(`[Backup] Database backed up to ${backupPath}`);
}

function ensureDir() {
  if (!isFileDatabasePath(dbPath())) return;
  const dir = backupDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanupOldBackups() {
  const dir = backupDir();
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('plexus-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(dir, f),
      time: fs.statSync(path.join(dir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  for (const file of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(file.path);
    console.log(`[Backup] Removed old backup ${file.name}`);
  }
}

export function listBackups(): { name: string; path: string; size: number; date: string }[] {
  const dir = backupDir();
  if (!isFileDatabasePath(dbPath()) || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.startsWith('plexus-') && f.endsWith('.db'))
    .map(f => {
      const p = path.join(dir, f);
      const stat = fs.statSync(p);
      return {
        name: f,
        path: p,
        size: stat.size,
        date: new Date(stat.mtime).toISOString(),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function resolveBackupPath(backupPath: string): string | null {
  const resolved = path.resolve(backupPath);
  if (!BACKUP_FILE_RE.test(path.basename(resolved))) return null;
  if (!fs.existsSync(resolved)) return null;
  const candidateStat = fs.lstatSync(resolved);
  if (!candidateStat.isFile()) return null;

  const dir = backupDir();
  if (!fs.existsSync(dir)) return null;
  const backupDirReal = fs.realpathSync(dir);
  const backupReal = fs.realpathSync(resolved);
  const relative = path.relative(backupDirReal, backupReal);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return backupReal;
}

function verifySqliteBackup(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (openError) => {
      if (openError) {
        resolve(false);
        return;
      }
      db.get('PRAGMA integrity_check', (checkError, row: { integrity_check?: string } | undefined) => {
        db.close(() => {
          resolve(!checkError && row?.integrity_check === 'ok');
        });
      });
    });
  });
}

export async function restoreBackup(backupPath: string): Promise<boolean> {
  const databasePath = dbPath();
  if (!isFileDatabasePath(databasePath)) return false;

  const resolvedBackup = resolveBackupPath(backupPath);
  if (!resolvedBackup) return false;
  if (!(await verifySqliteBackup(resolvedBackup))) return false;

  const tempPath = `${databasePath}.restore-${process.pid}-${Date.now()}.tmp`;
  try {
    await closeDb();
    fs.copyFileSync(resolvedBackup, tempPath);
    fs.renameSync(tempPath, databasePath);
    await getDb();
    return true;
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    try {
      await getDb();
    } catch {
      // Leave the caller with a false restore result; startup recovery handles
      // unrecoverable DB files on the next app launch.
    }
    console.warn('[Backup] Restore failed', error);
    return false;
  }
}
