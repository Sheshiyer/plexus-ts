import { randomUUID } from 'node:crypto';
import { getRunningEntry, getSetting, setSetting } from '../db/database.js';
import {
  disconnectCoworkingPresence,
  getSession,
  heartbeatCoworkingPresence,
  openCoworkingPresenceSession,
} from './teamforge.js';
import {
  createCoworkingPresenceController,
  type CoworkingPresenceSessionReference,
} from './coworking-presence-controller.js';
import { redactForLog } from './redaction.js';

const CLIENT_INSTANCE_SETTING = 'tf.coworkingPresenceClientInstanceId';
const LOGOUT_DISCONNECT_TIMEOUT_MS = 1_500;

let clientInstanceIdPromise: Promise<string> | null = null;
let controllerPromise: Promise<ReturnType<typeof createCoworkingPresenceController>> | null = null;
let activeController: ReturnType<typeof createCoworkingPresenceController> | null = null;

export function getCoworkingPresenceClientInstanceId(): Promise<string> {
  if (!clientInstanceIdPromise) {
    clientInstanceIdPromise = (async () => {
      const existing = (await getSetting(CLIENT_INSTANCE_SETTING))?.trim();
      if (existing) return existing;
      const created = `plexus_presence_${randomUUID()}`;
      await setSetting(CLIENT_INSTANCE_SETTING, created);
      return created;
    })();
  }
  return clientInstanceIdPromise;
}

async function getController(): Promise<ReturnType<typeof createCoworkingPresenceController>> {
  if (!controllerPromise) {
    controllerPromise = (async () => {
      const controller = createCoworkingPresenceController({
        clientInstanceId: await getCoworkingPresenceClientInstanceId(),
        getSession,
        async getTimerSnapshot() {
          const running = await getRunningEntry();
          if (!running) return null;
          return {
            running: true,
            paused: Boolean(running.pausedAt),
            entryId: running.id,
            projectId: running.projectId,
            startTime: running.startTime,
          };
        },
        openSession: openCoworkingPresenceSession,
        sendHeartbeat: heartbeatCoworkingPresence,
        disconnect: disconnectCoworkingPresence,
        onError(error) {
          console.warn('[coworking-presence] lease operation failed', redactForLog(error));
        },
      });
      activeController = controller;
      return controller;
    })();
  }
  return controllerPromise;
}

export async function startCoworkingPresence(): Promise<void> {
  const controller = await getController();
  controller.start();
}

export async function restartCoworkingPresenceSession(): Promise<void> {
  const controller = await getController();
  controller.stop();
  await controller.disconnectNow();
  controller.start();
}

export async function heartbeatCoworkingPresenceNow(): Promise<void> {
  const controller = await getController();
  await controller.heartbeatNow();
}

export function stopCoworkingPresence(): void {
  activeController?.stop();
}

export async function disconnectCoworkingPresenceNow(): Promise<void> {
  const controller = activeController ?? await getController();
  await controller.disconnectNow();
}

export async function disconnectCoworkingPresenceForLogout(): Promise<void> {
  const controller = activeController ?? await getController();
  controller.stop();
  await Promise.race([
    controller.disconnectNow(),
    new Promise<void>((resolve) => setTimeout(resolve, LOGOUT_DISCONNECT_TIMEOUT_MS)),
  ]);
}

export async function currentCoworkingPresenceSession(): Promise<CoworkingPresenceSessionReference | null> {
  const controller = activeController ?? await getController();
  return controller.currentSession();
}
