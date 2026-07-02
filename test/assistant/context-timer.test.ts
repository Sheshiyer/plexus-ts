import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { buildTimeEntry } from './fixtures/builders';
import { buildContextSources } from './fixtures/context-sources';

describe('assistant running timer context', () => {
  it('reports not-running state without mutating timer state', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['today'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({ async getRunningEntry() { return null; } }),
    });

    expect(snapshot.timer).toEqual({ running: false });
  });

  it('reports running timer elapsed estimate', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['today'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        async getRunningEntry() {
          return buildTimeEntry({
            id: 'running_1',
            endTime: null,
            startTime: '2026-07-01T08:30:00.000Z',
            pausedSeconds: 60,
            targetSeconds: 3600,
          });
        },
      }),
    });

    expect(snapshot.timer).toMatchObject({
      running: true,
      entryId: 'running_1',
      projectId: 'project_verified',
      elapsedSeconds: 1740,
      targetSeconds: 3600,
    });
  });
});
