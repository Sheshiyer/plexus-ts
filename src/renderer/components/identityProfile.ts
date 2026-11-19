import type { PlexusSettings, Project, Session } from '../../shared/types';
import { hasVerifiedGitHubRepository } from '../../shared/github-repository-authority';

export type IdentityLoadState = {
  preferences: Record<string, unknown> | null;
  settings: PlexusSettings | null;
  projects: Project[] | null;
  preferencesLoadedAt: string | null;
  settingsLoadedAt: string | null;
  preferencesStale: boolean;
  settingsStale: boolean;
  projectsStale: boolean;
  projectsLoadedAt: string | null;
  errors: string[];
};

export const initialIdentityLoadState = (): IdentityLoadState => ({
  preferences: null,
  settings: null,
  projects: null,
  preferencesLoadedAt: null,
  settingsLoadedAt: null,
  preferencesStale: false,
  settingsStale: false,
  projectsStale: false,
  projectsLoadedAt: null,
  errors: [],
});

const asText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function verifiedRepositoryCount(projects: Project[]): number {
  // A project can be ready without requiring a repository. Count actual repository proof only.
  return projects.filter((project) => hasVerifiedGitHubRepository({ ...project, repoRequired: true })).length;
}

export function initialsForProfile(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ME';
}

export function displayNameForProfile(session: Session, settings: PlexusSettings | null): string {
  return asText(settings?.profile?.displayName) || asText(session.displayName) || 'Your profile';
}

export function preferenceValue(value: unknown, loadedAt: string | null, stale = false): { value: string; detail?: string } {
  const saved = asText(value);
  if (!loadedAt) return { value: 'Unavailable' };
  return {
    value: saved || 'Not set',
    ...(stale ? { detail: `Cached · last read ${new Date(loadedAt).toLocaleTimeString()}. Refresh unavailable.` } : {}),
  };
}

export function reportingPreference(value: unknown, loadedAt: string | null, stale = false): { value: string; detail?: string } {
  const labels: Record<string, string> = { team: 'Full team', self: 'Self only', founder: 'Founders only' };
  const saved = asText(value);
  return preferenceValue(labels[saved], loadedAt, stale);
}

export function mergeIdentityLoad(
  previous: IdentityLoadState,
  preferences: PromiseSettledResult<Record<string, unknown>>,
  settings: PromiseSettledResult<PlexusSettings>,
  loadedAt: string,
  projects?: PromiseSettledResult<Project[]>,
): IdentityLoadState {
  const errors = [
    preferences.status === 'rejected' ? 'Work preferences could not be loaded.' : null,
    settings.status === 'rejected' ? 'Local profile settings could not be loaded.' : null,
    projects?.status === 'rejected' ? 'Projects could not be loaded.' : null,
  ].filter((error): error is string => Boolean(error));
  return {
    preferences: preferences.status === 'fulfilled' ? preferences.value ?? {} : previous.preferences,
    settings: settings.status === 'fulfilled' ? settings.value : previous.settings,
    projects: projects?.status === 'fulfilled' ? projects.value : previous.projects,
    preferencesLoadedAt: preferences.status === 'fulfilled' ? loadedAt : previous.preferencesLoadedAt,
    settingsLoadedAt: settings.status === 'fulfilled' ? loadedAt : previous.settingsLoadedAt,
    preferencesStale: preferences.status === 'rejected' && previous.preferencesLoadedAt !== null,
    settingsStale: settings.status === 'rejected' && previous.settingsLoadedAt !== null,
    projectsLoadedAt: projects?.status === 'fulfilled' ? loadedAt : previous.projectsLoadedAt,
    projectsStale: projects ? projects.status === 'rejected' && previous.projectsLoadedAt !== null : previous.projectsStale,
    errors,
  };
}
