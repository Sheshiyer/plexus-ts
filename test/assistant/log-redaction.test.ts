import { describe, expect, it } from 'vitest';
import { redactForLog, redactedErrorMessage, redactStringForLog } from '../../src/main/redaction';

describe('log redaction', () => {
  it('redacts common token, cookie, JWT, and API-key string shapes', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InNlY3JldCJ9.signature';
    const input = [
      'Authorization: Bearer member-token-secret',
      `Cookie: CF_Authorization=${jwt}; other=value`,
      'api_key=AIzaSecretGoogleKey',
      'nvidia=nvapi-secret-value',
      'signature=raw-signature-value',
    ].join('\n');

    const redacted = redactStringForLog(input);

    expect(redacted).toContain('Authorization: [redacted]');
    expect(redacted).toContain('Cookie: [redacted]');
    expect(redacted).toContain('api_key=[redacted]');
    expect(redacted).toContain('nvidia=[redacted]');
    expect(redacted).toContain('signature=[redacted]');
    expect(redacted).not.toContain('member-token-secret');
    expect(redacted).not.toContain('raw-signature-value');
    expect(redacted).not.toContain(jwt);
  });

  it('recursively redacts secret-like object keys and handles circular references', () => {
    const input: Record<string, unknown> = {
      projectId: 'project_visible',
      nested: {
        Authorization: 'Bearer secret',
        bridge_token: 'bridge-secret',
      },
      list: [{ apiKey: 'AIzaSecretGoogleKey', value: 'safe' }],
    };
    input.self = input;

    const redacted = redactForLog(input) as Record<string, unknown>;

    expect(redacted.projectId).toBe('project_visible');
    expect(redacted.self).toBe('[circular]');
    expect(redacted).toMatchObject({
      nested: {
        Authorization: '[redacted]',
        bridge_token: '[redacted]',
      },
      list: [{ apiKey: '[redacted]', value: 'safe' }],
    });
  });

  it('redacts error message and stack content without exposing secrets', () => {
    const error = new Error('request failed with Authorization=Bearer secret-token');
    error.stack = 'Error: token=secret-token\n at handler (file.ts:1)';

    const redacted = redactForLog(error) as Record<string, unknown>;

    expect(redacted.name).toBe('Error');
    expect(redacted.message).toContain('Authorization=[redacted]');
    expect(String(redacted.stack)).toContain('token=[redacted]');
    expect(JSON.stringify(redacted)).not.toContain('secret-token');
    expect(redactedErrorMessage(error)).not.toContain('secret-token');
  });

  it('caps traversal depth for unusually deep objects', () => {
    const redacted = redactForLog({ a: { b: { c: 'visible' } } }, 1) as Record<string, unknown>;

    expect(redacted).toEqual({ a: '[truncated]' });
  });
});
