import type { DesktopCapturerSource, Session } from 'electron';
import { isAllowedIpcSenderUrl } from './ipc-security.js';

type MediaSource = { id: string; name: string };
type TrustedWebContents = { readonly mainFrame: unknown };

const ALLOWED_MEDIA_PERMISSION_REQUESTS = new Set([
  'media',
  'display-capture',
  'speaker-selection',
  'clipboard-sanitized-write',
]);

export interface DefaultSessionMediaAuthorizationOptions {
  session: Pick<Session,
    'setDisplayMediaRequestHandler' |
    'setPermissionCheckHandler' |
    'setPermissionRequestHandler'
  >;
  getSources: (options: { types: Array<'screen' | 'window'> }) => Promise<MediaSource[]>;
  getTrustedWebContents: () => TrustedWebContents | null;
  getAllowedRendererLocation: () => string;
}

function isAllowedMediaSecurityOrigin(origin: string, allowedRendererLocation: string): boolean {
  try {
    const candidate = new URL(origin);
    const allowed = new URL(allowedRendererLocation);
    if (candidate.username || candidate.password) return false;
    if (allowed.protocol === 'file:') {
      return candidate.protocol === 'file:' && candidate.hostname === allowed.hostname;
    }
    return candidate.origin === allowed.origin;
  } catch {
    return false;
  }
}

function isTrustedRendererDocument(url: string | undefined, allowedRendererLocation: string): boolean {
  return Boolean(url) && isAllowedIpcSenderUrl(url!, allowedRendererLocation);
}

export function registerDefaultSessionMediaAuthorization({
  session,
  getSources,
  getTrustedWebContents,
  getAllowedRendererLocation,
}: DefaultSessionMediaAuthorizationOptions): void {
  session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const trustedWebContents = getTrustedWebContents();
    const allowedRendererLocation = getAllowedRendererLocation();
    const allowed = trustedWebContents !== null
      && webContents === trustedWebContents
      && ALLOWED_MEDIA_PERMISSION_REQUESTS.has(permission)
      && details.isMainFrame
      && isTrustedRendererDocument(details.requestingUrl, allowedRendererLocation)
      && isAllowedMediaSecurityOrigin(
        'securityOrigin' in details && details.securityOrigin
          ? details.securityOrigin
          : details.requestingUrl,
        allowedRendererLocation,
      );
    callback(allowed);
  });

  session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const trustedWebContents = getTrustedWebContents();
    const allowedRendererLocation = getAllowedRendererLocation();
    return trustedWebContents !== null
      && webContents === trustedWebContents
      && ALLOWED_MEDIA_PERMISSION_REQUESTS.has(permission)
      && details.isMainFrame
      && isTrustedRendererDocument(details.requestingUrl ?? webContents.getURL(), allowedRendererLocation)
      && isAllowedMediaSecurityOrigin(requestingOrigin, allowedRendererLocation)
      && (!details.securityOrigin
        || isAllowedMediaSecurityOrigin(details.securityOrigin, allowedRendererLocation));
  });

  session.setDisplayMediaRequestHandler((request, callback) => {
    const trustedWebContents = getTrustedWebContents();
    const allowedRendererLocation = getAllowedRendererLocation();
    const allowed = trustedWebContents !== null
      && request.frame !== null
      && request.frame === trustedWebContents.mainFrame
      && request.videoRequested
      && request.userGesture
      && isTrustedRendererDocument(request.frame.url, allowedRendererLocation)
      && isAllowedMediaSecurityOrigin(request.securityOrigin, allowedRendererLocation);
    if (!allowed) {
      callback({});
      return;
    }

    getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        callback(sources.length > 0
          ? { video: sources[0] as DesktopCapturerSource }
          : {});
      })
      .catch(() => callback({}));
  }, { useSystemPicker: true });
}
