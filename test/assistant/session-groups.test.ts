import { describe, expect, it } from 'vitest';
import { groupAssistantSessions } from '../../src/main/assistant-context';
import { buildAgentSessionCandidate } from './fixtures/builders';

describe('assistant session groups', () => {
  it('groups sessions by project id and rolls up provider counts and confidence', () => {
    const groups = groupAssistantSessions([
      buildAgentSessionCandidate({ id: 'codex_1', provider: 'codex', confidence: 80 }),
      buildAgentSessionCandidate({ id: 'claude_1', provider: 'claude', confidence: 100 }),
      buildAgentSessionCandidate({
        id: 'unmatched_1',
        provider: 'cursor',
        projectId: null,
        projectName: null,
        repoRoot: '/work/unmatched',
        repoFullName: null,
        confidence: 50,
        matchStatus: 'needs_project',
      }),
    ]);

    const projectGroup = groups.find((group) => group.projectId === 'project_verified');
    expect(projectGroup).toMatchObject({
      sessionCount: 2,
      averageConfidence: 90,
      matchStatus: 'ready',
      providerCounts: { codex: 1, claude: 1 },
    });

    const unmatchedGroup = groups.find((group) => group.repoRoot === '/work/unmatched');
    expect(unmatchedGroup).toMatchObject({
      sessionCount: 1,
      matchStatus: 'needs_project',
      providerCounts: { cursor: 1 },
    });
  });
});
