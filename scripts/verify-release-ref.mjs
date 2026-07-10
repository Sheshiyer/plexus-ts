#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
    values.set(arg.slice(2), value);
    index += 1;
  }
  return values;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function requireStableVersion(value, label) {
  const version = String(value ?? '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${label} must be a stable x.y.z version; received ${version || 'empty'}.`);
  }
  return version;
}

function compareVersions(left, right) {
  const a = requireStableVersion(left, 'Candidate version').split('.').map(Number);
  const b = requireStableVersion(right, 'Public feed version').split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function releaseMetadata(repoRoot) {
  const pkg = readJson(path.join(repoRoot, 'package.json'));
  const lock = readJson(path.join(repoRoot, 'package-lock.json'));
  const version = requireStableVersion(pkg.version, 'package.json version');
  const lockVersion = requireStableVersion(lock.version, 'package-lock.json version');
  const lockRootVersion = requireStableVersion(lock.packages?.['']?.version, 'package-lock.json root package version');
  if (lockVersion !== version) {
    throw new Error(`package-lock.json version ${lockVersion} does not match package.json ${version}.`);
  }
  if (lockRootVersion !== version) {
    throw new Error(`package-lock.json root package version ${lockRootVersion} does not match package.json ${version}.`);
  }
  const publish = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : null;
  const feedBase = String(process.env.PLEXUS_UPDATE_FEED_URL || publish?.url || '').replace(/\/+$/, '');
  if (!feedBase) throw new Error('package.json build.publish[0].url is missing.');
  return { version, feedUrl: `${feedBase}/latest-mac.yml` };
}

function assertPublishRef(eventName, ref, version) {
  if (eventName !== 'push' || !ref.startsWith('refs/tags/')) {
    throw new Error(`publication requires a tag push event; received event=${eventName || 'empty'} ref=${ref || 'empty'}.`);
  }
  const expected = `refs/tags/v${version}`;
  if (ref !== expected) {
    throw new Error(`release ref ${ref} does not match package version v${version}.`);
  }
  return expected;
}

function resolveCommit(repoRoot, revision, label) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', `${revision}^{commit}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error(`${label} ${revision || 'empty'} does not resolve to a commit.`);
  }
}

function assertMainAncestry(repoRoot, ref, sha, mainRef) {
  if (!sha || !mainRef) {
    throw new Error('publication requires both --sha and --main-ref for merged-main ancestry verification.');
  }
  const refCommit = resolveCommit(repoRoot, ref, 'Release ref');
  const eventCommit = resolveCommit(repoRoot, sha, 'Event SHA');
  if (refCommit !== eventCommit) {
    throw new Error(`release ref commit ${refCommit} does not match event commit ${eventCommit}.`);
  }
  const mainCommit = resolveCommit(repoRoot, mainRef, 'Main ref');
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', eventCommit, mainCommit], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
  } catch {
    throw new Error(`release commit ${eventCommit} is not contained by ${mainRef} (${mainCommit}).`);
  }
  console.log(`[release-ref] release commit ${eventCommit} is contained by ${mainRef}.`);
}

function yamlValue(raw) {
  return String(raw ?? '').trim().replace(/^['"]|['"]$/g, '');
}

function artifactFileReference(value, label) {
  const reference = yamlValue(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(reference) || reference === '.' || reference === '..') {
    throw new Error(`${label} must be a relative artifact filename without an origin, path, query, or fragment.`);
  }
  return reference;
}

function parseLatestMacYml(body) {
  const topLevel = (key) => {
    const match = body.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
    return match ? yamlValue(match[1]) : '';
  };
  const files = [];
  const lines = body.split(/\r?\n/);
  let current = null;
  for (const line of lines) {
    const url = line.match(/^\s*-\s+url:\s*(.+?)\s*$/);
    if (url) {
      if (current) files.push(current);
      current = { url: artifactFileReference(url[1], 'latest-mac.yml file URL'), sha512: '', size: null };
      continue;
    }
    if (!current) continue;
    const sha = line.match(/^\s+sha512:\s*(.+?)\s*$/);
    if (sha && !current.sha512) {
      current.sha512 = yamlValue(sha[1]);
      continue;
    }
    const size = line.match(/^\s+size:\s*(\d+)\s*$/);
    if (size) current.size = Number(size[1]);
  }
  if (current) files.push(current);

  const parsed = {
    version: topLevel('version'),
    path: artifactFileReference(topLevel('path'), 'latest-mac.yml top-level path'),
    sha512: topLevel('sha512'),
    files,
  };
  if (!parsed.version || !parsed.path || !parsed.sha512 || files.length === 0) {
    throw new Error('latest-mac.yml is missing version, path, sha512, or files metadata.');
  }
  for (const file of files) {
    if (!file.url || !file.sha512 || !Number.isSafeInteger(file.size) || file.size <= 0) {
      throw new Error(`latest-mac.yml has incomplete metadata for ${file.url || 'an unnamed artifact'}.`);
    }
  }
  const primaryFile = files.find((file) => file.url === parsed.path);
  if (!primaryFile) {
    throw new Error(`latest-mac.yml top-level path ${parsed.path} is not present in files metadata.`);
  }
  if (primaryFile.sha512 !== parsed.sha512) {
    throw new Error(`latest-mac.yml top-level SHA-512 does not match the files entry for ${parsed.path}.`);
  }
  return parsed;
}

function cacheBusted(url, token) {
  const next = new URL(url);
  next.searchParams.set('release', token);
  return next.toString();
}

function cacheMaxAge(value) {
  const match = String(value ?? '').match(/(?:^|,)\s*max-age=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function assertImmutableCache(value, label) {
  const cacheControl = String(value ?? '');
  const maxAge = cacheMaxAge(cacheControl);
  if (!/\bimmutable\b/i.test(cacheControl) || maxAge === null || maxAge < 31_536_000) {
    throw new Error(`${label} cache-control must be public, max-age>=31536000, immutable; received ${cacheControl || 'missing'}.`);
  }
}

function assertManifestCache(value) {
  const cacheControl = String(value ?? '');
  const maxAge = cacheMaxAge(cacheControl);
  if (maxAge === null || maxAge > 60 || !/(?:must-revalidate|no-cache)/i.test(cacheControl)) {
    throw new Error(`latest-mac.yml cache-control must be short-lived and revalidated; received ${cacheControl || 'missing'}.`);
  }
}

async function fetchResponse(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${url} returned HTTP ${response.status}.`);
  return response;
}

function artifactChecks(manifest) {
  const checks = [];
  const seen = new Set();
  for (const file of manifest.files) {
    checks.push({ url: file.url, size: file.size, sha512: file.sha512 });
    seen.add(file.url);
    const blockmap = `${file.url}.blockmap`;
    if (!seen.has(blockmap)) {
      checks.push({ url: blockmap, size: null, sha512: null });
      seen.add(blockmap);
    }
  }
  return checks;
}

async function verifyArtifacts(manifest, feedUrl, token) {
  const baseUrl = new URL('.', feedUrl);
  for (const artifact of artifactChecks(manifest)) {
    const artifactUrl = cacheBusted(new URL(artifact.url, baseUrl).toString(), token);
    const response = await fetchResponse(artifactUrl, { method: artifact.sha512 ? 'GET' : 'HEAD' });
    const length = Number(response.headers.get('content-length'));
    if (!Number.isSafeInteger(length) || length <= 0) {
      throw new Error(`${artifact.url} did not return a valid content-length.`);
    }
    if (artifact.size !== null && length !== artifact.size) {
      throw new Error(`${artifact.url} content-length ${length} does not match manifest size ${artifact.size}.`);
    }
    assertImmutableCache(response.headers.get('cache-control'), artifact.url);
    if (artifact.sha512) {
      if (!response.body) throw new Error(`${artifact.url} did not return an artifact body.`);
      const hash = createHash('sha512');
      let receivedBytes = 0;
      for await (const chunk of response.body) {
        hash.update(chunk);
        receivedBytes += chunk.byteLength;
      }
      if (receivedBytes !== length) {
        throw new Error(`${artifact.url} body length ${receivedBytes} does not match content-length ${length}.`);
      }
      if (hash.digest('base64') !== artifact.sha512) {
        throw new Error(`${artifact.url} SHA-512 does not match latest-mac.yml.`);
      }
    }
  }
}

async function verifyPublic(manifestBody, manifest, feedUrl, token) {
  const response = await fetchResponse(cacheBusted(feedUrl, token));
  const remoteBody = await response.text();
  if (remoteBody !== manifestBody) throw new Error('Public latest-mac.yml does not exactly match the local release manifest.');
  assertManifestCache(response.headers.get('cache-control'));
  await verifyArtifacts(manifest, feedUrl, token);
}

async function retry(label, attempts, delayMs, operation) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await operation(attempt);
      console.log(`[release-ref] ${label} verified on attempt ${attempt}.`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      console.warn(`[release-ref] ${label} attempt ${attempt} failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function publicFeedVersion(feedUrl, injectedVersion) {
  if (injectedVersion) return requireStableVersion(injectedVersion, 'Injected public feed version');
  const response = await fetchResponse(cacheBusted(feedUrl, `preflight-${Date.now()}`));
  const manifest = parseLatestMacYml(await response.text());
  return requireStableVersion(manifest.version, 'Public feed version');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.get('mode') ?? 'prepare';
  if (!['build', 'prepare', 'publish', 'artifacts', 'public'].includes(mode)) {
    throw new Error(`Unknown --mode ${mode}.`);
  }
  const repoRoot = path.resolve(args.get('repo-root') ?? defaultRepoRoot);
  const metadata = releaseMetadata(repoRoot);
  const feedUrl = args.get('feed-url') ?? metadata.feedUrl;
  console.log(`[release-ref] package and lock versions agree at ${metadata.version}.`);

  if (mode === 'publish') {
    const ref = assertPublishRef(args.get('event') ?? '', args.get('ref') ?? '', metadata.version);
    console.log(`[release-ref] release ref ${ref} matches package version.`);
    assertMainAncestry(repoRoot, ref, args.get('sha') ?? '', args.get('main-ref') ?? '');
  }

  if (mode === 'prepare' || mode === 'publish') {
    const feedVersion = await publicFeedVersion(feedUrl, args.get('feed-version'));
    const comparison = compareVersions(metadata.version, feedVersion);
    if (comparison < 0) {
      throw new Error(`candidate ${metadata.version} must be newer than public feed ${feedVersion}.`);
    }
    if (comparison === 0) {
      if (mode !== 'publish' || args.get('allow-current-feed') !== 'true') {
        throw new Error(`candidate ${metadata.version} must be newer than public feed ${feedVersion}.`);
      }
      const manifestPath = path.resolve(args.get('manifest') ?? path.join(repoRoot, 'release', 'latest-mac.yml'));
      const manifestBody = readFileSync(manifestPath, 'utf8');
      const manifest = parseLatestMacYml(manifestBody);
      if (manifest.version !== metadata.version) {
        throw new Error(`release manifest version ${manifest.version} does not match package version ${metadata.version}.`);
      }
      const attempts = Number(args.get('attempts') ?? 12);
      const delayMs = Number(args.get('delay-ms') ?? 10_000);
      if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error('--attempts must be a positive integer.');
      if (!Number.isSafeInteger(delayMs) || delayMs < 0) throw new Error('--delay-ms must be a non-negative integer.');
      const cacheBust = args.get('cache-bust') ?? process.env.GITHUB_RUN_ID ?? String(Date.now());
      await retry(
        'exact-current OTA recovery state',
        attempts,
        delayMs,
        (attempt) => verifyPublic(manifestBody, manifest, feedUrl, `${cacheBust}-resume-${attempt}`),
      );
      console.log(`[release-ref] candidate ${metadata.version} exactly matches the fully verified public feed; failed-job recovery may continue.`);
    } else {
      console.log(`[release-ref] candidate ${metadata.version} is newer than public feed ${feedVersion}.`);
    }
  }

  if (mode === 'artifacts' || mode === 'public') {
    const manifestPath = path.resolve(args.get('manifest') ?? path.join(repoRoot, 'release', 'latest-mac.yml'));
    const manifestBody = readFileSync(manifestPath, 'utf8');
    const manifest = parseLatestMacYml(manifestBody);
    if (manifest.version !== metadata.version) {
      throw new Error(`release manifest version ${manifest.version} does not match package version ${metadata.version}.`);
    }
    const attempts = Number(args.get('attempts') ?? 12);
    const delayMs = Number(args.get('delay-ms') ?? 10_000);
    if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error('--attempts must be a positive integer.');
    if (!Number.isSafeInteger(delayMs) || delayMs < 0) throw new Error('--delay-ms must be a non-negative integer.');
    const cacheBust = args.get('cache-bust') ?? process.env.GITHUB_RUN_ID ?? String(Date.now());
    await retry(
      mode === 'public' ? 'public OTA release' : 'public immutable OTA artifacts',
      attempts,
      delayMs,
      (attempt) => mode === 'public'
        ? verifyPublic(manifestBody, manifest, feedUrl, `${cacheBust}-${attempt}`)
        : verifyArtifacts(manifest, feedUrl, `${cacheBust}-${attempt}`),
    );
  }
}

main().catch((error) => {
  console.error(`[release-ref] ${error?.message ?? String(error)}`);
  process.exit(1);
});
