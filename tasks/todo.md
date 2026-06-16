# Plexus — Open Work

Updated: 2026-06-16

## Current version

Released: `0.3.0` — released 2026-06-15, OTA proven, Worker deployed.
Local package: `0.3.2` — unreleased WIP (agent-fabric enrichment G1–G8 + media entitlements + 8-gap hardening) until a release workflow / OTA proof is recorded.

## Active execution batch

- [x] Remove normal Settings access to legacy Worker URL / workspace / bearer-token editing.
- [x] Add a Settings session proof surface for Cloudflare Access role, workspace, visibility, onboarding, and Worker reachability.
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

These require a live OTP flow from Plexus to prove end-to-end:

- [ ] Fresh OTP sign-in with Thoughtseed Labs Gmail
- [ ] `/v1/whoami` returns role-aware admin session
- [ ] Admin demo can inspect all projects
- [ ] Employee emulation records real onboarding state changes

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

Fresh OTP from the installed Plexus app is still required before checking off
the Phase 13 verification items above.

## Infra housekeeping

- [ ] Rename Cloudflare Access app to "Plexus"
- [ ] Clean orphan DNS record `teamforge-api.thoughtseed.space`

## Closed

21 issues closed on 2026-06-16:
- #13–#21 (RW-001→009): completed in 0.3.0
- #1–#12 (B1→B12): superseded by Worker-canonical + CF Access model
