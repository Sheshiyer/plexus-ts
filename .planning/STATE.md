# Project State — September migration continuation

## Current Position

Phase: P6-labs-migration-acceptance
Status: In Progress — preparation verified; live cutover pending
Last activity: 2026-09-05 historical reconciliation and scoped migration preflight
Acceptance: ISA.md (stable IDs; current totals in frontmatter)
Source base: origin/main e8d3a74, application v0.7.12
Working branch: codex/labs-migration-preflight-20260905

Current ISA: 321/343 checked (313/327 historical plus 8/16 migration criteria).

Historical criteria: 313/327 checked after ten evidence-backed closures; 14 remain
open, including two historical-disposition items. New migration ISCs 247–262
track current preparation and pending live acceptance independently.

Next: P6-05/P6-06 read-only route and exact OTA-object review, then prepare the
bridge cutover packet. See phases/P6-labs-migration-acceptance.md and
../docs/evidence/2026-09-05-labs-migration-review.md.

The API uses Labs; the app's active public update URL still belongs to personal
9d9d. Target manifest 0.7.8 versus active feed 0.7.12. Custom upgrade hostname
fails with Cloudflare Error 1000. Keep both historical update paths available
through a signed bridge release newer than 0.7.12.

User-owned blockers: five OTA environment secret values, signing/publication,
GitHub App authorization and authenticated D1/desktop acceptance. Secret-name
inventory is not credential or capability proof. Do not auto-dispatch the old
T12 secret task or any live mutation solely from generated next-wave output.

## Retained August snapshot

The following is preserved for continuity and is superseded above where counts,
release versions or next actions conflict.

# August Project State

## Project Reference

Repository: `plexus-ts`

## Current Position

Phase: P5-gap-execution
Status: In Progress
Last activity: P5-gap-assessment (2026-08-22)

Progress: [████████░░] 80% (ISA 299/327 = 91%, GSD infra 100%, gap closure 0/28)

## Phase Map

| Phase | Status | Tasks |
|---|---|---|
| P1 — Register | **complete** | T1 (speculum) ✓, T2 (GH board) ✓, T3 (ISA audit) ✓ |
| P2 — Bootstrap GSD | **complete** | T4 (phases) ✓, T5 (STATE) ✓, T6 (plan-issue-sync) ✓ |
| P3 — Integrate Issues | **complete** | T7 (board issues) ✓, T8 (ISA gap issues) ✓, T9 (NEXT-WAVE) ✓ |
| P4 — Verify + Close | **complete** | T10 (e2e verify) ✓, T11 (orchestration refresh) ✓ |

## Open Work

- 2 GH issues on board: RW-011 (privacy/audit), RW-014 (Cloudflare SFU) ✓
- 28 unchecked ISCs → 4 gap cluster GH issues (#236, #237, #238 + 1 pending)
- Speculum: registered ✓
- GH Project board: created + populated (PVT_kwHOAHQlT84BhJHF) ✓
- plan-issue-sync: wired, dry-run verified ✓

## Session Continuity

Resume: run `temperance-next-wave --cwd .` and continue open tasks.
