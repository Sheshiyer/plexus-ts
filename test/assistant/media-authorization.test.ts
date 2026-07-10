import { describe, expect, it, vi } from 'vitest';
import { registerDefaultSessionMediaAuthorization } from '../../src/main/media-authorization';

type PermissionRequestHandler = (
  webContents: MockWebContents,
  permission: string,
  callback: (allowed: boolean) => void,
  details: {
    isMainFrame: boolean;
    requestingUrl: string;
    securityOrigin?: string;
  },
) => void;

type PermissionCheckHandler = (
  webContents: MockWebContents | null,
  permission: string,
  requestingOrigin: string,
  details: {
    isMainFrame: boolean;
    requestingUrl?: string;
    securityOrigin?: string;
  },
) => boolean;

type DisplayRequestHandler = (
  request: {
    frame: MockFrame | null;
    securityOrigin: string;
    videoRequested: boolean;
    audioRequested: boolean;
    userGesture: boolean;
  },
  callback: (streams: { video?: MockSource }) => void,
) => void;

type MockFrame = { url: string };
type MockSource = { id: string; name: string };
type MockWebContents = { id: number; getURL: () => string; mainFrame: MockFrame };

function harness() {
  let permissionRequestHandler: PermissionRequestHandler | undefined;
  let permissionCheckHandler: PermissionCheckHandler | undefined;
  let displayRequestHandler: DisplayRequestHandler | undefined;
  const trustedFrame: MockFrame = { url: 'file:///Applications/Plexus.app/Contents/Resources/app.asar/dist/renderer/index.html' };
  const trustedWebContents: MockWebContents = {
    id: 7,
    getURL: () => trustedFrame.url,
    mainFrame: trustedFrame,
  };
  const source: MockSource = { id: 'screen:0:0', name: 'Built-in Display' };
  const getSources = vi.fn(async () => [source]);

  registerDefaultSessionMediaAuthorization({
    session: {
      setPermissionRequestHandler: (handler) => { permissionRequestHandler = handler as PermissionRequestHandler; },
      setPermissionCheckHandler: (handler) => { permissionCheckHandler = handler as PermissionCheckHandler; },
      setDisplayMediaRequestHandler: (handler) => { displayRequestHandler = handler as DisplayRequestHandler; },
    },
    getSources,
    getTrustedWebContents: () => trustedWebContents,
    getAllowedRendererLocation: () => trustedFrame.url,
  });

  return {
    displayRequestHandler: () => displayRequestHandler!,
    getSources,
    permissionCheckHandler: () => permissionCheckHandler!,
    permissionRequestHandler: () => permissionRequestHandler!,
    source,
    trustedFrame,
    trustedWebContents,
  };
}

describe('default-session media authorization', () => {
  it('allows only required media permissions from the trusted main renderer', () => {
    const subject = harness();
    const request = subject.permissionRequestHandler();
    const exactDetails = {
      isMainFrame: true,
      requestingUrl: subject.trustedFrame.url,
      securityOrigin: 'file://',
    };

    for (const permission of ['media', 'display-capture', 'speaker-selection', 'clipboard-sanitized-write']) {
      const callback = vi.fn();
      request(subject.trustedWebContents, permission, callback, exactDetails);
      expect(callback).toHaveBeenCalledWith(true);
    }

    for (const [webContents, permission, details] of [
      [{ ...subject.trustedWebContents, id: 8 }, 'media', exactDetails],
      [subject.trustedWebContents, 'geolocation', exactDetails],
      [subject.trustedWebContents, 'media', { ...exactDetails, isMainFrame: false }],
      [subject.trustedWebContents, 'media', { ...exactDetails, requestingUrl: 'file:///tmp/evil.html' }],
      [subject.trustedWebContents, 'media', { ...exactDetails, securityOrigin: 'https://evil.test' }],
    ] as const) {
      const callback = vi.fn();
      request(webContents, permission, callback, details);
      expect(callback).toHaveBeenCalledWith(false);
    }
  });

  it('allows media permission checks only for the exact trusted renderer origin', () => {
    const subject = harness();
    const check = subject.permissionCheckHandler();
    const details = {
      isMainFrame: true,
      requestingUrl: subject.trustedFrame.url,
      securityOrigin: 'file://',
    };

    expect(check(subject.trustedWebContents, 'media', 'file://', details)).toBe(true);
    expect(check(subject.trustedWebContents, 'speaker-selection', 'file://', details)).toBe(true);
    expect(check(subject.trustedWebContents, 'clipboard-sanitized-write', 'file://', details)).toBe(true);
    expect(check(null, 'media', 'file://', details)).toBe(false);
    expect(check(subject.trustedWebContents, 'notifications', 'file://', details)).toBe(false);
    expect(check(subject.trustedWebContents, 'media', 'https://evil.test', details)).toBe(false);
    expect(check(subject.trustedWebContents, 'media', 'file://', { ...details, isMainFrame: false })).toBe(false);
    expect(check(subject.trustedWebContents, 'media', 'file://', {
      ...details,
      requestingUrl: 'file:///tmp/evil.html',
    })).toBe(false);
  });

  it('selects a display source only for a trusted user-initiated main-frame request', async () => {
    const subject = harness();
    const display = subject.displayRequestHandler();
    const trustedRequest = {
      frame: subject.trustedFrame,
      securityOrigin: 'file://',
      videoRequested: true,
      audioRequested: false,
      userGesture: true,
    };
    const allowed = vi.fn();

    display(trustedRequest, allowed);
    await vi.waitFor(() => expect(allowed).toHaveBeenCalledWith({ video: subject.source }));
    expect(subject.getSources).toHaveBeenCalledWith({ types: ['screen', 'window'] });

    for (const rejected of [
      { ...trustedRequest, userGesture: false },
      { ...trustedRequest, frame: { url: subject.trustedFrame.url } },
      { ...trustedRequest, securityOrigin: 'https://evil.test' },
      { ...trustedRequest, videoRequested: false },
    ]) {
      subject.getSources.mockClear();
      const denied = vi.fn();
      display(rejected, denied);
      expect(denied).toHaveBeenCalledWith({});
      expect(subject.getSources).not.toHaveBeenCalled();
    }
  });
});
