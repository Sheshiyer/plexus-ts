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

## Assistant Boundary

Renderer-local assistant fallbacks cannot execute write-capable actions. A
confirm-required assistant action must have a persisted intent id and execute
through the main-process assistant tool path so intent state, audit rows, and
proof custody remain aligned.
