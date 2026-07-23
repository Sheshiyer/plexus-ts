# Proof Custody

Plexus uses `proofStatus` as the canonical proof language across local work
records, reports, assistant daily events, and Fabric task evidence.

## Proof Status

| Status | Meaning |
|---|---|
| `pending` | No work has been recorded yet, or proof has not been checked. |
| `verified` | Every work record in the subject has matched proof. |
| `partial` | Some proof is present, but the subject is not fully verified. |
| `missing` | Work exists and no verified proof is attached. |
| `legacy_unverified` | Work predates the current GitHub-backed proof model. |
| `sync_failed` | Proof could not be checked because sync failed. |

## Custody Ledger

The `proof_custody_records` table records proof-bearing actions that previously
existed only as derived report state or helper-specific payloads.

Each row records:

- `subject_type` and `subject_id`
- canonical `proof_status`
- `evidence_type`
- optional evidence `strength`
- optional `artifact_ref`
- canonical `payload_hash`
- redacted/bounded payload JSON
- created and updated timestamps

Records are idempotent on `subject_type`, `subject_id`, `evidence_type`, and
`payload_hash`. Re-running the same report or handoff updates the existing row
instead of creating duplicates.

## Current Writers

- Electron IPC report generation: daily, weekly, and monthly reports.
- Local API report generation: daily, weekly, and monthly reports.
- Standup evidence generation.
- Weekly/monthly review generation.
- Assistant daily event queue/send.
- Thoughtseed Fabric task report evidence.

## Fabric Task Custody

Fabric task assignments use `fabric_tasks` as the local source of truth. The
table keeps queryable member, project, work-entry, status, mode, evidence, and
proof columns while the full bounded task payload remains available for the
renderer contract.

Fabric task history uses `fabric_task_history_events`. Replaying the same
`task_id` and `event_id` with the same payload hash is idempotent. Replaying the
same event id with a different payload hash records a row in
`fabric_task_history_conflicts` so the mismatch is visible without mutating the
accepted event.

`ts.fabricTasksJson` is a compatibility mirror for legacy app builds. New writes
upsert the SQLite task/history rows first and mirror JSON only after that write
succeeds; reads prefer SQLite and backfill valid legacy rows when the table is
empty. Malformed legacy rows are skipped with a local bridge error instead of
deleting the old cache.

## Assistant Boundary

Renderer-local assistant fallbacks cannot execute write-capable actions. A
confirm-required assistant action must have a persisted intent id and execute
through the main-process assistant tool path so intent state, audit rows, and
proof custody remain aligned.
