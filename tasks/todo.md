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
- `electron-builder` now emits macOS DMG + ZIP artifacts, blockmaps, and `latest-mac.yml` for generic OTA hosting at `https://updates.thoughtseed.space/plexus`.
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
- Set `CSC_LINK` as a `base64:` value from the validated `plexus.p12`.
- Created R2 bucket `plexus-updates`.
- Updated GitHub `R2_BUCKET` secret from `teamforge-artifacts` to `plexus-updates` to keep Plexus OTA artifacts separate from TeamForge artifacts.
- `gh secret list --repo Sheshiyer/plexus-ts` now shows all nine release secrets configured.
- `wrangler r2 bucket info plexus-updates` confirms the bucket exists and is empty.
- Custom-domain attach is still blocked by Cloudflare zone access: the `.claude/.env` `CF_API_TOKEN` lists zero zones for the configured account, and Wrangler requires the `thoughtseed.space` zone ID to attach `updates.thoughtseed.space` to the R2 bucket.
