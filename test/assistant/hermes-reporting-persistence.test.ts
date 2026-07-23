import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import type { StandupEvidenceRecord } from '../../src/shared/types';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

function standup(date: string): StandupEvidenceRecord {
  return {
    id: `standup_${date}`,
    date,
    totalSeconds: 600,
    evidenceSummary: {
      proofStatus: 'verified',
      totalEntries: 1,
      evidencedEntries: 1,
      missingEvidenceEntries: 0,
      legacyUnverifiedEntries: 0,
      evidencedSeconds: 600,
      missingEvidenceSeconds: 0,
      projectRepoCoverage: {},
    },
    activity: [],
    generatedAt: `${date}T12:00:00.000Z`,
  };
}

describe('Hermes reporting persistence', () => {
  it('deletes the retired MultiCA API setting on database startup', async () => {
    const loaded = await loadIsolatedAssistantDatabase();
    cleanupDatabase = loaded.cleanup;
    await loaded.database.setSetting('tf.multicaApiUrl', 'https://retired-multica.example');
    await loaded.database.closeDb();
    vi.resetModules();
    const restarted = await import('../../src/db/database');

    expect(await restarted.getSetting('tf.multicaApiUrl')).toBeNull();
    await restarted.closeDb();
  });

  it('gets and lists persisted standup evidence by an exclusive UTC date range', async () => {
    const loaded = await loadIsolatedAssistantDatabase();
    cleanupDatabase = loaded.cleanup;
    await Promise.all([
      loaded.database.upsertStandupEvidenceRecord(standup('2026-06-30')),
      loaded.database.upsertStandupEvidenceRecord(standup('2026-07-01')),
      loaded.database.upsertStandupEvidenceRecord(standup('2026-07-02')),
    ]);

    await expect(loaded.database.getStandupEvidenceRecord('2026-07-01'))
      .resolves.toMatchObject({ id: 'standup_2026-07-01', date: '2026-07-01' });
    await expect(loaded.database.listStandupEvidenceRecords('2026-07-01', '2026-07-02'))
      .resolves.toEqual([expect.objectContaining({ id: 'standup_2026-07-01' })]);
  });

  it('clears dangling standup ids from proof packets on database startup', async () => {
    const loaded = await loadIsolatedAssistantDatabase();
    cleanupDatabase = loaded.cleanup;
    await loaded.database.upsertDailyProofPacket({
      id: 'daily_proof_2026-07-01',
      date: '2026-07-01',
      generatedAt: '2026-07-01T23:00:00.000Z',
      proofStatus: 'pending',
      reportSubjectId: '2026-07-01',
      standupEvidenceRecordId: 'standup_2026-07-01',
      totalSeconds: 0,
      entryCount: 0,
      taskCount: 0,
      missingProofCount: 0,
      blockerCount: 0,
      evidenceSummary: {
        proofStatus: 'pending',
        totalEntries: 0,
        evidencedEntries: 0,
        missingEvidenceEntries: 0,
        legacyUnverifiedEntries: 0,
        evidencedSeconds: 0,
        missingEvidenceSeconds: 0,
        projectRepoCoverage: {},
      },
      fabricTaskProof: {
        proofStatus: 'pending',
        totalTasks: 0,
        doneTasks: 0,
        inProgressTasks: 0,
        blockedTasks: 0,
        verifiedTasks: 0,
        weakEvidenceTasks: 0,
        missingProofTasks: 0,
        proofStrength: { weak_evidence: 0, verified_evidence: 0 },
        blockers: [],
      },
    });
    await loaded.database.closeDb();
    vi.resetModules();
    const restarted = await import('../../src/db/database');

    await expect(restarted.getDailyProofPacketByDate('2026-07-01')).resolves.toMatchObject({
      standupEvidenceRecordId: null,
    });
    await restarted.closeDb();
  });

  it('uses persisted standup evidence in the default assistant context source', async () => {
    const loaded = await loadIsolatedAssistantDatabase();
    cleanupDatabase = loaded.cleanup;
    await loaded.database.upsertStandupEvidenceRecord(standup('2026-07-01'));
    const { defaultAssistantContextSources } = await import('../../src/main/assistant-context');
    const sources = defaultAssistantContextSources();

    expect(sources.getStandupEvidenceRecord).toBeTypeOf('function');
    await expect(sources.getStandupEvidenceRecord?.('2026-07-01'))
      .resolves.toMatchObject({ id: 'standup_2026-07-01' });
  });

  it('removes MultiCA from active member provisioning contracts', () => {
    const typesSource = readFileSync(path.resolve(process.cwd(), 'src/shared/types.ts'), 'utf8');
    const teamforgeSource = readFileSync(path.resolve(process.cwd(), 'src/main/teamforge.ts'), 'utf8');

    expect(typesSource).not.toContain('multica?: {');
    expect(teamforgeSource).not.toContain("setSetting('tf.multicaApiUrl'");
  });
});
