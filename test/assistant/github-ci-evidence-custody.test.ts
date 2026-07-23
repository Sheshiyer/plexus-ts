import { afterEach, describe, expect, it } from 'vitest';
import type { GitHubCiEvidenceBatch } from '../../src/shared/types';
import { loadIsolatedAssistantDatabase } from './fixtures/database';

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

describe('GitHub CI proof custody', () => {
  it('persists CI separately from employee-matchable GitHub activity', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { persistGitHubCiEvidence } = await import('../../src/main/github-ci-evidence');
    const batch: GitHubCiEvidenceBatch = {
      items: [{
        id: 'github:8123456789:workflow:701',
        externalId: 701,
        projectId: 'project_1',
        repoFullName: 'thoughtseed/private-project',
        evidenceClass: 'ci',
        evidenceType: 'workflow_run',
        name: 'CI',
        status: 'completed',
        conclusion: 'success',
        url: 'https://github.com/thoughtseed/private-project/actions/runs/701',
        headSha: 'a'.repeat(40),
        attempt: 2,
        event: 'pull_request',
        branch: 'codex/private-github-app',
        actor: 'alice',
        occurredAt: '2026-07-13T12:30:00.000Z',
        metadata: { source: 'actions' },
      }],
      truncated: false,
      checkedShas: ['a'.repeat(40)],
    };

    await persistGitHubCiEvidence('project_1', batch, '2026-07-13T13:00:00.000Z');

    const custody = await database.listProofCustodyRecords({ subjectType: 'project', subjectId: 'project_1' });
    const latestSummaries = await database.listLatestGitHubCiSummaryRecords();
    expect(custody).toHaveLength(2);
    expect(custody).toEqual(expect.arrayContaining([
      expect.objectContaining({
        evidenceType: 'github_ci_summary',
        proofStatus: 'verified',
        payload: expect.objectContaining({ evidenceClass: 'ci', total: 1, successful: 1, conclusion: 'success' }),
      }),
      expect.objectContaining({
        evidenceType: 'github_workflow_run',
        proofStatus: 'verified',
        artifactRef: 'https://github.com/thoughtseed/private-project/actions/runs/701',
        payload: expect.objectContaining({ evidenceClass: 'ci', externalId: 701, headSha: 'a'.repeat(40) }),
      }),
    ]));
    expect(await database.listGitHubActivity('project_1', '2026-07-13T00:00:00.000Z', '2026-07-14T00:00:00.000Z')).toEqual([]);
    expect(latestSummaries).toEqual([
      expect.objectContaining({ subjectId: 'project_1', evidenceType: 'github_ci_summary' }),
    ]);
  }, 15000);

  it.each([
    { label: 'all-skipped', conclusion: 'skipped' as const, truncated: false, expectedConclusion: 'pending' },
    { label: 'truncated-success', conclusion: 'success' as const, truncated: true, expectedConclusion: 'partial' },
  ])('does not mark $label CI custody verified', async ({ conclusion, truncated, expectedConclusion }) => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    const { persistGitHubCiEvidence } = await import('../../src/main/github-ci-evidence');
    await persistGitHubCiEvidence('project_guarded', {
      items: [{
        id: 'github:8123456789:workflow:702',
        externalId: 702,
        projectId: 'project_guarded',
        repoFullName: 'thoughtseed/private-project',
        evidenceClass: 'ci',
        evidenceType: 'workflow_run',
        name: 'Guarded CI',
        status: 'completed',
        conclusion,
        url: 'https://github.com/thoughtseed/private-project/actions/runs/702',
        headSha: 'b'.repeat(40),
        attempt: 1,
        event: 'push',
        branch: 'main',
        actor: 'github-actions',
        occurredAt: '2026-07-13T14:00:00.000Z',
        metadata: {},
      }],
      truncated,
      checkedShas: ['b'.repeat(40)],
    }, '2026-07-13T14:05:00.000Z');

    const records = await database.listProofCustodyRecords({ subjectType: 'project', subjectId: 'project_guarded' });
    const summary = records.find((record) => record.evidenceType === 'github_ci_summary');
    expect(summary).toMatchObject({
      proofStatus: 'partial',
      payload: expect.objectContaining({ conclusion: expectedConclusion, truncated }),
    });
    expect(summary?.proofStatus).not.toBe('verified');
  }, 15000);
});
