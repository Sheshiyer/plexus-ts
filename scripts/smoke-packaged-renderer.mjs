#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGED_RENDERER_SMOKE_MARKER = '[packaged-renderer-smoke]';
const RENDERER_PROBE_ATTEMPTS = 2;
// Packaged Electron startup can exceed 30 seconds on a cold macOS runner while
// native modules initialize. Keep the proof bounded, but leave enough budget
// for the first renderer load in the release gate.
const RENDERER_PROBE_TIMEOUT_MS = 60_000;

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

function parseAppArgument(argv) {
  const index = argv.indexOf('--app');
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value) throw new Error('--app requires a path to a packaged Plexus.app.');
  return path.resolve(value);
}

// Node ESM resolution walks UPWARD out of the .app bundle: probing the app in
// place under release/ lets a dependency missing from app.asar silently
// resolve from the repo's own node_modules (an ancestor directory), which is
// the false green that shipped a launch-crashing build. Stage the app with
// ditto (preserves signatures, symlinks, and metadata) into a fresh temp dir
// whose ancestors can never contain node_modules, and probe the copy instead.
async function stageIsolatedApp(sourceAppPath) {
  const stageDir = mkdtempSync(path.join(os.tmpdir(), 'plexus-renderer-smoke-app-'));
  const stagedAppPath = path.join(stageDir, 'Plexus.app');
  await execFileAsync('ditto', [sourceAppPath, stagedAppPath]);
  return { stageDir, stagedAppPath };
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

async function probeRenderer(executable) {
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'plexus-renderer-smoke-'));
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
      PLEXUS_PACKAGED_RENDERER_SMOKE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      };
      const inspectStdout = () => {
        const markerIndex = stdout.indexOf(PACKAGED_RENDERER_SMOKE_MARKER);
        if (markerIndex < 0) return;
        const proofStart = markerIndex + PACKAGED_RENDERER_SMOKE_MARKER.length;
        const proofEnd = stdout.indexOf('\n', proofStart);
        if (proofEnd < 0) return;
        const serialized = stdout.slice(proofStart, proofEnd).trim();
        try {
          settle(resolve, JSON.parse(serialized));
        } catch (error) {
          settle(reject, new Error(`Invalid renderer proof: ${serialized} (${error?.message || String(error)})`));
        }
      };
      const timer = setTimeout(() => {
        settle(reject, new Error(`Packaged renderer proof timed out. stdout=${stdout} stderr=${stderr}`));
      }, RENDERER_PROBE_TIMEOUT_MS);
      child.stdout.on('data', chunk => {
        stdout += String(chunk);
        inspectStdout();
      });
      child.stderr.on('data', chunk => { stderr += String(chunk); });
      child.once('exit', (code, signal) => {
        settle(reject, new Error(`Plexus exited before renderer proof (code=${code}, signal=${signal}). stdout=${stdout} stderr=${stderr}`));
      });
    });

    if (result?.error) throw new Error(`Packaged renderer reported an error: ${result.error}`);
    if (!result || result.href.startsWith('chrome-error://') || !result.href.includes('/app.asar/dist/renderer/index.html')) {
      throw new Error(`Packaged renderer failed to load: ${JSON.stringify(result)} stderr=${stderr}`);
    }
    if (result.readyState !== 'complete' || !result.hasRoot || result.rootChildren < 1) {
      throw new Error(`Packaged renderer DOM is incomplete: ${JSON.stringify(result)}`);
    }
    return result;
  } finally {
    await stopChild(child);
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function main() {
  if (process.platform !== 'darwin') {
    console.log('[smoke:packaged-renderer] skipped outside macOS.');
    return;
  }

  const requestedAppPath = parseAppArgument(process.argv.slice(2));
  const appPath = requestedAppPath ?? findPackagedApp();
  if (!appPath) throw new Error('Packaged Plexus.app not found under release/.');
  if (!existsSync(appPath)) throw new Error(`Packaged Plexus.app not found at ${appPath}.`);
  const { stageDir, stagedAppPath } = await stageIsolatedApp(appPath);
  console.log(`[smoke:packaged-renderer] probing isolated copy (no ancestor node_modules): ${stagedAppPath}`);
  try {
    const executable = path.join(stagedAppPath, 'Contents', 'MacOS', 'Plexus');
    const failures = [];
    for (let attempt = 1; attempt <= RENDERER_PROBE_ATTEMPTS; attempt += 1) {
      try {
        const result = await probeRenderer(executable);
        console.log(`[smoke:packaged-renderer] renderer loaded from app.asar: ${result.href}`);
        return;
      } catch (error) {
        failures.push(`attempt ${attempt}: ${error?.message || String(error)}`);
        if (attempt < RENDERER_PROBE_ATTEMPTS) {
          console.warn(`[smoke:packaged-renderer] ${failures.at(-1)}; retrying with a fresh process.`);
        }
      }
    }
    throw new Error(failures.join('\n'));
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(`[smoke:packaged-renderer] ${error?.message || String(error)}`);
  process.exit(1);
});
