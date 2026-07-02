#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['src', 'README.md', 'package.json', 'docs'];
const excludedDirs = new Set([
  path.join(repoRoot, 'dist'),
  path.join(repoRoot, 'release'),
  path.join(repoRoot, 'src', 'renderer', 'dist'),
  path.join(repoRoot, 'docs', 'evidence'),
]);
const pattern = /Placeholder|Time engine|time engine|Time Tracker|fake repo|fake activity|fake biorhythm|fake breakwork|placeholder appraisal|Start a timer|Javi A\. Torres|javicodes|Untitled|Admin Demo|demo-safe|emulation|probe pending|not scanned|No tasks yet|awaiting first cycle/;

function isExcluded(filePath) {
  return [...excludedDirs].some((dir) => filePath === dir || filePath.startsWith(`${dir}${path.sep}`));
}

function* walk(filePath) {
  if (isExcluded(filePath)) return;
  const stat = statSync(filePath);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(filePath)) {
      yield* walk(path.join(filePath, entry));
    }
    return;
  }
  if (stat.isFile()) yield filePath;
}

const matches = [];

for (const root of roots) {
  for (const filePath of walk(path.join(repoRoot, root))) {
    let text;
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    text.split(/\\r?\\n/).forEach((line, index) => {
      const match = line.match(pattern);
      if (!match) return;
      matches.push({
        file: path.relative(repoRoot, filePath),
        line: index + 1,
        term: match[0],
        text: line.trim(),
      });
    });
  }
}

if (matches.length > 0) {
  for (const match of matches) {
    console.error(`${match.file}:${match.line}: ${match.term} :: ${match.text}`);
  }
  console.error('Release-blocking placeholder or old-brand string found.');
  process.exit(1);
}

console.log('No-placeholder scan passed.');
