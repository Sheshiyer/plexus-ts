# P6 native R2 route repair packet

Prepared 2026-09-05 against the inspected sibling Worker source. This is a
reviewable source/ownership proposal; no patch, DNS change, domain attachment or
Worker deployment has been applied. [Issue #156](https://github.com/Sheshiyer/plexus-ts/issues/156)
owns transport acceptance (ISC-255).

## Proposed owner

Attach `plexus-upgrade.thoughtseed.space` directly to the Labs `plexus-updates`
R2 bucket, preserving `/plexus/<artifact>` object paths. Keep the two Workspace
API custom domains on their existing Worker. Keep the legacy public feed intact.
Native R2 reduces the required proxy implementation, but still requires explicit
cache metadata, public transport tests and exact hostname ownership evidence.

The inspected `cloudflare/worker/wrangler.labs.jsonc` declares this hostname as a
Worker custom domain even though the fresh account readback does not register
it. The [minimal patch](patches/P6-native-r2-domain-owner.patch) removes only
that future Worker claim. A scratch-copy `git apply --check` passes. The canonical
Worker Git/deployed revision is still unverified; the sibling directory is not
an authoritative deploy checkout. Revalidate the file digest before integration.

## Preconditions for the concrete change

1. Obtain the exact `plexus-upgrade.thoughtseed.space` DNS record, record ID/type,
   zone/account ownership, proxy flag and rollback export. The tested Labs OAuth
   profile still returns403 for this exact read; do not infer a target from an
   edge IP or fabricate a DNS deletion.
2. Review the scoped object inventory, manifest contents and conflict exclusions.
   Labs currently lacks0.7.9–0.7.12 artifacts and its latest manifest is older.
   A bucket attachment must not be mistaken for manifest/copy acceptance.
3. Confirm the canonical Worker checkout and deployed revision. Apply the
   route-ownership patch there as part of coordinated ownership. Preserve both
   API domains, Access configuration and application data.
4. Prepare the native R2 custom-domain attachment and exact DNS reconciliation,
   with the previous hostname state retained for rollback. Do not manually CNAME
   to the personal r2.dev URL. Labs r2.dev can remain disabled.
5. Validate object Content-Type and Cache-Control. Versioned binaries/blockmaps
   require immutable caching; mutable channel manifests require short caching
   and revalidation. Copying bytes alone does not fix metadata drift.

## Acceptance packet

- Manifest GET returns parseable expected version, size and SHA512 references;
  HEAD has consistent content type/length without an interactive Access challenge.
- Referenced ZIP, DMG and blockmaps return expected byte digests and metadata.
- Real updater Range requests return206, exact Content-Range/length and bytes;
  test suffix/invalid ranges, empty/missing keys and conditional requests.
- A manifest refresh cannot remain behind an immutable cache. Record configured
  rules and public responses separately from R2 object metadata.
- Preserve both old-client discovery paths and publish no newer manifest until
  its signed artifacts are identical and available on both required feeds.
- Record hostname rollback independently of manifest rollback. P6 remains open
  until installed-cohort and subsequent Labs discovery acceptance is recorded.

## Why the current proxy is not the minimal fix

Inspected source anchors: `src/routes/upgrade.ts:25` has no Request argument;
`:53` calls R2 get although `src/lib/env.ts:12–14` declares only head; `:71–72`
special-cases only latest-mac.yml for short caching; `:86–88` uses contentLength
instead of size; `:91` always returns200. `src/index.ts:20–54` handles shared API
routes before hostname dispatch. These are source findings, not live defect
claims. Retaining the proxy requires typed GET/HEAD/range/conditional handling,
path validation and cache-policy fixtures before a shared API deployment.

The narrow config patch does not remove or fix this dead/inactive proxy source;
canonical-source cleanup and its typecheck remain an explicit follow-up. Do not
claim that a four-line route diff makes the Worker build or transport accepted.
