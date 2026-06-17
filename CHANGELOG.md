# Changelog

## [0.3.3] — Clio — 2026-06-17

Named for Clio, Muse of history — this release clears accumulated history
that the live 0.3.2 build was tripping over.

### Auth recovery
- `clearAccessBrowserSession` now does `session.clearStorageData()` +
  `clearCache()` instead of only removing the `CF_Authorization` cookie.
  The persist:tfaccess partition was silently accumulating other CF Access
  cookies, Local/Session Storage, IndexedDB, and cache (~2 MB after a few
  weeks), and that stale state paired freshly issued OTPs with prior
  partial-auth sessions, surfacing as “This One-Time Pin has already been
  used” on a brand-new code.

### Reports
- `member:kpi` IPC handler now unwraps the `{ ok, data }` wrapper from
  `teamforge.getMemberKpiSummary` to the `MemberKpiSummary` the renderer’s
  type declares, throwing on failure. The renderer was reading
  `kpi.todaySeconds` off the wrapper (always `undefined`), so the KPI bar
  rendered as “NaNh NaNm” on every install.
- Reports KPI math now defends with `(kpi?.todaySeconds ?? 0)` so a
  missing field degrades to `0`, never `NaN`.

### Onboarding pre-flight
- Paperclip binary detection now checks `/opt/homebrew/bin`,
  `/usr/local/bin`, `~/.local/bin`, `~/.bun/bin` directly, then falls
  back to `which` with a PATH augmented for those directories. Packaged
  macOS apps inherit a minimal GUI PATH and `which` alone missed
  Homebrew installs, so the panel reported “binary: not found” even with
  `paperclipai` installed.
- `ready` indicator keys off `binaryFound && configFound` (the live
  Paperclip runtime) instead of the retired local repo.

### Cleanup
- Removed the retired-repo enrichment shipped in 0.3.2: the Organization,
  Agent Skills, Task Feed, and Project Vault panels, plus the “REPO” row
  in the install pre-flight, plus their fabric helpers and IPC channels.
  The local `thoughtseed-paperclip` repo is retired — cofounders use
  AWS-hosted MultiCA, employees use the `paperclipai` runtime — so those
  panels rendered empty on every real install.

## [0.3.2] — 2026-06-16

### Agent Fabric Enrichment (G1–G8)
- Paperclip install detection (binary/repo/config) surfaced in the onboarding pre-flight and the fabric panel.
- Dynamic port discovery from `~/.paperclip/instances/default/config.json` (falls back to `:3100/:3101`).
- Organization config parsed from `manifest.yaml` (departments, coordination, standup) with a fabric Organization panel.
- Per-agent skill + routing-tag panel sourced from `config/skill-routing-map.md`.
- Standup/task-feed status (configured, pending count, last sync) from `MEMORY/teamforge-feed.json`.
- Per-project vault detail (context/decisions/handoffs/inbox counts) wired into Projects.
- Daily/weekly report payloads gained `entryCount` + `projectBreakdown`.

### Hardening
- `daily_agent` onboarding step now runs a real fabric-reachability check instead of completing as a silent no-op.
- Install, KPI, and project-vault fetches surface errors and auto-refresh instead of swallowing failures and sitting on stale data.
- `PermissionsGate` `onComplete` is wired to refresh the onboarding pre-flight when the permission wizard finishes.
- Removed the unused `PlexusViz` component (dead code).

### Release
- Bumped the app to `0.3.2`.

## [0.3.1] — 2026-06-16

### Realtime Media
- macOS media entitlements (microphone + camera) for packaged builds.
- WebRTC session manager for Cloudflare Realtime SFU.
- Onboarding permissions panel with one-at-a-time native prompts.
- Per-kind System Settings launcher (microphone / camera / screen recording).

## [0.3.0] — 2026-06-15

### Realtime Workspace
- Added a first-class Realtime tab for project rooms, room lobby state, join/leave flow, participant grid, audio/video controls, and local multi-screen-share publishers.
- Wired Plexus to the TeamForge Worker realtime broker through typed IPC and shared response types.
- Added manual meeting closeout fields for project links, time-entry links, issue IDs, decisions, action items, and non-transcript Paperclip handoff notes.
- Kept transcription, recording ingestion, and generated AI meeting summaries deferred to the later self-hosted transcription phase.

### Worker Contract
- Added the TeamForge realtime room/session/participant/track/meeting D1 schema and `/v1/realtime/*` API contract.
- Added Worker route tests for rooms, joins, tracks, meeting closeout, and transcript deferral behavior.
- Added server-side Cloudflare Realtime environment boundaries without introducing Slack or Huly dependencies.

### Release
- Bumped the app to `0.3.0` for the realtime workspace release train.
- Preserved the production OTA feed at `https://plexus-upgrade.thoughtseed.space/plexus`.
- Documented the true OTA proof path: install `0.2.0`, publish `0.3.0`, check, download, install, restart, and confirm the new version.

## [0.2.0] — 2026-06-12

### Agent Fabric (Phase 6–9)

**Phase 6 — Agent Fabric Health Panel**
- Live port tiles for `:3100` (Paperclip UI) and `:3101` (runtime adapter) with latency
- 6 agent health tiles (`ceo`, `scientist`, `engineer`, `designer`, `synthesist`, `hermes`) with heartbeat freshness
- Bridge status tile showing MultiCA reachability
- Vault counts (standups + handoffs)
- Shell `health-check.sh` output streamed into panel
- Auto-refresh every 10s with pause/resume control

**Phase 7 — Per-member Provisioning (email-only)**
- Worker `GET /v1/member/provision` returns member bundle
- Plexus `memberSetup()` drives `setup-member.sh --id <id> --name <name>`
- Auto-provision on Cloudflare Access login
- Legacy `multicaToken` / `paperclipPath` / `multicaApiUrl` device settings deleted

**Phase 8 — Standup + KPI Loops**
- Worker `GET /v1/member/kpi` returns canonical D1 `time_entries` (today/week seconds + project breakdown + compliance)
- `standup-kpi-pipeline.sh` rewritten: reads Worker KPI, generates `vault/standups/<member>-<date>.md`
- `AgentFabricPanel` shows "Today's standup" tile with yesterday/today/blockers + hours + compliance
- Standup nudge banner (rose) appears when `standupCompliant=false` — same-day threshold
- `member-report-routine.sh` reads D1 KPIs + pushes weekly report to MultiCA
- Founder report includes per-employee KPI hours summary + compliance flag

**Phase 9 — Preferences + Usage Learning**
- `PreferencesPanel` (focus areas, working hours, CEO referral, comms prefs, notes)
- Worker `PUT /v1/member/preferences` → D1 `employee_preferences` (migration `0008` applied live)
- `member-context-sync.sh` syncs Worker prefs into `agents/ceo/CONTEXT.md` (integrated into `paperclip-cycle.sh`)
- `usage-evolution.sh` aggregates 30-day usage signals, writes insights + agent suggestions to `CONTEXT.md`
- Plexus emits usage signal on timer stop (active project, daily seconds, compliance, session duration)
- Founder weekly report includes full `preferences_json` verbatim per member

### Legacy Bridge Retirement
- Deleted: `src/bridge/multica.ts`, `src/bridge/paperclip.ts`, `src/main/auto-sync.ts`, `src/renderer/components/BridgePanel.tsx`
- Removed types: `BridgeConfig`, `PaperclipSyncPayload`, `MultiCAMessage`
- Added types: `StandupData`, `MemberKpiSummary`, `UsageSignal`
- No device secrets stored in Plexus settings; all config flows from Worker after Access login

### Paperclip Cycle Integration
- `paperclip-cycle.sh` now runs: sync-issues → member-context-sync → reconcile-local → usage-evolution → sync-heartbeats
- Best-effort, non-blocking steps; skips gracefully when auth or data is missing

### Build
- `npx tsc --noEmit` passes with zero errors
- Electron builder configured for macOS (DMG), Windows (NSIS), Linux (AppImage)

## [0.1.0] — 2026-05-15

### Foundation
- FORMA / cambium redesign — design tokens, primitives, all screens, GLSL splash shader
- Brand assets — GPT-Image-2 icon set, brand board, Swiss poster, DMG background
- Phase 0 — de-billing; internal employee model
- Phase 1 — email login + TeamForge project sync
- Phase 2 — time write-back to Worker
- Phase 3 — Clockify backfill into D1
- Phase 4 — Cloudflare Access OTP sign-in
- Auto-backup + restore system
- REST API server on `:31339`
