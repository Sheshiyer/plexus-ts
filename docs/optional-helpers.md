# Retired Paperclip / Fabric helpers

Reviewed: 2026-09-05 against v0.7.12 source.

The dedicated Paperclip/Fabric helper runtime and renderer panel were removed by the July 23 retirement change. Current onboarding has no helper install, repair, health-panel, or six-agent setup step. Clio runs in Electron main; reporting uses the member-scoped Thoughtseed bridge to Hermes. See the [documentation map](DOCUMENTATION_MAP.md), [retirement specification](superpowers/specs/2026-07-23-paperclip-retirement-design.md), and [reporting contract](architecture/HERMES_REPORTING_CONTRACT.md).

## Compatibility that still exists

| Source | What remains | Meaning for current work |
|---|---|---|
| `src/main/vault-projects.ts` | Founder-vault reader plus fallback discovery of an existing legacy Paperclip checkout | The founder Git vault is preferred; admin checks and exact Worker project-ID matching still apply. Do not install Paperclip to satisfy this fallback. |
| `src/main/thoughtseed-bridge.ts`, `src/shared/thoughtseed-fabric-task.ts` | Fabric-named task storage, wire contracts, and `paperclip` source values | Compatibility data remains active; the name does not restore the retired helper UI or service. |
| Meeting/closeout contracts | `sendToPaperclip`, `paperclipStatus`, and retry kinds `paperclip_closeout` / `paperclip_memory` | Preserve wire compatibility and honest queued/sent/failed status. Product labels describe channel handoff. |
| `scripts/smoke-admin-fabric-paperclip-test-org.mjs` | Historical disposable-organization probe | It is not an onboarding step or a current release requirement. Retain old receipts as history; do not run live writes to revive the retired integration. |

Absence of an old checkout is not proof that every compatibility reader is a no-op: `vault-projects.ts` can read a valid existing legacy layout. It also now reads the shared founder vault. Neither path grants project creation or membership authority.

Clio, Focus, Reports, Settings, onboarding, and daily event capture do not depend on a Paperclip installation. Cloud service outages still require accurate degraded/retry states; see [release evidence](RELEASE_EVIDENCE.md).
