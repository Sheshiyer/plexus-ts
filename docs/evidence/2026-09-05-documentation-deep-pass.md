# Repository documentation deep pass — 2026-09-05

## Scope and authority

Local documentation and guard maintenance on
`codex/labs-migration-preflight-20260905`, after migration commits `ddeb49d` and
`9334ecc`. Application source baseline remains `e8d3a74` (v0.7.12).
The [documentation map](../DOCUMENTATION_MAP.md), [catalog](../DOCUMENTATION_CATALOG.md)
and [ISA](../../ISA.md) establish navigation, roles and acceptance.

Three parallel reviewers covered release/setup guidance, runtime/architecture,
and historical plans/design/evidence. The parent reconciled planning, acceptance,
catalog policy, drift checks and CI wiring. Independent follow-up review caught
and corrected non-strict index classification, a Windows-incompatible CLI fixture,
and checks that could accept commented CI commands, no-op scripts or an empty ISA.

## Result

- Current setup, handoff, release, reporting and runtime guidance now distinguish
  configured source, dated observations and pending deployed/installed proof.
- Historical plans have dated status banners and indexes. Their 206 unchecked
  tasks remain historical intent; none was silently completed or admitted.
- Active planning has one P6 phase; old August gap documents point to the retained
  full snapshot. Acceptance counts come from ISA instead of competing queues.
- The former product roadmap is archived with relative links adjusted for its
  new location. Its dated claims no longer form the active product status table.
- [Source follow-ups](../../.planning/documentation-followups.md) preserve newly
  identified implementation discrepancies without claiming they were repaired.
- CI now invokes documentation verification/tests and release-operations tests.
  The POSIX fake-AWS CLI test skips Windows; pure runner tests remain portable.

## Verification

- `npm run verify:docs`: complete catalog, no unclassified documents, no missing
  local Markdown file targets in either current or historical material.
- `npm run test:docs`: seven fixture-based tests cover link, classification,
  catalog, feed, version, ISA, phase, package-script and CI-command drift.
- `npm run test:release-ops`: fifteen local tests pass on macOS; no cloud mutation.
- Existing release-evidence and release-candidate policy verifiers pass. They
  check documentation/source policy, not a fresh signed or deployed release.
- ESLint passes for the three changed/new JavaScript test/verifier files;
  `git diff --check` passes. Application `src/` is unchanged by this pass.
- SHA-256 comparison of 344 pre-existing historical-scope files: 307 unchanged;
  37 restore their exact original bytes after removing only the added banner.
  This includes 245 unchanged evidence artifacts and 13 unchanged project-memory
  records/assets. New navigation indexes are separate files.
- The five pre-existing modified root-checkout files match the pre-pass hashes.

The generated catalog and verifier report give exact current counts. ISC-263–270
record this pass; broader migration acceptance remains open.

## Limits

No deployment, publication, secret change, infrastructure cleanup or authenticated
user acceptance occurred. No full application build, dependency advisory audit,
Windows runtime test or new remote route probe was claimed for this docs pass.
The verifier inventories HTML but parses links only in Markdown; remote URLs,
anchors and semantic truth still need review. CI checks inspect standalone literal
run steps and exact npm script targets; they do not certify a hosted run passed.
Historical local-reference limitations would be reported separately if introduced.
Host architecture hooks can rewrite generated files; their ownership and review
requirements are documented in [asset maintenance](../architecture/REFRESH-NEEDED.md).
