export const MAX_CONTEXT_ITEMS = 50;
export const MAX_TEXT_CHARS_PER_ITEM = 2_000;
export const MAX_SESSION_EXCERPT_CHARS = 4_000;

export const ASSISTANT_SECRET_KEYS = [
  'token',
  'authorization',
  'cookie',
  'bridgeToken',
  'accessJwt',
  'signature',
] as const;

export function isSecretLikeKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return ASSISTANT_SECRET_KEYS.some((secretKey) => {
    const secret = secretKey.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return normalized === secret || normalized.includes(secret);
  });
}
