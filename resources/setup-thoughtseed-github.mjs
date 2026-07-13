#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const ORGANIZATION_LOGIN = 'thoughtseed-labs';
export const ORGANIZATION_ID = 65741640;
export const ALLOWED_FOUNDER_LOGINS = Object.freeze(['Sheshiyer', 'psychon7']);
export const ALLOWED_FOUNDER_IDS = Object.freeze({
  sheshiyer: 7611727,
  psychon7: 47470954,
});
export const PLEXUS_SETUP_URL = 'plexus://github/setup/v1';

const GITHUB_CLI_ENVIRONMENT_ALLOWLIST = new Set([
  'PATH',
  'PATHEXT',
  'HOME',
  'USERPROFILE',
  'LOCALAPPDATA',
  'APPDATA',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_STATE_HOME',
  'XDG_CACHE_HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  'SYSTEMROOT',
  'COMSPEC',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TERM',
  'NO_COLOR',
]);

export function environmentForGitHubCli(source = process.env) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => GITHUB_CLI_ENVIRONMENT_ALLOWLIST.has(key.toUpperCase())));
}

function defaultRun(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...options,
  });
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${label} returned an invalid response. Upgrade GitHub CLI and try again.`);
  }
}

export function validateFounderIdentity(user, membership) {
  const login = typeof user?.login === 'string' ? user.login : '';
  const id = Number(user?.id);
  if (!ALLOWED_FOUNDER_LOGINS.some((allowed) => allowed.toLowerCase() === login.toLowerCase())) {
    throw new Error(`GitHub CLI is authenticated as ${login || 'an unknown account'}, not an allowed Thoughtseed Labs founder.`);
  }
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('GitHub did not return an immutable numeric account id. Re-authenticate GitHub CLI and try again.');
  }
  if (ALLOWED_FOUNDER_IDS[login.toLowerCase()] !== id) {
    throw new Error(`The ${login} login does not match its pinned public GitHub account id. Stop and deliberately update the Plexus founder allowlist after verifying a legitimate rename.`);
  }
  const organization = typeof membership?.organization?.login === 'string'
    ? membership.organization.login
    : '';
  if (organization.toLowerCase() !== ORGANIZATION_LOGIN || membership?.state !== 'active') {
    throw new Error(`The ${login} account does not have active membership in ${ORGANIZATION_LOGIN}.`);
  }
  const organizationId = Number(membership?.organization?.id);
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0 || organizationId !== ORGANIZATION_ID) {
    throw new Error(`The ${ORGANIZATION_LOGIN} login does not match its pinned public GitHub organization id.`);
  }
  return { login, id, organization: ORGANIZATION_LOGIN };
}

export function verifyFounderWithGitHubCli(run = defaultRun, environment = environmentForGitHubCli()) {
  try {
    run('gh', ['--version'], { env: environment });
    run('gh', ['auth', 'status', '--hostname', 'github.com'], { env: environment });
  } catch {
    throw new Error('GitHub CLI is unavailable or not authenticated through its credential store. Install `gh`, then run `gh auth login --hostname github.com`.');
  }

  let user;
  try {
    user = parseJson(run('gh', ['api', 'user'], { env: environment }), 'GitHub account lookup');
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalid response')) throw error;
    throw new Error('GitHub account verification failed. Run `gh auth refresh --hostname github.com` and try again.');
  }

  let membership;
  try {
    membership = parseJson(
      run('gh', ['api', `user/memberships/orgs/${ORGANIZATION_LOGIN}`], { env: environment }),
      'GitHub organization membership lookup',
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalid response')) throw error;
    throw new Error(`Could not verify active ${ORGANIZATION_LOGIN} membership. Run \`gh auth refresh --hostname github.com --scopes read:org\` and try again.`);
  }

  return validateFounderIdentity(user, membership);
}

export function openPlexusSetup(platform = process.platform, run = defaultRun) {
  if (platform === 'darwin') {
    run('open', [PLEXUS_SETUP_URL]);
    return;
  }
  if (platform === 'win32') {
    run('cmd.exe', ['/d', '/s', '/c', 'start', '', PLEXUS_SETUP_URL]);
    return;
  }
  run('xdg-open', [PLEXUS_SETUP_URL]);
}

function usage() {
  return [
    'Usage: setup-thoughtseed-github [--check]',
    '',
    `Verifies the current GitHub CLI account is Sheshiyer or psychon7 with active ${ORGANIZATION_LOGIN} membership,`,
    'then opens the installed Plexus app at its GitHub setup surface.',
    '',
    'This command accepts no token, secret, organization, account, URL, or repository arguments.',
  ].join('\n');
}

export function main(argv = process.argv.slice(2), run = defaultRun) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (argv.some((arg) => arg !== '--check')) {
    process.stderr.write(`Setup refused an unsupported argument.\n\n${usage()}\n`);
    return 2;
  }
  try {
    const founder = verifyFounderWithGitHubCli(run);
    process.stdout.write(`Verified ${founder.login} (GitHub account ${founder.id}) as an active ${founder.organization} member.\n`);
    if (argv.includes('--check')) {
      process.stdout.write('Preflight passed. Plexus was not opened because --check was used.\n');
      return 0;
    }
    openPlexusSetup(process.platform, run);
    process.stdout.write('Plexus is opening at Settings > GitHub. Complete the in-app verification; this preflight grants no authority.\n');
    return 0;
  } catch (error) {
    process.stderr.write(`Setup stopped safely: ${error instanceof Error ? error.message : 'unknown preflight failure'}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
