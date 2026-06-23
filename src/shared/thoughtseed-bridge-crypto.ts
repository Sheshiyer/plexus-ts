import { createHash, createHmac } from 'node:crypto';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

export function signBridgeMessage<T extends Record<string, unknown>>(message: T, token: string): T & { signature: string } {
  const { signature: _signature, ...unsigned } = message;
  const signature = createHmac('sha256', token)
    .update(canonicalJson(unsigned))
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { ...message, signature };
}

export function hashBridgePayload(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function isBridgeTokenExpired(expiresAt?: string | null, nowMs = Date.now()): boolean {
  if (!expiresAt) return false;
  const expiresMs = Date.parse(expiresAt);
  return Number.isFinite(expiresMs) && expiresMs <= nowMs;
}
