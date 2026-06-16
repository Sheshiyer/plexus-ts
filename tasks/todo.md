# Plexus — Open Work

Updated: 2026-06-16

## Current version

`0.3.0` — released 2026-06-15, OTA proven, Worker deployed.

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

## Infra housekeeping

- [ ] Rename Cloudflare Access app to "Plexus"
- [ ] Clean orphan DNS record `teamforge-api.thoughtseed.space`

## Closed

21 issues closed on 2026-06-16:
- #13–#21 (RW-001→009): completed in 0.3.0
- #1–#12 (B1→B12): superseded by Worker-canonical + CF Access model
