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
  it('accepts packaging without a process environment origin', () => {
    for (const origin of [undefined, '']) {
      const result = runVerifier(origin);
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/Packaged OmniRoute production authority verified/i);
    }
  });

  it('accepts a matching repository variable and rejects every alternate origin', () => {
    const result = runVerifier('https://clio-relay.thoughtseed.space');

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Packaged OmniRoute production authority verified/i);
    for (const origin of [
      'http://clio-relay.thoughtseed.space',
      'https://clio-relay.thoughtseed.space/path',
      'https://alternate-relay.thoughtseed.space',
    ]) {
      const rejected = runVerifier(origin);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toMatch(/must exactly match the baked canonical HTTPS production authority/i);
    }
  });

  it('runs the gate before every production package, release, and assistant smoke path', () => {
    const scripts = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).scripts as Record<string, string>;

    for (const name of ['build', 'dist', 'release:mac', 'smoke:packaged-main', 'smoke:packaged-renderer', 'smoke:assistant-production']) {
      expect(scripts[name]).toMatch(/^npm run verify:omniroute-release && /);
    }
  });

  it('keeps relay fetch authority explicit instead of reading process environment', () => {
    const source = readFileSync(path.join(repoRoot, 'src/main/teamforge.ts'), 'utf8');
    expect(source).not.toContain('process.env.PLEXUS_OMNIROUTE_RELAY_ORIGIN');
    expect(source).toContain('const relayOrigin = dependencies.relayOrigin;');
  });
});
