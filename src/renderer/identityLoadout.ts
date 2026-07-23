import type {
  MemberKpiSummary,
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
  key: 'proofcraft' | 'focus-control' | 'cadence' | 'signal' | 'clio-memory' | 'collaboration' | 'trust';
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
  statusLabel: string;
  tone: PlexusTone;
  source: string;
};

export type AgentIdentityScaffold = {
  assistantName: 'Clio';
  primaryLayer: {
    label: string;
    detail: string;
    statusLabel: string;
    tone: PlexusTone;
  };
  memoryLayer: {
    label: string;
    detail: string;
    statusLabel: string;
    tone: PlexusTone;
  };
  proofLayer: {
    label: string;
    detail: string;
    statusLabel: string;
    tone: PlexusTone;
  };
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
  bridge: ThoughtseedBridgeStatus | null;
  tasks: ThoughtseedFabricTask[];
  projectCount: number;
  verifiedProjectCount: number;
  evidenceCoveragePct?: number;
}): IdentitySkill[] {
  const {
    loadout,
    settings,
    bridge,
    tasks,
    projectCount,
    verifiedProjectCount,
    evidenceCoveragePct,
  } = input;
  const taskTotal = tasks.length;
  const done = completedTasks(tasks);
  const withProof = proofTasks(tasks);
  const proofBase = evidenceCoveragePct ?? (projectCount ? (verifiedProjectCount / projectCount) * 100 : 28);
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
      hint: bridgeReady ? 'bridge connected' : 'bridge optional',
      source: 'notes + bridge',
      tone: bridgeReady ? scoreTone(signalStat + 14) : scoreTone(signalStat),
      reasons: ['Private notes provide useful work context.', 'Bridge connectivity improves live task signal.'],
    },
    {
      key: 'clio-memory',
      label: 'Clio Memory',
      value: clampScore(
        signalStat * 0.55
        + (settings?.assistantSessionScanEnabled ? 24 : 8)
        + (settings?.profile?.displayName ? 8 : 0)
        + (loadout.focusTokens.length ? 10 : 0),
      ),
      hint: settings?.assistantSessionScanEnabled ? 'local memory on' : 'local memory optional',
      source: 'Clio + local context',
      tone: settings?.assistantSessionScanEnabled ? 'mint' : 'idle',
      reasons: [
        'Clio uses identity preferences and consented local memories for context.',
        'Optional helpers can enrich this layer, but they do not gate Clio readiness.',
      ],
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
  bridge: ThoughtseedBridgeStatus | null;
  verifiedProjectCount: number;
  tasks: ThoughtseedFabricTask[];
  reportingLabel: string;
  kpi: MemberKpiSummary | null;
}): IdentityPerk[] {
  const {
    settings,
    bridge,
    verifiedProjectCount,
    tasks,
    reportingLabel,
    kpi,
  } = input;
  return [
    {
      key: 'github-proof',
      label: 'GitHub proof linked',
      active: verifiedProjectCount > 0,
      statusLabel: verifiedProjectCount > 0 ? 'linked' : 'needs proof',
      tone: verifiedProjectCount > 0 ? 'accent' : 'warning',
      source: 'Projects',
    },
    {
      key: 'bridge',
      label: 'Task updates connected',
      active: hasActiveBridge(bridge),
      statusLabel: hasActiveBridge(bridge) ? 'connected' : 'optional',
      tone: hasActiveBridge(bridge) ? 'accent' : 'warning',
      source: 'Thoughtseed Bridge',
    },
    {
      key: 'daily-proof',
      label: 'Daily proof ready',
      active: Boolean(kpi?.standupCompliant),
      statusLabel: kpi?.standupCompliant ? 'ready' : 'pending',
      tone: kpi?.standupCompliant ? 'accent' : 'warning',
      source: 'Standup',
    },
    {
      key: 'visibility',
      label: reportingLabel,
      active: true,
      statusLabel: 'active',
      tone: 'mint',
      source: 'Reports',
    },
    {
      key: 'quiet-hours',
      label: 'Quiet hours enabled',
      active: Boolean(settings?.quietHoursStart && settings.quietHoursEnd),
      statusLabel: settings?.quietHoursStart ? 'enabled' : 'optional',
      tone: settings?.quietHoursStart ? 'mint' : 'idle',
      source: 'Local settings',
    },
    {
      key: 'rhythm',
      label: 'Rhythm enabled',
      active: Boolean(settings?.rhythmProfile.enabled),
      statusLabel: settings?.rhythmProfile.enabled ? 'enabled' : 'optional',
      tone: settings?.rhythmProfile.enabled ? 'mint' : 'idle',
      source: 'Private rhythm',
    },
    {
      key: 'task-proof',
      label: 'Assignment proof added',
      active: proofTasks(tasks) > 0,
      statusLabel: proofTasks(tasks) > 0 ? 'added' : 'optional',
      tone: proofTasks(tasks) > 0 ? 'accent' : 'idle',
      source: 'Task assignments',
    },
  ];
}

export function buildAgentIdentityScaffold(input: {
  loadout: OperatorLoadout;
  settings: PlexusSettings | null;
  bridge: ThoughtseedBridgeStatus | null;
  projectCount: number;
  verifiedProjectCount: number;
}): AgentIdentityScaffold {
  const {
    loadout,
    settings,
    bridge,
    projectCount,
    verifiedProjectCount,
  } = input;
  const memoryEnabled = settings?.assistantSessionScanEnabled === true || settings?.agentSessionScanEnabled === true;
  const proofLinked = verifiedProjectCount > 0;
  const bridgeReady = hasActiveBridge(bridge);

  return {
    assistantName: 'Clio',
    primaryLayer: {
      label: 'Clio identity',
      detail: `${loadout.operatorName} as ${loadout.archetype} in ${loadout.commsMode}`,
      statusLabel: 'front-facing',
      tone: 'accent',
    },
    memoryLayer: {
      label: 'Local memory',
      detail: memoryEnabled
        ? 'Clio may use consented local session summaries for context.'
        : 'Clio can work without local memory; enable scanning only when useful.',
      statusLabel: memoryEnabled ? 'local memory on' : 'optional',
      tone: memoryEnabled ? 'mint' : 'idle',
    },
    proofLayer: {
      label: 'Work proof',
      detail: proofLinked
        ? `${verifiedProjectCount}/${projectCount || verifiedProjectCount} projects linked for evidence.`
        : 'Project proof improves evidence quality but does not gate Clio identity.',
      statusLabel: proofLinked ? 'linked' : bridgeReady ? 'task updates only' : 'needs proof',
      tone: proofLinked ? 'accent' : 'warning',
    },
  };
}
