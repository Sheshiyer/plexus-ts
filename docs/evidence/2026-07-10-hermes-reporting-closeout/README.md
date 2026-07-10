# Hermes Reporting Retirement Closeout

Date: 2026-07-10

## Current authority

Plexus runs locally per member. The Workspace Worker/Plexus API remains the
member data plane. The member-scoped Thoughtseed bridge is the primary reporting
port to Hermes; Hermes owns report orchestration and maps founder-review intent
to Cambium's Telegram Mini App and configured Telegram topics. MultiCA and
TeamForge are deprecated as reporting authorities. Fabric and Paperclip remain
optional enrichment/provenance only.

## Local implementation proof

- Retired `MemberProvisionBundle.multica` and the `tf.multicaApiUrl` setting
  write; startup migration removes the old write-only setting while accepting
  legacy payload extras without persisting them.
- Persisted standup evidence is the only compliance source. Daily proof packets
  link an existing record or `null`; timer usage aggregates the full UTC day.
- Daily events use bridge-first delivery. Worker fallback is degraded and
  bridge-retryable; subsequent retries are bridge-only.
- Monthly review cycles use calendar-month UTC bounds, distinct recorded-work
  dates, explicit compliance summaries, and member-scoped deterministic bridge
  IDs. Weekly reviews never trigger founder delivery.
- Current IPC/API report builders share UTC/report helpers and remain free of
  report-generation side effects on GET requests.

## Verification tiers

### Deterministic local proof

`npm run verify:all` passed on the closeout branch:

- lint, typecheck, placeholder/security/fuse/CSP/release-evidence gates;
- 88 assistant test files / 255 tests, 25 coworking files / 76 tests, 3
  identity files / 10 tests, and 3 renderer files / 17 tests;
- main/preload import smoke, assistant context/model/daily/bridge smoke, and
  renderer production build.

The Vitest runner emits an existing warning that the ancestor Astro strict
tsconfig cannot be resolved; it does not affect the passing suites or build.

### GitHub and branch proof

Roadmap PR #86 is merged at `origin/main@701f10a`. Main CI run `29085617834`
passed on macOS, Ubuntu, and Windows. No direct push to `main` is part of this
closeout branch.

### External-runtime boundary

No live member bridge send or founder-visible Cambium/Telegram receipt was
attempted in this local pass. The deterministic bridge smoke proves signing,
validation, stable IDs, and routing intent only. Month-close scheduling remains
Hermes infrastructure ownership; Plexus submits a generated monthly review on
request and records a retryable handoff when the bridge is unavailable.

## Cleanup preservation boundary

The root checkout remains on `codex/coworking-media-controls-fix` with its three
unrelated dirty architecture documents preserved byte-for-byte. Cleanup may
remove only stale/prunable registrations, clean physical roadmap worktrees
whose tips are ancestors of `origin/main`, and contained local roadmap refs.

Retain the open PR #40/root branch, the unmerged `codex/coworking-ambient-hotfix`
line, swarm/Copilot worktrees with unique or dirty state, and any branch or
worktree not proven contained. The final cleanup audit must record each retained
item and the ancestry/dirty-state reason.
