import { describe, expect, it } from 'vitest';
import type { PlexusSettings, Project, Session } from '../../src/shared/types';
import {
  displayNameForProfile,
  initialIdentityLoadState,
  mergeIdentityLoad,
  preferenceValue,
  reportingPreference,
  verifiedRepositoryCount,
} from '../../src/renderer/components/identityProfile';

const session = { identityId: 'member-a', displayName: 'Mira Voss', email: 'mira@example.com' } as Session;
const settings = { syncEnabled: true, profile: { displayName: 'Local profile' } } as PlexusSettings;

describe('member identity profile state', () => {
  it('uses a real session name and only falls back when it is missing', () => {
    expect(displayNameForProfile(session, settings)).toBe('Local profile');
    expect(displayNameForProfile({ ...session, displayName: '  ' }, settings)).toBe('Local profile');
    expect(displayNameForProfile({ ...session, displayName: '  ' }, null)).toBe('Your profile');
  });

  it('distinguishes saved-empty, unavailable, cached, and malformed preference values', () => {
    expect(preferenceValue('', '2026-09-12T10:00:00.000Z')).toEqual({ value: 'Not set' });
    expect(preferenceValue(undefined, null)).toEqual({ value: 'Unavailable' });
    expect(preferenceValue('Research', null)).toEqual({ value: 'Unavailable' });
    expect(preferenceValue({ unexpected: true }, '2026-09-12T10:00:00.000Z')).toEqual({ value: 'Not set' });
    expect(reportingPreference('bogus', '2026-09-12T10:00:00.000Z')).toEqual({ value: 'Not set' });
  });

  it('retains prior source data and timestamps when only one refresh source fails', () => {
    const previous = { ...initialIdentityLoadState(), preferences: { focusAreas: 'Research' }, preferencesLoadedAt: '2026-09-12T09:00:00.000Z' };
    const result = mergeIdentityLoad(previous, { status: 'rejected', reason: new Error('offline') }, { status: 'fulfilled', value: settings }, '2026-09-12T10:00:00.000Z');
    expect(result.preferences).toEqual({ focusAreas: 'Research' });
    expect(result.preferencesLoadedAt).toBe('2026-09-12T09:00:00.000Z');
    expect(result.settingsLoadedAt).toBe('2026-09-12T10:00:00.000Z');
    expect(result.errors).toEqual(['Work preferences could not be loaded.']);
    expect(result.preferencesStale).toBe(true);
    expect(result.settingsStale).toBe(false);
    expect(preferenceValue(result.preferences?.focusAreas, result.preferencesLoadedAt, result.preferencesStale)).toMatchObject({
      value: 'Research', detail: expect.stringContaining('Cached'),
    });
    const recovered = mergeIdentityLoad(result, { status: 'fulfilled', value: {} }, { status: 'fulfilled', value: settings }, '2026-09-12T11:00:00.000Z');
    expect(recovered.preferencesStale).toBe(false);
    expect(preferenceValue(recovered.preferences?.focusAreas, recovered.preferencesLoadedAt, recovered.preferencesStale)).toEqual({ value: 'Not set' });
  });

  it('starts a new identity with no retained actor data', () => {
    const nextActor = initialIdentityLoadState();
    expect(nextActor.preferences).toBeNull();
    expect(nextActor.settings).toBeNull();
    expect(nextActor.preferencesLoadedAt).toBeNull();
    expect(nextActor.errors).toEqual([]);
  });

  it('keeps failed project reads distinct from a successful empty workspace', () => {
    const failed = mergeIdentityLoad(initialIdentityLoadState(), { status: 'fulfilled', value: {} }, { status: 'fulfilled', value: settings }, '2026-09-12T10:00:00Z', { status: 'rejected', reason: new Error('offline') });
    expect(failed.projects).toBeNull();
    expect(failed.projectsLoadedAt).toBeNull();
    const empty = mergeIdentityLoad(failed, { status: 'fulfilled', value: {} }, { status: 'fulfilled', value: settings }, '2026-09-12T11:00:00Z', { status: 'fulfilled', value: [] });
    expect(empty.projects).toEqual([]);
    expect(empty.projectsLoadedAt).toBe('2026-09-12T11:00:00Z');
  });

  it('does not count repository-exempt projects as verified repositories', () => {
    const exempt = { id: 'no-repository', repoRequired: false } as Project;
    const verified = { id: 'verified', githubRepoId: '12', githubRepoUrl: 'https://github.com/example/work', githubRepoFullName: 'example/work', repoVerifiedAt: '2026-09-12T10:00:00Z', repoEvidenceStatus: 'verified' } as Project;
    expect(verifiedRepositoryCount([exempt, verified])).toBe(1);
  });
});
