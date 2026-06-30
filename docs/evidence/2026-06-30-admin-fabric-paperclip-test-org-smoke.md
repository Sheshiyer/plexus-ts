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
- Admin demo IPC now checks for an active local admin session in the main
  process before calling Worker admin routes.
- Fabric work-mode and task-report writes persist locally only after the
  upstream bridge send succeeds.
- Paperclip task assignments preserve `source: "paperclip"` instead of being
  collapsed into the Hermes lane.
- `npm run smoke:admin-fabric-paperclip -- --write --json` used the live
  Paperclip API, reused the test agent/issue on repeat runs, and wrote a
  proof snapshot to `/tmp/plexus-admin-fabric-paperclip-smoke.json`.

## Verification

- `npm run typecheck` passed.
- `npm run build:main` passed.
- `npm run build:preload` passed.
- `npm run build:renderer` passed.
- `npm run lint -- --quiet` passed.
- `npm run smoke:thoughtseed-bridge` passed.
- `npm run smoke:admin-fabric-paperclip -- --write --json` passed.
