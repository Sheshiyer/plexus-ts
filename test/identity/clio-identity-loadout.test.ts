import { describe, expect, it } from 'vitest';
import type {
  FabricStatus,
  PlexusSettings,
  ThoughtseedBridgeStatus,
  ThoughtseedFabricTask,
} from '../../src/shared/types';
import {
  buildAgentIdentityScaffold,
  buildIdentityPerks,
  buildIdentitySkills,
  getOperatorLoadout,
} from '../../src/renderer/identityLoadout';

const settings: PlexusSettings = {
  memberId: 'member_01',
  theme: 'system',
  reminderIntervalMinutes: 25,
  syncEnabled: true,
  soundNotificationsEnabled: true,
  voiceBreakworkEnabled: false,
  notificationVolume: 0.5,
  breakworkSnoozeMinutes: 15,
  breakworkCategories: [],
  rhythmProfile: { enabled: false },
  profile: { displayName: 'Mira Voss' },
  agentSessionScanEnabled: true,
  assistantSessionScanEnabled: true,
  assistantPaperclipEnrichmentEnabled: true,
};

const bridge: ThoughtseedBridgeStatus = {
  configured: false,
  connected: false,
  bridgeApiUrl: '',
  tenantId: '',
  memberId: '',
};

const fabric = (healthy = 0, total = 0): FabricStatus => ({
  checkedAt: '2026-07-06T12:00:00.000Z',
  ports: [],
  agents: [],
  summary: { healthy, total },
  bridge: { reachable: total > 0 },
  safety: {
    mode: 'strict_with_guarded_override',
    targetCompanyId: null,
    targetCompanyName: null,
    targetCompanyPrefix: null,
    selectionSource: 'unknown',
    thoughtseedOrg: null,
    testCompany: null,
    writesAllowed: false,
    reason: 'not configured',
  },
  vault: { standups: 0, handoffs: 0 },
});

const tasks: ThoughtseedFabricTask[] = [];

const loadout = getOperatorLoadout({
  referral: 'Mira Voss',
  focusAreas: 'identity systems, release operations',
  workingHours: '10:00-18:00',
  notes: 'Prefers crisp Clio briefs with local memory context.',
});

describe('Clio identity loadout', () => {
  it('keeps Fabric and Paperclip out of core skill readiness', () => {
    const skills = buildIdentitySkills({
      loadout,
      settings,
      fabric: null,
      bridge,
      tasks,
      projectCount: 0,
      verifiedProjectCount: 0,
    });

    expect(skills.map((skill) => skill.key)).toContain('clio-memory');
    expect(skills.map((skill) => skill.key)).not.toContain('fabric-command');
    expect(skills.map((skill) => skill.label)).not.toContain('Fabric Command');
    expect(skills.map((skill) => skill.source).join(' ')).not.toMatch(/Paperclip Fabric/i);
  });

  it('marks local helpers as optional posture instead of locked capabilities', () => {
    const [helperPerk] = buildIdentityPerks({
      settings,
      fabric: fabric(0, 0),
      bridge,
      verifiedProjectCount: 0,
      tasks,
      reportingLabel: loadout.reportingLabel,
    }).filter((perk) => perk.key === 'helpers');

    expect(helperPerk).toMatchObject({
      label: 'Optional local helpers',
      active: false,
      statusLabel: 'optional',
      source: 'Fabric/Paperclip helpers',
      tone: 'idle',
    });
  });

  it('uses canonical local daily proof instead of the Worker KPI mirror', () => {
    const fabricStatus = fabric(0, 0);
    fabricStatus.dailyProof = {
      ready: true,
      source: 'assistant_local_evidence',
      label: 'assistant proof ready',
      message: 'Persisted standup evidence exists for today.',
    };
    fabricStatus.kpi = {
      todaySeconds: 3600,
      weekSeconds: 7200,
      projectBreakdown: {},
      standupCompliant: false,
    };
    const [dailyProof] = buildIdentityPerks({
      settings,
      fabric: fabricStatus,
      bridge,
      verifiedProjectCount: 0,
      tasks,
      reportingLabel: loadout.reportingLabel,
    }).filter((perk) => perk.key === 'daily-proof');

    expect(dailyProof).toMatchObject({
      active: true,
      statusLabel: 'ready',
      tone: 'accent',
    });
  });

  it('builds a Clio-first scaffold where helpers are accelerators, not constraints', () => {
    const scaffold = buildAgentIdentityScaffold({
      loadout,
      settings,
      fabric: fabric(2, 3),
      bridge,
      projectCount: 4,
      verifiedProjectCount: 2,
    });

    expect(scaffold.assistantName).toBe('Clio');
    expect(scaffold.primaryLayer.label).toBe('Clio identity');
    expect(scaffold.memoryLayer.statusLabel).toBe('local memory on');
    expect(scaffold.helperLayer.posture).toBe('optional_available');
    expect(scaffold.helperLayer.detail).toContain('2/3 optional helpers available');
  });
});
