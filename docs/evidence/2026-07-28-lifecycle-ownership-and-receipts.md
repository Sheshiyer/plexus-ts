# Lifecycle Ownership and Receipts Evidence

Verification date: 2026-07-28 (Asia/Kolkata)

## Outcome

The lifecycle slice is merged and its Worker infrastructure is live. It has
named lifecycle owners, durable evidence boundaries, immutable deployment
versions, and rollback versions:

| Flow | Producer / trigger | Consumer | Durable evidence | Truth state |
|---|---|---|---|---|
| Plexus daily standup | persisted standup proof plus founder confirmation | existing member-scoped daily bridge | persisted delivery state and downstream receipt boundary | visible pending, queued, failed, or sent |
| Cambium context projection | explicit authenticated projection POST | exact-key routine context reader | versioned digest/generation projection plus bounded write receipt | current, stale, missing, or blocked-no-signal |
| TeamForge project sync | versioned sync-job POST/Queue message | Cloudflare Queue module handler | terminal job/run plus runtime-consumer receipt | unavailable, degraded, stale, or healthy |

Cambium was released before TeamForge. The encrypted `thoughtseed-vault` plane
was not repurposed or written. No desktop/OTA tag was created because this was
a Worker-only release; Plexus remains published at `v0.7.4`.

## GitHub review and merge

```text
Plexus
branch: codex/lifecycle-ownership-receipts-plan
head:   1966b57b9ebb264d22ecfadf147fe00c0cab5b04
PR:     https://github.com/Sheshiyer/plexus-ts/pull/124
merge:  e229374c11f45e03968008ef83f2ba02bc9255b9

Cambium
branch: codex/lifecycle-context-projections
head:   d35b5e9b2bdd1e00cce84b64ccc7cc1b7c5a875d
PR:     https://github.com/Sheshiyer/cambium/pull/274
merge:  2c060d6801b7288c70065527a74500fd5576b2dc

TeamForge
branch: codex/lifecycle-queue-receipts
head:   b5cb7031e861cda0a2a50738153ee22af312a45c
PR:     https://github.com/Sheshiyer/team-forge-ts/pull/101
merge:  439cb074d2f6ed432d301c1e83cabf41717d6387
```

All PR checks passed, all three reviewed heads merged without conflict, and the
post-merge `main` workflows passed. Cambium's clean-checkout CI exposed one
release-only reference-packet fallback failure; commit `d35b5e9` repaired that
boundary and the complete deterministic release verifier then passed.

## Test-driven evidence

### Plexus

- Focused transition/visibility: 10/10 passed.
- Focused singleflight/retry: 11/11 passed.
- `npm run test:assistant`: 112 files, 521/521 tests passed.
- `npm run typecheck`: passed.
- `npm run build:main`: passed.
- `npm run build:preload`: passed.
- `npm run build:renderer`: 497 modules built; passed.
- `origin/main` remains immutable merge
  `f133581aa1b62cc6fb35dde6c6e95876568b4077`, tagged `v0.7.4`.

The Vitest commands emit a pre-existing non-fatal warning that
`astro/tsconfigs/strict` is not resolvable from the parent tsconfig.

### Cambium

- RED: the focused command exited 1 with two missing projection-module suites;
  19 existing tests remained green.
- Focused GREEN: 50/50 passed.
- Full `npm test`: 1128/1128 passed.
- Node syntax checks for the touched TypeScript files passed.
- A compiler-only gate is unavailable in this repository: its root tsconfig
  has no files/references and it has no TypeScript compiler dependency.

Verified behavior includes exact envelope fields, exact-byte SHA-256, 32 KiB
UTF-8 bounds, strict generations with R2 preconditions, dedicated bearer
writes, bounded receipts, exact-key reads, stale expiry, missing-binding
blocked state, and separation from `THOUGHTSEED_VAULT`.

### TeamForge

- Initial RED: Queue/health/projection modules were absent.
- Contract RED: copied local aliases failed exact Queue and projection field
  assertions before being replaced with the frozen wire names.
- Audit RED: 9 of 23 focused Worker cases and 2 of 8 projection cases failed
  before the eight adversarial lifecycle fixes.
- Focused Queue/health GREEN: 23/23 passed.
- Full Worker suite: 16 files, 198/198 tests passed.
- `pnpm --dir cloudflare/worker check`: passed.
- Projection publisher: 8/8 tests passed.
- Vault-parity `--help`: passed without operational work.
- Fresh local SQLite replay: all 17 migrations applied; `project_id` exists
  once and every runtime-receipt identity column is `NOT NULL`.

Verified behavior includes strict pre-D1 validation, atomic claim, bounded
pre-adapter recovery, no adapter rerun after post-adapter persistence failure,
terminal legacy `team_snapshot` evidence, fail-closed producer 503s, runtime
receipt validation, HTTPS-only apply, and safe projection provenance.

## Cross-repository contract proof

The TeamForge builder produced exactly:

```text
schema,key,tenantId,routine,generation,producedAt,expiresAt,sourceRevision,contentDigest,markdown
```

The actual Cambium validator accepted that object. The frozen Markdown is 32
UTF-8 bytes and yielded:

```text
sha256:7d696bb44566df0ffec55bce3a17117aa397f923f92e26b91c0695f9fc9fd8e4
```

The final read-only adversarial audit verdict for TeamForge `b5cb703` was
APPROVE with no remaining actionable blocker.

The golden digest is not a captured constant alone: Cambium and TeamForge each
recompute it from the exact Markdown bytes in tests, and the cross-repository
probe recomputed it again before calling the actual Cambium validator.
TeamForge duplicate-completed delivery tests and Cambium non-increasing/
concurrent generation tests cover replay and out-of-order receipt boundaries.

There is deliberately no TeamForge → Cambium → Plexus rendering chain in this
release. TeamForge publishes an operational context projection to Cambium;
Plexus independently publishes its member daily event to the existing
Cambium/Hermes path. Runtime ordering, acknowledgments, and downstream receipts
for both lifecycles remain named live probes in the production release pass.

## Original checkout isolation

The release did not mutate the original dirty checkouts. Their initial and
final audited HEADs were:

| Repository | Initial HEAD | Final audited HEAD | Release mutation |
|---|---|---|---|
| Plexus | `10172cbf677fe4ec37a42b5d6b81dbc73c162eac` | `10172cbf677fe4ec37a42b5d6b81dbc73c162eac` | none |
| Cambium | `0e906ab32d9e113034e64f6803d26748e84d75ae` | `8313a2c0c7bbb77c1303844d61bdc0c83a5e19b4` | none |
| TeamForge | `04757d7a136e313e0bc2bc6c408d6faa6f0926ae` | `04757d7a136e313e0bc2bc6c408d6faa6f0926ae` | none |

Cambium advanced concurrently at 03:36:32 Asia/Kolkata through a separate
`pull --rebase origin main`, after its independent `fix(iverif)` commit. Its
reflog records that operation outside the pinned lifecycle release worktree;
the release source remained detached at merge `2c060d6`.

Their status fingerprints changed during the parallel run because an unrelated
project scanner generated `_PROJECT-STATUS.md` in all three roots at exactly
02:01:05, while other pre-existing/concurrent root edits also remained present.
The lifecycle implementation and release agents wrote and committed only
inside their assigned worktrees; no release operation cleaned, stashed, reset,
or committed an original root checkout.

## Production release

### Cambium consumer

- Account: `9d9d23b27f32e70ae3afb6a1aa2c0f10`.
- R2 bucket: `thoughtseed-context-projections`.
- Active version: `6e8e4deb-35d6-465f-8304-6dff21a6c364`.
- Deployment: `2b67547d-34b4-4888-b96a-b0525d34f350`.
- Rollback version: `80533807-4b84-4307-b0b5-b6999d585f88`.
- Worker version tag: `git-2c060d6801b7288c70065527a74500fd5576b2dc`.
- Live `/healthz` returned 200.
- A valid `thoughtseed.context-projection.v1` write returned 201.
- An unsupported schema returned 400; an unauthenticated write returned 401.
- The write token was configured additively without printing its value.

### TeamForge producer

- Active version: `a2000361-8063-4a5d-9992-a6ca8136ff0c`.
- Deployment: `c4927726-176c-41d6-af01-170eeebd7846`.
- Rollback version: `5aea229e-3fcf-4590-a396-32b8d82bcd81`.
- Worker version tag: `git-439cb074d2f6ed432d301c1e83cabf41717d6387`.
- D1 database: `teamforge-primary`
  (`d773aaa8-aa51-4ef8-ae08-1d3d238d2ae3`).
- Pre-migration backup SHA-256:
  `03132b62f578f87a0d487e1c9c01b4824472b3eb52569b654ab85ba3d97461fb`.
- Migration `0017_sync_runtime_receipts.sql` replayed in disposable D1 before
  production apply; production now reports no pending migrations.
- Primary Queue: `48057b6466ca4fda9237c339617868cb`.
- Dead-letter Queue: `450540a10bea47159076c7f103315361`.
- Consumer: `2340d04673eb437b8bacf2688f8513d7`, batch 5, retry 3.

The bounded job `release_probe_20260728_439cb074` reached terminal `failed`
through the deliberately unsupported `slack` adapter. Four expected attempts
were persisted, followed by a `teamforge.sync-runtime-receipt.v1` receipt.
Replaying the exact frozen Queue message left the job terminal and the run
count exactly four, proving the duplicate-delivery recovery rule. Health moved
from `consumer_receipt_missing` to receipt-derived `last_consumer_failed`.

### Context projection

The release standup publisher emitted the frozen ten-field envelope and
returned 201. Cambium read back generation `1785189140183`, source revision
`release:439cb074d2f6`, and digest:

```text
sha256:a1700dcce47d35c9d96fe906960fbf64088988d636e74c3c124486d1511eeb79
```

The R2 object was current and fresh, and its recomputed digest matched.

### Remaining founder-visible acceptance

The packaged Plexus `v0.7.4` confirmation and the real
Plexus → Cambium/Hermes → Telegram delivery were not manufactured through an
operator bypass. They remain two explicit founder-visible acceptance smokes:

1. Generate standup evidence in Plexus and confirm `daily.sendEvent`.
2. Verify the resulting `/ts-standup` or digest topic receipt in Hermes.

The installed app was opened under the authenticated admin session. Its Today
view showed the daily proof packet as ready, but the request to prepare the
standup returned `No output generated. Check the stream for errors.` and Clio
entered offline mode before any `daily.sendEvent` confirmation appeared. No
event was queued or sent.

This does not block the reviewed Worker release or its rollback. It preserves
the intended human confirmation boundary and prevents a synthetic event from
being represented as founder-approved evidence.
