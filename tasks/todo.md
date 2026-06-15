# Plexus Admin Session + Real Onboarding Plan

Updated: 2026-06-14T13:42:00Z

## Goal

Make the Thoughtseed Labs Gmail a first-class admin identity and turn Plexus sign-in into a real role-aware session plus resumable onboarding flow. The demo must exercise the same Worker, D1, Cloudflare Access, project sync, and optional feature state transitions that employees use; it must not be a canned next-button walkthrough.

## Current Findings

- Plexus is on `main`, ahead of `origin/main` by four commits, with uncommitted auth debug edits in `src/main/teamforge.ts` and `src/shared/types.ts`.
- `https://plexus-api.thoughtseed.space/v1/whoami` reaches Cloudflare Access and returns unauthenticated `302`, so the route is live.
- The current Worker `/v1/whoami` response is only `{ email, access: true }`; it does not return role, workspace, admin status, project visibility, onboarding state, or feature capabilities.
- Current Plexus login treats Access success as `whoami.email -> fetchEmployees -> session`; this fails when `/v1/whoami` does not return a usable employee identity.
- Current onboarding UI is an old fixed carousel with predetermined Next steps and legacy Paperclip/MultiCA copy.
- Existing Worker tables include `employees`, `projects`, `employee_preferences`, and onboarding-flow registry primitives, but no explicit app-session/onboarding-state contract for Plexus.

## Implementation Checklist

- [x] Confirm the actual Thoughtseed Labs Gmail address to seed as admin: `thoughtseedlabs@gmail.com` found in existing repo config/history.
- [x] Inspect current remote D1 employee rows before migration so the seed is idempotent and does not duplicate people.
- [x] Add TeamForge/D1 schema support for Plexus app role/session data:
  - [x] Admin identity source keyed by email, or employee role fields if the existing model can support it cleanly.
  - [x] Per-identity onboarding state with step statuses: `required`, `optional`, `skipped`, `deferred`, `completed`, `failed`.
  - [x] Project visibility policy sufficient for admin all-project access and normal employee scoped access.
- [x] Seed Thoughtseed Labs Gmail as active admin with all-project visibility.
- [x] Change Worker `/v1/whoami` to return a role-aware session:
  - [x] `email`
  - [x] `identityId`
  - [x] `employeeId` or `adminId`
  - [x] `workspaceId`
  - [x] `role`
  - [x] `projectVisibility`
  - [x] `capabilities`
  - [x] `onboarding`
- [x] Update `GET /v1/member/provision`, `GET /v1/projects`, `GET/PUT /v1/member/preferences`, and KPI/time routes to use the resolved principal rather than re-querying only an employee email.
- [DEFERRED-VERIFY] Fix Plexus Access-cookie capture:
  - [x] Capture the app-domain `CF_Authorization` cookie for `plexus-api.thoughtseed.space`.
  - [x] Avoid storing unrelated Access meta/session cookies as app JWTs.
  - [DEFERRED-VERIFY] Prove the stored token makes `/v1/whoami` return the role-aware identity. Follow-up: requires fresh OTP in Plexus after the 2026-06-14 remote migration/deploy.
  - [x] Remove or hide debug JWT UI/logging before release.
- [x] Update shared Electron types so `Session` carries role, capabilities, visibility, and onboarding state.
- [x] Replace Plexus login success path:
  - [x] Consume the role-aware `/v1/whoami` response directly.
  - [x] Persist a session without needing a separate email lookup through `/v1/team/snapshot`.
  - [x] Auto-sync projects according to visibility after session creation.
- [x] Replace the old onboarding carousel with a real state machine:
  - [x] Core identity/project setup is required.
  - [x] Paperclip/Vapor Clip setup is optional and skippable.
  - [x] Daily agent/standup setup is optional and skippable.
  - [x] Preferences are skippable and editable later.
  - [x] Stop/resume must preserve explicit state.
  - [x] Skipped/deferred optional steps remain visible in settings/admin review.
- [x] Build admin demo mode:
  - [x] Show admin identity and all-project access.
  - [x] Inspect project list, employees, onboarding states, and optional feature states from real Worker data.
  - [x] Emulate employee onboarding by selecting an employee context, while still calling real Worker routes and writing real demo-safe state.
  - [x] Never bypass Cloudflare Access or D1 authorization checks.
- [x] Update docs:
  - [x] `docs/ROADMAP.md`
  - [x] `docs/HANDOFF.md`
  - [x] this task ledger with verification results.
- [x] Verify locally:
  - [x] Plexus `npm run typecheck`
  - [x] Plexus `npm run build:main`
  - [x] Plexus `npm run build:preload`
  - [x] Plexus `npx vite build`
  - [x] Worker `pnpm -C /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/team-forge-ts exec tsc -p cloudflare/worker/tsconfig.json --noEmit`
  - [x] D1 migration dry/local validation where possible.
- [DEFERRED-VERIFY] Verify live only after explicit deploy approval:
  - [x] Remote D1 migration applied.
  - [x] Worker deployed.
  - [ ] Fresh OTP sign-in with Thoughtseed Labs Gmail.
  - [ ] `/v1/whoami` returns role-aware admin session.
  - [ ] Admin demo can inspect all projects.
  - [ ] Employee emulation records real onboarding state changes.

## Review Section

Implemented locally across Plexus and TeamForge Worker. Verification passed:

- Plexus `npm run typecheck`
- Plexus `npm run build:main`
- Plexus `npm run build:preload`
- Plexus `npx vite build` completed with the existing parent Astro tsconfig warning.
- Worker `pnpm -C /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/team-forge-ts exec tsc -p cloudflare/worker/tsconfig.json --noEmit`
- `git diff --check` in Plexus
- `git diff --check` in TeamForge
- Local SQLite replay of Worker migrations `0001` through `0009`

Live batch completed on 2026-06-14 after explicit approval:

- Wrangler auth confirmed with D1/workers write scopes.
- Remote D1 inspection found workspace `ws_thoughtseed`, seven active employees, and one existing `thoughtseedlabs@gmail.com` employee row (`emp_630f768292cc4b674e5ae3e3`).
- Migration `0009_plexus_session_onboarding.sql` was adjusted before apply so `thoughtseedlabs@gmail.com` becomes stable identity `pid_admin_thoughtseed_labs`, linked to the existing employee row, rather than being backfilled as a normal employee identity.
- Remote D1 migration `0009_plexus_session_onboarding.sql` applied successfully.
- Remote D1 verification: seven `plexus_identities`; `pid_admin_thoughtseed_labs` has role `admin`, visibility `all`, employee link `emp_630f768292cc4b674e5ae3e3`; admin onboarding rows exist for `identity_projects`, `preferences`, `paperclip`, and `daily_agent`.
- Remote project visibility baseline: `ws_thoughtseed` has 23 projects, 17 active.
- Worker deployed successfully as version `3d786b06-5389-49be-a43f-a142a9684ca7` on `teamforge-api.sheshnarayan-iyer.workers.dev`, `forge.thoughtseed.space`, and `plexus-api.thoughtseed.space`.
- Health smoke passed on both workers.dev and `https://plexus-api.thoughtseed.space/healthz`.
- Unauthenticated `https://plexus-api.thoughtseed.space/v1/whoami` still returns Cloudflare Access `302`, which proves the Access gate is active.
- Raw workers.dev `/v1/whoami` fail-closes with `access_identity_required`, which proves the route does not accept forged identity without a real Access JWT.
- Unauthenticated `https://plexus-api.thoughtseed.space/v1/admin/demo` fail-closes with `access_identity_required`, so admin demo data requires a registered Access identity before role checks.
- Plexus dev app smoke initially found the local stored token was a Cloudflare Access `org` token for the wrong audience. Plexus now rejects `meta`/`org` tokens, requires the Plexus Access app AUD, and validates `/v1/whoami` JSON before closing the Access login window.
- The stale local `tf.accessJwt` was cleared from `~/.plexus/plexus.db`.
- Relaunch smoke showed Plexus waiting on the login window with `cookie candidate found but not app token`, rather than parsing Cloudflare HTML as Worker JSON.

Remaining proof is fresh OTP from Plexus using `thoughtseedlabs@gmail.com`, then verifying `/v1/whoami`, admin project overview, and employee onboarding emulation through the actual app-domain Access token.

---

# Plexus UX Hardening Plan

Updated: 2026-06-14T15:05:00Z

## Goal

Turn the now-working admin session into a usable operator console: fix timer stop reliability, replace decorative dashboard motion with a meaningful agent activity hub, make the navigation collapsible, and ensure every visible dashboard component explains useful state or offers an action.

## Findings

- The app is now logged in as the admin and can see the full menu surface.
- The timer stop button can leave the renderer showing an active timer because `Timer` stops the main-process entry but does not request the updated timer state immediately.
- The right-side timer visualization is decorative and spinning; it should communicate agent/runtime status, onboarding readiness, project coverage, sync state, and recent work.
- The sidebar has no collapse affordance and the menu has several flat labels without secondary meaning.
- Current dashboard cards show counts, but the operator cannot always tell what to do next.

## Implementation Checklist

- [x] Fix timer stop UI reliability:
  - [x] Refresh timer state immediately after start/stop.
  - [x] Disable Start/Stop while a timer action is pending.
  - [x] Emit an explicit stopped tick from the main process after `timer:stop`.
  - [x] Keep today/recent entries in sync after the stop.
- [x] Replace decorative `PlexusViz` usage in Timer with a purposeful agent activity hub:
  - [x] Show active timer status, selected/running project, current session, today total, recent entries, distinct projects, sync/onboarding/admin signals.
  - [x] Use visual nodes only as encoded status markers, not as a placeholder spinner.
  - [x] Remove or stop the constant rotation in this dashboard context.
- [x] Improve app shell navigation:
  - [x] Add a left-menu collapse/expand toggle.
  - [x] Add compact labels/tooltips/secondary hints so menu items communicate purpose.
  - [x] Keep admin-only items conditional.
- [x] Add menu bar options/actions:
  - [x] Refresh session/projects.
  - [x] Open onboarding/admin/fabric shortcuts.
  - [x] Surface keyboard shortcuts from the HUD.
- [x] Harden component responsiveness and appearance settings:
  - [x] Raise Electron `BrowserWindow` min size so components cannot collapse below the operator-console floor.
  - [x] Stop auto-docking DevTools in dev mode; use `PLEXUS_OPEN_DEVTOOLS=1` for detached DevTools when needed.
  - [x] Add renderer min-size and responsive clamp rules for HUD, sidebar, timer hero, stat grids, activity hub, and Settings controls.
  - [x] Make Appearance theme selector real: preview theme tokens, explicit Save Appearance, and persisted theme application at startup.
  - [x] Fix `settings:set` IPC to return updated settings instead of an `ipcMain.emit` boolean.
  - [x] Continue applying composed component patterns to Admin, Preferences, Reports, and Settings sections that still feel like raw line boxes.
    - [x] Add shared console/card/form primitives for command rows, flow cards, section bands, and report toolbars.
    - [x] Convert Admin identity cards and onboarding emulation rows to composed command/flow cards.
    - [x] Convert Onboarding steps to the same state-aware flow-card pattern.
    - [x] Convert Preferences and Settings into section bands with explicit action zones instead of one long raw panel.
    - [x] Convert Reports controls/results to the composed toolbar/spec/breakdown pattern.
- [ ] Verify:
  - [x] `npm run typecheck`
  - [x] `npm run build:main`
  - [x] `npm run build:preload`
  - [x] `npx vite build`
  - [x] Renderer mock-smoke in system Chrome at 1280x820 for Admin, Preferences, Settings light theme, and Reports. Screenshots: `/tmp/plexus-admin-component-pass.png`, `/tmp/plexus-preferences-component-pass.png`, `/tmp/plexus-settings-light-component-pass.png`, `/tmp/plexus-reports-light-chart-fixed.png`.
  - [DEFERRED-VERIFY] Electron smoke for timer start/stop UI state where possible.

## UX Review Section

Completed the second component pass on 2026-06-14:

- Added shared console primitives in `src/renderer/theme.css` for command cards, state-aware flow cards, section bands, form grids, report toolbars, and responsive admin/report splits.
- Converted Admin Demo identities and onboarding emulation to command/flow cards so admin, employee, completed, deferred, skipped, and failed states are visually distinct.
- Converted the employee Onboarding screen to the same flow-card system so admin emulation and real employee onboarding share one state model.
- Reworked Preferences into section bands with top and bottom save actions.
- Reworked Settings into Account, TeamForge Connection, Appearance, and Agent Fabric modules; Worker URL/workspace changes now use an explicit Save Connection button instead of hidden on-blur persistence.
- Reworked Reports around a composed toolbar, summary panel, visual breakdown panel, and split project/daily detail panels.
- Fixed `TimeChart` SVG labels/strokes to use theme tokens so Reports remains readable in light mode.

---

# Plexus OTA Updates + Release Workflow Plan

Updated: 2026-06-14T17:45:00Z

## Goal

Wire Plexus for real Electron OTA updates from Settings and make the release workflow ready for signed, notarized macOS artifacts once the GitHub secrets are added. OTA must not be a visual placeholder: the app should check the configured feed, expose update state through IPC, let the user download when an update is available, and only restart/install after explicit user action.

## Findings

- `electron-updater` is not installed yet.
- Current packaging emits only a macOS DMG; macOS auto-update also needs a ZIP artifact and `latest-mac.yml` metadata.
- `scripts/notarize.cjs` already supports Apple Developer ID notarization through `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.
- GitHub Actions currently runs CI builds only. There is no release workflow that signs, notarizes, and uploads OTA artifacts.
- Settings has a real composed component surface now, so OTA belongs there as an operational update panel.

## Implementation Checklist

- [x] Add the required Electron OTA dependency.
- [x] Configure `electron-builder` for OTA-compatible macOS artifacts:
  - [x] DMG for first install.
  - [x] ZIP for auto-update.
  - [x] Generic publish metadata for a Cloudflare R2/custom-domain feed.
- [x] Add main-process update service:
  - [x] Initialize safely only for packaged builds unless forced for verification.
  - [x] Track disabled, idle, checking, available, unavailable, downloading, downloaded, and error states.
  - [x] Disable automatic download/install; require explicit Settings actions.
  - [x] Broadcast update status changes to the renderer.
- [x] Add typed preload IPC:
  - [x] Get update status.
  - [x] Check for updates.
  - [x] Download update.
  - [x] Install and restart.
  - [x] Subscribe/unsubscribe to update status events.
- [x] Add Settings OTA panel with meaningful status and actions.
- [x] Add GitHub release workflow for signed/notarized macOS release artifacts and R2 OTA upload.
- [x] Document required GitHub secrets and manual release steps.
- [x] Verify:
  - [x] `npm run typecheck`
  - [x] `npm run build:main`
  - [x] `npm run build:preload`
  - [x] `npx vite build`
  - [x] Release dry-run command with signing/notarization disabled.

## Review Section

Implemented locally on 2026-06-14:

- Added `electron-updater` as a runtime dependency.
- Added `src/main/updates.ts` and IPC/preload bindings for update status, check, download, install, and status subscriptions.
- Settings now includes an OTA Updates panel with current version, channel, feed, update state, download progress, and explicit Check / Download / Install + Restart actions.
- `electron-builder` now emits macOS DMG + ZIP artifacts, blockmaps, and `latest-mac.yml` for generic OTA hosting. The current production feed is `https://plexus-upgrade.thoughtseed.space/plexus`.
- Added `.github/workflows/release.yml` for signed/notarized macOS release builds, workflow artifacts, tagged GitHub release uploads, and optional R2 OTA feed upload.
- Added `docs/OTA_RELEASE.md` and updated `docs/ROADMAP.md`, `docs/HANDOFF.md`, and `docs/APPLE_SIGNING.md`.

Verification passed:

- `npm run typecheck`
- `npm run build:main`
- `npm run build:preload`
- `npx vite build` completed with the existing parent Astro tsconfig warning.
- `npm run release:dry-run` completed with signing/notarization disabled.
- Dry-run artifacts created: `release/Plexus-0.2.0-mac-arm64.dmg`, `release/Plexus-0.2.0-mac-arm64.zip`, both blockmaps, and `release/latest-mac.yml`.
- `git diff --check`

Remaining external proof:

- Add GitHub Apple signing secrets.
- Add Cloudflare R2 OTA secrets.
- Run the Release workflow from a tag or manual dispatch.
- Confirm `https://updates.thoughtseed.space/plexus/latest-mac.yml` serves the uploaded metadata.
- Check for updates from a signed packaged Plexus build.

2026-06-15 external gate check:

- `gh auth status` is valid for `Sheshiyer`.
- `gh secret list --repo Sheshiyer/plexus-ts` returned no configured secrets.
- Required secret values were not present in the local shell environment, so they could not be set safely.
- `gh workflow list --repo Sheshiyer/plexus-ts` shows only `CI`; the new Release workflow still needs to be committed and pushed/merged before it can run on GitHub.
- `https://updates.thoughtseed.space/plexus/latest-mac.yml` returned `404` with `x-vercel-error: DEPLOYMENT_NOT_FOUND`, so the R2/custom-domain feed is not serving OTA metadata yet.

2026-06-15 `.claude/.env` follow-up:

- `/Users/sheshnarayaniyer/.claude/.env` exists; repo-local `.env` and `.claude/.env` do not exist.
- Set GitHub Actions secrets from exact or verified local values:
  - `APPLE_APP_SPECIFIC_PASSWORD` from `.claude/.env`
  - `CSC_KEY_PASSWORD` from `PLEXUS_P12_SIGNING_KEY_PW`
  - `R2_ACCOUNT_ID` from `CF_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID` from `ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY` from `SECRET_ACCESS_KEY`
  - `R2_BUCKET=teamforge-artifacts` after `wrangler r2 bucket list` confirmed the bucket exists
  - `APPLE_TEAM_ID=BS6SZR4929` from the local `Developer ID Application: Thoughtseed Private Limited` codesigning identity
- Did not set `APPLE_ID`; no exact value was present in `.claude/.env`.
- Did not set `CSC_LINK`; `ACCESS_KEY_P12` was not a valid absolute path, `base64:` value, or detected local `.p12` file, and automatically exporting from the keychain would include more identities than the Thoughtseed Developer ID certificate.
- `gh secret list --repo Sheshiyer/plexus-ts` now shows seven configured secrets. Remaining secrets before Release can pass: `APPLE_ID`, `CSC_LINK`.

2026-06-15 completion follow-up:

- Set `APPLE_ID=magenarayan@icloud.com`.
- Found `/Users/sheshnarayaniyer/Downloads/plexus.p12`.
- Validated `plexus.p12` with the password from `PLEXUS_P12_SIGNING_KEY_PW`; the file uses legacy PKCS#12 encryption, so validation required OpenSSL `-legacy`.
- Set `CSC_LINK` as raw base64 from the validated `plexus.p12`; the `base64:` prefix produced a non-P12 blob for this electron-builder/GitHub setup.
- Created R2 bucket `plexus-updates`.
- Updated GitHub `R2_BUCKET` secret from `teamforge-artifacts` to `plexus-updates` to keep Plexus OTA artifacts separate from TeamForge artifacts.
- `gh secret list --repo Sheshiyer/plexus-ts` now shows all nine release secrets configured.
- `wrangler r2 bucket info plexus-updates` confirms the bucket exists and is empty.
- Custom-domain attach is still blocked by Cloudflare zone access: the `.claude/.env` `CF_API_TOKEN` lists zero zones for the configured account, and Wrangler requires the `thoughtseed.space` zone ID to attach `updates.thoughtseed.space` to the R2 bucket.
- First Release workflow run with raw-base64 `CSC_LINK` passed signed artifact build, proving Apple signing/notarization wiring now works. It failed at R2 upload because macOS GitHub runners reject direct `pip install --user awscli` under PEP 668; workflow patched to install AWS CLI in a temporary virtualenv.

2026-06-15 release workflow proof:

- Release workflow run `27511585576` passed from manual dispatch on `main`: https://github.com/Sheshiyer/plexus-ts/actions/runs/27511585576.
- The previous R2 upload failure was caused by using the uppercase `.claude/.env` S3 pair (`ACCESS_KEY_ID` / `SECRET_ACCESS_KEY`), which returned `SignatureDoesNotMatch` locally and in GitHub Actions.
- Reset GitHub `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` from the working mixed-case `.claude/.env` pair (`Access_Key_ID` / `Secret_Access_Key`).
- R2 now contains `plexus/latest-mac.yml`, `Plexus-0.2.0-mac-arm64.zip`, `Plexus-0.2.0-mac-arm64.dmg`, and both blockmaps in bucket `plexus-updates`.
- Downloaded `s3://plexus-updates/plexus/latest-mac.yml` locally and confirmed it advertises version `0.2.0` with ZIP + DMG files and SHA-512 hashes.
- `https://updates.thoughtseed.space/plexus/latest-mac.yml` still returns Vercel `DEPLOYMENT_NOT_FOUND`; the OTA feed is uploaded correctly, but the public custom domain is not routed to R2.
- Enabled temporary R2 public dev URL for verification: `https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus/latest-mac.yml` returns `200 OK`.
- Downloaded the signed workflow artifact, unpacked `Plexus-0.2.0-mac-arm64.zip`, and verified the extracted app with `codesign --verify --deep --strict`.
- `codesign -dv` shows Developer ID `Thoughtseed Private Limited (BS6SZR4929)` and a stapled notarization ticket; `spctl --assess --type execute` accepts the app as `Notarized Developer ID`.
- Launched the signed packaged app with `PLEXUS_UPDATE_FEED_URL=https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus` and drove the real Settings OTA Check button through the renderer.
- Packaged update check succeeded: the OTA panel reported `Plexus is up to date`, state `not-available`, current version `0.2.0`, channel `latest`, feed `https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus`.

2026-06-15 production feed domain follow-up:

- Connected R2 custom domain `plexus-upgrade.thoughtseed.space` to bucket `plexus-updates` from the Cloudflare dashboard.
- Verified `https://plexus-upgrade.thoughtseed.space/plexus/latest-mac.yml` returns `200 OK` and serves the version `0.2.0` update metadata from R2.
- `https://updates.thoughtseed.space/plexus/latest-mac.yml` still returns Vercel `DEPLOYMENT_NOT_FOUND`; Plexus defaults now target `https://plexus-upgrade.thoughtseed.space/plexus` instead.
- Release workflow run `27514257223` passed from commit `ab3ac46` and uploaded final artifacts to R2: https://github.com/Sheshiyer/plexus-ts/actions/runs/27514257223.
- Final signed package has `app-update.yml` set to `https://plexus-upgrade.thoughtseed.space/plexus`; `codesign --verify --deep --strict` passed, `spctl --assess --type execute` accepted the app as `Notarized Developer ID`, and ZIP/DMG hashes matched `latest-mac.yml`.
- Launched the final signed package without `PLEXUS_UPDATE_FEED_URL`; Settings showed feed `https://plexus-upgrade.thoughtseed.space/plexus` and the real OTA Check action returned `Plexus is up to date`, state `not-available`.

## Timer Dock + Pause/Resume Pass

Plan:

- [x] Add persisted timer pause/progress fields to local `time_entries`.
- [x] Centralize timer active-duration math so stop, tray, shortcuts, idle, API, and renderer agree.
- [x] Add IPC/preload/shared APIs for pause and resume.
- [x] Make the Timer view expand while idle and collapse into a docked compact control while active.
- [x] Add active-session progress, target duration, pause/resume controls, and paused state copy.
- [x] Verify typecheck, main/preload builds, renderer build, and a local Electron smoke path.

Review:

- Added `target_seconds`, `paused_at`, and `paused_seconds` migrations plus pause-aware timer helpers.
- Wired stop/pause/resume through main IPC, preload, tray, shortcut, idle handling, and the local agent API.
- Timer UI now stays expanded while idle, collapses into a compact active dock while running, shows target progress, and exposes Pause/Resume/Stop for long sessions.
- Verified `npm run typecheck`, `npm run build:main`, `npm run build:preload`, and `npx vite build`.
- Smoke tested Electron with a temporary seeded profile at `/tmp/plexus-smoke-home`: active dock rendered, Pause switched to Resume, Resume returned to live state, Stop expanded the idle timer again, and the disposable DB row completed with `paused_at` cleared.

---

# Plexus Realtime Workspace Issue Plan

Updated: 2026-06-15

## Goal

Replace the remaining external meeting/project SaaS gap with a native Plexus realtime workspace: project rooms, presence, audio/video calls, multi-person screen sharing, meeting/activity records, explicit time-log/project links, and Paperclip-compatible meeting memory. Transcription is intentionally deferred to the final follow-up phase and is not required for this implementation pass.

## Discovery Summary

- Planning depth: standard issue batch, not full 80-task swarm expansion.
- Delivery mode: production-oriented phased rollout.
- Release model: Phase 14 contract-first implementation, Phase 15 deferred transcription.
- CI/CD expectation: existing Plexus and Worker build/typecheck gates.
- Quality bar: email-only Cloudflare Access identity, Worker/D1 canonical state, no device secrets, explicit call/screen-share consent, visible failure states.
- Agent topology: Claude/orchestrator for contracts and GitHub sync, Copilot/cloud for Worker/Cloudflare/D1, Codex/UI for Electron/Plexus surfaces, Gemini/validation for regression pack.

## Phase 14 Issue Map

- [x] RW-001 / #13: Freeze realtime workspace product and room contracts - https://github.com/Sheshiyer/plexus-ts/issues/13
- [x] RW-002 / #14: Decide Cloudflare Realtime integration path and environment contract - https://github.com/Sheshiyer/plexus-ts/issues/14
- [x] RW-003 / #15: Design D1 schema and Worker API for rooms, sessions, participants, and tracks - https://github.com/Sheshiyer/plexus-ts/issues/15
- [x] RW-004 / #16: Prototype Electron media permissions and capture capability matrix - https://github.com/Sheshiyer/plexus-ts/issues/16
- [x] RW-005 / #17: Implement Worker realtime room and session broker - https://github.com/Sheshiyer/plexus-ts/issues/17
- [x] RW-006 / #18: Build project room lobby, presence, and join flow in Plexus - https://github.com/Sheshiyer/plexus-ts/issues/18
- [x] RW-007 / #19: Implement audio/video call controls and participant grid - https://github.com/Sheshiyer/plexus-ts/issues/19
- [x] RW-008 / #20: Add multi-person screen sharing tracks and layout states - https://github.com/Sheshiyer/plexus-ts/issues/20
- [x] RW-009 / #21: Link meetings to projects, issues, activity, and time logs - https://github.com/Sheshiyer/plexus-ts/issues/21
- [ ] RW-010 / #22: Feed non-transcript meeting memory into Paperclip agents - https://github.com/Sheshiyer/plexus-ts/issues/22
- [ ] RW-011 / #23: Privacy, permission, and audit hardening for realtime rooms - https://github.com/Sheshiyer/plexus-ts/issues/23
- [ ] RW-012 / #24: End-to-end realtime workspace smoke and regression pack - https://github.com/Sheshiyer/plexus-ts/issues/24

## Deferred Phase 15

- [ ] RW-013 / #25: Deferred self-hosted transcription agent and summary pipeline - https://github.com/Sheshiyer/plexus-ts/issues/25

## Dependency Notes

- RW-001 through RW-004 supplied the contract and local media proof.
- RW-005 through RW-009 are implemented locally across Plexus and the TeamForge Worker.
- RW-010 remains open for actual Paperclip ingestion of the queued non-transcript meeting payload.
- RW-011 and RW-012 are Wave 3 hardening/validation work and should not begin until the room, media, screen-share, and meeting-memory surfaces exist.
- RW-013 remains Phase 15/backlog. Phase 14 should leave clean transcript-reference fields where useful, but must not implement speech-to-text, recording ingestion, or automatic summaries.

## Verification Strategy

- Contract wave: human review of product, Cloudflare/env, and Worker/D1 contracts before implementation.
- Backend wave: Worker typecheck/tests, D1 migration replay, unauthenticated fail-closed smoke, role/project visibility checks.
- UI wave: Plexus typecheck, main/preload builds, renderer build, desktop screenshots for room/presence/call/screen-share states, local permission-denial smoke.
- Integration wave: two-participant or documented local simulation path, multi-screen-share layout proof, meeting closeout artifact proof, Paperclip handoff sample, residual-risk notes.

## Review Section

- Created GitHub milestone `Plexus Realtime Workspace`.
- Created label family for phase, wave, swarm, realtime area, and status tracking.
- Created issues #13 through #25 in `Sheshiyer/plexus-ts`.
- Kept transcription as a final deferred issue (#25), not part of the current build pass.
- RW-001 implementation started on branch `swarm/realtime/p14-w1/contracts/RW-001-claude`.
- Added `docs/REALTIME_WORKSPACE_CONTRACT.md` with the room, presence, call session, participant, media track, multi-screen-share, meeting record, consent, authorization, failure-state, and transcription-deferral contract.
- Updated `docs/ROADMAP.md` and `docs/HANDOFF.md` to route external meeting/project SaaS replacement through Phase 14 realtime workspace and keep transcription deferred to Phase 15.
- RW-001 remains open until human signoff confirms the contract can unblock RW-003, RW-005, and RW-006.
- Human signoff received for RW-001.
- Added `docs/REALTIME_CLOUDFLARE_DECISION.md` choosing lower-level Cloudflare Realtime SFU over RealtimeKit UI for Phase 14, with server-side env/secret boundaries and STUN/connectivity assumptions.
- Added `docs/REALTIME_WORKER_API_CONTRACT.md` defining additive D1 tables, route shapes, authorization matrix, failure states, and response type names for rooms, calls, participants, tracks, events, and meeting records.
- Added `docs/REALTIME_ELECTRON_CAPTURE_PROOF.md` and a first-class Plexus `Realtime` tab.
- Added `MediaCaptureStatus` shared types, preload IPC methods, main-process Electron media probes, and `RealtimeCapturePanel`.
- Verification passed: `npm run typecheck`, `npm run build:main`, `npm run build:preload`, `npx vite build`, `git diff --check`, and a brief `npm run dev` boot smoke.
- Wave 1 is now in review. RW-005 through RW-009 remain the next build batch after review.
- RW-005 through RW-009 implementation added a TeamForge Worker migration `0011_realtime_workspace.sql`, realtime route module, route registration, env keys for server-side Cloudflare Realtime broker credentials, and Worker route tests.
- Plexus now exposes Worker-backed realtime room list/detail, join, track publish/close, leave/end, and meeting closeout IPC methods through `window.plexus`.
- `RealtimeCapturePanel` is now the room/call workspace surface: project room lobby, join state, mic/camera controls, participant grid, multi-screen-share local publishers, and manual closeout with time entry, issue ID, decisions/action-item, and Paperclip queue fields.
- Transcription remains deferred: Worker meeting records explicitly keep `transcript_ref` and `recording_ref` null in this pass.
- Verification passed for the RW-005 through RW-009 batch: Worker `pnpm exec tsc -p tsconfig.json --noEmit`, Worker `pnpm test` (12 files, 74 tests), Plexus `npm run typecheck`, `npm run build:main`, `npm run build:preload`, and `npx vite build`.

---

# Plexus 0.3.0 Release / OTA Upgrade Plan

Updated: 2026-06-15

## Goal

Cut the next Plexus version as `0.3.0`, with realtime workspace as the release train. The release must not depend on Slack or Huly integrations. Worker realtime routes must be deployed or the Realtime tab must be intentionally gated before the app feed is published. OTA proof must demonstrate an actual upgrade from signed `0.2.0` to signed `0.3.0`, not only an up-to-date check.

## Implementation Checklist

- [x] Confirm version target: `0.3.0`.
- [x] Mark Phase 5 OTA foundation as complete in release docs using the existing signed/notarized v0.2.0 and R2 custom-domain proof.
- [x] Bump Plexus version metadata to `0.3.0`.
- [x] Add `0.3.0` changelog/release-gate notes for realtime workspace and OTA upgrade proof.
- [ ] Re-run Plexus local gates after version/docs changes:
  - [x] `npm run typecheck`
  - [x] `npm run build:main`
  - [x] `npm run build:preload`
  - [x] `npx vite build`
  - [x] `git diff --check`
- [ ] Re-run TeamForge Worker realtime gates:
  - [x] `pnpm exec tsc -p tsconfig.json --noEmit`
  - [x] `pnpm test`
  - [x] migration/deploy readiness check for `0011_realtime_workspace.sql`
- [x] Commit the Plexus `0.3.0` realtime/release candidate changes.
- [x] Commit the TeamForge Worker realtime broker changes without unrelated `.codegraph/` output.
- [x] Deploy the TeamForge Worker realtime migration/routes, or explicitly gate the Realtime tab before app release.
- [ ] Run the Release workflow/tag for `v0.3.0`.
- [ ] Confirm R2 feed contains `Plexus-0.3.0-mac-arm64.zip`, DMG, blockmaps, and `latest-mac.yml` advertising `0.3.0`.
- [ ] Prove true OTA upgrade:
  - [ ] Install signed `0.2.0`.
  - [ ] Check for update against `https://plexus-upgrade.thoughtseed.space/plexus`.
  - [ ] Confirm `0.3.0` is available.
  - [ ] Download update.
  - [ ] Install + Restart.
  - [ ] Confirm relaunched app reports `0.3.0`.

## Review Section

- 2026-06-15: User approved `0.3.0` and yes to release docs, workflow, OTA proof, and Worker-first release gating.
- 2026-06-15: Updated `package.json`, `package-lock.json`, `CHANGELOG.md`, `docs/OTA_RELEASE.md`, `docs/ROADMAP.md`, and `docs/HANDOFF.md` for the `0.3.0` release train.
- 2026-06-15: Plexus local release-candidate gates passed: `npm run typecheck`, `npm run build:main`, `npm run build:preload`, `npx vite build` with the known parent Astro tsconfig warning, and `git diff --check`.
- 2026-06-15: TeamForge Worker gates passed: `pnpm exec tsc -p tsconfig.json --noEmit`, `pnpm test` (10 files, 70 tests), remote migration list shows `0011_realtime_workspace.sql` pending as expected, `wrangler deploy --dry-run` bundled successfully with the known parent Astro tsconfig warning, and `git diff --check`.
- 2026-06-15: TeamForge Worker realtime broker committed as `07def02` on `feat/hermes-cambium-wiring`; `.codegraph/` was left untracked.
- 2026-06-15: TeamForge `main` pushed to `3b6b3fb`; remote D1 migration `0011_realtime_workspace.sql` applied successfully; Worker deployed as version `9db2e34e-afbd-48e9-b506-a8bfe51078c3` to workers.dev, `forge.thoughtseed.space`, and `plexus-api.thoughtseed.space`.
- 2026-06-15: Post-deploy smoke passed: `https://plexus-api.thoughtseed.space/healthz` returned `200`, workers.dev `/v1/realtime/rooms` returned `401 access_identity_required`, and `wrangler d1 migrations list TEAMFORGE_DB --remote` reported no pending migrations.
