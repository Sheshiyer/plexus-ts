#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGED_MAIN_SMOKE_MARKER = '[packaged-main-smoke]';
// Packaged Electron startup can exceed 30 seconds on a cold macOS runner while
// native modules initialize. The main-process boot proof itself exits as soon
// as the module graph resolves, so this is only an upper bound.
const MAIN_PROBE_TIMEOUT_MS = 60_000;

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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(3_000)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(1_000)]);
  }
}

async function probeMainProcess(executable) {
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'plexus-main-smoke-'));
  let stdout = '';
  let stderr = '';
  const child = spawn(executable, [
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PLEXUS_DB_PATH: ':memory:',
      PLEXUS_DISABLE_AUTO_UPDATE: '1',
      PLEXUS_PACKAGED_MAIN_SMOKE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      };
      const inspectOutput = () => {
        if (stdout.includes('ERR_MODULE_NOT_FOUND') || stderr.includes('ERR_MODULE_NOT_FOUND')) {
          settle(reject, new Error(`Packaged main process failed to resolve a module. stdout=${stdout} stderr=${stderr}`));
          return;
        }
        if (stdout.includes(`${PACKAGED_MAIN_SMOKE_MARKER} FAILED`)) {
          settle(reject, new Error(`Packaged main-process boot proof reported a failure. stdout=${stdout} stderr=${stderr}`));
        }
      };
      const timer = setTimeout(() => {
        settle(reject, new Error(`Packaged main-process boot proof timed out. stdout=${stdout} stderr=${stderr}`));
      }, MAIN_PROBE_TIMEOUT_MS);
      child.stdout.on('data', chunk => {
        stdout += String(chunk);
        inspectOutput();
      });
      child.stderr.on('data', chunk => {
        stderr += String(chunk);
        inspectOutput();
      });
      child.once('exit', (code, signal) => {
        if (code === 0 && stdout.includes(PACKAGED_MAIN_SMOKE_MARKER)) {
          settle(resolve);
          return;
        }
        settle(reject, new Error(`Packaged main process exited without a boot proof (code=${code}, signal=${signal}). stdout=${stdout} stderr=${stderr}`));
      });
    });
  } finally {
    await stopChild(child);
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function main() {
  if (process.platform !== 'darwin') {
    console.log('[smoke:packaged-main] skipped outside macOS.');
    return;
  }

  const appPath = findPackagedApp();
  if (!appPath) throw new Error('Packaged Plexus.app not found under release/.');
  const executable = path.join(appPath, 'Contents', 'MacOS', 'Plexus');
  await probeMainProcess(executable);
  console.log('[smoke:packaged-main] packaged main process booted from app.asar with a complete module graph.');
}

main().catch(error => {
  console.error(`[smoke:packaged-main] ${error?.message || String(error)}`);
  process.exit(1);
});
