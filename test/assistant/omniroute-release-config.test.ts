import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const verifier = path.join(repoRoot, 'scripts/verify-omniroute-release-config.mjs');

function runVerifier(origin?: string) {
  const env = { ...process.env };
  delete env.PLEXUS_OMNIROUTE_RELAY_ORIGIN;
  if (origin !== undefined) env.PLEXUS_OMNIROUTE_RELAY_ORIGIN = origin;
  return spawnSync(process.execPath, [verifier], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
  });
}

describe('OmniRoute packaged release configuration', () => {
  it('refuses production packaging and smoke without a canonical HTTPS relay origin', () => {
    for (const origin of [undefined, '', 'http://relay.example', 'https://relay.example/path']) {
      const result = runVerifier(origin);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/PLEXUS_OMNIROUTE_RELAY_ORIGIN.*canonical HTTPS origin/i);
    }
  });

  it('accepts an explicitly supplied canonical HTTPS origin without embedding a hostname', () => {
    const result = runVerifier('https://relay.example');

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OmniRoute production relay origin configured/i);
  });

  it('runs the gate before every production package, release, and assistant smoke path', () => {
    const scripts = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).scripts as Record<string, string>;

    for (const name of ['build', 'dist', 'release:mac', 'smoke:packaged-main', 'smoke:packaged-renderer', 'smoke:assistant-production']) {
      expect(scripts[name]).toMatch(/^npm run verify:omniroute-release && /);
    }
  });
});
