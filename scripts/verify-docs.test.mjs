import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const verifier = fileURLToPath(new URL('./verify-docs.mjs', import.meta.url));
const feed = 'https://example.invalid/plexus';
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'plexus-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  };
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  put('scripts/.keep', '');
  copyFileSync(verifier, path.join(root, 'scripts/verify-docs.mjs'));
  put('docs/documentation-policy.json', { current: ['README.md'], routes: [
    { pattern: '^(docs/|ISA.md$|\\.planning/)', role: 'Current guidance' },
  ] });
  put('README.md', '[Guide](docs/OTA_RELEASE.md)\n');
  put('docs/DOCUMENTATION_MAP.md', '# Map\n');
  put('docs/OTA_RELEASE.md', `## Runtime Feed\n\nCurrent source pin:\n\n\`\`\`text\n${feed}\n\`\`\`\n`);
  put('package.json', { scripts: { 'verify:docs': 'node scripts/verify-docs.mjs', 'docs:refresh': 'node scripts/verify-docs.mjs --write', 'test:docs': 'node --test scripts/verify-docs.test.mjs', 'test:release-ops': 'node --test scripts/cleanup-r2.test.mjs' }, version: '1.0.0', build: { publish: [{ url: feed }] } });
  put('package-lock.json', { version: '1.0.0', packages: { '': { version: '1.0.0' } } });
  put('src/main/updates.ts', `const DEFAULT_FEED_URL = '${feed}';\n`);
  put('ISA.md', '---\nprogress: 1/2\n---\n- [x] ISC-1: Done\n- [ ] ISC-2: Pending\n');
  put('.planning/STATE.md', 'Phase: P6-labs-migration-acceptance\n');
  put('.planning/NEXT-WAVE.json', { current_phase: 'P6' });
  put('.github/workflows/ci.yml', 'name: CI\non: push\njobs:\n  docs:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm run verify:docs\n      - run: npm run test:release-ops\n      - run: npm run test:docs\n');
  const run = (...args) => {
    const result = spawnSync(process.execPath, ['scripts/verify-docs.mjs', '--report', ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    return { status: result.status, report: JSON.parse(result.stdout) };
  };
  assert.equal(run('--write').status, 0, 'valid fixture must pass');
  return { put, run };
}

test('rejects broken current links and ignores examples inside fenced code', t => {
  const { put, run } = fixture(t);
  put('README.md', '```md\n[Example](missing.md)\n```\n');
  assert.equal(run().status, 0);
  put('README.md', '[Missing](missing.md)\n');
  assert.match(run().report.errors.join('\n'), /missing local target missing.md/);
});

test('detects stale catalog and unclassified documents', t => {
  const { put, run } = fixture(t);
  put('new-guide.md', '# New guide\n');
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.report.errors.join('\n'), /catalog is stale/);
  assert.match(result.report.errors.join('\n'), /Unclassified document: new-guide.md/);
});

test('rejects stale ISA counts and duplicate criterion IDs', t => {
  const { put, run } = fixture(t);
  put('ISA.md', 'progress: 1/2\n- [x] ISC-1: Done\n- [x] ISC-1: Duplicate\n');
  assert.match(run().report.errors.join('\n'), /IDs are duplicated/);
  assert.match(run().report.errors.join('\n'), /progress does not match/);
});

test('rejects competing active phases and phase drift', t => {
  const { put, run } = fixture(t);
  put('.planning/STATE.md', 'Phase: P6-labs\nPhase: P5-old\n');
  assert.equal(run().status, 1);
  put('.planning/STATE.md', 'Phase: P5-old\n');
  assert.match(run().report.errors.join('\n'), /one current phase/);
});

test('historical feed mentions cannot mask a wrong active feed', t => {
  const { put, run } = fixture(t);
  put('docs/OTA_RELEASE.md', `## Runtime Feed\n\n\`\`\`text\nhttps://wrong.invalid/feed\n\`\`\`\n\n## History\n\n\`\`\`text\n${feed}\n\`\`\`\n`);
  assert.match(run().report.errors.join('\n'), /exact current source feed/);
});

test('detects packaging, version and CI drift', t => {
  const { put, run } = fixture(t);
  put('package.json', { version: '2.0.0', build: { publish: [{ url: 'https://wrong.invalid' }] } });
  put('.github/workflows/ci.yml', 'npm run lint\n');
  const errors = run().report.errors.join('\n');
  assert.match(errors, /lock versions diverge/);
  assert.match(errors, /packaging feed pins diverge/);
  assert.match(errors, /CI must run npm run verify:docs/);
});


test('comments, no-op package scripts and empty ISA cannot supply proof', t => {
  const { put, run } = fixture(t);
  put('.github/workflows/ci.yml', '# run: npm run verify:docs\n# run: npm run test:release-ops\n# run: npm run test:docs\n');
  put('package.json', { version: '1.0.0', build: { publish: [{ url: feed }] }, scripts: { 'verify:docs': 'echo ok' } });
  put('ISA.md', 'progress: 0/0\n');
  const errors = run().report.errors.join('\n');
  assert.match(errors, /CI must run npm run verify:docs/);
  assert.match(errors, /Package script verify:docs must invoke/);
  assert.match(errors, /ISA must contain acceptance criteria/);
});
