import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const lifecycleState = vi.hoisted(() => ({
  settings: new Map<string, string | null>(),
  runningEntry: null as null | {
    id: string;
    projectId: string;
    startTime: string;
    pausedAt?: string | null;
  },
}));

vi.mock('../../src/db/database.js', () => ({
  getSetting: vi.fn(async (key: string) => lifecycleState.settings.get(key) ?? ''),
  setSetting: vi.fn(async (key: string, value: string) => {
    lifecycleState.settings.set(key, value);
  }),
  getRunningEntry: vi.fn(async () => lifecycleState.runningEntry),
}));

vi.mock('../../src/main/teamforge.js', () => ({
  getSession: vi.fn(async () => ({ identityId: 'pid_alice' })),
  openCoworkingPresenceSession: vi.fn(async () => ({
    ok: true,
    presenceSessionId: 'presence_session_in_memory',
  })),
  heartbeatCoworkingPresence: vi.fn(async () => ({ ok: true })),
  disconnectCoworkingPresence: vi.fn(async () => ({ ok: true, disconnected: true })),
}));

afterEach(() => {
  lifecycleState.settings = new Map();
  lifecycleState.runningEntry = null;
  vi.resetModules();
});

describe('Coworking presence production lifecycle contract', () => {
  it('persists and reuses only the stable installation identifier', async () => {
    const {
      getCoworkingPresenceClientInstanceId,
      heartbeatCoworkingPresenceNow,
      stopCoworkingPresence,
    } = await import('../../src/main/coworking-presence');

    const first = await getCoworkingPresenceClientInstanceId();
    const second = await getCoworkingPresenceClientInstanceId();
    await heartbeatCoworkingPresenceNow();
    stopCoworkingPresence();

    expect(first).toMatch(/^plexus_presence_/);
    expect(second).toBe(first);
    expect(lifecycleState.settings.get('tf.coworkingPresenceClientInstanceId')).toBe(first);
    expect([...lifecycleState.settings.values()]).not.toContain('presence_session_in_memory');
  });

  it('composes actual unpaused timer truth into a roomless main-process heartbeat', async () => {
    lifecycleState.runningEntry = {
      id: 'entry_alpha',
      projectId: 'project_alpha',
      startTime: '2026-07-16T09:30:00.000Z',
      pausedAt: null,
    };
    const teamforge = await import('../../src/main/teamforge.js');
    const {
      heartbeatCoworkingPresenceNow,
      stopCoworkingPresence,
    } = await import('../../src/main/coworking-presence');

    await heartbeatCoworkingPresenceNow();
    expect(teamforge.heartbeatCoworkingPresence).toHaveBeenCalledWith({
      clientInstanceId: expect.stringMatching(/^plexus_presence_/),
      presenceSessionId: 'presence_session_in_memory',
      sequence: 1,
      activity: {
        state: 'focused',
        timerEntryId: 'entry_alpha',
        projectId: 'project_alpha',
        timerStartedAt: '2026-07-16T09:30:00.000Z',
      },
    });
    expect(vi.mocked(teamforge.heartbeatCoworkingPresence).mock.calls[0]?.[0]).not.toHaveProperty('room');
    stopCoworkingPresence();
  });

  it('wires startup, auth rotation, refresh, resume, bounded logout, and quit in main authority', () => {
    const main = source('src/main/main.ts');
    const windowAllClosed = main.match(/app\.on\('window-all-closed',[\s\S]*?\n\}\);/)?.[0] ?? '';

    expect(main).toMatch(/startupGate\.runStep\(\(\) => getDb\(\)\);[\s\S]*?startupGate\.runStep\([\s\S]*?startCoworkingPresence\(\)[\s\S]*?createWindow\(\);/);
    expect(main).toMatch(/powerMonitor\.on\('resume',[\s\S]*?heartbeatCoworkingPresenceNow/);
    expect(main).toMatch(/auth:login[\s\S]*?res\.ok[\s\S]*?restartCoworkingPresenceSession/);
    expect(main).toMatch(/auth:accessLogin[\s\S]*?res\.ok[\s\S]*?restartCoworkingPresenceSession/);
    expect(main).toMatch(/auth:refreshSession[\s\S]*?result\.ok[\s\S]*?heartbeatCoworkingPresenceNow/);
    expect(main).toMatch(/auth:logout[\s\S]*?disconnectCoworkingPresenceForLogout[\s\S]*?logout\(\)/);
    expect(main).toMatch(/before-quit[\s\S]*?stopCoworkingPresence\(\)[\s\S]*?disconnectCoworkingPresenceNow/);
    expect(windowAllClosed).not.toContain('stopCoworkingPresence');
  });

  it('injects both main-only lease identifiers into realtime join and owns no room-context mirror', () => {
    const main = source('src/main/main.ts');
    const types = source('src/shared/types.ts');
    const joinInput = types.match(/export interface RealtimeJoinInput \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(joinInput).not.toContain('clientInstanceId');
    expect(joinInput).not.toContain('presenceSessionId');
    expect(main).toMatch(/realtime:joinRoom[\s\S]*?currentCoworkingPresenceSession\(\)[\s\S]*?clientInstanceId[\s\S]*?presenceSessionId/);
    expect(main).not.toMatch(/setCoworkingPresenceRoomContext/);
  });

  it('keeps heartbeat, stable client, and process session authority out of renderer and preload', () => {
    const preload = source('src/preload/preload.ts');
    const renderer = source('src/renderer/components/CoWorkingPanel.tsx');

    for (const candidate of [preload, renderer]) {
      expect(candidate).not.toMatch(/coworkingPresenceHeartbeat|presence:heartbeat|heartbeatCoworkingPresence/);
      expect(candidate).not.toContain('presenceSessionId');
    }
    expect(renderer).not.toContain("newLocalId('coworking')");
    expect(renderer).not.toMatch(/clientInstanceId:\s*coworking/);
  });
});
