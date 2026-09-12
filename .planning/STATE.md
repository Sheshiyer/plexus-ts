# Project State

## Local v0.7.13 release and OTA preflight — September 13

The local-only `codex/plexus-v0.7.13-release-preflight-20260913` candidate combines the member-workspace implementation with the repository-hydration fix, then advances the package and lockfile to v0.7.13. Its complete non-publishing OTA preparation, including all test suites, zero-vulnerability audits, unsigned arm64 packaging, SQLite bootstrap, packaged main/renderer, and fuse checks, passes. The [preflight receipt](../docs/evidence/2026-09-13-v0.7.13-release-ota-preflight.md) records the source, local artifacts, and public-feed readback.

The public updater still serves v0.7.12 from the pinned legacy R2 URL; no v0.7.13 tag, signing run, artifact upload, public manifest update, deployment, or installed upgrade occurred. The Cloudflare asset move has no effect on the candidate's embedded Electron `assets/` tree, but publication remains blocked until a reviewed main integration, protected workflow approval, and a proven alignment between the publisher's R2 destination and the feed installed clients read. Do not treat the local receipt as an OTA publication or a Labs migration completion.

## Active experience design candidate — September 12

Owner direction: **member workspace first, role-aware team tools**, compact Identity, complete removal of its 3D character, and a full Cambium-inspired macOS design pass.

The isolated `codex/plexus-experience-design-20260912` worktree is based on `cf8b71c` (v0.7.12). Identity and the shared visual/navigation foundation are implemented locally. The [design contract](../DESIGN.md), [all-page audit and six-wave plan](../docs/design/2026-09-12-experience-audit.md), [18-skill capability matrix](../docs/design/2026-09-12-capability-matrix.md), and [verification receipt](../docs/evidence/2026-09-12-member-experience-design.md) describe the result.

`npm run review:design` serves the development-only board on port 5188. Its ten proposed page studies use illustrative interactions. Continue production work through Waves 2–4, then the native/live and owner acceptance in Wave 5. ISC-329–332 remain open. The established P6/P7 authority, release and live-service gates below retain their meaning.

The Luna-high [Cambium corpus deep pass](../docs/design/2026-09-12-cambium-corpus-deep-pass.md) verifies the 46-row library and 140-record export, records visual coverage and governance gaps, and maps every source into an explicit Plexus use or hold. The [source browser](http://127.0.0.1:5188/design-review.html?view=sources) serves original references only in the development review. The next production work is shared state/source-age primitives and the connected Today → Projects → Work records journey, with 320px normal inspectors. Upstream self-lineage, naming and count repairs remain a separate bounded packet in the audit.

## Current Position

Phase: P7-connected-operations
Status: In Progress — P7 source foundations; P6 live migration gates remain open
Last reviewed: 2026-09-12
Acceptance: [ISA.md](../ISA.md); its frontmatter is the current criterion count.
Source: package.json and the source commit recorded in the migration receipt.

## Published roadmap

[Project 17 and owning issues](GITHUB_ROADMAP.md) now organize P6–P12.
The 52 pending criteria have one primary issue owner each; existing Realtime
and Hermes receipt issues are reused. Use Readiness and Delivery phase rather
than old vault issue counts. Main integration and live operations remain separate.

## Current work

Local v0.7.12 installation, Labs admin handoff, primary views and isolated session
relaunch now pass. [The September 12 receipt](../docs/evidence/2026-09-12-local-installed-acceptance.md)
records the exact artifact, recovery and remaining Clio/repository/runtime limits.
The running validation profile uses a fresh work database. P6 signed OTA and
P7 authorization acceptance remain open; no service was deployed.

P7 source candidates now implement Cambium’s committed-reference validator and
Plexus client/workspace/provenance retention. See the [verified source receipt](../docs/evidence/2026-09-05-p7-source-foundations.md)
and [next implementation packet](P7-identity-continuation.md). Current mapping
authority, revocation and authenticated integration remain pending. Neither
a graph reference nor retained fields grant execution. P6 stays open.


P6 execution has begun. The [first execution receipt](../docs/evidence/2026-09-05-p6-first-execution.md)
records 181/165 objects, 82 identical shared keys, 82 shared binaries still unverified,
16 missing Labs artifacts, one manifest conflict and 164 metadata differences.
The [route packet](P6-route-repair-packet.md) and [partial copy candidates](P6-copy-candidates.json)
are reviewable; full binary digests and exact DNS ownership remain pending.


The repository documentation deep pass is complete as local maintenance within
the migration continuation. Read its [receipt](../docs/evidence/2026-09-05-documentation-deep-pass.md),
[documentation map](../docs/DOCUMENTATION_MAP.md), and [source follow-ups](documentation-followups.md).

The API uses Labs Access. The current app OTA feed still belongs to the legacy
account; observed source/Labs manifest versions and route errors are dated in
[the migration receipt](../docs/evidence/2026-09-05-labs-migration-review.md).
Do not repeat them as fresh live observations without a new probe.

Migration continuation: follow [P6](phases/P6-labs-migration-acceptance.md) and
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
