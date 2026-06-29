import type {
  AgentHealth,
  FabricStatus,
  PlexusSettings,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricTask,
} from '../shared/types';
import type { PlexusTone } from './components/PlexusUI';

type _IdentityLoadoutSource = AgentHealth | FabricStatus | PlexusSettings | ThoughtseedBridgeStatus | ThoughtseedFabricTask;

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

const clampScore = (value: number): number => Math.max(1, Math.min(99, Math.round(value)));

const scoreTone = (value: number): PlexusTone => {
  if (value >= 76) return 'accent';
  if (value >= 52) return 'mint';
  if (value >= 34) return 'warning';
  return 'idle';
};

const hasActiveBridge = (bridge: ThoughtseedBridgeStatus | null): boolean => (
  Boolean(bridge?.connected && bridge.configured)
);

const completedTasks = (tasks: ThoughtseedFabricTask[]): number => (
  tasks.filter((task) => task.status === 'done').length
);

const proofTasks = (tasks: ThoughtseedFabricTask[]): number => (
  tasks.filter((task) => task.evidence.length > 0 || task.evidenceStrength === 'verified_evidence').length
);

export const getOperatorLoadout = (prefs: Record<string, unknown>): OperatorLoadout => {
  const focusAreas = toText(prefs.focusAreas);
  const workingHours = toText(prefs.workingHours);
  const referral = toText(prefs.referral);
  const notes = toText(prefs.notes);
  const standupChannel = toText(prefs.standupChannel) || 'web';
  const weeklyVisibility = toText(prefs.weeklyVisibility) || 'founder';
  const customPrompt = toText(prefs.meshyPrompt);
  const focusTokens = splitTokens(focusAreas);
  const operatorName = referral || 'Verified member';
  const archetype = focusTokens[0] || 'member';
  const reportingMode = weeklyVisibility === 'team' ? 'team-visible' : weeklyVisibility === 'self' ? 'private' : 'founder-linked';
  const reportingLabel = weeklyVisibility === 'team' ? 'Full team' : weeklyVisibility === 'self' ? 'Self only' : 'Founders only';
  const commsMode = standupChannel === 'telegram' ? 'field comms' : standupChannel === 'paperclip' ? 'paper trail' : 'plexus hub';
  const readiness = [focusAreas, workingHours, referral, notes].filter(Boolean).length;
  const level = Math.max(1, Math.min(99, 1 + readiness * 6 + focusTokens.length * 3));

  const stats: LoadoutStat[] = [
    {
      key: 'focus',
      label: 'Focus',
      value: scoreFromText(focusAreas, 92),
      hint: focusTokens.length ? focusTokens.join(' / ') : 'focus areas pending',
    },
    {
      key: 'cadence',
      label: 'Cadence',
      value: Math.min(99, (workingHours ? 70 : 36) + (standupChannel ? 12 : 0) + (weeklyVisibility ? 10 : 0)),
      hint: workingHours || 'hours not set',
    },
    {
      key: 'signal',
      label: 'Signal',
      value: scoreFromText(notes, 180, 32),
      hint: notes ? 'notes included' : 'notes empty',
    },
    {
      key: 'trust',
      label: 'Trust',
      value: Math.min(99, 52 + (referral ? 18 : 0) + (weeklyVisibility === 'founder' ? 16 : 8) + (notes ? 10 : 0)),
      hint: reportingLabel,
    },
  ];

  const generatedPrompt = [
    `AAA realtime game character portrait of ${operatorName}, a ${archetype} aligned knowledge worker`,
    'full-body 3D model, seated ready pose, premium tactical workspace attire, expressive but professional',
    `visual motifs from ${focusTokens.length ? focusTokens.join(', ') : 'project strategy, focused execution, verified work capture'}`,
    `workspace mood: ${commsMode}, ${reportingLabel.toLowerCase()} sharing, calm profile panels`,
    'Plexus brand palette: gunmetal teal, mint interface light, chartreuse accent, no fantasy armor',
    'clear silhouette, front three-quarter view, neutral background',
  ].join('. ');

  return {
    archetype,
    commsMode,
    focusTokens,
    generatedPrompt,
    level,
    operatorName,
    prompt: customPrompt || generatedPrompt,
    readiness,
    reportingLabel,
    reportingMode,
    stats,
  };
};

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
      value: clampScore(
        cadenceStat + (settings?.quietHoursStart ? 4 : 0) + (settings?.rhythmProfile.enabled ? 4 : 0),
      ),
      hint: settings?.rhythmProfile.enabled ? 'rhythm enabled' : 'rhythm paused',
      source: 'preferences + local settings',
      tone: scoreTone(cadenceStat),
      reasons: [
        'Working hours and standup channel drive the base score.',
        'Quiet hours and rhythm support add stability.',
      ],
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
      reasons: [
        'Assignments and bridge status reflect workspace flow.',
        'Done tasks with proof improve collaboration quality.',
      ],
    },
    {
      key: 'trust',
      label: 'Trust',
      value: clampScore(trustStat + (verifiedProjectCount ? 8 : 0)),
      hint: loadout.reportingLabel,
      source: 'identity + visibility + proof',
      tone: scoreTone(trustStat),
      reasons: [
        'Verified member identity is the base trust layer.',
        'Report visibility and proven projects raise confidence.',
      ],
    },
  ];
  return skills.map((skill) => ({ ...skill, tone: skill.tone ?? scoreTone(skill.value) }));
}

export function buildIdentityPerks(input: {
  settings: PlexusSettings | null;
  fabric: FabricStatus | null;
  bridge: ThoughtseedBridgeStatus | null;
  verifiedProjectCount: number;
  tasks: ThoughtseedFabricTask[];
  reportingLabel: string;
}): IdentityPerk[] {
  const {
    settings,
    fabric,
    bridge,
    verifiedProjectCount,
    tasks,
    reportingLabel,
  } = input;
  const totalAgents = fabric?.summary.total ?? 0;
  const healthyAgents = fabric?.summary.healthy ?? 0;
  return [
    {
      key: 'github-proof',
      label: 'GitHub proof linked',
      active: verifiedProjectCount > 0,
      tone: verifiedProjectCount > 0 ? 'accent' : 'warning',
      source: 'Projects',
    },
    {
      key: 'bridge',
      label: 'Bridge connected',
      active: hasActiveBridge(bridge),
      tone: hasActiveBridge(bridge) ? 'accent' : 'warning',
      source: 'Thoughtseed Bridge',
    },
    {
      key: 'daily-proof',
      label: 'Daily proof ready',
      active: Boolean(fabric?.kpi?.standupCompliant),
      tone: fabric?.kpi?.standupCompliant ? 'accent' : 'warning',
      source: 'Standup',
    },
    {
      key: 'helpers',
      label: 'Local helpers available',
      active: healthyAgents > 0,
      tone: healthyAgents > 0 ? 'accent' : totalAgents ? 'warning' : 'idle',
      source: 'Paperclip',
    },
    {
      key: 'visibility',
      label: reportingLabel,
      active: true,
      tone: 'mint',
      source: 'Reports',
    },
    {
      key: 'quiet-hours',
      label: 'Quiet hours enabled',
      active: Boolean(settings?.quietHoursStart && settings.quietHoursEnd),
      tone: settings?.quietHoursStart ? 'mint' : 'idle',
      source: 'Local settings',
    },
    {
      key: 'rhythm',
      label: 'Rhythm enabled',
      active: Boolean(settings?.rhythmProfile.enabled),
      tone: settings?.rhythmProfile.enabled ? 'mint' : 'idle',
      source: 'Private rhythm',
    },
    {
      key: 'task-proof',
      label: 'Assignment proof added',
      active: proofTasks(tasks) > 0,
      tone: proofTasks(tasks) > 0 ? 'accent' : 'idle',
      source: 'Task assignments',
    },
  ];
}

export function buildCompanionAgents(agents: AgentHealth[]): CompanionAgent[] {
  return agents.map((agent) => {
    const friction = agent.blocked + agent.missingFiles + (agent.status === 'stale' ? 1 : 0);
    const readiness = clampScore(
      (agent.status === 'healthy' ? 76 : agent.status === 'stale' ? 48 : 24)
      + Math.min(agent.steps, 12)
      - friction * 6,
    );
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
        {
          key: 'friction',
          label: 'Friction',
          value: clampScore(99 - friction * 14),
          hint: friction ? `${friction} blockers/files` : 'clear',
        },
        {
          key: 'freshness',
          label: 'Freshness',
          value: readiness,
          hint: agent.staleSeconds ? `${agent.staleSeconds}s stale` : 'current',
        },
      ],
    };
  });
}
