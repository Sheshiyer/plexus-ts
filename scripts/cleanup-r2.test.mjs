import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { cleanup, immutableKeys, manifestVersion } from './cleanup-r2.mjs';

const baseEnv = {
  OTA_R2_ACCOUNT_ID: '9d7cec1b5a32b2df8c6cdc1321ccd00b', OTA_R2_BUCKET: 'plexus-updates',
  OTA_R2_ACCESS_KEY_ID: 'fake-key', OTA_R2_SECRET_ACCESS_KEY: 'fake-secret', CLEANUP_VERSION: '0.7.9',
};
const sha = Buffer.alloc(64).toString('base64');
const manifest = (version = '0.7.12') => `version: ${version}
files:
  - url: Plexus-${version}-mac-arm64.zip
    sha512: ${sha}
    size: 123
  - url: Plexus-${version}-mac-arm64.dmg
    sha512: ${sha}
    size: 456
path: Plexus-${version}-mac-arm64.zip
sha512: ${sha}
releaseDate: '2026-09-05T12:00:00.000Z'
`;
function fixture({ feeds = { 'plexus/latest-mac.yml': manifest() }, pages, failOperation, badBody } = {}) {
  const calls = [], logs = [];
  let pageIndex = 0;
  const runner = (command, args, options) => {
    calls.push({ command, args, options });
    if (args[1] === failOperation) return { status: 1, stderr: 'SENSITIVE upstream error' };
    if (args[1] === 'list-objects-v2') return {
      status: 0, stdout: badBody ?? JSON.stringify(pages?.[pageIndex++] ?? {
        IsTruncated: false, Contents: Object.keys(feeds).map(Key => ({ Key })),
      }),
    };
    if (args[1] === 'cp') {
      const key = args[2].replace('s3://plexus-updates/', '');
      return Object.hasOwn(feeds, key) ? { status: 0, stdout: feeds[key] } : { status: 1 };
    }
    assert.equal(args[1], 'delete-object');
    return { status: 0, stdout: '{}' };
  };
  return { calls, logs, run: options => cleanup({ env: baseEnv, runner, log: line => logs.push(line), ...options }) };
}
const deletions = f => f.calls.filter(call => call.args[1] === 'delete-object');

test('defaults to a plan with five exact versioned arm64 keys and zero deletes', () => {
  const f = fixture();
  assert.deepEqual(f.run(), ['dmg', 'zip', 'zip.blockmap', 'dmg.blockmap', 'yml']
    .map(extension => `plexus/Plexus-0.7.9-mac-arm64.${extension}`));
  assert.equal(deletions(f).length, 0);
  assert.match(f.logs.at(-1), /Plan only/);
});

test('rejects unstable, path, shell, whitespace, leading-zero, and empty version inputs before AWS', () => {
  for (const version of [undefined, '', 'v0.7.9', '01.7.9', '0.7.9-beta.1', '0.7.9+build', '../x', '0.7.9;id', '$(id)', '0.7.9\n', ' 0.7.9']) {
    const f = fixture();
    assert.throws(() => f.run({ env: { ...baseEnv, CLEANUP_VERSION: version } }), /stable X.Y.Z/);
    assert.equal(f.calls.length, 0);
  }
});

test('built-in and configurable rollback versions cannot be deleted', () => {
  for (const env of [
    ...['0.5.2', '0.7.1', '0.7.8', '0.7.12'].map(CLEANUP_VERSION => ({ CLEANUP_VERSION })),
    { CLEANUP_PROTECTED_VERSIONS: '0.7.8, 0.7.9' },
  ]) {
    const f = fixture();
    assert.throws(() => f.run({ env: { ...baseEnv, ...env }, execute: true }), /protected for rollback/);
    assert.equal(f.calls.length, 0);
  }
  assert.throws(() => fixture().run({ env: { ...baseEnv, CLEANUP_PROTECTED_VERSIONS: '0.7.8,' } }), /stable X.Y.Z/);
});

test('documented 0.7.1 rollback remains protected with Labs latest at 0.7.8 and no extra protection', () => {
  const f = fixture({ feeds: { 'plexus/latest-mac.yml': manifest('0.7.8') } });
  assert.throws(() => f.run({ env: { ...baseEnv, CLEANUP_VERSION: '0.7.1' }, execute: true }), /protected for rollback/);
  assert.equal(f.calls.length, 0);
});

test('requires every OTA credential and pinned destination; legacy AWS configuration cannot substitute', () => {
  for (const key of ['OTA_R2_ACCOUNT_ID', 'OTA_R2_BUCKET', 'OTA_R2_ACCESS_KEY_ID', 'OTA_R2_SECRET_ACCESS_KEY']) {
    for (const value of ['', ' ']) {
      const f = fixture();
      assert.throws(() => f.run({ env: { ...baseEnv, [key]: value, AWS_ACCESS_KEY_ID: 'legacy', R2_ACCESS_KEY_ID: 'legacy' } }), /Missing or invalid/);
      assert.equal(f.calls.length, 0);
    }
  }
  for (const env of [{ OTA_R2_ACCOUNT_ID: '9d9d23b27f32e70ae3afb6a1aa2c0f10' }, { OTA_R2_BUCKET: 'another-bucket' }]) {
    const f = fixture();
    assert.throws(() => f.run({ env: { ...baseEnv, ...env } }), /pinned Thoughtseed Labs/);
    assert.equal(f.calls.length, 0);
  }
});

test('AWS receives only dedicated credentials and same pinned endpoint/bucket on every call', () => {
  const f = fixture();
  f.run({ execute: true, env: { ...baseEnv, AWS_PROFILE: 'legacy', AWS_SESSION_TOKEN: 'legacy', AWS_ENDPOINT_URL: 'https://legacy.test' } });
  for (const { command, args, options } of f.calls) {
    assert.equal(command, 'aws');
    assert.deepEqual(args.slice(-2), ['--endpoint-url', `https://${baseEnv.OTA_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`]);
    assert.ok(args.includes('plexus-updates') || args.some(arg => arg.startsWith('s3://plexus-updates/')));
    assert.equal(options.env.AWS_ACCESS_KEY_ID, 'fake-key');
    assert.equal(options.env.AWS_SECRET_ACCESS_KEY, 'fake-secret');
    for (const key of ['AWS_PROFILE', 'AWS_SESSION_TOKEN', 'AWS_ENDPOINT_URL']) assert.equal(options.env[key], undefined);
    assert.equal(options.env.AWS_SHARED_CREDENTIALS_FILE, '/dev/null');
    assert.equal(options.shell, undefined);
  }
});

test('all active channel versions are protected, including beta/canary and later inventory pages', () => {
  for (const channel of ['latest-mac', 'beta-mac', 'canary-mac', 'custom-mac']) {
    const f = fixture({ feeds: { 'plexus/latest-mac.yml': manifest(), [`plexus/${channel}.yml`]: manifest('0.7.9') }, pages: [
      { IsTruncated: true, NextContinuationToken: 'page-2', Contents: [{ Key: 'plexus/latest-mac.yml' }] },
      { IsTruncated: false, Contents: [{ Key: `plexus/${channel}.yml` }] },
    ] });
    assert.throws(() => f.run({ execute: true }), /active channel/);
    assert.equal(deletions(f).length, 0);
    assert.ok(f.calls[1].args.includes('page-2'));
  }
});

test('prerelease channel manifests are inspected without preventing unrelated stable cleanup', () => {
  const f = fixture({ feeds: { 'plexus/latest-mac.yml': manifest(), 'plexus/beta-mac.yml': manifest('0.8.0-beta.1') } });
  f.run();
  assert.equal(f.calls.filter(call => call.args[1] === 'cp').length, 2);
});

test('missing latest, unreadable channels, malformed YAML, and mismatched artifacts fail before deletes', () => {
  const malformed = ['', 'version: 0.7.12', manifest() + 'version: 0.7.13\n', manifest().replace('size: 123', 'size: 0'),
    manifest().replace('path: Plexus', 'path: ../Plexus'), manifest().replace('version: 0.7.12', 'version: 0.7.13'),
    manifest().replace(`sha512: ${sha}`, 'sha512: bad'), manifest().replace('files:', 'files: &anchor')];
  for (const body of malformed) {
    const f = fixture({ feeds: { 'plexus/latest-mac.yml': body } });
    assert.throws(() => f.run({ execute: true }));
    assert.equal(deletions(f).length, 0);
  }
  const missing = fixture({ feeds: {} });
  assert.throws(() => missing.run({ execute: true }), /AWS s3 cp failed/);
  assert.equal(deletions(missing).length, 0);
  const unreadable = fixture({ failOperation: 'cp' });
  assert.throws(() => unreadable.run({ execute: true }), /AWS s3 cp failed/);
  assert.equal(deletions(unreadable).length, 0);
});

test('invalid, incomplete, looping, or inaccessible inventory fails closed', () => {
  for (const options of [{ badBody: '{' }, { pages: [{}] }, { pages: [{ IsTruncated: true }] },
    { pages: [{ IsTruncated: true, NextContinuationToken: 'x' }, { IsTruncated: true, NextContinuationToken: 'x' }] },
    { pages: [{ IsTruncated: false, Contents: [{ Key: 'other/latest-mac.yml' }] }] }, { failOperation: 'list-objects-v2' }]) {
    const f = fixture(options);
    assert.throws(() => f.run({ execute: true }));
    assert.equal(deletions(f).length, 0);
  }
});

test('unrecognized or nested mutable manifests require review; immutable manifests are never read as channels', () => {
  for (const key of ['plexus/nested/latest-mac.yml', 'plexus/beta-mac.yaml', 'plexus/Unknown.yml']) {
    const f = fixture({ feeds: { 'plexus/latest-mac.yml': manifest(), [key]: manifest() } });
    assert.throws(() => f.run({ execute: true }), /Unrecognized mutable/);
    assert.equal(deletions(f).length, 0);
  }
  const f = fixture({ feeds: { 'plexus/latest-mac.yml': manifest(), 'plexus/Plexus-0.7.9-mac-arm64.yml': 'historical' } });
  f.run();
  assert.equal(f.calls.filter(call => call.args[1] === 'cp').length, 1);
});

test('execution deletes only exact immutable keys, after every channel was checked', () => {
  const f = fixture({ feeds: { 'plexus/latest-mac.yml': manifest(), 'plexus/beta-mac.yml': manifest('0.8.0-beta.1') } });
  f.run({ execute: true });
  assert.deepEqual(deletions(f).map(call => call.args[call.args.indexOf('--key') + 1]), immutableKeys('0.7.9'));
  assert.equal(f.calls.findIndex(call => call.args[1] === 'delete-object'), 3);
  assert.ok(f.calls.every(call => !call.args.includes('--recursive') && !call.args.includes('delete-objects')));
});

test('deletion and runner failures stop immediately without leaking raw diagnostics', () => {
  const f = fixture({ failOperation: 'delete-object' });
  assert.throws(() => f.run({ execute: true }), error => /delete-object failed/.test(error.message) && !error.message.includes('SENSITIVE'));
  assert.equal(deletions(f).length, 1);
  assert.throws(() => cleanup({ env: baseEnv, runner: () => ({ status: null, error: new Error('SENSITIVE') }) }), /AWS s3api list-objects-v2 failed/);
});

test('CLI needs explicit --execute and returns nonzero on deletion failure with a fake AWS executable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'plexus-cleanup-test-'));
  try {
    writeFileSync(join(directory, 'aws'), `#!${process.execPath}\nconst op = process.argv[3];\nif (op === 'list-objects-v2') console.log(JSON.stringify({IsTruncated:false,Contents:[]}));\nelse if (op === 'cp') process.stdout.write(${JSON.stringify(manifest())});\nelse process.exit(9);\n`, { mode: 0o755 });
    const env = { ...baseEnv, PATH: directory };
    const script = new URL('./cleanup-r2.mjs', import.meta.url).pathname;
    const plan = spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
    assert.equal(plan.status, 0, plan.stderr);
    assert.match(plan.stdout, /Plan only/);
    const execute = spawnSync(process.execPath, [script, '--execute'], { env, encoding: 'utf8' });
    assert.equal(execute.status, 1);
    assert.match(execute.stderr, /delete-object failed/);
    const unknown = spawnSync(process.execPath, [script, '--force'], { env, encoding: 'utf8' });
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /Usage:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('manifest parser rejects duplicate files and incomplete primary metadata', () => {
  assert.equal(manifestVersion(manifest()), '0.7.12');
  for (const body of [manifest() + 'files:\n', manifest().replace(/^path:.*\n/m, ''),
    manifest().replace('size: 123', 'size: 9007199254740992'), manifest().replace('size: 123', `size: 123\n    sha512: ${sha}`)]) {
    assert.throws(() => manifestVersion(body));
  }
});
