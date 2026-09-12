# P6 — Labs migration residuals and OTA acceptance

Status: preparation verified; live cutover pending.
Authority: `ISA.md`, ISC-247 through ISC-262, continuing CF-6/CF-7 of the existing
August Hermes/Plexus/Cambium relocation plan.
Routing: bounded implementation `noesis-build`; parallel execution `noesis-execute`;
verification `noesis-verify`. A resolved provider/attempt receipt is required to
claim routed work. The September routed build was unavailable; local fallback
verification does not change that result.

## Current position

- API/Access is on Labs; current runtime source is v0.7.12 at `e8d3a74`.
- Installed v0.7.9–v0.7.12 read the personal account's public R2 feed.
- Labs remote latest manifest is v0.7.8, versus public personal feed v0.7.12.
- Labs custom OTA host fails at the edge with Error 1000; Labs r2.dev is disabled.
- Historical ISA reconciliation closes ten old criteria (313/327 before new ISCs).
- Five GitHub environment secret values remain user-owned; name-only inventory
  cannot confirm the account/bucket values of the four existing entries.

## First execution — 2026-09-05

See the [fresh object/route receipt](../../docs/evidence/2026-09-05-p6-first-execution.md),
[route packet](../P6-route-repair-packet.md) and [partial copy candidates](../P6-copy-candidates.json).
P6-05/06 are underway; neither exit is accepted. The key inventory is complete,
byte proof is bounded, and metadata differences require review before delivery.

## Completed preparation

- [x] P6-01: Reuse CF-4/CF-5 evidence; record current ownership and manifest divergence.
- [x] P6-02: Prepare Labs-only cleanup with protected environment, dry-run default,
  exact key scope, active-channel/rollback protection, and failure propagation.
- [x] P6-03: Reconcile runbook default feed and both historical client cohorts.
- [x] P6-04: Reconcile historical release evidence without relaunching old publications.

## Pending sequence

| Task | Next action | Exit evidence | Dependency |
| --- | --- | --- | --- |
| P6-05 | Obtain exact DNS read; prepare repair (Worker list lacks upgrade host; zone GET403) | Reviewed route change packet resolving Error 1000 at its owner | Live routing action remains separate |
| P6-06 | Enumerate exact OTA source/target objects; classify by key, size and digest | Approved copy allowlist; no unresolved conflicts | Read/list authority; metadata parity is insufficient |
| P6-07 | Recover stable Labs file delivery and reconcile approved objects | Manifest + ZIP/DMG/blockmaps; bytes, HEAD/range, cache checks pass | P6-05/06; reviewed routing/data changes |
| P6-08 | Prepare one bridge release >0.7.12, pin Labs feed, support both historical publication paths | Reviewed source and publisher/second-target procedure | P6-07; user secret/account coordination |
| P6-09 | Publish and exercise both old-client cohorts | Signed artifact and installed consent/continuity/Clio receipts | Signing + protected publication |
| P6-10 | Verify subsequent discovery from Labs, then decide dormant-client retention | Labs discovery trace and explicit legacy-retention policy | P6-09 |

No automatic work wave may interpret these pending live actions as approved
merely because they appear in planning. The user's current continuation covers
the scoped preparation; credentials remain with the user. Retain source feeds,
old objects, rollback configs and prior planning/evidence.

## Backend acceptance corrections

The old Cluster B example names `plexus-db` and a speculative installation
table. Actual Labs configuration binds `teamforge-primary` at
`613f3e80-0dd5-4740-bccf-8c5913dd5d2e` in the sibling TeamForge Worker.
For future read-only SQL, use profile `thoughtseed-labs` plus the explicit
`cloudflare/worker/wrangler.labs.jsonc`, inspect actual migrations/schema, and
select only the fields needed for the pinned owners. Avoid `SELECT *` and do not
repair permission truth with D1 writes. GitHub App secret names now exist, but
App JWT/permissions/installation-token and authenticated desktop proof remain
unverified and user-owned.

If retaining the Worker OTA proxy, its source currently fails typecheck because
the R2 abstraction lacks `get`. Correct Request/method/range/conditional handling,
`size` metadata and supported manifest cache policy before deployment. A native
R2 custom domain is an alternative; do not leave a conflicting Worker route that
can reclaim that hostname on future deployment.

## Evidence

- `docs/evidence/2026-09-05-labs-migration-review.md`
- `docs/evidence/2026-09-05-labs-migration-historical-runs.json`
- `npm run test:release-ops`: fake-AWS tests, no cloud mutations.
- ISA verification entries distinguish historical GitHub proof, fresh metadata
  probes, local source tests, and pending deployed/installed acceptance.

## GitHub work packages

Phase epic: [P6](https://github.com/Sheshiyer/plexus-ts/issues/148). Current links and dependencies: [GitHub roadmap](../GITHUB_ROADMAP.md).

- [P6-RELEASE](https://github.com/Sheshiyer/plexus-ts/issues/155): Protected release custody and historical proof disposition — Operator gate.
- [P6-ROUTE](https://github.com/Sheshiyer/plexus-ts/issues/156): Repair and accept Labs OTA transport — Operator gate.
- [P6-OBJECTS](https://github.com/Sheshiyer/plexus-ts/issues/157): Reconcile OTA objects and immutable rollback baseline — Ready local.
- [P6-BRIDGE](https://github.com/Sheshiyer/plexus-ts/issues/158): Prepare and publish the dual-feed signed migration bridge — Blocked dependency.
- [P6-COHORTS](https://github.com/Sheshiyer/plexus-ts/issues/159): Verify both installed upgrade cohorts and legacy retention — Blocked dependency.
