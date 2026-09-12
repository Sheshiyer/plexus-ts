# Plexus dependency audit policy and historical waivers

Policy/source reviewed: 2026-09-05 for v0.7.12. This document records executable
gates and historical findings. **No fresh dependency audit was run by this
current documentation pass.** Package versions, a past zero-vulnerability report
or successful source checks do not establish today's advisory status.

## Required executable gates

The **production dependency audit** checks the production dependency tree. The
**release-chain audit** checks the complete lockfile, including the embedded
Electron runtime and tools used to produce signed artifacts. These labels name
required checks, not a claim that either audit currently passes.

| Command | Implemented operation | Scope |
| --- | --- | --- |
| `npm run security:audit:prod` | `npm audit --omit=dev --audit-level=high` | Production dependency tree |
| `npm run security:audit:release` | `npm audit --audit-level=high` | Complete lockfile, including shipped Electron and build/signing tools |

The wrappers in `scripts/security-audit-prod.mjs` and
`scripts/security-audit-release.mjs` propagate npm failure status. A nonzero
result must be reviewed before release readiness is claimed. The `high`
threshold does not imply that passing means zero findings at every severity;
record the full audit counts and exact dependency/lockfile revision.

Both gates are included in `verify:all`, CI, Release Candidate, protected
Publish OTA and local OTA preparation. The latter workflows and artifact checks
remain separate from the dependency audit itself. See [release
runbook](OTA_RELEASE.md) and [documentation map](DOCUMENTATION_MAP.md).

## Why the full lockfile matters

Electron is listed as a devDependency for npm installation semantics but its
runtime ships inside Plexus. Electron-builder and its transitive tools execute
while producing signed artifacts. A generic "dev dependency" label is therefore
not a waiver for shipped-runtime or release-chain risk.

Current package declarations include Electron `^43.1.0`, electron-builder
`^26.15.3` and `@electron/fuses` `^2.1.3`. Resolve actual versions from the lockfile
and audit the exact candidate. This document makes no current support-window or
vulnerability-free claim for those versions.

## Historical July disposition

The v0.5.2 evidence recorded eleven high development/build findings. The July 10
v0.5.3 preparation upgraded the runtime/tooling and recorded zero vulnerabilities
for that candidate in both audit scopes. It closed the blanket exclusion of
Electron from shipped-dependency risk. Those are dated release receipts, not a
standing September waiver or current audit result.

## Waiver requirements

This document contains no active advisory-specific waiver. Any proposed waiver
must name the advisory/package, affected dependency path, exploitability,
compensating control, accountable owner and target fix issue/date. Record its
review separately; never turn an absent fresh audit or stale clean report into
an implicit exception. This file's policy does not itself approve a release.
