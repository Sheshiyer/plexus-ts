import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DB_PATH = path.join(os.homedir(), '.plexus', 'plexus.db');
const BACKUP_DIR = path.join(os.homedir(), '.plexus', 'backups');
const MAX_BACKUPS = 10;

let backupInterval: ReturnType<typeof setInterval> | null = null;

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
  if (!fs.existsSync(DB_PATH)) return;

  ensureDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `plexus-${timestamp}.db`);

  fs.copyFileSync(DB_PATH, backupPath);
  cleanupOldBackups();

  console.log(`[Backup] Database backed up to ${backupPath}`);
}

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function cleanupOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('plexus-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  for (const file of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(file.path);
    console.log(`[Backup] Removed old backup ${file.name}`);
  }
}

export function listBackups(): { name: string; path: string; size: number; date: string }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('plexus-') && f.endsWith('.db'))
    .map(f => {
      const p = path.join(BACKUP_DIR, f);
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

export function restoreBackup(backupPath: string): boolean {
  if (!fs.existsSync(backupPath)) return false;
  fs.copyFileSync(backupPath, DB_PATH);
  return true;
}
