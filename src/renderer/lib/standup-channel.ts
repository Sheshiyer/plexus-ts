export const STANDUP_CHANNEL_OPTIONS = ['plexus', 'telegram'] as const;
export type StandupChannel = (typeof STANDUP_CHANNEL_OPTIONS)[number];

/** Stored 'paperclip' values migrate to 'telegram' (Hermes delivers to the TG channel). */
export function normalizeStandupChannel(value: unknown): StandupChannel {
  if (value === 'plexus') return 'plexus';
  return 'telegram';
}
