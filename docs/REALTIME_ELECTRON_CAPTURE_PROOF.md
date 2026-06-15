# Plexus Electron Capture Capability Proof

**Task:** RW-004 / GitHub issue #16  
**Status:** Implemented as a local capability panel  
**Updated:** 2026-06-15

## Purpose

Phase 14 needs to prove Plexus can reason about microphone, camera, and screen-capture readiness without needing a live Cloudflare call. The proof is a bounded app surface that reports local Electron/macOS capture state and first-run recovery guidance.

## Implemented Surface

Plexus now includes a `Realtime` navigation tab backed by `RealtimeCapturePanel`.

The panel checks:

- Electron platform and packaged/dev state.
- Microphone permission status through Electron `systemPreferences.getMediaAccessStatus`.
- Camera permission status through Electron `systemPreferences.getMediaAccessStatus`.
- Screen Recording permission status through Electron `systemPreferences.getMediaAccessStatus`.
- Desktop/window capture source discovery through Electron `desktopCapturer.getSources`.
- Browser media API availability in the renderer through `navigator.mediaDevices`.

The panel can request microphone and camera permission through `systemPreferences.askForMediaAccess`. Screen Recording cannot be requested the same way on macOS; the UI explains that recovery belongs in System Settings.

## APIs Used

Main process:

- `systemPreferences.getMediaAccessStatus('microphone' | 'camera' | 'screen')`
- `systemPreferences.askForMediaAccess('microphone' | 'camera')`
- `desktopCapturer.getSources({ types: ['screen', 'window'] })`

Preload:

- `mediaCaptureStatus`
- `mediaRequestAccess`

Renderer:

- `navigator.mediaDevices`
- `navigator.mediaDevices.enumerateDevices` when available.

## Degraded States

The UI distinguishes:

- `granted`
- `denied`
- `restricted`
- `not-determined`
- `unknown`
- unavailable renderer media APIs
- zero desktop sources
- desktop source enumeration errors

Screen Recording permission denial is treated as recoverable. The user remains in the app and can retry after changing macOS settings.

## Validation

This proof does not require Cloudflare Realtime, a Worker session broker, or a second participant. It validates only the local capture readiness boundary that later room/call work will consume.

Expected checks:

- `npm run typecheck`
- `npm run build:main`
- `npm run build:preload`
- `npx vite build`
- Manual Electron smoke: open Realtime tab, refresh capabilities, optionally request mic/camera permissions, confirm screen capture status and source count render.

## Out of Scope

- Joining a Cloudflare Realtime session.
- Publishing or subscribing to tracks.
- Rendering production call controls.
- Recording.
- Transcription.
