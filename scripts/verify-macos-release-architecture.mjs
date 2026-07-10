#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function fail(message) {
  console.error(`[verify:release-architecture] ${message}`);
  process.exit(1);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}

function yamlValue(raw) {
  return String(raw ?? '').trim().replace(/^['"]|['"]$/g, '');
}

function artifactName(value) {
  const normalized = yamlValue(value);
  try {
    return path.posix.basename(new URL(normalized).pathname);
  } catch {
    return path.basename(normalized.split(/[?#]/, 1)[0]);
  }
}

function parseManifest(body) {
  const pathMatch = body.match(/^path:\s*(.+?)\s*$/m);
  const urls = [...body.matchAll(/^\s*-\s+url:\s*(.+?)\s*$/gm)]
    .map(match => artifactName(match[1]));
  const primaryPath = pathMatch ? artifactName(pathMatch[1]) : '';
  if (!primaryPath || urls.length === 0) {
    fail('latest-mac.yml must include path and files URL metadata.');
  }
  return { primaryPath, urls };
}

function assertArm64Artifact(name) {
  if (!/^Plexus-\d+\.\d+\.\d+-mac-arm64\.(?:zip|dmg)$/.test(name)) {
    fail(`latest-mac.yml artifact must use the Plexus-<version>-mac-arm64 filename contract; received ${name}.`);
  }
}

function findPackagedApp(root, depth = 0) {
  if (!existsSync(root) || depth > 4) return null;
  const deterministic = path.join(root, 'mac-arm64', 'Plexus.app');
  if (existsSync(deterministic)) return deterministic;
  for (const name of readdirSync(root).sort()) {
    const candidate = path.join(root, name);
    const stat = statSync(candidate);
    if (!stat.isDirectory()) continue;
    if (name === 'Plexus.app') return candidate;
    const nested = findPackagedApp(candidate, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function packagedExecutable(appOrExecutablePath) {
  if (!existsSync(appOrExecutablePath)) fail(`packaged app path does not exist: ${appOrExecutablePath}.`);
  if (statSync(appOrExecutablePath).isFile()) return appOrExecutablePath;

  const macosDir = path.join(appOrExecutablePath, 'Contents', 'MacOS');
  if (!existsSync(macosDir)) fail(`packaged app is missing Contents/MacOS: ${appOrExecutablePath}.`);
  const deterministic = path.join(macosDir, 'Plexus');
  if (existsSync(deterministic) && statSync(deterministic).isFile()) return deterministic;
  const executable = readdirSync(macosDir).sort()
    .map(name => path.join(macosDir, name))
    .find(candidate => statSync(candidate).isFile());
  if (!executable) fail(`packaged app has no executable under ${macosDir}.`);
  return executable;
}

function verifyPackagedArchitecture(manifestPath) {
  const lipoOverride = argValue('--lipo');
  if (process.platform !== 'darwin' && !lipoOverride) return;

  const appOverride = argValue('--app');
  const appPath = appOverride
    ? path.resolve(appOverride)
    : findPackagedApp(path.dirname(manifestPath));
  if (!appPath) fail(`could not locate Plexus.app under ${path.dirname(manifestPath)}.`);
  const executable = packagedExecutable(appPath);
  const lipo = lipoOverride ? path.resolve(lipoOverride) : '/usr/bin/lipo';
  if (!existsSync(lipo)) fail(`lipo executable does not exist: ${lipo}.`);

  const result = spawnSync(lipo, ['-archs', executable], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error) fail(`lipo failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`lipo exited ${result.status}: ${(result.stderr || result.stdout || 'no output').trim()}`);
  }

  const architectures = result.stdout.trim().split(/\s+/).filter(Boolean);
  if (!architectures.includes('arm64') || architectures.includes('x86_64')) {
    fail(`packaged executable architectures [${architectures.join(', ') || 'none'}] must contain arm64 and must not contain x86_64.`);
  }
  console.log(`[verify:release-architecture] packaged executable architecture ok: ${architectures.join(' ')}`);
}

const manifestPath = path.resolve(argValue('--manifest') ?? path.join('release', 'latest-mac.yml'));
let manifestBody;
try {
  manifestBody = readFileSync(manifestPath, 'utf8');
} catch (error) {
  fail(`could not read ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
}

const manifest = parseManifest(manifestBody);
assertArm64Artifact(manifest.primaryPath);
for (const artifact of manifest.urls) assertArm64Artifact(artifact);
if (!manifest.urls.includes(manifest.primaryPath)) {
  fail(`latest-mac.yml path ${manifest.primaryPath} is not present in files metadata.`);
}
if (!manifest.urls.some(name => name.endsWith('.zip'))) fail('latest-mac.yml is missing its arm64 ZIP artifact.');
if (!manifest.urls.some(name => name.endsWith('.dmg'))) fail('latest-mac.yml is missing its arm64 DMG artifact.');

console.log(`[verify:release-architecture] arm64 manifest policy ok: ${manifestPath}`);
verifyPackagedArchitecture(manifestPath);
