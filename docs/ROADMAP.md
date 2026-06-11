# Plexus — Roadmap: Thoughtseed Employee Platform

**Status:** scoped 2026-06-11 · supersedes the standalone-tracker framing.

## Vision

Plexus is the **employee-facing client** of the existing **TeamForge control plane** (`teamforge-api.sheshnarayan-iyer.workers.dev` + D1 + R2). TeamForge stays the founder's aggregate console; Plexus is what each employee runs. Over time Plexus **absorbs the third-party integrations one at a time — Clockify → Slack (daily digest) → Huly (meeting calls + issue tracking)** — unifying them under Paperclip / agent tasks so Thoughtseed stops depending solely on third-party SaaS. Internal tool, single org, email-identified employees, centrally provisioned, auto-updating, **no secrets on device, no billing.**

## Architecture (grounded in the real D1 schema)

```
Plexus (Electron) ──Access JWT──▶ TeamForge Worker /v1/* ──▶ D1 (canonical)
        │                                                      R2 (OTA artifacts)
        └─ local SQLite cache (offline-tolerant projection)
```

**Reuse (already exists in D1 — confirmed):**
- `employees` — keyed by **email**, `monthly_quota_hours` (capacity metric, *not* billing), `is_active`, avatar.
- `employee_external_ids` / `project_external_ids` — map an employee/project to its Clockify/Huly/Slack id (`source` + `external_id`). This is how cutover stays consistent.
- `projects` — canonical graph (`name, code, project_type, status`); read via `GET /v1/projects`.
- `integration_credentials` — encrypted envelope (`encrypted_blob`, `key_version`); server holds keys. Read via Access-gated `GET /v1/credentials`. **Replaces the MultiCA/R2 key fields on the Settings page.**
- `integration_connections`, `sync_cursors/jobs/runs/journal/entity_mappings/conflicts` — sync control plane.
- `ota_channels` / `ota_releases` / `ota_install_events` + R2 `teamforge-artifacts` — OTA backend.
- `devices` — per-device channel for updates.

**Net-new (must build):**
- **D1 `time_entries` table** + `POST /v1/time-entries` (and `GET` for read). Shape: `{ id, workspace_id, employee_id, project_id, source, description, start_time, end_time, duration_seconds, created_at }` — **no `billable`**, `source` tags origin (`plexus|clockify|…`) so absorption is incremental and idempotent (upsert by `id`).
- **Employee auth surface**: Cloudflare Access (email OTP) enforced on the Worker (today it only advertises `TF_ACCESS_AUDIENCE`, enforcement is bearer-equality — see INTEGRATIONS.md auth section).
- **Plexus client code**: login flow, project sync, entry write-back queue, electron-updater.

## Data-model changes in Plexus

- `TimeEntry`: **drop `billable`**; add `employeeId` + `source`; keep `projectId, description, startTime, endTime, durationSeconds`.
- `Project`: **drop `rate`**; align to `{ id, name, code, projectType, status, color }` (color stays Plexus-local).
- Reports: **drop billable + utilization**; metrics become hours, **hours-vs-quota** (`monthly_quota_hours`), project breakdown.
- Settings: **delete MultiCA token + R2 key fields**; show "signed in as `<email>` · `<workspace>` · connected" status. (Architecturally closes review finding M1.)
- Onboarding: replace memberId/paperclip-path setup with email login.

## Phases

| # | Phase | Depends on | Net-new backend |
|---|-------|-----------|-----------------|
| **0** | **De-billing + model alignment** — strip billable/rate/utilization across `types.ts`, Timer, Reports, TimeEntryList, ProjectManager; reframe to hours/quota | none — **do first** | none |
| **1** | **Identity & projects (read)** — email login → Cloudflare Access OTP → session; pull `projects` + employee identity; ProjectManager → read-only assigned list; offline cache; Settings account status | Worker employee read routes | minor (employee `GET`) |
| **2** | **Time write-back** — `time_entries` table + `POST /v1/time-entries`; Plexus pushes entries (offline queue, idempotent by id); Worker becomes source-of-truth; TeamForge reads them | Phase 1 | `time_entries` + write route |
| **3** | **Clockify cutover** — one-time backfill of historical Clockify entries into D1 via the global token (map by `external_ids`); employees stop using Clockify | Phase 2 | backfill job |
| **4** | **Zero-trust hardening** — enforce Access JWT on the Worker (replace bearer-equality), per-employee scoping | Access config | Worker auth |
| **5** | **OTA** — electron-updater + Plexus channel on `ota_channels`/R2 + release pipeline | **Apple Developer ID + notarization** (to set up) | Plexus OTA channel |
| **6+** | **Slack (daily digest) → Huly (meetings/issues)** — written into the same activity model, unified under Paperclip agent tasks | Phase 2 model | per-source ingest |

## Recommended start

**Phase 0 now** — it's self-contained, needs no backend, and cleans the just-shipped UI (the Timer still has a `billable` spec box; Reports still shows billable + utilization). Then Phase 1 (auth + project sync) as the foundation everything online depends on.

## Open design decisions (track as we go)

- Time-entry write: direct `POST` per stop vs. batched offline queue (lean: queue, idempotent upsert).
- Project assignment: do all employees see all `active` projects, or a per-employee assignment table? (D1 has no assignment table yet — may be net-new, or derive from recent entries.)
- During Clockify coexistence: dual-write (Plexus + Clockify) or Plexus-only with backfill? (lean: Plexus-only once Phase 2 lands, backfill history once.)
