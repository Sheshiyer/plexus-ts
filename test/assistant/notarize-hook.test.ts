import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function hook(env: Record<string, string>, notarize = vi.fn().mockResolvedValue(undefined)) {
  const logs: string[] = [];
  const module = { exports: undefined as unknown };
  const logger = (...args: unknown[]) => logs.push(args.join(' '));
  vm.runInNewContext(readFileSync('scripts/notarize.cjs', 'utf8'), {
    module, require: () => ({ notarize }), process: { env },
    console: { log: logger, warn: logger },
  });
  return { run: module.exports as (context: object) => Promise<void>, notarize, logs };
}

const context = { electronPlatformName: 'darwin', appOutDir: '/isolated/release' };

describe('notarization hook credential strategies', () => {
  it('requires notarization with only a Keychain profile and never forwards password fields', async () => {
    const h = hook({ REQUIRE_NOTARIZATION: 'true', APPLE_NOTARY_KEYCHAIN_PROFILE: ' local-profile ', APPLE_APP_SPECIFIC_PASSWORD: 'fixture-private-value' });
    await h.run(context);
    expect(h.notarize).toHaveBeenCalledWith({ appPath: '/isolated/release/Plexus.app', keychainProfile: 'local-profile', tool: 'notarytool' });
    expect(h.logs.join('\n')).not.toContain('fixture-private-value');
    expect(h.logs.join('\n')).not.toContain('local-profile');
  });

  it('propagates a profile authentication failure rather than skipping required notarization', async () => {
    const notarize = vi.fn().mockRejectedValue(new Error('profile authentication failed'));
    const h = hook({ REQUIRE_NOTARIZATION: 'true', APPLE_NOTARY_KEYCHAIN_PROFILE: 'missing-profile' }, notarize);
    await expect(h.run(context)).rejects.toThrow('profile authentication failed');
    expect(h.logs.join('\n')).not.toContain('Notarization complete');
  });

  it('retains explicit Apple credentials compatibility', async () => {
    const h = hook({ REQUIRE_NOTARIZATION: 'true', APPLE_ID: 'fixture@example.invalid', APPLE_APP_SPECIFIC_PASSWORD: 'fixture-password', APPLE_TEAM_ID: 'FIXTURETEAM' });
    await h.run(context);
    expect(h.notarize).toHaveBeenCalledWith({ appPath: '/isolated/release/Plexus.app', appleId: 'fixture@example.invalid', appleIdPassword: 'fixture-password', teamId: 'FIXTURETEAM', tool: 'notarytool' });
    expect(h.logs.join('\n')).not.toContain('fixture-password');
  });

  it('rejects missing or blank credentials when required', async () => {
    const h = hook({ REQUIRE_NOTARIZATION: 'true', APPLE_NOTARY_KEYCHAIN_PROFILE: '  ' });
    await expect(h.run(context)).rejects.toThrow('Apple credentials are missing');
    expect(h.notarize).not.toHaveBeenCalled();
  });

  it('keeps required notarization and skip mutually exclusive even with a valid profile', async () => {
    const h = hook({ REQUIRE_NOTARIZATION: 'true', SKIP_NOTARIZATION: 'true', APPLE_NOTARY_KEYCHAIN_PROFILE: 'local-profile' });
    await expect(h.run(context)).rejects.toThrow('SKIP_NOTARIZATION=true');
    expect(h.notarize).not.toHaveBeenCalled();
  });

  it('retains optional missing-credentials and explicit skip behavior', async () => {
    for (const env of [{}, { SKIP_NOTARIZATION: 'true' }]) {
      const h = hook(env);
      await h.run(context);
      expect(h.notarize).not.toHaveBeenCalled();
    }
  });
});
