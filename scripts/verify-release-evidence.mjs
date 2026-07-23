#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`[verify:release-evidence] ${message}`);
  process.exit(1);
}

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function includes(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

const pkg = JSON.parse(read('package.json'));
const scripts = pkg.scripts ?? {};
const ci = read('.github/workflows/ci.yml');
const release = read('.github/workflows/release.yml');
const publishOta = read('.github/workflows/publish-ota.yml');
const releaseEvidence = read('docs/RELEASE_EVIDENCE.md');
const auditWaivers = read('docs/SECURITY_AUDIT_WAIVERS.md');
const ota = read('docs/OTA_RELEASE.md');

const requiredScripts = [
  'security:audit:prod',
  'security:audit:release',
  'smoke:all',
  'verify:csp',
  'verify:fuses',
  'verify:release-architecture',
  'verify:release-evidence',
  'verify:release-candidate',
  'verify:all',
];

for (const name of requiredScripts) {
  if (!scripts[name]) fail(`package.json is missing script ${name}.`);
}

if (!scripts['release:mac']?.includes('npm run verify:release-architecture')) {
  fail('release:mac must verify the packaged macOS architecture.');
}

for (const command of [
  'npm run security:audit:prod',
  'npm run security:audit:release',
  'npm run verify:csp',
  'npm run verify:release-evidence',
  'npm run verify:release-candidate',
  'npm run smoke:all',
]) {
  if (!scripts['verify:all'].includes(command)) fail(`verify:all must include ${command}.`);
  if (!ci.includes(command)) fail(`CI workflow must include ${command}.`);
  if (!release.includes(command)) fail(`Release Candidate workflow must include ${command}.`);
  if (!publishOta.includes(command)) fail(`Publish OTA workflow must include ${command}.`);
}

if (release.includes('secrets.') || release.includes('contents: write')) {
  fail('Release Candidate must not receive repository secrets or write permission.');
}
for (const required of [
  'workflow_run:',
  'Release Candidate',
  'head_repository.full_name == github.repository',
  'git merge-base --is-ancestor',
  'environment: ota-production',
  "--if-none-match '*'",
  'Publish OTA manifest to Cloudflare R2',
  'Verify public OTA release',
]) {
  if (!publishOta.includes(required)) fail(`Publish OTA workflow must include: ${required}.`);
}

if (scripts['smoke:all'].includes('smoke:admin-fabric-paperclip')) {
  fail('smoke:all must stay deterministic and must not call smoke:admin-fabric-paperclip.');
}

for (const required of [
  'Binary Production-Ready Gate',
  'docs/SECURITY_AUDIT_WAIVERS.md',
  'npm run verify:all',
  'npm run smoke:all',
  'npm run security:audit:prod',
  'npm run verify:csp',
  'npm run verify:fuses',
  'main CI',
  'Release Candidate workflow',
  'Publish OTA workflow',
  'signed OTA',
  'screenshots',
  'secret custody',
  'Electron fuses',
  'production dependency audit',
  'renderer CSP',
  'release-candidate closeout',
  'protected `ota-production`',
]) {
  if (!includes(releaseEvidence, required)) fail(`docs/RELEASE_EVIDENCE.md must mention: ${required}.`);
}

for (const required of [
  'production dependency audit',
  'release-chain audit',
  'electron',
  'electron-builder',
  'zero vulnerabilities',
]) {
  if (!includes(auditWaivers, required)) fail(`docs/SECURITY_AUDIT_WAIVERS.md must mention: ${required}.`);
}

for (const screenshotState of [
  'Employee Clio Today command center',
  'Founder/operator proof cockpit',
  'Clio assistant context',
  'Co-working lobby',
  'Degraded/offline states',
  'Settings update panel',
]) {
  if (!includes(releaseEvidence, screenshotState)) {
    fail(`docs/RELEASE_EVIDENCE.md must require screenshot state: ${screenshotState}.`);
  }
}

if (!ota.includes('docs/RELEASE_EVIDENCE.md')) {
  fail('docs/OTA_RELEASE.md must link to docs/RELEASE_EVIDENCE.md.');
}

if (!ota.includes('npm run verify:release-candidate')) {
  fail('docs/OTA_RELEASE.md must mention npm run verify:release-candidate.');
}

console.log('[verify:release-evidence] release evidence policy ok');
