# P8 — Governed Clio

Status: planned; implementation and live acceptance pending.
Acceptance: [ISA](../../ISA.md), ISC-278–281. This is W2 of the
[connected-operations overview](P7-connected-operations.md).

## Objective and ownership

An active member receives a content-bearing Clio response through an explicitly
compatible desktop, relay and upstream contract. Every exposed operator action
has an owning executor, authorization boundary and audit trail.

Accountable owner: Plexus desktop maintainer. Contract co-owner: Hermes Clio relay
maintainer; upstream catalog/routing owner supplies its versioned contract and
runtime receipt. The owning API maintainer approves each operator capability.

## Scope and dependencies

- Inventory and version the desktop lane names, relay catalog, upstream routes,
  Access issuer/audience and member binding. Keep Clio's existing `te-*` contract
  distinct from Mac `noesis-*` routing until coordinated migration is accepted.
- Map each exposed capability to its registered executor, input/resource scope,
  allowed role, side effect and audit result. Unknown or unconfirmed executors
  remain unavailable; broad vault operator promises do not confer API authority.
- Source/fixture work can run alongside P7. Installed actor proof requires P7's
  accepted identity, bridge and canonical-project boundaries and a pinned service
  inventory. P6 supplies the signed distribution path for final installed proof.

## Execution package

1. Record exact source/configuration revisions for desktop, relay and upstream;
   resolve catalog differences into a reviewed compatibility matrix.
2. Define positive and negative contract fixtures before changing either end.
   Separate model transport from tools that can change state.
3. Implement only the agreed compatibility and capability contracts in their
   owner repositories, including truthful renderer status and redacted audits.
4. Run owner-local tests, then exercise the accepted installed binding with a
   synthetic employee and denied actor. Record stream content and event/audit
   correlation without credentials or private prompt bodies.

## Fixtures and acceptance probes

| Criterion | Required proof |
| --- | --- |
| ISC-278: The desktop, Clio relay and upstream catalog pass an explicit versioned lane-compatibility contract. | Matching supported lanes succeed; missing, renamed, unsupported and stale contract versions fail explicitly. Capture each owner's revision and catalog contract. |
| ISC-279: An active installed member completes a content-bearing authenticated Clio stream through the accepted relay binding. | Installed employee receives actual streamed content; wrong audience, inactive/unauthorized actor and expired binding are rejected. HTTP success alone is insufficient. |
| ISC-280: Each exposed Clio operator capability has a bounded authorization and audit contract at its owning API. | Exercise the capability matrix for employee/admin, wrong tenant/project and malformed input; denied requests produce no side effect and attributable audit results. |
| ISC-281: Capability availability labels match their registered confirmed executors. | Compare displayed available/unavailable/degraded labels with executor registration and confirmation; missing or failed executors cannot appear ready. |

## Live gates and phase exit

Pin the deployed relay/upstream revisions and accepted Access binding before live
acceptance. Provider/account changes, deployments and real action-capability
execution require their owner-scoped execution packet; this plan performs none.
Use synthetic content and read-only capabilities first. Preserve the prior
compatible binding and document configuration rollback before any migration.

Exit only when ISC-278–281 have criterion-specific receipts for the accepted
configuration. Source tests and catalogs remain local/contract evidence until the
installed stream succeeds. Hand the accepted binding and capability matrix to
[P9](P9-reporting-receipts.md) and [P12](P12-installed-acceptance.md).

## GitHub work packages

Phase epic: [P8](https://github.com/Sheshiyer/plexus-ts/issues/150). Current links and dependencies: [GitHub roadmap](../GITHUB_ROADMAP.md).

- [P8-TRANSPORT](https://github.com/Sheshiyer/hermes-aws-ts/issues/156): Accept Clio relay identity and versioned catalog compatibility — Blocked dependency.
- [P8-TOOLS](https://github.com/Sheshiyer/plexus-ts/issues/164): Bound Clio operator capabilities and correct availability labels — Ready local.
