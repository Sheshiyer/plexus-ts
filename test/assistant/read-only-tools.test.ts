import { describe, expect, it, vi } from 'vitest';
import { executeAssistantTool } from '../../src/main/assistant-tools';

function snapshot(patch: Record<string, unknown> = {}) {
  return {
    projects: [{ id: 'project_1', name: 'Verified', bridgeToken: 'secret-token' }],
    entries: [],
    workSummary: { totalEntries: 0, totalDurationSeconds: 0, evidencedEntries: 0, missingEvidenceEntries: 0 },
    timer: { running: false },
    evidence: null,
    githubActivity: [],
    agentSessions: {
      enabled: true,
      consentState: 'enabled',
      scanned: 0,
      imported: 0,
      totalPending: 0,
      matchedPending: 0,
      readyPending: 0,
      candidates: [],
      groups: [],
    },
    sessionGroups: [],
    infra: null,
    route: null,
    budget: { projects: { limit: 50, totalItems: 1, droppedItems: 0 } },
    ...patch,
  } as any;
}

describe('assistant read-only tool executor', () => {
  it('routes context project reads through the context gateway and redacts results', async () => {
    const loadContext = vi.fn(async () => snapshot());

    const execution = await executeAssistantTool(
      'context.projects',
      { token: 'payload-secret' },
      {},
      { loadContext },
    );

    expect(loadContext).toHaveBeenCalledWith({
      contextScopes: ['project'],
      projectId: undefined,
      dateRangeScope: 'today',
    });
    expect(execution.result.projects).toEqual([
      { id: 'project_1', name: 'Verified', bridgeToken: '[REDACTED]' },
    ]);
  });

  it('does not require an intent id for read-only session context', async () => {
    const execution = await executeAssistantTool(
      'context.sessions',
      {},
      {},
      { loadContext: async () => snapshot({ sessionGroups: [{ id: 'group_1' }] }) },
    );

    expect(execution.result.sessionGroups).toEqual([{ id: 'group_1' }]);
  });
});
