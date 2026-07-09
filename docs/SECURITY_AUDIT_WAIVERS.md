# Plexus Security Audit Waivers

Last reviewed: 2026-07-09 for Plexus `0.5.2`.

## Production Dependency Audit

The release gate uses:

```bash
npm run security:audit:prod
```

That command runs `npm audit --omit=dev --audit-level=high` through `scripts/security-audit-prod.mjs`, which removes leaked local npm `allow-scripts` configuration before invoking audit. Batch 7 local proof found zero high or critical production dependency vulnerabilities.

## Current Dev/Build-Chain Audit Findings

Full `npm audit --audit-level=high` currently reports 11 high findings in dev/build-chain packages. They are not shipped as app runtime dependencies, but they still matter for release engineering:

| Area | Packages | Current owner decision |
|---|---|---|
| Electron runtime dev dependency | `electron@33.4.11` | Track an Electron major upgrade task before claiming the full development toolchain audit is clean. Runtime mitigation in this batch is BrowserWindow isolation, CSP verification, Electron fuses, ASAR-only loading, and no renderer Node integration. |
| Electron builder chain | `electron-builder`, `app-builder-lib`, `dmg-builder`, `electron-builder-squirrel-windows`, `@electron/rebuild` | Track an electron-builder major upgrade task before claiming the full build-chain audit is clean. Release builds still verify packaged fuses and run the production dependency audit. |
| Build support transitive packages | `tar`, `node-gyp`, `make-fetch-happen`, `cacache` | Covered by the electron-builder upgrade task because the fixes require its major upgrade path. |
| Multipart helper | `form-data` | Dev-chain finding from builder dependencies; keep outside production dependency gate unless it appears under `npm audit --omit=dev`. |

## Waiver Boundary

This file is not a waiver for production dependencies. A release cannot be called production-ready when `npm run security:audit:prod` reports a high or critical vulnerability unless the release notes name the package, severity, exploitability, compensating controls, owner, and target fix issue.

This file only records the current dev/build-chain state so production readiness claims do not overstate the audit result. The follow-up upgrade task is: upgrade Electron and electron-builder together, rerun full audit, rebuild signed artifacts, and re-prove packaged fuses.
