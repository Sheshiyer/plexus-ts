import type { PlexusSettings } from '../shared/types';

export type ThemePreference = PlexusSettings['theme'];
export type EffectiveTheme = 'dark' | 'light';

export function resolveThemePreference(preference: ThemePreference): EffectiveTheme {
  if (preference === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return preference;
}

export function applyThemePreference(preference: ThemePreference): EffectiveTheme {
  const effective = resolveThemePreference(preference);
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = effective;
  return effective;
}
