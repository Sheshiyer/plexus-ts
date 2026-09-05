# Plexus Release Evidence Packet

This file is the current release-proof checklist for Plexus production claims. It separates deterministic local gates from signed/live evidence so a release cannot be called production-ready from tests alone.

Reviewed: 2026-09-05. Current migration posture is **blocked-labs-ota-cutover**; see [the migration review](evidence/2026-09-05-labs-migration-review.md), [ISA.md](../ISA.md), and [the documentation map](DOCUMENTATION_MAP.md). A historical signed release remains historical proof, not acceptance of the next release or a completed account migration.

## Binary Production-Ready Gate

A Plexus binary is production-ready only when the applicable release gates below pass. Deferred optional feature claims must name a linked issue and limitation; signing, artifact integrity, credential custody, and installed-upgrade safety cannot be waived by labeling them degraded:

- `npm run verify:all` passes on the release commit.
- `npm run smoke:all` passes and records deterministic local smoke coverage.
- The production dependency audit, `npm run security:audit:prod`, reports zero high or critical production dependency vulnerabilities, or a waiver names the package, severity, exploitability, and owner.
- The complete release-chain audit, `npm run security:audit:release`, reports zero high or critical findings, including the packaged Electron runtime and electron-builder toolchain.
- `npm run verify:csp` confirms the renderer CSP blocks remote scripts, object/embed loads, frames, wildcard sources, and non-local HTTP connections.
- `npm run verify:fuses` confirms Electron fuses and ASAR policy match the production security posture.
- `docs/SECURITY_AUDIT_WAIVERS.md` explains any current dev/build-chain audit findings that are outside the production dependency gate.
- main CI passes on macOS, Ubuntu, and Windows for the merge commit.
- The secret-free Release Candidate workflow passes for the exact tag, and the default-branch Publish OTA workflow receives `ota-production` approval, builds signed macOS arm64 artifacts, verifies the packaged executable architecture and Electron fuses, and verifies the public OTA feed after upload.
- signed OTA proof demonstrates a real upgrade from a prior signed app; an up-to-date check alone is not enough.
- screenshots or attached evidence cover Clio Today, founder proof cockpit, Clio assistant surfaces, co-working room/stage, degraded states, and Settings update status.
- secret custody evidence confirms renderer/preload surfaces do not expose Access JWTs, Worker tokens, bridge tokens, local API bearer tokens, or R2/signing credentials.
- the release-candidate closeout packet maps the P9 UAT and deferred-proof state before any final recommendation is made.

## Required Local Evidence

Include the exact command output summary for:

```bash
npm run verify:all
npm run verify:release-candidate
npm run release:ota:prep
npm run security:audit:prod
npm run security:audit:release
```

If packaging is part of the release candidate, include:

```bash
npm run release:ota:prep:full
```

The full prep gate performs local release checks plus an unsigned builder pass. On macOS it also verifies packaged app fuses with `npm run verify:fuses -- --app auto`.

`npm run smoke:all` is intentionally deterministic and offline. The retained `npm run smoke:admin-fabric-paperclip` command belongs to historical disposable-organization evidence. Paperclip is retired; this command is neither a current release prerequisite nor permission to perform a live write. Compatibility behavior remains covered by local tests; see [optional-helpers.md](optional-helpers.md).

## Required Remote Evidence

Attach or link:

- Main CI run URL for the merge commit.
- Secret-free Release Candidate run URL for the exact `v<package.version>` tag.
- Default-branch Publish OTA `workflow_run` URL plus the protected `ota-production` approval receipt for the exact candidate SHA.
- Repository-settings receipt showing the `main`-only `ota-production` policy, active founder-only `v*` tag ruleset, and PR/three-platform-CI protection for `main`.
- Public `latest-mac.yml` URL and the version/path/sha512 values verified by the workflow.
- GitHub release URL with attached DMG, ZIP, blockmap, and `latest-mac.yml` assets.
- Signed OTA upgrade proof from a prior signed version to the candidate version.
- For a Labs bridge release, artifact-byte/cache proof on each supported old-client feed, followed by installed upgrade/relaunch and next-update discovery on Labs. Preserve source-account bridge artifacts for dormant clients.

## Manual Evidence

Screenshots belong under `docs/evidence/<date>-plexus-<version>/` when committed, or in the relevant GitHub issue/PR when the evidence is too large for the repo.

Required visual states:

- Employee Clio Today command center.
- Founder/operator proof cockpit.
- Clio assistant context and tool confirmation surfaces.
- Co-working lobby plus active room/stage state.
- Degraded/offline states for optional integrations.
- Settings update panel showing current version, feed status, and available update state when applicable.

## Current versus historical closeout

The current migration evidence is [the September 5 review](evidence/2026-09-05-labs-migration-review.md). Acceptance and remaining work are in [ISA.md](../ISA.md).

`docs/evidence/2026-07-10-release-candidate-closeout/README.md` remains the historical packet checked by `npm run verify:release-candidate`. Its retained P9 status and v0.5.5 recommendation do not certify current runtime behavior.

Use [docs/DEFERRED_REGISTER.md](DEFERRED_REGISTER.md) for current proof categories and their explicitly dated history. Use [docs/RELEASE_CANDIDATE_RECOMMENDATION.md](RELEASE_CANDIDATE_RECOMMENDATION.md) for the current release decision. Do not copy the old `go-with-degraded-live-proof` recommendation into a Labs migration completion claim.
