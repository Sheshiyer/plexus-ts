import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const gateCommands = [
  'npm run security:audit:prod',
  'npm run verify:fuses',
  'npm run verify:csp',
  'npm run verify:release-evidence',
  'npm run smoke:all',
];

describe('production release proof gates', () => {
  it('keeps executable local gates wired through package scripts', () => {
    const pkg = JSON.parse(source('package.json'));
    const scripts = pkg.scripts;

    expect(scripts['security:audit:prod']).toBe('node scripts/security-audit-prod.mjs');
    expect(scripts['verify:csp']).toBe('node scripts/verify-renderer-csp.mjs');
    expect(scripts['verify:release-evidence']).toBe('node scripts/verify-release-evidence.mjs');

    for (const command of gateCommands) {
      expect(scripts['verify:all']).toContain(command);
    }

    expect(scripts['smoke:all']).toContain('npm run smoke:main-imports');
    expect(scripts['smoke:all']).toContain('npm run smoke:assistant-production');
    expect(scripts['smoke:assistant-production']).toContain('node scripts/smoke-assistant-production.mjs');
    for (const smoke of [
      'smoke-assistant-context.mjs',
      'smoke-assistant-models.mjs',
      'smoke-assistant-daily-memory.mjs',
      'smoke-thoughtseed-bridge.mjs',
    ]) {
      expect(source('scripts/smoke-assistant-production.mjs')).toContain(smoke);
    }
    expect(scripts['smoke:assistant-daily']).toContain('node scripts/smoke-assistant-daily-memory.mjs');
    expect(scripts['smoke:assistant-daily']).not.toContain('PLEXUS_DB_PATH=');
    expect(scripts['smoke:all']).not.toContain('smoke:admin-fabric-paperclip');
    expect(scripts['smoke:admin-fabric-paperclip']).toContain('smoke-admin-fabric-paperclip-test-org.mjs');
  });

  it('wires audit, CSP, evidence, fuse, and smoke gates into release surfaces', () => {
    const ciWorkflow = source('.github/workflows/ci.yml');
    const releaseWorkflow = source('.github/workflows/release.yml');
    const otaPrep = source('scripts/prepare-ota-release.mjs');

    for (const command of gateCommands) {
      expect(ciWorkflow).toContain(command);
      expect(releaseWorkflow).toContain(command);
    }

    for (const script of [
      'security:audit:prod',
      'verify:fuses',
      'verify:csp',
      'verify:release-evidence',
      'smoke:all',
    ]) {
      expect(otaPrep).toContain(`run('npm', ['run', '${script}'])`);
    }
  });

  it('documents the evidence boundary for production-ready claims', () => {
    const releaseEvidence = source('docs/RELEASE_EVIDENCE.md');
    const otaRelease = source('docs/OTA_RELEASE.md');
    const readme = source('README.md');
    const roadmap = source('docs/ROADMAP.md');
    const handoff = source('docs/HANDOFF.md');

    for (const phrase of [
      'Binary Production-Ready Gate',
      'main CI',
      'Release workflow',
      'signed OTA',
      'screenshots',
      'secret custody',
      'Electron fuses',
      'production dependency audit',
      'renderer CSP',
    ]) {
      expect(releaseEvidence).toContain(phrase);
    }

    for (const doc of [otaRelease, readme, roadmap, handoff]) {
      expect(doc).toContain('docs/RELEASE_EVIDENCE.md');
    }
  });

  it('keeps renderer CSP policy constrained and verified', () => {
    const rendererHtml = source('src/renderer/index.html');
    const cspVerifier = source('scripts/verify-renderer-csp.mjs');
    const mainSource = source('src/main/main.ts');

    expect(rendererHtml).toContain('Content-Security-Policy');
    expect(rendererHtml).toContain("default-src 'self'");
    expect(rendererHtml).toContain("object-src 'none'");
    expect(rendererHtml).toContain("frame-ancestors 'none'");
    expect(rendererHtml).toContain("script-src 'self'");
    expect(rendererHtml).toContain('https://plexus-upgrade.thoughtseed.space');

    expect(cspVerifier).toContain('script-src must not allow remote script origins');
    expect(cspVerifier).toContain("connect-src only allows http://127.0.0.1:*");
    expect(cspVerifier).toContain("forbidIncludes(name, \"'unsafe-eval'\")");
    expect(cspVerifier).toContain("forbidIncludes(name, '*')");

    expect(mainSource).toContain('contextIsolation: true');
    expect(mainSource).toContain('nodeIntegration: false');
    expect(mainSource).toContain('sandbox: true');
    expect(mainSource).toContain('webSecurity: true');
    expect(mainSource).toContain('setWindowOpenHandler');
    expect(mainSource).toContain("return { action: 'deny' }");
    expect(mainSource).toContain("mainWindow.webContents.on('will-navigate'");
    expect(mainSource).toContain("mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))");
  });
});
