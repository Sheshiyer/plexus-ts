# ISA Gaps — Unchecked ISCs

**Extracted**: 2026-08-22
**Total**: 28 unchecked out of 327 ISCs (299 complete, 91.4%)

---

## Release workflow, feed, and rollback (3)

- [ ] ISC-41.1: signed `v0.5.2` rollback objects satisfy the current manifest and immutable-object cache-policy verifier without changing their bytes.
- [ ] ISC-42.1: an unprivileged manual Release Candidate run passes on the exact post-hardening `main` SHA without invoking Publish OTA.
- [ ] ISC-43.3: `ota-production` contains all nine unique `OTA_*` secrets and no legacy Apple/R2 credential remains repository-scoped before tag authorization.

## v0.5.5 consolidation and closure (5)

- [ ] ISC-66: protected pull-request CI passes on macOS, Ubuntu, and Windows for the exact reviewed head.
- [ ] ISC-67: the reviewed head merges to `main` without bypassing required checks.
- [ ] ISC-68: tag `v0.5.5` identifies the exact protected merge commit and its Release Candidate workflow passes.
- [ ] ISC-69: the protected Publish OTA workflow produces signed/notarized artifacts and updates the public feed to `0.5.5`.
- [ ] ISC-70: a downloaded published ZIP passes packaged-renderer launch smoke before final success is claimed.

## Co-working My Studio and v0.5.6 release (5)

- [ ] ISC-111: protected pull-request CI passes on macOS, Ubuntu, and Windows for the exact My Studio v0.5.6 head.
- [ ] ISC-112: the reviewed My Studio v0.5.6 head merges to `main` without bypassing required checks.
- [ ] ISC-113: tag `v0.5.6` points to the exact protected merge commit and contains both PR #107 compact mode and My Studio.
- [ ] ISC-114: the protected OTA publisher produces signed and notarized macOS artifacts and updates the public feed to `0.5.6`.
- [ ] ISC-115: GitHub Release and public manifest assets have exact v0.5.6 filenames, paths, sizes, and SHA-512 metadata.

## Private GitHub App permanent recovery (12)

- [ ] ISC-162: signed desktop delivery proof is recorded for the first Plexus release containing the repaired GitHub surface, or a named deferred follow-up owns that proof.
- [ ] ISC-163: a live read-only D1 probe confirms the personal installation becomes `selected` before calling that owner connected.
- [ ] ISC-164: a live read-only D1 probe confirms `thoughtseed-labs` binds to actual installation `146468777` or a later GitHub-confirmed replacement.
- [ ] ISC-165: a live authenticated Plexus probe shows the founder actor as verified after an active selected binding exists.
- [ ] ISC-167: the GitHub App registration requests only metadata read, contents write, pull requests write, issues read, actions read, and checks read.
- [ ] ISC-168: the organization installation grants the complete required permission set before it is reported connected.
- [ ] ISC-169: the personal installation grants the complete required permission set before it is reported connected.
- [ ] ISC-173: a read-only GitHub API probe confirms the registration contains no unnecessary administration, merge-queue, hook, organization-administration, or repository-project permission.
- [ ] ISC-174: a live installation-token probe lists at least one explicitly selected repository after permission approval.
- [ ] ISC-175: permission approval is performed through GitHub installation authority, not by direct database mutation.

## v0.7.7 Cloudflare Access relay-carrier hotfix (1)

- [ ] ISC-239: installed signed v0.7.6 upgrades to v0.7.7 through separate consent boundaries, preserves account/workspace continuity, renders the governed lane catalog, and completes a content-bearing streamed Clio turn.

## Deferred (1)

- [DEFERRED-VERIFY] ISC-34.7: signed `0.5.3` launched against a newer protected feed surfaces the app-level prompt without opening Settings; follow-up task `OTA-AUTO-PROMPT-LIVE-1` owns the screenshot and installed-upgrade receipt.

---

## Gap Clusters (for GSD phase planning)

### Cluster A: Protected Release Publication (v0.5.5 + v0.5.6)
**ISCs**: 66-70, 111-115 (10 ISCs)
**Nature**: All require protected CI merge + tag + signed publication
**Blocker**: Requires Apple signing + R2 secrets in `ota-production` environment
**Recommended phase**: p14 (release execution)

### Cluster B: GitHub App Permission + Live Probes
**ISCs**: 162-175 (12 ISCs, minus 166/170-172 which are checked)
**Nature**: Live D1 probes, GitHub API permission verification, installation-token proof
**Blocker**: Requires live production access + GitHub App admin
**Recommended phase**: p14 (operational verification)

### Cluster C: Release Feed + Rollback Verification
**ISCs**: 41.1, 42.1, 43.3 (3 ISCs)
**Nature**: R2 rollback object verification, secrets audit
**Blocker**: Requires R2 access + production environment audit
**Recommended phase**: p14 (release infrastructure)

### Cluster D: OTA Live Upgrade Proof
**ISCs**: 239 (1 ISC)
**Nature**: End-to-end installed upgrade verification
**Blocker**: Requires signed v0.7.7 publication + live app probe
**Recommended phase**: p14 (release verification)
