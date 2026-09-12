# Plexus Realtime Cloudflare Decision

**Task:** RW-002 / GitHub issue #14
**Status:** Retained architecture decision; live transport acceptance open
**Original decision updated:** 2026-06-15
**Source reconciliation:** 2026-09-05, v0.7.12

## Current implementation boundary

This decision selects a transport design; it does not certify live calls.
`src/renderer/lib/RealtimeSession.ts` implements peer-connection and SDP
scaffolding, and `useRealtimeMedia.ts` owns explicit local media capture. The
inspected sibling Worker `src/routes/realtime.ts` still returns
`track_metadata_recorded` or `client_local_track_recorded` from its track route
without provider track negotiation. Current join callers do not send the initial
`sessionDescription` that the Worker session-creation path expects.

Two-client microphone/video/screen transport and recovery therefore remain
[#26](https://github.com/Sheshiyer/plexus-ts/issues/26). Current Labs secret names
are present, but credential names are not working SFU proof. Permissions and
persisted audit acceptance remain [#23](https://github.com/Sheshiyer/plexus-ts/issues/23).
See [API scope](REALTIME_WORKER_API_CONTRACT.md), [capture boundary](REALTIME_ELECTRON_CAPTURE_PROOF.md)
and [documentation map](DOCUMENTATION_MAP.md).

## Decision

Phase 14 should start with the lower-level Cloudflare Realtime SFU connection API, not RealtimeKit UI.

RealtimeKit remains useful as a reference for meeting primitives and later recording/transcription surfaces, but Plexus needs custom project rooms, multi-person screen sharing, explicit meeting/time links, and explicit meeting closeout/channel handoff. Those are application-level concepts the Workspace Worker/Plexus API must own. The SFU sessions/tracks model maps cleanly to that split: Cloudflare moves media; Workspace Worker/D1 owns rooms and authorization.

This decision covers the realtime member data plane only. Member reporting uses
the separate bridge -> Hermes -> Cambium/Telegram contract in
[`architecture/HERMES_REPORTING_CONTRACT.md`](architecture/HERMES_REPORTING_CONTRACT.md).

## Why SFU First

Cloudflare Realtime SFU gives Plexus:

- Application separation for production/staging.
- A session per WebRTC peer connection.
- Multiple tracks per session.
- Track IDs that can be pushed and pulled globally inside the Realtime application.
- HTTPS endpoints for session creation, track creation, renegotiation, track close, and session inspection.
- A backend-mediated architecture where the Worker controls what each client may publish or subscribe to.

The critical product requirement is multi-person screen sharing. That is easier to reason about if every microphone, camera, and screen share is represented as a separate Workspace Worker media-track record mapped to a Cloudflare track.

## Rejected For Phase 14

### RealtimeKit UI as primary implementation

Rejected for the first pass because it would pull Plexus toward a generic meeting widget. Plexus needs its own project-room shell, participant state, time-log linkage, closeout flow, and agent memory surface.

### Recording or transcription features

Deferred to Phase 15. Recording/transcription docs may inform future shape, but Phase 14 must not implement or imply recording, speech-to-text, or automatic summaries.

### Client-side Cloudflare credentials

Rejected. Plexus clients must never store Cloudflare Realtime API secrets. The Worker brokers all Cloudflare Realtime API calls.

## Configuration consumed by the inspected Worker

Use the sibling Worker Labs configuration; no employee Settings field should
request Cloudflare identifiers or credentials. The current server source reads:

| Name | Source use |
| --- | --- |
| `CF_REALTIME_APP_ID` | Application ID used to build the provider URL |
| `CF_REALTIME_API_TOKEN` | Primary server-held bearer credential |
| `CF_REALTIME_APP_TOKEN` | Compatibility fallback when the primary credential is absent |
| `CF_REALTIME_API_BASE_URL` | Provider origin override; source default `https://rtc.live.cloudflare.com` |

The handler appends `/v1/apps/:appId/sessions/new`; do not append another `/v1`
to the base from an obsolete env example. STUN URLs are supplied by the Worker
response. The older proposed names `CF_REALTIME_APP_SECRET`,
`CF_REALTIME_API_BASE`, `REALTIME_ROOMS_ENABLED` and local
`PLEXUS_REALTIME_CAPTURE_PROOF`/`PLEXUS_REALTIME_MOCK` switches are not verified
configuration knobs in the inspected app/handler. Reconcile additions in source
before adding them to deployment instructions.

The September [migration receipt](evidence/2026-09-05-labs-migration-review.md)
records name-only configuration evidence, not a session/token/media probe.

## Intended connectivity contract

Cloudflare Realtime docs describe Cloudflare's anycast media path and expose `stun.cloudflare.com:3478` for STUN. Phase 14 should assume:

- Default connectivity uses Cloudflare Realtime plus Cloudflare STUN.
- TURN is not a user-entered Plexus setting.
- If restrictive networks require TURN later, TURN configuration remains server-provided and user-invisible.
- Plexus renders a recoverable connection failure state before blaming permissions.

## Track Model

Plexus/Workspace Worker track kinds:

- `audio`: microphone.
- `camera`: camera video.
- `screen`: desktop/window/screen capture.
- `data`: reserved only if a data channel becomes necessary.

Each published track stores:

- Workspace Worker track ID.
- Cloudflare session ID.
- Cloudflare track ID.
- Track kind.
- Publisher participant ID.
- Room ID.
- Call session ID.
- State: `requested`, `negotiating`, `live`, `paused`, `closed`, `failed`.
- Display label for screen-share tracks.

Multiple screen-share tracks may be live in the same call. The Worker must never assume only one screen-share publisher.

## Target backend flow — acceptance still required

1. Plexus asks the Workspace Worker to join a room.
2. Worker checks the Access-backed Plexus session and project visibility.
3. Worker creates or reuses a Workspace Worker call session.
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

## Configuration review boundary

The required values can be represented without local device secrets:

- Worker env/secrets hold Cloudflare Realtime identifiers and credentials.
- Plexus receives only room/session responses from the Worker.
- Plexus uses browser/Electron WebRTC APIs and never needs Cloudflare account secrets.
- Deterministic test fixtures can validate local UI state without Cloudflare resources; they do not prove provider negotiation.

## Historical phase lineage

- RW-003 translates this decision into D1 schema and route contracts.
- RW-005 implements the Worker session broker.
- RW-007/RW-008 implement publish/subscribe controls and multi-screen-share UI.
- RW-013 covers future self-hosted transcription and is not a dependency for Phase 14.

The original RW-003/RW-005/RW-007/RW-008 plan names are retained for history.
Use open issues #26 and #23 for current transport and live privacy/audit work;
do not reopen completed scaffolding solely because the original plan predates it.
