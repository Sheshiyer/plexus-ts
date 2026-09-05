# Plexus documentation: start here

This is the navigation and maintenance contract for repository documentation.
Use the [complete catalog](DOCUMENTATION_CATALOG.md) to locate every document.

## Authority order

| Question | Read | What it establishes |
| --- | --- | --- |
| What does this checkout configure? | [package.json](../package.json), [runtime source](../src/main/main.ts) | Source version, scripts, runtime wiring; not deployment proof |
| What is accepted or still open? | [ISA](../ISA.md) | Stable criteria and individually dated verification |
| What should happen next? | [State](../.planning/STATE.md), [planning roadmap](../.planning/ROADMAP.md) | One active phase and its explicit dependencies |
| How do I use or maintain it? | [README](../README.md), [OTA runbook](OTA_RELEASE.md), [runtime contract](ASSISTANT_RUNTIME_CONTRACT.md) | Current operational guidance |
| What happened previously? | [Evidence index](evidence/README.md), [plan index](plans/README.md) | Dated observations and historical intent |
| What were the old roadmap and gap claims? | [Original roadmap](archive/2026-09-05/pre-refresh-roadmap.md), [August snapshot](../.planning/archive/2026-08-22-gap-snapshot/STATE.md) | Preserved history; not an execution queue |

The [product roadmap](ROADMAP.md) links to the planning spine instead of keeping
another independent status table. Historical ISC checkmarks do not make their
old package versions, counts or live endpoints current again.

The [runtime map](architecture/RUNTIME_MAP.md) records the source wiring and known implementation gaps.

## Current migration boundary

The [September migration review](evidence/2026-09-05-labs-migration-review.md)
records exact source, feed, Labs bucket and routing observations. API relocation,
credential custody, object parity and installed OTA transition are separate
acceptance claims. Runtime and package feed pins determine where a build looks
for updates.

[P6](../.planning/phases/P6-labs-migration-acceptance.md) owns route, artifact and
bridge-release acceptance. Documentation cleanup does not change that live
release state. [Release evidence policy](RELEASE_EVIDENCE.md) defines the proof
required before a new production claim.

The [documentation review receipt](evidence/2026-09-05-documentation-deep-pass.md)
records this cleanup, preservation proof and remaining source follow-ups.

## How to prevent drift

1. Change the owning source or acceptance record first. Update its current guides
   and link to the source instead of copying changing status into many files.
2. Keep dated evidence immutable. Add a dated superseding receipt instead of
   rewriting a failed probe as success.
3. Dated plans are historical until explicitly admitted into the current ISA and
   planning queue. Their unchecked tasks are neither approved nor completed.
4. Add a catalog policy route for new documentation folders. Run
   `npm run docs:refresh`, then `npm run verify:docs`.
5. Run the release policy checks after changing release docs. Their retained P9
   phrases validate a historical packet; passing that check does not establish
   today's signed/live acceptance.

`verify:docs` checks catalog coverage, current-guidance local file links, the
source/runbook feed contract, unique ISA IDs and checklist progress, and current planning phase
consistency. Historical missing references are reported separately. It does not
authenticate to services or prove remote links, UI or infrastructure healthy.

A dirty root checkout can coexist with a reviewed documentation branch. Follow
its continuation pointer instead of copying old root status over newer evidence.
