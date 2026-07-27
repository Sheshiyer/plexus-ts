# Lifecycle Ownership and Receipts Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the first shared Thoughtseed lifecycle gaps by proving a producer, trigger, consumer, durable receipt, and freshness state for Plexus standups, Cambium context projections, and TeamForge sync work.

**Architecture:** Plexus v0.7.4 remains the member-side standup producer and confirmation boundary. Cambium gains a dedicated plaintext projection bucket plus a versioned, digest-bound write/read contract; encrypted `thoughtseed-vault` remains backup-only. TeamForge gains a real Queue consumer, durable runtime receipts, truthful health, and a dry-run-first vault projection publisher.

**Tech Stack:** TypeScript, Node test runner, Vitest, Electron, Cloudflare Workers, Queues, D1, R2, Wrangler, pnpm, npm.

---

## Execution Rules

- Use @test-driven-development for every behavior change.
- Use @dispatching-parallel-agents with one repository per write agent.
- Never edit the dirty root checkouts.
- Never deploy, publish OTA, create an R2 bucket, send a Queue message, or invoke an external adapter during this implementation pass.
- Commit after each repository domain is green.

## Worktree Ownership

| Domain | Worktree | Branch | Owner |
|---|---|---|---|
| Plexus | `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/.worktrees/plexus-lifecycle-receipts` | `codex/lifecycle-ownership-receipts-plan` | Plexus verification agent |
| Cambium | `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/.worktrees/cambium-context-projections` | `codex/lifecycle-context-projections` | Cambium implementation agent |
| TeamForge | `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/.worktrees/teamforge-queue-receipts` | `codex/lifecycle-queue-receipts` | TeamForge implementation agent |

These domains have no overlapping files. Cross-repository verification is serialized after all three agents return.

### Task 1: Verify the Merged Plexus Standup Producer

**Files:**
- Inspect: `src/main/assistant-runtime.ts:260-326`
- Inspect: `src/main/assistant-daily.ts:88-122`
- Inspect: `src/renderer/components/AssistantPanel.tsx:490-550`
- Test: `test/assistant/offline-suggestions.test.ts`
- Test: `test/assistant/daily-event-queue.test.ts`
- Test: `test/assistant/assistant-suggestion-visibility.test.ts`

This behavior is already merged in Plexus `v0.7.4`. Do not rewrite it. Verify that the merged implementation still satisfies the lifecycle contract.

**Step 1: Verify the transition state machine**

Run:

```bash
npx vitest run \
  test/assistant/offline-suggestions.test.ts \
  test/assistant/assistant-suggestion-visibility.test.ts \
  --no-file-parallelism
```

Expected: PASS; persisted proof offers confirm-required `daily.sendEvent`, missing proof offers `app.generateStandup`, sent state suppresses both, and a persisted daily transition remains visible.

**Step 2: Verify per-event singleflight and retry**

Run:

```bash
npx vitest run \
  test/assistant/daily-event-queue.test.ts \
  test/assistant/daily-event-retry.test.ts \
  --no-file-parallelism
```

Expected: PASS; identical event IDs share one delivery, different IDs overlap, and failed delivery can retry.

**Step 3: Run repository gates**

Run:

```bash
npm run test:assistant
npm run typecheck
npm run build:main
npm run build:preload
npm run build:renderer
```

Expected: every command exits 0.

**Step 4: Record release boundary**

Confirm:

```bash
git tag --points-at origin/main
git log -1 --oneline origin/main
```

Expected: `v0.7.4` points at the merged producer release. Do not tag or publish.

### Task 2: Add the Cambium Context Projection Contract

**Files:**
- Create: `workers/quests/src/context-projections.ts`
- Create: `workers/quests/src/context-projections.test.ts`
- Modify: `workers/quests/src/context-bindings.ts:19-67`
- Test: `workers/quests/src/context-bindings.test.ts`

**Step 1: Write failing receipt validation tests**

Add tests equivalent to:

```typescript
test('rejects a malformed content digest', () => {
  const result = validateContextProjectionEnvelope({
    schema: 'thoughtseed.context-projection.v1',
    key: 'context/v1/daily-standup-digest/standups/latest.json',
    tenantId: 'cambium',
    routine: 'daily-standup-digest',
    generation: 1,
    producedAt: '2026-07-28T00:00:00.000Z',
    expiresAt: '2026-07-28T06:00:00.000Z',
    sourceRevision: 'git:abc123',
    contentDigest: 'sha256:not-a-digest',
    markdown: '# Standup',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'content_digest_invalid');
});

test('rejects content whose digest does not match', async () => {
  const result = await validateContextProjectionEnvelope(envelope({
    contentDigest: `sha256:${'0'.repeat(64)}`,
    markdown: '# Different',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.code, 'content_digest_mismatch');
});
```

**Step 2: Run tests to verify RED**

Run:

```bash
node --test workers/quests/src/context-projections.test.ts
```

Expected: FAIL because `context-projections.ts` and its validator do not exist.

**Step 3: Implement the minimal projection types and validator**

Implement this public shape:

```typescript
export const CONTEXT_PROJECTION_SCHEMA =
  'thoughtseed.context-projection.v1' as const;

export interface ContextProjectionEnvelope {
  schema: typeof CONTEXT_PROJECTION_SCHEMA;
  key: string;
  tenantId: string;
  routine: string;
  generation: number;
  producedAt: string;
  expiresAt: string;
  sourceRevision: string;
  contentDigest: `sha256:${string}`;
  markdown: string;
}

export type ContextProjectionValidation =
  | { ok: true; value: ContextProjectionEnvelope }
  | { ok: false; code: string };

export async function validateContextProjectionEnvelope(
  input: unknown,
): Promise<ContextProjectionValidation>;
```

Validation must bound every string, require an exact safe key, require a positive integer generation, require valid timestamps, enforce `expiresAt > producedAt`, and compare SHA-256 over UTF-8 markdown bytes.

**Step 4: Run tests to verify GREEN**

Run:

```bash
node --test workers/quests/src/context-projections.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add workers/quests/src/context-projections.ts \
  workers/quests/src/context-projections.test.ts
git commit -m "feat(quests): define context projection receipts"
```

### Task 3: Wire Dedicated Cambium Projection Reads and Writes

**Files:**
- Modify: `workers/quests/src/context-projections.ts`
- Modify: `workers/quests/src/context-projections.test.ts`
- Modify: `workers/quests/src/context-bindings.ts:19-340`
- Modify: `workers/quests/src/context-bindings.test.ts`
- Modify: `workers/quests/src/context-routes.ts:66-310`
- Modify: `workers/quests/src/context-routes.test.ts`
- Modify: `workers/quests/src/index.ts:55-82`
- Modify: `workers/quests/src/index.ts:1308-1322`
- Modify: `workers/quests/wrangler.jsonc:18-25`

**Step 1: Write failing store and route tests**

Cover these behaviors independently:

```typescript
test('writer rejects a non-increasing generation', async () => {
  const bucket = fakeProjectionBucket(envelope({ generation: 4 }));
  const result = await createContextProjectionStore(bucket).put(
    envelope({ generation: 4 }),
  );
  assert.deepEqual(result, { ok: false, code: 'generation_not_monotonic' });
});

test('routine context reports stale from the envelope receipt', async () => {
  const bucket = fakeProjectionBucket(envelope({
    producedAt: '2026-07-27T00:00:00.000Z',
    expiresAt: '2026-07-27T06:00:00.000Z',
  }));
  const snapshot = await createRoutineContext({
    bucket,
    allowlist: exactProjectionAllowlist,
    now: () => new Date('2026-07-28T00:00:00.000Z'),
  }).getSnapshot({ routine: 'daily-standup-digest' });
  assert.equal(snapshot.sections[0].signalState, 'stale');
});

test('projection write requires the dedicated bearer', async () => {
  const response = await handleContextRoute(writeRequest(), {
    projectionWriteToken: 'write-only-token',
    projectionStore: fakeStore(),
  });
  assert.equal(response.status, 401);
});
```

**Step 2: Run tests to verify RED**

Run:

```bash
node --test \
  workers/quests/src/context-projections.test.ts \
  workers/quests/src/context-bindings.test.ts \
  workers/quests/src/context-routes.test.ts
```

Expected: FAIL because the store, dedicated binding, stale-envelope handling, and write route do not exist.

**Step 3: Implement the projection store**

Extend the R2-compatible interface minimally:

```typescript
export interface ContextProjectionBucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}
```

`put()` must:

1. validate the new envelope and content digest;
2. read and validate any existing envelope at the same exact key;
3. reject `generation <= existing.generation`;
4. write canonical JSON with `application/json`;
5. return the immutable receipt fields without returning markdown.

**Step 4: Add the authenticated write route**

Add:

```text
POST /v1/context/projections
Authorization: Bearer <CONTEXT_PROJECTION_WRITE_TOKEN>
Content-Type: application/json
```

Success response:

```json
{
  "ok": true,
  "schema": "thoughtseed.context-projection-receipt.v1",
  "key": "context/v1/daily-standup-digest/standups/latest.json",
  "generation": 5,
  "contentDigest": "sha256:...",
  "producedAt": "...",
  "expiresAt": "..."
}
```

Never return markdown, secret values, or bucket metadata.

**Step 5: Switch routine reads to the dedicated binding**

In `workers/quests/src/index.ts`, add:

```typescript
CONTEXT_PROJECTIONS?: ContextProjectionBucketLike;
CONTEXT_PROJECTION_WRITE_TOKEN?: string;
```

Build routine context only from `env.CONTEXT_PROJECTIONS`. Keep
`env.THOUGHTSEED_VAULT` available solely for its existing backup/business
artifact responsibilities. Missing projection binding must produce
`blocked-no-signal`.

In `wrangler.jsonc`, add the separate binding:

```jsonc
{ "binding": "CONTEXT_PROJECTIONS", "bucket_name": "thoughtseed-context-projections" }
```

Do not remove or rename `THOUGHTSEED_VAULT`. Do not deploy or create the bucket.

**Step 6: Run tests to verify GREEN**

Run:

```bash
node --test \
  workers/quests/src/context-projections.test.ts \
  workers/quests/src/context-bindings.test.ts \
  workers/quests/src/context-routes.test.ts
npm test
```

Expected: all tests pass.

**Step 7: Commit**

```bash
git add workers/quests/src/context-projections.ts \
  workers/quests/src/context-projections.test.ts \
  workers/quests/src/context-bindings.ts \
  workers/quests/src/context-bindings.test.ts \
  workers/quests/src/context-routes.ts \
  workers/quests/src/context-routes.test.ts \
  workers/quests/src/index.ts \
  workers/quests/wrangler.jsonc
git commit -m "feat(quests): isolate receipted context projections"
```

### Task 4: Add the TeamForge Queue Consumer

**Files:**
- Create: `cloudflare/worker/src/lib/sync-queue.ts`
- Create: `cloudflare/worker/src/lib/sync-queue.test.ts`
- Modify: `cloudflare/worker/src/lib/env.ts:1-95`
- Modify: `cloudflare/worker/src/routes/sync.ts:1-86`
- Modify: `cloudflare/worker/src/lib/sync-control-plane.ts:541-730`
- Modify: `cloudflare/worker/src/index.ts:1-45`
- Modify: `cloudflare/worker/wrangler.jsonc:48-58`

**Step 1: Write failing schema and idempotency tests**

Add:

```typescript
it('rejects unknown source before adapter execution', async () => {
  const adapter = vi.fn();
  const result = await consumeSyncMessage(
    message({ source: 'unknown' }),
    deps({ runProjectSync: adapter }),
  );
  expect(result).toMatchObject({ disposition: 'ack', code: 'source_unsupported' });
  expect(adapter).not.toHaveBeenCalled();
});

it('acks an already completed job without a second run', async () => {
  const adapter = vi.fn();
  const result = await consumeSyncMessage(
    message({ jobId: 'job_completed' }),
    deps({ jobStatus: 'completed', runProjectSync: adapter }),
  );
  expect(result).toMatchObject({ disposition: 'ack', replayed: true });
  expect(adapter).not.toHaveBeenCalled();
});
```

**Step 2: Run tests to verify RED**

Run:

```bash
pnpm --dir cloudflare/worker vitest run src/lib/sync-queue.test.ts
```

Expected: FAIL because the consumer does not exist.

**Step 3: Implement the bounded message contract**

```typescript
export const SYNC_QUEUE_SCHEMA = 'teamforge.sync-job.v1' as const;

export interface SyncQueueMessage {
  schema: typeof SYNC_QUEUE_SCHEMA;
  jobId: string;
  workspaceId: string;
  source: 'clockify' | 'github' | 'huly' | 'slack';
  jobType: 'project_sync';
  projectId: string;
  requestedAt: string;
}
```

Validate length, timestamps, source, job type, and IDs before any D1 or adapter
call. Change `handlePostSyncJob()` to construct exactly this schema and reject a
missing `projectId` for `project_sync`.

**Step 4: Implement idempotent consumption**

The consumer must:

1. load the D1 job;
2. acknowledge terminal jobs without replay;
3. atomically transition `queued → running`;
4. call the existing project sync executor;
5. persist a bounded terminal receipt;
6. acknowledge permanent validation/unsupported errors;
7. retry transient adapter failures only after persisting failure evidence.

Export a Cloudflare module handler:

```typescript
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleFetch(request, env);
  },
  async queue(batch: MessageBatch<SyncQueueMessage>, env: Env): Promise<void> {
    await consumeSyncBatch(batch, env);
  },
};
```

**Step 5: Configure the Queue consumer**

Add the consumer stanza to `wrangler.jsonc`:

```jsonc
"consumers": [
  {
    "queue": "teamforge-sync",
    "max_batch_size": 5,
    "max_batch_timeout": 5,
    "max_retries": 3,
    "dead_letter_queue": "teamforge-sync-dlq"
  }
]
```

This is source configuration only. Do not deploy or create the DLQ.

**Step 6: Run tests to verify GREEN**

Run:

```bash
pnpm --dir cloudflare/worker vitest run src/lib/sync-queue.test.ts
```

Expected: PASS.

### Task 5: Persist Queue Receipts and Make Health Truthful

**Files:**
- Create: `cloudflare/worker/migrations/0011_sync_runtime_receipts.sql`
- Modify: `cloudflare/worker/src/lib/sync-queue.ts`
- Modify: `cloudflare/worker/src/lib/sync-queue.test.ts`
- Modify: `cloudflare/worker/src/lib/control-plane-status.ts`
- Create: `cloudflare/worker/src/lib/control-plane-status.test.ts`
- Modify: `cloudflare/worker/src/routes/v1.ts:800-835`

**Step 1: Write failing health tests**

Add:

```typescript
it('reports a bound queue without a fresh consumer receipt as degraded', async () => {
  const status = await buildControlPlaneStatus(env({
    queueBound: true,
    lastConsumerReceiptAt: null,
  }));
  expect(status.syncQueue).toMatchObject({
    state: 'degraded',
    reason: 'consumer_receipt_missing',
  });
});

it('reports an expired receipt as stale', async () => {
  const status = await buildControlPlaneStatus(env({
    queueBound: true,
    lastConsumerReceiptAt: '2026-07-27T00:00:00.000Z',
    now: '2026-07-28T00:00:00.000Z',
  }));
  expect(status.syncQueue.state).toBe('stale');
});
```

**Step 2: Run tests to verify RED**

Run:

```bash
pnpm --dir cloudflare/worker vitest run \
  src/lib/sync-queue.test.ts \
  src/lib/control-plane-status.test.ts
```

Expected: FAIL because runtime receipt storage and evidence-derived health do not exist.

**Step 3: Add the receipt migration**

Create one row per runtime:

```sql
CREATE TABLE IF NOT EXISTS sync_runtime_receipts (
  runtime_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  last_message_id TEXT NOT NULL,
  last_job_id TEXT NOT NULL,
  last_status TEXT NOT NULL,
  last_consumed_at TEXT NOT NULL,
  last_terminal_at TEXT,
  updated_at TEXT NOT NULL
);
```

Do not store Queue payloads, tokens, or external response bodies.

**Step 4: Derive health from evidence**

Status rules:

- binding missing → `unavailable`;
- binding present, no receipt → `degraded`;
- receipt older than the reviewed freshness window → `stale`;
- fresh completed receipt → `healthy`;
- fresh failed receipt → `degraded`.

Route presence must not override these states.

**Step 5: Run focused and full Worker gates**

Run:

```bash
pnpm --dir cloudflare/worker vitest run \
  src/lib/sync-queue.test.ts \
  src/lib/control-plane-status.test.ts
pnpm --dir cloudflare/worker test
pnpm --dir cloudflare/worker check
```

Expected: all commands exit 0.

**Step 6: Commit**

```bash
git add cloudflare/worker
git commit -m "feat(worker): consume sync queue with truthful receipts"
```

### Task 6: Add a Dry-Run-First Projection Publisher

**Files:**
- Create: `scripts/lib/context-projection.mjs`
- Create: `scripts/context-projection.test.mjs`
- Modify: `scripts/teamforge-vault-parity.mjs`
- Modify: `cloudflare/worker/README.md`

**Step 1: Write failing publisher tests**

Cover:

```javascript
test('builds a bounded digest-bound projection envelope', async () => {
  const result = await buildContextProjection({
    key: 'context/v1/daily-standup-digest/standups/latest.json',
    tenantId: 'cambium',
    routine: 'daily-standup-digest',
    generation: 7,
    markdown: '# Daily Standup\\nBounded evidence',
    sourceRevision: 'git:abc123',
    producedAt: '2026-07-28T00:00:00.000Z',
    expiresAt: '2026-07-28T06:00:00.000Z',
  });
  assert.match(result.contentDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.markdown.includes('Bounded evidence'), true);
});

test('refuses network publication without --apply', async () => {
  const post = mock.fn();
  await publishContextProjections({ apply: false, post });
  assert.equal(post.mock.callCount(), 0);
});
```

**Step 2: Run tests to verify RED**

Run:

```bash
node --test scripts/context-projection.test.mjs
```

Expected: FAIL because the projection builder does not exist.

**Step 3: Implement the bounded builder**

Requirements:

- stable exact keys only;
- UTF-8 markdown bounded to 32 KiB;
- SHA-256 digest over the exact markdown bytes;
- caller-supplied positive generation;
- no token, vault root, or local absolute path in output;
- default dry-run prints only key, digest, generation, and timestamps.

**Step 4: Add explicit apply-mode publication**

Only `--apply` may POST to Cambium. Require:

```text
CAMBIUM_CONTEXT_PROJECTION_URL
CAMBIUM_CONTEXT_PROJECTION_WRITE_TOKEN
```

Never print the token. Fail closed when either is missing.

**Step 5: Run tests to verify GREEN**

Run:

```bash
node --test scripts/context-projection.test.mjs
node scripts/teamforge-vault-parity.mjs --help
```

Expected: tests pass; help documents dry-run default and explicit `--apply`.

**Step 6: Commit**

```bash
git add scripts/lib/context-projection.mjs \
  scripts/context-projection.test.mjs \
  scripts/teamforge-vault-parity.mjs \
  cloudflare/worker/README.md
git commit -m "feat(ops): publish bounded context projections safely"
```

### Task 7: Cross-Repository Verification

**Files:**
- Modify: `docs/plans/2026-07-28-lifecycle-ownership-and-receipts.md`
- Create: `docs/evidence/2026-07-28-lifecycle-ownership-and-receipts.md`

**Step 1: Verify clean branches**

Run in every worktree:

```bash
git status --short
git log -1 --oneline
```

Expected: no uncommitted implementation files; each branch has a named commit.

**Step 2: Run all domain gates**

Run:

```bash
# Plexus
npm run test:assistant
npm run typecheck
npm run build:main
npm run build:preload
npm run build:renderer

# Cambium
npm test

# TeamForge Worker
pnpm --dir cloudflare/worker test
pnpm --dir cloudflare/worker check
node --test scripts/context-projection.test.mjs
```

Expected: every command exits 0.

**Step 3: Verify storage separation**

Run:

```bash
rg -n 'CONTEXT_PROJECTIONS|thoughtseed-context-projections' \
  workers/quests/src workers/quests/wrangler.jsonc
rg -n 'createRoutineContext\\(|THOUGHTSEED_VAULT' \
  workers/quests/src/index.ts
```

Expected: routine context uses only `CONTEXT_PROJECTIONS`; encrypted backup binding remains separate.

**Step 4: Verify no production mutation**

Review shell history for this task and confirm no `wrangler deploy`, remote D1 migration, Queue send, R2 write, OTA publish, tag creation, or AWS command occurred.

**Step 5: Write the evidence handoff**

Record:

- three branch names and commit SHAs;
- focused/full test counts;
- required Cloudflare resources not yet created;
- required secrets by name only;
- migrations/configuration awaiting deployment;
- live standup smoke sequence;
- context projection dry-run and later apply sequence;
- Queue consumer deployment and first receipt probe;
- rollback boundaries.

**Step 6: Commit the plan and evidence**

```bash
git add docs/plans/2026-07-28-lifecycle-ownership-and-receipts.md \
  docs/evidence/2026-07-28-lifecycle-ownership-and-receipts.md
git commit -m "docs: plan lifecycle ownership and receipt release"
```

## Production Release Gates

Implementation completion does not authorize these actions. Run them only in a separately reviewed release pass:

1. Create `thoughtseed-context-projections`.
2. Configure `CONTEXT_PROJECTION_WRITE_TOKEN`.
3. Apply TeamForge D1 migration `0011_sync_runtime_receipts.sql`.
4. Create/configure `teamforge-sync-dlq`.
5. Deploy Cambium and TeamForge reviewed commits.
6. Run projection publisher first in dry-run, then explicit apply.
7. Confirm a fresh projection receipt through Cambium.
8. Trigger one bounded TeamForge project-sync message.
9. Confirm one Queue consumer receipt and truthful health.
10. Trigger one real Plexus daily event and verify Cambium → Hermes → digest delivery.
