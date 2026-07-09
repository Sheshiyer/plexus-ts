import { describe, expect, it, vi } from 'vitest';
import {
  assertAllowedIpcSender,
  expectNoPayload,
  expectSinglePayload,
  guardedIpcHandle,
  isAllowedIpcSenderUrl,
} from '../../src/main/ipc-security';

function invokeEvent(senderUrl: string, senderId = 7, frameUrl?: string): any {
  return {
    sender: {
      id: senderId,
      getURL: () => senderUrl,
    },
    senderFrame: frameUrl ? { url: frameUrl } : undefined,
  };
}

describe('IPC sender guard', () => {
  it('allows only the configured renderer origin', () => {
    expect(isAllowedIpcSenderUrl('http://127.0.0.1:5173/settings', 'http://127.0.0.1:5173')).toBe(true);
    expect(isAllowedIpcSenderUrl('http://127.0.0.1:5174/settings', 'http://127.0.0.1:5173')).toBe(false);
    expect(isAllowedIpcSenderUrl('https://evil.test/settings', 'http://127.0.0.1:5173')).toBe(false);
    expect(isAllowedIpcSenderUrl('file:///Applications/Plexus.app/index.html', 'file://')).toBe(true);
    expect(isAllowedIpcSenderUrl('https://evil.test/index.html', 'file://')).toBe(false);
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
    guardedIpcHandle({ handle } as any, 'worker:configSet', {
      getAllowedRendererOrigin: () => 'http://127.0.0.1:5173',
      getAllowedSenderId: () => 7,
      schema,
    }, handler);

    const registered = handle.mock.calls[0][1];
    expect(() => registered(invokeEvent('https://evil.test', 8), { token: 'secret' })).toThrow('Blocked IPC sender');
    expect(schema).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects unexpected payloads by default and validates single payload arity', () => {
    expect(expectNoPayload([], 'auth:logout')).toEqual([]);
    expect(() => expectNoPayload(['extra'], 'auth:logout')).toThrow('does not accept a payload');

    expect(expectSinglePayload(['ok'], 'auth:login', value => String(value))).toEqual(['ok']);
    expect(() => expectSinglePayload([], 'auth:login', value => String(value))).toThrow('expects one payload');
  });
});
