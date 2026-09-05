# Project State

## Current Position

Phase: P6-labs-migration-acceptance
Status: In Progress — local preparation verified; live cutover pending
Last reviewed: 2026-09-05
Acceptance: [ISA.md](../ISA.md); its frontmatter is the current criterion count.
Source: package.json and the source commit recorded in the migration receipt.

## Published roadmap

[Project 17 and owning issues](GITHUB_ROADMAP.md) now organize P6–P12.
The 52 pending criteria have one primary issue owner each; existing Realtime
and Hermes receipt issues are reused. Use Readiness and Delivery phase rather
than old vault issue counts. Main integration and live operations remain separate.

## Current work

P6 execution has begun. The [first execution receipt](../docs/evidence/2026-09-05-p6-first-execution.md)
records181/165objects,82identical shared keys,82shared binaries still unverified,
16missing Labs artifacts, one manifest conflict and164metadata differences.
The [route packet](P6-route-repair-packet.md) and [partial copy candidates](P6-copy-candidates.json)
are reviewable; full binary digests and exact DNS ownership remain pending.


The repository documentation deep pass is complete as local maintenance within
the migration continuation. Read its [receipt](../docs/evidence/2026-09-05-documentation-deep-pass.md),
[documentation map](../docs/DOCUMENTATION_MAP.md), and [source follow-ups](documentation-followups.md).

The API uses Labs Access. The current app OTA feed still belongs to the legacy
account; observed source/Labs manifest versions and route errors are dated in
[the migration receipt](../docs/evidence/2026-09-05-labs-migration-review.md).
Do not repeat them as fresh live observations without a new probe.

Next: follow [P6](phases/P6-labs-migration-acceptance.md) and
[NEXT-WAVE](NEXT-WAVE.json). Exact DNS read remains unavailable with the tested
profile. Refresh object differences before preparing an allowlisted copy or
bridge publication. Existing signing, secret custody, App authorization and
installed acceptance remain their named operator gates.

## Broader product continuation

The [connected-operations plan](phases/P7-connected-operations.md) and
[review receipt](../docs/evidence/2026-09-05-connected-operations-review.md)
map the company growth/organ contract to remaining implementation and acceptance.
New product criteria remain pending in ISA; they do not replace P6 or grant
automatic execution. Identity/project boundaries and the daily work-to-founder
receipt are the first slice; HR/planning and Realtime follow as bounded work.

## Continuity and history

Read [the roadmap](ROADMAP.md) for scope. The complete
[August snapshot](archive/2026-08-22-gap-snapshot/STATE.md) is retained separately.
Historical checkbox counts and old release targets are not current work orders.
The root checkout's earlier WIP remains preserved; use this committed branch's
ISA and planning instead of overwriting them from that older root snapshot.
