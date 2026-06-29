import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  FabricStatus,
  PlexusSettings,
  Project,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricTask,
} from '../../shared/types';
import { PageHeader, Button, Skeleton } from './ui';
import { IconBridge, IconSettings, IconSync } from './Icons';
import {
  CommandDock,
  DegradedStatePanel,
  EmptyStatePanel,
  InstrumentPanel,
  MetricRail,
  MetricRailGroup,
  StatusChip,
} from './PlexusUI';
import CharacterModelViewer from './CharacterModelViewer';
import {
  TEST_CHARACTER_MODEL_SRC,
  buildCompanionAgents,
  buildIdentityPerks,
  buildIdentitySkills,
  getOperatorLoadout,
  toText,
  type IdentitySkill,
} from '../identityLoadout';

interface IdentityPanelProps {
  projects: Project[];
  onOpenSettings: () => void;
  onOpenFabric: () => void;
}

type LoadState = {
  preferences: Record<string, unknown>;
  settings: PlexusSettings | null;
  fabric: FabricStatus | null;
  bridge: ThoughtseedBridgeStatus | null;
  tasks: ThoughtseedFabricTask[];
  loadedAt: string | null;
  errors: string[];
};

const emptyLoadState = (): LoadState => ({
  preferences: {},
  settings: null,
  fabric: null,
  bridge: null,
  tasks: [],
  loadedAt: null,
  errors: [],
});

const verifiedProjectCount = (projects: Project[]): number => (
  projects.filter((project) => project.repoEvidenceStatus === 'verified').length
);

export default function IdentityPanel({ projects, onOpenSettings, onOpenFabric }: IdentityPanelProps) {
  const [state, setState] = useState<LoadState>(emptyLoadState);
  const [loading, setLoading] = useState(true);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [preferences, settings, fabric, bridge, tasks] = await Promise.allSettled([
      window.plexus.memberPreferencesGet(),
      window.plexus.settingsGet(),
      window.plexus.fabricStatus(),
      window.plexus.thoughtseedBridgeStatus(),
      window.plexus.thoughtseedFabricTasks(),
    ]);
    const errors = [
      preferences.status === 'rejected' ? `profile: ${preferences.reason?.message ?? preferences.reason}` : null,
      settings.status === 'rejected' ? `settings: ${settings.reason?.message ?? settings.reason}` : null,
      fabric.status === 'rejected' ? `fabric: ${fabric.reason?.message ?? fabric.reason}` : null,
      bridge.status === 'rejected' ? `bridge: ${bridge.reason?.message ?? bridge.reason}` : null,
      tasks.status === 'rejected' ? `tasks: ${tasks.reason?.message ?? tasks.reason}` : null,
    ].filter((error): error is string => Boolean(error));

    setState({
      preferences: preferences.status === 'fulfilled' ? preferences.value ?? {} : {},
      settings: settings.status === 'fulfilled' ? settings.value : null,
      fabric: fabric.status === 'fulfilled' ? fabric.value : null,
      bridge: bridge.status === 'fulfilled' ? bridge.value : null,
      tasks: tasks.status === 'fulfilled' ? tasks.value.tasks : [],
      loadedAt: new Date().toISOString(),
      errors,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadout = useMemo(() => getOperatorLoadout(state.preferences), [state.preferences]);
  const verified = verifiedProjectCount(projects);
  const skills = useMemo(() => buildIdentitySkills({
    loadout,
    settings: state.settings,
    fabric: state.fabric,
    bridge: state.bridge,
    tasks: state.tasks,
    projectCount: projects.length,
    verifiedProjectCount: verified,
  }), [loadout, projects.length, state.bridge, state.fabric, state.settings, state.tasks, verified]);
  const perks = useMemo(() => buildIdentityPerks({
    settings: state.settings,
    fabric: state.fabric,
    bridge: state.bridge,
    verifiedProjectCount: verified,
    tasks: state.tasks,
    reportingLabel: loadout.reportingLabel,
  }), [loadout.reportingLabel, state.bridge, state.fabric, state.settings, state.tasks, verified]);
  const companions = useMemo(() => buildCompanionAgents(state.fabric?.agents ?? []), [state.fabric]);

  if (loading) {
    return (
      <div className="px-fadein">
        <PageHeader title="Identity" sub="operator loadout" />
        <InstrumentPanel label="loading identity" title="Reading member loadout" trace>
          <Skeleton lines={6} />
        </InstrumentPanel>
      </div>
    );
  }

  return (
    <div className="px-fadein">
      <PageHeader
        title="Identity"
        sub="operator loadout"
        right={(
          <CommandDock>
            {state.loadedAt && (
              <StatusChip tone="idle">checked {new Date(state.loadedAt).toLocaleTimeString()}</StatusChip>
            )}
            <Button variant="ghost" onClick={load}><IconSync s={13} /> Refresh loadout</Button>
            <Button variant="ghost" onClick={onOpenSettings}><IconSettings s={13} /> Edit in Settings</Button>
          </CommandDock>
        )}
      />

      {state.errors.length > 0 && (
        <DegradedStatePanel
          title="Loadout partially degraded"
          message={state.errors.join(' · ')}
          tone="warning"
          lastGoodAt={state.loadedAt}
          onRetry={load}
        />
      )}

      <div className="px-identity-layout">
        <IdentityHero loadout={loadout} />
        <div className="px-identity-stack">
          <SkillMatrix skills={skills} expandedSkill={expandedSkill} onToggleSkill={setExpandedSkill} />
          <PerkGrid perks={perks} />
        </div>
      </div>

      <CompanionRoster companions={companions} fabric={state.fabric} onOpenFabric={onOpenFabric} />
    </div>
  );
}

function IdentityHero({ loadout }: { loadout: ReturnType<typeof getOperatorLoadout> }) {
  return (
    <section className="px-identity-hero" aria-label="Member loadout">
      <div className="px-character-corner tl" aria-hidden="true" />
      <div className="px-character-corner tr" aria-hidden="true" />
      <div className="px-character-corner bl" aria-hidden="true" />
      <div className="px-character-corner br" aria-hidden="true" />
      <div className="px-character-stage-head">
        <div>
          <div className="px-lbl">Verified member</div>
          <h3>{loadout.operatorName}</h3>
          <p>{loadout.archetype} / {loadout.commsMode}</p>
        </div>
        <div className="px-character-level">
          <span>Level</span>
          <strong>{String(loadout.level).padStart(2, '0')}</strong>
        </div>
      </div>
      <div className="px-character-viewport">
        <CharacterModelViewer
          src={TEST_CHARACTER_MODEL_SRC}
          label={`${loadout.operatorName} identity loadout`}
          mode={toText(loadout.prompt) ? 'identity loadout' : 'profile preview'}
        />
      </div>
      <div className="px-character-stat-grid">
        {loadout.stats.map((stat) => (
          <div key={stat.key} className="px-character-stat">
            <div className="px-character-stat-top">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
            <div className="px-character-stat-meter" aria-hidden="true">
              <i style={{ width: `${stat.value}%` }} />
            </div>
            <small>{stat.hint}</small>
          </div>
        ))}
      </div>
      <div className="px-character-token-row">
        {(loadout.focusTokens.length ? loadout.focusTokens : ['focus pending']).map((token) => (
          <span key={token}>{token}</span>
        ))}
      </div>
    </section>
  );
}

function SkillMatrix({
  skills,
  expandedSkill,
  onToggleSkill,
}: {
  skills: IdentitySkill[];
  expandedSkill: string | null;
  onToggleSkill: (skill: string | null) => void;
}) {
  return (
    <InstrumentPanel label="skill matrix" title="Available skills" note="Game-style stats derived from real Plexus state." trace>
      <div className="px-identity-skill-list">
        {skills.map((skill, index) => {
          const open = expandedSkill === skill.key;
          return (
            <button
              key={skill.key}
              type="button"
              className={`px-identity-skill-row${open ? ' open' : ''}`}
              onClick={() => onToggleSkill(open ? null : skill.key)}
              aria-expanded={open}
            >
              <span className="px-identity-skill-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="px-identity-skill-main">
                <span className="px-lbl">{skill.source}</span>
                <strong>{skill.label}</strong>
                <small>{skill.hint}</small>
                <span className="px-character-stat-meter" aria-hidden="true">
                  <i style={{ width: `${skill.value}%` }} />
                </span>
                {open && <span className="px-identity-skill-reasons">{skill.reasons.join(' ')}</span>}
              </span>
              <span className="px-identity-skill-score">
                <StatusChip tone={skill.tone}>{skill.value}</StatusChip>
              </span>
            </button>
          );
        })}
      </div>
    </InstrumentPanel>
  );
}

function PerkGrid({ perks }: { perks: ReturnType<typeof buildIdentityPerks> }) {
  return (
    <InstrumentPanel label="loadout perks" title="Unlocked capabilities">
      <div className="px-identity-perk-grid">
        {perks.map((perk) => (
          <div key={perk.key} className={`px-identity-perk ${perk.active ? 'active' : 'locked'}`}>
            <StatusChip tone={perk.tone}>{perk.active ? 'unlocked' : 'locked'}</StatusChip>
            <strong>{perk.label}</strong>
            <small>{perk.source}</small>
          </div>
        ))}
      </div>
    </InstrumentPanel>
  );
}

function CompanionRoster({
  companions,
  fabric,
  onOpenFabric,
}: {
  companions: ReturnType<typeof buildCompanionAgents>;
  fabric: FabricStatus | null;
  onOpenFabric: () => void;
}) {
  const fabricUnavailable = !fabric || !fabric.bridge.reachable;
  const shouldShowFabricAction = fabricUnavailable || companions.length === 0;
  const degradedMessage = fabric?.bridge.message ?? 'Fabric status could not be loaded.';

  return (
    <InstrumentPanel
      label="paperclip companions"
      title="Companion agents"
      note="Paperclip helpers shown as companion readiness, not diagnostics."
      actions={shouldShowFabricAction ? (
        <Button variant="ghost" onClick={onOpenFabric}><IconBridge s={13} /> Open Fabric</Button>
      ) : undefined}
      trace
    >
      {fabricUnavailable && (
        <DegradedStatePanel title="Companion link unavailable" message={degradedMessage} tone="warning" />
      )}
      {!fabricUnavailable && companions.length === 0 && (
        <EmptyStatePanel
          icon={<IconBridge s={24} />}
          title="No local companions available"
          message="Paperclip has no helper agents available for this workspace."
        />
      )}
      <div className="px-identity-companion-grid">
        {companions.map((agent) => (
          <article key={agent.id} className={`px-identity-companion tone-${agent.tone}`}>
            <div className="px-identity-companion-head">
              <div>
                <div className="px-lbl">{agent.role}</div>
                <strong>{agent.name}</strong>
                <small>{agent.detail}</small>
              </div>
              <StatusChip tone={agent.tone}>{agent.statusLabel}</StatusChip>
            </div>
            <MetricRailGroup>
              {agent.stats.map((stat) => (
                <MetricRail
                  key={stat.key}
                  label={stat.label}
                  value={stat.value}
                  hint={stat.hint}
                  tone={stat.key === 'friction' && stat.value < 60 ? 'warning' : agent.tone}
                />
              ))}
            </MetricRailGroup>
          </article>
        ))}
      </div>
    </InstrumentPanel>
  );
}
