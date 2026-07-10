# Plexus Deferred Register

Date: 2026-07-10
Scope: release-candidate closeout for #41-#50
Recommendation state: go-with-degraded-live-proof

This register keeps deferred or live-only proof visible. Nothing here is a silent pass for a full production-ready binary.

| Item | Link | Status | Why deferred | Next proof required |
|---|---|---|---|---|
| Self-hosted transcription agent | #25 | Deferred to P15 | The co-working closeout path intentionally uses null transcript and recording refs until live media and consent boundaries are proven. | New P15 plan, self-hosted model choice, privacy review, local transcript fixture, and explicit user consent proof. |
| live Paperclip meeting-memory ingestion | #22 | Open live-proof blocker | Local proof can count bounded notes/decisions/actions, but it does not prove a real Paperclip vault artifact was accepted. | Run the live helper against a disposable/test organization and attach artifact URLs or vault receipts. |
| Realtime privacy, permission, and audit hardening | #23 | Open live/security blocker | Local permission/audit models exist, but Cloudflare Access identity and Worker audit proof still need live validation. | Fresh Access session, Worker audit log receipt, denied-permission capture, and secret redaction check. |
| End-to-end realtime workspace smoke | #24 | Open QA blocker | Deterministic local simulation exists, but full live room behavior still needs a current two-participant pass. | Two participant or accepted simulation run with join/share/leave/closeout notes and screenshots. |
| Cloudflare Realtime SFU transport | #26 | Open live-media blocker | Batch evidence covers SFU degraded behavior, not true remote audio/video/screen transport. | Cloudflare SFU credentials, Worker broker proof, remote track subscription, and failure recovery capture. |
| signed OTA upgrade for current candidate | Release workflow | Required before full production-ready claim | `npm run verify:all` is local deterministic proof; it cannot prove signed artifacts or the public update feed. | Tag, Release workflow pass, public `latest-mac.yml`, asset checksums, and true upgrade from a prior signed version. |
| live Paperclip admin proof | Manual smoke | Required only when Paperclip admin routing is claimed | `smoke:all` is intentionally offline and deterministic. | `npm run smoke:admin-fabric-paperclip` with disposable/test org markers and redacted receipt. |
| Cloudflare Access OTP proof | Live auth smoke | Required for live auth claims | Existing docs have historical OTP proof, but the release candidate needs fresh role-aware session evidence. | Fresh Plexus OTP login and `/v1/whoami` role-aware session proof. |
| PR #34 ambient hotfix | https://github.com/Sheshiyer/plexus-ts/pull/34 | Supersede/close path recorded | Branch is stale relative to the v0.5.x co-working room-stage implementation. | Close as superseded or leave with explicit owner/date; do not merge blindly. |
| PR #40 media-controls fix | https://github.com/Sheshiyer/plexus-ts/pull/40 | Separate narrow merge path | It is a one-file visual fix and should not be mixed into closeout documentation. | Rebase/verify visually, then merge or supersede in a focused PR. |
