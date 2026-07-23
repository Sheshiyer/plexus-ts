import type { IpcMain, IpcMainInvokeEvent } from 'electron';

export type IpcPayloadSchema<Args extends unknown[]> = (args: readonly unknown[], channel: string) => Args;

export function isAllowedIpcSenderUrl(url: string, allowedRendererLocation: string): boolean {
  try {
    const parsed = new URL(url);
    const allowed = new URL(allowedRendererLocation);
    if (parsed.username || parsed.password) return false;
    if (allowed.protocol === 'file:') {
      return parsed.protocol === 'file:'
        && parsed.hostname === allowed.hostname
        && parsed.pathname === allowed.pathname
        && parsed.search === allowed.search;
    }
    return parsed.origin === allowed.origin;
  } catch {
    return false;
  }
}

export function senderUrlFromEvent(event: IpcMainInvokeEvent): string {
  const frameUrl = event.senderFrame?.url;
  if (frameUrl) return frameUrl;
  return event.sender.getURL();
}

export function assertAllowedIpcSender(
  event: IpcMainInvokeEvent,
  channel: string,
  allowedRendererOrigin: string,
  allowedSenderId?: number,
): void {
  if (allowedSenderId !== undefined && event.sender.id !== allowedSenderId) {
    throw new Error(`Blocked IPC sender for ${channel}.`);
  }
  const senderUrl = senderUrlFromEvent(event);
  if (!isAllowedIpcSenderUrl(senderUrl, allowedRendererOrigin)) {
    throw new Error(`Blocked IPC sender for ${channel}.`);
  }
}

export function expectNoPayload(args: readonly unknown[], channel: string): [] {
  if (args.length !== 0) throw new Error(`${channel} does not accept a payload.`);
  return [];
}

export function expectPayloadCount(
  args: readonly unknown[],
  channel: string,
  minimum: number,
  maximum = minimum,
): void {
  if (args.length < minimum || args.length > maximum) {
    const expected = minimum === maximum ? String(minimum) : `${minimum}-${maximum}`;
    throw new Error(`${channel} expects ${expected} payload value${maximum === 1 ? '' : 's'}.`);
  }
}

export function expectSinglePayload<T>(
  args: readonly unknown[],
  channel: string,
  normalize: (value: unknown) => T,
): [T] {
  if (args.length !== 1) throw new Error(`${channel} expects one payload.`);
  return [normalize(args[0])];
}

export function guardedIpcHandle<Args extends unknown[], Result>(
  ipc: Pick<IpcMain, 'handle'>,
  channel: string,
  options: {
    getAllowedRendererOrigin: () => string;
    getAllowedSenderId?: () => number | undefined;
    schema?: IpcPayloadSchema<Args>;
  },
  handler: (event: IpcMainInvokeEvent, ...args: Args) => Result | Promise<Result>,
): void {
  ipc.handle(channel, (event, ...rawArgs) => {
    assertAllowedIpcSender(
      event,
      channel,
      options.getAllowedRendererOrigin(),
      options.getAllowedSenderId?.(),
    );
    const args = options.schema ? options.schema(rawArgs, channel) : expectNoPayload(rawArgs, channel) as unknown as Args;
    return handler(event, ...args);
  });
}
