# Paperclip Optional-Helpers Retirement

**Date:** 2026-07-23
**Status:** Approved design
**Trigger:** Paperclip's optional-helper role is superseded — Clio now runs the AgentScope-based runtime (docs/CLIO_AGENTSCOPE_REVIEW.md), and daily/channel updates flow Plexus → Worker/bridge → Hermes cron (`plexus-kpi-standup`, `daily-standup-digest` in thoughtseed-labs/hermes-aws-ts) → Telegram supergroup topics. The local Paperclip repo is retired.

## Decisions

1. **Full client removal** of the Paperclip surface from plexus-ts; keep Worker wire-contract fields parsed/sent (server rename is a follow-up outside this repo).
2. **Closeout handoff repointed to Hermes** in copy; same wire field (`sendToPaperclip`) and retry-ledger vocabulary underneath.
3. **Standup preference** becomes Plexus/Telegram with Telegram default; stored `'paperclip'` migrates to `'telegram'`.
4. **No new Telegram code in plexus-ts.** Delivery is already pull-based via Hermes; bot tokens stay in `~/.hermes`, never in the Electron app.

## Removals (full client surface)

- `src/main/fabric.ts` (entire module: repo-root/company resolution, API polling, install probe, bridge sidecar probe, vault standup enrichment).
- IPC `fabric:status`, `fabric:healthProbe`, `fabric:installStatus` (main.ts ~1763-1765) + preload methods (preload.ts ~113-115) + `fabricInstallStatus`/`fabricStatus`/`fabricHealthProbe` in the `PlexusAPI` type.
- `src/renderer/components/AgentFabricPanel.tsx` and its route/embedding.
- Onboarding: `paperclip` step default (teamforge.ts ~528), step copy/runner + `PaperclipPreflight` (Onboarding.tsx); a server-sent `paperclip` step renders as a generic optional step (fallback copy path already exists).
- Settings: `assistantPaperclipEnrichmentEnabled` toggle (~1076-1079), "Run helper setup" (~1324); settings keys `tf.paperclipRepoRoot`, `tf.paperclipCompanyId`.
- IdentityPanel helper perks (~135-141, ~332-350); AssistantContextDrawer helper row; AssistantPanel `helpers` context (Fabric entry in `loadContext`).
- Assistant context/runtime: `optionalHelpers.paperclip` (assistant-context.ts ~198/236/294-296/764-766), "Paperclip is optional helper context only" prompt lines (assistant-runtime.ts ~188/198/206).
- `syncMemberContext()` (teamforge.ts ~1083-1107) and its callers.
- Types: `PaperclipInstallStatus`, `PaperclipPortConfig`, `optionalHelperProof`; `paperclipStatus` string in the assistant snapshot (main.ts ~806).

## Kept (wire compatibility)

- Meeting `paperclipStatus` (queued/sent/failed) parsing and `sendToPaperclip` request field (shared/types.ts ~867, ~982-984) — Worker still speaks this contract.
- Retry-ledger kinds `paperclip_closeout`/`paperclip_memory` (main.ts ~479-486, types ~509-510) — existing queued entries must still flush.
- `'paperclip'` in the fabric-task `source` union (thoughtseed-fabric-task.ts) — bridge may still receive such events.

## Repointing

- Co-working closeout checkbox: "Send to team channel" with hint "Delivered through Hermes to the team Telegram channel"; status copy (`paperclipStatusCopy`, CoWorkingPanel/StudioStage) reworded to "Channel handoff …".
- PreferencesPanel standup channel: options `plexus` | `telegram`, default `telegram`; read-migration maps stored `'paperclip'` → `'telegram'`; `identityLoadout.ts` copy updated ("paper trail" line).
- Onboarding `daily_agent` copy already says Clio; unchanged.

## Testing

- Remove/update fabric-related tests; source assertions: no `fabric:` IPC ids, no user-visible "Paperclip" strings in renderer copy (wire fields exempt).
- Unit test for the standup-preference migration.
- Full suite + `tsc --noEmit` green.

## Out of scope

- Worker-side field renames (`sendToPaperclip` → channel handoff) — follow-up in the Worker repo.
- Any change to hermes-aws-ts or `~/.hermes`.
- Removing `'paperclip'` from bridge source vocabulary.
