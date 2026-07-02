import { describe, expect, it } from 'vitest';
import { redactForAssistant } from '../../src/main/assistant-context';
import { MAX_TEXT_CHARS_PER_ITEM } from '../../src/main/assistant-policy';

describe('assistant context redaction', () => {
  it('recursively redacts secret-like keys using assistant policy', () => {
    const redacted = redactForAssistant({
      projectName: 'Plexus',
      nested: {
        Authorization: 'Bearer secret',
        bridge_token: 'bridge-secret',
      },
      list: [{ CF_Access_JWT: 'jwt-secret' }],
    });

    expect(redacted).toMatchObject({
      projectName: 'Plexus',
      nested: {
        Authorization: '[redacted]',
        bridge_token: '[redacted]',
      },
      list: [{ CF_Access_JWT: '[redacted]' }],
    });
  });

  it('truncates long strings while preserving ordinary ids, titles, and dates', () => {
    const occurredAt = new Date('2026-07-01T09:00:00.000Z');
    const redacted = redactForAssistant({
      id: 'entry_1',
      title: 'Context gateway',
      occurredAt,
      body: 'x'.repeat(MAX_TEXT_CHARS_PER_ITEM + 10),
    }) as Record<string, unknown>;

    expect(redacted.id).toBe('entry_1');
    expect(redacted.title).toBe('Context gateway');
    expect(redacted.occurredAt).toBe('2026-07-01T09:00:00.000Z');
    expect(String(redacted.body)).toHaveLength(MAX_TEXT_CHARS_PER_ITEM);
  });
});
