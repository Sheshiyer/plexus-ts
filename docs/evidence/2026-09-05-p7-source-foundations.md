# P7 source foundations — 2026-09-05

Status: reviewed source candidates; phase and integrated acceptance remain open.
Plexus base: `3fa055c59e6ca3a65d202821bbc59b9a4ab07831`, branch
`codex/labs-migration-preflight-20260905`. Cambium base:
`746acf814b4ffce1a6ccef295ba1f4b0a09760b6`; candidate
[`1ee87a5`](https://github.com/Sheshiyer/cambium/commit/1ee87a5) on
`codex/plexus-admission-contract-20260905`. The enclosing Plexus commit identifies
this source checkpoint without a self-referential hash.

## Implemented and verified

- Plexus persists nullable `clientId`, `workspaceId`, `mappingSource` and
  `mappingCheckedAt` through schema migration, insert, update, list and reopen.
  Missing backend identity clears old values. Local settings never fill these
  identity fields. Successful empty mapping responses remain authoritative empty
  reads; malformed/failed responses may use explicitly labeled `worker_summary`
  fallback. Neither provenance value is an authorization grant.
- Cambium's [versioned contract](https://github.com/Sheshiyer/cambium/blob/1ee87a5/docs/architecture/contracts/plexus-work-reference-v1.md)
  verifies an exact canonical WorkObject/node against a consistent committed
  tenant graph. It requires a trusted exact-tenant principal, explicit expiring
  server-resolved resource grant, and expected graph version/digest. Read-only
  head/nodes/head snapshots and existing digest recomputation fail closed on
  invalid, stale, changing or mismatched evidence.
- Cambium returns only `graph-reference-verified` and bounded identifiers. It
  provides no action capability, execution admission, endpoint, grant issuer or
  successful-result cache. Existing wildcard principals cannot satisfy it.

## Verification evidence

| Check | Result |
| --- | --- |
| `npx vitest run test/main/project-identity-retention.test.ts --no-file-parallelism` | 16 passed; real isolated SQLite and real sync with synthetic HTTP fixtures, including legacy migration and reopen |
| `npx tsc --noEmit` and main-project `tsc --noEmit` | Passed |
| Scoped ESLint on the four Plexus source/test files | Passed |
| Cambium resolver, compiler, store and Plexus-gate Node suites | 55 passed: 24 new and 31 existing |
| Independent source reviews | No concrete findings in either bounded change; Cambium new suite also rerun 24/24 |
| Whitespace and documentation checks | Passed; 192 documents, zero errors/link limitations, 7 verifier tests passed |

The related Plexus `repo-verify-retry.test.ts` suite still fails two source-text
assertions that expect obsolete inline verification in `main.ts`. Both files
are byte-identical to parent HEAD, where `verifyAndPersistProjectRepository`
already replaced that inline code. They were left untouched; no claim of a
fully green repository test suite is made. Follow-up must preserve persistence
coverage for both success and failure rather than merely weaken assertions.

## Worker provenance remains unresolved

The [source readback](2026-09-05-p7-worker-source-readback.json) compares local
migration files with `Sheshiyer/team-forge-ts` main
`439cb074d2f6ed432d301c1e83cabf41717d6387`. Project routes match Git blob identity;
entry point and sync-control-plane differ; the Labs config is absent remotely.
The local directory is not a Git checkout. Finding a repository is not proof
that it contains the deployed revision. ISC-271 remains open.

## Next implementation boundary

Follow the [P7 continuation packet](../../.planning/P7-identity-continuation.md).
Retained identity fields do not enforce authorization. Removed/inactive mappings
are not reconciled yet; cached project consumers still lack a shared current
mapping check. The trusted Cambium adapter and resource-grant authority must be
implemented before desktop integration, followed by action-specific admission.

All 52 operational/historical criteria remain pending; ISA stays 337/389.
ISC-275, ISC-276 and ISC-277 are not closed by these local prerequisites. P6
transport/parity/bridge/signing and App/installed acceptance retain their gates.
No deployment, remote data write, secret mutation or external delivery occurred.
Original Plexus and Cambium checkout WIP is preserved; integration into main is
separate from publishing these review branches.

## Routing receipt

The bounded OmniRoute Build attempt failed with an upstream Antigravity tool
schema error and reached its timeout. In-session workers performed the source
implementation and review. No successful external provider resolution is claimed.

## Roadmap readback

Project 17 readback confirms P7 epic #149, mapping #160 and Cambium #371 are
In Progress. Cambium is Review pending; mapping and phase retain Blocked
dependency for integrated acceptance. All three issue bodies contain this source
checkpoint, and no acceptance checkbox or issue was closed. Both original
checkout WIP inventories/hashes were checked unchanged before publication.
Cambium Project 14 also reads back #371 as In Progress. NEXT-WAVE preserves
the verified source wave and advances to the current-authority contract packet.
