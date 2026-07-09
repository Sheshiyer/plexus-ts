import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { buildThoughtseedFabricTask } from './fixtures/builders';
import { buildContextSources } from './fixtures/context-sources';

describe('assistant task context', () => {
  it('exposes bounded task summaries without raw directives, history, or evidence values', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['task'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        async listFabricTasks() {
          return [
            buildThoughtseedFabricTask({
              taskId: 'task_safe_summary',
              directiveId: 'raw-directive-id-should-not-leak',
              title: 'Prepare assistant production smoke',
              description: 'Wire deterministic proof for runtime, daily, and bridge.',
              status: 'in_progress',
              proofStatus: 'partial',
              evidence: [{
                id: 'evidence_secret',
                type: 'note',
                value: 'raw-evidence-url-should-not-leak',
                addedAt: '2026-07-01T09:00:00.000Z',
              }],
              history: [{
                eventId: 'history_secret',
                timestamp: '2026-07-01T09:00:00.000Z',
                actor: 'cambium',
                source: 'cambium',
                type: 'assigned',
                payloadHash: 'hash',
                payload: { rawDirective: 'should-not-leak' },
              }],
            }),
          ];
        },
      }),
    });

    expect(snapshot.tasks).toEqual([{
      taskId: 'task_safe_summary',
      title: 'Prepare assistant production smoke',
      description: 'Wire deterministic proof for runtime, daily, and bridge.',
      projectId: 'project_verified',
      projectName: 'Verified Project',
      workEntryId: 'entry_1',
      status: 'in_progress',
      proofStatus: 'partial',
      evidenceStrength: 'weak_evidence',
      evidenceCount: 1,
      updatedAt: '2026-07-01T08:30:00.000Z',
    }]);
    expect(snapshot.budget.tasks).toEqual({ limit: 50, totalItems: 1, droppedItems: 0 });
    expect(snapshot.sourceHealth.tasks).toMatchObject({ state: 'ready', itemCount: 1 });

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('raw-directive-id-should-not-leak');
    expect(serialized).not.toContain('raw-evidence-url-should-not-leak');
    expect(serialized).not.toContain('rawDirective');
  });
});
