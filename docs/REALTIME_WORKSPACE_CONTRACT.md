# Plexus Realtime Workspace Contract

**Task:** RW-001 / GitHub issue #13  
**Status:** Contract draft for review  
**Updated:** 2026-06-15  

## Purpose

Plexus needs a native realtime workspace that replaces the remaining external meeting/project SaaS gap without breaking the existing TeamForge rules: email-only Cloudflare Access identity, Worker/D1 canonical application state, no device secrets, local per-member Paperclip agents, and explicit user control over time logging and meeting memory.

This contract freezes the product and room model before backend, Electron, and validation work begin. It does not provision Cloudflare resources or implement media code.

## Source Boundaries

Cloudflare Realtime SFU provides the media transport primitives. TeamForge owns the application model around those primitives.

- Cloudflare Realtime `Session` is treated as the WebRTC peer connection between a Plexus client and Cloudflare's nearest data center.
- Cloudflare Realtime `Track` is treated as a published `MediaStreamTrack`, such as microphone audio, camera video, or screen-share video.
- TeamForge owns rooms, project membership, presence, authorization, call lifecycle, meeting records, audit records, and Paperclip handoff.
- Plexus Electron owns capture permissions, local preview, controls, layout, user-visible consent, and graceful failure states.

Current reference docs checked for this contract:

- Cloudflare Realtime overview: https://developers.cloudflare.com/realtime/
- Cloudflare Realtime SFU sessions/tracks: https://developers.cloudflare.com/realtime/sfu/sessions-tracks/
- Cloudflare Realtime SFU connection API: https://developers.cloudflare.com/realtime/sfu/https-api/
- Cloudflare Realtime SFU example architecture: https://developers.cloudflare.com/realtime/sfu/example-architecture/
- Cloudflare RealtimeKit recording guide, future reference only: https://developers.cloudflare.com/realtime/realtimekit/recording-guide/

## Out of Scope For Phase 14

- Self-hosted speech-to-text.
- AI summaries generated from audio.
- Meeting recording ingestion.
- Automatic transcription display.
- Recording or transcription consent flows beyond reserved future fields.
- A clone of any external issue tracker.
- A standalone chat product modeled after external chat tools.
- Any local Cloudflare API token or manual credential entry in Plexus.

Phase 14 may reserve nullable transcript/recording reference fields so Phase 15 can attach self-hosted transcription later, but those fields must not imply that transcription exists.

## Product Surfaces

### Realtime Rooms

Rooms are the durable places where team members gather. A room belongs to exactly one workspace and may optionally be attached to one project.

Room types:

- `workspace_lobby`: general Thoughtseed presence.
- `project_room`: default room for a TeamForge project.
- `meeting_room`: scheduled or ad hoc room created for a specific meeting.
- `support_room`: temporary help/collaboration room.

Room lifecycle:

- `draft`: created by an admin or project workflow but not visible to normal users.
- `open`: visible and joinable to authorized users.
- `active`: at least one participant is present or a call is running.
- `locked`: visible but only admins/hosts can admit new participants.
- `archived`: retained for history but no longer joinable.

### Presence

Presence is app state, not media state. A user can be present in a room without publishing audio/video.

Presence states:

- `offline`: no active Plexus session.
- `available`: logged in and reachable.
- `in_room`: present in a room without an active media track.
- `in_call`: present and connected to a call session.
- `sharing`: publishing one or more screen-share tracks.
- `busy`: manually marked or inferred from active meeting participation.
- `away`: idle or backgrounded.

Presence must degrade safely when realtime media is unavailable. If the media session fails, room presence can remain available with a visible disconnected call state.

### Call Sessions

A call session is the TeamForge application record for a live or completed room conversation. It is distinct from a Cloudflare Realtime session.

Call session lifecycle:

- `scheduled`: created ahead of time, not yet joinable.
- `open`: joinable, no active participants required.
- `active`: at least one participant has joined the call.
- `ending`: host or system is closing the session.
- `ended`: closed and available for meeting record creation.
- `failed`: setup failed before a valid call could start.

Rules:

- A room can have zero or one active call session.
- A call session can have many participants.
- A participant can publish zero or more tracks.
- Joining a room does not automatically start a time entry.
- Starting/stopping a time entry remains an explicit Plexus action.

### Participants

Participant identity comes from the existing Plexus session resolved by `/v1/whoami`.

Participant roles:

- `host`: can lock/end the call and manage room-level controls.
- `speaker`: can publish microphone, camera, and screen-share tracks.
- `viewer`: can receive tracks but cannot publish until promoted.
- `admin_observer`: admin visibility role for audits and support.
- `agent_observer`: reserved for future Paperclip/transcription agents; disabled in Phase 14 unless explicitly implemented as metadata-only.

Participant lifecycle:

- `invited`: included by room/project membership or direct invite.
- `joining`: requested admission and is negotiating media/session state.
- `joined`: admitted to the room/call.
- `publishing`: publishing at least one live media track.
- `muted`: microphone publishing disabled by self or policy.
- `disconnected`: temporarily lost media or app connection.
- `left`: explicitly left.
- `removed`: kicked or revoked by host/admin.

### Media Tracks

TeamForge stores track metadata. Cloudflare transports the media.

Track kinds:

- `audio`: microphone or app audio.
- `camera`: webcam/video camera.
- `screen`: screen, window, tab, or app capture.
- `data`: optional realtime data channel metadata if chosen later.

Track lifecycle:

- `requested`: Plexus asked to publish or subscribe.
- `negotiating`: Worker/Cloudflare SDP flow is in progress.
- `live`: track is available for subscribed participants.
- `paused`: local publishing intentionally suspended without closing the call.
- `closed`: track is stopped and should no longer be subscribed.
- `failed`: track setup or transport failed.

Rules:

- Track IDs from Cloudflare are not authorization on their own.
- The Worker must verify that the requesting participant owns the room/call action.
- Track close requests must be scoped to the requesting participant unless host/admin policy permits otherwise.
- Camera/audio/screen tracks are independently controllable.

### Multi-Person Screen Sharing

Multiple participants may share screens at the same time. This is a first-class requirement, not an edge case.

Screen-share states:

- `none`: no active screen shares.
- `single_share`: one active screen-share track.
- `multi_share`: two or more active screen-share tracks.
- `focused_share`: viewer has pinned one screen-share track while others remain available.

Rules:

- Every shared screen must show the publisher identity.
- Every publisher must have a visible local stop-share control.
- Multiple screen shares must not force camera/audio tracks to stop.
- The UI must remain stable at the app minimum window size.
- Screen-share permission denial must be recoverable without leaving the room.

### Meeting Records

A meeting record is created when a call session ends or when a user manually saves a meeting closeout.

Required fields:

- Workspace ID.
- Room ID.
- Call session ID.
- Project ID, when linked.
- Host identity ID.
- Participant identity IDs.
- Start and end timestamps.
- Duration.
- Manual notes.
- Decisions.
- Action items.
- Linked time entry IDs, if explicitly attached.
- Linked issue/task IDs, reserved for future internal issue/activity work.
- Screen-share summary metadata, without recording payload.
- Transcript reference, nullable and deferred to Phase 15.
- Recording reference, nullable and deferred to Phase 15.

Rules:

- A meeting record can exist without transcript text.
- A meeting record can exist without a recording.
- Manual notes and structured closeout fields are the Phase 14 source for Paperclip memory.
- The user must be able to tell what will be sent to Paperclip before saving closeout.

## Data Ownership Contract

TeamForge Worker/D1 owns:

- Room records.
- Room/project visibility.
- Call session records.
- Participant records.
- Track metadata.
- Join/leave/publish/stop audit events.
- Meeting records.
- Project/time-entry linkage.
- Paperclip handoff artifacts or handoff queue records.

Cloudflare Realtime owns:

- WebRTC session negotiation.
- Media transport.
- Track routing.
- Track IDs and session IDs inside the Cloudflare Realtime application.

Plexus local state owns:

- Local capture permission status.
- Local selected input/output devices.
- Local preview state.
- Ephemeral UI state, such as selected layout or focused screen share.
- Offline-friendly cached room list, if needed.

Paperclip owns:

- Agent-readable meeting memory after the user saves it.
- Follow-up context derived from manual notes, decisions, action items, participants, projects, and time/activity metadata.

## API Contract Shape

The exact route names may be refined in RW-003, but the first implementation should preserve these surfaces:

- `GET /v1/realtime/rooms`
- `POST /v1/realtime/rooms`
- `GET /v1/realtime/rooms/:roomId`
- `POST /v1/realtime/rooms/:roomId/join`
- `POST /v1/realtime/calls/:callId/leave`
- `POST /v1/realtime/calls/:callId/tracks`
- `POST /v1/realtime/calls/:callId/tracks/:trackId/close`
- `POST /v1/realtime/calls/:callId/renegotiate`
- `POST /v1/realtime/calls/:callId/end`
- `POST /v1/realtime/calls/:callId/closeout`
- `GET /v1/realtime/meetings/:meetingId`

Every route must resolve the principal from the existing Access-backed Plexus session. No route may accept a user-supplied email as authority.

## Authorization Rules

- Admins can see all rooms in the workspace.
- Employees can see workspace lobby plus rooms for visible active projects.
- Project visibility follows the existing TeamForge project visibility policy until a narrower assignment table exists.
- A participant can close only their own tracks unless they are host/admin.
- A host/admin can end a call.
- A viewer cannot publish tracks until promoted.
- Agent observer roles are disabled unless a future issue explicitly enables them.
- Unauthenticated requests fail closed.

## Privacy And Consent

Required visible UI indicators:

- Microphone live/muted.
- Camera live/off.
- Screen sharing live/off.
- Active screen-share publisher identity.
- Meeting closeout destination before saving.
- Recording/transcription unavailable or disabled in Phase 14.

Required user actions:

- User explicitly starts microphone publishing.
- User explicitly starts camera publishing.
- User explicitly starts screen sharing.
- User explicitly stops screen sharing.
- User explicitly saves meeting closeout to Paperclip.
- User explicitly attaches a meeting to a time entry, or starts/stops a timer separately.

Forbidden in Phase 14:

- Hidden recording.
- Hidden transcription.
- Silent time entry creation from meeting attendance.
- Silent Paperclip memory write without a closeout action or clear policy.
- Local Cloudflare credentials in Settings.

## Failure States

Plexus must render recoverable states for:

- Cloudflare Realtime unavailable.
- Worker route unavailable.
- Access session expired.
- Room join denied.
- Microphone permission denied.
- Camera permission denied.
- Screen Recording permission denied on macOS.
- Track negotiation failed.
- Participant disconnected.
- Screen-share track closed unexpectedly.
- Meeting closeout failed to save.

Failure states should preserve room context and offer a retry or clear next action.

## Phase 14 Acceptance

Phase 14 can be considered implemented only when:

- Users can browse project rooms.
- Authorized users can join a room.
- Users can leave the ambient lounge and any locally joined project room without hidden double-presence.
- Users can participate in audio/video calls.
- Users can publish and stop camera, microphone, and screen-share tracks.
- More than one user can share a screen in the same room model.
- Meeting records link to projects and optional time entries.
- Meeting closeout can produce a non-transcript Paperclip memory artifact.
- Unauthorized access fails closed.
- Consent/audit indicators are visible.
- Transcription remains deferred and no UI implies it is available.

## Phase 14 Regression Note: Co-working Exit Controls

Added 2026-06-18 for the `0.4.0` co-working surface.

- The renderer keeps a local active-join registry for lounge and project-room joins.
- Project room cards entered through room CTAs or floor avatars must render an active state and a `LEAVE` action.
- Joining a different room must first leave any existing local join, so members do not silently remain present in both lounge and project room.
- Renderer teardown must best-effort call `/v1/realtime/calls/:callId/leave` for every locally retained participant before closing local media/session refs.
- Visual/API smoke evidence for the `0.4.0` surface is stored in `docs/evidence/2026-06-18-plexus-0.4.0/`, including `renderer-coworking-smoke.json` and `realtime-leave-proof.json`.

## Phase 14 Regression Note: Closeout and Privacy Controls

Added 2026-06-19 for the pre-patch co-working hardening pass.

- Co-working lounge and locally joined project rooms expose an explicit closeout action backed by `/v1/realtime/calls/:callId/closeout`.
- Closeout requires notes, decisions, or action items before sending; empty meeting artifacts should not be generated.
- Paperclip handoff is a visible checkbox in the closeout modal. No hidden Paperclip memory write is allowed.
- Active lounge state visibly marks audit, no recording, and no transcript.
- Active screen share displays the local publisher identity in the lounge and publishes track labels with the participant display name.
- Issue #22 remains open until a live closeout produces a Worker/Paperclip artifact proof.
- Issue #23 remains open until unauthorized join fail-closed and Worker audit rows are proven.
- Issue #24 remains open until the smoke pack includes two participants or a documented local simulation path.

## Phase 15 Reservation

Phase 15 may add a self-hosted transcription agent. The reserved future contract is:

- A visible agent participant or visible transcription indicator.
- Explicit consent and retention policy.
- Transcript chunk storage references.
- Summary, decisions, and action-item extraction.
- Paperclip ingestion of transcript-derived artifacts.

No Phase 14 task may depend on Phase 15 existing.

## RW-001 Review Checklist

- [x] Names room/project/workspace entities and lifecycle states.
- [x] Distinguishes Cloudflare media-track state from TeamForge/D1 application state.
- [x] Makes transcription out of scope except future data-shape reservation.
- [x] Declares consent/privacy UI requirements for calls and screen sharing.
- [x] Aligns with `docs/ROADMAP.md` and `docs/HANDOFF.md` direction.
- [ ] Human signoff before RW-003, RW-005, or RW-006 begins.
