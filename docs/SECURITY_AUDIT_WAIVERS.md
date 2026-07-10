# Plexus Security Audit Status

Last reviewed: 2026-07-10 for Plexus `0.5.3` release preparation.

## Production Dependency Audit

The production dependency audit remains:

```bash
npm run security:audit:prod
```

It runs `npm audit --omit=dev --audit-level=high` and must report zero high or critical findings. This is the narrow check for packages installed as production dependencies.

## Release-Chain Audit

Electron is declared as a development dependency for npm installation semantics, but the Electron runtime is embedded in every shipped Plexus binary. `electron-builder` and its transitive packages also execute while producing signed release artifacts. The release gate therefore additionally runs:

```bash
npm run security:audit:release
```

That command audits the complete lockfile at high severity. It is required by `verify:all`, CI, the secret-free tag candidate workflow, the trusted default-branch Publish OTA workflow, and local OTA preparation.

For this candidate:

- Electron is `43.1.0`, a supported stable release line.
- `electron-builder` is `26.15.3`.
- `@electron/fuses` is `2.1.3`.
- the previously vulnerable transitive `form-data` resolution is `4.0.6`.
- both the production dependency audit and the complete release-chain audit report zero vulnerabilities.

## Closed Dev/Build-Chain Findings

The `0.5.2` evidence recorded eleven high dev/build-chain findings, including direct Electron runtime advisories and electron-builder/tar findings. Calling those findings non-shipped was incorrect for Electron itself. The `0.5.3` upgrade task closes that blanket waiver by upgrading the runtime and packaging chain and promoting the complete lockfile audit into an executable release gate.

## Waiver Boundary

There are no active high- or critical-severity dependency waivers for this candidate. If either audit becomes non-zero, a release cannot be called ready unless an advisory-specific entry names the package, affected path, exploitability, compensating control, owner, and target fix issue. A generic "dev dependency" classification is not sufficient for Electron or release tooling.
