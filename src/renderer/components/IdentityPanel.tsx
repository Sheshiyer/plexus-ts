import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  FabricStatus,
  PaperclipInstallStatus,
  PlexusSettings,
  Project,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricTask,
} from '../../shared/types';
import { hasVerifiedGitHubRepository } from '../../shared/github-repository-authority';
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
  buildAgentIdentityScaffold,
  buildCompanionAgents,
  buildIdentityPerks,
  buildIdentitySkills,
  getOperatorLoadout,
  toText,
  type AgentIdentityScaffold,
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
  install: PaperclipInstallStatus | null;
  loadedAt: string | null;
  errors: string[];
};

const emptyLoadState = (): LoadState => ({
  preferences: {},
  settings: null,
  fabric: null,
  bridge: null,
  tasks: [],
  install: null,
  loadedAt: null,
  errors: [],
});

const verifiedProjectCount = (projects: Project[]): number => (
  projects.filter(hasVerifiedGitHubRepository).length
);

export default function IdentityPanel({ projects, onOpenSettings, onOpenFabric }: IdentityPanelProps) {
  const [state, setState] = useState<LoadState>(emptyLoadState);
  const [loading, setLoading] = useState(true);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [preferences, settings, fabric, bridge, tasks, install] = await Promise.allSettled([
      window.plexus.memberPreferencesGet(),
      window.plexus.settingsGet(),
      window.plexus.fabricStatus(),
      window.plexus.thoughtseedBridgeStatus(),
      window.plexus.thoughtseedFabricTasks(),
      window.plexus.fabricInstallStatus(),
    ]);
    const errors = [
      preferences.status === 'rejected' ? `profile: ${preferences.reason?.message ?? preferences.reason}` : null,
      settings.status === 'rejected' ? `settings: ${settings.reason?.message ?? settings.reason}` : null,
      fabric.status === 'rejected' ? `fabric: ${fabric.reason?.message ?? fabric.reason}` : null,
      bridge.status === 'rejected' ? `bridge: ${bridge.reason?.message ?? bridge.reason}` : null,
      tasks.status === 'rejected' ? `tasks: ${tasks.reason?.message ?? tasks.reason}` : null,
      // Paperclip install detection is optional; a rejection just means "treat as not installed".
    ].filter((error): error is string => Boolean(error));

    setState({
      preferences: preferences.status === 'fulfilled' ? preferences.value ?? {} : {},
      settings: settings.status === 'fulfilled' ? settings.value : null,
      fabric: fabric.status === 'fulfilled' ? fabric.value : null,
      bridge: bridge.status === 'fulfilled' ? bridge.value : null,
      tasks: tasks.status === 'fulfilled' ? tasks.value.tasks : [],
      install: install.status === 'fulfilled' ? install.value : null,
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
  const scaffold = useMemo(() => buildAgentIdentityScaffold({
    loadout,
    settings: state.settings,
    fabric: state.fabric,
    bridge: state.bridge,
    projectCount: projects.length,
    verifiedProjectCount: verified,
  }), [loadout, projects.length, state.bridge, state.fabric, state.settings, verified]);
  const companions = useMemo(() => buildCompanionAgents(state.fabric?.agents ?? []), [state.fabric]);
  // Paperclip is the local runtime that hosts the optional helper agents. When its
  // binary is absent there are no local helpers, so all Paperclip-related surfaces
  // (helper perk, helper token, companion roster) are hidden entirely.
  const paperclipInstalled = state.install?.binaryFound === true;
  const visiblePerks = useMemo(
    () => (paperclipInstalled ? perks : perks.filter((perk) => perk.key !== 'helpers')),
    [paperclipInstalled, perks],
  );

  if (loading) {
    return (
      <div className="px-fadein">
        <PageHeader title="Identity" sub="Clio identity" />
        <InstrumentPanel label="loading identity" title="Reading Clio identity scaffold" trace>
          <Skeleton lines={6} />
        </InstrumentPanel>
      </div>
    );
  }

  return (
    <div className="px-fadein">
      <PageHeader
        title="Identity"
        sub="Clio identity"
        right={(
          <CommandDock>
            {state.loadedAt && (
              <StatusChip tone="idle">checked {new Date(state.loadedAt).toLocaleTimeString()}</StatusChip>
            )}
            <Button variant="ghost" onClick={load}><IconSync s={13} /> Refresh identity</Button>
            <Button variant="ghost" onClick={onOpenSettings}><IconSettings s={13} /> Edit in Settings</Button>
          </CommandDock>
        )}
      />

      {state.errors.length > 0 && (
        <DegradedStatePanel
          title="Identity context partially loaded"
          message={state.errors.join(' · ')}
          tone="warning"
          lastGoodAt={state.loadedAt}
          onRetry={load}
        />
      )}

      <div className="px-identity-layout">
        <IdentityHero loadout={loadout} scaffold={scaffold} paperclipInstalled={paperclipInstalled} />
        <div className="px-identity-stack">
          <SkillMatrix skills={skills} expandedSkill={expandedSkill} onToggleSkill={setExpandedSkill} />
          <PerkGrid perks={visiblePerks} />
        </div>
      </div>

      {paperclipInstalled && (
        <CompanionRoster companions={companions} fabric={state.fabric} onOpenFabric={onOpenFabric} />
      )}
    </div>
  );
}

function IdentityHero({
  loadout,
  scaffold,
  paperclipInstalled,
}: {
  loadout: ReturnType<typeof getOperatorLoadout>;
  scaffold: AgentIdentityScaffold;
  paperclipInstalled: boolean;
}) {
  const focusTokens = loadout.focusTokens.length ? loadout.focusTokens : ['focus pending'];
  const identityTokens = [
    scaffold.memoryLayer.statusLabel,
    ...(paperclipInstalled ? [scaffold.helperLayer.statusLabel] : []),
    ...focusTokens,
  ];
  return (
    <section className="px-identity-hero" aria-label="Clio identity">
      <div className="px-character-corner tl" aria-hidden="true" />
      <div className="px-character-corner tr" aria-hidden="true" />
      <div className="px-character-corner bl" aria-hidden="true" />
      <div className="px-character-corner br" aria-hidden="true" />
      <div className="px-character-stage-head">
        <div>
          <div className="px-lbl">{scaffold.primaryLayer.label}</div>
          <h3>{loadout.operatorName}</h3>
          <p>{scaffold.primaryLayer.detail}</p>
        </div>
        <div className="px-character-level">
          <span>Clio level</span>
          <strong>{String(loadout.level).padStart(2, '0')}</strong>
        </div>
      </div>
      <div className="px-character-viewport">
        <CharacterModelViewer
          src={TEST_CHARACTER_MODEL_SRC}
          label={`${loadout.operatorName} Clio identity`}
          mode={toText(loadout.prompt) ? 'Clio identity' : 'profile preview'}
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
        {identityTokens.map((token) => (
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
    <InstrumentPanel label="identity scaffold" title="Clio identity signals" note="Stats derived from preferences, proof, local memory, and optional helper context." trace>
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
    <InstrumentPanel label="identity posture" title="Identity posture">
      <div className="px-identity-perk-grid">
        {perks.map((perk) => (
          <div key={perk.key} className={`px-identity-perk ${perk.active ? 'active' : 'optional'}`}>
            <StatusChip tone={perk.tone}>{perk.statusLabel}</StatusChip>
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
  const helperMessage = fabric?.bridge.message ?? 'Helper status is optional and can be refreshed when needed.';

  return (
    <InstrumentPanel
      label="optional local helpers"
      title="Optional local helpers"
      note="Fabric and Paperclip helpers are accelerators for Clio, not requirements for identity or daily work."
      actions={shouldShowFabricAction ? (
        <Button variant="ghost" onClick={onOpenFabric}><IconBridge s={13} /> Open Helpers</Button>
      ) : undefined}
      trace
    >
      {fabricUnavailable && (
        <EmptyStatePanel
          icon={<IconBridge s={24} />}
          title="Optional helpers offline"
          message={helperMessage}
        />
      )}
      {!fabricUnavailable && companions.length === 0 && (
        <EmptyStatePanel
          icon={<IconBridge s={24} />}
          title="No optional helpers available"
          message="Clio remains available without Fabric or Paperclip helper agents."
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
