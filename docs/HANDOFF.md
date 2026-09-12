# Plexus session handoff

Reviewed: 2026-09-05 against v0.7.12 / `e8d3a74` and the migration review. This page orients the next session; [ISA.md](../ISA.md) owns acceptance and [planning state](../.planning/STATE.md) owns the next wave. Start with the [documentation map](DOCUMENTATION_MAP.md).

## Current product and runtime authority

Plexus is a local-per-member Electron app. Electron main owns Clio, bounded context, tool confirmation, the local outbox, and encrypted credential custody. The Workspace Worker/D1 owns member/project identity and authorization. The local Git-synced founder vault enriches existing Worker-ID-matched projects for admins; it cannot create or reassign them.

Reporting follows `Plexus → member-scoped Thoughtseed bridge → Hermes → Cambium / configured Telegram destinations`. A Workspace Worker daily-event fallback is attempted only after bridge failure, remains eligible for bridge retry, and is not proof of Hermes delivery. Read the [reporting contract](architecture/HERMES_REPORTING_CONTRACT.md) and [bridge handoff](THOUGHTSEED_BRIDGE_HANDOFF.md).

Paperclip and its dedicated Fabric helper runtime/panel are retired. Do not install or repair them as onboarding work. Fabric-named task data, meeting fields, and existing-layout vault readers remain compatibility contracts; see [optional-helpers.md](optional-helpers.md).

## Migration state and next work

The [September 5 migration review](evidence/2026-09-05-labs-migration-review.md) records current API/profile and public HTTP evidence. Labs is the Workspace API account, but v0.7.9–v0.7.12 still pin the personal-account public OTA feed. Earlier supported clients use the custom upgrade hostname. The source feed being reachable does not mean the Labs OTA cutover is complete.

Continue the explicit planning overlay, preserving both installed-client feed paths: credential custody, exact Labs route ownership/repair, retained artifact parity, and a reviewed signed bridge-release procedure. Then prove upgrade/relaunch, identity/workspace continuity, Clio, and subsequent Labs update discovery. Do not repeat completed domain/data-clone phases or delete the old client feed based on a generic soak period.

The user is handling secret values and the identified signing/GitHub App/D1 access dependencies. Keep source preparation, read-only inventory, live routing, signing, publication, and retirement as distinct steps. Refer to [OTA_RELEASE.md](OTA_RELEASE.md) for the workflow and migration sequence.

## Source and verification map

| Concern | Current source / guide |
|---|---|
| Access login and Workspace client | `src/main/teamforge.ts` |
| Clio runtime/context/tools | `src/main/assistant-runtime.ts`, `assistant-context.ts`, `assistant-tools.ts` |
| Member reporting | `src/main/assistant-daily.ts`, `src/main/thoughtseed-bridge.ts` |
| Local proof/data | `src/db/database.ts`, [PROOF_CUSTODY.md](PROOF_CUSTODY.md) |
| Founder document enrichment | `src/main/vault-projects.ts` |
| Pinned updater and consent | `src/main/updates.ts`, `package.json`, [OTA_RELEASE.md](OTA_RELEASE.md) |
| Worker infrastructure source | Sibling `team-forge-ts/cloudflare/worker`, explicit `wrangler.labs.jsonc`, `thoughtseed-labs` profile |

The retained sibling `wrangler.jsonc` is the legacy personal config. No bare Wrangler deploy or old environment-token export from this handoff is a valid Labs operation. Verify account/profile and exact config before any infrastructure command. Token values are not documentation inputs; Plexus stores only its main-process-owned credentials through secure storage.

## Resume checklist

1. Inspect current branch, worktrees, dirty state, `AGENTS.md`, ISA, and planning before choosing a task. Preserve unrelated work.
2. Read the current evidence for the selected boundary. Old deployment IDs, session counts, and assigned-worker tasks below are history.
3. Run checks appropriate to the changed source. [docs/RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md) defines local, remote, and installed-app proof.
4. Keep [docs/DEFERRED_REGISTER.md](DEFERRED_REGISTER.md) and [docs/RELEASE_CANDIDATE_RECOMMENDATION.md](RELEASE_CANDIDATE_RECOMMENDATION.md) consistent with current acceptance.
5. `npm run verify:release-candidate` still checks the historical `docs/evidence/2026-07-10-release-candidate-closeout/README.md` packet; its success does not certify a Labs cutover.

## Historical rollout notes

<details>
<summary>June–July 2026 handoff snapshot — historical decisions and receipts</summary>

These notes retain the original rollout sequence and contemporaneous claims. Their old helper installation steps, personal Access team, deployment IDs, task assignments, open checkboxes, and proposed future work are superseded by the current orientation above. Do not execute historical commands or reopen retired integrations from this snapshot.

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
- [x] **Current release-proof gate:** `docs/RELEASE_EVIDENCE.md` is the binary production-ready checklist. `npm run verify:all` now covers lint, typecheck, no-placeholder scan, production dependency audit, Electron fuses, renderer CSP, release evidence policy, release-candidate closeout verification, all Vitest suites, deterministic smokes, and renderer build. Signed OTA proof remains a separate live secret-free Release Candidate plus protected Publish OTA requirement; live Paperclip admin proof remains `npm run smoke:admin-fabric-paperclip`; dev/build-chain audit findings are recorded in `docs/SECURITY_AUDIT_WAIVERS.md`.
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

In the 2026-06-12 baseline, `thoughtseed-paperclip/` was a **Krebs-cycle agent
org** plus integration plane. Much of the then-requested helper behavior existed
there as CLI/cron. That historical implementation is not the current reporting
plane: Plexus now reports through the member-scoped bridge to Hermes, while
Paperclip remains optional local enrichment.

### Historical agents (6) — `agents/<name>/`
`ceo`, `scientist`, `engineer`, `designer`, `synthesist`, `hermes` (communications).
Each agent is **8 runtime files** (this *is* the "identity / soul / heartbeat /
tools" the user means):
`MANIFEST.yaml · IDENTITY.md · SOUL.md · CONTEXT.md · TASKS.md · INBOX.md · HEARTBEAT.md · AGENTS.md`.
`agents/ceo/HEARTBEAT.md` literally reads *"Reskinned for team member instance.
Initialized 2026-06-11"* — i.e. **per-member reskin is the intended mechanism.**

### Routines recorded in the 2026-06-12 `manifest.yaml`
- **`standup:`** ran daily at **18:00 Asia/Kolkata** (`cron 30 12 * * 1-5`),
  with `ceo` aggregation, `hermes` dispatch, and local vault output.
- **`member_reporting:`** was a weekly helper routine whose obsolete destination
  was MultiCA. It is retained here only as retirement provenance and must not be
  used as a current founder-report route.
- **`multica_bridge:`** described the retired bidirectional MultiCA queues and
  command lanes. Those endpoints and credentials are not Plexus dependencies.
- **`vault:`**, **`loop:`**, and **`web_ui:`** described optional local helper
  storage, short cycles, and the Paperclip UI available at that time.

### Scripts — `scripts/`
| Historical script | Purpose at the time | Historical mapping |
|---|---|---|
| `bootstrap.sh` *(repo root, not `scripts/`)* | Idempotent install/validate (manifest, 8 files/agent, departments, configs; probes Paperclip API) | install + checker (CLI) |
| `health-check.sh` / `bridge-health.sh` | Runtime + bridge health | the "checker" |
| `setup-member.sh` | Provision/reskin a **member** instance | per-member identity/soul/heartbeat port |
| `onboarding-flow.sh` | Member onboarding | onboarding |
| `standup.sh` + `standup-kpi-pipeline.sh` | Build the daily standup + KPI pipeline | daily standup agent |
| `member-report-routine.sh` | Weekly member insight → MultiCA | weekly founder-KPI updater |
| `paperclip-sync.sh` / `teamforge-feed-sync.sh` | Sync with Paperclip API / TeamForge feed | data port |
| `com.thoughtseed.hermes-standup-digest.plist` | launchd job for the standup digest | scheduling |

### Historical TeamForge ↔ Paperclip runtime adapter
At the time, `team-forge-ts/scripts/paperclip-runtime-adapter.mjs` ran a local
HTTP server on **:3101** for helper health and approval state. Current Plexus may
probe an explicitly enabled local helper, but that adapter is not a reporting
authority or a required path to Hermes.

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

| Deleted file | What the retired implementation did | Why it was removed |
|---|---|---|
| `src/bridge/paperclip.ts` | Wrote a markdown report into a local Paperclip vault path. | Required a checkout and device path, so it could not be a canonical report transport. |
| `src/bridge/multica.ts` | Posted a monthly report to MultiCA with a device bearer token. | Violated email-only credential custody and the current Hermes authority boundary. |
| `src/main/auto-sync.ts` | Sent the retired Paperclip/MultiCA side effects after timer stop. | Coupled local work capture to deprecated report destinations. |
| `src/renderer/components/BridgePanel.tsx` | Exposed manual Paperclip, MultiCA, and direct-R2 actions. | The actions and their device credential surfaces were removed. |
| Former onboarding/settings/preload wiring | Exposed the deleted bridge payloads and actions. | That wiring no longer exists and must not be repointed or restored. |

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
   Renderer configuration cannot redirect authenticated Worker requests; the
   production origin is canonical, and development overrides are process-owned
   through `PLEXUS_WORKER_BASE_URL`.
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

## PART F — Historical phased plan (continued ROADMAP 0–5)

> Preserved to explain the order used by the original rollout. Current work must
> follow the roadmap and Hermes reporting contract, not restart this dated plan.

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


</details>
