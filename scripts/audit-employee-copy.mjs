#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const employeeFiles = [
  'src/renderer/components/Login.tsx',
  'src/renderer/components/Onboarding.tsx',
  'src/renderer/components/Settings.tsx',
  'src/renderer/components/AgentFabricPanel.tsx',
  'src/renderer/components/ProjectManager.tsx',
  'src/renderer/components/PreferencesPanel.tsx',
  'src/renderer/components/AgentSessionsPanel.tsx',
  'src/renderer/components/AgentSessionFocusRail.tsx',
];

const banned = [
  ['raw URL', /https?:\/\//i],
  ['endpoint', /\bendpoint\b/i],
  ['worker endpoint', /worker endpoint/i],
  ['bridge API field', /bridgeApiUrl/i],
  ['feed URL field', /feedUrl/i],
  ['runtime endpoints', /Runtime endpoints/i],
  ['telemetry', /\btelemetry\b/i],
  ['source path field', /sourcePath/i],
  ['repo root field', /repoRoot/i],
  ['resolver cache', /local resolver cache/i],
  ['Paperclip bridge', /Paperclip bridge/i],
  ['Meshy prompt', /Meshy image prompt/i],
  ['copy prompt action', /Copy Prompt/i],
  ['generated prompt action', /Use Generated/i],
  ['prompt title', /Prompt for/i],
  ['raw payload', /raw payload/i],
  ['event payload', /event payload/i],
  ['payload JSON', /JSON\.stringify\(.*payload/i],
  ['port number label', /\bport(?:s)?\b/i],
  ['latency', /\blatency\b/i],
];

const violations = [];

for (const file of employeeFiles) {
  const absolute = resolve(repoRoot, file);
  const content = readFileSync(absolute, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [label, pattern] of banned) {
      if (pattern.test(line)) {
        violations.push({
          file: relative(repoRoot, absolute),
          line: index + 1,
          label,
          text: line.trim(),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`Employee copy audit failed with ${violations.length} issue${violations.length === 1 ? '' : 's'}:\n`);
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} [${violation.label}] ${violation.text}`);
  }
  process.exit(1);
}

console.log(`Employee copy audit passed across ${employeeFiles.length} files.`);

