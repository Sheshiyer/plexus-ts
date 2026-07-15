#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

async function evaluate(wsUrl, expression) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  try {
    const id = 1;
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('DevTools evaluation timed out.')), 5_000);
      ws.addEventListener('message', event => {
        const message = JSON.parse(String(event.data));
        if (message.id !== id) return;
        clearTimeout(timer);
        resolve(message);
      });
    });
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    const message = await response;
    if (message.error || message.result?.exceptionDetails) {
      throw new Error(`DevTools evaluation failed: ${JSON.stringify(message.error || message.result.exceptionDetails)}`);
    }
    return message.result?.result?.value;
  } finally {
    ws.close();
  }
}

async function main() {
  if (process.platform !== 'darwin') {
    console.log('[smoke:packaged-renderer] skipped outside macOS.');
    return;
  }

  const appPath = findPackagedApp();
  if (!appPath) throw new Error('Packaged Plexus.app not found under release/.');
  const executable = path.join(appPath, 'Contents', 'MacOS', 'Plexus');
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'plexus-renderer-smoke-'));
  const port = 19_000 + (process.pid % 1_000);
  let stderr = '';
  const child = spawn(executable, [
    `--remote-debugging-port=${port}`,
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
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.on('data', chunk => { stderr += String(chunk); });

  try {
    let target;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Plexus exited ${child.exitCode}: ${stderr}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        const targets = await response.json();
        target = targets.find(candidate => candidate.type === 'page');
        if (target?.webSocketDebuggerUrl) break;
      } catch {
        // DevTools endpoint is unavailable until Electron finishes starting.
      }
      await delay(250);
    }
    if (!target?.webSocketDebuggerUrl) throw new Error(`Renderer target did not appear: ${stderr}`);

    let result;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      result = await evaluate(target.webSocketDebuggerUrl, `({
        href: location.href,
        readyState: document.readyState,
        hasRoot: Boolean(document.querySelector('#root')),
        rootChildren: document.querySelector('#root')?.children.length ?? 0
      })`);
      if (result?.href.startsWith('chrome-error://')) break;
      if (result?.readyState === 'complete' && result?.hasRoot && result?.rootChildren > 0) break;
      await delay(250);
    }
    if (!result || result.href.startsWith('chrome-error://') || !result.href.includes('/app.asar/dist/renderer/index.html')) {
      throw new Error(`Packaged renderer failed to load: ${JSON.stringify(result)} ${stderr}`);
    }
    if (result.readyState !== 'complete' || !result.hasRoot || result.rootChildren < 1) {
      throw new Error(`Packaged renderer DOM is incomplete: ${JSON.stringify(result)}`);
    }
    console.log(`[smoke:packaged-renderer] renderer loaded from app.asar: ${result.href}`);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(3_000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(`[smoke:packaged-renderer] ${error?.message || String(error)}`);
  process.exit(1);
});
