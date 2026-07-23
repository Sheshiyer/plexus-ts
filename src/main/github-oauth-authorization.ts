const GITHUB_OAUTH_AUTHORIZE_ORIGIN = 'https://github.com';
const GITHUB_OAUTH_AUTHORIZE_PATH = '/login/oauth/authorize';
const GITHUB_OAUTH_REQUIRED_QUERY_KEYS = ['client_id', 'redirect_uri', 'state'] as const;
const GITHUB_OAUTH_OPTIONAL_QUERY_KEYS = [
  'allow_signup',
  'code_challenge',
  'code_challenge_method',
  'login',
  'prompt',
  'scope',
] as const;
const GITHUB_OAUTH_QUERY_KEYS = new Set<string>([
  ...GITHUB_OAUTH_REQUIRED_QUERY_KEYS,
  ...GITHUB_OAUTH_OPTIONAL_QUERY_KEYS,
]);

function hasExactQueryShape(url: URL): boolean {
  const entries = [...url.searchParams.entries()];
  const counts = new Map<string, number>();
  for (const [key, value] of entries) {
    if (!GITHUB_OAUTH_QUERY_KEYS.has(key) || !value) return false;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return GITHUB_OAUTH_REQUIRED_QUERY_KEYS.every((key) => counts.get(key) === 1)
    && [...counts.values()].every((count) => count === 1);
}

function isValidClientId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9.]{15,63}$/.test(value) && !value.endsWith('.');
}

function isValidSignedState(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,2048}\.[A-Za-z0-9_-]{43,128}$/.test(value);
}

function isValidOptionalParameter(key: string, value: string): boolean {
  if (value.length > 2048 || [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  })) return false;
  if (key === 'allow_signup') return value === 'true' || value === 'false';
  if (key === 'code_challenge') return /^[A-Za-z0-9_-]{43,128}$/.test(value);
  if (key === 'code_challenge_method') return value === 'S256';
  if (key === 'login') return /^[A-Za-z0-9-]{1,39}$/.test(value);
  if (key === 'prompt') return value === 'select_account';
  if (key === 'scope') return /^[A-Za-z0-9_.:-]+(?: [A-Za-z0-9_.:-]+)*$/.test(value);
  return false;
}

function isValidCallback(value: string, workerBaseUrl: string): boolean {
  try {
    const callback = new URL(value);
    const worker = new URL(workerBaseUrl);
    return callback.protocol === 'https:'
      && callback.origin === worker.origin
      && value.startsWith(`${worker.origin}/v1/github/callback`)
      && callback.pathname === '/v1/github/callback'
      && callback.username === ''
      && callback.password === ''
      && callback.port === ''
      && callback.search === ''
      && callback.hash === '';
  } catch {
    return false;
  }
}

export function validatedGitHubOAuthAuthorizeUrl(value: unknown, workerBaseUrl: string): string | null {
  if (typeof value !== 'string'
    || value.length > 4096
    || !value.startsWith('https://github.com/login/oauth/authorize?')) return null;
  try {
    const url = new URL(value);
    if (url.origin !== GITHUB_OAUTH_AUTHORIZE_ORIGIN
      || url.pathname !== GITHUB_OAUTH_AUTHORIZE_PATH
      || url.username !== ''
      || url.password !== ''
      || url.port !== ''
      || url.hash !== ''
      || !hasExactQueryShape(url)) {
      return null;
    }
    const clientId = url.searchParams.get('client_id') ?? '';
    const redirectUri = url.searchParams.get('redirect_uri') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const codeChallenge = url.searchParams.get('code_challenge');
    const codeChallengeMethod = url.searchParams.get('code_challenge_method');
    if (!isValidClientId(clientId)
      || !isValidCallback(redirectUri, workerBaseUrl)
      || !isValidSignedState(state)
      || [...url.searchParams.entries()]
        .filter(([key]) => !GITHUB_OAUTH_REQUIRED_QUERY_KEYS.includes(key as typeof GITHUB_OAUTH_REQUIRED_QUERY_KEYS[number]))
        .some(([key, parameter]) => !isValidOptionalParameter(key, parameter))
      || (codeChallenge !== null) !== (codeChallengeMethod !== null)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
