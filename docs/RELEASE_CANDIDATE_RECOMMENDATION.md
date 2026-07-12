# Plexus Release Candidate Recommendation

Date: 2026-07-10
Recommendation: go-with-degraded-live-proof

Plexus has enough deterministic local proof to prepare a release candidate and continue through merge/CI review. Do not call the binary fully production-ready until the signed OTA upgrade and live external proof items in `docs/DEFERRED_REGISTER.md` are attached.

## Why This Is A Go For RC

- `npm run verify:all` is the required local gate and now includes `npm run verify:release-candidate`.
- The screenshot matrix covers Clio Today, founder proof cockpit, co-working, Clio assistant, degraded states, and accessibility contracts.
- Security and custody gates cover production dependency audit, Electron fuses, renderer CSP, secret redaction, guarded IPC, and main-process token custody.
- Assistant, evidence, Temperance dispatch, and co-working closeout paths have deterministic local tests and evidence docs.
- main CI must pass on macOS, Ubuntu, and Windows after merge before any tag/release step.

## Why This Is Not A Full Production-Ready Claim

- signed OTA upgrade proof for the current candidate is not attached yet.
- live Paperclip admin proof is intentionally outside deterministic CI.
- live SFU media transport proof is still open through #26.
- Cloudflare Access role-aware OTP proof should be refreshed against the current candidate.
- #22, #23, #24, and #25 remain explicit live/deferred boundaries.

## Required Next Move

Merge only after PR CI passes, then record main CI, issue sync, and root dirty-worktree preservation. After that, cut a release only if the secret-free Release Candidate passes, the protected default-branch Publish OTA workflow produces signed/notarized artifacts and uploads the public feed, and a real signed upgrade is proven.

The `v0.5.3` publisher retains the protected `ota-production` approval and uses existing repository-scoped Apple/R2 secrets as a compatibility bridge while the values are re-entered under unique `OTA_*` environment names. GitHub cannot copy or reveal the current values. Remove the repository copies and compatibility fallback together after all nine environment values are verified.
