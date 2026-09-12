# Dated implementation plans

These plans preserve decisions, implementation steps, and the status recorded in
their original sessions. Their checkboxes, `REQUIRED SUB-SKILL` instructions,
release targets, and “next batch” sections are historical context. They do not
start a new execution wave.

Use the [documentation map](../DOCUMENTATION_MAP.md), [current state](../../.planning/STATE.md),
and [root ISA](../../ISA.md) to select current work. The active migration sequence
is [P6 — Labs migration acceptance](../../.planning/phases/P6-labs-migration-acceptance.md).
The July roadmap's P6 means **Temperance Dispatch**, a separate historical phase
namespace; it is not the September P6 migration queue.

| Plan | How to use it now |
| --- | --- |
| [Employee copy and diagnostics](2026-06-25-employee-copy-diagnostics.md) | Historical copy/diagnostics decomposition; recheck component names against current source. |
| [OTA low-hanging improvements](2026-06-25-ota-low-hanging-improvements.md) | June improvement candidates; use the current OTA runbook and P6 for release actions. |
| [Identity loadout design](2026-06-29-identity-loadout-design.md) | Visual/product history; Paperclip companion assumptions were subsequently retired. |
| [Identity loadout implementation](2026-06-29-identity-loadout-implementation.md) | Implementation history; do not restore removed Fabric/Paperclip surfaces. |
| [Fabric/admin/Paperclip gap ledger](2026-06-30-fabric-admin-paperclip-gap-ledger.md) | Historical v0.4.9 readiness and test-organization record; retired helper scope. |
| [Native assistant runtime](2026-07-01-native-assistant-runtime.md) | Original assistant boundaries and implementation sequence; provider/helper wiring has evolved. |
| [Ambient floor reframe](2026-07-05-ambient-floor-reframe.md) | Original co-working design/implementation; compare later extracted components and live-media gates. |
| [Meet-like screen wall](2026-07-05-coworking-meet-like-screen-wall.md) | Historical renderer and media sequence; a planned screen wall does not prove SFU transport. |
| [Clio-first identity release](2026-07-06-clio-first-identity-release.md) | Historical v0.5.0 identity direction; helper assumptions are superseded. |
| [Meet-like room stage](2026-07-06-coworking-meet-like-room-stage.md) | Original unchecked gates remain recorded; consult current realtime acceptance before work. |
| [MVP-to-production roadmap](2026-07-09-plexus-prod-roadmap-expansion.md) | July task/phase namespace and execution ledger; its stale batch queue is not active. |
| [Private GitHub App ISA](2026-07-13-private-github-app-integration-isa.md) | Completed session snapshot; its 72/72 status does not certify current installation permissions. |
| [Founder onboarding ISA](2026-07-13-thoughtseed-github-founder-onboarding-isa.md) | Original contract with retained unchecked criteria; current live GitHub/D1 acceptance is in root ISA. |
| [Presence lease design](2026-07-16-coworking-presence-leases-design.md) | Original approved lease contract; approval is dated, not a fresh execution request. |
| [Presence lease implementation](2026-07-16-coworking-presence-leases.md) | Cross-repository implementation history; verify the current Worker before replaying migration commands. |
| [Plexus/Hermes standup repair](2026-07-27-plexus-hermes-daily-standup-repair.md) | Producer/outbox/consumer design; deployed delivery requires its own downstream receipt. |
| [Clio/OmniRoute routing](2026-07-28-clio-omniroute-model-routing.md) | Original relay/lane rollout; dated model names, versions, and deployment steps need current authority. |
| [Lifecycle ownership and receipts](2026-07-28-lifecycle-ownership-and-receipts.md) | Cross-repository producer/receipt design and rollout history; preserve explicit delivery boundaries. |
| [v0.7.11 vault authority hardening](2026-08-12-v0.7.11-vault-authority-hardening.md) | Version-specific design/verification history; use P6 for the next bridge release. |

Unfinished historical criteria remain unfinished in their original record. If a
requirement still applies, first match it to an existing root ISA criterion or
the [deferred register](../DEFERRED_REGISTER.md). Otherwise record the current
reproduction, owner, and acceptance boundary in current planning before scheduling
it. This index does not close any criterion or create duplicate implementation work.

Fabric/Paperclip retirement is documented in [the changelog](../../CHANGELOG.md);
the current reporting boundary is the [Hermes reporting contract](../architecture/HERMES_REPORTING_CONTRACT.md).
The [evidence index](../evidence/README.md) distinguishes original plan receipts
from September release/migration reconciliation.
