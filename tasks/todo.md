# Plexus — Open Work

Updated: 2026-06-19

## Current version

Released: `0.4.0` — published and live in the OTA feed after the co-working page landed.
Local package: `0.4.1` patch prep — do not re-ship this work as `0.4.0`; the next OTA should be `v0.4.1` after local checks, commit, tag, and signed OTA proof pass.

## Active execution batch

- [x] Bump package and lockfile to `0.4.1`.
- [x] Make `npm run lint` executable with ESLint flat config.
- [x] Add lint and no-placeholder gates to CI and Release workflows.
- [x] Add `0.4.1` patch release notes and OTA gate.
- [x] Remove normal Settings access to legacy Worker URL / workspace / bearer-token editing.
- [x] Add a Settings session proof surface for Cloudflare Access role, workspace, visibility, onboarding, and Worker reachability.
- [x] Patch Plexus sign-out to clear the Electron `persist:tfaccess` Cloudflare Access cookie, not only local `tf.session` / `tf.accessJwt`.
- [x] Preserve the deferred live proof gates: fresh OTP, role-aware `/v1/whoami`, admin demo read, onboarding write, realtime E2E, and command-loop E2E.
- [x] Re-run Plexus typecheck after Settings changes.

## Co-working exit / leave hardening plan

Status: added 2026-06-18 after review of local `0.4.0` WIP co-working surface.

Current implementation review:
- `CoWorkingPanel` has three feature zones: today's floor presence, project room cards, and the ambient lounge.
- Ambient lounge joins are tracked in `loungeJoin`; the UI exposes two leave affordances: the page header `LEAVE LOUNGE` button and the strip close icon.
- Lounge leave stops local mic/camera tracks, closes `RealtimeSession`, clears remote stream refs, calls `realtimeLeaveCall`, and clears `loungeJoin`.
- Project room drop-ins call `realtimeJoinRoom` from both room cards and floor avatars, but the join response is not retained. After entry, the app cannot render "entered room" state, cannot leave that room, and cannot clean up the participant on navigation/unmount.
- The unmount cleanup stops local tracks and closes the SFU session, but it does not call `realtimeLeaveCall`; a joined lounge or project-room participant can remain server-live if the user switches tabs, closes the app, signs out, or reloads.

Required user stories:
- As a member who joins the ambient lounge, I can leave from the header or lounge strip and immediately see idle lounge state.
- As a member who drops into a project room with `+ DROP IN`, I can see that I am in that room and leave it without joining another room first.
- As a member who clicks a floor avatar to enter someone else's room, I get the same visible room state and leave affordance as the room card path.
- As a member who joins an active project voice call, I can leave the project voice call separately from the ambient lounge.
- As a member already in the lounge who enters a project room, the app either leaves the lounge first or presents a clear single-active-room transition. No hidden double-presence.
- As a member already in a project room who joins the lounge, the app either leaves the project room first or presents a clear single-active-room transition. No hidden double-presence.
- As a member who navigates away from Co-working, signs out, refreshes session, or closes the app window, the app should attempt best-effort leave for every locally joined call before renderer teardown completes.

Implementation tasks:
- [x] Introduce a shared local join registry in `CoWorkingPanel`, e.g. `activeJoins`, keyed by room id or by explicit scope (`lounge`, `project_room`), storing `RealtimeJoinResponse`, room name, room type, and whether a local `RealtimeSession` exists.
- [x] Replace `loungeJoin`-only state with derived `inLounge` from the registry while preserving the lounge-specific SFU media controls.
- [x] Retain successful project room `realtimeJoinRoom` responses from `dropInToRoom` and render per-room active state: CTA changes from `+ DROP IN` / `+ JOIN VOICE` to `LEAVE`, with disabled/busy state while leaving.
- [x] Add a project-room leave action that calls `realtimeLeaveCall(join.call.id, join.participant.id)`, clears the registry entry, refreshes floor and rooms, and surfaces success/error status.
- [x] Add a guarded transition helper for single-active-room policy: before joining a different room, leave the existing local join or block with a visible error if leave fails.
- [x] Extend cleanup on unmount to best-effort leave all active registry entries, then stop local tracks and close any `RealtimeSession` refs.
- [x] Handle sign-out/session refresh edges by ensuring `CoWorkingPanel` cleanup runs when the panel unmounts and by not leaving stale `activeJoins` after Access/session errors.
- [x] Keep room actions idempotent: if Worker says a participant already left, clear local state and refresh rather than trapping the user.

Edge cases to verify:
- Join lounge, enable mic, leave lounge: mic track stops, `realtimeLeaveCall` is called once, UI returns to `JOIN LOUNGE`.
- Join lounge, enable camera, switch away from Co-working: camera track stops and best-effort leave is attempted.
- Join empty project room via card: card becomes active for the current member and exposes `LEAVE`.
- Join active project voice room via card: leave path clears participant without affecting unrelated lounge members.
- Join project room via floor avatar: same active card state and leave affordance appears.
- Join lounge, then project room: no hidden double-presence remains after the transition.
- Join project room, then lounge: no hidden double-presence remains after the transition.
- Leave failure or network loss: UI shows error, leaves the local escape hatch enabled, and a later successful retry clears state.
- Poll refresh while joined: active local state is not erased just because rooms/floor reload.
- Worker returns no lounge room: lounge join remains disabled and project-room leave behavior still works.

Verification gates:
- [x] `npm run typecheck`
- [x] Manual renderer smoke for lounge join/leave and project drop-in/leave (`renderer-coworking-smoke.json`).
- [x] Worker/API proof that `/v1/realtime/calls/:callId/leave` receives the retained `participant.id` (`realtime-leave-proof.json`).
- [x] Regression note added to Phase 14 #24 realtime workspace smoke.

## Final `0.4.0` app polish plan

Status: added 2026-06-18 after full renderer page review.

Global shell:
- [x] Add a sidebar app identity badge above the navigation stack: Greek muse `Clio` plus the package app version.
- [x] Source the displayed version from `package.json` at Vite build time so the sidebar follows release bumps.
- [x] Screenshot sidebar expanded and collapsed to confirm the badge does not crowd Timer, Onboarding, or the today total.
- [x] Decide whether the top HUD should also replace the fallback `v0.1.0` copy with the same package version when no session exists.

Page review:
- Timer: primary workflow is healthy: project select, target duration, start/pause/resume/stop, today's entries, and Agent Activity Hub. Final polish should keep all timer controls reachable when the session is active and ensure no status chip text wraps in the docked layout.
- Entries: supports date range review, manual entry creation, and delete. Final polish should add busy/error feedback for create/delete and validate end time after start time.
- Projects: sync-only TeamForge project cache is intentionally simple. Final polish should make sync failure visually rose instead of neutral tertiary copy.
- Reports: daily/weekly/monthly modes, KPI bar, chart, project breakdown, and daily detail are present. Final polish should keep KPI errors visible even when stale KPI data exists.
- Export: CSV/JSON downloads work from local entry data. Final polish should show empty export results before download and guard invalid date ranges.
- Fabric: ports, agent health, standup/KPI, install status, bridge/vault, shell output, and repair are present. Final polish should avoid duplicate probes between Timer Activity Hub and Fabric when both are active.
- Co-working: presence floor, project rooms, and lounge are present. Final blocker is the exit/leave hardening plan above.
- Backups: list, manual backup, restore confirmation, and refresh are present. Final polish should show the selected restore filename in the modal.
- Preferences: focus, working hours, referral, cadence, visibility, notes, and save are present. Final polish should warn on unsaved changes before navigating away.
- Onboarding: session contract, Paperclip pre-flight, real onboarding state actions, media permissions, and continue are present. Final polish should keep required vs optional completion obvious after failures.
- Admin: overview, project tokens, identity selection, and employee onboarding emulation are present. Final polish should add a clearer read-only/admin-safe banner before write buttons.
- Settings: account proof, session proof, appearance, OTA, and provisioning are present. Final polish should surface the local app version beside OTA current version for easier release QA.

Final execution order:
- [x] Batch 1: implement co-working exit registry, project-room leave buttons, single-active-room transition, and best-effort cleanup.
- [x] Batch 2: apply low-risk page polish from this review: Entries validation/errors, Export invalid-range/empty state, Projects sync error tone, Backup restore filename, Settings local version display.
- [x] Batch 3: run `npm run typecheck`, launch dev app, capture screenshots for expanded/collapsed sidebar plus Timer, Co-working, Settings, and one data-heavy page.
- [x] Batch 4: update Phase 14 #24 regression notes and release checklist for `0.4.0` OTA proof.

Runtime evidence captured in `docs/evidence/2026-06-18-plexus-0.4.0/`:
- `dev-app-plexus-window.png`
- `dev-app-plexus-collapsed.png`
- `dev-app-coworking.png`
- `dev-app-coworking-renderer-joined.png`
- `dev-app-settings.png`
- `dev-app-projects.png`
- `renderer-coworking-smoke.json`
- `realtime-leave-proof.json`

Runtime finding fixed: the dev app previously let Vite fall forward from port `5173` to `5174` while Electron still hardcoded `5173`, so Electron could point at another local app. `npm run dev` now uses strict `127.0.0.1:5173`, and the main process supports `PLEXUS_DEV_SERVER_URL` for explicit smoke-test ports.

## Pre-patch local closure

Status: added 2026-06-19 before preparing the next patch release.

Lessons applied:
- Auth success is not product readiness: keep fresh installed-app OTP proof open until the whole Access JWT -> Worker `/v1/whoami` -> stored Plexus session chain is captured from the installed BrowserWindow.
- Onboarding and closeout state must be real state: co-working closeout now calls the existing Worker closeout route instead of creating local-only notes.
- Settings controls must have visible effect: mic, speaker, and camera selectors enumerate system devices and remote lounge audio uses the selected output where the renderer supports `setSinkId`.
- Component references must survive implementation: new closeout controls use shared modal, field, input, textarea, button, and badge primitives.
- Slack and Huly remain dependencies to retire: no new external SaaS integration scope was added to the realtime patch.

Local tasks:
- [x] Wire Co-working project-room and lounge closeout actions to `window.plexus.realtimeCloseout`.
- [x] Add explicit Paperclip handoff choice in the closeout modal so non-transcript meeting memory is a visible user action.
- [x] Require notes, decisions, or action items before saving a closeout; no empty meeting artifact is sent.
- [x] Add lounge privacy/state chips for audit, no recording, no transcript, and visible local screen-share publisher identity.
- [x] Publish mic, camera, and screen track labels with the participant display name for Worker audit/screen-share attribution.
- [x] Keep the open GitHub issues split between local app work and external/live-proof blockers.

## App-wide modular resilience plan

Status: added 2026-06-19 after reviewing the app from splash/login through Settings/logout.

Review artifact: [`docs/APP_RESILIENCE_REVIEW.md`](../docs/APP_RESILIENCE_REVIEW.md)

Goal: Plexus becomes the team's coordination workspace without letting any optional subsystem stop core work. Paperclip offline, model quota exceeded, Worker refresh failure, OTA failure, or realtime media negotiation failure should degrade one card, handoff, or page, not the whole app.

Release-blocking user stories:
- [ ] Launch/splash can be skipped and cannot trap the user before login/session state.
- [ ] Login only counts as proven when Cloudflare Access JWT -> Worker `/v1/whoami` -> stored Plexus session -> real app route succeeds.
- [ ] Timer start/pause/resume/stop works from local state even when Paperclip, model-backed Fabric, standup sync, or Worker refresh is down.
- [ ] Timer stop saves the local time entry before any Paperclip, standup, Worker, or activity-hub side effect runs.
- [ ] Entries, Reports, Export, Backups, Settings, and Logout remain reachable when any one page-level dependency fails.
- [ ] Project sync failure keeps the existing local project cache instead of turning Timer/Entries/Reports into empty or misleading states.
- [ ] Reports render local entry analytics when Worker KPI refresh fails and show stale/error status for KPI only.
- [ ] Preferences save failure keeps the typed draft, shows a retryable error, and warns before navigation if dirty.
- [ ] Paperclip offline or AI model rate limit degrades Fabric/hand-off status only; it does not block Timer, Co-working, Entries, Reports, Export, Settings, or Logout.
- [ ] Meeting closeout saves the meeting record independently from Paperclip handoff and exposes queued/sent/failed/retry status.
- [ ] Standup generation/sync failure after timer work records a retryable Fabric/standup failure instead of blocking or losing the local time entry.
- [ ] Co-working leave, media cleanup, and logout remain available during SFU negotiation, media permission, closeout, or Paperclip handoff failures.
- [ ] Admin Workspace failure stays scoped to Admin and never affects personal Timer, Co-working, Reports, Settings, or Logout.
- [ ] OTA check/download/install errors stay scoped to the Settings update card and do not affect auth, timer, local data, or backup controls.

Implementation batches:
- [x] Batch A: add shared renderer resilience primitives for last-good data, scoped errors, retries, and busy state.
- [x] Batch B: add a shared handoff status model for queued/sent/failed/retry/skipped across Paperclip, standup, closeout, preferences, and project sync.
- [x] Batch C: harden local-first Timer/Entries/Reports/Export flows so optional integrations run after local persistence.
- [x] Batch D: make Co-working closeout, Paperclip handoff, standup sync, and preferences save retryable instead of one-shot modal/page failures.
- [x] Batch E: add logout/session teardown for realtime joins and local media as a shared path, not only a page unmount side effect.
- [ ] Batch F: add smoke coverage for Paperclip offline, model quota exceeded, Worker offline, expired Access session, denied media permission, SFU negotiation failure, closeout handoff failure, and logout during active room.

Batch A-E implementation evidence:
- Shared types and persistence: `HandoffRecord`, `HandoffStatus`, `handoffs` SQLite table, `handoff:list`, `handoff:record`, and `handoff:retry`.
- Renderer primitives: `src/renderer/lib/resilience.tsx` plus shared styles in `theme.css`.
- Fabric retry queue: Agent Fabric now lists failed/pending handoffs and can retry supported kinds.
- Local-first core flows: Timer/Entries/Projects/Reports/Preferences expose scoped degraded states and preserve last-good/draft state.
- Realtime/logout safety: Settings dispatches session teardown; Co-working listens and best-effort leaves active joins while stopping local tracks.
- Verification so far: `npm run typecheck` and `git diff --check` pass after implementation.

## Remaining GitHub issues (4)

### Phase 14 Wave 3 — Realtime hardening

- [ ] [#26 RW-014](https://github.com/Sheshiyer/plexus-ts/issues/26) — Wire Cloudflare Realtime SFU for live media transport (P1, webrtc) — **client-side WebRTC session manager landed, needs CF credentials + E2E test**
- [ ] [#22 RW-010](https://github.com/Sheshiyer/plexus-ts/issues/22) — Feed non-transcript meeting memory into Paperclip agents (P2, data) — **local closeout UI is wired; keep open until a live Worker/Paperclip artifact proof is captured**
- [ ] [#23 RW-011](https://github.com/Sheshiyer/plexus-ts/issues/23) — Privacy, permission, and audit hardening for realtime rooms (P0, security) — **local indicators/attribution landed; keep open until unauthorized join fail-closed and Worker audit records are proven**
- [ ] [#24 RW-012](https://github.com/Sheshiyer/plexus-ts/issues/24) — E2E realtime workspace smoke and regression pack (P1, qa) — **local regression matrix is updated; keep open until two-participant or documented simulation proof is attached**

### Phase 15 — Deferred

- [ ] [#25 RW-013](https://github.com/Sheshiyer/plexus-ts/issues/25) — Self-hosted transcription agent and summary pipeline (P4, deferred)

## Deferred verifications (from Phase 13)

The Worker/D1 identity path now has live proof. The remaining gap is narrower:
capturing the same fresh Access login through the installed Plexus app's
Cloudflare Access sign-in window.

- [ ] Fresh OTP sign-in from installed Plexus app BrowserWindow
- [x] Fresh Cloudflare Access browser OTP with Thoughtseed Labs Gmail reaches
      `/v1/whoami`
- [x] `/v1/whoami` returns role-aware admin session
- [x] Admin demo can inspect all projects
- [x] Employee emulation records real onboarding state changes

Fresh Access browser + live Worker/D1 evidence captured 2026-06-17:
- Browser Access flow for `thoughtseedlabs@gmail.com` landed on
  `https://plexus-api.thoughtseed.space/v1/whoami`.
- `/v1/whoami` returned HTTP 200, role `admin`, workspace `ws_thoughtseed`,
  project visibility `all`, identity `pid_admin_thoughtseed_labs`, employee
  `emp_630f768292cc4b674e5ae3e3`, and 4 onboarding steps.
- `/v1/admin/demo` returned HTTP 200 with 7 identities, 17 projects, and both
  `employee` and `admin` roles visible.
- A reversible admin onboarding write against employee identity
  `pid_emp_6757fc37849214557591ddf6` changed step `preferences` from
  `optional` to `deferred` and restored it to `optional`; both PUT requests
  returned HTTP 200 and final readback confirmed restoration.
- Boundary: the admin/demo and reversible write probes used the locally cached
  Plexus app JWT, while the browser tab proved a fresh Access login can reach
  the same role-aware `/v1/whoami` surface. Installed app BrowserWindow capture
  remains the final Phase 13 identity proof.

Installed app BrowserWindow OTP attempt captured 2026-06-17:
- `/Applications/Plexus.app` launched successfully from the installed app and
  opened the cached admin Settings proof for `thoughtseedlabs@gmail.com`,
  role `admin`, workspace `ws_thoughtseed`, visibility `all`, Worker
  `CONNECTED`.
- `SIGN OUT` cleared local Plexus session state but initially did not clear the
  Electron `persist:tfaccess` Cloudflare Access cookie; the next login silently
  reused that cookie. Source fix landed in `src/main/teamforge.ts` so logout
  clears `CF_Authorization` from the Access partition.
- After manually clearing local `tf.session`, `tf.accessJwt`, and the
  `persist:tfaccess` `CF_Authorization` cookie for this proof run, the
  installed app opened a real Cloudflare Access BrowserWindow email prompt for
  `plexus-api`, accepted `thoughtseedlabs@gmail.com`, and advanced to the
  6-digit OTP prompt.
- Evidence screenshots:
  `docs/evidence/2026-06-17-installed-auth/cached-session-settings-proof.png`,
  `docs/evidence/2026-06-17-installed-auth/cloudflare-access-email-prompt.png`,
  `docs/evidence/2026-06-17-installed-auth/cloudflare-access-otp-prompt.png`.
- Boundary: the connected Gmail tool cannot read the `thoughtseedlabs@gmail.com`
  mailbox, so final OTP entry and post-login `/v1/whoami` capture remain open
  until the current 6-digit code is provided or that mailbox is connected.

Cached-session evidence captured 2026-06-16:
- `/v1/whoami` with the locally cached Plexus Access JWT returned HTTP 200,
  role `admin`, workspace `ws_thoughtseed`, project visibility `all`, identity
  `pid_admin_thoughtseed_labs`, employee `emp_630f768292cc4b674e5ae3e3`, and 4
  onboarding steps.
- `/v1/admin/demo` with the same cached session returned HTTP 200 with 7
  identities and 17 projects.
- A reversible admin onboarding write against employee identity
  `pid_emp_6757fc37849214557591ddf6` changed step `preferences` from
  `optional` to `deferred` and restored it to `optional`; both PUT requests
  returned HTTP 200 and final readback confirmed restoration.
- `/v1/realtime/rooms` returned HTTP 200 with 18 open rooms.
- `/v1/commands/runs?state=*` read-only probes returned HTTP 200 for valid
  states; current created/in-progress queues are empty and one historical
  failed `ts-standup` run is visible.

Fresh OTP from the installed Plexus app is still required before closing the
Phase 13 identity proof completely.

## Infra housekeeping

- [ ] Rename Cloudflare Access app to "Plexus"
- [ ] Clean orphan DNS record `teamforge-api.thoughtseed.space`

## Closed

21 issues closed on 2026-06-16:
- #13–#21 (RW-001→009): completed in 0.3.0
- #1–#12 (B1→B12): superseded by Worker-canonical + CF Access model
