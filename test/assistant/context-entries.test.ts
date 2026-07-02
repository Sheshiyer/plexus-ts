import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { buildTimeEntry } from './fixtures/builders';
import { buildContextSources } from './fixtures/context-sources';

describe('assistant work entries context', () => {
  it('exposes bounded work entries and total duration summary', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['today'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        async listEntries(from, to) {
          expect(from).toBe('2026-07-01T00:00:00.000Z');
          expect(to).toBe('2026-07-02T00:00:00.000Z');
          return [
            buildTimeEntry({ id: 'entry_a', durationSeconds: 900, syncedAt: 'worker-payload' }),
            buildTimeEntry({ id: 'entry_b', durationSeconds: 1200, evidenceStatus: 'missing' }),
          ];
        },
      }),
    });

    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]).toMatchObject({
      id: 'entry_a',
      projectId: 'project_verified',
      durationSeconds: 900,
      tags: ['assistant', 'implementation'],
      evidenceStatus: 'matched',
    });
    expect(snapshot.entries[0]).not.toHaveProperty('syncedAt');
    expect(snapshot.workSummary).toMatchObject({
      totalEntries: 2,
      totalDurationSeconds: 2100,
      evidencedEntries: 1,
      missingEvidenceEntries: 1,
    });
  });
});
