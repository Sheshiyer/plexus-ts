import { isSecretLikeKey } from '../shared/redaction-policy.js';
import { MAX_TEXT_CHARS_PER_ITEM } from './assistant-policy.js';

export const LOG_REDACTION_TEXT = '[redacted]';

const SECRET_ASSIGNMENT_PATTERN = /\b(api[_ -]?key|authorization|cookie|token|jwt|signature|secret|cf_authorization|cf-access-jwt-assertion)\b(\s*[:=]\s*)(['"]?)[^'",;\s]+(\3)/gi;
const AUTHORIZATION_ASSIGNMENT_PATTERN = /\b(Authorization\s*[:=]\s*)(?:Bearer\s+)?[^'",;\s]+/gi;
const COOKIE_ASSIGNMENT_PATTERN = /\b(Cookie\s*[:=]\s*)[^,\n]+/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const COOKIE_AUTH_PATTERN = /\b(CF_Authorization=)[^;\s]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const GOOGLE_KEY_PATTERN = /\bAIza[0-9A-Za-z_-]+/g;
const NVIDIA_KEY_PATTERN = /\bnvapi-[0-9A-Za-z_-]+/g;

export function redactStringForLog(value: string, maxChars = MAX_TEXT_CHARS_PER_ITEM): string {
  const truncated = value.length > maxChars ? value.slice(0, maxChars) : value;
  return truncated
    .replace(AUTHORIZATION_ASSIGNMENT_PATTERN, `$1${LOG_REDACTION_TEXT}`)
    .replace(COOKIE_ASSIGNMENT_PATTERN, `$1${LOG_REDACTION_TEXT}`)
    .replace(SECRET_ASSIGNMENT_PATTERN, (_match, key: string, separator: string, quote = '') => {
      return `${key}${separator}${quote}${LOG_REDACTION_TEXT}${quote}`;
    })
    .replace(BEARER_PATTERN, `Bearer ${LOG_REDACTION_TEXT}`)
    .replace(COOKIE_AUTH_PATTERN, `$1${LOG_REDACTION_TEXT}`)
    .replace(JWT_PATTERN, LOG_REDACTION_TEXT)
    .replace(GOOGLE_KEY_PATTERN, LOG_REDACTION_TEXT)
    .replace(NVIDIA_KEY_PATTERN, LOG_REDACTION_TEXT);
}

export function redactForLog(value: unknown, maxDepth = 8): unknown {
  return redactValue(value, new WeakSet<object>(), maxDepth);
}

export function redactedErrorMessage(error: unknown): string {
  if (error instanceof Error) return redactStringForLog(error.message || error.name || 'Error');
  return redactStringForLog(String(error ?? 'Unknown error'));
}

function redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactStringForLog(value);
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[circular]';
  if (depth <= 0) return '[truncated]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactStringForLog(value.message),
      stack: value.stack ? redactStringForLog(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen, depth - 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSecretLikeKey(key) ? LOG_REDACTION_TEXT : redactValue(item, seen, depth - 1);
  }
  return output;
}
