# Coworking Presence Leases Design

**Date:** 2026-07-16
**Status:** Approved for implementation
**Repositories:** Plexus desktop and TeamForge Cloudflare Worker

## Problem

Coworking currently treats a durable `realtime_participants.state = 'joined'` row as proof that a person is present now. Explicit room join keeps the roster and the floor separate, but there is no heartbeat, expiry, or read-time freshness rule. A crash, force quit, failed teardown, or network loss can therefore leave a ghost user online indefinitely. The existing `timing` and `isSpeaking` derivations are also misleading: an active room call is not a personal focus timer, and a live audio track is not proof of speech.

## State Model

The product must keep four independent layers:

1. **Roster membership** — the person is a known TeamForge workspace member. This never implies online.
2. **Authenticated app liveness** — at least one unexpired, server-authenticated Plexus app lease exists for the person.
3. **Personal activity** — the main process reports `available` or `focused` from the actual local timer. A paused or absent timer is not focused.
4. **Room context** — a live client may explicitly join a lounge or project room. Room membership does not create liveness by itself.

The invariant is:

`roster member != signed in != live app lease != room member != focused`

## Architecture

### TeamForge Worker

Migration `0016_coworking_presence_leases.sql` adds `coworking_presence_leases`, keyed uniquely by `(workspace_id, identity_id, client_instance_id)`. Each row stores server-owned identity fields, client activity/context, `last_seen_at`, and `expires_at`. The server chooses a 60-second lease lifetime; clients cannot extend or backdate it.

The authenticated routes are:

- `POST /v1/realtime/presence/heartbeat` — upsert the caller's client lease and return the accepted lease.
- `GET /v1/realtime/presence` — return only fresh leases for the caller's workspace, aggregated once per identity.
- `DELETE /v1/realtime/presence/:clientInstanceId` — best-effort removal of only the caller's matching client lease.

Every response used by the floor carries `identityId`, `lastSeenAt`, `expiresAt`, `activeClientCount`, and `presenceProof: 'authenticated_app_lease'`. The Worker derives identity, display name, employee, and workspace from the verified Cloudflare Access principal. Actor-like fields in the request body are ignored or rejected.

The heartbeat may include the main process's current room context. When it names a participant owned by the same principal and client instance, the Worker also refreshes that participant's `last_seen_at`. Room reads and counts exclude stale joined participants. This prevents the legacy realtime surface from reintroducing ghost presence.

### Plexus main process

A pure, dependency-injected heartbeat controller owns cadence, overlap prevention, retry behavior, and room context. Production wiring owns a stable installation client ID persisted in local settings, reads the actual running timer, and calls the Worker client. It starts with the Electron main process, not the Coworking renderer, so switching tabs does not make a live user disappear.

The controller sends an immediate heartbeat on start and after successful login, then every 15 seconds. A stopped or paused timer reports `available`; an unpaused running timer reports `focused` with its project and entry context. Failed heartbeats are retried on the next cadence without manufacturing local online state.

Realtime join IPC replaces renderer-generated client IDs with the stable main-process ID and records the returned room/call/participant context. Successful leave clears that context. Logout and quit attempt a disconnect before credentials disappear, but correctness never depends on that request arriving.

### Plexus floor and renderer

`getCoworkingFloor()` becomes one call to `/v1/realtime/presence`; it no longer fans out through room details or treats `joined` rows as online. The desktop maps the server contract to `FloorPresence` while retaining the existing visual ring vocabulary:

- `timing` means an actual unpaused timer is running.
- `lounge` means a fresh app lease has lounge room context and is not focused.
- `online` means a fresh app lease is available elsewhere.
- `idle` is not emitted for the live floor; offline roster members belong on a separate future roster surface.

`isSpeaking` stays false until a real voice-activity signal exists. A published audio track alone is not speech.

## Failure Semantics

- A lost network or crashed process stops heartbeats; the user disappears after at most 60 seconds.
- An expired Access session makes heartbeat requests fail closed; the existing lease expires naturally.
- Multiple app installations produce multiple client leases but one floor tile with an exact client count.
- Disconnecting one installation leaves the identity online while another fresh lease exists.
- A delayed or failed graceful disconnect cannot extend a lease.
- Stale room participants cannot influence online, focused, lounge, or speaking indicators.
- Overlapping heartbeat ticks are suppressed to avoid reordering and duplicate writes.

## Security and Privacy

- Presence routes require a registered Plexus principal; bearer-only and internal service credentials do not create human presence.
- Workspace and identity scope come only from the verified principal.
- Client IDs and context strings are length-bounded before SQL use.
- The renderer never receives or transmits Cloudflare Access credentials directly.
- The lease is operational presence metadata only; no transcript, audio level, or content is stored.

## Test Strategy

Strict TDD applies at every boundary. Worker tests cover migration shape, fail-closed auth, principal binding, server-owned expiry, upsert, multi-device aggregation, read-time expiry, scoped disconnect, and stale participant exclusion. Plexus tests cover stable client ID persistence, immediate and periodic heartbeats, non-overlap, session gating, timer truth, room-context lifecycle, login/logout/quit wiring, direct floor mapping, and honest labels. Existing Coworking and Worker suites remain mandatory regression gates.

## Delivery

The two repositories are implemented in isolated worktrees on matching `codex/coworking-presence-leases` branches. Independent Worker and desktop tasks may run in parallel after this contract is frozen. Cross-repository integration begins only after spec review and code-quality review pass for each side.
