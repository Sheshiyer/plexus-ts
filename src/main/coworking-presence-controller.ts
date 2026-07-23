import type { CoworkingPresenceActivity } from '../shared/coworking-presence.js';

export const PRESENCE_HEARTBEAT_INTERVAL_MS = 15_000;

export interface CoworkingPresenceSessionReference {
  clientInstanceId: string;
  presenceSessionId: string;
}

export interface CoworkingPresenceHeartbeatInput extends CoworkingPresenceSessionReference {
  sequence: number;
  activity: CoworkingPresenceActivity;
}

export interface PresenceTimerSnapshot {
  running: boolean;
  paused?: boolean;
  entryId?: string;
  projectId?: string;
  startTime?: string;
}

export interface PresenceControllerDependencies {
  clientInstanceId: string;
  getSession(): Promise<unknown | null>;
  getTimerSnapshot(): Promise<PresenceTimerSnapshot | null>;
  openSession(clientInstanceId: string): Promise<
    { ok: true; presenceSessionId: string }
    | { ok: false; message?: string }
  >;
  sendHeartbeat(input: CoworkingPresenceHeartbeatInput): Promise<
    { ok: true }
    | { ok: false; sessionInvalid?: boolean; message?: string }
  >;
  disconnect(session: CoworkingPresenceSessionReference): Promise<unknown>;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
  onError?(error: unknown): void;
}

function availableActivity(): CoworkingPresenceActivity {
  return {
    state: 'available',
    timerEntryId: null,
    projectId: null,
    timerStartedAt: null,
  };
}

function activityFromTimer(timer: PresenceTimerSnapshot | null): CoworkingPresenceActivity {
  if (
    !timer?.running
    || timer.paused
    || !timer.entryId
    || !timer.projectId
    || !timer.startTime
  ) {
    return availableActivity();
  }
  return {
    state: 'focused',
    timerEntryId: timer.entryId,
    projectId: timer.projectId,
    timerStartedAt: timer.startTime,
  };
}

export function createCoworkingPresenceController(deps: PresenceControllerDependencies): {
  start(): void;
  stop(): void;
  heartbeatNow(): Promise<void>;
  disconnectNow(): Promise<void>;
  currentSession(): CoworkingPresenceSessionReference | null;
} {
  const schedule = deps.setInterval ?? globalThis.setInterval;
  const unschedule = deps.clearInterval ?? globalThis.clearInterval;
  let interval: ReturnType<typeof globalThis.setInterval> | null = null;
  let presenceSessionId: string | null = null;
  let sequence = 0;
  let inFlight: Promise<void> | null = null;

  const report = (error: unknown) => {
    try {
      deps.onError?.(error);
    } catch {
      // Diagnostics must never break lease expiry semantics.
    }
  };

  const runHeartbeat = async (): Promise<void> => {
    const authenticatedSession = await deps.getSession();
    if (!authenticatedSession) return;

    if (!presenceSessionId) {
      const opened = await deps.openSession(deps.clientInstanceId);
      if (!opened.ok) {
        report(new Error(opened.message ?? 'Could not open Coworking presence session.'));
        return;
      }
      presenceSessionId = opened.presenceSessionId;
      sequence = 0;
    }

    const activePresenceSessionId = presenceSessionId;
    const activity = activityFromTimer(await deps.getTimerSnapshot());
    sequence += 1;
    const result = await deps.sendHeartbeat({
      clientInstanceId: deps.clientInstanceId,
      presenceSessionId: activePresenceSessionId,
      sequence,
      activity,
    });
    if (!result.ok && result.sessionInvalid && presenceSessionId === activePresenceSessionId) {
      presenceSessionId = null;
      sequence = 0;
    }
    if (!result.ok && result.message) report(new Error(result.message));
  };

  const heartbeatNow = (): Promise<void> => {
    if (inFlight) return Promise.resolve();
    const operation = runHeartbeat()
      .catch(report)
      .finally(() => {
        if (inFlight === operation) inFlight = null;
      });
    inFlight = operation;
    return operation;
  };

  return {
    start() {
      if (interval) return;
      void heartbeatNow();
      interval = schedule(() => {
        void heartbeatNow();
      }, PRESENCE_HEARTBEAT_INTERVAL_MS);
    },
    stop() {
      if (!interval) return;
      unschedule(interval);
      interval = null;
    },
    heartbeatNow,
    async disconnectNow() {
      let session = presenceSessionId
        ? { clientInstanceId: deps.clientInstanceId, presenceSessionId }
        : null;
      if (session) {
        presenceSessionId = null;
        sequence = 0;
      }
      if (inFlight) await inFlight;
      if (!session && presenceSessionId) {
        session = { clientInstanceId: deps.clientInstanceId, presenceSessionId };
        presenceSessionId = null;
        sequence = 0;
      }
      if (!session) return;
      try {
        await deps.disconnect(session);
      } catch (error) {
        report(error);
      }
    },
    currentSession() {
      return presenceSessionId
        ? { clientInstanceId: deps.clientInstanceId, presenceSessionId }
        : null;
    },
  };
}
