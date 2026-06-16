# Plexus — Roadmap: Thoughtseed Employee Platform

**Status:** Phase 14 Wave 2 shipped · 2026-06-16 · version 0.3.0 released

---

## Vision

Plexus is the **employee-facing client** of the **TeamForge control plane** (`plexus-api.thoughtseed.space` + D1 + R2). TeamForge stays the founder's aggregate console; Plexus is what each employee runs. Over time Plexus **retires external SaaS dependencies one workflow at a time** — Clockify (done) → native realtime workspace for team communication, meetings, project activity, time logging, and Paperclip agent tasks — so Thoughtseed stops depending on third-party tools for core operations.

**Core principles (irrevocable):**
- **Internal tool** — single org, no billing, no external customers
- **Email-only auth** — Cloudflare Access OTP, zero device secrets
- **Local per-member** — each employee machine runs its own Paperclip agent fabric
- **Worker canonical** — all data (time, projects, KPIs, preferences) flows through Worker to D1
- **Agent-first** — standups, context, usage learning all serve the Paperclip agents

---

## Architecture

```
Plexus (Electron) ──Access JWT──▶ TeamForge Worker /v1/* ──▶ D1 (canonical)
         │                              │
         └─ local SQLite cache          └─ R2 (OTA artifacts)
         │
         └─ Paperclip runtime (:3100/:3101) — per-member agents
                ├── vault/standups/<member>-<date>.md
                ├── agents/ceo/CONTEXT.md (prefs + usage insights)
                └── paperclip-cycle.sh (sync-issues → context-sync → reconcile → usage-evolution → heartbeats)
```

**Worker routes (live):**
- `GET /v1/whoami` — edge-gated by Cloudflare Access; returns `302` redirect when unauthenticated
- `GET /v1/member/provision` — member bundle (id, name, email, avatar, quota, workspace, projectIds)
- `POST /v1/time-entries` — canonical time write (idempotent upsert by `id`)
- `GET /v1/projects` — canonical project list
- `GET /v1/member/kpi` — today's/week's time summary + project breakdown + compliance flag
- `PUT /v1/member/preferences` / `GET /v1/member/preferences` — focus areas, working hours, CEO referral, comms prefs, notes
- `GET /v1/credentials` — encrypted integration credential envelopes (server-held keys)

**D1 tables (confirmed live):**
- `employees` — email-keyed, `monthly_quota_hours`, `is_active`, avatar
- `time_entries` — canonical (no `billable` flag); `source` tags origin (`plexus|clockify|…`)
- `projects` — `name, code, project_type, status`
- `employee_preferences` — JSON blob per member (Phase 9, migration `0008`)
- `employee_external_ids` / `project_external_ids` — legacy external-id mapping for migration/backfill only
- `integration_credentials` — encrypted blob envelope
- `sync_cursors/jobs/runs/journal/entity_mappings/conflicts` — sync control plane
- `ota_channels` / `ota_releases` / `ota_install_events` — OTA backend
- `devices` — per-device channel

---

## Data model (Plexus local)

- `TimeEntry`: `id, employeeId, projectId, description, startTime, endTime, durationSeconds, source` — **no `billable`**
- `Project`: `id, name, code, projectType, status, color` — **no `rate`**
- Reports: hours, hours-vs-quota (`monthly_quota_hours`), project breakdown, compliance flag
- Settings: shows "signed in as `<email>` · `<workspace>` · connected" — **no MultiCA token / R2 key fields** (deleted)

---

## Phases

| # | Phase | Status | Description |
|---|-------|--------|-------------|
| **0** | De-billing + model alignment | ✅ **Complete** | Strip billable/rate/utilization; reframe to hours/quota |
| **1** | Identity & projects (read) | ✅ **Complete** | Email login → Cloudflare Access OTP; pull projects + employee identity; offline cache |
| **2** | Time write-back | ✅ **Complete** | `time_entries` table + `POST /v1/time-entries`; Worker becomes source-of-truth |
| **3** | Clockify cutover | ✅ **Complete** | One-time backfill of historical Clockify entries (1,404 entries / 12,292h backfilled) |
| **4** | Zero-trust hardening | ✅ **Complete** | Cloudflare Access enforced on Worker; two-tier (team app + Operators app); per-employee scoping |
| **5** | OTA updates | ✅ **Complete** | `electron-updater` Settings panel + signed/notarized DMG/ZIP release workflow + R2 feed at `https://plexus-upgrade.thoughtseed.space/plexus`; v0.2.0 up-to-date proof completed |
| **6** | Agent Fabric health panel | ✅ **Complete** | Live port tiles (`:3100`, `:3101`), 6 agent health tiles, bridge status, vault counts, shell `health-check.sh` |
| **7** | Per-member provisioning | ✅ **Complete** | Worker `GET /v1/member/provision`; Plexus `memberSetup()` drives `setup-member.sh`; auto-provision on Access login |
| **8** | Standup + KPI | ✅ **Complete** | Worker `GET /v1/member/kpi`; `standup-kpi-pipeline.sh`; AgentFabricPanel standup tile + nudge banner; weekly founder report |
| **9** | Preferences + usage learning | ✅ **Complete** | `PreferencesPanel`; Worker `PUT/GET /v1/member/preferences`; `member-context-sync.sh`; `usage-evolution.sh`; Paperclip cycle integration |
| **10** | Internal digest + standup memory | 🔀 **Reframed by Phase 14** | Keep daily updates inside Plexus/TeamForge/Paperclip; no new Slack dependency |
| **11** | Internal issue/activity workspace | 🔀 **Reframed by Phase 14** | Meeting calls + issue/activity tracking unified under Paperclip agent tasks; no new Huly dependency |
| **12** | Founder dashboard | 🔮 **Future** | Real-time org-wide KPI rollup in TeamForge console; drill-down to per-member trends |
| **13** | Admin demo + real onboarding state | 🚀 **Deployed, OTP proof pending** | Thoughtseed Labs Gmail is seeded as admin identity in remote D1; Worker is deployed; fresh Plexus OTP must still prove the app captures the Access token and returns the role-aware session |
| **14** | Realtime workspace | 🚀 **0.3.0 released, W3 hardening remaining** | Worker/D1 room broker deployed; Plexus room lobby, audio/video controls, multi-screen-share, meeting/project links shipped in 0.3.0; W3 remaining: Paperclip ingestion (#22), security hardening (#23), regression pack (#24) |
| **15** | Self-hosted transcription agent | 🧊 **Deferred** | Open-source/self-hosted transcription and AI summaries after Phase 14 proves realtime rooms and meeting memory |

---

## Paperclip agent fabric integration

**Cycle (`paperclip-cycle.sh`):**
```
sync-issues → member-context-sync → reconcile-local → usage-evolution → sync-heartbeats
```

**Scripts:**
| Script | Purpose | Trigger |
|--------|---------|---------|
| `standup-kpi-pipeline.sh` | Reads Worker KPI, writes `vault/standups/<member>-<date>.md` | Daily cron |
| `member-report-routine.sh` | Weekly report with KPI + preferences → MultiCA | Weekly cron |
| `member-context-sync.sh` | Syncs Worker prefs → `agents/ceo/CONTEXT.md` | After pref save (Plexus) + `paperclip-cycle.sh` |
| `usage-evolution.sh` | Aggregates 30-day usage signals, writes insights + suggestions to `CONTEXT.md` | `paperclip-cycle.sh` |
| `health-check.sh` | Probes `:3100/:3101`, reports agent freshness + bridge status | `paperclip-cycle.sh` + Plexus panel |

---

## Open design decisions (resolved)

- **Time-entry write**: batched offline queue with idempotent upsert ✅
- **Project visibility**: all employees see all `active` projects (no per-employee assignment table yet) ✅
- **Clockify coexistence**: Plexus-only once Phase 2 landed; history backfilled in Phase 3 ✅
- **KPI scope**: hours + compliance only (confirmed 2026-06-12) ✅
- **CEO preference visibility**: full `preferences_json` verbatim in weekly report (confirmed 2026-06-12) ✅
- **Standup compliance**: nudge + flag use same-day threshold (confirmed 2026-06-12) ✅

---

## Next steps (immediate)

1. **Rename Cloudflare Access app** to "Plexus", point destination at `plexus-api.thoughtseed.space/v1/whoami`
2. **Clean orphan DNS** — `teamforge-api.thoughtseed.space` record
3. **Fresh OTP smoke test** — expect role-aware admin session for `thoughtseedlabs@gmail.com`
4. **Admin demo smoke** — verify all-project overview plus skip/defer/complete onboarding writes against real Worker/D1 routes
5. ~~**Phase 14 Worker deploy gate**~~ — ✅ Done 2026-06-15: Worker version `9db2e34e` deployed with migration `0011`
6. ~~**0.3.0 OTA proof**~~ — ✅ Done 2026-06-15: signed `0.2.0` → `0.3.0` upgrade proven end-to-end
7. **Phase 14 Wave 3** — [#22](https://github.com/Sheshiyer/plexus-ts/issues/22) Paperclip ingestion, [#23](https://github.com/Sheshiyer/plexus-ts/issues/23) privacy/audit hardening, [#24](https://github.com/Sheshiyer/plexus-ts/issues/24) regression pack

## Phase 14 contract note

The external meeting/project SaaS replacement is now tracked as the Plexus realtime workspace. The product contract lives at [`REALTIME_WORKSPACE_CONTRACT.md`](REALTIME_WORKSPACE_CONTRACT.md), the Cloudflare SFU/env decision lives at [`REALTIME_CLOUDFLARE_DECISION.md`](REALTIME_CLOUDFLARE_DECISION.md), and the Worker/D1 API contract lives at [`REALTIME_WORKER_API_CONTRACT.md`](REALTIME_WORKER_API_CONTRACT.md). Wave 2 adds the Worker room/session/track/meeting broker and a Plexus Realtime tab with room lobby, join, mic/camera controls, multi-screen-share local publishers, participant grid, and manual closeout links. Transcription remains deferred to Phase 15 and must not block this pass.

On 2026-06-15, remote D1 migration `0011_realtime_workspace.sql` was applied and Worker version `9db2e34e-afbd-48e9-b506-a8bfe51078c3` was deployed to `teamforge-api.sheshnarayan-iyer.workers.dev`, `forge.thoughtseed.space`, and `plexus-api.thoughtseed.space`. Post-deploy smoke passed: `healthz` returned `200`, workers.dev `/v1/realtime/rooms` fail-closed with `401 access_identity_required`, and remote D1 reported no pending migrations.

## Phase 5 release proof note

On 2026-06-15, Release workflow run `27514257223` built signed/notarized macOS artifacts from commit `ab3ac46`, uploaded DMG/ZIP/blockmap/`latest-mac.yml` files to R2 bucket `plexus-updates`, and served the production feed from `https://plexus-upgrade.thoughtseed.space/plexus/latest-mac.yml`. The final signed package was verified with `codesign --verify --deep --strict`, accepted by `spctl --assess --type execute`, and the packaged Settings OTA check returned `Plexus is up to date` for version `0.2.0`.

On 2026-06-15, tag `v0.3.0` triggered Release workflow run `27570823997`, which passed signing/notarization, uploaded `0.3.0` OTA artifacts to R2, and attached assets to the GitHub release. The public feed advertised version `0.3.0`. A signed/notarized `0.2.0` app from workflow run `27514257223` then proved a real OTA path: check reported `0.3.0` available, download reached `downloaded` at 100%, install/restart updated the test bundle to `CFBundleShortVersionString=0.3.0`, and post-update `codesign`/`spctl` verification passed.

## Phase 13 live deploy note

On 2026-06-14, remote D1 migration `0009_plexus_session_onboarding.sql` was applied and Worker version `3d786b06-5389-49be-a43f-a142a9684ca7` was deployed to `plexus-api.thoughtseed.space`.
Remote D1 now contains `pid_admin_thoughtseed_labs` for `thoughtseedlabs@gmail.com`, role `admin`, project visibility `all`, linked to employee `emp_630f768292cc4b674e5ae3e3`, with onboarding rows for required identity/project setup and optional preferences, Paperclip/Vapor Clip, and daily agent setup.
Unauthenticated `/v1/whoami` still redirects to Cloudflare Access, so the remaining proof must be a fresh OTP from Plexus.

## Release notes

See [CHANGELOG.md](../CHANGELOG.md) and [RELEASE_0.2.0.md](RELEASE_0.2.0.md).

---

MIT © Thoughtseed
