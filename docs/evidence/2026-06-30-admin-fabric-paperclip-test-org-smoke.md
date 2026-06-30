# Admin Fabric Paperclip Test Org Smoke

Date: 2026-06-30

## Scope

Validate the admin-specific Fabric path against the real local Paperclip API on
`127.0.0.1:3100` while keeping writes scoped to an explicit disposable/test
company.

## Setup

- Paperclip core started from `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/thoughtseed-paperclip` with `npm run paperclip:start`.
- Paperclip health returned `ok` from `http://127.0.0.1:3100/api/health`.
- Existing live company preserved:
  - Name: `Thoughtseed Labs`
  - Prefix: `THO`
  - ID: `afa83b3a-1abc-478c-974f-9bfc9b8f6576`
- Disposable test company selected:
  - Name: `Plexus Fabric Test`
  - Prefix: `PLE`
  - ID: `c03faa7f-05b8-4bab-b321-fb6990613a8a`
  - Description includes `Disposable Paperclip organization for Plexus employee-flow integration testing on localhost 3100.`

## Seeded Test Records

- Agent:
  - Name: `Plexus Admin Smoke Employee`
  - ID: `566a0c70-efd6-4f46-8d15-4861391393d5`
  - Status: `idle`
  - Heartbeat: disabled for safe smoke testing
- Issue:
  - Identifier: `PLE-2`
  - ID: `f5c1ffa2-38fc-476c-a7ea-026c3c265078`
  - Title: `[Plexus Admin Smoke] Emulate admin Fabric assignment`
  - Status: `todo`
  - Assignee: `Plexus Admin Smoke Employee`

## Plexus Change Verified

- Paperclip safety now requires an explicit test/disposable marker before
  admin employee test-mode writes are allowed.
- The main Electron window now denies arbitrary renderer navigation and popup
  windows, opening only validated `http:`/`https:` external URLs in the OS
  browser.
- The renderer HTML now has a CSP that blocks arbitrary script/object/frame
  execution while preserving the existing inline-style-heavy design system.
- Thoughtseed/Fabric/admin onboarding IPC payloads are validated in the main
  process before privileged code runs.
- Admin demo IPC now checks for an active local admin session in the main
  process before calling Worker admin routes.
- Agent Fabric `Refresh assignments` now ingests tasks through the Fabric sync
  path, updates local cards, and keeps task drafts aligned with the task list.
- Agent Fabric progress/block/done controls now require a selected work mode;
  acknowledge remains available before a work-mode choice.
- Agent Fabric now shows Paperclip/Hermes/Cambium source chips and surfaces
  bridge/main-process error messages instead of generic failures.
- Fabric work-mode and task-report writes persist locally only after the
  upstream bridge send succeeds.
- Paperclip task assignments preserve `source: "paperclip"` instead of being
  collapsed into the Hermes lane.
- The Paperclip admin smoke now has help text, request timeouts, route
  validation, explicit-company-id fallback refusal, and a disposable company
  creation preflight.
- `npm run smoke:admin-fabric-paperclip -- --write --json` used the live
  Paperclip API, reused the test agent/issue on repeat runs, and wrote a
  proof snapshot to `/tmp/plexus-admin-fabric-paperclip-smoke.json`.

Detailed gap ledger: `docs/plans/2026-06-30-fabric-admin-paperclip-gap-ledger.md`.

## Verification

- `npm run typecheck` passed.
- `npm run build:main` passed.
- `npm run build:preload` passed.
- `npm run build:renderer` passed.
- `npm run lint -- --quiet` passed.
- `npm run smoke:thoughtseed-bridge` passed.
- `npm run smoke:admin-fabric-paperclip -- --json` passed in dry-run mode.
- `npm run smoke:admin-fabric-paperclip -- --write --json` passed.
- Browser/CDP smoke of `/?splash=0&tab=bridge` with a preload-compatible mock
  passed: Fabric rendered, Paperclip source chip was visible, refresh/work-mode
  controls were present, `Working` and `Done` were disabled before work-mode/proof,
  main horizontal overflow was `0`, and console/runtime/network failures were `0`.
- `npm run release:ota:prep` passed. Public OTA feed was still `0.4.8`, so
  `0.4.9` is a valid next release tag.
- `npm audit --omit=dev --json` reported `0` production vulnerabilities.

## Residual Release Maintenance

- Full `npm audit` still reports high-severity dev/build-chain findings that
  require major upgrades to `electron` and `electron-builder`. I did not apply
  those breaking upgrades inside this scoped Fabric/admin/Paperclip safety PR.
