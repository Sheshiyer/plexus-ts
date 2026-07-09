# Plexus Release Evidence Packet

This file is the current release-proof checklist for Plexus production claims. It separates deterministic local gates from signed/live evidence so a release cannot be called production-ready from tests alone.

## Binary Production-Ready Gate

A Plexus binary is production-ready only when every required item below is green or explicitly deferred in the release notes with a linked GitHub issue:

- `npm run verify:all` passes on the release commit.
- `npm run smoke:all` passes and records deterministic local smoke coverage.
- The production dependency audit, `npm run security:audit:prod`, reports zero high or critical production dependency vulnerabilities, or a waiver names the package, severity, exploitability, and owner.
- `npm run verify:csp` confirms the renderer CSP blocks remote scripts, object/embed loads, frames, wildcard sources, and non-local HTTP connections.
- `npm run verify:fuses` confirms Electron fuses and ASAR policy match the production security posture.
- `docs/SECURITY_AUDIT_WAIVERS.md` explains any current dev/build-chain audit findings that are outside the production dependency gate.
- main CI passes on macOS, Ubuntu, and Windows for the merge commit.
- The Release workflow builds signed macOS artifacts, verifies packaged Electron fuses, uploads artifacts, and verifies the public OTA feed after upload.
- signed OTA proof demonstrates a real upgrade from a prior signed app; an up-to-date check alone is not enough.
- screenshots or attached evidence cover Clio Today, founder proof cockpit, Clio assistant surfaces, co-working room/stage, degraded states, and Settings update status.
- secret custody evidence confirms renderer/preload surfaces do not expose Access JWTs, Worker tokens, bridge tokens, local API bearer tokens, or R2/signing credentials.

## Required Local Evidence

Include the exact command output summary for:

```bash
npm run verify:all
npm run release:ota:prep
npm run security:audit:prod
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
- Release workflow run URL for the tag or manual dispatch.
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
