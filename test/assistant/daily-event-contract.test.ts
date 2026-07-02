import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_DAILY_EVENT_SCHEMA,
  ASSISTANT_DAILY_EVENT_STATUSES,
  type AssistantDailyEvent,
  type AssistantDailyEventStatus,
} from '../../src/shared/native-assistant';
import { buildDailyEvent } from './fixtures/daily-event';

describe('assistant daily event contract', () => {
  it('declares the v1 schema and required payload fields', () => {
    const queued: AssistantDailyEventStatus = 'queued';
    const event: AssistantDailyEvent = buildDailyEvent();

    expect(queued).toBe('queued');
    expect(ASSISTANT_DAILY_EVENT_SCHEMA).toBe('thoughtseed.plexus_daily_agent_event.v1');
    expect(ASSISTANT_DAILY_EVENT_STATUSES).toEqual(['queued', 'sent', 'failed']);
    expect(event).toMatchObject({
      schema: ASSISTANT_DAILY_EVENT_SCHEMA,
      date: '2026-07-01',
      memberId: 'shesh',
      projectSummaries: expect.any(Array),
      sessionGroups: expect.any(Array),
      blockers: expect.any(Array),
      suggestions: expect.any(Array),
      evidenceSummary: expect.any(Object),
    });
  });
});
