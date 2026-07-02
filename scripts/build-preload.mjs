#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempOut = path.join(repoRoot, '.tmp', 'preload-build');
const preloadOut = path.join(repoRoot, 'dist', 'preload');
const tscScript = path.join(
  repoRoot,
  'node_modules',
  'typescript',
  'bin',
  'tsc',
);

function fail(message) {
  console.error(`[build-preload] ${message}`);
  process.exit(1);
}

rmSync(tempOut, { recursive: true, force: true });

const result = spawnSync(process.execPath, [tscScript, '--project', 'tsconfig.preload.json', '--outDir', tempOut], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) fail(`TypeScript failed to start: ${result.error.message}`);
if (result.status !== 0) fail(`TypeScript exited ${result.status}`);

const builtPreload = path.join(tempOut, 'preload', 'preload.js');
const builtPreloadMap = `${builtPreload}.map`;

if (!existsSync(builtPreload)) fail(`Expected preload output missing: ${builtPreload}`);

mkdirSync(preloadOut, { recursive: true });
copyFileSync(builtPreload, path.join(preloadOut, 'preload.js'));
if (existsSync(builtPreloadMap)) {
  copyFileSync(builtPreloadMap, path.join(preloadOut, 'preload.js.map'));
}

rmSync(tempOut, { recursive: true, force: true });

console.log('[build-preload] wrote dist/preload/preload.js without touching dist/shared');
