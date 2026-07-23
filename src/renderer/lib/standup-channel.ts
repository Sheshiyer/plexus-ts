export const STANDUP_CHANNEL_OPTIONS = ['plexus', 'telegram'] as const;
export type StandupChannel = (typeof STANDUP_CHANNEL_OPTIONS)[number];

/**
 * Stored 'paperclip' values migrate to 'telegram' (Hermes delivers to the TG
 * channel). Legacy 'web' was the original stored key for the Plexus option —
 * an explicit user choice that must keep meaning Plexus, not flip to Telegram.
 */
export function normalizeStandupChannel(value: unknown): StandupChannel {
  if (value === 'plexus' || value === 'web') return 'plexus';
  return 'telegram';
}
