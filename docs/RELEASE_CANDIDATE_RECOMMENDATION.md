# Plexus release recommendation

Reviewed: 2026-09-05. Current posture: **blocked-labs-ota-cutover**. The source/public-feed baseline is v0.7.12; a new Labs bridge release is not approved or proven by the v0.5.5 recommendation retained below.

## Current release decision

Do not call the binary fully production-ready from local gates or a reachable manifest. Follow [OTA_RELEASE.md](OTA_RELEASE.md) and [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md): verify the target account/bucket, repair the stable Labs feed, reconcile immutable artifacts, and prove signed OTA continuity for both historical client feed cohorts. The [September 5 migration review](evidence/2026-09-05-labs-migration-review.md) records the current evidence and limits; [ISA.md](../ISA.md) owns acceptance status.

`npm run verify:all`, `npm run verify:release-candidate`, main CI, the secret-free tag candidate, and protected signing/publication remain required. The July closeout verifier checks historical packet structure; passing it alone is not a current migration recommendation. Credentials and publication remain separate from this documentation review.

Paperclip is retired, so its old live-organization gate below is historical, not a current installation or release prerequisite. Current media, GitHub App, Access, and delivery claims still need their own current receipts; see the [deferred register](DEFERRED_REGISTER.md).

## Historical v0.5.5 recommendation — 2026-07-13

The following recommendation and sequence describe the July 13 candidate. Retained version numbers, issue states, branch counts, and commands are evidence of that decision, not instructions to recreate or tag it today.

<details>
<summary>July 13 release recommendation and sequence — historical snapshot</summary>

Date: 2026-07-13
Recommendation: go-with-degraded-live-proof

This recommendation becomes actionable only after code, documentation, issue-sync, and protected release gates pass.

Plexus v0.5.5 is a consolidation release based on current `origin/main`, not a merge of stale branch tips. It closes the two material deterministic gaps found by the repository audit: the bounded Clio model-tool loop and bounded read-only Temperance skill-index resolution. External SFU, Paperclip, Worker-audit, and Access receipts remain explicit in `docs/DEFERRED_REGISTER.md`; signed OTA publication remains a protected release step.

## Why This Is A Go For RC

- Every local/remote branch, worktree, stash, open PR, and all 15 open issues were reviewed against current main.
- PR #40 and the old frame-extraction branch are semantically superseded; no stale patch is required.
- Existing release branches are fully merged ancestors of main.
- The v0.5.4 signed/notarized release and public OTA feed are verified baselines.
- `npm run verify:all`, release preparation, packaged renderer smoke, three-platform CI, and protected publication remain mandatory.
- The model tool loop is iteration-bounded, validates tool identities, preserves confirmation authority, and returns redacted errors.
- Skill-index resolution is read-only, main-process-only, size/count bounded, deterministic, and has no execution authority.

## Honest Boundaries

Do not call the binary fully production-ready while these live acceptance boundaries remain open.

- #22 still needs a live disposable-organization Paperclip acceptance receipt.
- #23 still needs current Worker/D1 audit and unauthorized Access-session proof.
- #25 remains intentionally deferred to P15.
- #26 still needs Worker/Cloudflare SDP completion and true two-party media proof.
- v0.5.5 is not publicly shipped until signed/notarized publication, public manifest/hash checks, and installed launch proof pass.
- Three root-worktree architecture documents and all three stashes remain preserved and excluded from the tagged tree.

## Required Release Sequence

1. Pass focused model-tool, skill-index, issue-contract, neighboring regression tests, and `npm run verify:release-candidate`.
2. Pass `npm run verify:all` and `npm run release:ota:prep` at version `0.5.5`.
3. Merge only through a protected PR after macOS, Ubuntu, and Windows CI pass, then require main CI on the merge commit.
4. Require the tag-triggered secret-free Release Candidate to pass.
5. Approve the protected default-branch Publish OTA signing and publication stages.
6. Verify GitHub Release assets, cache-busted public `latest-mac.yml`, checksums, and installed v0.5.5 renderer launch.

Cleanup of preserved branches, worktrees, dirty generated files, or stashes requires separate explicit approval after release proof.

</details>
