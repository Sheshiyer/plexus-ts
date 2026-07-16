# Changelog

## [0.5.8] — 2026-07-16

### Authenticated co-working presence

- Added server-issued app presence leases with authenticated sessions, bounded heartbeats, and sequence validation.
- Kept room identity server-owned and separated active app presence from media/speaking state.
- Preserved truthful floor state during refresh failures and retained explicit media-control semantics.

### OTA release

- Prepared the next protected, signed macOS release candidate for the merged-main `0.5.8` tag.

## [0.5.7] — 2026-07-16

### Private GitHub recovery

- Shows one truthful state and machine-readable recovery reason for each pinned GitHub owner instead of collapsing setup failures into a generic forbidden state.
- Separates connected owners from known installations and total owners, with reason-specific actions for repository scope, missing permissions, suspension, OAuth, and signed-event correlation.
- Refreshes founder verification after owner setup reaches a terminal state and keeps verification disabled until a selected, permission-complete installation is active.
- Remains backward-compatible with the earlier Worker response while failing malformed or unknown authority state closed.

### Control-plane rollout

- Targets the additive Worker recovery contract deployed from protected TeamForge merge `9e246546`, including signed unique-installation recovery, permission snapshots, and bounded webhook diagnostics.
- Preserves exact pinned numeric owners, selected-repository scope, admin-only setup, and renderer credential isolation.

## [0.5.6] — 2026-07-15

### Co-working My Studio

- Reframed the standard Co-working workspace around one primary project bench, a focused screen wall, and a quiet team-presence rail capped at six visible benches.
- Integrated the ambient lounge as a secondary strip and moved operational health behind disclosure, keeping media, leave, evidence, and closeout actions explicit.
- Added truthful floor and private local-rhythm states without simulated biometric values, movement mechanics, or pixel-world metaphors.

### Compact casting companion

- Includes the reviewed PR #107 compact companion in the same release lineage, with one shared controller and remote-audio layer across standard and compact modes.
- Preserves reversible native window bounds, always-on-top casting controls, participant context, timer state, explicit media actions, leave, and expand.

### OTA release

- Bumped the protected macOS release candidate and public update manifest target to `0.5.6`.
- Added the approved My Studio moodboard, full-page direction, and component reference as the durable design contract for this release.
- Isolated the packaged-renderer release smoke on an ephemeral local API port so it can verify the candidate while an installed Plexus process owns the production loopback port.

## [0.5.5] — 2026-07-13

### Assistant execution and Temperance context

- Added a bounded model-to-tool-result loop for registered read-only assistant tools, with deterministic round limits, schema validation, and redacted failure handling.
- Kept confirmation-required actions as persisted suggestions for explicit user approval; model output cannot silently execute application mutations.
- Added bounded, read-only Temperance skill-label discovery from the canonical local skill index, with deterministic ordering and safe fallback for missing, malformed, or oversized data.

### Release consolidation

- Reconciled every open pull request, branch, worktree, stash, and uncommitted path without deleting or applying preserved work.
- Updated the production roadmap and deferred register to separate completed deterministic scope from live Paperclip, Worker/Access, transcription, and SFU proof.
- Carries forward the v0.5.4 packaged-renderer white-screen correction and the protected, signed OTA publication chain.

## [0.5.4] — 2026-07-12

### Packaged renderer recovery

- Corrected the packaged renderer asset resolution that caused v0.5.3 to open as a white screen after OTA installation.
- Added packaged-renderer smoke coverage to verify the built application resolves and renders its bundled entry assets before publication.
- Published the corrected signed macOS artifacts and immutable OTA feed through the protected release workflow.

## [0.5.3] — 2026-07-12

### Electron and application trust

- Upgraded Electron to `43.1.0`, electron-builder to `26.15.3`, and `@electron/fuses` to `2.1.3`; the complete release-chain audit now joins the production dependency audit.
- Narrowed packaged renderer/IPC trust to the intended application document, validated update feed and channel overrides, and guarded privileged IPC entrypoints.
- Restricted credentialed Workspace Worker requests to the canonical HTTPS origin and kept alternate development routing environment-owned.

### Hermes reporting integrity

- Made standup reads side-effect free so only explicit standup generation can create persisted compliance evidence.
- Removed the unreachable employee-side R2 placeholder signer and corrected legacy MultiCA/Paperclip documentation to historical provenance.

### OTA workflow

- Bumped the candidate to `0.5.3`; existing `0.5.2` tags, releases, and feed objects remain immutable.
- Split the tag-triggered unsigned candidate from the default-branch Publish OTA workflow, required exact tag/package identity plus merged-main ancestry, and gated signing/R2 authority behind `ota-production`.
- Added create-only immutable R2 writes, streamed public SHA-512 verification, verified GitHub draft assets before the manifest commit point, exact-current failed-job recovery, and a PR-first handoff.

## [0.5.2] — 2026-07-07

### Co-working room stage hardening
- Project room join is now always presence-only; mic, camera, and screen are explicit post-join actions rather than being auto-enabled when a room already has a live call.
- Added explicit project media controls (mic/camera/screen) to the focused project stage. These render as a gated shell with an honest hint until project-room media transport and realtime SFU credentials land.
- The fullscreen project stage now closes on Escape and restores focus to the control that opened it; an open modal keeps ownership of Escape.

## [0.4.9] — 2026-06-30

### Admin Fabric Paperclip proof
- Tightened Paperclip write safety so admin employee test-mode writes require an explicit disposable/test company marker.
- Preserved Paperclip as a Fabric assignment source and kept local work-mode/report state from persisting until upstream bridge sends succeed.
- Added a repeatable live Paperclip admin Fabric smoke against the `Plexus Fabric Test` org for non-destructive release proof.

## [0.4.8] — 2026-06-30

### Settings update recovery
- Kept Settings sections expanded while scrolling so Account, Preferences, Updates, Evidence, and helper controls remain usable in one pass.
- Added accessible section marker labels and stable section focusing without hiding section bodies from assistive technology.
- Let embedded preferences and settings module grids breathe earlier at narrow app widths so update controls are reachable without downloading a DMG manually.

## [0.4.7] — 2026-06-29

### Fabric safety hardening
- Enforced Thoughtseed Fabric mutation safeguards in backend paths, including member ownership checks before work-mode/task status mutations.
- Added tenant/member directive validation during Fabric sync ingestion to skip mismatched directives before local state updates.
- Added structured bridge failure recording for the work-mode mutation IPC path to match existing bridge error reporting behavior.

### Onboarding gate hardening
- Stopped reopening onboarding by default for returning users whose onboarding is already complete.
- Hardened app entry when required onboarding steps remain open by adding an explicit high-friction bypass flow.

### Admin diagnostics sensitive-data protection
- Added sensitive-row metadata and masked-by-default rendering for prompt/config and raw payload values.
- Added explicit reveal/hide controls and high-risk copy cues for paths, payloads, and bridge/prompt fields.
- Added copy feedback (`Copied` / `Copy failed`) and fallback copy behavior when the Clipboard API is unavailable.

## [0.4.6] — 2026-06-29

### Identity loadout
- Added a dedicated Identity page that presents the signed-in member as a read-only operator loadout with real skill stats, unlocked capability perks, and Paperclip companion-agent readiness.
- Shared the member loadout scoring between Settings and Identity so profile level, focus, cadence, signal, and trust stay consistent.
- Added degraded companion handling so offline Paperclip/Fabric status is shown honestly instead of appearing as an empty roster.

### UX pass
- Added branded video backgrounds across splash, login, onboarding, and post-onboarding loading.
- Tightened Projects, Agent Sessions, Fabric, Co-working, Admin, and Settings layouts for clearer laptop-sized workflows.
- Moved Reports, Export, and Backups under Admin utilities and made Admin diagnostics collapsible row-by-row.

## [0.4.5] — 2026-06-25

### Employee copy and diagnostics
- Added an employee-copy audit that blocks raw URLs, endpoints, prompt instructions, payload text, source paths, and visible port/debug labels from employee-facing renderer files.
- Added an admin diagnostics panel for worker, OTA feed, Thoughtseed Bridge, local helper, vault resolver, directive payload, and prompt/config support details.
- Simplified Login, Onboarding, Settings, Preferences, Projects, and Task Assignments so employees see account, workspace, task, proof, local-helper, and update language instead of dev/operator noise.

### OTA planning
- Added a 39-item low-hanging OTA improvement backlog covering release safety, diagnostics, proof correctness, employee workflow polish, and documentation cleanup.

## [0.4.3] — 2026-06-25

Settings experience and OTA prep patch for the Plexus coordination shell.

### Settings
- Reworked Settings around a quest-guide rail that tracks active objectives and collapses non-focused sections.
- Tightened the member profile card layout so long names, handles, status copy, and avatar controls stay inside the credential frame.
- Added generated default avatar presets plus upload-to-local-data-URL support for profile images.
- Added explicit private rhythm save feedback in Settings and onboarding.

### Release workflow
- Keeps the release workflow on the existing tag-triggered OTA path: local prep gates, push `main`, push `v0.4.3`, watch Release, then verify `latest-mac.yml`.

## [0.4.2] — 2026-06-24

Design-system and OTA release-prep patch for the Plexus coordination shell.

### Interface system
- Added a shared Plexus UI primitive layer for instrument panels, metric rails, ledgers, command docks, field docks, status chips, empty states, and degraded states.
- Migrated Focus, Work Records, Projects, Reports, Export, Backups, Preferences, Admin Workspace, Agent Fabric, Onboarding, Permissions, Shortcuts, and Co-working section shells onto the shared visual grammar.
- Reclassified project proof states so `needs repo` reads as setup/warning while red remains reserved for inaccessible or failed proof.

### Release workflow
- Added `npm run release:ota:prep` for non-publishing OTA readiness checks.
- Added `npm run release:ota:prep:full` for clean-worktree prep plus unsigned packaging smoke.
- Documented the prep gate in `docs/OTA_RELEASE.md`.
- Routed renderer builds through Vite's native config loader so the parent workspace Astro tsconfig no longer bleeds into Plexus release output.

## [0.4.1] — 2026-06-19

Patch release prep for the evidence-backed work loop and OTA hardening.

### Work coordination proof
- Added verified GitHub repo gates for new focus sessions and manual work records.
- Added local evidence metadata for projects, work records, GitHub activity, standup evidence, review cycles, and breakwork prompts.
- Added conservative GitHub activity matching so work records become `matched` only when real Worker-returned activity lands in the record window.
- Added local proof API routes for evidence status, project activity, standups, and review rollups.

### Thoughtseed Bridge and Fabric tasks
- Added member-scoped Thoughtseed Bridge custody, heartbeat, directive polling, ack, token rotation, and disconnect flows.
- Added Agent Fabric task cards for Cambium/Hermes project assignments with mode selection, status reporting, blocker notes, and evidence capture.
- Added deterministic smoke coverage for canonical bridge signing, token-expiry fail-closed behavior, and Cambium `project_task_assignment` parsing.

### Settings
- Added editable member profile storage and a Plexus-native ProfileCard surface.
- Added GitHub evidence health, sound/breakwork controls, and private rhythm settings.
- Kept birthdate/rhythm data local and out of CEO-visible preference/report paths.

### Release hardening
- Bumped app/package lock to `0.4.1`; the live OTA feed already serves `0.4.0`.
- Added ESLint as an executable gate and wired lint/no-placeholder scans into CI and Release workflows.
- Added OTA gap analysis evidence for patch release preparation.

## [0.4.0] — 2026-06-17

Realtime → Co-working. The old meeting-oriented Realtime tab is replaced
by an ambient co-presence surface that lights up the existing TeamForge
realtime/room infrastructure as a "studio floor."

### New surface
- `src/renderer/components/CoWorkingPanel.tsx` (764 lines) replaces
  `RealtimeCapturePanel.tsx` (deleted). Three stacked sections:
  - **§01 · TODAY'S FLOOR** — avatar grid of every employee currently
    present in any room. Ring color encodes context — chartreuse for
    "in an active call" (timing), mint for "joined but quiet" (online),
    violet for "in the workspace lounge," faint grey for idle.
  - **§02 · PROJECT ROOMS** — anchored-by-project cards with mini-avatar
    clusters, room-state badges (`ACTIVE` / `QUIET` / `IN CALL` /
    `EMPTY`), and "+ DROP IN" / "+ JOIN VOICE" CTAs.
  - **§03 · AMBIENT LOUNGE** — persistent bottom strip with audio
    waveform, presence pill, and four icon-only controls
    (mic / camera / captions / leave).
- `src/renderer/App.tsx` sidebar nav: "Realtime · media readiness" →
  "Co-working · ambient presence" (`IconUsers`).
- Visual reference: `docs/design/screen-references/co-working.png`
  generated via gpt-image-2 and committed as the locked-in design
  contract.

### Data layer (no new endpoints)
- `getCoworkingFloor()` fans out across `/v1/realtime/rooms` + each
  room's detail in parallel, dedupes participants by identity, ranks
  per-person ring state (`lounge > timing > online`), and carries
  speaking-state forward across rooms.
- `getCoworkingLounge()` discovers the first `roomType: 'workspace_lobby'`
  as the ambient lounge. UI shows idle state if none exists.
- New IPC: `coworking:floor`, `coworking:lounge`. New API methods on
  `window.plexus.coworkingFloor()` and `coworkingLounge()`.
- New types: `CoWorkingRingState`, `FloorPresence`.

### Theme
- 35 new `px-*` classes — floor grid, avatar tiles + ring variants,
  room cards + state badges, mini-avatar clusters, lounge strip +
  controls, waveform. All token-based; both dark and light themes.

### Retired
- The old meeting closeout form UI is gone. The Worker
  `realtime:closeout` endpoint still works for any leftover history;
  co-working sessions don't open a closeout dialog (subsumed).

### Release
- Bumps 0.3.4 → 0.4.0 (MAJOR — UX shift; new persistence + presence
  surface).

## [0.3.4] — 2026-06-17

### macOS tray
- Tray icon was invisible in the packaged 0.3.3 build. Two known
  asar-on-macOS pitfalls: `nativeImage.createFromPath()` can return an
  empty image when the path is an asar virtual path, and template-image
  auto-detection from the `Template` filename suffix is unreliable
  across asar.
- Defense in depth:
  - `package.json` `build.asarUnpack` now lists
    `assets/icons/trayTemplate.png` and `trayTemplate@2x.png` so
    electron-builder drops them as real files under
    `app.asar.unpacked/assets/icons/`.
  - `createTray` calls `icon.setTemplateImage(true)` explicitly instead
    of relying on the filename heuristic.
  - `createTray` now guards with `icon.isEmpty()` and wraps `new Tray()`
    in try/catch, logging to Console.app instead of silently failing.

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
