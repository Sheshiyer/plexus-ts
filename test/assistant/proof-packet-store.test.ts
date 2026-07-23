import { afterEach, describe, expect, it } from 'vitest';
import { buildDailyProofPacket, buildFabricTaskProofSummary } from '../../src/main/proof-report';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import { buildProject, buildTimeEntry } from './fixtures/builders';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('proof packet and provenance store', () => {
  it('round-trips work entry evidence provenance', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    await database.insertProject(buildProject());
    await database.insertEntry(buildTimeEntry({
      evidenceProvenance: [{
        source: 'github',
        artifactType: 'commit',
        artifactId: 'activity_1',
        artifactRef: 'https://github.com/thoughtseed/verified-project/commit/activity_1',
        checkedAt: '2026-07-01T09:05:00.000Z',
        title: 'feat: add assistant context gateway',
      }],
    }));

    const entries = await database.listEntries('2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z');

    expect(entries[0].evidenceProvenance).toEqual([expect.objectContaining({
      source: 'github',
      artifactId: 'activity_1',
      artifactRef: 'https://github.com/thoughtseed/verified-project/commit/activity_1',
      checkedAt: '2026-07-01T09:05:00.000Z',
    })]);
  });

  it('persists and retrieves generated daily proof packets by date', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const evidenceSummary = {
      proofStatus: 'verified' as const,
      totalEntries: 1,
      evidencedEntries: 1,
      missingEvidenceEntries: 0,
      legacyUnverifiedEntries: 0,
      evidencedSeconds: 3600,
      missingEvidenceSeconds: 0,
      projectRepoCoverage: { project_verified: 'verified' as const },
    };
    const packet = buildDailyProofPacket({
      date: '2026-07-01',
      totalSeconds: 3600,
      entryCount: 1,
      evidenceSummary,
      fabricTaskProof: buildFabricTaskProofSummary([]),
      standupEvidenceRecordId: 'standup_2026-07-01',
    });

    await database.upsertDailyProofPacket(packet);
    const stored = await database.getDailyProofPacketByDate('2026-07-01');

    expect(stored).toMatchObject({
      id: 'daily_proof_2026-07-01',
      date: '2026-07-01',
      proofStatus: 'verified',
      reportSubjectId: '2026-07-01',
      standupEvidenceRecordId: 'standup_2026-07-01',
      evidenceSummary,
    });
  });
});
