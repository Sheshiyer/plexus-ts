import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { MAX_CONTEXT_ITEMS } from '../../src/main/assistant-policy';
import { buildGitHubActivity } from './fixtures/builders';
import { buildContextSources } from './fixtures/context-sources';

describe('assistant github activity context', () => {
  it('exposes bounded redacted activity for requested date range', async () => {
    const activity = Array.from({ length: MAX_CONTEXT_ITEMS + 5 }, (_, index) => buildGitHubActivity({
      id: `activity_${index}`,
      title: `Activity ${index}`,
      occurredAt: `2026-07-01T08:${String(index).padStart(2, '0')}:00.000Z`,
      metadata: { Authorization: 'secret', sha: `sha_${index}` },
    }));

    const snapshot = await buildAssistantContext({
      contextScopes: ['today'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        async listGitHubActivity(projectId, from, to) {
          expect(projectId).toBe('project_verified');
          expect(from).toBe('2026-07-01T00:00:00.000Z');
          expect(to).toBe('2026-07-02T00:00:00.000Z');
          return activity;
        },
      }),
      projectId: 'project_verified',
    });

    expect(snapshot.githubActivity).toHaveLength(MAX_CONTEXT_ITEMS);
    expect(snapshot.budget.githubActivity.droppedItems).toBe(5);
    expect(snapshot.githubActivity[0].metadata).toMatchObject({
      Authorization: '[redacted]',
      sha: 'sha_54',
    });
  });
});
