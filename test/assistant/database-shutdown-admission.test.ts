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

describe('growth authority transition persistence', () => {
  it('cancels only unexecuted growth confirmations and preserves other evidence after reopen', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'plexus-authority-transition-')); process.env.PLEXUS_DB_PATH = path.join(directory, 'plexus.db');
    let database = await import('../../src/db/database');
    try {
      const conversation = await database.createAssistantConversation('Authority transition');
      for (const [id, toolId, status] of [['growth-draft','org.handoff','draft'],['growth-confirmed','org.handoff','confirmed'],['growth-running','org.handoff','running'],['growth-done','org.handoff','succeeded'],['timer','app.startTimer','confirmed']] as const) await database.insertAssistantIntent({ id, conversationId: conversation.id, toolId, status, payload: { requestId: id } });
      await database.cancelPendingGrowthIntentsForAuthorityChange(); await database.closeDb(); vi.resetModules(); database = await import('../../src/db/database');
      expect((await database.getAssistantIntent('growth-draft'))?.status).toBe('cancelled'); expect((await database.getAssistantIntent('growth-confirmed'))?.status).toBe('cancelled');
      expect((await database.getAssistantIntent('growth-running'))?.status).toBe('running'); expect((await database.getAssistantIntent('growth-done'))?.status).toBe('succeeded'); expect((await database.getAssistantIntent('timer'))?.status).toBe('confirmed');
    } finally { await database.closeDb(); rmSync(directory, { recursive: true, force: true }); }
  });
});

it('credential rollback restores only its own still-current value', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'plexus-auth-cas-')); process.env.PLEXUS_DB_PATH = path.join(directory, 'plexus.db'); const database = await import('../../src/db/database');
  try {
    await database.setSetting('credential', 'attempt'); await database.restoreSettingIfCurrent('credential','attempt','previous'); expect(await database.getSetting('credential')).toBe('previous');
    await database.setSetting('credential','newer-login'); await database.restoreSettingIfCurrent('credential','attempt','previous'); expect(await database.getSetting('credential')).toBe('newer-login');
    await database.setSetting('new-key','attempt'); await database.restoreSettingIfCurrent('new-key','attempt',null); expect(await database.getSetting('new-key')).toBeNull();
  } finally { await database.closeDb(); rmSync(directory, { recursive: true, force: true }); }
});
