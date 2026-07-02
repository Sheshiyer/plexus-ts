import {
  ASSISTANT_DAILY_EVENT_SCHEMA,
  type AssistantDailyEvent,
} from '../../../src/shared/native-assistant';

export function buildDailyEvent(patch: Partial<AssistantDailyEvent> = {}): AssistantDailyEvent {
  return {
    schema: ASSISTANT_DAILY_EVENT_SCHEMA,
    eventId: 'assistant_daily_20260701_shesh',
    date: '2026-07-01',
    memberId: 'shesh',
    generatedAt: '2026-07-01T09:00:00.000Z',
    standupRecordId: 'standup_20260701',
    projectSummaries: [
      {
        projectId: 'project_verified',
        name: 'Verified Project',
        clientName: 'Thoughtseed',
        totalSeconds: 3600,
        entryCount: 1,
        evidenceStatus: 'pending',
        repoFullName: 'thoughtseed/verified-project',
      },
    ],
    sessionGroups: [
      {
        id: 'group_verified',
        label: 'Verified Project',
        projectId: 'project_verified',
        projectName: 'Verified Project',
        repoFullName: 'thoughtseed/verified-project',
        sessionCount: 2,
        themes: ['assistant', 'test'],
        matchStatus: 'ready',
      },
    ],
    blockers: [],
    suggestions: [],
    evidenceSummary: {
      totalEntries: 1,
      evidencedEntries: 1,
      missingEvidenceEntries: 0,
      legacyUnverifiedEntries: 0,
      evidencedSeconds: 3600,
      missingEvidenceSeconds: 0,
      projectRepoCoverage: { project_verified: 'verified' },
    },
    workSummary: {
      totalEntries: 1,
      totalDurationSeconds: 3600,
      evidencedEntries: 1,
      missingEvidenceEntries: 0,
    },
    ...patch,
  };
}
