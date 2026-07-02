import { describe, expect, it, vi } from 'vitest';
import { generateAssistantDailySummary } from '../../src/main/assistant-daily';
import { buildDailyEvent } from './fixtures/daily-event';

vi.mock('../../src/main/teamforge.js', () => ({
  getDailyAssistantEventStatus: vi.fn(),
  sendDailyAssistantEvent: vi.fn(),
}));

vi.mock('../../src/main/thoughtseed-bridge.js', () => ({
  sendThoughtseedDailyEvent: vi.fn(),
}));

describe('assistant daily summary', () => {
  it('summarizes yesterday/today/blockers/session groups and missing proof', () => {
    const summary = generateAssistantDailySummary(buildDailyEvent({
      blockers: [
        { id: 'missing-proof', label: '1 work entry needs proof.', severity: 'warning', source: 'evidence' },
      ],
      evidenceSummary: {
        totalEntries: 2,
        evidencedEntries: 1,
        missingEvidenceEntries: 1,
        legacyUnverifiedEntries: 0,
        evidencedSeconds: 3600,
        missingEvidenceSeconds: 1800,
        projectRepoCoverage: { project_verified: 'verified' },
      },
      workSummary: {
        totalEntries: 2,
        totalDurationSeconds: 5400,
        evidencedEntries: 1,
        missingEvidenceEntries: 1,
      },
      sessionGroups: [
        {
          id: 'group_runtime',
          label: 'Assistant Runtime',
          projectId: 'project_verified',
          projectName: 'Verified Project',
          repoFullName: 'thoughtseed/verified-project',
          sessionCount: 3,
          themes: ['assistant'],
          matchStatus: 'ready',
        },
      ],
    }));

    expect(summary.yesterday).toContain('standup_20260701');
    expect(summary.today).toContain('1.5h');
    expect(summary.blockers).toContain('1 work entry needs proof.');
    expect(summary.topSessionGroups).toEqual(['Assistant Runtime (3)']);
    expect(summary.missingProofNote).toBe('1 entries still need proof.');
  });
});
