import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CoworkingPresenceHeartbeatInput,
  PresenceControllerDependencies,
  PresenceTimerSnapshot,
} from '../../src/main/coworking-presence-controller';

afterEach(() => {
  vi.useRealTimers();
});

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function makeControllerHarness(overrides: {
  session?: unknown | null;
  timer?: PresenceTimerSnapshot | null;
  openSession?: PresenceControllerDependencies['openSession'];
  sendHeartbeat?: PresenceControllerDependencies['sendHeartbeat'];
  disconnect?: PresenceControllerDependencies['disconnect'];
} = {}) {
  const openSession = vi.fn(overrides.openSession ?? (async () => ({
    ok: true as const,
    presenceSessionId: 'presence_session_alpha',
  })));
  const sendHeartbeat = vi.fn(overrides.sendHeartbeat ?? (async () => ({ ok: true as const })));
  const disconnect = vi.fn(overrides.disconnect ?? (async () => ({ ok: true as const })));
  let session = overrides.session === undefined ? { identityId: 'pid_alice' } : overrides.session;
  let timer = overrides.timer === undefined ? null : overrides.timer;

  return {
    openSession,
    sendHeartbeat,
    disconnect,
    setSession(next: unknown | null) { session = next; },
    setTimer(next: PresenceTimerSnapshot | null) { timer = next; },
    async controller() {
      const { createCoworkingPresenceController } = await import('../../src/main/coworking-presence-controller');
      return createCoworkingPresenceController({
        clientInstanceId: 'installation_alpha',
        getSession: async () => session,
        getTimerSnapshot: async () => timer,
        openSession,
        sendHeartbeat,
        disconnect,
      });
    },
  };
}

describe('pure Coworking presence controller', () => {
  it('opens one process session, sends immediately, and follows the fixed fifteen-second cadence', async () => {
    vi.useFakeTimers();
    const harness = makeControllerHarness();
    const controller = await harness.controller();
    const { PRESENCE_HEARTBEAT_INTERVAL_MS } = await import('../../src/main/coworking-presence-controller');

    expect(PRESENCE_HEARTBEAT_INTERVAL_MS).toBe(15_000);
    controller.start();
    controller.start();
    await flushPromises();
    expect(harness.openSession).toHaveBeenCalledOnce();
    expect(harness.openSession).toHaveBeenCalledWith('installation_alpha');
    expect(harness.sendHeartbeat).toHaveBeenCalledTimes(1);
    expect(harness.sendHeartbeat).toHaveBeenLastCalledWith({
      clientInstanceId: 'installation_alpha',
      presenceSessionId: 'presence_session_alpha',
      sequence: 1,
      activity: {
        state: 'available',
        timerEntryId: null,
        projectId: null,
        timerStartedAt: null,
      },
    });
    expect(controller.currentSession()).toEqual({
      clientInstanceId: 'installation_alpha',
      presenceSessionId: 'presence_session_alpha',
    });

    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(harness.openSession).toHaveBeenCalledOnce();
    expect(harness.sendHeartbeat.mock.calls.map(([payload]) => payload.sequence)).toEqual([1, 2, 3]);
  });

  it('skips without authenticated app state and acquires on a later tick', async () => {
    vi.useFakeTimers();
    const harness = makeControllerHarness({ session: null });
    const controller = await harness.controller();

    controller.start();
    await flushPromises();
    expect(harness.openSession).not.toHaveBeenCalled();
    expect(harness.sendHeartbeat).not.toHaveBeenCalled();

    harness.setSession({ identityId: 'pid_alice' });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(harness.openSession).toHaveBeenCalledOnce();
    expect(harness.sendHeartbeat).toHaveBeenCalledOnce();
  });

  it('reports focused only from complete unpaused timer evidence and never sends room context', async () => {
    const harness = makeControllerHarness({
      timer: {
        running: true,
        paused: false,
        entryId: 'entry_alpha',
        projectId: 'project_alpha',
        startTime: '2026-07-16T09:30:00.000Z',
      },
    });
    const controller = await harness.controller();

    await controller.heartbeatNow();
    expect(harness.sendHeartbeat).toHaveBeenLastCalledWith({
      clientInstanceId: 'installation_alpha',
      presenceSessionId: 'presence_session_alpha',
      sequence: 1,
      activity: {
        state: 'focused',
        timerEntryId: 'entry_alpha',
        projectId: 'project_alpha',
        timerStartedAt: '2026-07-16T09:30:00.000Z',
      },
    } satisfies CoworkingPresenceHeartbeatInput);
    expect(harness.sendHeartbeat.mock.calls[0]?.[0]).not.toHaveProperty('room');

    harness.setTimer({
      running: true,
      paused: true,
      entryId: 'entry_alpha',
      projectId: 'project_alpha',
      startTime: '2026-07-16T09:30:00.000Z',
    });
    await controller.heartbeatNow();
    expect(harness.sendHeartbeat).toHaveBeenLastCalledWith(expect.objectContaining({
      sequence: 2,
      activity: {
        state: 'available',
        timerEntryId: null,
        projectId: null,
        timerStartedAt: null,
      },
    }));

    harness.setTimer({ running: true, paused: false, entryId: 'entry_without_context' });
    await controller.heartbeatNow();
    expect(harness.sendHeartbeat).toHaveBeenLastCalledWith(expect.objectContaining({
      sequence: 3,
      activity: expect.objectContaining({ state: 'available' }),
    }));
  });

  it('suppresses overlap and retries ordinary failures on the next cadence with a higher sequence', async () => {
    vi.useFakeTimers();
    let releaseFirst: (() => void) | null = null;
    let attempts = 0;
    const harness = makeControllerHarness({
      sendHeartbeat: async () => {
        attempts += 1;
        if (attempts === 1) {
          await new Promise<void>((resolve) => { releaseFirst = resolve; });
          throw new Error('network unavailable');
        }
        return { ok: true };
      },
    });
    const controller = await harness.controller();

    const first = controller.heartbeatNow();
    const overlap = controller.heartbeatNow();
    await flushPromises();
    expect(harness.sendHeartbeat).toHaveBeenCalledTimes(1);
    await overlap;
    releaseFirst?.();
    await first;

    controller.start();
    await flushPromises();
    expect(harness.sendHeartbeat).toHaveBeenCalledTimes(2);
    expect(harness.sendHeartbeat.mock.calls.map(([payload]) => payload.sequence)).toEqual([1, 2]);
  });

  it('discards an invalid process session and reacquires cleanly with sequence one', async () => {
    const harness = makeControllerHarness({
      openSession: vi.fn()
        .mockResolvedValueOnce({ ok: true, presenceSessionId: 'presence_session_old' })
        .mockResolvedValueOnce({ ok: true, presenceSessionId: 'presence_session_new' }),
      sendHeartbeat: vi.fn()
        .mockResolvedValueOnce({ ok: false, sessionInvalid: true })
        .mockResolvedValueOnce({ ok: true }),
    });
    const controller = await harness.controller();

    await controller.heartbeatNow();
    expect(controller.currentSession()).toBeNull();
    await controller.heartbeatNow();

    expect(harness.openSession).toHaveBeenCalledTimes(2);
    expect(harness.sendHeartbeat.mock.calls).toEqual([
      [expect.objectContaining({ presenceSessionId: 'presence_session_old', sequence: 1 })],
      [expect.objectContaining({ presenceSessionId: 'presence_session_new', sequence: 1 })],
    ]);
    expect(controller.currentSession()).toEqual({
      clientInstanceId: 'installation_alpha',
      presenceSessionId: 'presence_session_new',
    });
  });

  it('stop clears cadence and disconnect waits behind an in-flight heartbeat for the exact process', async () => {
    vi.useFakeTimers();
    let releaseHeartbeat: (() => void) | null = null;
    const harness = makeControllerHarness({
      sendHeartbeat: async () => new Promise((resolve) => {
        releaseHeartbeat = () => resolve({ ok: true });
      }),
    });
    const controller = await harness.controller();

    controller.start();
    await flushPromises();
    controller.stop();
    const disconnect = controller.disconnectNow();
    await flushPromises();
    expect(harness.disconnect).not.toHaveBeenCalled();

    releaseHeartbeat?.();
    await disconnect;
    expect(harness.disconnect).toHaveBeenCalledOnce();
    expect(harness.disconnect).toHaveBeenCalledWith({
      clientInstanceId: 'installation_alpha',
      presenceSessionId: 'presence_session_alpha',
    });
    expect(controller.currentSession()).toBeNull();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(harness.sendHeartbeat).toHaveBeenCalledOnce();
  });
});
