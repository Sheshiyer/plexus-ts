import { describe, expect, it, vi } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { buildAssistantDailyEvent, validateAssistantDailyEvent } from '../../src/main/assistant-daily';
import { buildContextSources } from './fixtures/context-sources';

vi.mock('../../src/main/teamforge.js', () => ({
  getDailyAssistantEventStatus: vi.fn(),
  sendDailyAssistantEvent: vi.fn(),
}));

vi.mock('../../src/main/thoughtseed-bridge.js', () => ({
  sendThoughtseedDailyEvent: vi.fn(),
}));

describe('assistant daily event builder', () => {
  it('builds a daily event from context without raw session file contents', async () => {
    const context = await buildAssistantContext({
      contextScopes: ['today', 'project', 'session_group', 'infra'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        getStandupEvidenceRecord(date) {
          return {
            id: 'standup_20260701',
            date,
            totalSeconds: 3600,
            evidenceSummary: {
              totalEntries: 1,
              evidencedEntries: 1,
              missingEvidenceEntries: 0,
              legacyUnverifiedEntries: 0,
              evidencedSeconds: 3600,
              missingEvidenceSeconds: 0,
              projectRepoCoverage: { project_verified: 'verified' },
            },
            activity: [],
            generatedAt: '2026-07-01T09:00:00.000Z',
          };
        },
      }),
    });

    const event = buildAssistantDailyEvent({
      date: '2026-07-01',
      memberId: 'shesh',
      context,
    });

    expect(validateAssistantDailyEvent(event)).toEqual([]);
    expect(event.eventId).toBe('assistant_daily_20260701_shesh');
    expect(event.standupRecordId).toBe('standup_20260701');
    expect(event.projectSummaries.find((project) => project.projectId === 'project_verified')).toMatchObject({ totalSeconds: 3600 });
    expect(event.sessionGroups.length).toBeGreaterThan(0);
    expect(JSON.stringify(event)).not.toContain('/mock/codex/session.jsonl');
    expect(JSON.stringify(event)).not.toContain('sourcePath');
  });
});
