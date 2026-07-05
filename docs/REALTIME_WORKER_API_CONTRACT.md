# Plexus Realtime Worker API Contract

**Task:** RW-003 / GitHub issue #15, implemented by RW-005 through RW-009  
**Status:** Contract plus local Worker/Plexus implementation pass  
**Updated:** 2026-06-15

## Purpose

This document translates the realtime workspace product contract into TeamForge Worker and D1 application state.

Cloudflare Realtime handles media sessions and tracks. TeamForge owns durable rooms, authorization, participant state, meeting records, project/time links, and Paperclip handoff.

Implementation note: the first local pass lives in the sibling TeamForge repo at `cloudflare/worker/migrations/0011_realtime_workspace.sql`, `cloudflare/worker/src/routes/realtime.ts`, and `/v1/realtime/*` route registration in `cloudflare/worker/src/routes/v1.ts`. Plexus consumes those routes through `src/main/teamforge.ts`, `src/preload/preload.ts`, shared realtime types, and the `RealtimeCapturePanel` room/call UI.

## D1 Tables

### `realtime_rooms`

Durable room records.

- `id TEXT PRIMARY KEY`
- `workspace_id TEXT NOT NULL`
- `project_id TEXT NULL`
- `name TEXT NOT NULL`
- `room_type TEXT NOT NULL`
- `state TEXT NOT NULL`
- `created_by_identity_id TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `archived_at TEXT NULL`
- `metadata_json TEXT NOT NULL DEFAULT '{}'`

Indexes:

- `(workspace_id, state)`
- `(workspace_id, project_id, state)`

### `realtime_call_sessions`

Application-level call sessions inside rooms.

- `id TEXT PRIMARY KEY`
- `workspace_id TEXT NOT NULL`
- `room_id TEXT NOT NULL`
- `project_id TEXT NULL`
- `state TEXT NOT NULL`
- `host_identity_id TEXT NOT NULL`
- `started_at TEXT NULL`
- `ended_at TEXT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `failure_reason TEXT NULL`
- `metadata_json TEXT NOT NULL DEFAULT '{}'`

Indexes:

- `(workspace_id, room_id, state)`
- `(workspace_id, project_id, started_at)`

Rule: only one `active` call session should exist per room.

### `realtime_participants`

Participant state in a call session.

- `id TEXT PRIMARY KEY`
- `workspace_id TEXT NOT NULL`
- `call_session_id TEXT NOT NULL`
- `room_id TEXT NOT NULL`
- `identity_id TEXT NOT NULL`
- `employee_id TEXT NULL`
- `role TEXT NOT NULL`
- `state TEXT NOT NULL`
- `joined_at TEXT NULL`
- `left_at TEXT NULL`
- `last_seen_at TEXT NOT NULL`
- `cloudflare_session_id TEXT NULL`
- `client_instance_id TEXT NULL`
- `metadata_json TEXT NOT NULL DEFAULT '{}'`

Indexes:

- `(workspace_id, call_session_id, state)`
- `(workspace_id, identity_id, state)`

### `realtime_media_tracks`

TeamForge metadata for Cloudflare media tracks.

- `id TEXT PRIMARY KEY`
- `workspace_id TEXT NOT NULL`
- `call_session_id TEXT NOT NULL`
- `room_id TEXT NOT NULL`
- `participant_id TEXT NOT NULL`
- `identity_id TEXT NOT NULL`
- `track_kind TEXT NOT NULL`
- `state TEXT NOT NULL`
- `cloudflare_session_id TEXT NULL`
- `cloudflare_track_id TEXT NULL`
- `label TEXT NULL`
- `published_at TEXT NULL`
- `closed_at TEXT NULL`
- `failure_reason TEXT NULL`
- `metadata_json TEXT NOT NULL DEFAULT '{}'`

Indexes:

- `(workspace_id, call_session_id, track_kind, state)`
- `(workspace_id, participant_id, state)`

Rule: screen-share tracks are not unique per call. Many `screen` tracks may be `live` in the same call.

### `realtime_events`

Append-only audit trail.

- `id TEXT PRIMARY KEY`
- `workspace_id TEXT NOT NULL`
- `room_id TEXT NULL`
- `call_session_id TEXT NULL`
- `participant_id TEXT NULL`
- `identity_id TEXT NOT NULL`
- `event_type TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `metadata_json TEXT NOT NULL DEFAULT '{}'`

Indexes:

- `(workspace_id, call_session_id, created_at)`
- `(workspace_id, identity_id, created_at)`

### `realtime_meeting_records`

Saved meeting closeout records.

- `id TEXT PRIMARY KEY`
- `workspace_id TEXT NOT NULL`
- `room_id TEXT NOT NULL`
- `call_session_id TEXT NOT NULL`
- `project_id TEXT NULL`
- `host_identity_id TEXT NOT NULL`
- `started_at TEXT NOT NULL`
- `ended_at TEXT NOT NULL`
- `duration_seconds INTEGER NOT NULL`
- `manual_notes TEXT NOT NULL DEFAULT ''`
- `decisions_json TEXT NOT NULL DEFAULT '[]'`
- `action_items_json TEXT NOT NULL DEFAULT '[]'`
- `participant_ids_json TEXT NOT NULL DEFAULT '[]'`
- `linked_time_entry_ids_json TEXT NOT NULL DEFAULT '[]'`
- `linked_issue_ids_json TEXT NOT NULL DEFAULT '[]'`
- `screen_share_summary_json TEXT NOT NULL DEFAULT '[]'`
- `paperclip_artifact_ref TEXT NULL`
- `transcript_ref TEXT NULL`
- `recording_ref TEXT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Indexes:

- `(workspace_id, project_id, started_at)`
- `(workspace_id, call_session_id)`

Rules:

- `transcript_ref` and `recording_ref` are reserved for Phase 15 and must remain null in Phase 14.
- Meeting records are created from metadata/manual closeout, not automatic transcription.
- Post-Phase-14 Ambient Floor recording routes may populate `recording_ref` only after explicit recording start, stop, and finalize flows exist. This supersedes the Phase 14 reservation only for calls captured through the routes below.

## Route Contract

All routes use the existing Plexus session resolved from Cloudflare Access. No route accepts user-supplied email as authority.

### `GET /v1/realtime/rooms`

Lists visible rooms.

Query:

- `projectId` optional.
- `includeArchived` optional, admin only.

Response:

```json
{
  "rooms": [
    {
      "id": "room_project_123",
      "workspaceId": "ws_thoughtseed",
      "projectId": "proj_123",
      "name": "Project Room",
      "roomType": "project_room",
      "state": "open",
      "activeCallId": null,
      "presence": {
        "participants": 0,
        "screenShares": 0
      }
    }
  ]
}
```

### `POST /v1/realtime/rooms`

Creates a room. Admin or project-owner route only in first pass.

Body:

- `projectId`
- `name`
- `roomType`
- `metadata`

Failure states:

- `realtime_room_forbidden`
- `realtime_project_not_visible`
- `realtime_room_invalid`

### `GET /v1/realtime/rooms/:roomId`

Returns room, active call, visible participants, and visible tracks.

### `POST /v1/realtime/rooms/:roomId/join`

Joins or opens a call session.

Body:

- `clientInstanceId`
- `intent`: `presence_only` or `media`

Response:

```json
{
  "room": {},
  "call": {},
  "participant": {},
  "cloudflare": {
    "appId": "public-app-id",
    "sessionId": "cf-session-id-or-null",
    "stunUrls": ["stun:stun.cloudflare.com:3478"]
  }
}
```

The response must not include app secrets or API tokens.

Failure states:

- `realtime_join_denied`
- `realtime_room_closed`
- `realtime_session_expired`
- `realtime_provider_unavailable`

### `POST /v1/realtime/calls/:callId/tracks`

Creates or subscribes to a track through Worker-mediated Cloudflare negotiation.

Body:

- `participantId`
- `trackKind`: `audio`, `camera`, or `screen`
- `direction`: `publish` or `subscribe`
- `sdp`
- `label`
- `targetTrackIds`, for subscribe flows.

Response:

- TeamForge track metadata.
- Client-safe Cloudflare SDP answer/offer data.
- Renegotiation instruction if required.

Failure states:

- `realtime_track_forbidden`
- `realtime_track_stale`
- `realtime_track_negotiation_failed`
- `realtime_screen_share_limit`

### `POST /v1/realtime/calls/:callId/renegotiate`

Completes a renegotiation step after track add/subscription changes.

### `POST /v1/realtime/calls/:callId/tracks/:trackId/close`

Closes one track.

Rules:

- Publisher can close own track.
- Host/admin can close tracks according to moderation policy.
- Viewer cannot close someone else's track.

### `POST /v1/realtime/calls/:callId/leave`

Marks participant as left, closes participant-owned live tracks, and writes audit events.

### `POST /v1/realtime/calls/:callId/end`

Host/admin ends the call session.

### Explicit recording manifest routes (post-Phase-14 / Ambient Floor)

Focused project-zone recording is allowed only through explicit Worker routes under `/v1/realtime/calls/:callId/recordings`. These routes do not exist in Phase 14 and must not be implied by presence, join, track publish, screen share, end-call, or closeout behavior.

The Worker owns all R2 writes through the existing project vault binding, for example the existing `TEAMFORGE_ARTIFACTS` binding if that is the active project artifact vault. That binding name is server-side audit/configuration metadata only. Recording storage is the associated R2 projects Thoughtseed vault already present as the project vault, not a standalone bucket. Plexus renderer processes receive only client-safe opaque `project_vault` recording and manifest refs; they must never receive R2 credentials, bucket tokens, or signed write authority.

Recording is manifest-first:

- Start creates a pending manifest object in the project vault before capture begins.
- Stop closes the active recording window and records stopped track metadata.
- Finalize seals the manifest after raw track refs and any composed playback refs are known.
- Meeting `recording_ref` points to the finalized manifest ref, not directly to a raw media object.

The lounge is unrecorded by default. A lounge conversation may be recorded only after it is explicitly promoted to a named project/session with `projectId`, participant consent snapshot, visible recording state, manifest association, and capture scope recorded before capture starts. Invalid or silent lounge recording must fail closed.

#### `POST /v1/realtime/calls/:callId/recordings/start`

Starts an explicit recording for a focused project zone or promoted named session.

Body:

- `projectId` required for `project_zone` recordings and for promoted lounge/session recordings before capture starts.
- `zoneType`: `project_zone` or `promoted_lounge_session`.
- `sessionName` required when `zoneType` is `promoted_lounge_session`.
- `captureScope`: object naming the captured track kinds (`audio`, `camera`, `screen`), participant IDs, optional track IDs, and whether composed playback is requested.
- `consentSnapshot`: participant consent state, consent timestamps, and the visible recording indicator state observed before capture.
- `retentionPolicy` optional project policy identifier.

Response:

```json
{
  "recording": {
    "id": "rec_123",
    "callId": "call_123",
    "workspaceId": "ws_thoughtseed",
    "projectId": "proj_123",
    "zoneType": "project_zone",
    "state": "recording",
    "captureScope": {
      "trackKinds": ["audio", "screen"],
      "participantIds": ["participant_123"],
      "trackIds": ["track_screen_123"],
      "composedPlaybackRequested": true
    },
    "consentSnapshot": {
      "capturedAt": "2026-07-05T00:00:00.000Z",
      "participants": [
        {
          "participantId": "participant_123",
          "identityId": "identity_123",
          "consented": true,
          "consentedAt": "2026-07-05T00:00:00.000Z"
        }
      ],
      "visibleRecordingState": "recording_starting"
    },
    "manifest": {
      "storage": "project_vault",
      "ref": "project_vault:projects/proj_123/realtime/recordings/rec_123/manifest.json",
      "prefix": "projects/proj_123/realtime/recordings/rec_123/",
      "key": "projects/proj_123/realtime/recordings/rec_123/manifest.json",
      "version": "opaque-version-or-etag",
      "checksum": "sha256:opaque-checksum",
      "status": "pending"
    },
    "rawTrackRefs": [],
    "composedPlaybackRef": null,
    "startedAt": "2026-07-05T00:00:00.000Z",
    "stoppedAt": null,
    "finalizedAt": null
  }
}
```

#### `POST /v1/realtime/calls/:callId/recordings/:recordingId/stop`

Stops an active recording window. It does not finalize storage.

Body:

- `participantId` or host/admin actor context.
- `reason`: `user_stop`, `host_stop`, `call_ended`, or `failure`.

Response:

- Recording state `stopped`.
- `stoppedAt`.
- Captured raw track metadata known at stop time.
- Manifest status `stopped_pending_finalize`.

#### `POST /v1/realtime/calls/:callId/recordings/:recordingId/finalize`

Finalizes the recording manifest after provider/storage writes complete.

Body:

- `rawTrackRefs`: array of project vault refs for raw captured tracks.
- `composedPlaybackRef` optional project vault ref for composed playback.
- `durationSeconds`.
- `finalizeReason`: `normal`, `call_ended`, or `recovered_after_failure`.

Response:

- Recording state `finalized`.
- Final manifest ref under the project vault prefix/key.
- Raw track refs.
- Optional composed playback ref.
- Optional `meetingRecordingRef` value safe to attach to `realtime_meeting_records.recording_ref`.

#### `GET /v1/realtime/calls/:callId/recordings/:recordingId/manifest`

Returns the client-safe recording manifest if the viewer can access the associated project/session.

Manifest response fields:

- `recordingId`, `callId`, `workspaceId`, `roomId`, and `projectId`.
- `zoneType` and `sessionName` when promoted from lounge/session context.
- `captureScope`, including track kinds, participant IDs, track IDs, and composed playback intent.
- `consentSnapshot` and participant snapshot captured before recording start.
- `startedAt`, `stoppedAt`, `finalizedAt`, and manifest `state`.
- `manifestRef`: opaque `project_vault` ref plus project vault prefix, key, version/etag when available, and checksum when available.
- `rawTrackRefs`: per-track project vault refs with kind, publisher identity, started/stopped timestamps, object key, byte size, checksum, and provider status.
- `composedPlaybackRef` optional project vault ref.
- `meetingRecordingRef` optional value for meeting record attachment.

Failure states across recording routes:

- `realtime_recording_forbidden`
- `realtime_recording_lounge_forbidden`
- `realtime_recording_project_required`
- `realtime_recording_consent_required`
- `realtime_recording_already_active`
- `realtime_recording_not_active`
- `realtime_recording_already_stopped`
- `realtime_recording_not_finalized`
- `realtime_recording_provider_unavailable`
- `realtime_recording_storage_unavailable`
- `realtime_recording_manifest_missing`

Rules:

- No recording starts automatically from presence, join, screen share, track publish, call end, or closeout.
- Missing project association fails unless the call has already been promoted to a named project/session before capture.
- Missing consent fails before any raw media write is attempted.
- Hidden transcription, hidden Paperclip write, hidden time-entry creation, and hidden lounge capture side effects remain forbidden.
- Manifest, raw track, and composed playback refs all live under the project vault prefix for the associated project/session.

### `POST /v1/realtime/calls/:callId/closeout`

Creates or updates a meeting record and optional Paperclip handoff.

Body:

- `manualNotes`
- `decisions`
- `actionItems`
- `linkedTimeEntryIds`
- `linkedIssueIds`
- `sendToPaperclip`

Failure states:

- `realtime_closeout_forbidden`
- `realtime_closeout_invalid`
- `realtime_paperclip_handoff_failed`

### `GET /v1/realtime/meetings/:meetingId`

Returns meeting record if visible to the viewer.

## Authorization Matrix

| Action | Employee | Host | Admin |
|---|---:|---:|---:|
| List visible rooms | yes | yes | yes |
| Create workspace room | no | no | yes |
| Join visible room | yes | yes | yes |
| Publish own mic/camera | yes | yes | yes |
| Publish own screen | yes | yes | yes |
| Close own track | yes | yes | yes |
| Close another participant track | no | yes | yes |
| End call | no | yes | yes |
| Save closeout | yes | yes | yes |
| View all project rooms | no | no | yes |

## Migration Safety

- All tables are additive.
- Existing `employees`, `projects`, `time_entries`, `plexus_identities`, and onboarding tables remain unchanged.
- Project visibility uses the existing session `projectVisibility` policy until a project-assignment table exists.
- Seed migration may create one workspace lobby and one project room per active project, but implementation can also lazily create rooms on first access.

## Response Type Names

Shared types should be introduced under names compatible with Plexus renderer and Worker code:

- `RealtimeRoom`
- `RealtimeCallSession`
- `RealtimeParticipant`
- `RealtimeMediaTrack`
- `RealtimeMeetingRecord`
- `RealtimePresenceSummary`
- `RealtimeJoinResponse`
- `RealtimeTrackNegotiationResponse`
- `RealtimeCloseoutPayload`

## Validation Before RW-005

- D1 migration can be replayed locally without destructive changes.
- Route names and response shapes are reviewed.
- Unauthorized requests fail closed.
- Multiple `screen` tracks in one call are representable.
- Null transcript/recording refs are allowed and expected.
