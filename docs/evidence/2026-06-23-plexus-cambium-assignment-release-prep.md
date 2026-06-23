# Plexus Cambium Assignment Release Prep - 2026-06-23

Scope: confirm the Cambium `POST /v1/bridge/assign-task` payload from Plexus Agent Fabric's point of view and prepare Plexus `0.4.1` for release.

## Cambium Payload Contract

- Cambium route: `/v1/bridge/assign-task`
- Directive payload type: `project_task_assignment`
- Schema: `thoughtseed.project_task_assignment.v1`
- Target surface: `plexus-agent-fabric`
- Required task fields: `taskId`, `projectId`, `title`
- Preserved fields used by Plexus: `eventId`, `correlationId`, `projectId`, `projectName`, `questId`, `clientId`, `clientName`, `priority`, `taskType`, `assigneeMemberId`, `assignedBy`, `source`

## Plexus App Path Confirmed

- `src/main/thoughtseed-bridge.ts` syncs bridge directives through `syncThoughtseedFabricTasks()`.
- `src/shared/thoughtseed-fabric-task.ts` parses Cambium `project_task_assignment` and legacy `fabric_task_assignment` directives into `ThoughtseedFabricTask` cards.
- `src/preload/preload.ts` exposes `thoughtseedSyncFabricTasks`, `thoughtseedFabricTasks`, `thoughtseedSetFabricTaskWorkMode`, and `thoughtseedReportFabricTask` without exposing token material.
- `src/renderer/components/AgentFabricPanel.tsx` renders synced task cards and reports seen/in-progress/blocked/done status back through the main process.

## Commands Run

```bash
npm run smoke:thoughtseed-bridge
npm run typecheck
npm run build:preload
npm exec vite -- build
npm run lint
npm run release:dry-run
git diff --check -- CHANGELOG.md
rg -n "[ \t]+$" src/shared/thoughtseed-fabric-task.ts src/main/thoughtseed-bridge.ts scripts/smoke-thoughtseed-bridge.mjs docs/evidence/2026-06-23-plexus-cambium-assignment-release-prep.md CHANGELOG.md
```

## Results

- `npm run smoke:thoughtseed-bridge`: passed; output included `thoughtseed bridge smoke passed: signing, expiry, and Cambium assignment parsing are deterministic`.
- `npm run typecheck`: passed.
- `npm run build:preload`: passed.
- `npm exec vite -- build`: passed; emitted the known parent-workspace `astro/tsconfigs/strict` warning.
- `npm run lint`: passed.
- `npm run release:dry-run`: passed with `SKIP_NOTARIZATION=true CSC_IDENTITY_AUTO_DISCOVERY=false`.
- `git diff --check -- CHANGELOG.md`: passed.
- Trailing-whitespace scan over scoped bridge-parser/smoke/evidence files returned no matches.

## Release Artifacts

- `release/Plexus-0.4.1-mac-arm64.dmg`
- `release/Plexus-0.4.1-mac-arm64.dmg.blockmap`
- `release/Plexus-0.4.1-mac-arm64.zip`
- `release/Plexus-0.4.1-mac-arm64.zip.blockmap`
- `release/latest-mac.yml`

`release/latest-mac.yml` reports `version: 0.4.1` and points to `Plexus-0.4.1-mac-arm64.zip`.

## Remaining Release Gate

- The worktree is on `main` with many pre-existing tracked modifications and untracked bridge/evidence files.
- Local tag state has `v0.4.0` as the newest tag; `v0.4.1` is not yet created locally.
- This prep did not push, tag, create a GitHub Release, or verify the remote OTA feed after upload.
