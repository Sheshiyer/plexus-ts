import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { derivePresenceMap } from '../../src/renderer/lib/coworkingModel';
import type { FloorPresence } from '../../src/shared/types';

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

function presence(overrides: Partial<FloorPresence> = {}): FloorPresence {
  return {
    identityId: 'identity-alice',
    employeeId: 'employee-alice',
    participantId: null,
    displayName: 'Alice Example',
    initials: 'AE',
    ringState: 'online',
    roomId: null,
    roomName: null,
    projectTag: null,
    isSpeaking: false,
    observedAt: '2026-07-16T10:00:00.000Z',
    lastSeenAt: '2026-07-16T10:00:00.000Z',
    expiresAt: '2026-07-16T10:01:00.000Z',
    activeClientCount: 1,
    presenceProof: 'authenticated_app_lease',
    ...overrides,
  };
}

describe('Coworking live-presence UI semantics', () => {
  it('uses identity as the person key and excludes idle members from live totals', () => {
    const map = derivePresenceMap([
      presence(),
      presence({ identityId: 'identity-idle', displayName: 'Idle Example', ringState: 'idle' }),
    ]);

    expect(map.totalPresent).toBe(1);
    expect(map.zones.find((zone) => zone.key === 'online')?.participants[0]?.participantId)
      .toBe('identity-alice');
  });

  it('labels timer activity as focused and never infers speech from transport', () => {
    const focused = derivePresenceMap([presence({ ringState: 'timing' })]);
    expect(focused.zones.find((zone) => zone.key === 'timing')?.label).toBe('Focused');
    expect(focused.zones.find((zone) => zone.key === 'timing')?.participants[0]?.isSpeaking).toBe(false);

    const model = source('src/renderer/lib/coworkingModel.ts');
    expect(model).toContain('A live audio transport proves publication, not speech.');
    expect(model).toContain('const isSpeaking = false;');
  });

  it('keeps authoritative floor data during refresh failures and keys tiles by identity', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');

    expect(panel).toContain('Keep the last authoritative floor while a refresh is unavailable.');
    expect(panel).not.toMatch(/if \(!result\.ok\) \{[\s\S]*?setFloor\(\[\]\)/);
    expect(stage).toContain('key={presence.identityId}');
    expect(stage).toContain('defaultAvatarDataUri(presence.identityId)');
  });
});
