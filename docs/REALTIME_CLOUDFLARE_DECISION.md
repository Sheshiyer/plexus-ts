# Plexus Realtime Cloudflare Decision

**Task:** RW-002 / GitHub issue #14  
**Status:** Initial decision frozen for Phase 14  
**Updated:** 2026-06-15

## Decision

Phase 14 should start with the lower-level Cloudflare Realtime SFU connection API, not RealtimeKit UI.

RealtimeKit remains useful as a reference for meeting primitives and later recording/transcription surfaces, but Plexus needs custom project rooms, multi-person screen sharing, explicit meeting/time links, and Paperclip handoff. Those are application-level concepts TeamForge must own. The SFU sessions/tracks model maps cleanly to that split: Cloudflare moves media, TeamForge owns rooms and authorization.

## Why SFU First

Cloudflare Realtime SFU gives Plexus:

- Application separation for production/staging.
- A session per WebRTC peer connection.
- Multiple tracks per session.
- Track IDs that can be pushed and pulled globally inside the Realtime application.
- HTTPS endpoints for session creation, track creation, renegotiation, track close, and session inspection.
- A backend-mediated architecture where the Worker controls what each client may publish or subscribe to.

The critical product requirement is multi-person screen sharing. That is easier to reason about if every microphone, camera, and screen share is represented as a separate TeamForge media-track record mapped to a Cloudflare track.

## Rejected For Phase 14

### RealtimeKit UI as primary implementation

Rejected for the first pass because it would pull Plexus toward a generic meeting widget. Plexus needs its own project-room shell, participant state, time-log linkage, closeout flow, and agent memory surface.

### Recording or transcription features

Deferred to Phase 15. Recording/transcription docs may inform future shape, but Phase 14 must not implement or imply recording, speech-to-text, or automatic summaries.

### Client-side Cloudflare credentials

Rejected. Plexus clients must never store Cloudflare Realtime API secrets. The Worker brokers all Cloudflare Realtime API calls.

## Environment Contract

Names are intentionally explicit. Values are configured in the TeamForge Worker environment or secret store, not in Plexus Settings.

Worker plain variables:

- `CF_REALTIME_APP_ID`
- `CF_REALTIME_ENVIRONMENT=production|staging|local`
- `CF_REALTIME_API_BASE=https://rtc.live.cloudflare.com/v1`
- `CF_REALTIME_STUN_URL=stun:stun.cloudflare.com:3478`
- `REALTIME_ROOMS_ENABLED=true|false`
- `REALTIME_MAX_SCREEN_SHARES_PER_ROOM`
- `REALTIME_MAX_TRACKS_PER_PARTICIPANT`

Worker secrets:

- `CF_REALTIME_APP_SECRET`
- `CF_REALTIME_API_TOKEN`, only if the selected API flow requires an account-level token instead of app secret auth.

Plexus local feature flags:

- `PLEXUS_REALTIME_CAPTURE_PROOF=1` enables local capture proof panels in development if the UI is hidden later.
- `PLEXUS_REALTIME_MOCK=1` allows renderer smoke tests without live Cloudflare negotiation.

No employee-facing Settings control may ask for Cloudflare app IDs, API tokens, app secrets, TURN credentials, or account IDs.

## Connectivity Contract

Cloudflare Realtime docs describe Cloudflare's anycast media path and expose `stun.cloudflare.com:3478` for STUN. Phase 14 should assume:

- Default connectivity uses Cloudflare Realtime plus Cloudflare STUN.
- TURN is not a user-entered Plexus setting.
- If restrictive networks require TURN later, TURN configuration remains server-provided and user-invisible.
- Plexus renders a recoverable connection failure state before blaming permissions.

## Track Model

Plexus/TeamForge track kinds:

- `audio`: microphone.
- `camera`: camera video.
- `screen`: desktop/window/screen capture.
- `data`: reserved only if a data channel becomes necessary.

Each published track stores:

- TeamForge track ID.
- Cloudflare session ID.
- Cloudflare track ID.
- Track kind.
- Publisher participant ID.
- Room ID.
- Call session ID.
- State: `requested`, `negotiating`, `live`, `paused`, `closed`, `failed`.
- Display label for screen-share tracks.

Multiple screen-share tracks may be live in the same call. The Worker must never assume only one screen-share publisher.

## Backend Flow

1. Plexus asks TeamForge Worker to join a room.
2. Worker checks the Access-backed Plexus session and project visibility.
3. Worker creates or reuses a TeamForge call session.
4. Worker creates a Cloudflare Realtime session if the participant needs media.
5. Plexus sends SDP offers to the Worker.
6. Worker calls Cloudflare Realtime connection API.
7. Worker stores application state in D1 and returns client-safe SDP/track metadata.
8. Plexus publishes or subscribes to tracks.
9. Track close and participant leave events flow back through the Worker.

## Security Review

- App secret/API token is server-side only.
- Cloudflare session IDs and track IDs are not treated as authorization.
- Every publish, subscribe, close, leave, and end-call route must resolve the principal from the Access-backed Plexus session.
- Track close is scoped to the publisher unless host/admin policy permits otherwise.
- The Worker audit log records who joined, left, published, stopped sharing, ended a call, and saved closeout.

## Dry-Run Config Check

The required values can be represented without local device secrets:

- Worker env/secrets hold Cloudflare Realtime identifiers and credentials.
- Plexus receives only room/session responses from the Worker.
- Plexus uses browser/Electron WebRTC APIs and never needs Cloudflare account secrets.
- Local mock mode can validate UI state without Cloudflare resources.

## Follow-Up Issues

- RW-003 translates this decision into D1 schema and route contracts.
- RW-005 implements the Worker session broker.
- RW-007/RW-008 implement publish/subscribe controls and multi-screen-share UI.
- RW-013 covers future self-hosted transcription and is not a dependency for Phase 14.
