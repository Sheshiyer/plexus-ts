# Lifecycle Ownership and Receipts Evidence

Verification date: 2026-07-28 (Asia/Kolkata)

## Outcome

The local implementation slice now has named lifecycle owners and durable
evidence boundaries:

| Flow | Producer / trigger | Consumer | Durable evidence | Truth state |
|---|---|---|---|---|
| Plexus daily standup | persisted standup proof plus founder confirmation | existing member-scoped daily bridge | persisted delivery state and downstream receipt boundary | visible pending, queued, failed, or sent |
| Cambium context projection | explicit authenticated projection POST | exact-key routine context reader | versioned digest/generation projection plus bounded write receipt | current, stale, missing, or blocked-no-signal |
| TeamForge project sync | versioned sync-job POST/Queue message | Cloudflare Queue module handler | terminal job/run plus runtime-consumer receipt | unavailable, degraded, stale, or healthy |

No Worker, database migration, Queue, bucket, secret, OTA, AWS host, Telegram,
or external adapter was mutated.

## Isolated branches

```text
Plexus
branch: codex/lifecycle-ownership-receipts-plan
head:   2a2a2dd05775e59bad1a1050a4e76d2a8ee624fc

Cambium
branch: codex/lifecycle-context-projections
head:   32f6379067cc41025e279ec9c5b64e8110a49f78

TeamForge
branch: codex/lifecycle-queue-receipts
head:   b5cb7031e861cda0a2a50738153ee22af312a45c
```

All three worktrees were clean at evidence capture.

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

## Original checkout isolation

Original checkout HEADs remained unchanged:

```text
Plexus:    10172cbf677fe4ec37a42b5d6b81dbc73c162eac
Cambium:   0e906ab32d9e113034e64f6803d26748e84d75ae
TeamForge: 04757d7a136e313e0bc2bc6c408d6faa6f0926ae
```

Their status fingerprints changed during the parallel run because an unrelated
project scanner generated `_PROJECT-STATUS.md` in all three roots at exactly
02:01:05, while other pre-existing/concurrent root edits also remained present.
The implementation agents wrote and committed only inside their assigned
worktrees; no root checkout was cleaned, stashed, reset, or committed.

## Gated production release

These actions remain intentionally unperformed:

1. Create R2 bucket `thoughtseed-context-projections`.
2. Configure `CONTEXT_PROJECTION_WRITE_TOKEN`.
3. Apply TeamForge migration `0017_sync_runtime_receipts.sql`.
4. Create or confirm `teamforge-sync-dlq`.
5. Deploy reviewed Cambium `32f6379` and TeamForge `b5cb703`.
6. Run TeamForge projection generation in dry-run and inspect its metadata.
7. Run explicit HTTPS apply and read back the Cambium write receipt.
8. Submit one bounded project-sync job and confirm job, run, runtime receipt,
   and evidence-derived health.
9. Exercise the packaged Plexus confirmation UI and authorized downstream
   bridge receipt.
10. Trigger one real Plexus daily event and verify the Cambium → Hermes →
    Telegram digest path.

Rollback remains branch/Worker-release scoped. The encrypted
`thoughtseed-vault` plane was not repurposed or written by this slice.
