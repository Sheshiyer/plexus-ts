# Apple signing guide compatibility entry

Reviewed: 2026-09-05. This filename is retained for older links; it is not a registered agent skill or a separate release authority.

Use [APPLE_SIGNING.md](APPLE_SIGNING.md) for current Plexus credential preparation, signing, notarization, and artifact verification. Use [OTA_RELEASE.md](OTA_RELEASE.md) for protected publication and the Labs migration, and [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md) for acceptance.

The previous reusable template was superseded because it:

- created `scripts/notarize.js` although Plexus already uses `scripts/notarize.cjs` in an ESM package;
- placed credentials in shell startup files and repository-scoped secrets;
- proposed a separate tag-triggered signing workflow without the existing protected publisher;
- treated optional notarization and `npm run build` as signed release proof;
- assumed the Apple account/certificate state instead of checking it.

The current contract is `Release Candidate` → protected `Publish OTA`, with `OTA_*` environment secrets mapped into only the signing/upload steps. `REQUIRE_NOTARIZATION=true` and the expected-team signature verifier enforce the release boundary. The September 5 [migration receipt](evidence/2026-09-05-labs-migration-review.md) records the remaining operational work; this page supplies no credential values and makes no infrastructure-readiness claim.
