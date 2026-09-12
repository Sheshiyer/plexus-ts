import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  ACTIVE_LEGACY_OTA_TARGET,
  assertActiveLegacyTarget,
  assertMatchingManifests,
  verifyOtaTarget,
} from './verify-ota-target.mjs';

const manifest = Buffer.from("version: 0.7.12\nfiles:\n  - url: Plexus-0.7.12-mac-arm64.zip\n");
const baseEnv = {
  OTA_R2_ACCOUNT_ID: ACTIVE_LEGACY_OTA_TARGET.accountId,
  OTA_R2_BUCKET: ACTIVE_LEGACY_OTA_TARGET.bucket,
  OTA_R2_ACCESS_KEY_ID: 'test-access-key',
  OTA_R2_SECRET_ACCESS_KEY: 'test-secret-key',
  PATH: process.env.PATH,
  HOME: process.env.HOME,
};

test('accepts only the R2 account and bucket behind the active public feed', () => {
  assert.doesNotThrow(() => assertActiveLegacyTarget({
    accountId: ACTIVE_LEGACY_OTA_TARGET.accountId,
    bucket: ACTIVE_LEGACY_OTA_TARGET.bucket,
  }));
  for (const target of [
    { accountId: '9d7cec1b5a32b2df8c6cdc1321ccd00b', bucket: ACTIVE_LEGACY_OTA_TARGET.bucket },
    { accountId: ACTIVE_LEGACY_OTA_TARGET.accountId, bucket: 'another-bucket' },
  ]) {
    assert.throws(() => assertActiveLegacyTarget(target), /pinned active OTA feed/);
  }
});

test('rejects a public manifest that differs from the configured target', () => {
  assert.doesNotThrow(() => assertMatchingManifests(manifest, manifest));
  assert.throws(
    () => assertMatchingManifests(manifest, Buffer.from('version: 0.7.8\n')),
    /does not match the pinned public OTA feed/,
  );
  assert.throws(
    () => assertMatchingManifests(Buffer.from('not a manifest'), Buffer.from('not a manifest')),
    /did not return a stable OTA manifest/,
  );
});

test('uses scoped credentials and compares private and public manifest bytes before release', async () => {
  const tempDirectory = mkdtempSync(path.join(tmpdir(), 'plexus-ota-target-test-'));
  const calls = [];
  const digest = await verifyOtaTarget({
    env: { ...baseEnv, AWS_PROFILE: 'wrong-account', AWS_SESSION_TOKEN: 'wrong-session' },
    tempDirectory,
    now: () => 123,
    runner(command, args, options) {
      calls.push({ command, args, options });
      writeFileSync(args[3], manifest);
      return { status: 0, stdout: '', stderr: '' };
    },
    async fetchImpl(url) {
      assert.equal(url.searchParams.get('target-mapping'), '123');
      return new Response(manifest, { status: 200 });
    },
  });
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'aws');
  assert.deepEqual(calls[0].args.slice(0, 3), ['s3', 'cp', 's3://plexus-updates/plexus/latest-mac.yml']);
  assert.equal(calls[0].options.env.AWS_ACCESS_KEY_ID, 'test-access-key');
  assert.equal(calls[0].options.env.AWS_SECRET_ACCESS_KEY, 'test-secret-key');
  assert.equal(calls[0].options.env.AWS_PROFILE, undefined);
  assert.equal(calls[0].options.env.AWS_SESSION_TOKEN, undefined);
  assert.equal(calls[0].options.shell, false);
  assert.throws(() => readFileSync(tempDirectory));
});

test('fails closed before an R2 read when credentials or target are invalid', async () => {
  for (const env of [
    { ...baseEnv, OTA_R2_ACCESS_KEY_ID: '' },
    { ...baseEnv, OTA_R2_ACCOUNT_ID: '9d7cec1b5a32b2df8c6cdc1321ccd00b' },
  ]) {
    let calls = 0;
    await assert.rejects(
      verifyOtaTarget({
        env,
        runner() { calls += 1; return { status: 0 }; },
      }),
    );
    assert.equal(calls, 0);
  }
});
