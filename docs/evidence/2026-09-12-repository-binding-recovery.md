# Repository binding recovery — 2026-09-12

Status: native sync failure reproduced; paired source fixes committed, pushed and
reviewed. Deployment and a matching installed fresh-profile probe remain open.
This supersedes the earlier same-day repository-readiness observation in the
[installed acceptance receipt](2026-09-12-local-installed-acceptance.md).

## Cause and observed behavior

The deployed Worker verifies selections and stores project GitHub verification
in Labs D1. Its project-mapping GET builds descriptive links without projecting
that verification. The installed desktop therefore cannot restore the full
verified tuple on a fresh database; old graph URLs can overwrite local selections
on sync. A repository URL in the vault or graph is not verification.

Computer observed readiness rise from zero to four of twenty projects. Two
selections were made by the user while the app was open; the assistant verified
one selection and reverified an existing backend binding after the user's
explicit resolution of a vault conflict. Sync then reduced readiness to two of
twenty, while read-only Labs D1 retained all four verification rows. These are
dated observations of the old installed build, not hard-coded product counts.
No timer, manual work record, model prompt or report was created.

An exact-ID local crosswalk joined 18 of 20 projects to vault briefs and recorded
35 distinct candidate URLs with 22 source hashes. Candidates remain proposals;
ambiguous, missing and unavailable repositories were not silently admitted.
Both source repositories are public. Client mappings, the owner's conflict
choice, raw deployment content and visual review remain in private local evidence.
No direct D1 permission or project-graph mutation was used.

## Source and deployment authority

| Surface | Evidence | State |
| --- | --- | --- |
| TeamForge source base | `439cb074d2f6ed432d301c1e83cabf41717d6387` | Canonical GitHub main read |
| Worker source candidate | `bcc11669446f188a5c3a7161cc1ee20ba7a9bede`, [PR #102](https://github.com/Sheshiyer/team-forge-ts/pull/102) | Pushed draft; not deployed |
| Desktop source candidate | `cd5e38cb8e4e5fd9570663b062baf1be68078abd`, [PR #171](https://github.com/Sheshiyer/plexus-ts/pull/171) | Pushed draft stacked on the local-acceptance branch; not installed |
| Installed candidate | v0.7.12 from `cf8b71cb5095418cb0fded8cd53ec8ea48f3535f` | Earlier ad-hoc artifact; reproduces missing projection |
| Labs deployment | `ed7f7ecd-f491-4591-9d7a-c82668d92870` | Observed deployment, created August 12; exact source commit not established |

The downloaded deployed Worker multipart SHA-256 is
`8f4deb50590ca1c68d55db2f589db7db25b5074db06428c355ee8f407a5cae44`.
Inspection confirms both the verification write route and the missing mapping
hydration. A first literal-route search missed a regular-expression route;
it was corrected by inspecting the actual handler and call chain.

The non-Git sibling Worker directory is incomplete against canonical main.
Canonical main's default Wrangler database is legacy; the local Labs configuration
is absent from that main. Deployment must reconcile source, bindings and secrets
against the Labs target and retain the current deployed version for rollback.
Neither the local directory name nor an OAuth profile makes default config safe.

## Paired contract

The Worker returns a graph-level `repositoryVerification` envelope with version,
status and checkedAt, plus the complete tuple on `graph.project`. Projection
rechecks current D1 actor/workspace, active project, installation policy, signed
installation facts and repository inventory. Denial returns explicit status and
cleared tuple fields. Queries batch project IDs; no per-project GitHub API request
is added. Assigned visibility remains fail-closed until its resolver exists.
Current D1 facts do not prove freshness of the external provider itself.

Desktop sync hydrates only an eligible Worker mapping projection. Explicit
unverified, revoked, malformed or unsupported proof clears cached repository
authority while retaining work. A summary fallback cannot create or renew proof.
Legacy unmarked responses remain compatible, so deploying only one side does not
establish fresh-profile acceptance. Missing/inactive mapping reconciliation,
shared consumer guards, expiry and account-switch/queued actor binding remain
broader P7 work; this slice does not close ISC-275.

## Validation

| Check | Result |
| --- | --- |
| Worker typecheck and full Worker suite | Pass; 223 tests in 17 files, including 25 projection cases |
| Desktop identity, hydration, sync and repository-security suites | Pass; 108 tests in 5 files, including 33 real SQLite hydration cases |
| Desktop main TypeScript, scoped ESLint and diff checks | Pass |
| Independent source review | Nullable inventory default-branch finding fixed and regression-tested; final review found no further concrete issue |
| Native verification and Labs D1 readback | Four persisted bindings; old sync reproduced loss of two displayed ready states |
| Documentation catalog, links and verifier regression suite | Pass; 194 documents, zero errors; 7 tests |
| Deployed paired contract / new installed fresh profile | Not performed |

Two previously documented source-text failures in repo-verify-retry.test.ts remain
outside the focused desktop selection. The whole desktop repository is not
claimed green. No schema, secret, Access policy, signing, release, merge or
production deployment changed.

## Visual-flow review and next acceptance

The requested Luna high agent inspected the Infinite Engine whitepaper and
Cambium visual-flow source/assets, including 32 images. Its private review maps
candidate → admitted project → installation/repository → activity → receipt,
with explicit pending, verified, revoked and stale states. Map, Sheets, Activity
and Receipts are presentation proposals. The assets are conceptual lenses,
not runtime proof; example project counts are dated fixtures.

ISC-317, 318, 319, 320 and 322 close this bounded mapping investigation, source
fixture and visual-review slice. ISC-321 belongs to [P7-MAPPING #160](https://github.com/Sheshiyer/plexus-ts/issues/160)
and remains open for the paired deployed/installed test. ISA is 350/403;
53 criteria remain open, including all 52 prior operational criteria.

Next follow [the P7 continuation](../../.planning/P7-identity-continuation.md):
review Labs deployment configuration, integrate the paired source, deploy and
install the matching candidate, then restore saved selections in a fresh profile
and sync twice. Revocation must withdraw readiness without deleting work.
Clio authentication and P6 signed OTA migration remain separate open boundaries.
