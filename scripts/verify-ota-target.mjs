#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ACTIVE_LEGACY_OTA_TARGET = Object.freeze({
  accountId: '9d9d23b27f32e70ae3afb6a1aa2c0f10',
  bucket: 'plexus-updates',
  publicManifestUrl: 'https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus/latest-mac.yml',
});

function fail(message) {
  throw new Error(`[verify:ota-target] ${message}`);
}

function required(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') fail(`Missing ${name}.`);
  return value;
}

export function assertActiveLegacyTarget({ accountId, bucket }) {
  if (accountId !== ACTIVE_LEGACY_OTA_TARGET.accountId) {
    fail('Configured R2 account is not the account behind the pinned active OTA feed.');
  }
  if (bucket !== ACTIVE_LEGACY_OTA_TARGET.bucket) {
    fail('Configured R2 bucket is not the bucket behind the pinned active OTA feed.');
  }
}

export function assertMatchingManifests(targetManifest, publicManifest) {
  const target = Buffer.from(targetManifest);
  const publicBody = Buffer.from(publicManifest);
  if (!/^version:\s+\d+\.\d+\.\d+\s*$/m.test(target.toString('utf8'))) {
    fail('Configured R2 target did not return a stable OTA manifest.');
  }
  if (!target.equals(publicBody)) {
    fail('Configured R2 target manifest does not match the pinned public OTA feed.');
  }
}

function safeAwsEnvironment(env, credentials) {
  return {
    PATH: env.PATH,
    HOME: env.HOME,
    TMPDIR: env.TMPDIR,
    LANG: env.LANG,
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_DEFAULT_REGION: 'auto',
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
  };
}

export async function verifyOtaTarget({
  env = process.env,
  runner = spawnSync,
  fetchImpl = fetch,
  tempDirectory = tmpdir(),
  now = Date.now,
} = {}) {
  const accountId = required(env, 'OTA_R2_ACCOUNT_ID');
  const bucket = required(env, 'OTA_R2_BUCKET');
  const accessKeyId = required(env, 'OTA_R2_ACCESS_KEY_ID');
  const secretAccessKey = required(env, 'OTA_R2_SECRET_ACCESS_KEY');
  assertActiveLegacyTarget({ accountId, bucket });

  const directory = mkdtempSync(path.join(tempDirectory, 'plexus-ota-target-'));
  const targetManifestPath = path.join(directory, 'latest-mac.yml');
  try {
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const result = runner('aws', [
      's3', 'cp', `s3://${bucket}/plexus/latest-mac.yml`, targetManifestPath,
      '--endpoint-url', endpoint, '--no-progress',
    ], {
      encoding: 'utf8',
      env: safeAwsEnvironment(env, { accessKeyId, secretAccessKey }),
      shell: false,
    });
    if (result.error || result.status !== 0) {
      fail('Unable to read the configured R2 target manifest.');
    }

    const publicUrl = new URL(ACTIVE_LEGACY_OTA_TARGET.publicManifestUrl);
    publicUrl.searchParams.set('target-mapping', String(now()));
    const response = await fetchImpl(publicUrl, { headers: { 'cache-control': 'no-cache' } });
    if (!response.ok) fail(`Pinned public OTA manifest returned HTTP ${response.status}.`);

    const targetManifest = readFileSync(targetManifestPath);
    const publicManifest = Buffer.from(await response.arrayBuffer());
    assertMatchingManifests(targetManifest, publicManifest);
    return createHash('sha256').update(targetManifest).digest('hex');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const manifestSha256 = await verifyOtaTarget();
    console.log(`[verify:ota-target] configured R2 target matches active public manifest (${manifestSha256}).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
