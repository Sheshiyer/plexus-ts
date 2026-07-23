import { describe, expect, it } from 'vitest';
import { normalizeStandupChannel, STANDUP_CHANNEL_OPTIONS } from '../../src/renderer/lib/standup-channel';

describe('standup channel migration', () => {
  it('offers plexus and telegram, defaulting to telegram', () => {
    expect(STANDUP_CHANNEL_OPTIONS).toEqual(['plexus', 'telegram']);
    expect(normalizeStandupChannel(undefined)).toBe('telegram');
    expect(normalizeStandupChannel(null)).toBe('telegram');
  });
  it('migrates stored paperclip to telegram', () => {
    expect(normalizeStandupChannel('paperclip')).toBe('telegram');
  });
  it('passes through valid values', () => {
    expect(normalizeStandupChannel('plexus')).toBe('plexus');
    expect(normalizeStandupChannel('telegram')).toBe('telegram');
  });
  it("maps legacy stored 'web' (the original Plexus key) to plexus, preserving the explicit choice", () => {
    expect(normalizeStandupChannel('web')).toBe('plexus');
  });
});
