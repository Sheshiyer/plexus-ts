# Plexus Standup Producer Verification

Verification date: 2026-07-28 (Asia/Kolkata)

Scope: verification only. No production code, remote state, release tag, deployment,
OTA publication, or external delivery was changed.

## Release coordinates

```text
$ git tag --points-at origin/main
v0.7.4

$ git log -1 --oneline origin/main
f133581 Merge pull request #122 from Sheshiyer/codex/standup-publish-finish
```

The full immutable producer commit is
`f133581aa1b62cc6fb35dde6c6e95876568b4077`. The verification worktree was
`/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/.worktrees/plexus-lifecycle-receipts`
on `codex/lifecycle-ownership-receipts-plan`.

## Lifecycle ownership

The following production files were inspected without modification:

- `src/main/assistant-runtime.ts`
- `src/main/assistant-daily.ts`
- `src/renderer/components/AssistantPanel.tsx`

Observed ownership:

- Missing persisted standup evidence: `buildOfflineAssistantSuggestions()` offers
  the confirm-required `app.generateStandup` daily transition when work entries
  exist and `hasStandupProofToday` is false. `daily.sendEvent` cannot be offered
  in this state because its branch requires persisted proof, `memberId`, and
  `standupRecordId`.
- Persisted evidence: the generation branch is no longer eligible. When the
  member and standup record identifiers are present and delivery is not already
  sent, the runtime offers only the confirm-required `daily.sendEvent` daily
  transition. Queued and failed states retain confirmation and use resume/retry
  copy for the original event.
- Sent state: `dailyEventStatus === 'sent'` suppresses `daily.sendEvent`; persisted
  proof suppresses `app.generateStandup`, so neither daily transition remains.
- Visible transition: `mergeAssistantSuggestions()` caps the list at eight but
  reserves a visible slot for a persisted intent (`intentId` present) whose tool
  is `app.generateStandup` or `daily.sendEvent`.
- Same event ID: `runAssistantDailyEventDeliverySingleFlight()` stores one promise
  per event ID, and both confirmed queue delivery and explicit event flush use
  that keyed path. Concurrent work for the same ID converges on one promise.
- Different event IDs: the delivery singleflight map is keyed by event ID rather
  than globally, so independent confirmed queue deliveries for different IDs may
  overlap. The separate `flushInFlight` guard serializes whole-flush calls; it
  does not globally serialize `queueAndSendAssistantDailyEvent()` across IDs.
- Retry after failure: the per-ID entry is deleted in `finally()` only when it is
  still the matching promise. This clears both success and failure paths for a
  later retry; the focused retry coverage also verifies reuse of the
  authoritative stored payload.

## Focused verification

```text
$ npx vitest run test/assistant/offline-suggestions.test.ts test/assistant/assistant-suggestion-visibility.test.ts --no-file-parallelism
PASS — 2 test files passed; 10 tests passed; duration 1.04s.

$ npx vitest run test/assistant/daily-event-queue.test.ts test/assistant/daily-event-retry.test.ts --no-file-parallelism
PASS — 2 test files passed; 11 tests passed; duration 1.69s.
```

Both focused commands emitted the same non-fatal esbuild warning before Vitest:
`Cannot find base config file "astro/tsconfigs/strict"` at
`../../../../tsconfig.json:2:13`.

## Repository gates

```text
$ npm run test:assistant
PASS — 112 test files passed; 521 tests passed; duration 38.51s.

$ npm run typecheck
PASS — tsc --noEmit exited 0 with no diagnostics.

$ npm run build:main
PASS — tsc --project tsconfig.main.json exited 0 with no diagnostics.

$ npm run build:preload
PASS — wrote dist/preload/preload.js without touching dist/shared.

$ npm run build:renderer
PASS — Vite transformed 497 modules and completed in 3.83s.
```

`npm run test:assistant` emitted the same non-fatal
`astro/tsconfigs/strict` base-config warning as the focused runs. Typecheck and
all three build commands completed without warnings.

An initial delegated `npm run test:assistant` attempt lost its terminal channel
when the delegated verification process reached its 300-second wall-clock cap.
Its orphaned local test processes were stopped, and the exact command was rerun
directly to the terminal PASS recorded above. This was an orchestration timeout,
not a repository test failure.

## Remaining live-only verification

Automated and static verification do not prove the packaged Electron presentation
or a real downstream receipt. A future live pass may:

- open the packaged assistant panel and visually confirm the persisted daily
  transition and confirmation modal; and
- confirm an authorized member-scoped bridge/Thoughtseed delivery and downstream
  receipt.

Those live actions were intentionally not performed in this verification lane.
