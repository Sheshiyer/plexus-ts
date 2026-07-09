import { afterEach, describe, expect, it } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('proof custody store', () => {
  it('upserts proof records by subject, evidence type, and payload hash', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;

    const first = await database.upsertProofCustodyRecord({
      subjectType: 'daily_report',
      subjectId: '2026-07-09',
      proofStatus: 'partial',
      evidenceType: 'report',
      payload: { entryCount: 2, missingEvidenceEntries: 1 },
      createdAt: '2026-07-09T09:00:00.000Z',
      updatedAt: '2026-07-09T09:00:00.000Z',
    });

    const second = await database.upsertProofCustodyRecord({
      subjectType: 'daily_report',
      subjectId: '2026-07-09',
      proofStatus: 'verified',
      evidenceType: 'report',
      payload: { missingEvidenceEntries: 1, entryCount: 2 },
      updatedAt: '2026-07-09T09:05:00.000Z',
    });

    expect(second.id).toBe(first.id);
    expect(second.payloadHash).toBe(first.payloadHash);
    expect(second.proofStatus).toBe('verified');
    expect(second.updatedAt).toBe('2026-07-09T09:05:00.000Z');

    const records = await database.listProofCustodyRecords({
      subjectType: 'daily_report',
      subjectId: '2026-07-09',
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      subjectType: 'daily_report',
      subjectId: '2026-07-09',
      evidenceType: 'report',
      proofStatus: 'verified',
      payload: { entryCount: 2, missingEvidenceEntries: 1 },
    });
  }, 15000);
});
