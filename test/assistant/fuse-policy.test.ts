import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const expectedFuses = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  loadBrowserProcessSpecificV8Snapshot: false,
  grantFileProtocolExtraPrivileges: true,
  wasmTrapHandlers: true,
};

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Electron fuse policy', () => {
  it('configures the production fuse policy in electron-builder', () => {
    const pkg = JSON.parse(source('package.json'));

    expect(pkg.devDependencies['@electron/fuses']).toBeDefined();
    expect(pkg.build.asar).toBe(true);
    expect(pkg.build.afterPack).toBe('scripts/electron-fuses.cjs');
    expect(pkg.plexusElectronFuses).toEqual(expectedFuses);
  });

  it('exposes fuse verification through local and release gates', () => {
    const pkg = JSON.parse(source('package.json'));
    const ciWorkflow = source('.github/workflows/ci.yml');
    const releaseWorkflow = source('.github/workflows/release.yml');
    const otaPrep = source('scripts/prepare-ota-release.mjs');

    expect(pkg.scripts['verify:fuses']).toBe('node scripts/verify-electron-fuses.mjs');
    expect(pkg.scripts['verify:all']).toContain('npm run verify:fuses');
    expect(ciWorkflow).toContain('npm run verify:fuses');
    expect(otaPrep).toContain("run('npm', ['run', 'verify:fuses'])");
    expect(otaPrep).toContain("'--app', 'auto'");
    expect(releaseWorkflow).toContain('npm run verify:fuses -- --app auto');
  });

  it('keeps the verifier policy in sync with package.json', () => {
    const script = source('scripts/verify-electron-fuses.mjs');
    const hook = source('scripts/electron-fuses.cjs');

    for (const [key, value] of Object.entries(expectedFuses)) {
      expect(script).toContain(`${key}: ${value}`);
      expect(hook).toContain(key);
    }
    expect(script).toContain("pkg.build?.asar !== true");
    expect(script).toContain("pkg.build?.afterPack !== 'scripts/electron-fuses.cjs'");
    expect(script).toContain("@electron/fuses', 'read', '--app'");
    expect(hook).toContain('flipFuses');
  });
});
