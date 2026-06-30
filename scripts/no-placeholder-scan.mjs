#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pattern = 'Placeholder|Time engine|time engine|Time Tracker|fake repo|fake activity|fake biorhythm|fake breakwork|placeholder appraisal|Start a timer|Javi A\\. Torres|javicodes|Untitled|Admin Demo|demo-safe|emulation|probe pending|not scanned|No tasks yet|awaiting first cycle';

const result = spawnSync('rg', ['-n', '-g', '!docs/evidence/**', pattern, 'src', 'README.md', 'package.json', 'docs'], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status === 0) {
  process.stderr.write(result.stdout);
  process.stderr.write('Release-blocking placeholder or old-brand string found.\\n');
  process.exit(1);
}

if (result.status !== 1) {
  if (result.stderr) process.stderr.write(result.stderr);
  process.stderr.write(`No-placeholder scan errored with exit ${result.status}.\\n`);
  process.exit(1);
}

console.log('No-placeholder scan passed.');
