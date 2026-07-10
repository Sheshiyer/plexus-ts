# Plexus — Historical Session Handoff (authority refreshed 2026-07-10)

> Written 2026-06-12 for a fresh session. Read this top-to-bottom before touching code.
> Companion docs: [`ROADMAP.md`](ROADMAP.md), [`REVIEW.md`](../REVIEW.md).
> Memory: `~/.claude/.../memory/plexus-teamforge-platform.md` has the condensed state.

> **2026-07-10 authority update:** Plexus is local per member. The Workspace
> Worker/Plexus API is the member data plane; the member-scoped Thoughtseed
> bridge is the primary reporting port to Hermes. Hermes owns reporting
> orchestration and Telegram topic mapping. The founder reads and acts through
> the Cambium TG Mini App and configured Telegram topics. MultiCA and TeamForge
> are deprecated as active product/reporting authorities. Fabric/Paperclip is
> optional enrichment and provenance only. See
> [`architecture/HERMES_REPORTING_CONTRACT.md`](architecture/HERMES_REPORTING_CONTRACT.md).

> **Historical handoff mechanics:** The dated sections below preserve the
> 2026-06-12 rollout, branch, worker, and optional-helper notes for provenance.
> They are not current ownership instructions. Current reporting authority and
> delivery behavior are defined by the contract above; do not revive old
> TeamForge/MultiCA/Paperclip report paths from the historical tables.

---

## 0. One-paragraph orientation

Plexus is a **local-per-member employee client**. We rebuilt it from a standalone
billable time-tracker into an internal, email-identified employee app with no
plaintext renderer or infrastructure-wide secrets. The Workspace Worker/Plexus API and D1/R2 remain the member
data plane for identity, projects, time, KPI reads, preferences, and realtime
workspace state. Plexus owns the native assistant runtime in Electron main, including
bounded read-only local context, AI session grouping, model routing, explicit
action confirmation, and local daily-event queueing. Fabric/Paperclip can enrich
that experience when installed, but it must not block assistant use, timer work,
Reports, Settings, onboarding completion, or daily event capture.

Reporting is a separate plane. Plexus sends stable, signed member events through
the member-scoped Thoughtseed bridge to Hermes. Hermes owns aggregation, report
routines, and the configured Cambium/Telegram destinations. Plexus sends routing
intent such as `audience: founder_review`; it does not store topic IDs.

The daily event architecture to preserve is:

```text
Plexus native assistant -> member-scoped Thoughtseed bridge -> Hermes
Hermes -> Cambium TG Mini App + configured Telegram topics
```

The Workspace Worker report route is a daily-event fallback only after a bridge
failure. A fallback success remains queued for bridge retry and must be visible
as degraded transport, not Hermes receipt. Do not claim live
Hermes/Cambium/Telegram proof from this handoff unless a current smoke explicitly
verifies it.

## 0.1 Native assistant rollout state

- Tasks 1-39 have landed and passed assistant tests, typecheck, and
  `build:main` per the current rollout handoff.
- A separate code worker owns Tasks 40-48 in source files. Documentation workers
  must not touch source code, scripts, tests, package manifests, or plan files.
- Tasks 77, 78, and 82 are source-independent documentation/checklist work:
  resilience review, architecture docs, and renderer smoke checklist.
- The authoritative implementation plan is
  `docs/plans/2026-07-01-native-assistant-runtime.md`.
- Preserve member-scoped Thoughtseed Bridge token custody. Plexus must never
  store or expose the Worker admin `BRIDGE_TOKEN`, Telegram identifiers, or bot
  credentials.

---

## PART A — What is DONE (don't redo this)

### The product arc (this + prior sessions)
1. **Reviewed** the Electron app; ran it locally.
2. **FORMA / cambium redesign** — design tokens, primitives, all screens, GLSL
   splash shader fix (commit `f29915b`).
3. **Brand assets** — GPT-Image-2 icon set, brand board, Swiss poster, DMG
   background, component-library sheet, screen-by-screen flow refs (`95dedd9`).
4. **Employee-platform pivot**, phased:
   - **Phase 0** — de-billing; internal employee model (`8790b59`).
   - **Phase 1** — email login + TeamForge project sync (`d442143`).
   - **Phase 2** — time write-back to the Worker (`d99b6b9`).
   - **Phase 3** — full Clockify backfill into D1.
   - **Phase 4** — Cloudflare Access (zero-trust, two-tier).
   - **Phase 6** — Agent Fabric Health panel: live port/agent/bridge/vault tiles
     (`src/main/fabric.ts`, `src/renderer/components/AgentFabricPanel.tsx`).
   - **Phase 7** — Per-member provisioning (`GET /v1/member/provision`), Plexus
     `memberSetup()` driving `setup-member.sh`, auto-provision on Access login,
     legacy `multicaToken`/`paperclipPath` settings removed.
   - **Phase 8** — KPI summary from canonical D1 (`GET /v1/member/kpi`).
   - **Phase 9** — `PreferencesPanel`, Worker `PUT/GET /v1/member/preferences`,
     D1 migration `0008_employee_preferences.sql` applied live.

### Production state (verified live)
- **Worker** `teamforge-api` deployed at version `8dd00e1b`
  (D1 `teamforge-primary`, R2, Queues, Durable Objects).
- **D1 migration `0008`** applied: `employee_preferences` table live.
- **Cloudflare Access LIVE**, two-tier:
  - `TF_ACCESS_TEAM_DOMAIN = red-queen-4dfa.cloudflareaccess.com` (plain var)
  - `TF_ACCESS_AUD` (team app) + `TF_ACCESS_AUD_FOUNDER` (Operators app) — secrets
  - `/v1/whoami` is edge-gated (OTP login target); data routes are Worker-validated
    and also accept the **app-bearer** as fallback. Team JWT → employee routes only;
    founder JWT/bearer → everything.
- **Data seeded:** 7 Thoughtseed employees in D1 `employees`; workspace
  `ws_thoughtseed` linked to Clockify; **1,404 time entries / 12,292h** backfilled
  (Nov 2024 – Jun 2026).
- **Email-only login works through OTP/JWT issuance**: Plexus "Sign in with
  Cloudflare Access" → BrowserWindow OTP → `CF_Authorization` cookie issued.
  The remaining smoke failure is routing, not auth.

### Pending from the prior session (carry these forward)
- [x] **WS5 smoke blocker — Worker route missing for `plexus-api`:** ✅ **FIXED 2026-06-12**
      `wrangler.jsonc` now routes both `forge.thoughtseed.space` and `plexus-api.thoughtseed.space`
      to the Worker (commit `14ea4a4`, deployed v3e234c96). `GET https://plexus-api.thoughtseed.space/v1/whoami`
      now returns `302` (Access redirect) not `404`, proving the route is live. Full smoke requires
      a fresh OTP login and a valid `CF_Authorization` cookie → expected `200`.
- [x] **Merge `feat/ws5-access-jwt` → `main`** — done. Worker `main` now includes WS5 auth,
      Phase 7–9 routes, migration `0008`, and the `plexus-api` custom domain.
- [ ] **User action:** Rename the Cloudflare Access app to "Plexus", point its destination at
      `plexus-api.thoughtseed.space/v1/whoami`, and clean up the orphaned `teamforge-api.thoughtseed.space` DNS record.
- [x] **Phase 5 — OTA updates**: app wiring, Release workflow, Apple signing/notarization, R2 upload, production feed domain, packaged Settings check, and true OTA upgrade proof are complete. `v0.3.0` Release workflow run `27570823997` passed, and signed `0.2.0` upgraded to signed/notarized `0.3.0` through Settings.
- [x] **Current release-proof gate:** `docs/RELEASE_EVIDENCE.md` is the binary production-ready checklist. `npm run verify:all` now covers lint, typecheck, no-placeholder scan, production dependency audit, Electron fuses, renderer CSP, release evidence policy, release-candidate closeout verification, all Vitest suites, deterministic smokes, and renderer build. Signed OTA proof remains a separate live Release workflow requirement; live Paperclip admin proof remains `npm run smoke:admin-fabric-paperclip`; dev/build-chain audit findings are recorded in `docs/SECURITY_AUDIT_WAIVERS.md`.
- [x] **P9 release-candidate closeout:** `docs/evidence/2026-07-10-release-candidate-closeout/README.md` indexes the golden-path UAT and closeout sync boundaries. `docs/DEFERRED_REGISTER.md` names the signed OTA, live Paperclip, SFU, Cloudflare Access, #22, #23, #24, #25, and #26 proof boundaries. `docs/RELEASE_CANDIDATE_RECOMMENDATION.md` is the current go-with-degraded-live-proof recommendation.
- [ ] **Admin demo / real onboarding state:** built locally 2026-06-13 across Plexus + TeamForge Worker. Requires remote D1 migration `0009_plexus_session_onboarding.sql`, Worker deploy, and fresh OTP proof before marking live. Expected `/v1/whoami` shape is now role-aware session data, not just `{ email, access: true }`.
- [x] **Phase 8–9 completion note from 2026-06-12 (report destination now superseded):**
      - ✅ `standup-kpi-pipeline.sh` → reads Worker `GET /v1/member/kpi`, generates `vault/standups/<member>-<date>.md`
      - Historical routine read D1 KPIs + preferences. Current reports go through the member bridge to Hermes; MultiCA is retired.
      - ✅ AgentFabricPanel shows "Today's standup" tile + nudge banner when `standupCompliant=false`
      - ✅ `fabric.ts` reads standup from vault + fetches KPI from Worker
      - ✅ Types updated: `StandupData`, `MemberKpiSummary`, `UsageSignal` added; legacy bridge types removed
      - ✅ `member-context-sync.sh` → syncs Worker prefs to `agents/ceo/CONTEXT.md` (integrated into `paperclip-cycle.sh`)
      - ✅ `usage-evolution.sh` → aggregates 30-day usage signals, writes insights + agent suggestions to `CONTEXT.md`
      - ✅ `teamforge.ts` triggers `member-context-sync.sh` after pref save (non-blocking)
      - ✅ `main.ts` emits usage signal on timer stop (active project, daily seconds, compliance, session duration)
      - ✅ Paperclip cycle now runs: sync-issues → member-context-sync → reconcile-local → usage-evolution → sync-heartbeats
      - ✅ All builds pass (`npx tsc --noEmit` green in Plexus)

### Repos / branches
| Repo | Path | Branch |
|---|---|---|
| Plexus (Electron client) | `01-Projects/thoughtseed/plexus-ts` | `feat/forma-redesign` |
| TeamForge (Worker) | `01-Projects/thoughtseed/team-forge-ts` | `feat/ws5-access-jwt` |
| Paperclip (agent fabric) | `01-Projects/thoughtseed/thoughtseed-paperclip` | — |

---

## PART B — Historical Paperclip agent fabric reference

> This section records the 2026-06-12 helper baseline. Its MultiCA/TeamForge
> names are historical evidence, not current endpoints or authorities. Do not
> rebuild these paths; use the Hermes reporting contract above.

`thoughtseed-paperclip/` is a **Krebs-cycle agent org** + integration plane. Most
of what the user asked for is *already implemented here as CLI/cron* — the missing
piece is **driving and surfacing it from Plexus, per employee, under email-only**.

### Agents (6) — `agents/<name>/`
`ceo`, `scientist`, `engineer`, `designer`, `synthesist`, `hermes` (communications).
Each agent is **8 runtime files** (this *is* the "identity / soul / heartbeat /
tools" the user means):
`MANIFEST.yaml · IDENTITY.md · SOUL.md · CONTEXT.md · TASKS.md · INBOX.md · HEARTBEAT.md · AGENTS.md`.
`agents/ceo/HEARTBEAT.md` literally reads *"Reskinned for team member instance.
Initialized 2026-06-11"* — i.e. **per-member reskin is the intended mechanism.**

### Already-scheduled routines — `manifest.yaml`
- **`standup:`** — daily, **18:00 Asia/Kolkata** (`cron 30 12 * * 1-5`), aggregator
  `ceo`, dispatcher `hermes`, output `vault/standups/`, 30-min deadline,
  3-consecutive-miss alert. → *the daily-standup agent the user wants.*
- **`member_reporting:`** — **weekly** (`cron 30 3 * * 1`), content `synthesist`,
  approval `ceo`, delivery `hermes`, "**Agent outputs synthesized and pushed to
  MultiCA for cofounder visibility**", rendered to
  `vault/communications/rendered/member-reports/`. → *the weekly founder-KPI updater.*
- **`multica_bridge:`** — bidirectional. Upstream lanes `meso/macro/noesis/heartbeat`;
  downstream commands `task/ask/status/config`; queues `.thoughtseed/bridge-outbox`
  + `bridge-inbox`. → *the founder MultiCA channel.*
- **`vault:`** — shared file vault: `vault/standups/`, `vault/handoffs/`,
  `vault/projects/`, per-department dirs. → *the "R2 vault / agent data" surface.*
- **`loop:`** — cron short-cycles (CEO 5m, leads 10m); `evolution:` weekly
  self-evolution (`cron 0 0 * * 0`). → *hooks for the usage-learning loop.*
- **`web_ui:`** — local UI (`PAPERCLIP_UI_PORT`); endpoints `/api/status`,
  `/api/agents`, `/api/command`, `/api/onboarding`, `/api/bridge/status`.

### Scripts — `scripts/`
| Script | Purpose | Maps to user ask |
|---|---|---|
| `bootstrap.sh` *(repo root, not `scripts/`)* | Idempotent install/validate (manifest, 8 files/agent, departments, configs; probes Paperclip API) | install + checker (CLI) |
| `health-check.sh` / `bridge-health.sh` | Runtime + bridge health | the "checker" |
| `setup-member.sh` | Provision/reskin a **member** instance | per-member identity/soul/heartbeat port |
| `onboarding-flow.sh` | Member onboarding | onboarding |
| `standup.sh` + `standup-kpi-pipeline.sh` | Build the daily standup + KPI pipeline | daily standup agent |
| `member-report-routine.sh` | Weekly member insight → MultiCA | weekly founder-KPI updater |
| `paperclip-sync.sh` / `teamforge-feed-sync.sh` | Sync with Paperclip API / TeamForge feed | data port |
| `com.thoughtseed.hermes-standup-digest.plist` | launchd job for the standup digest | scheduling |

### The TeamForge ↔ Paperclip runtime adapter
`team-forge-ts/scripts/paperclip-runtime-adapter.mjs` runs an HTTP server on
**:3101** that exposes `agents/`, `vault/`, `MEMORY/`, runs `health-check.sh`,
`loop-runner.sh`, `babysitter.sh`, and tracks approval/escalation state. This is
the natural thing Plexus's health panel should call.

### Ports & env (Paperclip)
- **Paperclip UI** `127.0.0.1:3100` (python `http.server`); **runtime adapter**
  `127.0.0.1:3101`; (a `3133` also appears — confirm during build).
- `.env` keys (names only): `PAPERCLIP_API[_URL|_KEY|_TOKEN]`, `PAPERCLIP_COMPANY_ID`,
  `PAPERCLIP_TENANT_ID`, `PAPERCLIP_MEMBER_ID`, `PAPERCLIP_MEMBER_NAME`,
  `MULTICA_BRIDGE_ENABLED/MODE`, `MULTICA_API_URL/APP_URL/WORKSPACE_ID/API_KEY`,
  `OLLAMA_HOST`, `LOOP_*`, `VAULT_ROOT`, `TF_API_BASE_URL`,
  `TEAMFORGE_AGENT_FEED_URL/SCAFFOLD_URL/CLOSEOUT_URL_TMPL`, `TF_WEBHOOK_HMAC_SECRET`.

---

## PART C — Historical legacy bridge inventory

This table is a dated record of bridge code that predated the current model. The
MultiCA path is retired and must not be restored. Current implementation follows
the member-scoped Thoughtseed bridge/Hermes contract.

| File | What it does today | Problem |
|---|---|---|
| `src/bridge/paperclip.ts` | `syncToPaperclip()` writes a markdown time-report into a **local** `{paperclipPath}/vault/communications/time-reports/…md` | Assumes the employee has the Paperclip repo checked out + a `paperclipPath` device setting |
| `src/bridge/multica.ts` | `pushToMultiCA()` POSTs a monthly report to `{apiUrl}/bridge/upstream` with a **device bearer token** | Re-introduces device secrets (`multicaToken`, `multicaApiUrl`) — violates the email-only goal |
| `src/main/auto-sync.ts` | On timer stop, if `syncEnabled`, writes Paperclip + pushes MultiCA from settings (`memberId`, `paperclipPath`, `multicaApiUrl`, `multicaToken`) | Same device-secret problem; monthly granularity; not the standup/weekly cadence |
| `src/renderer/components/BridgePanel.tsx` | 3 manual **Run** buttons (Sync Paperclip / Push MultiCA / Archive R2) + a static data-flow badge row | No health check, **no port/agent scan**, no install, nothing visual/live |
| `Onboarding.tsx`, `Settings.tsx`, `types.ts`, `preload.ts` | `PaperclipSyncPayload`, `MultiCAMessage`, `window.plexus.{syncToPaperclip,pushToMultiCA,archiveToR2}` | Wiring exists; repoint at the reconciled model |

---

## PART D — The GAP (user's asks → status → what to build)

| # | User asked for | Already exists | Missing / remaining |
|---|---|---|---|
| 1 | Install scripts + **visual** checker in app; **scan ports, agents, data** | `bootstrap.sh`, `health-check.sh`, adapter `/api/status` + `/api/agents` | ✅ Phase 6 shipped: `AgentFabricPanel` live tiles for ports (`:3100`/`:3101`), agents (6 tiles + heartbeat freshness), bridge status, vault counts. "Install / Repair" button wired to `setup-member.sh`. |
| 2 | Daily **standup** loop | Persisted Plexus standup evidence plus Workspace Worker KPI data and the existing suggestion pipeline | Compliance requires a persisted evidence row for the same UTC date. Missing compliance proactively feeds the member nudge and the monthly Hermes founder review. |
| 3 | Founder reporting from member evidence | Workspace Worker KPI reads plus the native assistant report queue | Current destination is Hermes through the member-scoped bridge. Core KPI is today/week hours plus persisted same-UTC-date standup compliance; project mix is enrichment. Founder reads Cambium TG Mini App and configured Telegram topics. |
| 4 | Local-per-member assistant identity, context, tools, and data | Plexus native assistant plus historical `setup-member.sh` optional-helper pattern | Workspace Worker provision data initializes each member. Fabric/Paperclip setup is optional; legacy `multicaToken`/`paperclipPath` settings stay deleted. |
| 5 | **Preferences UI** the employee sets about themselves, **founder review references** | — (net-new) | ✅ Phase 9 shipped: `PreferencesPanel` → Worker `PUT /v1/member/preferences` → D1 `employee_preferences`. Current review packets carry no preference fields; future preference-derived fields must respect `weeklyVisibility`, and the complete preferences object is never sent by default. |
| 6 | Learns the employee's **ongoing usage** | Native usage signals plus optional historical `evolution:` helper hook | Feed bounded active-project, hours, and cadence signals into member context without creating a richer founder-visible employee score. |
| 7 | (implicit) Keep it **email-only** | Access live; Workspace Worker data plane | ✅ Provision follows Access login. Reporting uses a secure member-scoped bridge token in Electron main; neither MultiCA configuration nor Telegram routing belongs on the device. |

---

## PART E — Locked decisions

1. **Runtime:** local per member. Fabric/Paperclip may enrich the native assistant
   but is optional.
2. **Member data:** Workspace Worker/Plexus API after Access login. Existing
   `src/main/teamforge.ts` is a compatibility filename, not active product authority.
3. **Reporting:** member-scoped Thoughtseed bridge to Hermes is primary. Daily
   assistant events may use Workspace Worker delivery only after bridge failure;
   monthly reviews retain a retryable bridge handoff instead.
4. **Founder surface:** Cambium TG Mini App and Hermes/Cambium-configured Telegram
   topics. Plexus carries audience intent, never topic IDs.
5. **KPI:** today/week hours plus persisted same-UTC-date standup compliance.
   Project mix is explanatory enrichment, not a separate score.
6. **Monthly compliance:** compliant distinct UTC work dates divided by distinct
   UTC dates with recorded work. Missing standups feed proactive member nudges;
   each generated monthly founder review carries the same summary. Month-close
   scheduling remains Hermes-owned infrastructure.
7. **Preferences:** the current review payload carries no preference fields;
   any future preference-derived fields must obey `weeklyVisibility`.
8. **Retirement:** MultiCA and TeamForge report contracts are deprecated. Legacy
   payload extras are ignored; old device settings and report destinations are not
   revived.

---

## PART F — Proposed phased plan (continues ROADMAP 0–5)

> Sequenced so each phase ships something visible and testable. Re-confirm scope
> with the user after Part E.

### Phase 6 — Agent Fabric Health (visual, read-only first) ✅ DONE
- New `AgentFabricPanel` (replaces/extends `BridgePanel`): live tiles for
  **ports** (`:3100` UI, `:3101` adapter — up/down), **agents** (6 tiles with
  `HEARTBEAT.md` freshness vs the 5m/10m loop SLA), **bridge** (`/api/bridge/status`),
  **vault** (standup/handoff counts).
- Main-process `fabric.ts`: probe `127.0.0.1:3100/api/status` + `/api/agents`,
  read agent `HEARTBEAT.md` mtimes, shell `health-check.sh`, return a status struct.
- **Remaining:** wire "Install / Repair" button → runs `bootstrap.sh` (+ `setup-member.sh`
  once member is provisioned), stream output into panel.

### Phase 7 — Per-member provisioning (email-only) ✅ DONE
- Worker: `GET /v1/member/provision` (team-auth) → member bundle.
- Plexus onboarding: after Access login, fetch bundle → run `setup-member.sh` →
  reskinned agents appear in the Fabric panel as "**your agents**".
- **Delete** `multicaToken` / `paperclipPath` / `multicaApiUrl` device settings;
  read everything from the bundle.
- **Historical note:** the WS5 Worker route blocker was fixed in the dated proof
  above; any fresh Access login gap must be re-probed rather than treated as an
  unresolved route defect.

### Phase 8 — Standup + KPI loops on canonical data
- Workspace Worker: `GET /v1/member/kpi` returns today/week seconds + project breakdown from canonical D1 `time_entries`.
- Compliance requires persisted standup evidence for the same UTC date. The
  existing suggestion pipeline proactively nudges missing standups.
- Hermes monthly reviews receive compliance across distinct recorded-work UTC
  dates. Project mix is report enrichment only.
- **Live-proof boundary:** the local contract and bridge handoff are implemented;
  fresh Access, Hermes receipt, and founder-visible Cambium/Telegram proof remain
  external verification steps.

### Phase 9 — Preferences + usage learning
- `PreferencesPanel` ships in Plexus (focus areas, working hours, CEO referral, comms prefs, notes) → Worker `PUT /v1/member/preferences` → D1 `employee_preferences`.
- Current review packets carry no preference fields; future preference-derived
  fields must respect `weeklyVisibility`. The complete preference object is not
  a default report payload.
- Usage-learning signals remain member context, not an expanded employee score.

### Phase 14 — Realtime workspace (external SaaS replacement) 🚀 WORKER DEPLOYED + APP RC
- Product contract: [`REALTIME_WORKSPACE_CONTRACT.md`](REALTIME_WORKSPACE_CONTRACT.md).
- Cloudflare decision: [`REALTIME_CLOUDFLARE_DECISION.md`](REALTIME_CLOUDFLARE_DECISION.md).
- Worker/API contract: [`REALTIME_WORKER_API_CONTRACT.md`](REALTIME_WORKER_API_CONTRACT.md).
- Worker implementation: `team-forge-ts/cloudflare/worker/migrations/0011_realtime_workspace.sql`, `src/routes/realtime.ts`, and `/v1/realtime/*` registration in `src/routes/v1.ts`.
- Electron implementation: Realtime tab backed by `RealtimeCapturePanel`, `mediaCaptureStatus`, `mediaRequestAccess`, and Worker-backed `realtime*` IPC methods.
- GitHub milestone: `Plexus Realtime Workspace`.
- Issue range: RW-001 through RW-013, GitHub issues #13-#25.
- Scope: Cloudflare-backed project rooms, presence, audio/video calls, multi-person screen sharing, meeting records, project/time-entry links, and non-transcript Paperclip meeting memory.
- Contract boundary: Cloudflare Realtime owns WebRTC sessions/tracks/media transport; Workspace Worker/D1 owns rooms, participants, authorization, project linkage, meeting records, audit events, and optional helper artifact provenance.
- Explicit deferral: self-hosted transcription, recording ingestion, and AI-generated meeting summaries are Phase 15, not part of this pass. Meeting closeout stores manual notes/decisions/actions only and keeps transcript/recording refs null.
- Verification passed: Plexus `npm run typecheck`, `npm run build:main`, `npm run build:preload`, `npx vite build`; Worker `pnpm exec tsc -p tsconfig.json --noEmit`, `pnpm test`.
- Deploy proof: D1 migration `0011_realtime_workspace.sql` applied remotely on 2026-06-15; Worker version `9db2e34e-afbd-48e9-b506-a8bfe51078c3` deployed; `healthz` returned `200`; unauthenticated workers.dev `/v1/realtime/rooms` returned `401 access_identity_required`; remote D1 has no pending migrations.
- Next gate: review RW-005 through RW-009 locally, then implement RW-010 Paperclip ingestion and RW-011/RW-012 hardening/regression.

> The RW-010 Paperclip ingestion note is optional helper provenance and is not a
> prerequisite for Plexus reporting or Hermes founder delivery.

---

## PART G — Reference (paths · ports · endpoints)

**Plexus run:** `cd plexus-ts && npm run dev` (main = tsc, preload = CJS,
renderer = Vite). DB at `~/Library/Application Support/com.thoughtseed.teamforge/teamforge.db`
(shared name with TeamForge desktop — note the app id).

**Workspace Worker:** the deployed resource retains historical TeamForge naming.
Deploy it with
`pnpm dlx wrangler deploy` from `team-forge-ts/cloudflare/worker` or the repo's equivalent Worker deploy command.
Base URL intended for employees: `https://plexus-api.thoughtseed.space`. Routes
in `src/routes/v1.ts`. Access verify in `src/lib/access.ts`. Infra gotcha from
WS5 smoke is now resolved: `plexus-api.thoughtseed.space` is present in
`cloudflare/worker/wrangler.jsonc` `routes` and Worker version
`3d786b06-5389-49be-a43f-a142a9684ca7` was deployed on 2026-06-14.

**Key Worker routes today:** `GET /v1/whoami` (Access gate), `GET /v1/projects`,
`GET /v1/team/snapshot`, `POST/GET /v1/time-entries`,
`POST /v1/time-entries/backfill-clockify`, `GET /v1/bootstrap`,
`GET /v1/agent-feed/export` (HMAC), `POST /v1/projects/scaffold` (HMAC).

**Native assistant path:** assistant context and model work belongs in Electron
main/preload/typed IPC. The renderer gets typed snapshots, suggestions, streams,
and action confirmation state. Daily events should queue locally first, then send
through the member-scoped Thoughtseed bridge to Hermes. Use Workspace Worker
report delivery only after bridge failure; later R2/vault state is data-plane
confirmation, not proof of Telegram delivery.

**Optional Paperclip ports/endpoints:** UI `127.0.0.1:3100` (`/api/status`, `/api/agents`,
`/api/command`, `/api/bridge/status`); runtime adapter `127.0.0.1:3101`.

**Secrets** live in `~/.claude/.env` (e.g. `AUD_TOKEN` = team AUD) and as
**write-only Worker secrets** (`TF_ACCESS_AUD`, `TF_ACCESS_AUD_FOUNDER`,
`TF_CREDENTIAL_ENVELOPE_KEY`, `TF_WEBHOOK_HMAC_SECRET`). The app-bearer is
recoverable from the TeamForge desktop DB (`settings.cloud_credentials_access_token`).
**Never** hardcode a CF API token in a command (the security hook blocks it) and
**never** read `.env` via Bash (blocked) — use the Read tool.

---

## PART H — New-session quick-start

1. For native assistant rollout work, read this file, then
   `docs/plans/2026-07-01-native-assistant-runtime.md`. Read
   `thoughtseed-paperclip/manifest.yaml` only when the task explicitly touches
   optional helper behavior.
2. Before agent-fabric work, run the remaining fresh OTP smoke:
   sign into Plexus with `thoughtseedlabs@gmail.com`, then confirm
   `GET https://plexus-api.thoughtseed.space/v1/whoami` returns
   `pid_admin_thoughtseed_labs`, role `admin`, project visibility `all`, and
   onboarding state. Plexus now rejects Cloudflare Access `meta`/`org` cookies
   and requires the Plexus app AUD before closing the login window. The previous
   successful `CF_Authorization` cookie is short-lived.
3. Read the current Hermes reporting contract before changing reporting,
   standup, preferences, bridge delivery, or founder-review behavior.
4. Treat legacy bridge/Paperclip sections as dated provenance. Do not use them to
   revive MultiCA/TeamForge authority.
5. Keep local proof, bridge receipt, Hermes handling, and founder-visible
   Cambium/Telegram proof as distinct verification levels.
