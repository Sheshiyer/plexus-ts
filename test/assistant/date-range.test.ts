import { describe, expect, it } from 'vitest';
import { assistantDateRange, validateAssistantDateRange } from '../../src/main/assistant-context';

describe('assistant date range guard', () => {
  it('builds UTC today boundaries', () => {
    expect(assistantDateRange('today', '2026-07-01T09:45:00.000Z')).toEqual({
      scope: 'today',
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-02T00:00:00.000Z',
    });
  });

  it('builds Monday-based UTC week boundaries', () => {
    expect(assistantDateRange('week', '2026-07-01T09:45:00.000Z')).toEqual({
      scope: 'week',
      from: '2026-06-29T00:00:00.000Z',
      to: '2026-07-06T00:00:00.000Z',
    });
  });

  it('rejects model context ranges longer than 31 days', () => {
    expect(() => validateAssistantDateRange('2026-07-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z'))
      .toThrow(/31 days/);
  });
});
