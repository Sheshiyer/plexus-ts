# Isolated signed OTA test publication packet

Prepared 2026-10-24. Plan only: no uploads, tags, merges or feed changes performed.

## Destination and custody

The pinned public stable feed belongs to legacy account `9d9d23b27f32e70ae3afb6a1aa2c0f10`, bucket `plexus-updates`. Labs account `9d7cec1b5a32b2df8c6cdc1321ccd00b` is a separate authority; its same-named bucket is not interchangeable. Existing `scripts/verify-ota-target.mjs` pins the legacy account.

Proposed test prefix: `plexus-tests/0.7.14-20261024`. Proposed HTTPS test feed: `https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus-tests/0.7.14-20261024`. Stable `plexus/latest-mac.yml` remains 0.7.13 and must not be written. Test objects are publicly downloadable by URL; prefix isolation does not provide privacy.

Metadata-only inventory found Wrangler configuration filenames `9d9d.toml`, `personal.toml`, and `thoughtseed-labs.toml` under `~/Library/Preferences/.wrangler/config/`. Presence does not establish current authentication. AWS config lists default/safvr; credential profiles list only default. No dedicated R2 AWS profile was found. Generic R2 credential variable names exist in the protected local credential source, alongside unrelated client names; no credential values were printed or assigned to this account. Do not use client credentials or assume EC2 safvr authenticates R2.

The command profile `plexus-ota-legacy` below is a PROPOSED protected AWS profile, not an existing credential claim. Its secure provisioning and read-only destination proof are prerequisites. Do not source private credential files into a shell. Validate the intended R2 credential by reading stable manifest bytes and comparing them with the pinned public feed; stop on denied access or mismatch.

## Fresh read-only authority check

Existing Wrangler `--profile 9d9d` successfully listed the legacy bucket and read its stable manifest with explicit account selection, without a new profile or secret mapping:

```bash
CLOUDFLARE_ACCOUNT_ID=9d9d23b27f32e70ae3afb6a1aa2c0f10 \
  npx wrangler r2 object get plexus-updates/plexus/latest-mac.yml \
  --remote --file /tmp/plexus-ota-legacy-readonly.yml --profile 9d9d
```

Independent public fetch returned HTTP 200 and exactly the same 510 bytes, version `0.7.13`, SHA-256 `e645820d12b37cc65488aa1d9a9a541d1a5a7d8c0d8aec6ee4adcad6ae7c86a7`. This proves existing OAuth read access to the actual public stable-feed bucket. Installed Wrangler does not support `whoami --profile`; that rejected command was not used as authority evidence. No global profile switching occurred.

Installed Wrangler 4.124.0 `r2 object put --help` exposes no conditional-write flag. Cloudflare's [REST upload contract](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/upload/) does not document `If-None-Match`. Its [S3 extensions contract](https://developers.cloudflare.com/r2/api/s3/extensions/#conditional-operations-in-putobject) explicitly guarantees atomic create-once `If-None-Match: *` semantics. OAuth read authority therefore does not establish a supported create-only upload route. No write probe was attempted.

**Current publication blocker:** no verified S3 credential profile exists for the conditional upload template below. Securely provision/validate that authority, or independently establish a supported conditional OAuth upload contract before publication. Do not substitute unconditional Wrangler upload or an existence-check-then-write race. Read-only mapping is complete; publication remains gated by this capability and exact signed artifact approval.

## Approval boundary

Before any upload, bind the exact candidate source SHA, reviewed artifact directory, notarization/stapling/Gatekeeper success, team `BS6SZR4929`, normal bundle ID `space.thoughtseed.plexus`, and exact artifact names/sizes/SHA-256/SHA-512 and manifest bytes. Source checks and a signing attempt are not artifact acceptance. Obtain explicit approval for only this test prefix and those hashes. Stable publication, GitHub release, tag, merge, DNS change and Labs migration require separate authority.

## Corrected signed candidate for review

Source `d920616` fixes the demonstrated shared Access relay callback cancellation. Its signed/notarized normal-ID0.7.14 app is installed and completes real owner sign-in; the exact encrypted credential and actor/workspace survive normal quit/reopen. Visible workspace reopen confirmation is still pending. All128 packaged dist files match the tested build, all16 native binaries are arm64, and packaged SQLite/isolated renderer checks pass. Apple accepted submission `123894a6-7a69-4946-9855-174e47c48399`. The installed app, mounted corrected DMG app and extracted corrected ZIP app pass expected-team signature, stapled-ticket and Gatekeeper checks.

Reviewed local artifact directory: `/private/tmp/plexus-0714-callback-archives-20261024`. These bytes supersede the initial callback-broken archives; do not select the older archive directory. Exact SHA-512 values and matching manifest metadata are retained in [the corrected candidate receipt](2026-10-24-0714-callback-candidate.json). This packet is preparation, not upload authorization.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `Plexus-0.7.14-mac-arm64.zip.blockmap` | 169538 | `17dfaa33306fd3f0066b4005311c4f6be1500fffe70ddff0bf65d00cdf57d2d4` |
| `Plexus-0.7.14-mac-arm64.dmg.blockmap` | 169470 | `c0dea31167d44b4e6a066091af61262289a7d0fcb8d6af62c7915be2e9e7c40b` |
| `latest-mac.yml` | 510 | `a0cc5b24b23b123bd5b5be7ff991c4049a43568477d39f1a3325cbdc06aaf08a` |
| `Plexus-0.7.14-mac-arm64.dmg` | 165317559 | `73e6d4aac9ceb1ffd60fda8ca39ec86e0860055d6586d3c6175d96013a01e90a` |
| `Plexus-0.7.14-mac-arm64.zip` | 162046406 | `300396fc83034b656ecb1b73e0c1b99636911db5abadf02e4740a49680a82371` |

## Exact command template after approval

Run from the reviewed 0.7.14 checkout with `ARTIFACT_DIR` bound to the verified signed output. Require current AWS CLI supporting conditional create. Stop on any existing object; an identical retry requires separate comparison rather than overwriting. Manifest paths must be relative artifact basenames. These commands are a template to review, not executed evidence.

```bash
set -euo pipefail
: "${ARTIFACT_DIR:?Set the reviewed signed artifact directory}"
export AWS_EC2_METADATA_DISABLED=true
r2_endpoint=https://9d9d23b27f32e70ae3afb6a1aa2c0f10.r2.cloudflarestorage.com
test_prefix=plexus-tests/0.7.14-20261024
test_feed=https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus-tests/0.7.14-20261024
receipt_dir=$(mktemp -d /tmp/plexus-test-publication.XXXXXX)

# Read-only account-to-public-feed proof before upload.
aws --profile plexus-ota-legacy --endpoint-url "$r2_endpoint" s3api get-object \
  --bucket plexus-updates --key plexus/latest-mac.yml "$receipt_dir/stable-before.yml"
curl --fail --silent --show-error \
  https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus/latest-mac.yml \
  --output "$receipt_dir/public-before.yml"
cmp "$receipt_dir/stable-before.yml" "$receipt_dir/public-before.yml"

for artifact in "$ARTIFACT_DIR"/*.dmg "$ARTIFACT_DIR"/*.zip "$ARTIFACT_DIR"/*.blockmap; do
  test -f "$artifact" || exit 1
  artifact_name=${artifact##*/}
  artifact_digest=$(shasum -a 256 "$artifact" | awk '{print $1}')
  case "$artifact" in
    *.dmg) artifact_type=application/x-apple-diskimage ;;
    *.zip) artifact_type=application/zip ;;
    *) artifact_type=application/octet-stream ;;
  esac
  aws --profile plexus-ota-legacy --endpoint-url "$r2_endpoint" s3api put-object \
    --bucket plexus-updates --key "$test_prefix/$artifact_name" --body "$artifact" \
    --content-type "$artifact_type" --cache-control 'public, max-age=31536000, immutable' \
    --metadata "sha256=$artifact_digest" --if-none-match '*'
done

# Verify actual public artifact hashes before committing the isolated manifest.
node scripts/verify-release-ref.mjs --mode artifacts \
  --manifest "$ARTIFACT_DIR/latest-mac.yml" --feed-url "$test_feed"
aws --profile plexus-ota-legacy --endpoint-url "$r2_endpoint" s3api put-object \
  --bucket plexus-updates --key "$test_prefix/latest-mac.yml" \
  --body "$ARTIFACT_DIR/latest-mac.yml" --content-type text/yaml \
  --cache-control 'public, max-age=60, must-revalidate' --if-none-match '*'
node scripts/verify-release-ref.mjs --mode public \
  --manifest "$ARTIFACT_DIR/latest-mac.yml" --feed-url "$test_feed"
curl --fail --silent --show-error \
  https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus/latest-mac.yml \
  --output "$receipt_dir/public-after.yml"
cmp "$receipt_dir/public-before.yml" "$receipt_dir/public-after.yml"
```

Use artifacts/public modes for actual public bytes/cache/digests. Do not manufacture main/tag proof or use stable publication mode for this isolated candidate. Preserve sanitized receipts and the stable-before digest.

## Installed normal-identity upgrade test

Verified directly from v0.7.13 source: packaged custom HTTPS feeds require BOTH flags below. Quit the current app normally first; an existing single-instance owner will not acquire another process's environment. Use a separately reviewed canary with both an isolated `PLEXUS_DB_PATH` and separate Electron `--user-data-dir`. Never point0.7.13 at the owner's current work database or copy/decrypt a different member's credential into the canary. Preserve the corrected installed app and its normal profile. Confirm the selected canary binary is signed normal-ID0.7.13 before launching it. The variables below must identify pre-created reviewed canary paths, not the normal database/profile:

```bash
: "${CANARY_DB_PATH:?Select the reviewed isolated database}"
: "${CANARY_USER_DATA_DIR:?Select the reviewed isolated Electron profile}"
: "${CANARY_APP_PATH:?Select the reviewed signed0.7.13 canary app}"

PLEXUS_DB_PATH="$CANARY_DB_PATH" \
PLEXUS_ALLOW_CUSTOM_UPDATE_FEED=1 \
PLEXUS_FORCE_UPDATE_CHECK=1 \
PLEXUS_UPDATE_FEED_URL=https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus-tests/0.7.14-20261024 \
  "$CANARY_APP_PATH/Contents/MacOS/Plexus" --user-data-dir="$CANARY_USER_DATA_DIR"
```

These flags allow the test feed, retaining unsigned-update safeguards. Keep the latest channel. Capture 0.7.14 offer, explicit download, verified completion, separate install consent, actual quit/relaunch, installed version/signature and preserved account/workspace/history. HTTP download alone is not installed acceptance. After success, quit normally and relaunch without the flags: 0.7.14 returns to pinned stable with downgrade disabled.

Stop a failed test by quitting the test process. Retain immutable artifacts and receipts; cleanup requires exact-prefix approval. Rollback means separately authorized reinstall of the retained signed prior app with data compatibility/backup review, not an OTA downgrade or stable manifest overwrite.
