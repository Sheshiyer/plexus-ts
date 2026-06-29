# Identity Loadout Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a read-only Identity page that presents the member as an AAA-game-style operator loadout with real skills, perks, and Paperclip companion-agent status.

**Architecture:** Extract the existing profile/loadout scoring from `PreferencesPanel` into a reusable renderer helper, then add a new `IdentityPanel` that loads preferences, local settings, Fabric/Paperclip status, bridge status, task assignments, and project evidence in parallel. Mount it as a first-class app tab while keeping editing in Settings and helper/task management in Fabric.

**Tech Stack:** React 18, TypeScript, Electron renderer IPC through `window.plexus`, existing Plexus UI primitives in `src/renderer/components/PlexusUI.tsx`, existing CSS design system in `src/renderer/theme.css`. No new dependencies.

---

## Constraints and source context

- Design doc: `docs/plans/2026-06-29-identity-loadout-design.md`.
- Existing member loadout logic lives in `src/renderer/components/PreferencesPanel.tsx:16-108`.
- Existing model renderer is `src/renderer/components/CharacterModelViewer.tsx`.
- Existing Fabric/Paperclip data is loaded in `src/renderer/components/AgentFabricPanel.tsx`.
- Existing shared types are in `src/shared/types.ts`, especially `PlexusSettings`, `FabricStatus`, `AgentHealth`, `ThoughtseedBridgeStatus`, and `ThoughtseedFabricTask`.
- Existing shell/nav lives in `src/renderer/App.tsx`.
- Existing validation scripts:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build:renderer`
- There is no existing test runner script in `package.json`. Do not add one for this pass. Keep scoring helpers pure so a future test runner can cover them.
- Identity is read-only. Do not add inline profile editing, bridge-token management, task reporting, or admin diagnostics.

---

### Task 1: Extract reusable loadout scoring helper

**Files:**
- Create: `src/renderer/identityLoadout.ts`
- Modify: `src/renderer/components/PreferencesPanel.tsx:16-120`

**Step 1: Create the helper module**

Create `src/renderer/identityLoadout.ts` with this initial shape:

```ts
import type {
  AgentHealth,
  FabricStatus,
  PlexusSettings,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricTask,
} from '../shared/types';
import type { PlexusTone } from './components/PlexusUI';

export type LoadoutStat = {
  key: string;
  label: string;
  value: number;
  hint: string;
};

export type OperatorLoadout = {
  archetype: string;
  commsMode: string;
  focusTokens: string[];
  generatedPrompt: string;
  level: number;
  operatorName: string;
  prompt: string;
  readiness: number;
  reportingLabel: string;
  reportingMode: string;
  stats: LoadoutStat[];
};

export type IdentitySkill = {
  key: 'proofcraft' | 'focus-control' | 'cadence' | 'signal' | 'fabric-command' | 'collaboration' | 'trust';
  label: string;
  value: number;
  hint: string;
  source: string;
  tone: PlexusTone;
  reasons: string[];
};

export type IdentityPerk = {
  key: string;
  label: string;
  active: boolean;
  tone: PlexusTone;
  source: string;
};

export type CompanionAgent = {
  id: string;
  name: string;
  role: string;
  readiness: number;
  tone: PlexusTone;
  statusLabel: string;
  detail: string;
  stats: LoadoutStat[];
};
```

Then move these functions out of `PreferencesPanel.tsx` into this file:

```ts
export const TEST_CHARACTER_MODEL_SRC = `${import.meta.env.BASE_URL}models/meshy-ai-wielder-texture.glb`;

export const toText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const scoreFromText = (value: string, targetLength: number, base = 38) => {
  if (!value) return base;
  return Math.min(99, Math.round(base + (Math.min(value.length, targetLength) / targetLength) * (99 - base)));
};

export const splitTokens = (value: string) => value
  .split(/[,/|]+/)
  .map((token) => token.trim())
  .filter(Boolean)
  .slice(0, 5);
```

Add `getOperatorLoadout(prefs: Record<string, unknown>): OperatorLoadout` by moving the current implementation from `PreferencesPanel`.

**Step 2: Update PreferencesPanel imports**

In `src/renderer/components/PreferencesPanel.tsx`, delete the local `LoadoutStat`, `TEST_CHARACTER_MODEL_SRC`, `toText`, `scoreFromText`, `splitTokens`, and `getOperatorLoadout` definitions.

Add:

```ts
import {
  TEST_CHARACTER_MODEL_SRC,
  getOperatorLoadout,
  toText,
} from '../identityLoadout';
```

Keep `toText` imported because the panel still uses it for `prefs.meshyPrompt`.

**Step 3: Run validation**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both pass. If typecheck fails because `Record<string, any>` and `Record<string, unknown>` disagree, update local state typing in `PreferencesPanel` to `Record<string, unknown>` and use string coercion at the individual field boundaries.

**Step 4: Commit**

```bash
git add src/renderer/identityLoadout.ts src/renderer/components/PreferencesPanel.tsx
git commit -m "refactor: share identity loadout scoring" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Add Identity skill, perk, and companion mapping helpers

**Files:**
- Modify: `src/renderer/identityLoadout.ts`

**Step 1: Add score utilities**

Append these helpers:

```ts
const clampScore = (value: number): number => Math.max(1, Math.min(99, Math.round(value)));

const scoreTone = (value: number): PlexusTone => {
  if (value >= 76) return 'accent';
  if (value >= 52) return 'mint';
  if (value >= 34) return 'warning';
  return 'idle';
};

const hasActiveBridge = (bridge: ThoughtseedBridgeStatus | null): boolean => Boolean(bridge?.connected && bridge.configured);

const completedTasks = (tasks: ThoughtseedFabricTask[]): number => tasks.filter((task) => task.status === 'done').length;

const proofTasks = (tasks: ThoughtseedFabricTask[]): number => tasks.filter((task) => task.evidence.length > 0 || task.evidenceStrength === 'verified_evidence').length;
```

**Step 2: Add skill builder**

Add:

```ts
export function buildIdentitySkills(input: {
  loadout: OperatorLoadout;
  settings: PlexusSettings | null;
  fabric: FabricStatus | null;
  bridge: ThoughtseedBridgeStatus | null;
  tasks: ThoughtseedFabricTask[];
  projectCount: number;
  verifiedProjectCount: number;
  evidenceCoveragePct?: number;
}): IdentitySkill[] {
  const {
    loadout,
    settings,
    fabric,
    bridge,
    tasks,
    projectCount,
    verifiedProjectCount,
    evidenceCoveragePct,
  } = input;
  const healthyAgents = fabric?.summary.healthy ?? 0;
  const totalAgents = fabric?.summary.total ?? 0;
  const taskTotal = tasks.length;
  const done = completedTasks(tasks);
  const withProof = proofTasks(tasks);
  const proofBase = evidenceCoveragePct ?? (projectCount ? (verifiedProjectCount / projectCount) * 100 : 28);
  const fabricBase = totalAgents ? (healthyAgents / totalAgents) * 100 : 24;
  const taskCompletion = taskTotal ? (done / taskTotal) * 100 : 42;
  const taskProof = taskTotal ? (withProof / taskTotal) * 100 : 36;
  const bridgeReady = hasActiveBridge(bridge);
  const cadenceStat = loadout.stats.find((stat) => stat.key === 'cadence')?.value ?? 36;
  const focusStat = loadout.stats.find((stat) => stat.key === 'focus')?.value ?? 38;
  const signalStat = loadout.stats.find((stat) => stat.key === 'signal')?.value ?? 32;
  const trustStat = loadout.stats.find((stat) => stat.key === 'trust')?.value ?? 52;
  const skills: IdentitySkill[] = [
    {
      key: 'proofcraft',
      label: 'Proofcraft',
      value: clampScore(proofBase * 0.7 + taskProof * 0.3),
      hint: `${verifiedProjectCount}/${projectCount || 0} projects verified`,
      source: 'projects + task proof',
      tone: scoreTone(proofBase),
      reasons: ['Verified GitHub projects increase this skill.', 'Task evidence raises the proof modifier.'],
    },
    {
      key: 'focus-control',
      label: 'Focus Control',
      value: clampScore(focusStat),
      hint: loadout.focusTokens.length ? loadout.focusTokens.join(' / ') : 'focus areas pending',
      source: 'member preferences',
      tone: scoreTone(focusStat),
      reasons: ['Focus areas define the member class.', 'More specific work domains improve routing and summaries.'],
    },
    {
      key: 'cadence',
      label: 'Cadence',
      value: clampScore(cadenceStat + (settings?.quietHoursStart ? 4 : 0) + (settings?.rhythmProfile.enabled ? 4 : 0)),
      hint: settings?.rhythmProfile.enabled ? 'rhythm enabled' : 'rhythm paused',
      source: 'preferences + local settings',
      tone: scoreTone(cadenceStat),
      reasons: ['Working hours and standup channel drive the base score.', 'Quiet hours and rhythm support add stability.'],
    },
    {
      key: 'signal',
      label: 'Signal',
      value: clampScore(signalStat + (bridgeReady ? 14 : 0)),
      hint: bridgeReady ? 'bridge connected' : 'bridge unavailable',
      source: 'notes + bridge',
      tone: bridgeReady ? scoreTone(signalStat + 14) : 'warning',
      reasons: ['Private notes provide useful work context.', 'Bridge connectivity improves live task signal.'],
    },
    {
      key: 'fabric-command',
      label: 'Fabric Command',
      value: clampScore(fabricBase),
      hint: totalAgents ? `${healthyAgents}/${totalAgents} companions ready` : 'no companions',
      source: 'Paperclip Fabric',
      tone: totalAgents ? scoreTone(fabricBase) : 'idle',
      reasons: ['Healthy Paperclip agents raise this skill.', 'Stale or unavailable agents lower command readiness.'],
    },
    {
      key: 'collaboration',
      label: 'Collaboration',
      value: clampScore(taskCompletion * 0.6 + (bridgeReady ? 30 : 10)),
      hint: taskTotal ? `${done}/${taskTotal} assignments done` : 'no assignments',
      source: 'task updates + bridge',
      tone: bridgeReady ? scoreTone(taskCompletion) : 'warning',
      reasons: ['Assignments and bridge status reflect workspace flow.', 'Done tasks with proof improve collaboration quality.'],
    },
    {
      key: 'trust',
      label: 'Trust',
      value: clampScore(trustStat + (verifiedProjectCount ? 8 : 0)),
      hint: loadout.reportingLabel,
      source: 'identity + visibility + proof',
      tone: scoreTone(trustStat),
      reasons: ['Verified member identity is the base trust layer.', 'Report visibility and proven projects raise confidence.'],
    },
  ];
  return skills.map((skill) => ({ ...skill, tone: skill.tone ?? scoreTone(skill.value) }));
}
```

**Step 3: Add perks and companion builders**

Add:

```ts
export function buildIdentityPerks(input: {
  settings: PlexusSettings | null;
  fabric: FabricStatus | null;
  bridge: ThoughtseedBridgeStatus | null;
  verifiedProjectCount: number;
  tasks: ThoughtseedFabricTask[];
  reportingLabel: string;
}): IdentityPerk[] {
  const { settings, fabric, bridge, verifiedProjectCount, tasks, reportingLabel } = input;
  const totalAgents = fabric?.summary.total ?? 0;
  const healthyAgents = fabric?.summary.healthy ?? 0;
  return [
    { key: 'github-proof', label: 'GitHub proof linked', active: verifiedProjectCount > 0, tone: verifiedProjectCount > 0 ? 'accent' : 'warning', source: 'Projects' },
    { key: 'bridge', label: 'Bridge connected', active: hasActiveBridge(bridge), tone: hasActiveBridge(bridge) ? 'accent' : 'warning', source: 'Thoughtseed Bridge' },
    { key: 'daily-proof', label: 'Daily proof ready', active: Boolean(fabric?.kpi?.standupCompliant), tone: fabric?.kpi?.standupCompliant ? 'accent' : 'warning', source: 'Standup' },
    { key: 'helpers', label: 'Local helpers available', active: healthyAgents > 0, tone: healthyAgents > 0 ? 'accent' : totalAgents ? 'warning' : 'idle', source: 'Paperclip' },
    { key: 'visibility', label: reportingLabel, active: true, tone: 'mint', source: 'Reports' },
    { key: 'quiet-hours', label: 'Quiet hours enabled', active: Boolean(settings?.quietHoursStart && settings.quietHoursEnd), tone: settings?.quietHoursStart ? 'mint' : 'idle', source: 'Local settings' },
    { key: 'rhythm', label: 'Rhythm enabled', active: Boolean(settings?.rhythmProfile.enabled), tone: settings?.rhythmProfile.enabled ? 'mint' : 'idle', source: 'Private rhythm' },
    { key: 'task-proof', label: 'Assignment proof added', active: proofTasks(tasks) > 0, tone: proofTasks(tasks) > 0 ? 'accent' : 'idle', source: 'Task assignments' },
  ];
}

export function buildCompanionAgents(agents: AgentHealth[]): CompanionAgent[] {
  return agents.map((agent) => {
    const friction = agent.blocked + agent.missingFiles + (agent.status === 'stale' ? 1 : 0);
    const readiness = clampScore((agent.status === 'healthy' ? 76 : agent.status === 'stale' ? 48 : 24) + Math.min(agent.steps, 12) - friction * 6);
    return {
      id: agent.agentId,
      name: agent.agentName,
      role: agent.role || agent.department || 'local helper',
      readiness,
      tone: agent.status === 'healthy' ? 'accent' : agent.status === 'stale' ? 'warning' : 'idle',
      statusLabel: agent.status === 'healthy' ? 'ready' : agent.status === 'stale' ? 'stale link' : 'unavailable',
      detail: agent.lastCycle ? `last cycle ${agent.lastCycle}` : agent.outcome || 'waiting for first cycle',
      stats: [
        { key: 'activity', label: 'Activity', value: clampScore(36 + agent.steps * 5), hint: `${agent.steps} steps` },
        { key: 'friction', label: 'Friction', value: clampScore(99 - friction * 14), hint: friction ? `${friction} blockers/files` : 'clear' },
        { key: 'freshness', label: 'Freshness', value: readiness, hint: agent.staleSeconds ? `${agent.staleSeconds}s stale` : 'current' },
      ],
    };
  });
}
```

**Step 4: Run validation**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both pass.

**Step 5: Commit**

```bash
git add src/renderer/identityLoadout.ts
git commit -m "feat: add identity loadout mappers" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Build the read-only IdentityPanel

**Files:**
- Create: `src/renderer/components/IdentityPanel.tsx`

**Step 1: Create panel skeleton**

Create `src/renderer/components/IdentityPanel.tsx`:

```tsx
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

const verifiedProjectCount = (projects: Project[]): number => projects.filter((project) => project.repoStatus === 'verified').length;

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
            {state.loadedAt && <StatusChip tone="idle">checked {new Date(state.loadedAt).toLocaleTimeString()}</StatusChip>}
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
```

**Step 2: Add child components in the same file**

Append below the default component:

```tsx
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
                <span className="px-character-stat-meter" aria-hidden="true"><i style={{ width: `${skill.value}%` }} /></span>
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
```

Also add `PerkGrid` and `CompanionRoster`:

```tsx
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
  return (
    <InstrumentPanel
      label="paperclip companions"
      title="Companion agents"
      note="Paperclip helpers shown as companion readiness, not diagnostics."
      actions={!fabric || companions.length === 0 ? <Button variant="ghost" onClick={onOpenFabric}><IconBridge s={13} /> Open Fabric</Button> : undefined}
      trace
    >
      {!fabric && (
        <DegradedStatePanel title="Companion link unavailable" message="Fabric status could not be loaded." tone="warning" />
      )}
      {fabric && companions.length === 0 && (
        <EmptyStatePanel icon={<IconBridge s={24} />} title="No local companions available" message="Paperclip has no helper agents available for this workspace." />
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
                <MetricRail key={stat.key} label={stat.label} value={stat.value} hint={stat.hint} tone={stat.key === 'friction' && stat.value < 60 ? 'warning' : agent.tone} />
              ))}
            </MetricRailGroup>
          </article>
        ))}
      </div>
    </InstrumentPanel>
  );
}
```

**Step 3: Run validation**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both pass. Fix any strict TypeScript issues before continuing.

**Step 4: Commit**

```bash
git add src/renderer/components/IdentityPanel.tsx
git commit -m "feat: add identity loadout panel" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Mount Identity in the app shell

**Files:**
- Modify: `src/renderer/App.tsx:1-282`
- Modify: `src/renderer/components/Icons.tsx` only if no suitable identity icon exists

**Step 1: Import IdentityPanel**

Add:

```ts
import IdentityPanel from './components/IdentityPanel';
```

**Step 2: Add the tab**

Change:

```ts
type Tab = 'timer' | 'projects' | 'entries' | 'agents' | 'bridge' | 'realtime' | 'settings' | 'admin';
```

to:

```ts
type Tab = 'timer' | 'identity' | 'projects' | 'entries' | 'agents' | 'bridge' | 'realtime' | 'settings' | 'admin';
```

Add the tab near Focus:

```ts
{ key: 'identity', label: 'Identity', hint: 'operator loadout', Icon: IconUsers },
```

Use `IconUsers` unless a better existing icon exists. Do not add a dependency just for an icon.

**Step 3: Render the panel**

Add below the Focus render block:

```tsx
{tab === 'identity' && (
  <IdentityPanel
    projects={projects}
    onOpenSettings={() => selectTab('settings')}
    onOpenFabric={() => selectTab('bridge')}
  />
)}
```

**Step 4: Consider onboarding landing**

Do not change the post-onboarding landing in this task. Keep `selectTab('timer')` after post-onboarding load. The Identity page should be available from nav first; landing behavior can be changed after user feedback.

**Step 5: Run validation**

Run:

```bash
npm run typecheck
npm run lint
npm run build:renderer
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/Icons.tsx
git commit -m "feat: add identity tab" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

If `Icons.tsx` was not changed, omit it from `git add`.

---

### Task 5: Add Identity page styling

**Files:**
- Modify: `src/renderer/theme.css`

**Step 1: Add desktop styles**

Add a new section near the existing character/profile styles:

```css
/* ---------- identity loadout ---------- */
.px-identity-layout{display:grid;grid-template-columns:minmax(22rem,30rem) minmax(0,1fr);gap:1rem;align-items:start;min-width:0}
.px-identity-stack{display:grid;gap:1rem;min-width:0}
.px-identity-hero{position:relative;overflow:hidden;min-width:0;min-height:42rem;border:1px solid var(--line-2);background:linear-gradient(145deg,rgba(224,255,79,.07),rgba(214,255,246,.025) 42%,rgba(0,20,23,.62));padding:1rem;display:grid;grid-template-rows:auto minmax(18rem,1fr) auto auto;gap:1rem}
.px-identity-skill-list{display:grid;gap:.625rem;min-width:0}
.px-identity-skill-row{appearance:none;display:grid;grid-template-columns:2rem minmax(0,1fr) auto;gap:.75rem;align-items:start;width:100%;min-width:0;border:1px solid var(--line);background:rgba(0,20,23,.22);color:var(--t1);padding:.75rem;text-align:left;cursor:pointer}
.px-identity-skill-row:hover,.px-identity-skill-row.open{border-color:var(--line-hot);background:var(--accent-dim)}
.px-identity-skill-index{font-family:var(--font-mono);font-size:.65rem;color:var(--accent);padding-top:.25rem}
.px-identity-skill-main{display:grid;gap:.3rem;min-width:0}
.px-identity-skill-main strong{font-size:.95rem;font-weight:600;color:var(--mint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-identity-skill-main small,.px-identity-skill-reasons{font-size:.75rem;line-height:1.45;color:var(--t3)}
.px-identity-skill-reasons{display:block;color:var(--t2);overflow-wrap:anywhere}
.px-identity-skill-score{align-self:start}
.px-identity-perk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.625rem;min-width:0}
.px-identity-perk{display:grid;gap:.35rem;min-width:0;border:1px solid var(--line);background:rgba(0,20,23,.18);padding:.7rem}
.px-identity-perk.active{border-color:rgba(224,255,79,.24)}
.px-identity-perk strong{font-size:.8rem;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-identity-perk small{font-family:var(--font-mono);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--t4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-identity-companion-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(17rem,1fr));gap:.75rem;min-width:0}
.px-identity-companion{display:grid;gap:.8rem;min-width:0;border:1px solid var(--line);background:linear-gradient(180deg,rgba(214,255,246,.03),rgba(0,20,23,.18));padding:.85rem}
.px-identity-companion.tone-accent{border-color:rgba(224,255,79,.26)}
.px-identity-companion.tone-warning{border-color:rgba(255,209,102,.24)}
.px-identity-companion-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;min-width:0}
.px-identity-companion-head strong{display:block;margin-top:.25rem;color:var(--mint);font-size:.95rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-identity-companion-head small{display:block;margin-top:.25rem;color:var(--t3);font-size:.72rem;line-height:1.4;overflow-wrap:anywhere}
```

**Step 2: Add responsive styles**

Append:

```css
@media (max-width: 1180px){
  .px-identity-layout{grid-template-columns:1fr}
  .px-identity-hero{min-height:34rem}
}

@media (max-width: 720px){
  .px-identity-hero{min-height:0;grid-template-rows:auto minmax(13rem,18rem) auto auto}
  .px-identity-skill-row{grid-template-columns:1fr}
  .px-identity-skill-score{justify-self:start}
  .px-identity-companion-grid{grid-template-columns:1fr}
  .px-identity-companion-head{display:grid}
}
```

**Step 3: Run renderer build**

Run:

```bash
npm run build:renderer
```

Expected: build succeeds and CSS bundle compiles.

**Step 4: Commit**

```bash
git add src/renderer/theme.css
git commit -m "style: add identity loadout layout" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Final verification and UX sanity pass

**Files:**
- Modify only if validation finds issues:
  - `src/renderer/identityLoadout.ts`
  - `src/renderer/components/IdentityPanel.tsx`
  - `src/renderer/App.tsx`
  - `src/renderer/theme.css`

**Step 1: Run full existing validation**

Run:

```bash
npm run typecheck
npm run lint
npm run build:renderer
npm run build:main
```

Expected: all pass.

**Step 2: Start the app if visual verification is possible**

Run:

```bash
npm run dev
```

Expected: Vite starts on `127.0.0.1:5173` and Electron opens.

**Step 3: Verify core UI states**

Manual checklist:

- Identity appears in the left nav.
- Identity page opens without changing the post-onboarding landing behavior.
- Member hero renders with model, level, core stats, and focus tokens.
- SkillMatrix shows all seven skills.
- Expanding a skill shows score reasoning.
- Perks render as locked/unlocked chips.
- Paperclip companion roster renders agents when Fabric has agents.
- No-agent state says “No local companions available.”
- Fabric failure degrades only the companion section.
- Edit profile opens Settings.
- Open Fabric appears only for degraded/empty companion state.
- Laptop width does not hide skills below an oversized model.

**Step 4: Fix issues surgically**

If any issue appears, patch only the relevant file and re-run:

```bash
npm run typecheck
npm run lint
npm run build:renderer
```

**Step 5: Final commit**

If fixes were needed:

```bash
git add src/renderer/identityLoadout.ts src/renderer/components/IdentityPanel.tsx src/renderer/App.tsx src/renderer/theme.css
git commit -m "fix: polish identity loadout page" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

If no fixes were needed, do not create an empty commit.

