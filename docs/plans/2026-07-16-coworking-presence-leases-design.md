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

Migration `0016_plexus_app_presence_leases.sql` adds `plexus_app_presence_leases`, keyed uniquely by `(workspace_id, identity_id, client_instance_id)`, plus a `presence_session_id` column on realtime participants. The stable client key identifies one installation; an opaque Worker-issued presence session identifies one authenticated main-process lifetime. Opening a new presence session atomically replaces the prior session for that client and clears old room context. The server chooses a 60-second lease lifetime; clients cannot extend or backdate it.

The authenticated routes are:

- `POST /v1/realtime/presence/session` — rotate the caller's client to a new Worker-issued presence session and clear prior room context.
- `POST /v1/realtime/presence/heartbeat` — renew the current presence session with a monotonically increasing sequence and personal activity only.
- `GET /v1/realtime/presence` — return only fresh leases for the caller's workspace, aggregated once per identity.
- `DELETE /v1/realtime/presence/:clientInstanceId/:presenceSessionId` — best-effort removal of only the caller's matching current session.

Every response used by the floor carries `identityId`, `observedAt`, `lastSeenAt`, `expiresAt`, `activeClientCount`, and `presenceProof: 'authenticated_app_lease'`. The Worker derives identity, display name, employee, and workspace from the verified Cloudflare Access principal. Employee principals must still map to an active employee; admins are the explicit non-employee exception. Actor-like fields in the request body are ignored or rejected.

Heartbeat accepts no room fields. Explicit realtime join/leave handlers update lease room context from the server-verified room, participant, call, principal, client, and presence session. The heartbeat sequence conditions the entire activity tuple and timestamps, so an older request completing late cannot attach stale activity to fresh evidence. Before renewal, the Worker deletes expired rows in the same workspace using the server cutoff; reads remain non-mutating. Room reads and counts require the participant's exact fresh, current presence session and server-owned room context. Restarting the app rotates the session, so a crashed `joined` row cannot reappear without another explicit join.

### Plexus main process

A pure, dependency-injected heartbeat controller owns session acquisition, sequence, cadence, overlap prevention, and retry behavior. Production wiring owns a stable installation client ID persisted in local settings, keeps the Worker-issued presence session only in main-process memory, reads the actual running timer, and calls the Worker client. It starts with the Electron main process, not the Coworking renderer, so switching tabs does not make a live user disappear.

The controller opens a presence session and sends an immediate sequenced heartbeat on start and after successful login, then every 15 seconds. A stopped or paused timer reports `available`; an unpaused running timer reports `focused` with its project and entry context. Invalid or expired session responses cause clean reacquisition, which also clears stale room state. Failed heartbeats are retried on the next cadence without manufacturing local online state.

Realtime join IPC supplies the stable client ID and current Worker-issued presence session from the main process; the renderer supplies neither. The Worker verifies that session before joining and writes canonical room context. Successful leave clears that server context. Logout and quit attempt a session-specific disconnect before credentials disappear, but correctness never depends on that request arriving.

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
- A restart rotates the presence session and clears room context before the old session can renew.
- Stale room participants cannot influence online, focused, lounge, or speaking indicators.
- Overlapping heartbeat ticks are suppressed to avoid reordering and duplicate writes.

## Security and Privacy

- Presence routes require a registered Plexus principal; bearer-only and internal service credentials do not create human presence.
- Workspace and identity scope come only from the verified principal.
- Client IDs and activity evidence strings are length-bounded before SQL use; invalid enum/shape combinations fail with 400.
- Room context is never accepted from heartbeat JSON; realtime join/leave derives it from server state.
- Presence session IDs are Worker-issued, held only in the Electron main process, and never sent to the renderer.
- The renderer never receives or transmits Cloudflare Access credentials directly.
- The lease is operational presence metadata only; no transcript, audio level, or content is stored.

## Test Strategy

Strict TDD applies at every boundary. Worker tests cover migration shape, fail-closed auth, active-employee eligibility, presence-session rotation, server-owned expiry, sequenced renewal, multi-device aggregation, read-time expiry, scoped disconnect, forged room rejection, join/leave-owned room context, and crash/restart stale-participant exclusion. Plexus tests cover stable client ID persistence, in-memory session custody, immediate and periodic heartbeats, sequence/non-overlap, session reacquisition, timer truth, login/logout/quit wiring, direct floor mapping, and honest labels. Existing Coworking and Worker suites remain mandatory regression gates.

## Delivery

The two repositories are implemented in isolated worktrees on matching `codex/coworking-presence-leases` branches. Independent Worker and desktop tasks may run in parallel after this contract is frozen. Cross-repository integration begins only after spec review and code-quality review pass for each side.
