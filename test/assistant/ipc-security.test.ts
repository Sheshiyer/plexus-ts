import { describe, expect, it, vi } from 'vitest';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  assertAllowedIpcSender,
  expectNoPayload,
  expectPayloadCount,
  expectSinglePayload,
  guardedIpcHandle,
  isAllowedIpcSenderUrl,
} from '../../src/main/ipc-security';

function invokeEvent(senderUrl: string, senderId = 7, frameUrl?: string): IpcMainInvokeEvent {
  return {
    sender: {
      id: senderId,
      getURL: () => senderUrl,
    },
    senderFrame: frameUrl ? { url: frameUrl } : undefined,
  } as unknown as IpcMainInvokeEvent;
}

describe('IPC sender guard', () => {
  it('allows only the configured renderer origin', () => {
    expect(isAllowedIpcSenderUrl('http://127.0.0.1:5173/settings', 'http://127.0.0.1:5173')).toBe(true);
    expect(isAllowedIpcSenderUrl('http://127.0.0.1:5174/settings', 'http://127.0.0.1:5173')).toBe(false);
    expect(isAllowedIpcSenderUrl('https://evil.test/settings', 'http://127.0.0.1:5173')).toBe(false);
  });

  it('allows only the exact packaged renderer file while tolerating an in-document hash', () => {
    const renderer = 'file:///Applications/Plexus.app/Contents/Resources/app.asar/dist/renderer/index.html';
    expect(isAllowedIpcSenderUrl(renderer, renderer)).toBe(true);
    expect(isAllowedIpcSenderUrl(`${renderer}#settings`, renderer)).toBe(true);
    expect(isAllowedIpcSenderUrl(`${renderer}?source=untrusted`, renderer)).toBe(false);
    expect(isAllowedIpcSenderUrl('file:///tmp/evil.html', renderer)).toBe(false);
    expect(isAllowedIpcSenderUrl('file:///Applications/Plexus.app/Contents/Resources/app.asar/dist/renderer/other.html', renderer)).toBe(false);
    expect(isAllowedIpcSenderUrl('https://evil.test/index.html', renderer)).toBe(false);
  });

  it('binds sensitive handlers to the main window webContents id', () => {
    expect(() => assertAllowedIpcSender(
      invokeEvent('http://127.0.0.1:5173/settings', 7),
      'worker:configSet',
      'http://127.0.0.1:5173',
      7,
    )).not.toThrow();

    expect(() => assertAllowedIpcSender(
      invokeEvent('http://127.0.0.1:5173/settings', 8),
      'worker:configSet',
      'http://127.0.0.1:5173',
      7,
    )).toThrow('Blocked IPC sender');
  });

  it('checks senderFrame URL before sender URL', () => {
    expect(() => assertAllowedIpcSender(
      invokeEvent('http://127.0.0.1:5173/settings', 7, 'https://evil.test/frame'),
      'auth:accessLogin',
      'http://127.0.0.1:5173',
      7,
    )).toThrow('Blocked IPC sender');
  });

  it('blocks before schema parsing and handler execution', async () => {
    const handle = vi.fn();
    const schema = vi.fn((): [string] => ['secret']);
    const handler = vi.fn(async () => 'ok');
    guardedIpcHandle({ handle } as unknown as Pick<IpcMain, 'handle'>, 'worker:configSet', {
      getAllowedRendererOrigin: () => 'http://127.0.0.1:5173',
      getAllowedSenderId: () => 7,
      schema,
    }, handler);

    const registered = handle.mock.calls[0][1] as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
    expect(() => registered(invokeEvent('https://evil.test', 8), { token: 'secret' })).toThrow('Blocked IPC sender');
    expect(schema).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects unexpected payloads by default and validates single payload arity', () => {
    expect(expectNoPayload([], 'auth:logout')).toEqual([]);
    expect(() => expectNoPayload(['extra'], 'auth:logout')).toThrow('does not accept a payload');

    expect(expectSinglePayload(['ok'], 'auth:login', value => String(value))).toEqual(['ok']);
    expect(() => expectSinglePayload([], 'auth:login', value => String(value))).toThrow('expects one payload');
    expect(() => expectPayloadCount(['one', 'two'], 'timer:start', 2, 3)).not.toThrow();
    expect(() => expectPayloadCount(['one'], 'timer:start', 2, 3)).toThrow('expects 2-3 payload values');
  });
});
