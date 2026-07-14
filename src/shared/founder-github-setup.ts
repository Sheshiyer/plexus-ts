import type { FounderGitHubSetupIntent } from './types.js';

export const THOUGHTSEED_GITHUB_ORGANIZATION = 'thoughtseed-labs';
export const THOUGHTSEED_GITHUB_FOUNDERS = ['Sheshiyer', 'psychon7'] as const;
export const THOUGHTSEED_GITHUB_INSTALLATION_TARGETS = [
  { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' as const },
  { id: 7611727, login: 'Sheshiyer', type: 'User' as const },
  { id: 47470954, login: 'psychon7', type: 'User' as const },
] as const;
export const FOUNDER_GITHUB_SETUP_URL = 'plexus://github/setup/v1';
export const FOUNDER_GITHUB_SETUP_FLAG = '--github-founder-setup';

export function founderGitHubSetupIntent(): FounderGitHubSetupIntent {
  return {
    version: 1,
    organizationLogin: THOUGHTSEED_GITHUB_ORGANIZATION,
    allowedLogins: [...THOUGHTSEED_GITHUB_FOUNDERS],
    installationTargets: THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.map((target) => ({ ...target })),
  };
}

export function isFounderGitHubSetupRequest(value: unknown): boolean {
  if (value === FOUNDER_GITHUB_SETUP_FLAG) return true;
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'plexus:'
      && parsed.hostname === 'github'
      && parsed.pathname === '/setup/v1'
      && parsed.username === ''
      && parsed.password === ''
      && parsed.port === ''
      && parsed.search === ''
      && parsed.hash === '';
  } catch {
    return false;
  }
}

export function argvRequestsFounderGitHubSetup(argv: readonly string[]): boolean {
  return argv.some(isFounderGitHubSetupRequest);
}
