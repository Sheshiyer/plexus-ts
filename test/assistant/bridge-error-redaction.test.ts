import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bridgeState = vi.hoisted(() => ({
  settings: new Map<string, string | null>(),
}));

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (value: Buffer) => {
      const decoded = value.toString('utf8');
      if (!decoded.startsWith('enc:')) throw new Error('bad ciphertext');
      return decoded.slice(4);
    },
  },
}));

vi.mock('../../src/db/database.js', () => ({
  getSetting: vi.fn(async (key: string) => bridgeState.settings.get(key) ?? ''),
  setSetting: vi.fn(async (key: string, value: string) => {
    bridgeState.settings.set(key, value);
  }),
}));

beforeEach(() => {
  bridgeState.settings = new Map<string, string | null>([
    ['ts.bridgeApiUrl', 'https://bridge.example'],
    ['ts.bridgeMemberId', 'member_1'],
    ['ts.bridgeTenantId', 'tenant_1'],
    ['ts.bridgeTokenEnc', Buffer.from('enc:bridge-token-secret').toString('base64')],
    ['ts.bridgeTokenExpiresAt', '2099-01-01T00:00:00.000Z'],
  ]);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('bridge durable error redaction', () => {
  it('redacts token-like values before persisting bridge lastError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('rotate failed Authorization=Bearer bridge-token-secret');
    }));

    const { rotateThoughtseedBridgeToken } = await import('../../src/main/thoughtseed-bridge');

    await expect(rotateThoughtseedBridgeToken()).rejects.toThrow('Authorization=[redacted]');

    expect(bridgeState.settings.get('ts.bridgeLastError')).toContain('Authorization=[redacted]');
    expect(bridgeState.settings.get('ts.bridgeLastError')).not.toContain('bridge-token-secret');
  });
});
