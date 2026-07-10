#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flags = new Set(argv);

const HELP = `Plexus OTA release prep

Usage:
  npm run release:ota:prep
  npm run release:ota:prep -- --with-builder --require-clean

Checks:
  - package version and configured generic update feed
  - dirty worktree summary, optionally fail with --require-clean
  - duplicate local and remote version tags
  - public latest-mac.yml feed version
  - local release gates: typecheck, lint, production audit, fuse policy, renderer CSP, release evidence policy, all Vitest suites, all deterministic smokes, renderer build, no-placeholder scan

Flags:
  --with-builder        Also run npm run release:dry-run and inspect release/latest-mac.yml.
  --require-clean       Fail if git status --short is not empty.
  --allow-current-feed  Do not fail when the public feed already serves this package version.
  --skip-gates          Skip local build/lint gates.
  --skip-feed           Skip public latest-mac.yml fetch.
  --skip-remote         Skip remote tag check.
  --help                Show this help.
`;

if (flags.has('--help') || flags.has('-h')) {
  console.log(HELP);
  process.exit(0);
}

function fail(message) {
  console.error(`\n[ota-prep] ${message}`);
  process.exit(1);
}

function commandText(command, args) {
  return [command, ...args].join(' ');
}

function run(command, args, options = {}) {
  const label = options.label ?? commandText(command, args);
  console.log(`\n[ota-prep] ${label}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
  });
  if (result.error) fail(`${label} failed to start: ${result.error.message}`);
  if (!options.allowFailure && result.status !== 0) fail(`${label} exited ${result.status}`);
  return result;
}

function output(command, args, options = {}) {
  const result = run(command, args, { ...options, capture: true, allowFailure: true });
  const stdout = result.stdout?.trim() ?? '';
  const stderr = result.stderr?.trim() ?? '';
  if (!options.allowFailure && result.status !== 0) {
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    fail(`${commandText(command, args)} exited ${result.status}`);
  }
  return { status: result.status ?? 0, stdout, stderr };
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function parseFeedVersion(text) {
  const match = text.match(/^version:\s*["']?([^"'\n]+)["']?\s*$/m);
  return match?.[1]?.trim() ?? null;
}

function compareSemver(a, b) {
  const left = a.split('.').map((part) => Number.parseInt(part, 10));
  const right = b.split('.').map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = Number.isFinite(left[i]) ? left[i] : 0;
    const r = Number.isFinite(right[i]) ? right[i] : 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

async function fetchFeed(feedUrl, currentVersion) {
  console.log(`\n[ota-prep] Fetch OTA feed: ${feedUrl}`);
  const response = await fetch(feedUrl, { cache: 'no-store' });
  if (!response.ok) fail(`OTA feed returned HTTP ${response.status}`);
  const body = await response.text();
  const feedVersion = parseFeedVersion(body);
  if (!feedVersion) fail('OTA feed did not include a version field.');
  console.log(`[ota-prep] Feed version: ${feedVersion}`);

  const comparison = compareSemver(feedVersion, currentVersion);
  if (comparison === 0 && !flags.has('--allow-current-feed')) {
    fail(`Public OTA feed already serves ${currentVersion}. Bump package.json before preparing a new release.`);
  }
  if (comparison > 0) {
    fail(`Public OTA feed (${feedVersion}) is newer than package.json (${currentVersion}). Sync the local checkout first.`);
  }
}

function checkGit(versionTag) {
  const status = output('git', ['status', '--short'], { allowFailure: false }).stdout;
  if (status) {
    console.log('\n[ota-prep] Dirty worktree:');
    console.log(status);
    if (flags.has('--require-clean')) fail('--require-clean was set and the worktree is dirty.');
  } else {
    console.log('\n[ota-prep] Worktree clean.');
  }

  const localTag = output('git', ['rev-parse', '-q', '--verify', `refs/tags/${versionTag}`], { allowFailure: true });
  if (localTag.status === 0) fail(`Local tag ${versionTag} already exists.`);

  if (!flags.has('--skip-remote')) {
    const remoteTag = output('git', ['ls-remote', '--tags', 'origin', `refs/tags/${versionTag}`], { allowFailure: true });
    if (remoteTag.status === 0 && remoteTag.stdout) fail(`Remote tag ${versionTag} already exists on origin.`);
    if (remoteTag.status !== 0) {
      console.warn(`[ota-prep] Remote tag check skipped by git error: ${remoteTag.stderr || `exit ${remoteTag.status}`}`);
    }
  }
}

function runNoPlaceholderScan() {
  console.log('\n[ota-prep] No-placeholder scan');
  run('node', ['scripts/no-placeholder-scan.mjs']);
}

function runLocalGates() {
  run('npm', ['run', 'typecheck']);
  run('npm', ['run', 'lint']);
  run('npm', ['run', 'security:audit:prod']);
  run('npm', ['run', 'verify:fuses']);
  run('npm', ['run', 'verify:csp']);
  run('npm', ['run', 'verify:release-evidence']);
  run('npm', ['run', 'verify:release-candidate']);
  run('npm', ['run', 'test:all']);
  run('npm', ['run', 'smoke:all']);
  run('npm', ['run', 'build:renderer']);
  runNoPlaceholderScan();
}

function runBuilderGate(currentVersion) {
  run('npm', ['run', 'release:dry-run'], {
    env: {
      SKIP_NOTARIZATION: 'true',
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
  });
  const latestPath = path.join(repoRoot, 'release', 'latest-mac.yml');
  const feedText = readFileSync(latestPath, 'utf8');
  const builtVersion = parseFeedVersion(feedText);
  if (builtVersion !== currentVersion) {
    fail(`release/latest-mac.yml reports ${builtVersion ?? 'no version'} instead of ${currentVersion}.`);
  }
  console.log(`[ota-prep] release/latest-mac.yml reports ${builtVersion}.`);
  if (process.platform === 'darwin') {
    run('npm', ['run', 'verify:fuses', '--', '--app', 'auto']);
  } else {
    console.warn('[ota-prep] Packaged .app fuse verification is skipped because this builder is not macOS.');
  }
}

async function main() {
  const pkg = readJson('package.json');
  const currentVersion = pkg.version;
  const versionTag = `v${currentVersion}`;
  const publish = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : null;
  const feedBase = (process.env.PLEXUS_UPDATE_FEED_URL || publish?.url || '').replace(/\/+$/, '');
  const feedUrl = `${feedBase}/latest-mac.yml`;

  if (!currentVersion) fail('package.json has no version.');
  if (!feedBase) fail('package.json build.publish[0].url is missing.');

  console.log(`[ota-prep] Package version: ${currentVersion}`);
  console.log(`[ota-prep] Release tag: ${versionTag}`);
  console.log(`[ota-prep] OTA feed: ${feedBase}`);

  checkGit(versionTag);
  if (!flags.has('--skip-feed')) await fetchFeed(feedUrl, currentVersion);
  if (!flags.has('--skip-gates')) runLocalGates();
  if (flags.has('--with-builder')) runBuilderGate(currentVersion);

  console.log('\n[ota-prep] Ready for the explicit release sequence:');
  console.log(`  git add <release files>`);
  console.log(`  git commit -m "chore(release): ${versionTag}"`);
  console.log(`  git tag ${versionTag}`);
  console.log(`  git push origin main`);
  console.log(`  git push origin ${versionTag}`);
  console.log(`  gh run list --workflow Release --limit 5`);
  console.log(`  curl -fsSL ${feedUrl}`);
}

main().catch((error) => fail(error?.message ?? String(error)));
