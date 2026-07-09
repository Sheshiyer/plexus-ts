export const SECRET_KEYS = [
  'token',
  'authorization',
  'cookie',
  'bridgeToken',
  'accessJwt',
  'signature',
  'secret',
  'apiKey',
  'password',
] as const;

export function isSecretLikeKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return SECRET_KEYS.some((secretKey) => {
    const secret = secretKey.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return normalized === secret || normalized.includes(secret);
  });
}
