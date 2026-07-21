import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const originalDbPath = process.env.PLEXUS_DB_PATH;

afterEach(() => {
  vi.resetModules();
  if (originalDbPath === undefined) delete process.env.PLEXUS_DB_PATH;
  else process.env.PLEXUS_DB_PATH = originalDbPath;
});

describe('database shutdown admission', () => {
  it('rejects new database work after shutdown begins and closes the existing connection', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'plexus-db-shutdown-'));
    process.env.PLEXUS_DB_PATH = path.join(directory, 'plexus.db');
    const database = await import('../../src/db/database');

    const [firstHandle, secondHandle] = await Promise.all([database.getDb(), database.getDb()]);
    expect(firstHandle).toBe(secondHandle);
    database.beginDbShutdown();
    await expect(database.getDb()).rejects.toThrow('Database is shutting down');
    await expect(database.closeDb()).resolves.toBeUndefined();
    await expect(new Promise<void>((resolve, reject) => {
      firstHandle.get('SELECT 1', (error) => {
        if (error) reject(error);
        else resolve();
      });
    })).rejects.toThrow('Database is closed');

    rmSync(directory, { recursive: true, force: true });
  });

  it('waits for and closes a connection that is still opening when shutdown is sealed', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'plexus-db-pending-shutdown-'));
    process.env.PLEXUS_DB_PATH = path.join(directory, 'plexus.db');
    const database = await import('../../src/db/database');

    const opening = database.getDb();
    database.beginDbShutdown();
    const closing = database.closeDb();

    await expect(opening).rejects.toThrow('Database is shutting down');
    await expect(closing).resolves.toBeUndefined();
    await expect(database.getDb()).rejects.toThrow('Database is shutting down');

    rmSync(directory, { recursive: true, force: true });
  });
});
