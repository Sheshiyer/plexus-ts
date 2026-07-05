# Ambient Floor Reframe Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Plexus Co-working page into one ambient floor viewport with a focused project zone, integrated lounge layer, multi-person screen wall, and explicit project-vault recording workflow.

**Architecture:** Plexus keeps the existing realtime room/call primitives but introduces a client-side ambient floor model that treats the lounge as the default floor zone and the selected project room as a focused zone. The renderer no longer renders every project room as cards; it derives one selected project zone, one lounge layer, one screen wall, and one explicit recording state. Recording work crosses into TeamForge Worker and uses the existing Thoughtseed project vault/R2 binding, not a standalone bucket.

**Tech Stack:** Electron main/preload IPC, React 18 renderer, TypeScript shared contracts, existing `teamforge` Worker client, Cloudflare Worker/D1 realtime routes, existing Worker R2 binding, Vitest for focused unit/contract tests, Vite/Electron build checks.

---

## Current Understanding

The current `CoWorkingPanel` has the right nouns but the wrong product shape. It is implemented as three stacked sections: today's floor, project room card grid, and ambient lounge strip in `src/renderer/components/CoWorkingPanel.tsx`. The page fetches `coworkingFloor()`, `coworkingLounge()`, and `realtimeRooms()`, then renders every room in a grid. The backend floor is derived by fanning out through all room details in `src/main/teamforge.ts`, not from a first-class ambient floor model.

The approved product direction is:

- One ambient floor is the main page.
- The lounge is the default visible floor zone.
- A project dropdown focuses a project room visually but does not auto-join.
- Joining a focused project zone starts presence-only.
- Mic, camera, screen, and recording are explicit post-join actions.
- Lounge stays ambient while the focused project zone owns active voice, screens, and recording.
- Multi-person screen sharing is a screen wall by default, with click-to-pin.
- Recording is explicit for focused project zones only.
- Lounge remains unrecorded unless promoted into a recorded session.
- Recording artifacts live under the associated Thoughtseed project vault/R2 path, not a standalone bucket.
- Recording is manifest-first: canonical manifest plus separate raw tracks, with optional composed playback.

## Source Context

- Plexus app root: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/plexus-ts`
- Worker root: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/team-forge-ts/cloudflare/worker`
- Current UI: `src/renderer/components/CoWorkingPanel.tsx`
- Current media helper: `src/renderer/lib/RealtimeSession.ts`
- Current IPC facade: `src/preload/preload.ts`
- Current main handlers: `src/main/main.ts`
- Current Worker client: `src/main/teamforge.ts`
- Current shared realtime types: `src/shared/types.ts`
- Existing realtime contract docs: `docs/REALTIME_WORKSPACE_CONTRACT.md`, `docs/REALTIME_WORKER_API_CONTRACT.md`
- Existing design contract: `docs/design/screen-references/co-working.prompt.txt`, `docs/design/screen-references/co-working.png`
- Existing Worker realtime route: `../team-forge-ts/cloudflare/worker/src/routes/realtime.ts`
- Existing Worker realtime tests: `../team-forge-ts/cloudflare/worker/src/routes/__tests__/realtime.test.ts`
- Existing Worker realtime migration: `../team-forge-ts/cloudflare/worker/migrations/0011_realtime_workspace.sql`
- Existing Worker R2 binding type: `../team-forge-ts/cloudflare/worker/src/lib/env.ts`

## Discovery Summary

- **Planning depth:** deeply detailed.
- **Delivery mode:** production-oriented phased rollout.
- **Release model:** phased rollout with contract freeze, UI build, backend recording build, integration, and hardening.
- **CI/CD expectation:** basic local checks for every task, production-grade release checks before ship.
- **Quality bar:** typed contracts, focused tests for pure model logic and Worker contracts, renderer smoke/manual proof for UI, Worker tests for R2 manifest references, build/typecheck/lint before merge.
- **Team topology:** small multi-agent squad.
- **Available agents:** planner/orchestrator, Codex UI/app executor, Copilot/backend cloud executor, Gemini validation reviewer.
- **Repo scope:** Plexus repo plus sibling TeamForge Worker repo for recording backend.
- **Base branch:** current approved integration base, expected `main` unless the orchestrator creates a feature branch first.
- **Sensitive constraints:** no renderer secrets; member bridge tokens remain main-process only; R2 writes go through Worker/project vault path; no standalone recording bucket; no automatic ambient recording.

## Skill Selection Ledger

- **Activated skills:** `using-superpowers` -> skill ordering and compliance; `writing-plans` -> plan artifact format; `swarm-architect` -> phase/wave/swarm decomposition and safe multi-agent delivery.
- **Considered but skipped:** direct implementation skills -> blocked because this is a planning artifact; frontend-design -> useful later, but this request asks for an implementation plan, not mockups.
- **Order:** process discipline first, plan-writing second, swarm orchestration third.
- **Conflict resolved:** the prior brainstorming flow normally writes a spec before implementation planning, but the user explicitly requested `writing-plans`; this plan treats the chat decisions above as the approved feature brief and does not touch production code.

## Non-Negotiable Boundaries

- Do not auto-join a project when the dropdown changes.
- Do not auto-start recording.
- Do not record the lounge by default.
- Do not create a standalone R2 bucket for meeting recordings.
- Do not expose R2 credentials, Worker tokens, bridge tokens, Access JWTs, raw session files, or local database handles to renderer code.
- Do not let Worker or Paperclip failure trap the user in a room.
- Do not edit Plexus and Worker shared contracts in parallel without a contract-freeze task or integration owner.
- Do not merge task branches continuously; merge at wave boundaries.

## Target User Experience

The Co-working tab opens to a single ambient floor. The lounge is visible as the calm default zone. A project dropdown focuses one project room as the active zone, with visible people, activity, screen shares, and a presence-only Join button. Once joined, the member can intentionally enable mic, camera, screen, or recording. If several people share screens, they appear on a screen wall. Clicking one pins it as the primary surface. A persistent lounge strip remains available while the user is focused in a project, but project voice/screen/recording take priority.

## Agent Ownership Model

| Concern | Primary owner | Secondary reviewer | Notes |
|---|---|---|---|
| Planning and orchestration | Planner / orchestrator | Human lead | Owns issue graph, contract freeze, wave close. |
| Plexus UI and app integration | Codex UI/app executor | Planner / orchestrator | Owns React, CSS, renderer helpers, Plexus IPC integration. |
| TeamForge Worker and R2 project vault | Copilot backend/cloud executor | Planner / orchestrator | Owns Worker routes, D1 migrations, R2 references, env contract. |
| Validation and adversarial checks | Gemini validation reviewer | Planner / orchestrator | Owns test design, regression notes, release-readiness challenge. |
| Integration and release closeout | Planner / orchestrator | Codex + Copilot + Gemini | Owns cross-repo merge sequencing and release evidence. |

## Lock Zones

These files require serialized ownership or an explicit integration task:

- `package.json`
- lockfiles
- `src/shared/types.ts`
- `src/preload/preload.ts`
- `src/main/main.ts`
- `src/main/teamforge.ts`
- `src/renderer/App.tsx`
- `../team-forge-ts/cloudflare/worker/src/routes/v1.ts`
- `../team-forge-ts/cloudflare/worker/src/lib/env.ts`
- Worker migrations under `../team-forge-ts/cloudflare/worker/migrations`
- release workflow or root CI files

## Branch and Worktree Pattern

Use one issue, one owner, one branch, one worktree:

```bash
git worktree add .worktrees/T-001-codex -b swarm/ambient-floor/p1-w1/contracts/T-001-codex
```

For Worker tasks, create worktrees from the Worker repo:

```bash
cd /Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/team-forge-ts
git worktree add .worktrees/T-041-copilot -b swarm/ambient-floor/p3-w1/recording/T-041-copilot
```

## Phase Map

### Phase 1 - Contract and Foundation

**Goal:** Freeze the ambient floor model, focused-zone behavior, recording manifest contract, and validation baseline before parallel work starts.

**Exit criteria:**

- Shared ambient floor model contract exists.
- Project dropdown focus-only behavior is test-specified.
- Screen wall and recording states are test-specified.
- Worker recording manifest contract is documented.
- Package/test scripts are ready.
- GitHub issue mapping is ready.

**Waves:**

- Wave 1: Contract freeze
- Wave 2: Test and fixture baseline
- Wave 3: Worker/Plexus dispatch prep

### Phase 2 - Plexus Ambient Floor UI

**Goal:** Replace the three-panel dashboard with one ambient floor viewport, selected project zone, lounge layer, screen wall, and explicit media/recording controls.

**Exit criteria:**

- Co-working renders a single ambient floor.
- Project dropdown focuses one project zone without joining.
- Join starts presence-only.
- Lounge strip persists while project zone is focused.
- Screen wall supports multi-share display and pinning state.
- UI degrades cleanly when Worker/realtime media is unavailable.

**Waves:**

- Wave 1: Pure model and renderer decomposition
- Wave 2: Ambient floor viewport and focus controls
- Wave 3: Media and screen wall integration

### Phase 3 - Project Vault Recording Backend

**Goal:** Add explicit project-zone recording lifecycle and manifest-first R2/vault references through TeamForge Worker and Plexus IPC.

**Exit criteria:**

- Worker records project-vault recording manifests.
- R2 path uses existing project artifact/vault binding.
- Recording lifecycle is explicit and consent-visible.
- Plexus can start/stop/finalize recording state without direct R2 credentials.
- Meeting records can reference recording manifests.

**Waves:**

- Wave 1: Worker D1/API contract
- Wave 2: Worker route implementation and tests
- Wave 3: Plexus IPC and renderer recording controls

### Phase 4 - Integration, Hardening, and Release Proof

**Goal:** Merge UI and Worker work at wave boundaries, validate behavior, document proof, and prepare release.

**Exit criteria:**

- `npm run typecheck`, `npm run lint -- --quiet`, `npm run build:main`, `npm run build:preload`, `npm run build:renderer` pass in Plexus.
- Worker `pnpm test` and `pnpm check` pass.
- Focused co-working tests pass.
- Manual or fixture-backed UI proof exists.
- Recording privacy/consent and project-vault behavior is documented.
- GitHub issue and PR evidence is linked.

## Detailed Phase 1 Wave Layout

### Wave 1 - Contract Freeze

#### Swarm A - Product and UI Contracts

- **Owner:** Planner / orchestrator
- **Inputs:** user decisions from brainstorming, current `CoWorkingPanel.tsx`, design references.
- **Outputs:** ambient floor behavior contract, no-auto-join rule, lounge priority rule, screen wall behavior.
- **Validation:** docs and tests name each locked behavior.

#### Swarm B - Shared Type and IPC Contracts

- **Owner:** Codex UI/app executor
- **Inputs:** `src/shared/types.ts`, `src/preload/preload.ts`, `src/main/main.ts`.
- **Outputs:** `src/shared/coworking.ts` plus planned IPC additions.
- **Validation:** `npm run typecheck`, focused Vitest tests.

#### Swarm C - Recording and R2 Vault Contracts

- **Owner:** Copilot backend/cloud executor
- **Inputs:** Worker realtime route, D1 migration, R2 binding, project vault docs.
- **Outputs:** recording manifest shape, route contract, D1 migration plan.
- **Validation:** Worker route tests first, no live R2 required.

### Wave 2 - Test and Fixture Baseline

#### Swarm A - Plexus Fixture and Model Tests

- **Owner:** Codex UI/app executor
- **Outputs:** `test/coworking/**` fixture builders and tests for ambient floor selectors.
- **Validation:** `npm run test:coworking`.

#### Swarm B - Worker Recording Tests

- **Owner:** Copilot backend/cloud executor
- **Outputs:** failing Worker tests for recording start/stop/finalize and manifest refs.
- **Validation:** `pnpm test -- realtime`.

#### Swarm C - Validation Brief

- **Owner:** Gemini validation reviewer
- **Outputs:** validation matrix for no-auto-join, no-auto-record, lounge priority, multi-screen wall, R2 project path.
- **Validation:** validation brief attached to issue.

### Wave 3 - Parallel Work Launch

#### Swarm A - Codex UI/App Build Packet

- **Owner:** Planner / orchestrator
- **Outputs:** shared contract packet and Codex bootstrap.

#### Swarm B - Copilot Worker Build Packet

- **Owner:** Planner / orchestrator
- **Outputs:** shared contract packet and Copilot bootstrap.

#### Swarm C - Gemini Validation Packet

- **Owner:** Planner / orchestrator
- **Outputs:** validation brief and regression checklist.

## Shared Contract Packet

### Frozen API Contracts

Plexus may call existing:

- `window.plexus.realtimeRooms()`
- `window.plexus.realtimeRoomDetail(roomId)`
- `window.plexus.realtimeJoinRoom(roomId, input)`
- `window.plexus.realtimePublishTrack(callId, input)`
- `window.plexus.realtimeCloseTrack(callId, trackId)`
- `window.plexus.realtimeLeaveCall(callId, participantId)`
- `window.plexus.realtimeCloseout(callId, payload)`
- `window.plexus.coworkingFloor()`
- `window.plexus.coworkingLounge()`

New planned Plexus IPC after Worker contract freeze:

```ts
recordingStart: (roomId: string, input: CoWorkingRecordingStartInput) =>
  Promise<{ ok: boolean; recording?: CoWorkingRecordingSession; message?: string }>;

recordingStop: (recordingId: string) =>
  Promise<{ ok: boolean; recording?: CoWorkingRecordingSession; message?: string }>;

recordingFinalize: (recordingId: string) =>
  Promise<{ ok: boolean; manifest?: CoWorkingRecordingManifest; message?: string }>;
```

### Shared Type Contract Sketch

Create `src/shared/coworking.ts`:

```ts
import type { FloorPresence, RealtimeMediaTrack, RealtimeRoom } from './types';

export type CoWorkingZoneKind = 'lounge' | 'project';
export type CoWorkingJoinState = 'not_joined' | 'presence_only' | 'media';
export type CoWorkingRecordingState = 'idle' | 'starting' | 'recording' | 'stopping' | 'finalized' | 'failed';

export interface CoWorkingFocusedZone {
  kind: CoWorkingZoneKind;
  room: RealtimeRoom | null;
  projectId: string | null;
  projectName: string;
  joinState: CoWorkingJoinState;
  members: FloorPresence[];
  screenTracks: RealtimeMediaTrack[];
  pinnedTrackId: string | null;
  recordingState: CoWorkingRecordingState;
}

export interface CoWorkingRecordingManifest {
  id: string;
  workspaceId: string;
  projectId: string;
  roomId: string;
  callSessionId: string;
  startedAt: string;
  endedAt: string | null;
  r2Prefix: string;
  rawTracks: CoWorkingRecordingTrackRef[];
  composedPlaybackRef: string | null;
  consent: CoWorkingRecordingConsent[];
}

export interface CoWorkingRecordingTrackRef {
  trackId: string;
  participantId: string;
  kind: 'audio' | 'camera' | 'screen';
  objectKey: string;
  startedAt: string;
  endedAt: string | null;
}

export interface CoWorkingRecordingConsent {
  participantId: string;
  displayName: string;
  consentedAt: string;
  revokedAt: string | null;
}
```

### Config and Env Expectations

- Plexus renderer receives no R2 credentials.
- Plexus main receives no R2 credentials unless existing architecture already supports server-side delegated upload; default path is Worker-owned R2.
- Worker uses existing `TEAMFORGE_ARTIFACTS` or existing Thoughtseed project vault binding in `../team-forge-ts/cloudflare/worker/src/lib/env.ts`.
- Recording object keys are project-scoped, for example:

```text
projects/{projectId}/coworking-recordings/{recordingId}/manifest.json
projects/{projectId}/coworking-recordings/{recordingId}/tracks/{trackId}.webm
projects/{projectId}/coworking-recordings/{recordingId}/playback/composed.webm
```

### UI Integration Boundaries

- `CoWorkingPanel` should become an orchestrating shell.
- Pure derived logic lives in `src/renderer/lib/coworkingModel.ts`.
- Reusable UI pieces live under `src/renderer/components/coworking/`.
- Existing `RealtimeSession` may be extended, but screen receive/pin behavior should be isolated from the main panel.
- CSS additions live in `src/renderer/theme.css` unless a local CSS module pattern is introduced in a separate lock-zone task.

## Verification Commands

Plexus:

```bash
npm run test:coworking
npm run typecheck
npm run lint -- --quiet
npm run build:main
npm run build:preload
npm run build:renderer
```

Worker:

```bash
cd ../team-forge-ts/cloudflare/worker
pnpm test
pnpm check
pnpm dlx wrangler d1 migrations apply TEAMFORGE_DB --local
```

Manual or fixture-backed proof:

```bash
npm run dev
```

Capture evidence after implementation in:

- `docs/evidence/2026-07-05-ambient-floor-reframe.md`
- `docs/evidence/2026-07-05-ambient-floor-reframe/`

## Task Execution Template

Every task below should use this micro-sequence:

1. Create or switch to the task worktree and branch.
2. Write the failing test or contract check first.
3. Run the narrow command and confirm it fails for the expected reason.
4. Implement the minimal change in the owned file surface.
5. Run the narrow command and confirm it passes.
6. Run any listed broader command.
7. Commit with the listed commit message.
8. Write handoff notes with changed files, evidence, lock-zone touch, and contract drift status.

## Task Registry

### Phase 1 - Contract and Foundation

#### Wave 1 - Contract Freeze

### Task T-001: Write ambient floor product contract

**Schema:** `id=T-001`, `phase=P1`, `wave=W1`, `swarm=product-contract`, `area=product`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=1.0`, `dependencies=[]`

**Branch / worktree:** `swarm/ambient-floor/p1-w1/product/T-001-claude`, `.worktrees/T-001-claude`

**Files:**
- Create: `docs/design/ambient-floor-reframe.md`
- Read: `docs/design/screen-references/co-working.prompt.txt`
- Read: `docs/REALTIME_WORKSPACE_CONTRACT.md`

**Steps:**
1. Write the failing documentation check: `rg -n "focus-only|presence-only|screen wall|project vault" docs/design/ambient-floor-reframe.md`.
2. Confirm it fails because the file does not exist.
3. Create the product contract with the eight approved decisions.
4. Run the documentation check again.
5. Commit: `docs: define ambient floor reframe contract`.

**Acceptance:** The doc states focus-only project selection, presence-only join, lounge-as-layer, screen wall, explicit recording, and project-vault storage.

**Validation:** `rg -n "focus-only|presence-only|screen wall|project vault|not a standalone bucket" docs/design/ambient-floor-reframe.md`

### Task T-002: Freeze shared coworking type sketch

**Schema:** `id=T-002`, `phase=P1`, `wave=W1`, `swarm=shared-contracts`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-001"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w1/contracts/T-002-codex`, `.worktrees/T-002-codex`

**Files:**
- Create: `src/shared/coworking.ts`
- Test: `test/coworking/coworking-types.test.ts`

**Steps:**
1. Create `test/coworking/coworking-types.test.ts` importing `CoWorkingFocusedZone` and `CoWorkingRecordingManifest`.
2. Run `npx vitest run test/coworking/coworking-types.test.ts`; expect import failure.
3. Create `src/shared/coworking.ts` with the type sketch in the Shared Contract Packet.
4. Run `npx vitest run test/coworking/coworking-types.test.ts`; expect pass.
5. Run `npm run typecheck`.
6. Commit: `feat: add coworking shared contracts`.

**Acceptance:** Shared type file compiles without changing existing realtime type names.

**Validation:** `npm run typecheck`

### Task T-003: Define renderer model API contract

**Schema:** `id=T-003`, `phase=P1`, `wave=W1`, `swarm=ui-contracts`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-002"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w1/contracts/T-003-codex`, `.worktrees/T-003-codex`

**Files:**
- Create: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/coworking-model-contract.test.ts`

**Steps:**
1. Write tests importing `deriveFocusedZone`, `listProjectRoomOptions`, `deriveLoungeLayer`, and `deriveScreenWall`.
2. Run `npx vitest run test/coworking/coworking-model-contract.test.ts`; expect missing exports.
3. Add stub exports with typed signatures returning safe empty defaults.
4. Run the test; expect pass.
5. Commit: `feat: define coworking renderer model contract`.

**Acceptance:** Pure model functions exist and have no DOM or IPC dependencies.

**Validation:** `npx vitest run test/coworking/coworking-model-contract.test.ts`

### Task T-004: Define recording manifest Worker contract

**Schema:** `id=T-004`, `phase=P1`, `wave=W1`, `swarm=recording-contracts`, `area=backend`, `owner_role=backend-infra-executor`, `owner_agent=Copilot`, `est_hours=1.0`, `dependencies=["T-001"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w1/recording/T-004-copilot`, `../team-forge-ts/.worktrees/T-004-copilot`

**Files:**
- Modify: `docs/REALTIME_WORKER_API_CONTRACT.md`
- Modify: `docs/REALTIME_WORKSPACE_CONTRACT.md`

**Steps:**
1. Write a documentation check for `/v1/realtime/calls/:callId/recordings`.
2. Confirm it fails.
3. Add start, stop, finalize, and manifest response contract.
4. State that R2 storage uses existing project vault binding.
5. State that lounge is unrecorded by default.
6. Commit: `docs: define realtime recording manifest contract`.

**Acceptance:** Docs describe explicit recording routes and project-vault manifest storage.

**Validation:** `rg -n "recordings|manifest|project vault|not a standalone bucket" docs/REALTIME_WORKER_API_CONTRACT.md docs/REALTIME_WORKSPACE_CONTRACT.md`

### Task T-005: Define preload IPC recording facade contract

**Schema:** `id=T-005`, `phase=P1`, `wave=W1`, `swarm=ipc-contracts`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-002","T-004"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w1/ipc/T-005-codex`, `.worktrees/T-005-codex`

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/preload/preload.ts`
- Test: `test/coworking/recording-ipc-contract.test.ts`

**Steps:**
1. Add a test that `PlexusApi` has `recordingStart`, `recordingStop`, and `recordingFinalize` type members.
2. Run the test; expect type/import failure.
3. Add type members only, without wiring real implementation yet.
4. Add preload facade calls to `ipcRenderer.invoke`.
5. Run `npm run typecheck`.
6. Commit: `feat: type coworking recording ipc facade`.

**Acceptance:** Renderer API shape exists but no credentials are exposed.

**Validation:** `npm run typecheck`

### Task T-006: Define no-auto-join acceptance tests

**Schema:** `id=T-006`, `phase=P1`, `wave=W1`, `swarm=acceptance-contracts`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=0.75`, `dependencies=["T-003"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w1/qa/T-006-gemini`, `.worktrees/T-006-gemini`

**Files:**
- Create: `test/coworking/project-focus-behavior.test.ts`

**Steps:**
1. Test that changing selected project changes `focusedZone.room`.
2. Test that changing selected project does not call join.
3. Test that `deriveFocusedZone` returns `joinState: "not_joined"` until an active join exists.
4. Run test; expect failures until implementation tasks complete.
5. Commit test-only branch if using TDD integration.

**Acceptance:** Tests encode focus-only behavior.

**Validation:** `npx vitest run test/coworking/project-focus-behavior.test.ts`

### Task T-007: Define screen wall acceptance tests

**Schema:** `id=T-007`, `phase=P1`, `wave=W1`, `swarm=acceptance-contracts`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=0.75`, `dependencies=["T-003"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w1/qa/T-007-gemini`, `.worktrees/T-007-gemini`

**Files:**
- Create: `test/coworking/screen-wall-model.test.ts`

**Steps:**
1. Test that two live screen tracks produce two wall tiles.
2. Test that missing `pinnedTrackId` keeps wall layout.
3. Test that a valid `pinnedTrackId` marks one tile pinned.
4. Run the test; expect failures until model implementation.
5. Commit: `test: specify coworking screen wall model`.

**Acceptance:** Multi-person screen sharing is first-class in tests.

**Validation:** `npx vitest run test/coworking/screen-wall-model.test.ts`

### Task T-008: Define recording privacy acceptance tests

**Schema:** `id=T-008`, `phase=P1`, `wave=W1`, `swarm=acceptance-contracts`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=0.75`, `dependencies=["T-004"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w1/qa/T-008-gemini`, `.worktrees/T-008-gemini`

**Files:**
- Create: `test/coworking/recording-privacy-contract.test.ts`
- Create: `../team-forge-ts/cloudflare/worker/src/routes/__tests__/realtime-recording.test.ts`

**Steps:**
1. Add Plexus-side test for idle recording state by default.
2. Add Worker-side test that lounge recording start fails unless promoted explicitly.
3. Add Worker-side test that project room recording requires project id.
4. Run tests; expect failures until implementation.
5. Commit: `test: specify coworking recording privacy contract`.

**Acceptance:** No automatic recording and no default lounge recording are test-protected.

**Validation:** `npx vitest run test/coworking/recording-privacy-contract.test.ts` and `cd ../team-forge-ts/cloudflare/worker && pnpm test -- realtime-recording`

#### Wave 2 - Test and Fixture Baseline

### Task T-009: Add coworking test npm script

**Schema:** `id=T-009`, `phase=P1`, `wave=W2`, `swarm=test-baseline`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=0.5`, `dependencies=[]`, `lock_zone=true`

**Branch / worktree:** `swarm/ambient-floor/p1-w2/tests/T-009-codex`, `.worktrees/T-009-codex`

**Files:**
- Modify: `package.json`
- Create: `test/coworking/README.md`

**Steps:**
1. Run `npm run test:coworking`; expect missing script.
2. Add `"test:coworking": "vitest run test/coworking"` to `package.json`.
3. Create README stating tests use fixtures and never call live Worker/R2.
4. Run `npm run test:coworking`; expect pass or known failing TDD tests if already merged.
5. Commit: `test: add coworking test script`.

**Acceptance:** A narrow test command exists.

**Validation:** `npm run test:coworking`

### Task T-010: Add realtime fixture builders

**Schema:** `id=T-010`, `phase=P1`, `wave=W2`, `swarm=test-baseline`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-009"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w2/tests/T-010-codex`, `.worktrees/T-010-codex`

**Files:**
- Create: `test/coworking/fixtures/realtime.ts`

**Steps:**
1. Create fixture builders for `RealtimeRoom`, `FloorPresence`, `RealtimeParticipant`, and `RealtimeMediaTrack`.
2. Include one lounge room and two project rooms.
3. Include two simultaneous screen tracks.
4. Run `npm run test:coworking`.
5. Commit: `test: add coworking realtime fixtures`.

**Acceptance:** Tests can create deterministic floor, room, and screen states.

**Validation:** `npm run test:coworking`

### Task T-011: Add recording fixture builders

**Schema:** `id=T-011`, `phase=P1`, `wave=W2`, `swarm=test-baseline`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=0.75`, `dependencies=["T-010"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w2/tests/T-011-codex`, `.worktrees/T-011-codex`

**Files:**
- Create: `test/coworking/fixtures/recording.ts`

**Steps:**
1. Add `buildRecordingManifest` fixture with `projects/proj_123/coworking-recordings/rec_123/manifest.json`.
2. Add raw audio and screen track refs.
3. Add consent fixture for two participants.
4. Run `npm run test:coworking`.
5. Commit: `test: add coworking recording fixtures`.

**Acceptance:** Recording tests can assert project-vault paths.

**Validation:** `npm run test:coworking`

### Task T-012: Add Worker recording test fixtures

**Schema:** `id=T-012`, `phase=P1`, `wave=W2`, `swarm=worker-test-baseline`, `area=backend`, `owner_role=backend-infra-executor`, `owner_agent=Copilot`, `est_hours=1.0`, `dependencies=["T-004"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w2/worker-tests/T-012-copilot`, `../team-forge-ts/.worktrees/T-012-copilot`

**Files:**
- Modify: `../team-forge-ts/cloudflare/worker/src/routes/__tests__/realtime.test.ts`
- Create: `../team-forge-ts/cloudflare/worker/src/routes/__tests__/realtime-recording.test.ts`

**Steps:**
1. Reuse existing mock D1 patterns from realtime tests.
2. Add fixtures for project room, lounge room, call, participant, and screen track.
3. Run `cd ../team-forge-ts/cloudflare/worker && pnpm test -- realtime-recording`; expect route missing failures.
4. Commit: `test: add realtime recording route fixtures`.

**Acceptance:** Worker recording tests fail for missing implementation, not missing fixtures.

**Validation:** `cd ../team-forge-ts/cloudflare/worker && pnpm test -- realtime-recording`

### Task T-013: Create validation brief

**Schema:** `id=T-013`, `phase=P1`, `wave=W2`, `swarm=validation`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=0.75`, `dependencies=["T-001","T-004"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w2/qa/T-013-gemini`, `.worktrees/T-013-gemini`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-validation-brief.md`

**Steps:**
1. List validation stories for dropdown focus, project join, lounge strip, screen wall, recording start/stop, failed Worker, failed R2, and logout cleanup.
2. Mark which checks are automated vs manual.
3. Include expected screenshots only if Playwright/browser tooling is available during execution.
4. Commit: `docs: add ambient floor validation brief`.

**Acceptance:** Validation session can run from the brief without chat context.

**Validation:** `rg -n "focus-only|presence-only|recording|R2|screen wall|lounge" docs/evidence/2026-07-05-ambient-floor-validation-brief.md`

### Task T-014: Create GitHub issue mapping draft

**Schema:** `id=T-014`, `phase=P1`, `wave=W2`, `swarm=github-sync`, `area=product`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=1.0`, `dependencies=["T-001"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w2/github/T-014-claude`, `.worktrees/T-014-claude`

**Files:**
- Create: `docs/plans/2026-07-05-ambient-floor-github-issues.md`

**Steps:**
1. Convert every task ID into issue title format `[P#][W#][swarm] T-### - title`.
2. Add labels and owner role for each issue.
3. Add dependencies and lock-zone notes.
4. Commit: `docs: map ambient floor tasks to issue draft`.

**Acceptance:** The plan can become GitHub issues without rethinking ownership.

**Validation:** `rg -n "T-001|phase:p1|swarm:ui|agent:codex" docs/plans/2026-07-05-ambient-floor-github-issues.md`

#### Wave 3 - Parallel Launch Prep

### Task T-015: Write Codex UI bootstrap packet

**Schema:** `id=T-015`, `phase=P1`, `wave=W3`, `swarm=worker-bootstrap`, `area=product`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=0.75`, `dependencies=["T-001","T-003","T-013"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w3/bootstrap/T-015-claude`, `.worktrees/T-015-claude`

**Files:**
- Create: `docs/plans/ambient-floor-handoff/codex-ui-bootstrap.md`

**Steps:**
1. Write objective, non-goals, owned files, frozen contracts, and validation commands.
2. Include `CoWorkingPanel.tsx`, `coworkingModel.ts`, `theme.css`, and tests as owned surfaces.
3. Mark Worker and R2 code out of scope.
4. Commit: `docs: add codex ambient floor bootstrap`.

**Acceptance:** Codex can start UI tasks without re-reading this chat.

**Validation:** `rg -n "Owned|Out of scope|npm run test:coworking" docs/plans/ambient-floor-handoff/codex-ui-bootstrap.md`

### Task T-016: Write Copilot Worker bootstrap packet

**Schema:** `id=T-016`, `phase=P1`, `wave=W3`, `swarm=worker-bootstrap`, `area=product`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=0.75`, `dependencies=["T-004","T-012"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w3/bootstrap/T-016-claude`, `.worktrees/T-016-claude`

**Files:**
- Create: `docs/plans/ambient-floor-handoff/copilot-worker-bootstrap.md`

**Steps:**
1. Write objective, non-goals, owned Worker files, env constraints, and validation commands.
2. Include no standalone bucket and no renderer credentials as explicit non-goals.
3. Commit: `docs: add worker recording bootstrap`.

**Acceptance:** Copilot can start Worker recording tasks safely.

**Validation:** `rg -n "TEAMFORGE_ARTIFACTS|not a standalone bucket|pnpm test" docs/plans/ambient-floor-handoff/copilot-worker-bootstrap.md`

### Task T-017: Write Gemini validation bootstrap packet

**Schema:** `id=T-017`, `phase=P1`, `wave=W3`, `swarm=worker-bootstrap`, `area=qa`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=0.5`, `dependencies=["T-013"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w3/bootstrap/T-017-claude`, `.worktrees/T-017-claude`

**Files:**
- Create: `docs/plans/ambient-floor-handoff/gemini-validation-bootstrap.md`

**Steps:**
1. Write validation identity and target claims.
2. List required checks and expected output format.
3. Commit: `docs: add ambient floor validation bootstrap`.

**Acceptance:** Validation agent knows what to challenge.

**Validation:** `rg -n "no-auto-join|no-auto-record|release recommendation" docs/plans/ambient-floor-handoff/gemini-validation-bootstrap.md`

### Task T-018: Wave 1 integration gate

**Schema:** `id=T-018`, `phase=P1`, `wave=W3`, `swarm=integration`, `area=product`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=1.0`, `dependencies=["T-001","T-002","T-003","T-004","T-005","T-009","T-010","T-011","T-012","T-013","T-014","T-015","T-016","T-017"]`

**Branch / worktree:** `swarm/ambient-floor/p1-w3/integration/T-018-claude`, `.worktrees/T-018-claude`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-wave1-close.md`

**Steps:**
1. Review all Wave 1/Wave 2 handoffs.
2. Confirm contract drift is either absent or documented.
3. Run `npm run test:coworking` if tests are merged.
4. Run Worker `pnpm test -- realtime` if Worker tests are merged.
5. Record accepted baseline and blockers.
6. Commit: `docs: close ambient floor contract wave`.

**Acceptance:** Parallel implementation can start.

**Validation:** Evidence doc lists commands, results, blockers, and next wave baseline.

### Phase 2 - Plexus Ambient Floor UI

#### Wave 1 - Pure Model and Decomposition

### Task T-019: Implement project room option selector

**Schema:** `id=T-019`, `phase=P2`, `wave=W1`, `swarm=ui-model`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=0.75`, `dependencies=["T-003","T-010"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w1/ui-model/T-019-codex`, `.worktrees/T-019-codex`

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/project-room-options.test.ts`

**Steps:**
1. Test that project room options exclude `workspace_lobby`.
2. Test that options are sorted by active presence then name.
3. Implement `listProjectRoomOptions`.
4. Run `npm run test:coworking -- project-room-options`.
5. Commit: `feat: derive coworking project room options`.

**Acceptance:** The dropdown has deterministic project-room options.

**Validation:** `npm run test:coworking -- project-room-options`

### Task T-020: Implement default focused project selector

**Schema:** `id=T-020`, `phase=P2`, `wave=W1`, `swarm=ui-model`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=0.75`, `dependencies=["T-019"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w1/ui-model/T-020-codex`, `.worktrees/T-020-codex`

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/default-focused-project.test.ts`

**Steps:**
1. Test that active joined project wins.
2. Test that first active project room wins when no joined project exists.
3. Test that null is returned when no project rooms exist.
4. Implement `selectDefaultFocusedRoomId`.
5. Commit: `feat: derive default focused coworking room`.

**Acceptance:** Initial focused room is stable and explainable.

**Validation:** `npm run test:coworking -- default-focused-project`

### Task T-021: Implement focused zone derivation

**Schema:** `id=T-021`, `phase=P2`, `wave=W1`, `swarm=ui-model`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-020"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w1/ui-model/T-021-codex`, `.worktrees/T-021-codex`

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/focused-zone.test.ts`

**Steps:**
1. Test focused zone with selected project room.
2. Test focused zone falls back to lounge when no project selected.
3. Test members filter by focused room id.
4. Test join state is `not_joined` unless active join exists.
5. Implement `deriveFocusedZone`.
6. Commit: `feat: derive coworking focused zone`.

**Acceptance:** Project selection changes visual focus only.

**Validation:** `npm run test:coworking -- focused-zone`

### Task T-022: Implement lounge layer derivation

**Schema:** `id=T-022`, `phase=P2`, `wave=W1`, `swarm=ui-model`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=0.75`, `dependencies=["T-021"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w1/ui-model/T-022-codex`, `.worktrees/T-022-codex`

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/lounge-layer.test.ts`

**Steps:**
1. Test lounge members derive from `ringState: "lounge"` and lounge room id.
2. Test lounge strip remains visible when focused zone is a project.
3. Test project media priority flag is true when project mic/screen is active.
4. Implement `deriveLoungeLayer`.
5. Commit: `feat: derive coworking lounge layer`.

**Acceptance:** Lounge is a layer, not a separate page section.

**Validation:** `npm run test:coworking -- lounge-layer`

### Task T-023: Implement screen wall derivation

**Schema:** `id=T-023`, `phase=P2`, `wave=W1`, `swarm=ui-model`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-021","T-007"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w1/ui-model/T-023-codex`, `.worktrees/T-023-codex`

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/screen-wall-model.test.ts`

**Steps:**
1. Run existing failing screen wall tests.
2. Implement `deriveScreenWall`.
3. Add participant display labels to wall tiles.
4. Run `npm run test:coworking -- screen-wall-model`.
5. Commit: `feat: derive coworking screen wall model`.

**Acceptance:** Multiple screen shares produce stable wall tiles.

**Validation:** `npm run test:coworking -- screen-wall-model`

### Task T-024: Split presentational components folder

**Schema:** `id=T-024`, `phase=P2`, `wave=W1`, `swarm=ui-structure`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-021"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w1/ui-structure/T-024-codex`, `.worktrees/T-024-codex`

**Files:**
- Create: `src/renderer/components/coworking/AvatarTile.tsx`
- Create: `src/renderer/components/coworking/MiniAvatarCluster.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`

**Steps:**
1. Move `AvatarTile` without behavior changes.
2. Move `MiniAvatarCluster` without behavior changes.
3. Update imports.
4. Run `npm run typecheck`.
5. Commit: `refactor: extract coworking avatar components`.

**Acceptance:** Existing UI compiles before larger refactor.

**Validation:** `npm run typecheck`

### Task T-025: Extract lounge media controls component

**Schema:** `id=T-025`, `phase=P2`, `wave=W1`, `swarm=ui-structure`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-024"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w1/ui-structure/T-025-codex`, `.worktrees/T-025-codex`

**Files:**
- Create: `src/renderer/components/coworking/LoungeMiniStrip.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`

**Steps:**
1. Extract existing lounge active controls into `LoungeMiniStrip`.
2. Keep props explicit: media state, device lists, callbacks, lounge layer.
3. Run `npm run typecheck`.
4. Commit: `refactor: extract coworking lounge strip`.

**Acceptance:** Lounge UI can be reused in ambient floor and project focus.

**Validation:** `npm run typecheck`

### Task T-026: Extract room action and closeout helpers

**Schema:** `id=T-026`, `phase=P2`, `wave=W1`, `swarm=ui-structure`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-024"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w1/ui-structure/T-026-codex`, `.worktrees/T-026-codex`

**Files:**
- Create: `src/renderer/lib/coworkingActions.ts`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`

**Steps:**
1. Move pure helpers `shouldClearLocalAfterLeaveFailure`, `splitCloseoutLines`, and `paperclipStatusCopy`.
2. Add tests for closeout splitting.
3. Run `npm run test:coworking`.
4. Run `npm run typecheck`.
5. Commit: `refactor: extract coworking action helpers`.

**Acceptance:** Helper logic leaves component body smaller.

**Validation:** `npm run test:coworking && npm run typecheck`

#### Wave 2 - Ambient Floor Viewport and Focus Controls

### Task T-027: Pass projects into CoWorkingPanel

**Schema:** `id=T-027`, `phase=P2`, `wave=W2`, `swarm=ui-integration`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=0.75`, `dependencies=["T-019"]`, `lock_zone=true`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/ui/T-027-codex`, `.worktrees/T-027-codex`

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`

**Steps:**
1. Add `projects` prop to `CoWorkingPanel`.
2. Pass existing `projects` from `App.tsx`.
3. Do not change tab routing.
4. Run `npm run typecheck`.
5. Commit: `feat: pass projects into coworking panel`.

**Acceptance:** Co-working can label project dropdown without a new project fetch.

**Validation:** `npm run typecheck`

### Task T-028: Add project focus dropdown

**Schema:** `id=T-028`, `phase=P2`, `wave=W2`, `swarm=ui-controls`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.25`, `dependencies=["T-027","T-019","T-020"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/ui/T-028-codex`, `.worktrees/T-028-codex`

**Files:**
- Create: `src/renderer/components/coworking/ProjectZoneSelect.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Test: `test/coworking/project-focus-behavior.test.ts`

**Steps:**
1. Run project-focus behavior test and confirm it fails.
2. Add `selectedRoomId` state.
3. Render dropdown in the page header or floor toolbar.
4. Dropdown `onChange` updates focus only.
5. Verify no `realtimeJoinRoom` call fires from selection.
6. Commit: `feat: add coworking project focus dropdown`.

**Acceptance:** Project dropdown focuses the zone but does not join.

**Validation:** `npm run test:coworking -- project-focus-behavior && npm run typecheck`

### Task T-029: Replace room grid with focused zone shell

**Schema:** `id=T-029`, `phase=P2`, `wave=W2`, `swarm=ui-viewport`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.5`, `dependencies=["T-028","T-021"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/ui/T-029-codex`, `.worktrees/T-029-codex`

**Files:**
- Create: `src/renderer/components/coworking/AmbientFloorViewport.tsx`
- Create: `src/renderer/components/coworking/FocusedProjectZone.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`

**Steps:**
1. Create `AmbientFloorViewport` accepting floor, lounge layer, and focused zone.
2. Create `FocusedProjectZone` with room title, occupancy, join state, and empty screen wall placeholder.
3. Remove `rooms.map(...)` from the primary render.
4. Keep degraded/empty states.
5. Run `npm run typecheck`.
6. Commit: `feat: render focused coworking zone`.

**Acceptance:** Page no longer lists all rooms as the main experience.

**Validation:** `rg -n "rooms.map" src/renderer/components/CoWorkingPanel.tsx` should not find the old primary room grid.

### Task T-030: Add ambient floor people rail

**Schema:** `id=T-030`, `phase=P2`, `wave=W2`, `swarm=ui-viewport`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-029"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/ui/T-030-codex`, `.worktrees/T-030-codex`

**Files:**
- Create: `src/renderer/components/coworking/AmbientPeopleRail.tsx`
- Modify: `src/renderer/components/coworking/AmbientFloorViewport.tsx`

**Steps:**
1. Move floor avatar grid into ambient people rail.
2. Preserve click-to-focus for a member's room.
3. Add state labels for lounge, project, speaking, idle.
4. Run `npm run typecheck`.
5. Commit: `feat: add ambient coworking people rail`.

**Acceptance:** Floor presence remains visible as part of the ambient space.

**Validation:** `npm run typecheck`

### Task T-031: Add lounge default zone panel

**Schema:** `id=T-031`, `phase=P2`, `wave=W2`, `swarm=ui-viewport`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-022","T-029"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/ui/T-031-codex`, `.worktrees/T-031-codex`

**Files:**
- Create: `src/renderer/components/coworking/LoungeZonePanel.tsx`
- Modify: `src/renderer/components/coworking/AmbientFloorViewport.tsx`

**Steps:**
1. Render lounge as the default visible zone when no project is focused.
2. Show lounge members, waveform, and join lounge action.
3. Show `NO REC` and `NO TRANSCRIPT` chips.
4. Run `npm run typecheck`.
5. Commit: `feat: render lounge as ambient floor zone`.

**Acceptance:** Lounge is spatially visible, not a detached third panel.

**Validation:** `npm run typecheck`

### Task T-032: Add persistent lounge mini-strip

**Schema:** `id=T-032`, `phase=P2`, `wave=W2`, `swarm=ui-viewport`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-025","T-031"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/ui/T-032-codex`, `.worktrees/T-032-codex`

**Files:**
- Modify: `src/renderer/components/coworking/LoungeMiniStrip.tsx`
- Modify: `src/renderer/components/coworking/AmbientFloorViewport.tsx`

**Steps:**
1. Render mini-strip while a project zone is focused.
2. Show project-priority state when project media is active.
3. Keep leave lounge available.
4. Run `npm run typecheck`.
5. Commit: `feat: keep lounge strip during project focus`.

**Acceptance:** User can remain ambiently in lounge while project work takes priority.

**Validation:** `npm run typecheck`

### Task T-033: Change project join to presence-only

**Schema:** `id=T-033`, `phase=P2`, `wave=W2`, `swarm=ui-actions`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-029"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/actions/T-033-codex`, `.worktrees/T-033-codex`

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Test: `test/coworking/project-join-presence-only.test.ts`

**Steps:**
1. Test that `dropInToRoom` sends `intent: "presence_only"` even when a call exists.
2. Run test; expect current behavior fails because active call sets media.
3. Change project join to presence-only.
4. Keep media toggles explicit after join.
5. Commit: `feat: make project zone join presence first`.

**Acceptance:** Joining a focused project zone never starts mic/camera/screen.

**Validation:** `npm run test:coworking -- project-join-presence-only`

### Task T-034: Allow lounge plus project active joins

**Schema:** `id=T-034`, `phase=P2`, `wave=W2`, `swarm=ui-actions`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.25`, `dependencies=["T-033"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/actions/T-034-codex`, `.worktrees/T-034-codex`

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Test: `test/coworking/lounge-project-coexistence.test.ts`

**Steps:**
1. Test that joining a project does not leave lounge automatically.
2. Test that project media priority is set when project screen or mic is active.
3. Update `leaveOtherActiveJoins` logic to avoid leaving lounge unless explicitly requested.
4. Run tests.
5. Commit: `feat: let lounge coexist with project focus`.

**Acceptance:** Lounge stays ambient while the user joins a project zone.

**Validation:** `npm run test:coworking -- lounge-project-coexistence`

### Task T-035: Add project media control cluster

**Schema:** `id=T-035`, `phase=P2`, `wave=W2`, `swarm=ui-media-controls`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.25`, `dependencies=["T-033"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/media/T-035-codex`, `.worktrees/T-035-codex`

**Files:**
- Create: `src/renderer/components/coworking/ProjectMediaControls.tsx`
- Modify: `src/renderer/components/coworking/FocusedProjectZone.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`

**Steps:**
1. Create controls for mic, camera, screen, record, closeout, leave.
2. Disable media controls until presence join exists.
3. Wire mic/camera/screen callbacks to project active join, not lounge join.
4. Run `npm run typecheck`.
5. Commit: `feat: add project zone media controls`.

**Acceptance:** Media is post-join and explicit.

**Validation:** `npm run typecheck`

### Task T-036: Apply ambient floor CSS layout

**Schema:** `id=T-036`, `phase=P2`, `wave=W2`, `swarm=ui-polish`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.5`, `dependencies=["T-029","T-030","T-031","T-032"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w2/style/T-036-codex`, `.worktrees/T-036-codex`

**Files:**
- Modify: `src/renderer/theme.css`

**Steps:**
1. Add `.px-ambient-floor`, `.px-focused-zone`, `.px-lounge-mini-strip`, `.px-screen-wall`.
2. Keep FORMA tokens and avoid new palette drift.
3. Ensure fixed-format controls have stable dimensions.
4. Run `npm run build:renderer`.
5. Commit: `style: reframe coworking as ambient floor`.

**Acceptance:** Layout reads as one viewport, not stacked cards.

**Validation:** `npm run build:renderer`

#### Wave 3 - Media and Screen Wall Integration

### Task T-037: Fix remote track kind metadata

**Schema:** `id=T-037`, `phase=P2`, `wave=W3`, `swarm=realtime-session`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.25`, `dependencies=["T-023"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w3/realtime/T-037-codex`, `.worktrees/T-037-codex`

**Files:**
- Modify: `src/renderer/lib/RealtimeSession.ts`
- Test: `test/coworking/realtime-session-track-kind.test.ts`

**Steps:**
1. Test that screen tracks remain `trackKind: "screen"` when metadata is available.
2. Update remote track mapping to use Worker track metadata instead of treating all video as camera.
3. Preserve audio behavior.
4. Run test and typecheck.
5. Commit: `fix: preserve remote screen track kind`.

**Acceptance:** Screen wall can distinguish camera from screen.

**Validation:** `npm run test:coworking -- realtime-session-track-kind && npm run typecheck`

### Task T-038: Subscribe to focused zone remote tracks

**Schema:** `id=T-038`, `phase=P2`, `wave=W3`, `swarm=realtime-session`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.5`, `dependencies=["T-037"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w3/realtime/T-038-codex`, `.worktrees/T-038-codex`

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/lib/RealtimeSession.ts`

**Steps:**
1. Fetch focused room detail after project presence join.
2. Subscribe to live remote tracks in focused zone.
3. Store remote screen and audio streams separately.
4. Handle subscription failure as a recoverable degraded state.
5. Run `npm run typecheck`.
6. Commit: `feat: subscribe to focused project zone tracks`.

**Acceptance:** Focused project zone can receive remote tracks.

**Validation:** `npm run typecheck`

### Task T-039: Add screen wall component

**Schema:** `id=T-039`, `phase=P2`, `wave=W3`, `swarm=screen-wall`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.5`, `dependencies=["T-023","T-038"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w3/screen-wall/T-039-codex`, `.worktrees/T-039-codex`

**Files:**
- Create: `src/renderer/components/coworking/ScreenWall.tsx`
- Modify: `src/renderer/components/coworking/FocusedProjectZone.tsx`
- Test: `test/coworking/screen-wall-model.test.ts`

**Steps:**
1. Render empty wall state when no screens exist.
2. Render one tile per screen stream.
3. Show publisher label.
4. Keep layout stable for 1, 2, 3, and 4 screens.
5. Run `npm run typecheck`.
6. Commit: `feat: add coworking screen wall`.

**Acceptance:** Multiple screens are visible by default.

**Validation:** `npm run typecheck`

### Task T-040: Add click-to-pin screen behavior

**Schema:** `id=T-040`, `phase=P2`, `wave=W3`, `swarm=screen-wall`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-039"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w3/screen-wall/T-040-codex`, `.worktrees/T-040-codex`

**Files:**
- Modify: `src/renderer/components/coworking/ScreenWall.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Test: `test/coworking/screen-wall-model.test.ts`

**Steps:**
1. Add `pinnedTrackId` state.
2. Clicking a tile toggles pinned mode.
3. Pinned tile renders as primary, others as thumbnails.
4. Run screen wall tests.
5. Commit: `feat: add pinned coworking screen share`.

**Acceptance:** Any screen can become the focused share without stopping others.

**Validation:** `npm run test:coworking -- screen-wall-model`

### Task T-041: Add focused zone closeout placement

**Schema:** `id=T-041`, `phase=P2`, `wave=W3`, `swarm=ui-closeout`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=0.75`, `dependencies=["T-035"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w3/closeout/T-041-codex`, `.worktrees/T-041-codex`

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/components/coworking/ProjectMediaControls.tsx`

**Steps:**
1. Move closeout action into focused project zone controls.
2. Keep lounge closeout available but visually secondary.
3. Keep Paperclip handoff explicit.
4. Run `npm run typecheck`.
5. Commit: `feat: place closeout in focused project zone`.

**Acceptance:** Closeout belongs to the active room/call context.

**Validation:** `npm run typecheck`

### Task T-042: Add degraded states for media and Worker failure

**Schema:** `id=T-042`, `phase=P2`, `wave=W3`, `swarm=resilience`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-039"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w3/resilience/T-042-codex`, `.worktrees/T-042-codex`

**Files:**
- Modify: `src/renderer/components/coworking/FocusedProjectZone.tsx`
- Modify: `src/renderer/components/coworking/ScreenWall.tsx`
- Test: `test/coworking/degraded-state-model.test.ts`

**Steps:**
1. Add test for no media provider configured.
2. Add test for room detail failure while floor still renders.
3. Render recoverable degraded panels.
4. Run tests.
5. Commit: `feat: add coworking degraded media states`.

**Acceptance:** The page stays usable when media/Worker pieces fail.

**Validation:** `npm run test:coworking -- degraded-state-model`

### Task T-043: Update co-working design reference prompt

**Schema:** `id=T-043`, `phase=P2`, `wave=W3`, `swarm=design-docs`, `area=product`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=0.75`, `dependencies=["T-029","T-039"]`

**Branch / worktree:** `swarm/ambient-floor/p2-w3/docs/T-043-claude`, `.worktrees/T-043-claude`

**Files:**
- Modify: `docs/design/screen-references/co-working.prompt.txt`
- Create: `docs/design/screen-references/ambient-floor-reframe.prompt.txt`

**Steps:**
1. Add prompt describing one ambient floor viewport.
2. Preserve FORMA constraints.
3. Include focused project zone, screen wall, and lounge mini-strip.
4. Commit: `docs: update coworking ambient floor visual contract`.

**Acceptance:** Future visual proof points at the new product shape.

**Validation:** `rg -n "ambient floor|focused project zone|screen wall|lounge mini" docs/design/screen-references/*.prompt.txt`

### Phase 3 - Project Vault Recording Backend

#### Wave 1 - Worker D1/API Contract

### Task T-044: Add recording D1 migration

**Schema:** `id=T-044`, `phase=P3`, `wave=W1`, `swarm=worker-data`, `area=data`, `owner_role=backend-infra-executor`, `owner_agent=Copilot`, `est_hours=1.25`, `dependencies=["T-004"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w1/data/T-044-copilot`, `../team-forge-ts/.worktrees/T-044-copilot`

**Files:**
- Create: `../team-forge-ts/cloudflare/worker/migrations/0012_realtime_recordings.sql`

**Steps:**
1. Write migration for `realtime_recording_sessions`.
2. Include `workspace_id`, `project_id`, `room_id`, `call_session_id`, `state`, `r2_prefix`, `manifest_ref`, `started_at`, `ended_at`, `created_by_identity_id`.
3. Add indexes by workspace/project and call.
4. Run local migration.
5. Commit: `feat: add realtime recording migration`.

**Acceptance:** Recording sessions are separate from meeting records but linkable.

**Validation:** `cd ../team-forge-ts/cloudflare/worker && pnpm dlx wrangler d1 migrations apply TEAMFORGE_DB --local`

### Task T-045: Add Worker recording type helpers

**Schema:** `id=T-045`, `phase=P3`, `wave=W1`, `swarm=worker-contracts`, `area=backend`, `owner_role=backend-infra-executor`, `owner_agent=Copilot`, `est_hours=1.0`, `dependencies=["T-044"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w1/worker/T-045-copilot`, `../team-forge-ts/.worktrees/T-045-copilot`

**Files:**
- Modify: `../team-forge-ts/cloudflare/worker/src/routes/realtime.ts`

**Steps:**
1. Add row and API types for recording session and manifest.
2. Add mappers from snake_case D1 rows to camelCase response.
3. Keep nullable composed playback ref.
4. Run `pnpm check`.
5. Commit: `feat: type realtime recording sessions`.

**Acceptance:** Worker compiles with recording session types.

**Validation:** `cd ../team-forge-ts/cloudflare/worker && pnpm check`

### Task T-046: Add project-vault R2 key builder

**Schema:** `id=T-046`, `phase=P3`, `wave=W1`, `swarm=worker-recording`, `area=backend`, `owner_role=backend-infra-executor`, `owner_agent=Copilot`, `est_hours=1.0`, `dependencies=["T-045"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w1/worker/T-046-copilot`, `../team-forge-ts/.worktrees/T-046-copilot`

**Files:**
- Create: `../team-forge-ts/cloudflare/worker/src/lib/realtime-recording.ts`
- Test: `../team-forge-ts/cloudflare/worker/src/lib/realtime-recording.test.ts`

**Steps:**
1. Test project-scoped prefix format.
2. Test that missing project id throws.
3. Test no standalone bucket name is produced.
4. Implement key builder.
5. Run Worker tests.
6. Commit: `feat: add realtime recording project vault keys`.

**Acceptance:** Recording paths are project-scoped and deterministic.

**Validation:** `cd ../team-forge-ts/cloudflare/worker && pnpm test -- realtime-recording`

### Task T-047: Add recording start route

**Schema:** `id=T-047`, `phase=P3`, `wave=W2`, `swarm=worker-routes`, `area=backend`, `owner_role=backend-infra-executor`, `owner_agent=Copilot`, `est_hours=1.5`, `dependencies=["T-046"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w2/worker/T-047-copilot`, `../team-forge-ts/.worktrees/T-047-copilot`

**Files:**
- Modify: `../team-forge-ts/cloudflare/worker/src/routes/realtime.ts`
- Modify: `../team-forge-ts/cloudflare/worker/src/routes/v1.ts`
- Test: `../team-forge-ts/cloudflare/worker/src/routes/__tests__/realtime-recording.test.ts`

**Steps:**
1. Add failing test for `POST /v1/realtime/calls/:callId/recordings/start`.
2. Route only allows project rooms by default.
3. Reject lounge unless `promoteLoungeToRecordedSession` is true and a project id exists.
4. Insert recording session row.
5. Return recording session with `state: "recording"`.
6. Commit: `feat: start realtime project recording`.

**Acceptance:** Recording starts only by explicit request.

**Validation:** `cd ../team-forge-ts/cloudflare/worker && pnpm test -- realtime-recording`

### Task T-048: Add recording stop route

**Schema:** `id=T-048`, `phase=P3`, `wave=W2`, `swarm=worker-routes`, `area=backend`, `owner_role=backend-infra-executor`, `owner_agent=Copilot`, `est_hours=1.0`, `dependencies=["T-047"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w2/worker/T-048-copilot`, `../team-forge-ts/.worktrees/T-048-copilot`

**Files:**
- Modify: `../team-forge-ts/cloudflare/worker/src/routes/realtime.ts`
- Modify: `../team-forge-ts/cloudflare/worker/src/routes/v1.ts`
- Test: `../team-forge-ts/cloudflare/worker/src/routes/__tests__/realtime-recording.test.ts`

**Steps:**
1. Add failing test for stop route.
2. Verify caller owns recording or is admin/host.
3. Set `state: "stopped"` and `ended_at`.
4. Return updated session.
5. Commit: `feat: stop realtime project recording`.

**Acceptance:** Recording can be stopped without ending the room call.

**Validation:** `cd ../team-forge-ts/cloudflare/worker && pnpm test -- realtime-recording`

### Task T-049: Add manifest finalization route

**Schema:** `id=T-049`, `phase=P3`, `wave=W2`, `swarm=worker-routes`, `area=backend`, `owner_role=backend-infra-executor`, `owner_agent=Copilot`, `est_hours=1.5`, `dependencies=["T-048"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w2/worker/T-049-copilot`, `../team-forge-ts/.worktrees/T-049-copilot`

**Files:**
- Modify: `../team-forge-ts/cloudflare/worker/src/routes/realtime.ts`
- Modify: `../team-forge-ts/cloudflare/worker/src/routes/v1.ts`
- Test: `../team-forge-ts/cloudflare/worker/src/routes/__tests__/realtime-recording.test.ts`

**Steps:**
1. Add test for finalization writing manifest JSON to `TEAMFORGE_ARTIFACTS`.
2. Mock R2 put in test env.
3. Build manifest from recording session and live/closed tracks.
4. Store manifest under project-vault prefix.
5. Update `manifest_ref`.
6. Commit: `feat: finalize realtime recording manifest`.

**Acceptance:** Manifest-first recording package exists in R2 project vault.

**Validation:** `cd ../team-forge-ts/cloudflare/worker && pnpm test -- realtime-recording`

### Task T-050: Attach recording ref to meeting closeout

**Schema:** `id=T-050`, `phase=P3`, `wave=W2`, `swarm=worker-closeout`, `area=backend`, `owner_role=backend-infra-executor`, `owner_agent=Copilot`, `est_hours=1.25`, `dependencies=["T-049"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w2/worker/T-050-copilot`, `../team-forge-ts/.worktrees/T-050-copilot`

**Files:**
- Modify: `../team-forge-ts/cloudflare/worker/src/routes/realtime.ts`
- Test: `../team-forge-ts/cloudflare/worker/src/routes/__tests__/realtime-recording.test.ts`

**Steps:**
1. Add test that closeout can include a finalized recording id.
2. Validate recording belongs to same call/project.
3. Store manifest ref in `realtime_meeting_records.recording_ref`.
4. Preserve null recording ref when no recording exists.
5. Commit: `feat: attach recording manifest to closeout`.

**Acceptance:** Meeting records can point at recording manifests.

**Validation:** `cd ../team-forge-ts/cloudflare/worker && pnpm test -- realtime`

### Task T-051: Add Plexus Worker client recording wrappers

**Schema:** `id=T-051`, `phase=P3`, `wave=W3`, `swarm=plexus-recording-ipc`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-047","T-048","T-049"]`, `lock_zone=true`

**Branch / worktree:** `swarm/ambient-floor/p3-w3/ipc/T-051-codex`, `.worktrees/T-051-codex`

**Files:**
- Modify: `src/main/teamforge.ts`
- Test: `test/coworking/recording-worker-client.test.ts`

**Steps:**
1. Add tests for wrapper route paths.
2. Implement `startRealtimeRecording`, `stopRealtimeRecording`, `finalizeRealtimeRecording`.
3. Return `{ ok, recording/manifest, message }`.
4. Run tests and typecheck.
5. Commit: `feat: add realtime recording worker client`.

**Acceptance:** Plexus main can call Worker recording routes.

**Validation:** `npm run test:coworking -- recording-worker-client && npm run typecheck`

### Task T-052: Wire Plexus main IPC recording handlers

**Schema:** `id=T-052`, `phase=P3`, `wave=W3`, `swarm=plexus-recording-ipc`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-051"]`, `lock_zone=true`

**Branch / worktree:** `swarm/ambient-floor/p3-w3/ipc/T-052-codex`, `.worktrees/T-052-codex`

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/preload/preload.ts`
- Test: `test/coworking/recording-ipc-contract.test.ts`

**Steps:**
1. Add IPC handlers under `realtime:recordingStart`, `realtime:recordingStop`, `realtime:recordingFinalize`.
2. Ensure handlers import Worker wrappers lazily.
3. Ensure preload exposes only typed methods.
4. Run typecheck.
5. Commit: `feat: wire coworking recording ipc`.

**Acceptance:** Renderer can request recording lifecycle without secrets.

**Validation:** `npm run typecheck`

### Task T-053: Add recording state model to focused zone

**Schema:** `id=T-053`, `phase=P3`, `wave=W3`, `swarm=ui-recording`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-052"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w3/ui/T-053-codex`, `.worktrees/T-053-codex`

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/recording-state-model.test.ts`

**Steps:**
1. Test idle default.
2. Test recording state only applies to focused project zone.
3. Test lounge shows unrecorded unless promoted.
4. Implement state derivation.
5. Commit: `feat: derive coworking recording state`.

**Acceptance:** UI can clearly show recording eligibility and state.

**Validation:** `npm run test:coworking -- recording-state-model`

### Task T-054: Add explicit recording controls

**Schema:** `id=T-054`, `phase=P3`, `wave=W3`, `swarm=ui-recording`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.5`, `dependencies=["T-035","T-053"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w3/ui/T-054-codex`, `.worktrees/T-054-codex`

**Files:**
- Modify: `src/renderer/components/coworking/ProjectMediaControls.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Test: `test/coworking/recording-privacy-contract.test.ts`

**Steps:**
1. Add Record button disabled until presence join exists and focused zone has project id.
2. Add explicit start confirmation copy in UI.
3. Add Stop and Finalize states.
4. Wire IPC calls.
5. Run tests and typecheck.
6. Commit: `feat: add explicit project zone recording controls`.

**Acceptance:** Recording cannot start accidentally.

**Validation:** `npm run test:coworking -- recording-privacy-contract && npm run typecheck`

### Task T-055: Add recording manifest display

**Schema:** `id=T-055`, `phase=P3`, `wave=W3`, `swarm=ui-recording`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-054"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w3/ui/T-055-codex`, `.worktrees/T-055-codex`

**Files:**
- Create: `src/renderer/components/coworking/RecordingManifestStatus.tsx`
- Modify: `src/renderer/components/coworking/FocusedProjectZone.tsx`

**Steps:**
1. Render manifest ref after finalize.
2. Render raw track count and optional playback status.
3. Do not expose signed URLs unless Worker returns display-safe refs.
4. Run typecheck.
5. Commit: `feat: show coworking recording manifest status`.

**Acceptance:** User can see recording saved as project memory.

**Validation:** `npm run typecheck`

### Task T-056: Update closeout payload with recording manifest

**Schema:** `id=T-056`, `phase=P3`, `wave=W3`, `swarm=ui-recording`, `area=frontend`, `owner_role=frontend-executor`, `owner_agent=Codex`, `est_hours=1.0`, `dependencies=["T-050","T-055"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w3/ui/T-056-codex`, `.worktrees/T-056-codex`

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Test: `test/coworking/closeout-recording-ref.test.ts`

**Steps:**
1. Extend `RealtimeCloseoutPayload` with optional recording manifest id/ref if Worker contract requires it.
2. Add closeout test for recording ref inclusion.
3. Keep payload absent when no recording exists.
4. Run typecheck.
5. Commit: `feat: include recording manifest in closeout`.

**Acceptance:** Closeout can link finalized recording manifest.

**Validation:** `npm run test:coworking -- closeout-recording-ref && npm run typecheck`

### Task T-057: Worker/Plexus recording integration gate

**Schema:** `id=T-057`, `phase=P3`, `wave=W3`, `swarm=integration`, `area=qa`, `owner_role=release-integrator`, `owner_agent=Claude`, `est_hours=1.0`, `dependencies=["T-044","T-045","T-046","T-047","T-048","T-049","T-050","T-051","T-052","T-053","T-054","T-055","T-056"]`

**Branch / worktree:** `swarm/ambient-floor/p3-w3/integration/T-057-claude`, `.worktrees/T-057-claude`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-recording-integration.md`

**Steps:**
1. Run Plexus recording tests.
2. Run Worker recording tests.
3. Confirm no standalone bucket strings were introduced.
4. Confirm renderer has no R2 credential references.
5. Record evidence.
6. Commit: `docs: record ambient floor recording integration evidence`.

**Acceptance:** Recording contract is coherent across Worker and Plexus.

**Validation:** `rg -n "R2_ACCESS_KEY|R2_SECRET|TEAMFORGE_ARTIFACTS" src/renderer src/preload` should find no renderer secret usage.

### Phase 4 - Integration, Hardening, and Release Proof

#### Wave 1 - Cross-Surface Integration

### Task T-058: Merge Wave 2 UI into integration branch

**Schema:** `id=T-058`, `phase=P4`, `wave=W1`, `swarm=integration`, `area=product`, `owner_role=release-integrator`, `owner_agent=Claude`, `est_hours=1.0`, `dependencies=["T-043"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w1/integration/T-058-claude`, `.worktrees/T-058-claude`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-ui-merge.md`

**Steps:**
1. Merge accepted UI branches at wave boundary.
2. Resolve lock-zone files intentionally.
3. Run `npm run test:coworking`.
4. Run `npm run typecheck`.
5. Record merge evidence.
6. Commit: `docs: record ambient floor ui merge evidence`.

**Acceptance:** UI work has one coherent integration state.

**Validation:** `npm run test:coworking && npm run typecheck`

### Task T-059: Merge Worker recording into Worker integration branch

**Schema:** `id=T-059`, `phase=P4`, `wave=W1`, `swarm=integration`, `area=backend`, `owner_role=release-integrator`, `owner_agent=Claude`, `est_hours=1.0`, `dependencies=["T-057"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w1/integration/T-059-claude`, `../team-forge-ts/.worktrees/T-059-claude`

**Files:**
- Create: `docs/evidence/2026-07-05-worker-recording-merge.md`

**Steps:**
1. Merge accepted Worker branches at wave boundary.
2. Run `pnpm test`.
3. Run `pnpm check`.
4. Record migration status.
5. Commit: `docs: record worker recording merge evidence`.

**Acceptance:** Worker route and migration work is coherent.

**Validation:** `cd ../team-forge-ts/cloudflare/worker && pnpm test && pnpm check`

### Task T-060: Run Plexus full local verification

**Schema:** `id=T-060`, `phase=P4`, `wave=W1`, `swarm=verification`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=1.25`, `dependencies=["T-058"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w1/qa/T-060-gemini`, `.worktrees/T-060-gemini`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-local-verification.md`

**Steps:**
1. Run `npm run test:coworking`.
2. Run `npm run typecheck`.
3. Run `npm run lint -- --quiet`.
4. Run `npm run build:main`.
5. Run `npm run build:preload`.
6. Run `npm run build:renderer`.
7. Record evidence and residual risk.

**Acceptance:** Plexus source passes local verification.

**Validation:** commands above exit 0.

### Task T-061: Run Worker full local verification

**Schema:** `id=T-061`, `phase=P4`, `wave=W1`, `swarm=verification`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=1.0`, `dependencies=["T-059"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w1/qa/T-061-gemini`, `../team-forge-ts/.worktrees/T-061-gemini`

**Files:**
- Create: `docs/evidence/2026-07-05-worker-recording-local-verification.md`

**Steps:**
1. Run `pnpm test`.
2. Run `pnpm check`.
3. Run local D1 migration.
4. Record evidence and residual risk.
5. Commit evidence.

**Acceptance:** Worker source passes local verification.

**Validation:** Worker commands exit 0.

#### Wave 2 - UX and Resilience Hardening

### Task T-062: Manual UI smoke for focus-only dropdown

**Schema:** `id=T-062`, `phase=P4`, `wave=W2`, `swarm=manual-proof`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=1.0`, `dependencies=["T-060"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w2/qa/T-062-gemini`, `.worktrees/T-062-gemini`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-ui-smoke.md`

**Steps:**
1. Start app with `npm run dev`.
2. Open Co-working tab.
3. Change project dropdown.
4. Verify no join occurs.
5. Click Join and verify presence-only state.
6. Record evidence.

**Acceptance:** Focus and join semantics match product decision.

**Validation:** evidence doc with observations; screenshots if browser/screenshot tooling is available.

### Task T-063: Manual UI smoke for lounge persistence

**Schema:** `id=T-063`, `phase=P4`, `wave=W2`, `swarm=manual-proof`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=0.75`, `dependencies=["T-060"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w2/qa/T-063-gemini`, `.worktrees/T-063-gemini`

**Files:**
- Modify: `docs/evidence/2026-07-05-ambient-floor-ui-smoke.md`

**Steps:**
1. Join lounge.
2. Focus a project zone.
3. Verify lounge mini-strip remains visible.
4. Start project media if available and verify project priority indicator.
5. Record evidence.

**Acceptance:** Lounge remains ambient while project zone is focused.

**Validation:** evidence doc update.

### Task T-064: Manual UI smoke for screen wall

**Schema:** `id=T-064`, `phase=P4`, `wave=W2`, `swarm=manual-proof`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=1.0`, `dependencies=["T-060"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w2/qa/T-064-gemini`, `.worktrees/T-064-gemini`

**Files:**
- Modify: `docs/evidence/2026-07-05-ambient-floor-ui-smoke.md`

**Steps:**
1. Use fixtures or live room with at least two screen tracks.
2. Verify screen wall shows multiple tiles.
3. Click one screen and verify pinned layout.
4. Stop share and verify wall recovers.
5. Record evidence.

**Acceptance:** Multi-screen behavior works without layout collapse.

**Validation:** evidence doc update.

### Task T-065: Manual UI smoke for recording lifecycle

**Schema:** `id=T-065`, `phase=P4`, `wave=W2`, `swarm=manual-proof`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=1.25`, `dependencies=["T-057","T-060","T-061"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w2/qa/T-065-gemini`, `.worktrees/T-065-gemini`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-recording-smoke.md`

**Steps:**
1. Join focused project zone presence-only.
2. Start recording explicitly.
3. Stop recording.
4. Finalize manifest.
5. Verify manifest ref points at project-vault prefix.
6. Verify lounge was not recorded.
7. Record evidence.

**Acceptance:** Recording is explicit and project-scoped.

**Validation:** evidence doc plus Worker response snippets without secrets.

### Task T-066: Add resilience docs updates

**Schema:** `id=T-066`, `phase=P4`, `wave=W2`, `swarm=docs`, `area=product`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=0.75`, `dependencies=["T-042","T-065"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w2/docs/T-066-claude`, `.worktrees/T-066-claude`

**Files:**
- Modify: `docs/APP_RESILIENCE_REVIEW.md`

**Steps:**
1. Add ambient floor and recording failure expectations.
2. State Worker/R2 failure cannot block leave/join state cleanup.
3. State recording finalization can be retryable.
4. Commit: `docs: update coworking resilience expectations`.

**Acceptance:** Resilience review matches new design.

**Validation:** `rg -n "ambient floor|recording finalization|project vault" docs/APP_RESILIENCE_REVIEW.md`

### Task T-067: Add release note and operator handoff

**Schema:** `id=T-067`, `phase=P4`, `wave=W2`, `swarm=docs`, `area=product`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=0.75`, `dependencies=["T-060","T-061","T-065"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w2/docs/T-067-claude`, `.worktrees/T-067-claude`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-release-handoff.md`

**Steps:**
1. Summarize implemented user-facing behavior.
2. List required Worker env/binding expectations.
3. List proof commands and results.
4. List known live blockers if any.
5. Commit: `docs: add ambient floor release handoff`.

**Acceptance:** Operator can understand release readiness.

**Validation:** evidence doc includes commands and results.

#### Wave 3 - Release Readiness

### Task T-068: Run packaging-safe smoke

**Schema:** `id=T-068`, `phase=P4`, `wave=W3`, `swarm=release`, `area=qa`, `owner_role=release-integrator`, `owner_agent=Claude`, `est_hours=1.5`, `dependencies=["T-060","T-067"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w3/release/T-068-claude`, `.worktrees/T-068-claude`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-package-smoke.md`

**Steps:**
1. Run `npm run release:ota:prep` if not doing a full clean release.
2. Run `npm run dist` or the repo-approved release dry-run if required by release owner.
3. Launch packaged build if available.
4. Confirm Co-working tab loads.
5. Record evidence.

**Acceptance:** Packaged runtime does not regress the Co-working tab.

**Validation:** release command exits 0 or documented blocker exists.

### Task T-069: Create rollback plan

**Schema:** `id=T-069`, `phase=P4`, `wave=W3`, `swarm=release`, `area=product`, `owner_role=release-integrator`, `owner_agent=Claude`, `est_hours=0.5`, `dependencies=["T-067"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w3/release/T-069-claude`, `.worktrees/T-069-claude`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-rollback.md`

**Steps:**
1. Identify UI rollback commit range.
2. Identify Worker route/migration rollback constraints.
3. Document feature-flag or disable path if added.
4. Commit: `docs: add ambient floor rollback plan`.

**Acceptance:** Release owner has a concrete fallback.

**Validation:** doc names exact files/routes/migrations.

### Task T-070: Final validation review

**Schema:** `id=T-070`, `phase=P4`, `wave=W3`, `swarm=validation`, `area=qa`, `owner_role=validation-reviewer`, `owner_agent=Gemini`, `est_hours=1.0`, `dependencies=["T-062","T-063","T-064","T-065","T-068"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w3/qa/T-070-gemini`, `.worktrees/T-070-gemini`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-final-validation.md`

**Steps:**
1. Review all evidence docs.
2. Challenge acceptance claims.
3. List missing proof or residual risk.
4. Recommend `pass`, `conditional`, or `fail`.
5. Commit: `docs: add final ambient floor validation`.

**Acceptance:** Validation recommendation is explicit.

**Validation:** final validation doc exists and names evidence inputs.

### Task T-071: GitHub issue and PR closeout

**Schema:** `id=T-071`, `phase=P4`, `wave=W3`, `swarm=github-sync`, `area=product`, `owner_role=planner-orchestrator`, `owner_agent=Claude`, `est_hours=1.0`, `dependencies=["T-070"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w3/github/T-071-claude`, `.worktrees/T-071-claude`

**Files:**
- Modify: `docs/plans/2026-07-05-ambient-floor-github-issues.md`

**Steps:**
1. Update issue statuses from planned to done/blocked/deferred.
2. Link PRs and evidence.
3. Post wave close summaries.
4. Commit docs update if issue map lives in repo.

**Acceptance:** GitHub is the system of record for execution state.

**Validation:** issue map includes final status for each task.

### Task T-072: Release readiness decision

**Schema:** `id=T-072`, `phase=P4`, `wave=W3`, `swarm=release`, `area=product`, `owner_role=release-integrator`, `owner_agent=Claude`, `est_hours=0.75`, `dependencies=["T-068","T-069","T-070","T-071"]`

**Branch / worktree:** `swarm/ambient-floor/p4-w3/release/T-072-claude`, `.worktrees/T-072-claude`

**Files:**
- Create: `docs/evidence/2026-07-05-ambient-floor-release-decision.md`

**Steps:**
1. Summarize validation status.
2. Name whether release is ready, conditional, or blocked.
3. If ready, point to existing repo release workflow.
4. If blocked, name the next unblocker.
5. Commit: `docs: record ambient floor release decision`.

**Acceptance:** No one has to infer ship status from scattered logs.

**Validation:** release decision doc includes command evidence and residual risk.

## Dependency Rationale

Contracts must land before parallel implementation because the UI and Worker both depend on recording state names, manifest shape, project-vault path semantics, and IPC names. UI model tasks can run before Worker recording routes because screen wall and focus behavior are local derivations over existing room/detail data. Recording controls must wait for Worker route contract and Plexus IPC wrappers. Manual proof waits until both UI and Worker sides are integrated.

Safe parallel batches:

- `T-019` to `T-023` can run in parallel after `T-003` if they do not edit the same sections of `coworkingModel.ts`; otherwise serialize under one owner.
- `T-030`, `T-031`, and `T-032` can run after `T-029` if each owns separate component files.
- `T-044` to `T-046` are Worker-only and can run while UI Wave 2 proceeds.
- `T-047` to `T-050` should stay serialized because they touch Worker route lock zones.
- `T-051` to `T-056` should stay serialized because they touch Plexus IPC lock zones and closeout payloads.

Integration swarms:

- `T-018` closes contract baseline.
- `T-057` closes recording cross-repo integration.
- `T-058` and `T-059` close UI and Worker merges separately.
- `T-070` challenges all completion claims.

## Verification Strategy

### Per-task proof

Each task must attach at least one command or evidence artifact. Tests are preferred. Documentation tasks must include `rg` checks proving required terms are present.

### Per-wave proof

- P1 close: contract docs, type tests, fixture baseline, bootstrap packets.
- P2 close: coworking model tests, renderer typecheck, renderer build.
- P3 close: Worker tests, Worker typecheck, Plexus IPC typecheck, no renderer secrets.
- P4 close: full local checks, Worker checks, manual smoke, final validation recommendation.

### Regression targets

- Dropdown focus does not call join.
- Project join sends presence-only.
- Lounge remains while project focus is active.
- Project media priority overrides lounge media emphasis.
- Multiple screen shares render simultaneously.
- Pinned share does not stop other shares.
- Recording starts only from explicit project-zone action.
- Lounge is not recorded by default.
- Recording manifest path is project-scoped.
- Renderer never sees R2 credentials.
- Closeout can save without Paperclip or recording.
- Leave remains usable during Worker/R2/media errors.

## GitHub Sync Strategy

Use one issue per task. Recommended labels:

- `phase:p1`, `phase:p2`, `phase:p3`, `phase:p4`
- `wave:w1`, `wave:w2`, `wave:w3`
- `swarm:ui-model`, `swarm:ui-viewport`, `swarm:worker-routes`, `swarm:validation`, `swarm:integration`
- `agent:claude`, `agent:codex`, `agent:copilot`, `agent:gemini`
- `area:frontend`, `area:backend`, `area:data`, `area:qa`, `area:product`
- `status:planned`, `status:ready`, `status:blocked`, `status:in-progress`, `status:in-review`, `status:done`

Issue body must include task ID, branch/worktree, allowed files, lock-zone files, validation command, dependencies, and handoff format.

PRs must reference the task issue and include:

1. changed files,
2. validation evidence,
3. lock-zone files touched,
4. contract drift status,
5. downstream handoff notes.

## Worker Bootstrap Packet Strategy

Before launching Codex, Copilot, or Gemini worker sessions, create:

- `docs/plans/ambient-floor-handoff/shared-contracts.md`
- `docs/plans/ambient-floor-handoff/codex-ui-bootstrap.md`
- `docs/plans/ambient-floor-handoff/copilot-worker-bootstrap.md`
- `docs/plans/ambient-floor-handoff/gemini-validation-bootstrap.md`

Each packet should include:

- current branch/worktree,
- owned files,
- frozen contracts,
- explicit non-goals,
- validation commands,
- expected handback format.

## Risks and Fallback Plan

| Risk | Trigger | Fallback |
|---|---|---|
| Worker recording route scope grows too large | R2 upload/composition requires new infra not present | Ship manifest-only references first; keep composed playback deferred. |
| Cloudflare Realtime receive path cannot return screen metadata | Remote tracks arrive as generic video | Use Worker track metadata mapping by transceiver/order; if unreliable, show publish metadata until renegotiation is fixed. |
| Project-vault R2 path is not available in Worker env | `TEAMFORGE_ARTIFACTS` or equivalent binding missing | Block recording finalization, keep local stopped state, do not fake saved proof. |
| UI refactor collides with unrelated assistant dirty files | Worktree has unrelated changes | Use fresh worktrees per task; never clean the user's current checkout. |
| Multi-agent edits collide on `src/shared/types.ts` or `main.ts` | Codex tasks both need lock-zone files | Serialize under one integration task. |
| Visual proof tooling unavailable | Playwright/screenshots unavailable | Use type/build/tests plus manual evidence notes; do not claim screenshot proof. |

## Plan Completion Checklist

- [x] Discovery captured.
- [x] Required swarm playbooks loaded.
- [x] Contracts freeze before parallel work.
- [x] Phase, wave, and swarm structure defined.
- [x] Task list uses stable task IDs and ownership.
- [x] Lock zones are explicit.
- [x] Verification strategy is explicit.
- [x] GitHub sync strategy is defined.
- [x] Worker bootstrap packet strategy is defined.
