# Dated design and implementation records

These approved specifications and task lists preserve the June/July design
process. Approval labels and unchecked steps describe those sessions. They are
not an independent current queue, and embedded worker/skill instructions are
historical plan text.

Start current work from the [documentation map](../DOCUMENTATION_MAP.md),
[root ISA](../../ISA.md), and [current planning state](../../.planning/STATE.md).
The active migration is [P6](../../.planning/phases/P6-labs-migration-acceptance.md).
Visual references remain available in the [design index](../design/README.md).

| Topic | Original specification | Original implementation plan | Current interpretation |
| --- | --- | --- | --- |
| June renderer redesign | [Cambium UI design](specs/2026-06-11-plexus-ui-redesign-design.md) | Original task record in [MEMORY/WORK](../../MEMORY/WORK/README.md) | Dated visual baseline; preserve references and verify current components before reuse. |
| Clio chat simplification | [Design](specs/2026-07-23-clio-chat-simplification-design.md) | [Plan](plans/2026-07-23-clio-chat-simplification.md) | Retained implementation checklist; unchecked steps alone do not show missing current functionality. |
| Co-working clarity | [Design](specs/2026-07-23-coworking-redesign-design.md) | [Plan](plans/2026-07-23-coworking-redesign.md) | The spec's “pending implementation plan” is historical; the plan is linked here. Media acceptance remains distinct from layout. |
| Paperclip retirement | [Design](specs/2026-07-23-paperclip-retirement-design.md) | [Plan](plans/2026-07-23-paperclip-retirement.md) | Retirement is recorded in [CHANGELOG](../../CHANGELOG.md); old unchecked steps do not authorize recreating the helper. |

The current main process explicitly reports local Fabric as retired. Compatibility
fields such as `sendToPaperclip` can remain in a wire contract without representing
an installable desktop helper. Follow the [current reporting contract](../architecture/HERMES_REPORTING_CONTRACT.md)
for present delivery ownership. Reproduce any unresolved design or behavior gap
against current source/installed behavior before promoting it into ISA or the
[deferred register](../DEFERRED_REGISTER.md); this audit does not mark old steps done.
