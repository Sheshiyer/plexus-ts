import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

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
      rmSync(tempDir, { recursive: true, force: true });
      vi.resetModules();
    },
  };
}
