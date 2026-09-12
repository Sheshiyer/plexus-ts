# Plexus Electron capture boundary

Original proof: RW-004 / issue #16, 2026-06-15. Source reconciliation:
2026-09-05, v0.7.12. This page describes local capture capability and preserves
its proof boundary; it is not a fresh device test or Cloudflare call receipt.

## Current surface

Capture readiness and device controls live in **Co-working**, backed by
`CoWorkingPanel.tsx`, `useRealtimeMedia.ts` and the coworking components.
The original standalone `RealtimeCapturePanel`/Realtime navigation tab is no
longer present. Use [the workspace contract](REALTIME_WORKSPACE_CONTRACT.md)
and [documentation map](DOCUMENTATION_MAP.md) for current product context.

| Layer | Source/API | Responsibility |
| --- | --- | --- |
| Main process | `getMediaCaptureStatus()` in `src/main/main.ts` | Platform, packaged state, microphone/camera/screen permissions and desktop-source discovery |
| Permission request | `systemPreferences.askForMediaAccess` | Explicit microphone/camera permission request on macOS |
| Trusted renderer boundary | `src/main/media-authorization.ts` | Restrict media permission/display-capture requests to the trusted main renderer and user gesture |
| Preload | `mediaCaptureStatus`, `mediaRequestAccess` | Typed IPC; no cloud media credentials |
| Renderer capture | `useRealtimeMedia.ts` | Explicit `getUserMedia` microphone/camera and `getDisplayMedia` screen capture; device enumeration and local track lifecycle |
| Media session | `RealtimeSession.ts` | Local track and peer-connection scaffolding; Worker metadata fallback when unavailable |

On macOS, Screen Recording recovery belongs in System Settings; the app cannot
request it through `askForMediaAccess` as it does microphone/camera permission.
The display-capture handler prefers the system picker and falls back to the
first discovered source. The UI's whole-display visibility warning matters:
permission to capture is not proof that an app-window-only picker was offered.

## Degraded behavior to verify

Permission states include `granted`, `denied`, `restricted`, `not-determined`
and `unknown`. Renderer media APIs or capture sources may be unavailable.
Device failures must remain local to media controls and keep room leave reachable.
Stopping or leaving must stop the corresponding local tracks, then perform
best-effort Worker/session cleanup. A local screen preview or stored `live`
track row does not prove a remote participant received media.

## Validation instructions

For a capture change, run the relevant type/build checks and focused
`test/coworking` and media-authorization cases. Then use a signed installed app to
observe Co-working permission status, explicit mic/camera requests, screen source
selection, denial/recovery, local track stop and room leave. Record platform,
app version and whether the native system picker or fallback was exercised.

The June proof covered local readiness only. This documentation pass did not
request permissions or capture media. Two-party microphone, camera, screen share
and network/sleep recovery remain the separate [SFU acceptance issue #26](https://github.com/Sheshiyer/plexus-ts/issues/26).

## Excluded claims

Local capture does not establish Cloudflare session negotiation, remote audio or
video, recording upload, transcription, or Hermes/Telegram delivery. Preload
recording method names alone do not establish a working recording implementation.
