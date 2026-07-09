import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

const retryableRemoveCodes = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM']);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeTempDir(tempDir: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!code || !retryableRemoveCodes.has(code)) throw error;
      lastError = error;
      await wait(100);
    }
  }
  throw lastError;
}

export async function loadIsolatedAssistantDatabase(): Promise<{
  database: typeof import('../../../src/db/database');
  cleanup: () => Promise<void>;
}> {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'plexus-assistant-db-'));
  process.env.PLEXUS_DB_PATH = path.join(tempDir, 'plexus.db');
  vi.resetModules();
  const database = await import('../../../src/db/database');

  return {
    database,
    cleanup: async () => {
      await database.closeDb();
      delete process.env.PLEXUS_DB_PATH;
      await removeTempDir(tempDir);
      vi.resetModules();
    },
  };
}
