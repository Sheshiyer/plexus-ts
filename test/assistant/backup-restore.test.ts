import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

async function withTempDatabase<T>(fn: (context: {
  dir: string;
  databasePath: string;
  database: typeof import('../../src/db/database');
  backup: typeof import('../../src/main/backup');
}) => Promise<T>): Promise<T> {
  const previousDbPath = process.env.PLEXUS_DB_PATH;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plexus-backup-'));
  process.env.PLEXUS_DB_PATH = path.join(dir, 'plexus.db');
  vi.resetModules();
  const database = await import('../../src/db/database');
  const backup = await import('../../src/main/backup');
  try {
    return await fn({ dir, databasePath: process.env.PLEXUS_DB_PATH, database, backup });
  } finally {
    await database.closeDb();
    if (previousDbPath === undefined) delete process.env.PLEXUS_DB_PATH;
    else process.env.PLEXUS_DB_PATH = previousDbPath;
    vi.resetModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('backup restore safety', () => {
  it('closes the active database, restores a bounded backup, and reopens the DB', async () => {
    await withTempDatabase(async ({ backup, database }) => {
      await database.setSetting('restore-marker', 'before');
      backup.runBackup();
      const backups = backup.listBackups();
      expect(backups).toHaveLength(1);

      await database.setSetting('restore-marker', 'after');

      await expect(backup.restoreBackup(backups[0].path)).resolves.toBe(true);
      await expect(database.getSetting('restore-marker')).resolves.toBe('before');
    });
  });

  it('rejects backup paths outside the backup directory without disturbing the DB', async () => {
    await withTempDatabase(async ({ dir, databasePath, backup, database }) => {
      await database.setSetting('restore-marker', 'inside');
      await database.closeDb();
      const outsidePath = path.join(dir, 'plexus-outside.db');
      fs.copyFileSync(databasePath, outsidePath);
      await database.getDb();
      await database.setSetting('restore-marker', 'current');

      await expect(backup.restoreBackup(outsidePath)).resolves.toBe(false);
      await expect(database.getSetting('restore-marker')).resolves.toBe('current');
    });
  });

  it('rejects files inside the backup directory when the filename is not a Plexus backup', async () => {
    await withTempDatabase(async ({ dir, databasePath, backup, database }) => {
      await database.setSetting('restore-marker', 'inside');
      const backupDir = path.join(dir, 'backups');
      fs.mkdirSync(backupDir, { recursive: true });
      const wrongName = path.join(backupDir, 'manual-copy.db');
      fs.copyFileSync(databasePath, wrongName);
      await database.setSetting('restore-marker', 'current');

      await expect(backup.restoreBackup(wrongName)).resolves.toBe(false);
      await expect(database.getSetting('restore-marker')).resolves.toBe('current');
    });
  });

  it('rejects symlinked backups and invalid sqlite files before replacing the DB', async () => {
    await withTempDatabase(async ({ dir, databasePath, backup, database }) => {
      await database.setSetting('restore-marker', 'current');
      const backupDir = path.join(dir, 'backups');
      fs.mkdirSync(backupDir, { recursive: true });
      const outsidePath = path.join(dir, 'outside.db');
      fs.copyFileSync(databasePath, outsidePath);
      const symlinkPath = path.join(backupDir, 'plexus-2026-07-09T00-00-00-000Z.db');

      try {
        fs.symlinkSync(outsidePath, symlinkPath);
        await expect(backup.restoreBackup(symlinkPath)).resolves.toBe(false);
        await expect(database.getSetting('restore-marker')).resolves.toBe('current');
      } catch (error) {
        if (process.platform !== 'win32') throw error;
      }

      const invalidPath = path.join(backupDir, 'plexus-2026-07-09T00-00-01-000Z.db');
      fs.writeFileSync(invalidPath, 'not sqlite');
      await expect(backup.restoreBackup(invalidPath)).resolves.toBe(false);
      await expect(database.getSetting('restore-marker')).resolves.toBe('current');
    });
  });
});
