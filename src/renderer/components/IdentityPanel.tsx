import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '../../shared/types';
import { Button, PageHeader, Skeleton } from './ui';
import { IconSettings, IconSync } from './Icons';
import { CommandDock, DegradedStatePanel } from './PlexusUI';
import {
  displayNameForProfile,
  initialsForProfile,
  initialIdentityLoadState,
  mergeIdentityLoad,
  preferenceValue,
  reportingPreference,
  verifiedRepositoryCount,
} from './identityProfile';
import './IdentityPanel.css';

interface IdentityPanelProps {
  session: Session;
  onOpenSettings: () => void;
  onOpenProjects?: () => void;
}

export default function IdentityPanel({ session, onOpenSettings, onOpenProjects }: IdentityPanelProps) {
  const [state, setState] = useState(initialIdentityLoadState);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    const [preferences, settings, projects] = await Promise.allSettled([
      window.plexus.memberPreferencesGet(),
      window.plexus.settingsGet(),
      window.plexus.projectList(),
    ]);
    if (!mounted.current || currentRequest !== requestId.current) return;

    setState((previous) => mergeIdentityLoad(previous, preferences, settings, new Date().toISOString(), projects));
    setLoading(false);
  }, []);

  useEffect(() => {
    requestId.current += 1;
    setState(initialIdentityLoadState());
    setLoading(true);
    void load();
  }, [load, session.identityId]);

  const displayName = displayNameForProfile(session, state.settings);
  const verifiedRepositories = state.projects ? verifiedRepositoryCount(state.projects) : null;
  const projectDetail = state.projectsStale
    ? `Cached · last read ${new Date(state.projectsLoadedAt!).toLocaleTimeString()}. Refresh unavailable.`
    : undefined;
  const focusAreas = preferenceValue(state.preferences?.focusAreas, state.preferencesLoadedAt, state.preferencesStale);
  const workHours = preferenceValue(state.preferences?.workingHours, state.preferencesLoadedAt, state.preferencesStale);
  const reporting = reportingPreference(state.preferences?.weeklyVisibility, state.preferencesLoadedAt, state.preferencesStale);
  const lastGoodAt = [state.preferencesLoadedAt, state.settingsLoadedAt, state.projectsLoadedAt]
    .filter((value): value is string => value !== null).sort().at(-1) ?? null;

  if (loading && !lastGoodAt) {
    return (
      <div className="px-fadein">
        <PageHeader title="Identity" sub="member profile" />
        <div className="px-identity-loading"><Skeleton lines={5} /></div>
      </div>
    );
  }

  return (
    <div className="px-fadein px-identity-page">
      <PageHeader
        title="Identity"
        sub="member profile"
        right={(
          <CommandDock>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              <IconSync s={13} /> {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="accent" onClick={onOpenSettings}>
              <IconSettings s={13} /> Edit preferences
            </Button>
          </CommandDock>
        )}
      />

      {state.errors.length > 0 && (
        <DegradedStatePanel
          title="Some identity details are unavailable"
          message={state.errors.join(' · ')}
          tone="warning"
          lastGoodAt={lastGoodAt}
          onRetry={() => void load()}
          busy={loading}
        />
      )}

      <section className="px-identity-member" aria-label="Member profile">
        <div className="px-identity-initials" aria-hidden="true">{initialsForProfile(displayName)}</div>
        <div className="px-identity-member-copy">
          <div className="px-identity-kicker">Member</div>
          <h2>{displayName}</h2>
          <p>{session.role === 'admin' ? 'Admin' : 'Member'} · {session.email}</p>
          {state.settingsStale && <p className="px-identity-cached">Profile cached · last read {new Date(state.settingsLoadedAt!).toLocaleTimeString()}</p>}
        </div>
      </section>

      <div className="px-identity-content">
        <section className="px-identity-group" aria-labelledby="identity-preferences-title">
          <div className="px-identity-group-head">
            <div>
              <div className="px-identity-kicker">Preferences</div>
              <h3 id="identity-preferences-title">How you work</h3>
            </div>
          </div>
          <dl className="px-identity-definition-list">
            <DefinitionRow label="Focus areas" {...focusAreas} emptyHint="Add focus areas in Settings to make this useful." />
            <DefinitionRow label="Work hours" {...workHours} emptyHint="Set your working hours in Settings." />
            <DefinitionRow label="Weekly reporting" {...reporting} emptyHint="Choose who can see your weekly report in Settings." />
          </dl>
        </section>

        <section className="px-identity-group" aria-labelledby="identity-work-title">
          <div className="px-identity-group-head">
            <div>
              <div className="px-identity-kicker">Work connections</div>
              <h3 id="identity-work-title">Available context</h3>
            </div>
            {onOpenProjects && <Button variant="ghost" onClick={onOpenProjects}>Open projects</Button>}
          </div>
          <dl className="px-identity-definition-list">
            <DefinitionRow label="Project access" value={state.projects ? `${state.projects.length} ${state.projects.length === 1 ? 'project' : 'projects'}` : 'Unavailable'} detail={projectDetail} />
            <DefinitionRow label="Verified repositories" value={verifiedRepositories === null ? 'Unavailable' : `${verifiedRepositories} ${verifiedRepositories === 1 ? 'repository' : 'repositories'}`} detail={projectDetail} />
            <DefinitionRow
              label="Workspace sync"
              value={state.settingsLoadedAt ? (state.settings?.syncEnabled ? 'Enabled' : 'Paused') : 'Unavailable'}
              detail={state.settingsStale
                ? `Cached · last read ${new Date(state.settingsLoadedAt!).toLocaleTimeString()}. Refresh unavailable.`
                : state.settingsLoadedAt ? 'Preference for this device; not a connection check.' : 'Could not read local settings.'}
            />
          </dl>
        </section>
      </div>
    </div>
  );
}

function DefinitionRow({ label, value, detail, emptyHint }: { label: string; value: string; detail?: string; emptyHint?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {(detail || (value === 'Not set' ? emptyHint : undefined)) && <small>{detail || emptyHint}</small>}
      </dd>
    </div>
  );
}
