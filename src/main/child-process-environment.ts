const CHILD_PROCESS_SECRET_KEYS = [
  'CF_ACCESS_JWT',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_CLIENT_SECRET',
  'GITHUB_WEBHOOK_SECRET',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'TF_GITHUB_APP_PRIVATE_KEY',
  'TF_GITHUB_APP_CLIENT_SECRET',
  'TF_GITHUB_APP_WEBHOOK_SECRET',
  'TF_GITHUB_APP_STATE_SIGNING_SECRET',
  'TF_GITHUB_TOKEN_GLOBAL',
  'TF_CREDENTIAL_ENVELOPE_KEY',
  'TF_INTERNAL_SHARED_SECRET',
  'TF_WEBHOOK_HMAC_SECRET',
] as const;

export function sanitizedChildProcessEnv(
  base: NodeJS.ProcessEnv = process.env,
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, ...overrides };
  for (const key of CHILD_PROCESS_SECRET_KEYS) delete env[key];
  return env;
}
