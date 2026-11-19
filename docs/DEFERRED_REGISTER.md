# Plexus Deferred Register

Reviewed: 2026-09-05. Current release posture: **blocked-labs-ota-cutover**. [ISA.md](../ISA.md) owns acceptance status; this register describes proof categories without duplicating its counts. Use [the documentation map](DOCUMENTATION_MAP.md) and [migration evidence](evidence/2026-09-05-labs-migration-review.md) to resume current work.

## Current boundaries

| Boundary | Current next evidence |
|---|---|
| Labs OTA route and objects | Exact hostname ownership, functioning public Labs feed, and byte/metadata parity for retained current/rollback artifacts |
| Old installed-client continuity | Signed bridge release served through both old feed paths, installed upgrade/relaunch, preserved account/workspace, and subsequent Labs update discovery |
| Apple/R2 credential custody | Nine protected environment values and coordinated legacy-copy/fallback removal; name presence alone does not prove signing or correct bucket access |
| GitHub App and D1 | App identity/secrets, verified selected-repository installations, fresh Labs D1 bindings, and callback/webhook acceptance |
| Cloudflare Access | Fresh role-aware installed-app login against Labs; redirect/health probes are only edge evidence |
| Realtime SFU / #26 | Two-party media and recovery evidence on the active Worker. The v0.7.9 changelog records SDP/renegotiation client fixes; do not repeat the July assertion that all such source work is absent. |
| Hermes reporting | Distinct local outbox, bridge, Hermes-processing, and founder-visible receipts; fallback success is not final delivery |

Paperclip's dedicated helper surface is retired. **live Paperclip** requirements in the July snapshot below are historical and do not authorize restoring it. Fabric-named task/meeting compatibility remains in source; see [optional-helpers.md](optional-helpers.md).

## Historical v0.5.5 register — 2026-07-13

The following issue states, stash counts, and release assertions are the retained July snapshot. They are not a refreshed GitHub inventory or current cleanup instructions.

<details>
<summary>July 13 issue, stash, and live-proof register — historical snapshot</summary>

Historical release posture: `go-with-degraded-live-proof`. Deterministic product and release gates remained mandatory; the live boundaries below were explicitly deferred for that candidate.

Date: 2026-07-13
Scope: v0.5.5 release closeout after full PR, branch, worktree, stash, and issue audit
Recommendation state: go-with-explicit-live-boundaries

This register separates shipped deterministic behavior from external or future proof. Nothing here is a silent pass for a full live-integration claim.

| Item | Link | Status | Why deferred | Next proof required |
|---|---|---|---|---|
| live Paperclip meeting-memory acceptance | #22 | Open live-proof boundary | Manual structured closeout, optional handoff, and queued/sent/failed states are implemented, but no current disposable-organization vault receipt proves downstream acceptance. | Run the helper against a disposable/test organization and attach the accepted artifact URL or vault receipt. |
| Realtime Worker permission/audit acceptance | #23 | Open live/security boundary | Permission, consent, denial recovery, and typed audit plans pass deterministically; persisted Worker/D1 audit rows and current Access identity denial remain external. | Capture a fresh Access session, unauthorized join/share denial, redacted Worker audit row, and D1 receipt. |
| Self-hosted transcription agent | #25 | Deferred to P15 | Captions remain preview-only and closeout intentionally stores null transcript/recording references. | Approve model, consent, retention, privacy, and deletion contracts before implementation. |
| Cloudflare Realtime SFU transport | #26 | Open live-media boundary | Client scaffolding and honest degraded UI exist, but SDP answer handling, remote description, renegotiation, ICE restart/resume, and two-party live proof do not. | Complete the Worker/Cloudflare contract and capture remote audio/video/screen plus recovery evidence with two clients. |
| External Cambium/Hermes skill execution | #44 follow-up | Deferred execution authority | v0.5.5 resolves bounded local skill names for recommendations only. It does not activate skills, spawn agents, or grant external dispatch authority. | Approve an execution contract with confirmation, timeout, audit, evidence, and failure semantics. |
| Live Paperclip admin proof | Manual smoke | Required only for live admin-routing claims | Offline CI deliberately uses deterministic mocks and never mutates a live organization. | Run `npm run smoke:admin-fabric-paperclip` with disposable/test markers and attach a redacted receipt. |
| Cloudflare Access OTP proof | Live auth smoke | Required for fresh live-auth claims | Electron custody and login-window hardening are tested, but a current role-aware OTP receipt remains external. | Capture Plexus OTP login and `/v1/whoami` role-aware session proof. |
| v0.5.5 signed OTA upgrade | Release Candidate plus protected Publish OTA | Required before calling v0.5.5 publicly shipped | Local gates and unsigned packaging cannot prove Apple notarization, public object integrity, or upgrade behavior. | Pass the tag candidate, protected publisher, public manifest/checksum verification, and launch the installed v0.5.5 artifact. |
| Preserved stash plans | `stash@{0}` and `stash@{2}` | Preserved, not release code | The coworking V3 and Fabric standup plans are unique roadmap artifacts, while their old code scaffolds conflict with current main. | Extract approved, issue-backed slices onto fresh main; never apply the old code stashes wholesale. |
| Dirty architecture hook output | Root worktree | Preserved, excluded from release | Three generated docs were produced from the obsolete PR #40 checkout; one contains a truncated tag command. | Regenerate from current main through the architecture workflow before replacing or deleting the preserved files. |

## Closed boundaries

- #24 is complete under its accepted deterministic two-participant simulation option; true live media stays exclusively in #26.
- PR #34 is already closed as superseded.
- PR #40 is superseded by the stronger three-row stage layout on main and tracked screenshot proof; it must not be merged or cherry-picked.
- Signed v0.5.4 Release Candidate and Publish OTA runs passed, and the public feed advertises `0.5.4`.

</details>
