# Paperclip Fabric 3100 Employee Smoke

Date: 2026-06-20

## Scope

Validate Plexus Agent Fabric against the real Paperclip local app/API on `127.0.0.1:3100`, not the `3101` runtime adapter as the primary source of truth.

## Setup

- Paperclip core started with `npm run paperclip:start` in `thoughtseed-paperclip`.
- Paperclip health returned `200` from `http://127.0.0.1:3100/api/health`.
- Existing `Thoughtseed Labs` company was preserved.
- New disposable company created:
  - Name: `Plexus Fabric Test`
  - ID: `c03faa7f-05b8-4bab-b321-fb6990613a8a`
  - Prefix: `PLE`
- Plexus local setting pointed Fabric to the test company:
  - `tf.paperclipCompanyId=c03faa7f-05b8-4bab-b321-fb6990613a8a`

## Seeded Test Records

- Agent:
  - Name: `Plexus Fabric Employee`
  - ID: `6fbf9b4b-f5d1-4a35-b032-9644f2ea64c7`
  - Status: `idle`
  - Heartbeat: disabled for safe smoke testing
- Issue:
  - Identifier: `PLE-1`
  - Title: `Verify Plexus Fabric employee flow against Paperclip 3100`
  - Status: `todo`
  - Assignee: `Plexus Fabric Employee`

## Plexus Change Verified

- `src/main/fabric.ts` now probes Paperclip UI/API with `/api/health` first.
- Fabric now reads agents from `GET /api/companies/:companyId/agents` on `3100` before falling back to adapter telemetry or repo-file scans.
- Paperclip logs confirmed repeated `200` responses for:
  - `/api/companies/c03faa7f-05b8-4bab-b321-fb6990613a8a/agents`
- Plexus UI accessibility text confirmed:
  - `PAPERCLIP API`
  - `3100`
  - `up`
  - `Plexus Fabric Employee`
  - `paperclip:idle`

## Evidence

- Screenshot: `/tmp/plexus-fabric-proof/fabric-3100-test-org-clean.png`
- Screenshot: `/tmp/plexus-fabric-proof/fabric-3100-test-org-top.png`
- API response snapshots:
  - `/tmp/paperclip-test-org.json`
  - `/tmp/paperclip-test-agent-created.json`
  - `/tmp/paperclip-test-issue-created.json`

## Observed Gaps

- Paperclip company delete currently fails on existing Thoughtseed org because `heartbeat_runs` references `agent_wakeup_requests`. Do not use delete for Thoughtseed reset until Paperclip fixes cascade/deletion ordering.
- Paperclip still logs `opencode models` failures for existing Thoughtseed scheduled agents; this is outside Plexus Fabric display but should be treated as a Paperclip runtime-health gap.
- Plexus still shows the optional MultiCA bridge as not responding; the 3100 company-agent path works without it.
- Shell health-check still reads repo-local Thoughtseed agents, not the selected Paperclip company. This is honest but can confuse employee testing when Fabric is pointed at a test org.

## Verification

- `npm run typecheck` passed after the Fabric patch.
- Plexus dev app restarted successfully.
- Paperclip remained healthy on `3100`.
