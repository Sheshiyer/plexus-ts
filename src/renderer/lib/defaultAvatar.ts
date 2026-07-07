import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';

/**
 * Deterministic default avatars for people who have not set a custom one.
 *
 * DiceBear runs fully locally and emits an inline SVG data URI, so this is
 * safe under the renderer CSP (`img-src 'self' data: blob:`) — no network
 * fetch to any avatar service. Output is memoized per seed since the presence
 * floor can render the same person many times.
 *
 * To change the look, swap DEFAULT_AVATAR_STYLE for another @dicebear/collection
 * export (e.g. `bottts`, `glass`, `identicon`, `thumbs`, `personas`,
 * `notionists`, `funEmoji`) — the import and this constant are the only edits.
 */
const DEFAULT_AVATAR_STYLE = shapes;

// FORMA-tuned backgrounds so the avatars read as one system on the dark UI.
const BACKGROUND_COLORS = ['052f31', '081f2a', '122b24', '0a2528', '09262b'];

const cache = new Map<string, string>();

export function defaultAvatarDataUri(seed: string | null | undefined): string {
  const key = (seed && seed.trim()) || 'plexus';
  const cached = cache.get(key);
  if (cached) return cached;

  const uri = createAvatar(DEFAULT_AVATAR_STYLE, {
    seed: key,
    backgroundColor: BACKGROUND_COLORS,
    backgroundType: ['gradientLinear', 'solid'],
    radius: 50,
  }).toDataUri();

  cache.set(key, uri);
  return uri;
}
