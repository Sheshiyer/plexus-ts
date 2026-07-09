# Plexus — Session Handoff (Agent Fabric)

> Written 2026-06-12 for a fresh session. Read this top-to-bottom before touching code.
> Companion docs: [`ROADMAP.md`](ROADMAP.md), [`REVIEW.md`](REVIEW.md).
> Memory: `~/.claude/.../memory/plexus-teamforge-platform.md` has the condensed state.

> 2026-07-02 update: the active rollout is now **native assistant first**. Fabric/Paperclip remains an optional helper/enrichment layer, not the runtime center. Treat older "Agent Fabric" sections below as historical architecture context unless a current task explicitly targets optional helper health.

---

## 0. One-paragraph orientation

Plexus is the **employee-facing client** of the Thoughtseed **TeamForge/Worker**
control plane. We rebuilt it from a standalone billable time-tracker into an
internal, email-identified employee app with **no device secrets** — time flows
up to a Cloudflare Worker + D1. Phases 0–4 (de-bill → email auth → time
write-back → Clockify backfill → Cloudflare Access) are **built, deployed, and
live in production**. The current assistant rollout changes the center of
gravity: Plexus owns the native assistant runtime in Electron main, including
bounded read-only local context, AI session grouping, model routing, explicit
action confirmation, and local daily-event queueing. Fabric/Paperclip can enrich
that experience when installed, but it must not block assistant use, timer work,
Reports, Settings, onboarding completion, or daily event capture.

The daily event architecture to preserve is:

```text
Plexus native assistant -> Worker/Hermes -> R2/vault
```

If the Worker/Hermes path is offline or unconfigured, Plexus keeps a local queue
and exposes pending/failed/retry state. Do not claim live Worker/Hermes/R2 proof
from this handoff unless a current smoke explicitly verifies it.

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
  store or expose the Worker admin `BRIDGE_TOKEN`.

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
- [x] **Current release-proof gate:** `docs/RELEASE_EVIDENCE.md` is the binary production-ready checklist. `npm run verify:all` now covers lint, typecheck, no-placeholder scan, production dependency audit, Electron fuses, renderer CSP, release evidence policy, all Vitest suites, deterministic smokes, and renderer build. Signed OTA proof remains a separate live Release workflow requirement; live Paperclip admin proof remains `npm run smoke:admin-fabric-paperclip`; dev/build-chain audit findings are recorded in `docs/SECURITY_AUDIT_WAIVERS.md`.
- [ ] **Admin demo / real onboarding state:** built locally 2026-06-13 across Plexus + TeamForge Worker. Requires remote D1 migration `0009_plexus_session_onboarding.sql`, Worker deploy, and fresh OTP proof before marking live. Expected `/v1/whoami` shape is now role-aware session data, not just `{ email, access: true }`.
- [x] **Phase 8–9 COMPLETED 2026-06-12:**
      - ✅ `standup-kpi-pipeline.sh` → reads Worker `GET /v1/member/kpi`, generates `vault/standups/<member>-<date>.md`
      - ✅ `member-report-routine.sh` → reads D1 KPIs + preferences, pushes to MultiCA, legacy `multica.ts` retired
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

## PART B — The Paperclip agent fabric (AS-IS — it already exists)

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

## PART C — The existing Plexus bridge (AS-IS — LEGACY, must reconcile)

Plexus already ships bridge code, but it **predates the email-only / Worker-centric
model and conflicts with it.** Treat it as a first draft to refactor, not a base
to extend.

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
| 2 | Daily **standup** agent | `standup.sh`, `standup-kpi-pipeline.sh`, manifest `standup:` (18:00 IST), launchd plist | ✅ Worker `GET /v1/member/kpi` returns canonical D1 time data. **Remaining:** surface "Today's standup" in Plexus from `vault/standups/`; verify launchd job actually runs; point `standup-kpi-pipeline.sh` at D1 entries instead of any external chat export. |
| 3 | Weekly agent updates **founder's MultiCA** with each employee's **KPIs from R2 vault** | `member-report-routine.sh`, manifest `member_reporting:` (weekly → MultiCA) | ✅ Worker `GET /v1/member/kpi` provides canonical KPIs from D1. **Remaining:** point `member-report-routine.sh` at D1/R2 KPIs; verify weekly MultiCA push lands; retire the legacy monthly `multica.ts` path. |
| 4 | Each agent's **identity/soul/heartbeat/tools + data ported per member** | `setup-member.sh`, 8 runtime files, "reskinned for member" pattern | ✅ Phase 7 shipped: `GET /v1/member/provision` returns member bundle; Plexus `memberSetup()` drives `setup-member.sh` with `--id` and `--name`; auto-provision on Access login. Legacy `multicaToken`/`paperclipPath` settings deleted. |
| 5 | **Preferences UI** the employee sets about themselves, **CEO references** | — (net-new) | ✅ Phase 9 shipped: `PreferencesPanel` (focus areas, working hours, CEO referral, comms prefs, notes) → Worker `PUT /v1/member/preferences` → D1 `employee_preferences`. **Remaining:** write prefs into member's `CONTEXT.md`; surface to CEO agent + founder MultiCA snapshot. |
| 6 | Learns the employee's **ongoing usage** | manifest `evolution:` (weekly self-evolution) hook | **Remaining:** Capture usage signals in Plexus (active projects, hours, cadence) → feed member agent context + preference inference → weekly `evolution` cycle. |
| 7 | (implicit) Keep it **email-only** | Access live; Worker-centric | ✅ Phase 7 shipped: provision bundle comes from Worker after Access login. All Paperclip/MultiCA config is server-provided; no device secrets stored. |

---

## PART E — Decisions to settle BEFORE writing code (ask the user)

1. **Where do per-employee agents run?** → **DECIDED 2026-06-12: LOCAL PER-MEMBER.**
   Each employee's machine runs its own reskinned Paperclip install; Plexus is the
   installer / health / launcher. The founder aggregation (weekly member_reporting →
   MultiCA) still rolls up centrally. This is settled — build Phases 6–9 on it.
2. **How is a member provisioned without device secrets?** Proposed: after Access
   login, Plexus calls a new Worker route `GET /v1/member/provision` that returns a
   **member bundle** (member id/name, scoped Paperclip + MultiCA config); Plexus
   runs `setup-member.sh` with it. Employee still only ever types their email.
3. **Canonical data source for standup/KPIs:** D1 (Worker) is now the source of
   truth for time. Agents should read from it (via the adapter or a new read route),
   not from the local markdown the legacy bridge writes.
4. **Fate of the legacy bridge** (`paperclip.ts`/`multica.ts`/`auto-sync.ts`/
   `BridgePanel.tsx`): reconcile in place vs replace. *Recommendation: replace
   `BridgePanel` with the new Agent Fabric panel; refactor the two bridge modules
   to pull from the Worker; drop `multicaToken`/`paperclipPath` device settings.*

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
- **Remaining:** the WS5 Worker route blocker (wrangler `routes` gap for
  `plexus-api.thoughtseed.space`) must be fixed before Access login works end-to-end.

### Phase 8 — Standup + KPI loops on canonical data ✅ Worker route done; remaining deferred
- Worker: `GET /v1/member/kpi` returns today/week seconds + project breakdown from canonical D1 `time_entries`. This is live in production.
- **Deferred to post-stabilization kanban:** surface "Today's standup" in Plexus from `vault/standups/`; verify launchd job; point `member-report-routine.sh` at D1/R2 KPIs; verify weekly MultiCA push; retire legacy `multica.ts`.
- **Blocked:** the WS5 Worker route blocker (`plexus-api.thoughtseed.space` missing from wrangler routes) — user owns DNS/Access dashboard fix.

### Phase 9 — Preferences + usage learning ✅ Panel + routes done; remaining deferred
- `PreferencesPanel` ships in Plexus (focus areas, working hours, CEO referral, comms prefs, notes) → Worker `PUT /v1/member/preferences` → D1 `employee_preferences`.
- **Deferred to post-stabilization kanban:** write prefs into member's `CONTEXT.md`; CEO/founder visibility in MultiCA snapshot; usage-learning signals (active projects, hours, cadence → weekly `evolution`).
- **Open questions for user (not blockers):**
  1. What exactly counts as a "KPI" per employee? (hours, project mix, standup compliance, something richer?)
  2. Which preferences should the CEO actually see, and where? (MultiCA app? TeamForge console?)
  3. Should standup compliance feed anything? (nudges? founder report?)

### Phase 14 — Realtime workspace (external SaaS replacement) 🚀 WORKER DEPLOYED + APP RC
- Product contract: [`REALTIME_WORKSPACE_CONTRACT.md`](REALTIME_WORKSPACE_CONTRACT.md).
- Cloudflare decision: [`REALTIME_CLOUDFLARE_DECISION.md`](REALTIME_CLOUDFLARE_DECISION.md).
- Worker/API contract: [`REALTIME_WORKER_API_CONTRACT.md`](REALTIME_WORKER_API_CONTRACT.md).
- Worker implementation: `team-forge-ts/cloudflare/worker/migrations/0011_realtime_workspace.sql`, `src/routes/realtime.ts`, and `/v1/realtime/*` registration in `src/routes/v1.ts`.
- Electron implementation: Realtime tab backed by `RealtimeCapturePanel`, `mediaCaptureStatus`, `mediaRequestAccess`, and Worker-backed `realtime*` IPC methods.
- GitHub milestone: `Plexus Realtime Workspace`.
- Issue range: RW-001 through RW-013, GitHub issues #13-#25.
- Scope: Cloudflare-backed project rooms, presence, audio/video calls, multi-person screen sharing, meeting records, project/time-entry links, and non-transcript Paperclip meeting memory.
- Contract boundary: Cloudflare Realtime owns WebRTC sessions/tracks/media transport; TeamForge Worker/D1 owns rooms, participants, authorization, project linkage, meeting records, audit events, and Paperclip handoff.
- Explicit deferral: self-hosted transcription, recording ingestion, and AI-generated meeting summaries are Phase 15, not part of this pass. Meeting closeout stores manual notes/decisions/actions only and keeps transcript/recording refs null.
- Verification passed: Plexus `npm run typecheck`, `npm run build:main`, `npm run build:preload`, `npx vite build`; Worker `pnpm exec tsc -p tsconfig.json --noEmit`, `pnpm test`.
- Deploy proof: D1 migration `0011_realtime_workspace.sql` applied remotely on 2026-06-15; Worker version `9db2e34e-afbd-48e9-b506-a8bfe51078c3` deployed; `healthz` returned `200`; unauthenticated workers.dev `/v1/realtime/rooms` returned `401 access_identity_required`; remote D1 has no pending migrations.
- Next gate: review RW-005 through RW-009 locally, then implement RW-010 Paperclip ingestion and RW-011/RW-012 hardening/regression.

---

## PART G — Reference (paths · ports · endpoints)

**Plexus run:** `cd plexus-ts && npm run dev` (main = tsc, preload = CJS,
renderer = Vite). DB at `~/Library/Application Support/com.thoughtseed.teamforge/teamforge.db`
(shared name with TeamForge desktop — note the app id).

**Worker:** deploy from the TeamForge Worker with
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
through Worker/Hermes and later read R2/vault confirmation when that remote
support exists.

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
3. After that smoke passes, merge `feat/ws5-access-jwt` → `main`, then start WS3
   / Task #3 (`0008_employees_email_unique.sql` + `PUT /v1/team/employees`).
4. Skim the 4 legacy bridge files (Part C) and the 4 Paperclip scripts
   (`setup-member.sh`, `standup-kpi-pipeline.sh`, `member-report-routine.sh`,
   `health-check.sh`) to confirm current behavior.
5. Confirm the remaining open decisions in Part E / Open Questions; local
   per-member agents are already decided.
6. Start with **Phase 6** (read-only Agent Fabric health panel) — lowest risk,
   immediately visible, validates the whole `:3100`/`:3101` + heartbeat plumbing
   before any provisioning or credential work.

### Open questions for the user
- ~~Local-per-member vs central agents?~~ → **DECIDED: local per-member** (Part D.1)
- Is the founder's MultiCA endpoint/workspace reachable for the weekly push, and
  what exactly counts as a "KPI" per employee (hours? project mix? standup
  compliance? something richer)?
- Which preferences should the CEO actually see, and where does the founder read
  them (MultiCA app? TeamForge console)?
- Should standup compliance feed anything (nudges? the founder report)?
