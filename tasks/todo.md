# Plexus — Open Work

Updated: 2026-06-17

## Current version

Released: `0.3.4` — released 2026-06-17, OTA proven, macOS tray icon fix live.
Local package: `0.4.0` — unreleased WIP (Realtime → Co-working: presence floor + project rooms + ambient lounge) until a release workflow / OTA proof is recorded.

## Active execution batch

- [x] Remove normal Settings access to legacy Worker URL / workspace / bearer-token editing.
- [x] Add a Settings session proof surface for Cloudflare Access role, workspace, visibility, onboarding, and Worker reachability.
- [x] Patch Plexus sign-out to clear the Electron `persist:tfaccess` Cloudflare Access cookie, not only local `tf.session` / `tf.accessJwt`.
- [x] Preserve the deferred live proof gates: fresh OTP, role-aware `/v1/whoami`, admin demo read, onboarding write, realtime E2E, and command-loop E2E.
- [x] Re-run Plexus typecheck after Settings changes.

## Remaining GitHub issues (4)

### Phase 14 Wave 3 — Realtime hardening

- [ ] [#26 RW-014](https://github.com/Sheshiyer/plexus-ts/issues/26) — Wire Cloudflare Realtime SFU for live media transport (P1, webrtc) — **client-side WebRTC session manager landed, needs CF credentials + E2E test**
- [ ] [#22 RW-010](https://github.com/Sheshiyer/plexus-ts/issues/22) — Feed non-transcript meeting memory into Paperclip agents (P2, data)
- [ ] [#23 RW-011](https://github.com/Sheshiyer/plexus-ts/issues/23) — Privacy, permission, and audit hardening for realtime rooms (P0, security)
- [ ] [#24 RW-012](https://github.com/Sheshiyer/plexus-ts/issues/24) — E2E realtime workspace smoke and regression pack (P1, qa)

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
