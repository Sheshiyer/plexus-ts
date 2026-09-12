# Plexus Apple signing and notarization

Reviewed: 2026-09-05 against the v0.7.12 release workflow. This guide describes credential preparation and verification; it does not certify the current Apple account, secret values, or a new signed release. Current migration status is in the [September 5 evidence](evidence/2026-09-05-labs-migration-review.md).

## Distribution authority

Plexus distributes macOS arm64 DMG/ZIP artifacts outside the App Store. A Developer ID Application certificate signs the app; Developer ID Installer is for `.pkg` installers, which are not this OTA lane. Follow Apple's [Developer ID certificate procedure](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/) for account roles, CSR creation, download, and installation.

The existing release chain is authoritative:

1. A reviewed merged-main version tag triggers the secret-free [Release Candidate workflow](../.github/workflows/release.yml).
2. A successful candidate triggers the default-branch [Publish OTA workflow](../.github/workflows/publish-ota.yml).
3. Its protected `ota-production` jobs validate release ancestry, build/sign/notarize, verify artifacts, and publish.

Do not add a second tag workflow that exposes signing secrets directly. A local build, version bump, or old successful publication does not authorize or prove a new production release.

## Prepare the five Apple values

| Protected environment secret | Build-process variable | Meaning |
|---|---|---|
| `OTA_CSC_LINK` | `CSC_LINK` | Certificate/private-key `.p12` bundle, encoded for the hosted runner |
| `OTA_CSC_KEY_PASSWORD` | `CSC_KEY_PASSWORD` | Password protecting that bundle |
| `OTA_APPLE_ID` | `APPLE_ID` | Apple account used for notarization |
| `OTA_APPLE_APP_SPECIFIC_PASSWORD` | `APPLE_APP_SPECIFIC_PASSWORD` | App-specific notarization password |
| `OTA_APPLE_TEAM_ID` | `APPLE_TEAM_ID` | Expected signing team |

Check the existing signing identity before creating another certificate. If needed, use Keychain Access to export the Developer ID Application certificate together with its private key as a password-protected `.p12`. Keep the bundle and password in an approved private store outside this repository. A local file path is not accessible to a GitHub-hosted runner.

Generate the app-specific password in the Apple account's Sign-In and Security settings; Apple requires two-factor authentication for this flow. Store the generated value privately. See [Apple's app-specific password instructions](https://support.apple.com/en-us/102654).

Enter values directly through a secure GitHub CLI prompt, for example:

```bash
gh secret set OTA_APPLE_APP_SPECIFIC_PASSWORD --env ota-production --repo Sheshiyer/plexus-ts
```

Repeat for the required names. For a certificate transfer, feed encoded bytes from the private bundle directly into the secret-setting process; never print the bundle or store credentials in repository docs, environment examples, shell startup files, command history, or chat.

Verify names without revealing values:

```bash
gh secret list --env ota-production --repo Sheshiyer/plexus-ts
```

Name presence is not signing proof. The full nine-value Apple/R2 custody migration and coordinated legacy-secret removal are documented in [OTA_RELEASE.md](OTA_RELEASE.md). Retain the existing publisher compatibility fallback until all required environment values and the replacement release path have been verified.

## Existing implementation

| File | Responsibility |
|---|---|
| [`package.json`](../package.json) | `space.thoughtseed.plexus`, macOS arm64 release scripts, DMG/ZIP targets, `afterSign` hook |
| [`scripts/notarize.cjs`](../scripts/notarize.cjs) | Calls `@electron/notarize` with Apple ID/password/team; protected publication sets `REQUIRE_NOTARIZATION=true` |
| [`scripts/entitlements.mac.plist`](../scripts/entitlements.mac.plist) | Checked-in JIT/memory, microphone/camera and disabled `get-task-allow` settings |
| [`scripts/verify-macos-release-signature.mjs`](../scripts/verify-macos-release-signature.mjs) | Checks expected team, codesign, Gatekeeper, and stapled ticket for packaged and mounted-DMG apps |

The hook is CommonJS **`.cjs`**, not the retired `notarize.js` example. No dependency or hook creation is needed. Do not copy a generic entitlement list over the checked-in file.

## Local preparation and signed verification

Unsigned, non-publishing package proof:

```bash
npm ci
npm run release:dry-run
```

This command disables identity auto-discovery and notarization. It exercises arm64 packaging, architecture, SQLite bootstrap, packaged main, and packaged renderer checks; it is not a signed distributable.

For an explicitly authorized local signing run, provide the five build-process variables from a private credential source only for that process, then require notarization:

```bash
REQUIRE_NOTARIZATION=true npm run release:mac
npm run verify:release-signature -- --team-id "$EXPECTED_APPLE_TEAM_ID"
```

`EXPECTED_APPLE_TEAM_ID` must be set to the independently selected signing team. The verifier expects the packaged app under `release/mac-arm64/` and exactly one arm64 DMG, or explicit `--app`/`--dmg` paths. Retain redacted command results with exact source SHA and artifact hashes.

`npm run build` by itself is not a signing/notarization guarantee: the hook may skip missing Apple credentials when notarization is not required. `SKIP_NOTARIZATION=true` conflicts with the protected required-notarization mode and must fail.

## Diagnose a failed gate

| Failure | Next check |
|---|---|
| Signing identity unavailable | Correct Developer ID Application certificate, matching private key, runner import, and keychain access |
| Missing Apple credentials | Protected environment names and workflow step mapping; do not fall back to plaintext repository files |
| Team mismatch | Selected Apple team versus certificate identity; do not relax the verifier |
| Notarization or staple failure | Exact Apple submission result and packaged-app validation before rebuilding or publishing |
| Multiple DMGs in verification | Use a clean isolated release directory or explicit artifact arguments; preserve unrelated user artifacts |
| App launches only from the repo | Run packaged-main and renderer checks; an unsigned development launch is insufficient |

A fresh signed OTA upgrade with separate download/install consent and preserved account/workspace state remains the final release acceptance step. For the account migration, retain both old-client feed paths and use the reviewed bridge-release procedure in [OTA_RELEASE.md](OTA_RELEASE.md).
