/** Only display declared text preferences; never coerce objects into profile copy. */
export function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
