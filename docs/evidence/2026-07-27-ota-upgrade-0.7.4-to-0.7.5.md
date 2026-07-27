# Plexus OTA Upgrade Preparation — v0.7.4 → v0.7.5

Status: prepared release candidate; unsigned local evidence only.

This packet prepares a controlled signed upgrade from `v0.7.4` to `v0.7.5`.
It does not claim that the OTA upgrade has happened. Signed apply-and-relaunch
proof remains blocked until the reviewed candidate merges, the exact merge is
tagged `v0.7.5`, and the protected Publish OTA workflow completes.

## Authority boundary

- Candidate branch: `codex/ota-workflow-release-upgrade`
- Candidate base: `f133581aa1b62cc6fb35dde6c6e95876568b4077`
- From-version: `v0.7.4`
- To-version: `v0.7.5`
- Channel: production `latest`
- Public feed: `https://plexus-upgrade.thoughtseed.space/plexus`
- Pull requests and version-file changes cannot invoke Publish OTA.
- Only a successful tag-push Release Candidate can enter the protected publisher.
- This preparation creates no tag, GitHub Release, staging feed, or public-manifest mutation.

## Signed baseline fingerprint

The signed baseline is installed at `/Applications/Plexus.app`.

| Property | Verified value |
|---|---|
| Bundle version | `0.7.4` |
| Bundle identifier | `space.thoughtseed.plexus` |
| Signing authority | `Developer ID Application: Thoughtseed Private Limited (BS6SZR4929)` |
| Team identifier | `BS6SZR4929` |
| Gatekeeper | `accepted`; source `Notarized Developer ID` |
| Stapled ticket | `The validate action worked!` |
| DMG SHA-256 | `92b1a2f14ec4f6831782e4387f19b4c8343478ee6e18191fb6920941983d7d83` |
| Manifest SHA-256 | `0048ac89f9f5291d2b61699d47fa43922fd59273751bb5d68039f80e28fb6279` |
| GitHub Release | `https://github.com/Sheshiyer/plexus-ts/releases/tag/v0.7.4` |

`verify-release-ref --mode public` passed against the public `v0.7.4`
manifest. It streamed the declared DMG and ZIP, matched their byte lengths and
SHA-512 values, verified both blockmaps, required immutable versioned-object
cache policy, and required the manifest's short revalidation policy.

## Candidate preparation probes

Run these against the exact clean candidate commit:

```bash
node scripts/verify-release-ref.mjs --mode prepare
npm run release:ota:prep
npm run release:ota:prep:full
```

The full gate must produce `release/latest-mac.yml` with version `0.7.5` and
pass arm64 architecture, Electron fuse, packaged SQLite, packaged main-process,
and packaged renderer probes. These are unsigned package checks, not signed
OTA acceptance evidence.

## Signed upgrade receipt — protected release step

Record each result after the protected publisher succeeds:

1. Before launch, record the installed bundle version as `0.7.4`.
2. Record a pre-upgrade local-state fingerprint without copying credential values.
3. Launch the signed installed baseline on the production `latest` channel.
4. Use **Check for updates** and record the offered version as `0.7.5`.
5. Confirm the available prompt does not download automatically.
6. Choose **Download update** and record successful completion.
7. Confirm the downloaded prompt does not restart automatically.
8. Choose **Install & restart** and record normal process exit.
9. After relaunch, record bundle and Settings versions as `0.7.5`.
10. Recompute the local-state fingerprint and confirm expected work data remains readable.
11. Record the Release Candidate run, Publish OTA run, protected approval, release URL, and public manifest.

Until all eleven results exist, describe the work as prepared or published,
not as an end-to-end OTA upgrade proof.

## Local-state fingerprint

The fingerprint is evidence of continuity, not a backup. Record only bounded
metadata and hashes; never copy tokens or secrets into this packet.

```bash
support_root="$HOME/Library/Application Support/plexus-ts"
find "$support_root" -maxdepth 2 -type f \
  \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) \
  -exec shasum -a 256 {} \;
```

Run the command immediately before the signed upgrade and again after relaunch.
If the application migrates a database intentionally, supplement the hashes
with a read-only record-count probe rather than expecting byte identity.

## Rollback decision

Plexus does not claim automatic rollback. If `v0.7.5` fails to launch or
preserve readable work data:

1. Stop publication claims and preserve updater/application logs.
2. Reinstall the retained signed `v0.7.4` DMG for the immediate canary recovery.
3. If the failure implicates the post-`v0.7.1` runtime line, restore the public
   manifest to the retained signed `v0.7.1` repository baseline using the
   documented rollback procedure.
4. Verify Gatekeeper, launch, version, and local-state readability before
   resuming rollout.

Never rebuild an already-published version or overwrite its immutable objects.
