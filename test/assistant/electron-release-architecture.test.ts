import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

function manifest(arch: 'arm64' | 'x64', mixed = false): string {
  const zip = `Plexus-0.5.3-mac-${arch}.zip`;
  const dmg = `Plexus-0.5.3-mac-${mixed ? 'x64' : arch}.dmg`;
  return [
    'version: 0.5.3',
    'files:',
    `  - url: ${zip}`,
    '    sha512: zip-hash',
    '    size: 120',
    `  - url: ${dmg}`,
    '    sha512: dmg-hash',
    '    size: 240',
    `path: ${zip}`,
    'sha512: zip-hash',
    '',
  ].join('\n');
}

function createLipoShim(
  root: string,
  architectures: string,
  architectureOverrides: Record<string, string> = {},
): { executable: string; logPath: string } {
  const logPath = path.join(root, 'lipo-targets.log');
  const implementation = path.join(root, 'fake-lipo.cjs');
  writeFileSync(implementation, [
    '#!/usr/bin/env node',
    "const { appendFileSync } = require('node:fs');",
    `const logPath = ${JSON.stringify(logPath)};`,
    `const defaultArchitectures = ${JSON.stringify(architectures)};`,
    `const overrides = ${JSON.stringify(architectureOverrides)};`,
    "const target = process.argv.at(-1) || '';",
    "appendFileSync(logPath, `${target}\\n`);",
    "const match = Object.entries(overrides).find(([needle]) => target.includes(needle));",
    "process.stdout.write(`${match?.[1] || defaultArchitectures}\\n`);",
    '',
  ].join('\n'));
  chmodSync(implementation, 0o755);
  if (process.platform === 'win32') {
    const shim = path.join(root, 'fake-lipo.cmd');
    writeFileSync(shim, `@echo off\r\n"${process.execPath}" "${implementation}" %*\r\n`);
    return { executable: shim, logPath };
  }
  return { executable: implementation, logPath };
}

async function runVerifier(
  body: string,
  architectures = 'arm64',
  options: { nativeFixtures?: boolean; architectureOverrides?: Record<string, string> } = {},
): Promise<{ code: number; stdout: string; stderr: string; inspectedPaths: string[] }> {
  const root = mkdtempSync(path.join(tmpdir(), 'plexus-release-arch-'));
  tempDirs.push(root);
  const releaseDir = path.join(root, 'release');
  const executableDir = path.join(releaseDir, 'mac-arm64', 'Plexus.app', 'Contents', 'MacOS');
  mkdirSync(executableDir, { recursive: true });
  const executable = path.join(executableDir, 'Plexus');
  writeFileSync(executable, 'fixture executable');
  chmodSync(executable, 0o755);
  if (options.nativeFixtures) {
    const helper = path.join(
      releaseDir,
      'mac-arm64',
      'Plexus.app',
      'Contents',
      'Frameworks',
      'Plexus Helper.app',
      'Contents',
      'MacOS',
      'Plexus Helper',
    );
    mkdirSync(path.dirname(helper), { recursive: true });
    writeFileSync(helper, Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0, 0, 0, 0]));
    chmodSync(helper, 0o755);
    const addon = path.join(
      releaseDir,
      'mac-arm64',
      'Plexus.app',
      'Contents',
      'Resources',
      'app.asar.unpacked',
      'node_modules',
      'sqlite3',
      'build',
      'Release',
      'node_sqlite3.node',
    );
    mkdirSync(path.dirname(addon), { recursive: true });
    writeFileSync(addon, 'fixture native addon');
  }
  const manifestPath = path.join(releaseDir, 'latest-mac.yml');
  writeFileSync(manifestPath, body);
  const lipo = createLipoShim(root, architectures, options.architectureOverrides);
  const inspectedPaths = () => existsSync(lipo.logPath)
    ? readFileSync(lipo.logPath, 'utf8').trim().split(/\r?\n/).filter(Boolean)
    : [];
  try {
    const result = await execFileAsync(process.execPath, [
      path.resolve(process.cwd(), 'scripts/verify-macos-release-architecture.mjs'),
      '--manifest', manifestPath,
      '--lipo', lipo.executable,
    ]);
    return { code: 0, stdout: result.stdout, stderr: result.stderr, inspectedPaths: inspectedPaths() };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof failure.code === 'number' ? failure.code : 1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
      inspectedPaths: inspectedPaths(),
    };
  }
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('macOS OTA release architecture', () => {
  it('pins signed and unsigned release builds to arm64 and verifies their manifest', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));

    expect(pkg.scripts['release:mac']).toContain('electron-builder --mac --arm64 --publish never');
    expect(pkg.scripts['release:mac']).toContain('npm run verify:release-architecture');
    expect(pkg.scripts['release:dry-run']).toContain('npm run release:mac');
    expect(pkg.scripts['verify:release-architecture'])
      .toBe('node scripts/verify-macos-release-architecture.mjs');
  });

  it('accepts an arm64-only latest-mac manifest', async () => {
    const result = await runVerifier(manifest('arm64'));

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('arm64 manifest policy ok');
    expect(result.stdout).toContain('packaged executable architecture ok: arm64');
  });

  it('rejects x64 and mixed-architecture latest-mac manifests', async () => {
    const x64 = await runVerifier(manifest('x64'));
    const mixed = await runVerifier(manifest('arm64', true));

    expect(x64.code).toBe(1);
    expect(x64.stderr).toContain('mac-arm64');
    expect(mixed.code).toBe(1);
    expect(mixed.stderr).toContain('mac-arm64');
  });

  it('rejects x86_64-only and universal packaged executables', async () => {
    const x64 = await runVerifier(manifest('arm64'), 'x86_64');
    const universal = await runVerifier(manifest('arm64'), 'x86_64 arm64');

    expect(x64.code).toBe(1);
    expect(x64.stderr).toContain('must contain arm64 and must not contain x86_64');
    expect(universal.code).toBe(1);
    expect(universal.stderr).toContain('must contain arm64 and must not contain x86_64');
  });

  it('recursively rejects a non-arm64 native addon after inspecting packaged helpers', async () => {
    const result = await runVerifier(manifest('arm64'), 'arm64', {
      nativeFixtures: true,
      architectureOverrides: { 'node_sqlite3.node': 'x86_64' },
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('node_sqlite3.node');
    expect(result.stderr).toContain('must contain arm64 and must not contain x86_64');
    expect(result.inspectedPaths.some(candidate => candidate.includes('Helper'))).toBe(true);
  });
});
