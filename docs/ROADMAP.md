# Plexus — Roadmap: Thoughtseed Employee Platform

**Status:** Phase 8–9 complete · 2026-06-12 · version 0.2.0

---

## Vision

Plexus is the **employee-facing client** of the **TeamForge control plane** (`plexus-api.thoughtseed.space` + D1 + R2). TeamForge stays the founder's aggregate console; Plexus is what each employee runs. Over time Plexus **absorbs third-party integrations one at a time** — Clockify (done) → Slack (daily digest) → Huly (meetings + issues) — unifying them under Paperclip / agent tasks so Thoughtseed stops depending solely on third-party SaaS.

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
- `employee_external_ids` / `project_external_ids` — Clockify/Huly/Slack mapping
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
| **5** | OTA updates | ⏸️ **Blocked** | `electron-updater` + R2 artifacts; **blocked on Apple Developer ID + notarization** |
| **6** | Agent Fabric health panel | ✅ **Complete** | Live port tiles (`:3100`, `:3101`), 6 agent health tiles, bridge status, vault counts, shell `health-check.sh` |
| **7** | Per-member provisioning | ✅ **Complete** | Worker `GET /v1/member/provision`; Plexus `memberSetup()` drives `setup-member.sh`; auto-provision on Access login |
| **8** | Standup + KPI | ✅ **Complete** | Worker `GET /v1/member/kpi`; `standup-kpi-pipeline.sh`; AgentFabricPanel standup tile + nudge banner; weekly founder report |
| **9** | Preferences + usage learning | ✅ **Complete** | `PreferencesPanel`; Worker `PUT/GET /v1/member/preferences`; `member-context-sync.sh`; `usage-evolution.sh`; Paperclip cycle integration |
| **10** | Slack daily digest | 🔮 **Future** | Aggregate daily standups + KPIs into Slack message per channel; replace manual standup posts |
| **11** | Huly integration | 🔮 **Future** | Meeting calls + issue tracking unified under Paperclip agent tasks; dual-write during cutover |
| **12** | Founder dashboard | 🔮 **Future** | Real-time org-wide KPI rollup in TeamForge console; drill-down to per-member trends |

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
3. **Fresh OTP smoke test** — expect `200 {email, access: true}` after cookie capture
4. **Phase 5 unblocking** — Apple Developer ID + notarization setup

## Release notes

See [CHANGELOG.md](../CHANGELOG.md) and [RELEASE_0.2.0.md](RELEASE_0.2.0.md).

---

MIT © Thoughtseed
