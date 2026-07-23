import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { buildTimeEntry } from './fixtures/builders';
import { buildContextSources } from './fixtures/context-sources';

describe('assistant evidence context', () => {
  it('exposes evidence summary and current standup evidence record', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['today'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        async listEntries() {
          return [
            buildTimeEntry({ id: 'matched', evidenceStatus: 'matched', durationSeconds: 100 }),
            buildTimeEntry({ id: 'missing', evidenceStatus: 'missing', durationSeconds: 200 }),
          ];
        },
        getStandupEvidenceRecord(date) {
          expect(date).toBe('2026-07-01');
          return {
            id: 'standup_1',
            date,
            totalSeconds: 300,
            evidenceSummary: {
              proofStatus: 'partial',
              totalEntries: 2,
              evidencedEntries: 1,
              missingEvidenceEntries: 1,
              legacyUnverifiedEntries: 0,
              evidencedSeconds: 100,
              missingEvidenceSeconds: 200,
              projectRepoCoverage: {},
            },
            activity: [],
            generatedAt: '2026-07-01T09:00:00.000Z',
          };
        },
      }),
    });

    expect(snapshot.evidence?.summary).toMatchObject({
      proofStatus: 'partial',
      totalEntries: 2,
      evidencedEntries: 1,
      missingEvidenceEntries: 1,
      evidencedSeconds: 100,
      missingEvidenceSeconds: 200,
    });
    expect(snapshot.evidence?.standupEvidence).toEqual({
      id: 'standup_1',
      date: '2026-07-01',
      totalSeconds: 300,
      generatedAt: '2026-07-01T09:00:00.000Z',
    });
    expect(snapshot.sourceHealth).toMatchObject({
      projects: { state: 'ready', itemCount: 2 },
      entries: { state: 'ready', itemCount: 2 },
      evidence: { state: 'ready', itemCount: 2 },
      standupEvidence: { state: 'ready', itemCount: 1 },
    });
  });

  it('keeps partial source failure metadata instead of failing the whole context', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['today'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        async listEntries() {
          throw new Error('entries database is locked');
        },
      }),
    });

    expect(snapshot.entries).toEqual([]);
    expect(snapshot.evidence?.summary).toMatchObject({
      proofStatus: 'pending',
      totalEntries: 0,
    });
    expect(snapshot.sourceHealth.entries).toMatchObject({
      state: 'failed',
      error: 'entries database is locked',
    });
    expect(snapshot.sourceHealth.projects).toMatchObject({
      state: 'ready',
      itemCount: 2,
    });
  });
});
