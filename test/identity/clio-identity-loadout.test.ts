import { describe, expect, it } from 'vitest';
import type {
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
};

const bridge: ThoughtseedBridgeStatus = {
  configured: false,
  connected: false,
  bridgeApiUrl: '',
  tenantId: '',
  memberId: '',
};

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

  it('no longer produces a Fabric/Paperclip helper perk (retired surface)', () => {
    const perks = buildIdentityPerks({
      settings,
      bridge,
      verifiedProjectCount: 0,
      tasks,
      reportingLabel: loadout.reportingLabel,
    });

    expect(perks.map((perk) => perk.key)).not.toContain('helpers');
    expect(perks.map((perk) => perk.source).join(' ')).not.toMatch(/Fabric|Paperclip/i);
  });

  it('builds a Clio-first scaffold with no Fabric/Paperclip helper layer', () => {
    const scaffold = buildAgentIdentityScaffold({
      loadout,
      settings,
      bridge,
      projectCount: 4,
      verifiedProjectCount: 2,
    });

    expect(scaffold.assistantName).toBe('Clio');
    expect(scaffold.primaryLayer.label).toBe('Clio identity');
    expect(scaffold.memoryLayer.statusLabel).toBe('local memory on');
    expect(scaffold).not.toHaveProperty('helperLayer');
  });
});
