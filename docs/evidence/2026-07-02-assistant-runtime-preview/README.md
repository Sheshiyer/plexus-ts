# Assistant Runtime Packaged Preview

Date: 2026-07-02

## Deterministic Local Proof

Command:

```bash
npm run release:dry-run
```

Result: passed.

The dry run rebuilt main, preload, and renderer, rebuilt the native `sqlite3` dependency for Electron `33.4.11` on `arm64`, skipped signing with `CSC_IDENTITY_AUTO_DISCOVERY=false`, skipped notarization with `SKIP_NOTARIZATION=true`, and produced ignored local package artifacts:

- `release/Plexus-0.4.5-mac-arm64.dmg`
- `release/Plexus-0.4.5-mac-arm64.zip`
- `release/latest-mac.yml`

## Screenshot Coverage

Screenshots were not captured in this pass. The renderer build and packaged artifact proof are deterministic local checks; visual walkthrough remains a manual follow-up using `docs/evidence/assistant-runtime-smoke-checklist.md`.

Required manual views:

- Assistant panel
- Settings assistant section
- Timer assistant CTA
- Reports assistant CTA
- Optional Helpers panel
- Admin Diagnostics assistant section

## Live Proof Boundaries

No live Google, NVIDIA, Worker, Hermes, R2, or vault endpoint proof was claimed in this pass. Model routing, daily queueing, bridge fallback shape, and context redaction were verified with deterministic tests and smoke scripts.
