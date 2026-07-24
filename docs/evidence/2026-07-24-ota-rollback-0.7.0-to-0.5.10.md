# OTA Rollback Receipt — v0.7.0 → v0.5.10

- Date/time (UTC): 2026-07-24 ~08:45
- Operator: founder (via Kimi orchestrator, explicit owner instruction)
- Reason: v0.7.0 packaged main process crashes at launch
  (`ERR_MODULE_NOT_FOUND: Cannot find package 'zod'` from
  `@ai-sdk/provider-utils` inside `app.asar`). zod is a peer-only
  dependency of the ai-sdk packages and was excluded from `app.asar` by
  electron-builder's dependency collector.
- Rollback target rationale: `docs/OTA_RELEASE.md` names 0.6.0 as the
  rollback baseline, but post-incident artifact analysis proved the
  shipped v0.6.0 build carries the identical boot crash (breaking static
  `ai` import introduced by `96c40ac`, first shipped in v0.6.0). The last
  boot-safe signed release is **v0.5.10**, so the manifest was restored
  to 0.5.10 instead of the documented 0.6.0.
- Action: overwrote ONLY `s3://plexus-updates/plexus/latest-mac.yml`
  with the exact v0.5.10 manifest bytes (source: GitHub release v0.5.10
  asset `latest-mac.yml`), via wrangler 4.95.0 (founder OAuth login),
  `Content-Type: application/yaml`,
  `Cache-Control: public, max-age=60, must-revalidate`.
- Versioned keys touched: NONE (0.5.10/0.6.0/0.7.0 artifacts immutable,
  untouched).
- BEFORE: etag `"84a98ac6c7a3514cd8d8213c21c3a863"`, version 0.7.0,
  cache-control `public, max-age=60, must-revalidate`.
- AFTER: etag `"6e2dff4933ca8bfbedcdf77cfea3738b"`, version 0.5.10,
  cache-control `public, max-age=60, must-revalidate`.
- Verifier: `scripts/verify-release-ref.mjs --mode public` against the
  live feed with the restored manifest — exit 0 on attempt 1 (manifest
  byte-match, SHA-512 re-hash of 0.5.10 ZIP+DMG, blockmap immutable-cache
  checks).
- Client impact: machines that already INSTALLED 0.7.0 (or 0.6.0) crash
  before the updater runs — feed rollback cannot reach them; they need a
  manual reinstall from the 0.5.10 DMG (or the corrective 0.7.1 DMG once
  published). Feed rollback protects 0.5.x clients from pulling a broken
  build.
- Follow-up: corrective release v0.7.1 (zod packaging fix + packaged
  main-process boot smoke gate); `docs/OTA_RELEASE.md` rollback-baseline
  section needs updating to record that 0.6.0/0.7.0 must never be used
  as rollback baselines.
