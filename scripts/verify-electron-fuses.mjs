#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_FUSES = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  loadBrowserProcessSpecificV8Snapshot: false,
  grantFileProtocolExtraPrivileges: false,
  wasmTrapHandlers: true,
};

const CLI_LABELS = {
  runAsNode: 'RunAsNode',
  enableCookieEncryption: 'EnableCookieEncryption',
  enableNodeOptionsEnvironmentVariable: 'EnableNodeOptionsEnvironmentVariable',
  enableNodeCliInspectArguments: 'EnableNodeCliInspectArguments',
  enableEmbeddedAsarIntegrityValidation: 'EnableEmbeddedAsarIntegrityValidation',
  onlyLoadAppFromAsar: 'OnlyLoadAppFromAsar',
  loadBrowserProcessSpecificV8Snapshot: 'LoadBrowserProcessSpecificV8Snapshot',
  grantFileProtocolExtraPrivileges: 'GrantFileProtocolExtraPrivileges',
  wasmTrapHandlers: 'WasmTrapHandlers',
};

function fail(message) {
  console.error(`[verify:fuses] ${message}`);
  process.exit(1);
}

function readPackageJson() {
  return JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
}

function readPackageLock() {
  return JSON.parse(readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
}

function assertPackageFusePolicy() {
  const pkg = readPackageJson();
  const configured = pkg.plexusElectronFuses ?? {};
  const mismatches = [];

  if (pkg.build?.asar !== true) {
    mismatches.push('build.asar must be true when onlyLoadAppFromAsar is enabled.');
  }
  if (pkg.build?.afterPack !== 'scripts/electron-fuses.cjs') {
    mismatches.push('build.afterPack must run scripts/electron-fuses.cjs.');
  }

  for (const [key, expected] of Object.entries(EXPECTED_FUSES)) {
    if (configured[key] !== expected) {
      mismatches.push(`plexusElectronFuses.${key} expected ${expected}, got ${configured[key]}`);
    }
  }

  const unknown = Object.keys(configured).filter(key => !(key in EXPECTED_FUSES));
  if (unknown.length > 0) {
    mismatches.push(`Unexpected fuse keys: ${unknown.join(', ')}`);
  }

  if (mismatches.length > 0) {
    fail(`Package fuse policy mismatch:\n- ${mismatches.join('\n- ')}`);
  }
  console.log('[verify:fuses] package fuse policy ok');
}

function assertLockfileHasFuses() {
  const lock = readPackageLock();
  const rootDevDependency = lock.packages?.['']?.devDependencies?.['@electron/fuses'];
  const lockedPackage = lock.packages?.['node_modules/@electron/fuses'];
  if (!rootDevDependency || !lockedPackage) {
    fail('package-lock.json is missing @electron/fuses; run npm install before committing fuse policy.');
  }
  console.log(`[verify:fuses] lockfile includes @electron/fuses ${lockedPackage.version}`);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function findPackagedApp(dir = path.join(repoRoot, 'release'), depth = 0) {
  if (!existsSync(dir) || depth > 4) return null;
  for (const name of readdirSync(dir)) {
    const candidate = path.join(dir, name);
    const stat = statSync(candidate);
    if (stat.isDirectory() && name === 'Plexus.app') return candidate;
    if (stat.isDirectory()) {
      const nested = findPackagedApp(candidate, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

function assertPackagedApp(appPath) {
  const resolved = appPath === 'auto' ? findPackagedApp() : path.resolve(repoRoot, appPath);
  if (!resolved) fail('Packaged Plexus.app not found under release/.');
  if (!existsSync(resolved)) fail(`Packaged app not found: ${resolved}`);

  const result = spawnSync('npm', ['exec', '--', '@electron/fuses', 'read', '--app', resolved], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error) fail(`@electron/fuses failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    fail(`@electron/fuses read exited ${result.status}`);
  }

  const output = `${result.stdout}\n${result.stderr}`;
  const mismatches = [];
  for (const [key, expected] of Object.entries(EXPECTED_FUSES)) {
    const label = CLI_LABELS[key];
    const state = expected ? 'enabled' : 'disabled';
    if (!new RegExp(`${label}[^\\n]*(?:${state})`, 'i').test(output)) {
      mismatches.push(`${label} should be ${state}`);
    }
  }
  if (mismatches.length > 0) {
    console.log(output.trim());
    fail(`Packaged fuse mismatch:\n- ${mismatches.join('\n- ')}`);
  }
  console.log(`[verify:fuses] packaged app fuse policy ok: ${resolved}`);
}

assertPackageFusePolicy();
assertLockfileHasFuses();

const appPath = argValue('--app');
if (appPath) assertPackagedApp(appPath);
