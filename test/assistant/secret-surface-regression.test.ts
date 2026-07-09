import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('secret surface regression', () => {
  it('does not expose token-bearing settings or debug auth helpers through preload/shared renderer surfaces', () => {
    const exposedSource = [
      source('src/preload/preload.ts'),
      source('src/shared/types.ts'),
      source('src/renderer/App.tsx'),
      source('src/renderer/components/AdminDiagnosticsPanel.tsx'),
      source('src/renderer/components/Settings.tsx'),
    ].join('\n');

    for (const forbidden of [
      'authTestJwt',
      'auth:testJwt',
      'tf.accessJwt',
      'tf.accessJwtEnc',
      'tf.token',
      'tf.tokenEnc',
      'ts.bridgeToken',
      'ts.bridgeTokenEnc',
      'apiToken',
      'apiTokenEnc',
      'CF_Authorization',
      'Cf-Access-Jwt-Assertion',
    ]) {
      expect(exposedSource, forbidden).not.toContain(forbidden);
    }
  });

  it('keeps token values out of local API startup logs', () => {
    const apiServerSource = source('src/main/api-server.ts');

    expect(apiServerSource).not.toContain('Plexus API token:');
    expect(apiServerSource).toContain('Plexus API bearer token is configured in secure storage.');
  });

  it('keeps Access JWT and Worker bearer tokens behind encrypted setting keys', () => {
    const teamforgeSource = source('src/main/teamforge.ts');

    expect(teamforgeSource).toContain("const ACCESS_JWT_KEY = 'tf.accessJwtEnc'");
    expect(teamforgeSource).toContain("const LEGACY_ACCESS_JWT_KEY = 'tf.accessJwt'");
    expect(teamforgeSource).toContain("const WORKER_TOKEN_KEY = 'tf.tokenEnc'");
    expect(teamforgeSource).toContain("const LEGACY_WORKER_TOKEN_KEY = 'tf.token'");
    expect(teamforgeSource).not.toContain("getSetting('tf.accessJwt')");
    expect(teamforgeSource).not.toContain("setSetting('tf.accessJwt'");
  });
});
