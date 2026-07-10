#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`[verify:release-candidate] ${message}`);
  process.exit(1);
}

function absolute(relativePath) {
  return path.join(repoRoot, relativePath);
}

function read(relativePath) {
  const filePath = absolute(relativePath);
  if (!existsSync(filePath)) fail(`missing required file: ${relativePath}`);
  return readFileSync(filePath, 'utf8');
}

function requireIncludes(relativePath, phrases) {
  const body = read(relativePath);
  for (const phrase of phrases) {
    if (!body.includes(phrase)) fail(`${relativePath} must mention: ${phrase}`);
  }
  return body;
}

function walkFiles(relativeDir) {
  const dirPath = absolute(relativeDir);
  if (!existsSync(dirPath)) fail(`missing required directory: ${relativeDir}`);
  const files = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const child = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(child));
    } else {
      files.push(child);
    }
  }
  return files;
}

const closeoutPath = 'docs/evidence/2026-07-10-release-candidate-closeout/README.md';
const deferredPath = 'docs/DEFERRED_REGISTER.md';
const recommendationPath = 'docs/RELEASE_CANDIDATE_RECOMMENDATION.md';
const matrixRoot = 'docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix';
const matrixManifestPath = 'docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix/capture.json';

const pkg = JSON.parse(read('package.json'));
const scripts = pkg.scripts ?? {};
if (scripts['verify:release-candidate'] !== 'node scripts/verify-release-candidate-closeout.mjs') {
  fail('package.json must wire verify:release-candidate to scripts/verify-release-candidate-closeout.mjs.');
}
if (!scripts['verify:all']?.includes('npm run verify:release-candidate')) {
  fail('verify:all must include npm run verify:release-candidate.');
}

requireIncludes(closeoutPath, [
  'P9-W1-T001',
  'P9-W1-T002',
  'P9-W1-T003',
  'P9-W1-T004',
  'P9-W1-T005',
  'P9-W1-T006',
  'P9-W2-T007',
  'P9-W2-T008',
  'P9-W2-T009',
  'P9-W2-T010',
  'P9-W2-T011',
  'P9-W2-T012',
  'P9-W3-T013',
  'P9-W3-T014',
  'P9-W3-T015',
  'P9-W3-T016',
  'P9-W3-T017',
  'P9-W3-T018',
  matrixManifestPath,
  'docs/evidence/2026-07-10-batch27-dispatch-runtime-proof/README.md',
  'docs/evidence/2026-07-10-batch23-coworking-contract-closeout/README.md',
  'npm run verify:release-candidate',
  'npm run verify:all',
  'go-with-degraded-live-proof',
]);

requireIncludes(deferredPath, [
  '#22',
  '#23',
  '#24',
  '#25',
  '#26',
  'signed OTA',
  'live Paperclip',
  'SFU',
  'Cloudflare Access',
  'go-with-degraded-live-proof',
]);

requireIncludes(recommendationPath, [
  'Recommendation: go-with-degraded-live-proof',
  'Do not call the binary fully production-ready',
  'signed OTA',
  'main CI',
  'npm run verify:all',
  'npm run verify:release-candidate',
]);

requireIncludes('docs/RELEASE_EVIDENCE.md', [
  closeoutPath,
  deferredPath,
  recommendationPath,
  'npm run verify:release-candidate',
]);

requireIncludes('docs/ROADMAP.md', [
  closeoutPath,
  deferredPath,
  recommendationPath,
]);

requireIncludes('docs/HANDOFF.md', [
  closeoutPath,
  deferredPath,
  recommendationPath,
]);

requireIncludes('docs/OTA_RELEASE.md', [
  'npm run verify:release-candidate',
  closeoutPath,
]);

requireIncludes('README.md', [
  'npm run verify:release-candidate',
  closeoutPath,
]);

const matrixManifest = JSON.parse(read(matrixManifestPath));
const requiredCoverage = {
  today: ['idle', 'running', 'long text', 'degraded assistant', 'missing proof'],
  proofCockpit: ['admin overview', 'long identities', 'degraded health', 'blocker states'],
  coworking: ['floor', 'stage', 'lounge', 'pinned fullscreen', 'permission denied', 'SFU degraded'],
  assistant: ['full Clio panel', 'sidechat', 'confirm modal', 'context drawer'],
  accessibility: ['keyboard path', 'focus rings', 'reduced motion', 'contrast tokens'],
};

for (const [section, terms] of Object.entries(requiredCoverage)) {
  const values = (matrixManifest.coverage?.[section] ?? []).map((value) => String(value).toLowerCase());
  for (const term of terms) {
    if (!values.includes(term.toLowerCase())) {
      fail(`${matrixManifestPath} coverage.${section} must include ${term}.`);
    }
  }
}

const pngCount = walkFiles(matrixRoot).filter((file) => file.endsWith('.png')).length;
if (pngCount < 20) {
  fail(`${matrixRoot} must retain screenshot evidence; expected at least 20 PNGs, found ${pngCount}.`);
}

console.log('[verify:release-candidate] release candidate closeout packet ok');
