# Legacy task and lesson records

[todo.md](todo.md) preserves the June 19 work snapshot, including 23 unchecked
items. Its v0.4.0/v0.4.1 release instructions, “active batch,” issue counts, and
DNS housekeeping are historical. No checkbox was closed during this audit.
[lessons.md](lessons.md) retains useful evidence and product-quality lessons;
version-specific examples must be read in their original context.

For current work, use [the documentation map](../docs/DOCUMENTATION_MAP.md),
[ISA](../ISA.md), [planning state](../.planning/STATE.md), and
[P6 migration acceptance](../.planning/phases/P6-labs-migration-acceptance.md).
The current release procedure is [OTA_RELEASE](../docs/OTA_RELEASE.md).

| Historical work | Current disposition |
| --- | --- |
| v0.4.1 patch preparation and tag/publication steps | Retained release history. P6 owns the next migration bridge sequence; do not replay the old release. |
| Auth, resilience, timer/data continuity, media teardown, and degraded states | Requirements remain useful. Check existing ISA/deferred entries and reproduce a present gap before opening duplicate work. |
| Realtime SFU, audit/privacy, and E2E issues | Preserve the original issue references; use the [deferred register](../docs/DEFERRED_REGISTER.md) and current realtime contracts for acceptance. This audit does not refresh GitHub issue status. |
| Paperclip install, handoff, and optional-helper checks | Local helper surface was retired. Retain the requirement that local work survives downstream delivery failure; follow the [Hermes contract](../docs/architecture/HERMES_REPORTING_CONTRACT.md). |
| Transcription | Historical deferred idea; no implementation is implied by its presence here. |
| Access rename and “orphan” DNS cleanup | Historical candidates, not a deletion allowlist. Current DNS/route ownership and legacy-client retention belong to P6. |
| June [security review](../REVIEW.md) follow-ups | Dated findings require current-code reproduction. None is certified fixed or re-opened by this documentation pass. |
| June [video review goal](../goal.md) | Original review backlog and visual feedback, not the active migration goal. |

When a retained issue is reproduced, cite the original item and its fresh evidence
in current planning. Preserve historical IDs and do not equate a checked local
test with deployed or installed acceptance.
