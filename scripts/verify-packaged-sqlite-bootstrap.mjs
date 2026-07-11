#!/usr/bin/env node
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function fail(message) {
  throw new Error(message);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}

function resolveApp() {
  const appPath = path.resolve(argValue('--app') ?? path.join('release', 'mac-arm64', 'Plexus.app'));
  if (!existsSync(appPath) || !statSync(appPath).isDirectory()) {
    fail(`packaged Plexus.app does not exist: ${appPath}.`);
  }
  const executable = path.join(appPath, 'Contents', 'MacOS', 'Plexus');
  if (!existsSync(executable) || !statSync(executable).isFile()) {
    fail(`packaged Plexus executable does not exist: ${executable}.`);
  }
  return { appPath, executable };
}

try {
  const commandShim = argValue('--command-shim');
  if (process.platform !== 'darwin' && !commandShim) {
    fail('packaged SQLite bootstrap verification must run on macOS.');
  }
  const { appPath, executable } = resolveApp();
  const scratch = mkdtempSync(path.join(tmpdir(), 'plexus-packaged-sqlite-'));
  const databasePath = path.join(scratch, 'bootstrap.db');
  try {
    const command = commandShim ? process.execPath : executable;
    const userDataArg = `--user-data-dir=${path.join(scratch, 'user-data')}`;
    const args = commandShim
      ? [path.resolve(commandShim), executable, userDataArg]
      : [userDataArg];
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        PLEXUS_DB_PATH: databasePath,
        PLEXUS_PACKAGED_SQLITE_SMOKE: '1',
      },
    });
    if (result.error) fail(`packaged app failed to start: ${result.error.message}`);
    if (result.status !== 0) {
      fail(`packaged app exited ${result.status}: ${(result.stderr || result.stdout || 'no output').trim()}`);
    }
    if (!result.stdout.includes('[packaged-sqlite-smoke] database initialized')) {
      fail('packaged app did not report SQLite initialization.');
    }
    if (!existsSync(databasePath) || statSync(databasePath).size === 0) {
      fail('packaged app did not create a non-empty SQLite database.');
    }
    console.log(`[verify:packaged-sqlite] packaged SQLite bootstrap passed: ${appPath}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
} catch (error) {
  console.error(`[verify:packaged-sqlite] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
