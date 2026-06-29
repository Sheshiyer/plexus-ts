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
