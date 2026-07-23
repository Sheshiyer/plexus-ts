#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function fail(message) {
  throw new Error(message);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}

const commandShim = argValue('--command-shim');

function run(command, args) {
  const executable = commandShim ? process.execPath : command;
  const commandArgs = commandShim ? [path.resolve(commandShim), path.basename(command), ...args] : args;
  const result = spawnSync(executable, commandArgs, { encoding: 'utf8' });
  if (result.error) fail(`${path.basename(command)} failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || 'no output').trim();
    fail(`${path.basename(command)} exited ${result.status}: ${detail}`);
  }
  return result;
}

function onlyMatchingFile(directory, predicate, label) {
  if (!existsSync(directory)) fail(`release directory does not exist: ${directory}.`);
  const matches = readdirSync(directory)
    .map(name => path.join(directory, name))
    .filter(candidate => statSync(candidate).isFile() && predicate(candidate))
    .sort();
  if (matches.length !== 1) {
    fail(`expected exactly one ${label} under ${directory}; found ${matches.length}.`);
  }
  return matches[0];
}

function resolveApp(releaseRoot) {
  const explicit = argValue('--app');
  const appPath = explicit
    ? path.resolve(explicit)
    : path.join(releaseRoot, 'mac-arm64', 'Plexus.app');
  if (!existsSync(appPath) || !statSync(appPath).isDirectory()) {
    fail(`signed Plexus.app does not exist: ${appPath}.`);
  }
  return appPath;
}

function resolveDmg(releaseRoot) {
  const explicit = argValue('--dmg');
  if (explicit) {
    const dmgPath = path.resolve(explicit);
    if (!existsSync(dmgPath) || !statSync(dmgPath).isFile()) {
      fail(`signed DMG does not exist: ${dmgPath}.`);
    }
    return dmgPath;
  }
  return onlyMatchingFile(releaseRoot, candidate => candidate.endsWith('-mac-arm64.dmg'), 'arm64 DMG');
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function mountPointFromPlist(plist) {
  const match = plist.match(/<key>mount-point<\/key>\s*<string>([^<]+)<\/string>/);
  if (!match) fail('hdiutil did not report a mounted volume.');
  return decodeXml(match[1]);
}

function mountedAppAt(mountPoint) {
  const deterministic = path.join(mountPoint, 'Plexus.app');
  if (existsSync(deterministic) && statSync(deterministic).isDirectory()) return deterministic;
  const apps = readdirSync(mountPoint)
    .filter(name => name.endsWith('.app'))
    .map(name => path.join(mountPoint, name))
    .filter(candidate => statSync(candidate).isDirectory())
    .sort();
  if (apps.length !== 1) fail(`expected exactly one app in mounted DMG ${mountPoint}; found ${apps.length}.`);
  return apps[0];
}

const codesign = '/usr/bin/codesign';
const spctl = '/usr/sbin/spctl';
const xcrun = '/usr/bin/xcrun';
const hdiutil = '/usr/bin/hdiutil';

function verifyApp(appPath, expectedTeamId, label) {
  run(codesign, ['--verify', '--deep', '--strict', '--verbose=4', appPath]);
  const identity = run(codesign, ['-dv', '--verbose=4', appPath]);
  const identityOutput = `${identity.stdout}\n${identity.stderr}`;
  const teamId = identityOutput.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim();
  if (!teamId) fail(`${label} did not report a Developer ID TeamIdentifier.`);
  if (teamId !== expectedTeamId) {
    fail(`TeamIdentifier ${teamId} does not match expected ${expectedTeamId} for ${label}.`);
  }
  run(spctl, ['--assess', '--type', 'execute', '--verbose=4', appPath]);
  run(xcrun, ['stapler', 'validate', appPath]);
  console.log(`[verify:release-signature] verified Developer ID TeamIdentifier ${teamId}: ${label}`);
}

function verifyMountedDmg(dmgPath, expectedTeamId) {
  const attached = run(hdiutil, ['attach', '-readonly', '-nobrowse', '-plist', dmgPath]);
  const mountPoint = mountPointFromPlist(attached.stdout);
  let verificationError;
  try {
    verifyApp(mountedAppAt(mountPoint), expectedTeamId, 'mounted DMG app');
    console.log(`[verify:release-signature] verified mounted DMG app: ${dmgPath}`);
  } catch (error) {
    verificationError = error;
  }

  try {
    run(hdiutil, ['detach', mountPoint]);
  } catch (error) {
    if (!verificationError) throw error;
    console.error(`[verify:release-signature] additionally failed to detach ${mountPoint}: ${error.message}`);
  }
  if (verificationError) throw verificationError;
}

try {
  if (process.platform !== 'darwin' && !commandShim) {
    fail('signed macOS release verification must run on macOS.');
  }
  const releaseRoot = path.resolve(argValue('--release-dir') ?? 'release');
  const expectedTeamId = argValue('--team-id') ?? process.env.EXPECTED_APPLE_TEAM_ID;
  if (!expectedTeamId) fail('--team-id or EXPECTED_APPLE_TEAM_ID is required.');
  const appPath = resolveApp(releaseRoot);
  const dmgPath = resolveDmg(releaseRoot);

  verifyApp(appPath, expectedTeamId, 'packaged app');
  verifyMountedDmg(dmgPath, expectedTeamId);
  console.log('[verify:release-signature] signed and notarized macOS release verification passed.');
} catch (error) {
  console.error(`[verify:release-signature] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
