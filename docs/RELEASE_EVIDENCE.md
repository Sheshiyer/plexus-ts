# Plexus Release Evidence Packet

This file is the current release-proof checklist for Plexus production claims. It separates deterministic local gates from signed/live evidence so a release cannot be called production-ready from tests alone.

## Binary Production-Ready Gate

A Plexus binary is production-ready only when every required item below is green or explicitly deferred in the release notes with a linked GitHub issue:

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

`npm run smoke:all` is intentionally deterministic and offline. Live Paperclip proof remains a separate manual helper:

```bash
npm run smoke:admin-fabric-paperclip
```

Use `--write` only against disposable test organizations with explicit test markers.

## Required Remote Evidence

Attach or link:

- Main CI run URL for the merge commit.
- Secret-free Release Candidate run URL for the exact `v<package.version>` tag.
- Default-branch Publish OTA `workflow_run` URL plus the protected `ota-production` approval receipt for the exact candidate SHA.
- Repository-settings receipt showing the `main`-only `ota-production` policy, active founder-only `v*` tag ruleset, and PR/three-platform-CI protection for `main`.
- Public `latest-mac.yml` URL and the version/path/sha512 values verified by the workflow.
- GitHub release URL with attached DMG, ZIP, blockmap, and `latest-mac.yml` assets.
- Signed OTA upgrade proof from a prior signed version to the candidate version.
- Live Paperclip proof from `npm run smoke:admin-fabric-paperclip` when Paperclip admin routing is part of the release claim.

## Manual Evidence

Screenshots belong under `docs/evidence/<date>-plexus-<version>/` when committed, or in the relevant GitHub issue/PR when the evidence is too large for the repo.

Required visual states:

- Employee Clio Today command center.
- Founder/operator proof cockpit.
- Clio assistant context and tool confirmation surfaces.
- Co-working lobby plus active room/stage state.
- Degraded/offline states for optional integrations.
- Settings update panel showing current version, feed status, and available update state when applicable.

## Current Closeout Packet

The current release-candidate closeout packet is `docs/evidence/2026-07-10-release-candidate-closeout/README.md`.

Use `docs/DEFERRED_REGISTER.md` to keep #22, #23, #24, #25, #26, signed OTA, live Paperclip, SFU, and Cloudflare Access proof boundaries visible. Use `docs/RELEASE_CANDIDATE_RECOMMENDATION.md` for the go/no-go language. The current recommendation is go-with-degraded-live-proof until the signed OTA and live external proofs are attached.
