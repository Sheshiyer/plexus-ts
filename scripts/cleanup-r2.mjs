import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Deliberately pin the migration destination; never clean the legacy account.
const ACCOUNT = '9d7cec1b5a32b2df8c6cdc1321ccd00b';
const BUCKET = 'plexus-updates';
const STABLE = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)';
const VERSION = `${STABLE}(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?`;
const immutableManifest = new RegExp(`^plexus/Plexus-${VERSION}-mac-arm64\\.yml$`);
const fail = message => { throw new Error(message); };

export function immutableKeys(version) {
  if (typeof version !== 'string' || version.trim() !== version || !new RegExp(`^${STABLE}$`).test(version)) {
    fail('CLEANUP_VERSION must be stable X.Y.Z semver.');
  }
  return ['dmg', 'zip', 'zip.blockmap', 'dmg.blockmap', 'yml']
    .map(extension => `plexus/Plexus-${version}-mac-arm64.${extension}`);
}

// Accept only the electron-builder manifest subset we can fully validate.
// Unsupported YAML fails closed instead of silently losing artifact references.
export function manifestVersion(body) {
  const top = {}, files = [];
  let file = null, inFiles = false;
  const scalar = raw => {
    if (/^'[^']*'$|^"[^"\\]*"$/.test(raw)) return raw.slice(1, -1);
    if (/^[A-Za-z0-9][A-Za-z0-9._/+:-]*={0,2}$/.test(raw)) return raw;
    fail('Unsupported manifest scalar.');
  };
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    let match = line.match(/^(version|path|sha512|releaseDate): (.+)$/);
    if (match) {
      if (Object.hasOwn(top, match[1])) fail('Duplicate manifest metadata.');
      top[match[1]] = scalar(match[2]);
      inFiles = false;
    } else if (line === 'files:') {
      if (Object.hasOwn(top, 'files')) fail('Duplicate manifest files.');
      top.files = true;
      inFiles = true;
    } else if (inFiles && (match = line.match(/^ {2}- url: (.+)$/))) {
      file = { url: scalar(match[1]) };
      files.push(file);
    } else if (inFiles && file && (match = line.match(/^ {4}(sha512|size|blockMapSize): (.+)$/))) {
      if (Object.hasOwn(file, match[1])) fail('Duplicate artifact metadata.');
      file[match[1]] = scalar(match[2]);
    } else {
      fail('Malformed or unsupported channel manifest.');
    }
  }
  if (!new RegExp(`^${VERSION}$`).test(top.version ?? '') || !files.length) fail('Manifest version/files missing or invalid.');
  const expected = new Set(['dmg', 'zip'].map(ext => `Plexus-${top.version}-mac-arm64.${ext}`));
  const sha = value => /^[A-Za-z0-9+/]{86}==$/.test(value ?? '');
  const seen = new Set();
  for (const entry of files) {
    if (!expected.has(entry.url) || seen.has(entry.url) || !sha(entry.sha512) ||
        !/^[1-9]\d*$/.test(entry.size ?? '') || !Number.isSafeInteger(Number(entry.size))) {
      fail('Manifest artifact metadata invalid or outside the arm64 filename contract.');
    }
    seen.add(entry.url);
  }
  if (!sha(top.sha512) || !files.some(entry => entry.url === top.path && entry.sha512 === top.sha512)) {
    fail('Manifest primary artifact metadata missing or inconsistent.');
  }
  return top.version;
}

export function cleanup({ env = process.env, execute = false, runner = spawnSync, log = console.log } = {}) {
  const keys = immutableKeys(env.CLEANUP_VERSION);
  // Retain documented recovery baselines, the destination migration baseline,
  // and the source installed release even after active channel pointers move.
  const protectedVersions = new Set(['0.5.2', '0.7.1', '0.7.8', '0.7.12']);
  if (env.CLEANUP_PROTECTED_VERSIONS) {
    for (const raw of env.CLEANUP_PROTECTED_VERSIONS.split(',')) {
      const version = raw.trim();
      immutableKeys(version);
      protectedVersions.add(version);
    }
  }
  if (protectedVersions.has(env.CLEANUP_VERSION)) fail('Requested version is protected for rollback.');
  for (const name of ['OTA_R2_ACCESS_KEY_ID', 'OTA_R2_SECRET_ACCESS_KEY', 'OTA_R2_ACCOUNT_ID', 'OTA_R2_BUCKET']) {
    if (!env[name]?.trim() || env[name] !== env[name].trim()) fail(`Missing or invalid ${name}.`);
  }
  if (env.OTA_R2_ACCOUNT_ID !== ACCOUNT || env.OTA_R2_BUCKET !== BUCKET) {
    fail('Cleanup requires the pinned Thoughtseed Labs account and plexus-updates bucket.');
  }
  const awsEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('AWS_')));
  Object.assign(awsEnv, {
    AWS_ACCESS_KEY_ID: env.OTA_R2_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: env.OTA_R2_SECRET_ACCESS_KEY,
    AWS_DEFAULT_REGION: 'auto', AWS_EC2_METADATA_DISABLED: 'true',
    AWS_CONFIG_FILE: '/dev/null', AWS_SHARED_CREDENTIALS_FILE: '/dev/null', AWS_PAGER: '',
  });
  const aws = args => {
    const result = runner('aws', [...args, '--endpoint-url', `https://${ACCOUNT}.r2.cloudflarestorage.com`], {
      env: awsEnv, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
    });
    // Do not echo raw CLI errors, which may include sensitive request details.
    if (result.error || result.status !== 0) fail(`AWS ${args[0]} ${args[1]} failed; cleanup stopped.`);
    return result.stdout;
  };
  const channels = new Set(['plexus/latest-mac.yml']);
  let token;
  const tokens = new Set();
  do {
    const args = ['s3api', 'list-objects-v2', '--bucket', BUCKET, '--prefix', 'plexus/', '--no-paginate', '--output', 'json'];
    if (token) args.push('--continuation-token', token);
    const page = JSON.parse(aws(args));
    if (typeof page.IsTruncated !== 'boolean' || !Array.isArray(page.Contents ?? [])) fail('Invalid object inventory.');
    for (const object of page.Contents ?? []) {
      if (typeof object.Key !== 'string' || !object.Key.startsWith('plexus/')) fail('Invalid inventory object key.');
      if (/\.ya?ml$/i.test(object.Key) && !immutableManifest.test(object.Key)) channels.add(object.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && (typeof token !== 'string' || !token || tokens.has(token) || tokens.size >= 100)) {
      fail('Incomplete or looping object inventory.');
    }
    tokens.add(token);
  } while (token);
  // Inventory every mutable YAML feed, including beta/canary/custom channels.
  // All publishers must share the workflow concurrency lock during execution.
  for (const key of channels) {
    if (!/^plexus\/[a-z][a-z0-9-]*\.yml$/.test(key)) fail('Unrecognized mutable channel manifest; manual review required.');
    const version = manifestVersion(aws(['s3', 'cp', `s3://${BUCKET}/${key}`, '-']));
    protectedVersions.add(version);
  }
  if (protectedVersions.has(env.CLEANUP_VERSION)) fail('Requested version is referenced by an active channel.');
  for (const key of keys) log(`${execute ? 'DELETE' : 'PLAN'} s3://${BUCKET}/${key}`);
  if (execute) for (const key of keys) aws(['s3api', 'delete-object', '--bucket', BUCKET, '--key', key]);
  log(execute ? 'Cleanup completed.' : 'Plan only: no objects deleted. Use --execute to delete.');
  return keys;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--execute')) fail('Usage: node scripts/cleanup-r2.mjs [--execute]');
    cleanup({ execute: args[0] === '--execute' });
  } catch (error) {
    console.error(`[cleanup-r2] ${error.message}`);
    process.exitCode = 1;
  }
}
