# Authenticated Coworking Presence Leases Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Coworking show only people with a fresh authenticated Plexus app lease, while keeping roster, timer activity, and room membership as independent states.

**Architecture:** TeamForge stores 60-second, server-timestamped per-client leases and aggregates fresh leases once per identity. A Worker-issued presence session binds each stable installation to one authenticated Electron main-process lifetime; sequenced 15-second heartbeats report timer activity only, while verified realtime join/leave routes own room context. Coworking reads the lease endpoint directly, and session rotation prevents stale realtime participants from returning after restart.

**Tech Stack:** TypeScript, Electron, React, Vitest, Cloudflare Workers, D1/SQLite, Wrangler, pnpm, npm.

---

## Frozen contract

- Heartbeat interval: `15_000ms`.
- Lease lifetime: `60_000ms`, chosen only from Worker server time.
- Fresh boundary: `expiresAt > serverNow`; equality is expired.
- Identity key: `(workspace_id, identity_id)`.
- Client key: `(workspace_id, identity_id, client_instance_id)`.
- Process key: opaque Worker-issued `presenceSessionId`, rotated at every authenticated app start/login and held only in Electron main memory.
- Heartbeat order: strictly increasing per-session integer `sequence`; lower/equal sequences cannot renew or replace activity evidence.
- Presence proof: literal `authenticated_app_lease`.
- Activity: `focused` only for an unpaused local running timer; otherwise `available`.
- Room context: `none`, `lounge`, or `project`; explicit join only.
- Room authority: heartbeat accepts no room fields; Worker join/leave derives and writes context.
- Floor output: one row per active identity, no raw client IDs, exact `activeClientCount`.
- Speaking: false until an actual voice-activity signal exists.
- Failure: unavailable data is not reported as zero users.
- Read evidence: each floor member includes server-owned `observedAt`.

## Execution lanes

The Worker lane (Tasks 1-4) and Plexus lane (Tasks 5-7) may execute in parallel after this plan is committed. They touch separate repositories and share only the frozen JSON contract above. Task 8 begins after the Plexus shared types land. Task 9 is the integration and review barrier.

- **External Temperance lane:** TeamForge Tasks 1-4 in an isolated worktree; integrate its generated diff only after focused tests pass.
- **Codex subagent lane:** Plexus Tasks 5-7 in the prepared Plexus worktree, with RED-GREEN evidence and a task commit.
- **Inline primary lane:** contract review, diff integration, Task 8 semantics, full verification, and ISA evidence.
- **Fail-open:** any external `failed`, `timeout`, `unavailable`, or invalid diff is immediately reassigned to a Codex subagent.

## Task 1: Add the D1 app-presence lease schema

**Repository:** TeamForge at `/private/tmp/teamforge-coworking-presence-leases`

**Files:**

- Create: `cloudflare/worker/migrations/0016_plexus_app_presence_leases.sql`
- Create: `cloudflare/worker/src/routes/__tests__/presence-migration.test.ts`

**Step 1: Write the failing migration test**

Use `node:sqlite`'s `DatabaseSync`, apply the prerequisite migrations, then read and apply migration 0016. Assert the table columns, unique constraint, expiry index, and preservation of existing realtime tables.

```ts
it('adds app presence leases without replacing realtime state', () => {
  const db = new DatabaseSync(':memory:');
  apply(db, '0001_initial.sql');
  apply(db, '0009_plexus_session_onboarding.sql');
  apply(db, '0011_realtime_workspace.sql');
  apply(db, '0016_plexus_app_presence_leases.sql');

  expect(columns(db, 'plexus_app_presence_leases')).toEqual(expect.arrayContaining([
    'workspace_id', 'identity_id', 'client_instance_id', 'presence_session_id',
    'last_sequence', 'activity_state', 'room_kind', 'last_seen_at', 'expires_at',
  ]));
  expect(columns(db, 'realtime_participants')).toContain('presence_session_id');
  expect(tableExists(db, 'realtime_participants')).toBe(true);
});
```

**Step 2: Run the test and witness RED**

Run:

```bash
pnpm --dir cloudflare/worker exec vitest run --config vitest.config.ts src/routes/__tests__/presence-migration.test.ts
```

Expected: FAIL because `0016_plexus_app_presence_leases.sql` does not exist.

**Step 3: Add the minimal additive migration**

Create `plexus_app_presence_leases` with:

- Primary key `id`.
- Foreign keys to `workspaces` and `plexus_identities`.
- Unique `(workspace_id, identity_id, client_instance_id)`.
- Worker-issued `presence_session_id` and integer `last_sequence` on each stable client row.
- `activity_state CHECK ('available','focused')`.
- Nullable bounded timer fields.
- Server-owned `room_kind`, `room_id`, `room_call_id`, `room_participant_id`, `room_project_id`, and `room_observed_at`.
- Server timestamps `last_seen_at`, `expires_at`, `created_at`, `updated_at`.
- Index `(workspace_id, expires_at)` and identity/client lookup index.
- Additive nullable `presence_session_id` column on `realtime_participants`.

Do not add a roster row or synthesize an initial lease in the migration.

**Step 4: Run GREEN**

Run the focused test again. Expected: PASS.

**Step 5: Commit**

```bash
git add cloudflare/worker/migrations/0016_plexus_app_presence_leases.sql cloudflare/worker/src/routes/__tests__/presence-migration.test.ts
git commit -m "feat(worker): add Plexus app presence lease schema"
```

## Task 2: Implement authenticated presence sessions, heartbeat, and disconnect

**Repository:** TeamForge

**Files:**

- Create: `cloudflare/worker/src/routes/presence.ts`
- Create: `cloudflare/worker/src/routes/__tests__/presence.test.ts`
- Modify: `cloudflare/worker/src/routes/v1.ts`

**Step 1: Write failing route tests**

Cover these independent cases:

1. Session open or heartbeat without a registered principal returns `401 access_identity_required`.
2. Empty and over-128-character client IDs return 400.
3. Workspace, identity, employee, and display name come from `PlexusPrincipal`, never the body.
4. Server time sets `lastSeenAt`; expiry is exactly 60 seconds later.
5. Session open returns a Worker-issued opaque presence session and clears the client's prior room context.
6. Repeating a heartbeat for the current client/session with a higher sequence updates one row.
7. A stale or non-current presence session heartbeat returns 409 without renewal.
8. A lower/equal sequence cannot update timestamps or any activity evidence.
9. Two client IDs create two rows.
10. Disconnect removes only the caller's matching client and session.
11. Responses include `Cache-Control: no-store`.
12. A heartbeat deletes already-expired rows in the caller's workspace before renewal.
13. Forged client `lastSeenAt`, `expiresAt`, or `ttl` fields do not affect the server window.
14. Any heartbeat room field is rejected with 400.
15. Invalid activity enum/shape combinations and over-limit timer/project strings return 400 independently.
16. An employee principal without a matching active employee returns 403; admin is the explicit exception.

Use a complete D1 fake that records bound SQL values and maintains lease rows. Test the exported pure timestamp function at the exact TTL boundary; do not use real sleeps.

```ts
expect(presenceLeaseWindow(new Date('2026-07-16T10:00:00.000Z'))).toEqual({
  lastSeenAt: '2026-07-16T10:00:00.000Z',
  expiresAt: '2026-07-16T10:01:00.000Z',
});
```

**Step 2: Witness RED**

```bash
pnpm --dir cloudflare/worker exec vitest run --config vitest.config.ts src/routes/__tests__/presence.test.ts
```

Expected: FAIL because the handlers and routes are absent.

**Step 3: Implement the minimum handlers**

In `presence.ts` export:

```ts
export const PRESENCE_LEASE_TTL_MS = 60_000;
export function presenceLeaseWindow(at: Date): { lastSeenAt: string; expiresAt: string };
export async function handleOpenPresenceSession(env: Env, request: Request, principal?: PlexusPrincipal | null): Promise<Response>;
export async function handlePresenceHeartbeat(env: Env, request: Request, principal?: PlexusPrincipal | null): Promise<Response>;
export async function handlePresenceDisconnect(env: Env, request: Request, principal?: PlexusPrincipal | null): Promise<Response>;
```

Freeze the request schema:

```ts
type OpenPresenceSessionInput = { clientInstanceId: string };
type PresenceHeartbeatInput = {
  clientInstanceId: string;
  presenceSessionId: string;
  sequence: number;
  activity: {
    state: 'available' | 'focused';
    timerEntryId: string | null;
    projectId: string | null;
    timerStartedAt: string | null;
  };
};
```

`focused` requires all timer evidence; `available` normalizes all timer fields to null. Reject unknown room fields rather than ignoring them. Opening a session uses a server-generated ID and atomically replaces the stable client's prior session, sequence, timestamps, activity, and room fields. Heartbeat deletes expired workspace rows, then performs a single conditional update only when principal, client, current session, freshness, and a higher sequence match. The higher sequence controls the entire activity/timestamp tuple. Wire:

- `POST /v1/realtime/presence/session`
- `POST /v1/realtime/presence/heartbeat`
- `DELETE /v1/realtime/presence/:clientInstanceId/:presenceSessionId`

Place them behind the same registered-principal-only guard as existing realtime routes. Generic bearer and internal credentials must not create human presence.

**Step 4: Run GREEN and typecheck**

```bash
pnpm --dir cloudflare/worker exec vitest run --config vitest.config.ts src/routes/__tests__/presence.test.ts
pnpm --dir cloudflare/worker check
```

Expected: both exit 0.

**Step 5: Commit**

```bash
git add cloudflare/worker/src/routes/presence.ts cloudflare/worker/src/routes/v1.ts cloudflare/worker/src/routes/__tests__/presence.test.ts
git commit -m "feat(worker): renew authenticated app presence leases"
```

## Task 3: Build the fresh identity-level presence read model

**Repository:** TeamForge

**Files:**

- Modify: `cloudflare/worker/src/routes/presence.ts`
- Modify: `cloudflare/worker/src/routes/__tests__/presence.test.ts`
- Modify: `cloudflare/worker/src/routes/v1.ts`

**Step 1: Add failing aggregation tests**

Fixture fresh, boundary-expired, cross-workspace, deactivated-identity, and deactivated-employee leases. Verify:

- Only `expires_at > now` rows survive.
- Active `plexus_identities.is_active = 1` is required.
- Employee identities also require their linked `employees.is_active = 1`; admins are exempt.
- One identity is returned regardless of device count.
- `activeClientCount` is exact.
- `lastSeenAt` and `expiresAt` are maxima among fresh clients.
- Focus is selected from the newest fresh focused observation.
- Room context is selected from the newest explicit `room_observed_at`.
- A roster-only member is absent.
- Reads do not execute lease writes.
- The result contains `presenceProof` and omits `clientInstanceId`.
- Every result contains server-owned `observedAt` and omits `presenceSessionId`.

```ts
expect(body.data.members[0]).toMatchObject({
  identityId: 'pid_test',
  activeClientCount: 2,
  presenceProof: 'authenticated_app_lease',
  activity: { state: 'focused' },
});
expect(body.data.members[0]).not.toHaveProperty('clientInstanceId');
```

**Step 2: Witness RED**

Run the presence test. Expected: FAIL because GET and aggregation do not exist.

**Step 3: Implement read-only aggregation**

Export a pure `aggregateFreshPresence(rows, now)` and:

```ts
export async function handleGetPresence(
  env: Env,
  principal?: PlexusPrincipal | null,
): Promise<Response>;
```

Query leases scoped to the principal workspace, joined to active canonical identities and active linked employees for employee roles. Pass server `now` as the strict SQL cutoff. Stamp the mapped aggregate with that server `observedAt`. Do not renew, delete, or return raw client/session identifiers during a read. Wire `GET /v1/realtime/presence` and set `Cache-Control: no-store`.

**Step 4: Run GREEN**

```bash
pnpm --dir cloudflare/worker exec vitest run --config vitest.config.ts src/routes/__tests__/presence.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add cloudflare/worker/src/routes/presence.ts cloudflare/worker/src/routes/v1.ts cloudflare/worker/src/routes/__tests__/presence.test.ts
git commit -m "feat(worker): aggregate fresh coworking identities"
```

## Task 4: Make realtime room occupancy lease-aware

**Repository:** TeamForge

**Files:**

- Modify: `cloudflare/worker/src/routes/realtime.ts`
- Modify: `cloudflare/worker/src/routes/__tests__/realtime.test.ts`

**Step 1: Add failing stale-room tests**

Create joined participant fixtures whose `(workspace, identity, client_instance, presence_session)` has either a current fresh, superseded, expired, or missing lease. Verify:

- Participant counts include only exact fresh lease matches.
- Room detail excludes stale joined participants.
- Live tracks from stale participants do not count as screen share or speaking evidence.
- Room GET does not renew either table.
- Heartbeat JSON cannot claim a room without a join.
- Join fails before participant creation without a current fresh presence session.
- Join writes server-derived room kind/id/call/participant context to the matching lease.
- Leave clears only the matching lease room context.
- Crash -> expiry -> new session with the same stable client does not restore the old participant or tracks.
- Explicitly rejoining the same room under the new session updates the participant/session binding and restores occupancy once.

**Step 2: Witness RED**

```bash
pnpm --dir cloudflare/worker exec vitest run --config vitest.config.ts src/routes/__tests__/realtime.test.ts
```

Expected: the new tests fail because current SQL checks only `state = 'joined'`.

**Step 3: Add strict freshness predicates**

Add `presence_session_id` to realtime participants in migration 0016. Before call/participant creation, join requires the caller's exact current fresh client/session lease. Join stamps the participant session and updates lease room context from canonical room/call/participant state; leave clears it. Update `getPresence`, `listParticipants`, and live-track reads to require the same workspace, identity, client, participant presence session, server-owned room context, and `expires_at > serverNow`. Preserve historical `left`/closed rows where contracts require them. Do not mutate stale rows during GET.

**Step 4: Run focused and full Worker gates**

```bash
pnpm --dir cloudflare/worker exec vitest run --config vitest.config.ts src/routes/__tests__/presence.test.ts src/routes/__tests__/realtime.test.ts
pnpm --dir cloudflare/worker test
pnpm --dir cloudflare/worker check
```

Expected: all exit 0.

**Step 5: Commit**

```bash
git add cloudflare/worker/src/routes/realtime.ts cloudflare/worker/src/routes/__tests__/realtime.test.ts
git commit -m "fix(worker): require fresh leases for room occupancy"
```

## Task 5: Add the Plexus presence contract and direct Worker client

**Repository:** Plexus at `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/plexus-ts/.worktrees/coworking-presence-leases`

**Files:**

- Create: `src/shared/coworking-presence.ts`
- Create: `test/coworking/presence-floor-client.test.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/main/teamforge.ts`
- Modify: `test/coworking/regression-pack-gate.test.ts`

**Step 1: Write failing contract/mapping tests**

Define complete Worker response fixtures. Verify safe timestamp parsing, server `observedAt`, identity keys, proof literal, active client count, no raw client/session IDs, and honest ring derivation. Verify the floor client makes one `/v1/realtime/presence` request and zero room-detail requests. Verify audio metadata cannot set speaking.

**Step 2: Witness RED**

```bash
npm exec vitest run test/coworking/presence-floor-client.test.ts
```

Expected: FAIL because the shared contract and direct client do not exist.

**Step 3: Implement shared DTOs and mapper**

Add:

```ts
export type CoworkingActivityState = 'available' | 'focused';
export type CoworkingRoomKind = 'none' | 'lounge' | 'project';
export type CoworkingPresenceProof = 'authenticated_app_lease';
export interface CoworkingPresenceMember { /* canonical evidence fields */ }
export function floorPresenceFromLease(member: CoworkingPresenceMember): FloorPresence;
```

Extend `FloorPresence` with `identityId`, `employeeId`, `observedAt`, `lastSeenAt`, `expiresAt`, `activeClientCount`, and `presenceProof`. Keep room participant context nullable and use `identityId` as the person key.

Replace the room fan-out in `getCoworkingFloor()` with one authenticated `wfetch('/v1/realtime/presence')`. Add authenticated `openCoworkingPresenceSession()`, `heartbeatCoworkingPresence()`, and session-specific `disconnectCoworkingPresence()` Worker client functions. Keep the Worker-issued session ID in main-process types only. Do not add a renderer heartbeat IPC.

**Step 4: Run GREEN**

```bash
npm exec vitest run test/coworking/presence-floor-client.test.ts test/coworking/coworking-model-contract.test.ts
npm run typecheck
```

Expected: all exit 0.

**Step 5: Commit**

```bash
git add src/shared/coworking-presence.ts src/shared/types.ts src/main/teamforge.ts test/coworking/presence-floor-client.test.ts test/coworking/regression-pack-gate.test.ts
git commit -m "feat(coworking): consume authenticated presence evidence"
```

## Task 6: Build the pure main-process heartbeat controller

**Repository:** Plexus

**Files:**

- Create: `src/main/coworking-presence-controller.ts`
- Create: `test/coworking/presence-controller.test.ts`

**Step 1: Write the failing controller tests**

Use Vitest fake timers and dependency injection. Cover session acquisition plus immediate heartbeat, 15-second cadence, strictly increasing sequence, one scheduler, no-auth skip, in-flight suppression, retry after failure, 409/expired-session reacquisition, stop behavior, paused/stopped timer availability, and unpaused timer focus evidence. The controller has no room-context setter.

```ts
controller.start();
await vi.runAllTicks();
expect(sendHeartbeat).toHaveBeenCalledTimes(1);
await vi.advanceTimersByTimeAsync(15_000);
expect(sendHeartbeat).toHaveBeenCalledTimes(2);
```

Do not assert merely that mocks exist; assert the payload and state transitions produced by the real controller.

**Step 2: Witness RED**

```bash
npm exec vitest run test/coworking/presence-controller.test.ts
```

Expected: FAIL because the controller module is absent.

**Step 3: Implement the minimum controller**

Export:

```ts
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 15_000;
export function createCoworkingPresenceController(deps: PresenceControllerDependencies): {
  start(): void;
  stop(): void;
  heartbeatNow(): Promise<void>;
  disconnectNow(): Promise<void>;
  currentSession(): { clientInstanceId: string; presenceSessionId: string } | null;
};
```

The controller must not import Electron, `safeStorage`, or React. It owns no auth token. It keeps the Worker-issued presence session in memory, increments sequence before each request, asks dependencies for auth/timer snapshots, suppresses overlap, and never claims local online state after a failure. On session-invalid/expired it discards the token and reacquires cleanly; new session acquisition is the room-context reset.

**Step 4: Run GREEN**

```bash
npm exec vitest run test/coworking/presence-controller.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/coworking-presence-controller.ts test/coworking/presence-controller.test.ts
git commit -m "feat(coworking): add main-process heartbeat controller"
```

## Task 7: Wire stable identity, auth, timer, room, resume, and quit lifecycle

**Repository:** Plexus

**Files:**

- Create: `src/main/coworking-presence.ts`
- Create: `test/coworking/presence-lifecycle-contract.test.ts`
- Modify: `src/main/main.ts`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `test/coworking/component-boundaries.test.ts`

**Step 1: Write failing lifecycle tests**

Verify:

- The stable ID is persisted at `tf.coworkingPresenceClientInstanceId` and reused.
- App readiness starts the loop independently of the Coworking tab.
- Successful login, Access login, and refresh request an immediate beat.
- Logout awaits a bounded disconnect attempt before clearing credentials.
- `before-quit` stops the loop and attempts disconnect.
- System resume requests an immediate beat.
- Closing the Coworking renderer does not stop app presence.
- Realtime join accepts no renderer client ID and uses the stable main-process ID internally.
- Realtime join supplies the current main-process presence session; renderer supplies neither identifier.
- Worker join sets canonical room context; successful leave clears it.
- Preload and renderer expose no heartbeat method.
- An expired Access credential cannot renew and the prior lease disappears within the server TTL.
- A dropped quit/logout disconnect still results in expiry within 60 seconds.

**Step 2: Witness RED**

```bash
npm exec vitest run test/coworking/presence-lifecycle-contract.test.ts test/coworking/component-boundaries.test.ts
```

Expected: FAIL on missing lifecycle wiring and renderer-owned ID.

**Step 3: Add production wiring**

`src/main/coworking-presence.ts` composes the pure controller with `getSession`, `getRunningEntry`, Worker client functions, and a stable UUID from settings. Main starts it after database readiness, opens/pokes it on auth success/resume, and uses session-specific disconnect-before-credential-clear on logout. Room join IPC obtains the controller's current stable client and Worker-issued session and adds both to the internal Worker request; `RealtimeJoinInput` exposed to the renderer contains neither. The renderer no longer creates a component-scoped presence ID.

Keep the presence interval alive on macOS when all windows close but the app remains running.

**Step 4: Run GREEN plus main build**

```bash
npm exec vitest run test/coworking/presence-controller.test.ts test/coworking/presence-lifecycle-contract.test.ts test/coworking/component-boundaries.test.ts
npm run build:main
```

Expected: all exit 0.

**Step 5: Commit**

```bash
git add src/main/coworking-presence.ts src/main/main.ts src/renderer/components/CoWorkingPanel.tsx test/coworking/presence-lifecycle-contract.test.ts test/coworking/component-boundaries.test.ts
git commit -m "feat(coworking): run presence across the app lifecycle"
```

## Task 8: Make floor labels, keys, counts, and failures truthful

**Repository:** Plexus

**Files:**

- Create: `test/coworking/presence-ui-semantics.test.ts`
- Modify: `src/renderer/lib/coworkingModel.ts`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/components/coworking/CoWorkingStage.tsx`
- Modify: `test/coworking/regression-pack-gate.test.ts`

**Step 1: Write failing UI/model tests**

Verify:

- `identityId` is the floor React/model key.
- `timing` is labelled `Focused`, never `In voice`.
- A live audio track alone produces `MIC ON` or no speaking label, never `SPEAKING`.
- Online count equals unique fresh identity rows, not devices.
- `idle` rows are excluded from `Present now`.
- A failed refresh preserves last-known floor and displays unavailable telemetry instead of zero.
- Room selection still does not join.
- Room leave clears only room context, not app presence.

**Step 2: Witness RED**

```bash
npm exec vitest run test/coworking/presence-ui-semantics.test.ts
```

Expected: FAIL on current `In voice`, participant keys, speaking derivation, and error clearing.

**Step 3: Implement the minimal semantic fixes**

Use the server evidence fields without recomputing liveness in React. Preserve last-known data when refresh fails and render an explicit unavailable state. Replace floor uses of `participantId` as a person key/avatar seed with `identityId`. Keep actual room participant IDs only for track/leave actions. Remove idle members from the live rail.

**Step 4: Run GREEN and the Coworking suite**

```bash
npm exec vitest run test/coworking/presence-ui-semantics.test.ts
npm run test:coworking
npm run typecheck
```

Expected: all exit 0.

**Step 5: Commit**

```bash
git add src/renderer/lib/coworkingModel.ts src/renderer/components/CoWorkingPanel.tsx src/renderer/components/coworking/CoWorkingStage.tsx test/coworking/presence-ui-semantics.test.ts test/coworking/regression-pack-gate.test.ts
git commit -m "fix(coworking): render only proven live presence"
```

## Task 9: Integrate, review, and prove both repositories

**Repositories:** TeamForge and Plexus

**Files:**

- Modify: this plan's ISA verification at `/Users/sheshnarayaniyer/.claude/PAI/MEMORY/WORK/20260716-145500_coworking-presence-leases/ISA.md`
- Create as needed: `docs/evidence/2026-07-16-coworking-presence-leases.md`

**Step 1: Run spec compliance review**

Review actual diffs against all 57 ISCs. Reject extra roster UI, local-only online inference, client-controlled timestamps, raw client/session IDs in renderer data, client-owned room context, read-side renewal, and any heartbeat owned by the renderer.

**Step 2: Run code-quality review**

Check clock injection, SQL workspace scope, complete response fixtures, bounded payloads, no sensitive logs, no overlapping timers, cleanup ownership, and migrations remaining additive.

**Step 3: Run complete TeamForge verification**

```bash
pnpm --dir cloudflare/worker exec vitest run --config vitest.config.ts src/routes/__tests__/presence-migration.test.ts src/routes/__tests__/presence.test.ts src/routes/__tests__/realtime.test.ts
pnpm --dir cloudflare/worker check
pnpm --dir cloudflare/worker test
pnpm --dir cloudflare/worker d1:migrate:local
git diff --check
```

Expected: every command exits 0; migration 0016 applies locally.

**Step 4: Run complete Plexus verification**

```bash
npm run test:coworking
npm run test:all
npm run typecheck
npm run lint
npm run build:main
npm run build:preload
npm run build:renderer
git diff --check
```

Expected: every command exits 0.

**Step 5: Record evidence and commit**

Update each ISC checkbox only from fresh command evidence. Record exact command summaries and commit SHAs. Then:

```bash
git add docs/evidence/2026-07-16-coworking-presence-leases.md
git commit -m "docs: record coworking presence lease verification"
```

**Step 6: Prepare delivery without deploying implicitly**

Use `superpowers:finishing-a-development-branch`. Push the two `codex/coworking-presence-leases` branches and open reviewed PRs if repository credentials permit. Merge/deploy Worker before distributing the Plexus client because the client depends on the new presence routes. Production D1 migration and Worker deploy remain explicit release actions after review approval.

## Plan completion gate

The work is complete only when:

1. All 57 ISA criteria have fresh evidence.
2. Both full repository suites pass from clean worktrees.
3. A crashed/offline fixture disappears at the strict 60-second boundary.
4. A roster-only member never enters `Present now`.
5. A multi-device person appears once with the correct client count.
6. Focus derives only from that person's unpaused timer.
7. Room selection, join, leave, and app liveness remain independent.
8. Review finds no raw credential or client identifier exposure.
