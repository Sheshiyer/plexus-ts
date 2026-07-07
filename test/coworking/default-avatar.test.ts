import { describe, expect, it } from 'vitest';
import { defaultAvatarDataUri } from '../../src/renderer/lib/defaultAvatar';

describe('default library avatar', () => {
  it('returns an inline SVG data URI (CSP-safe, no network fetch)', () => {
    const uri = defaultAvatarDataUri('participant_alpha');
    expect(uri.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('is deterministic per seed', () => {
    expect(defaultAvatarDataUri('participant_alpha')).toBe(defaultAvatarDataUri('participant_alpha'));
  });

  it('produces distinct avatars for distinct people', () => {
    expect(defaultAvatarDataUri('participant_alpha')).not.toBe(defaultAvatarDataUri('participant_beta'));
  });

  it('falls back to a single stable avatar for empty/missing seeds', () => {
    expect(defaultAvatarDataUri('')).toBe(defaultAvatarDataUri(null));
    expect(defaultAvatarDataUri(undefined)).toBe(defaultAvatarDataUri('   '));
  });
});
