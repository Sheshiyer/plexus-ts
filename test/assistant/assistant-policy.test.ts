import { describe, expect, it } from 'vitest';
import { isSecretLikeKey } from '../../src/main/assistant-policy';

describe('assistant policy', () => {
  it('detects secret-like keys case-insensitively', () => {
    expect(isSecretLikeKey('Authorization')).toBe(true);
    expect(isSecretLikeKey('bridge_token')).toBe(true);
    expect(isSecretLikeKey('CF_Access_JWT')).toBe(true);
    expect(isSecretLikeKey('messageSignature')).toBe(true);
  });

  it('does not flag ordinary context keys', () => {
    expect(isSecretLikeKey('projectName')).toBe(false);
    expect(isSecretLikeKey('sessionTitle')).toBe(false);
  });
});
