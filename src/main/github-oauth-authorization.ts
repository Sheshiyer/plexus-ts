const GITHUB_OAUTH_AUTHORIZE_ORIGIN = 'https://github.com';
const GITHUB_OAUTH_AUTHORIZE_PATH = '/login/oauth/authorize';
const GITHUB_OAUTH_QUERY_KEYS = ['client_id', 'redirect_uri', 'state'] as const;

function hasExactQueryShape(url: URL): boolean {
  const entries = [...url.searchParams.entries()];
  if (entries.length !== GITHUB_OAUTH_QUERY_KEYS.length) return false;
  const keys = entries.map(([key]) => key).sort();
  return GITHUB_OAUTH_QUERY_KEYS.every((key, index) => keys[index] === key);
}

function isValidClientId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9.]{15,63}$/.test(value) && !value.endsWith('.');
}

function isValidSignedState(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,2048}\.[A-Za-z0-9_-]{43,128}$/.test(value);
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
    if (!isValidClientId(clientId)
      || !isValidCallback(redirectUri, workerBaseUrl)
      || !isValidSignedState(state)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
