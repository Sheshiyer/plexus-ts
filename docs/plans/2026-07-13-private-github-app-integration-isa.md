---
task: "Integrate installation-scoped private GitHub repository control plane"
slug: 20260713-161136_plexus-private-github-app
project: plexus-ts-and-workspace-worker
effort: E3
effort_source: classifier
phase: verify
progress: 42/42
mode: interactive
started: 2026-07-13T16:11:36+05:30
updated: 2026-07-13T17:25:00+05:30
---

## Problem

Plexus currently calls a reserved Workspace Worker repository-verification route and then falls back to anonymous GitHub requests, so private repositories cannot be verified. The Worker also relies on a shared global GitHub token for unrelated issue synchronization. Access JWTs are encrypted at rest on current main, but decrypted values are still copied into subprocess environments. There is no installation-scoped GitHub App authority, webhook lifecycle, or guarded branch-to-pull-request write path.

## Vision

Plexus connects selected private repositories through a Thoughtseed-owned GitHub App. Founders grant access explicitly, the Worker resolves numeric installation and repository identities, every token is short-lived and least-privileged, and Plexus can verify repository access without possessing GitHub credentials. Any future write is auditable and constrained to branch, commit, and pull-request operations.

## Out of Scope

- Registering the GitHub App or entering production private keys during source implementation.
- Transferring repositories between personal accounts and a shared organization.
- Direct writes to default branches, force pushes, ruleset bypasses, or workflow-file changes.
- Storing GitHub private keys, installation tokens, webhook secrets, or personal access tokens in Plexus.
- Replacing existing Thoughtseed member-bridge authentication.
- Deploying the Worker before founder-owned GitHub inputs and secret configuration are available.

## Constraints

- GitHub App secrets and installation tokens live only in the Workspace Worker secret boundary.
- Plexus renderer and preload receive status and non-secret installation URLs only.
- Plexus member bridge tokens remain main-process-only and are persisted with Electron `safeStorage`.
- Repository authority is keyed by GitHub numeric installation, account, and repository IDs; client-supplied names are never authoritative.
- Installation state is admin-only, expiring, signed, and single-use.
- Webhook payloads are accepted only after `X-Hub-Signature-256` verification and delivery-id deduplication.
- Existing dirty worktrees are preserved; implementation occurs on isolated `codex/` branches.
- Existing `TF_GITHUB_TOKEN_GLOBAL` behavior is not silently repurposed as GitHub App authority.

## Goal

Implement and test the source-level private-repository control plane across Plexus and its Workspace Worker: secure GitHub App token minting, installation binding, signed lifecycle webhooks, installation-scoped repository verification, a guarded branch-to-pull-request mutation primitive, desktop status/install integration, removal of anonymous private-repository fallback, and removal of Access JWT subprocess exposure. Leave only external GitHub App registration, secrets, founder choices, deployment, and live pilot proof pending.

## Criteria

- [x] ISC-1: Plexus implementation starts from fetched `origin/main` in an isolated clean worktree.
- [x] ISC-2: Worker implementation starts from fetched `origin/main` in an isolated clean worktree.
- [x] ISC-3: Anti: no existing dirty worktree file is modified by this implementation.
- [x] ISC-4: Worker environment types include GitHub App ID, private key, client ID, client secret, webhook secret, and state-signing secret without sample secret values.
- [x] ISC-5: Worker can sign a GitHub App JWT with RS256 and a bounded expiry.
- [x] ISC-6: Worker can exchange an installation ID for an expiring installation access token.
- [x] ISC-7: Installation token requests use an explicit least-privilege permission object.
- [x] ISC-8: Installation state contains workspace, actor, nonce, and expiry claims.
- [x] ISC-9: Installation state rejects invalid signatures.
- [x] ISC-10: Installation state rejects expired values.
- [x] ISC-11: Installation state consumption is one conditional atomic update and cannot succeed twice.
- [x] ISC-12: OAuth callback verifies the initiating GitHub user's numeric ID without persisting the user access token.
- [x] ISC-12.1: A signed installation webhook records numeric installation, account, and installer IDs before workspace binding.
- [x] ISC-12.2: Workspace binding completes only when the state actor matches the signed webhook installer.
- [x] ISC-12.3: Webhook-before-callback and callback-before-webhook ordering produce the same binding.
- [x] ISC-13: Repository synchronization resolves numeric repository IDs from GitHub's installation API.
- [x] ISC-14: Anti: repository verification never trusts a client-supplied owner/name as authority.
- [x] ISC-15: Private-repository verification succeeds only for a repository bound to the authenticated workspace.
- [x] ISC-16: Cross-workspace repository verification is denied.
- [x] ISC-17: Webhooks reject missing or invalid `X-Hub-Signature-256` values.
- [x] ISC-17.1: Only the OAuth callback and webhook routes permit third-party requests without a Plexus principal, and both fail closed on state/signature verification.
- [x] ISC-18: Duplicate webhook delivery IDs are idempotently ignored.
- [x] ISC-19: Installation suspension or deletion disables repository access.
- [x] ISC-20: Repository added/removed webhook actions update workspace bindings.
- [x] ISC-20.1: Private GitHub activity sync uses the project's numeric bound repository and a read-only installation token.
- [x] ISC-20.2: CI visibility uses Actions and Checks read permissions only on the repository-scoped activity token and returns bounded workflow/check evidence.
- [x] ISC-21: A write request requires the caller-provided base SHA to match the repository default-branch head.
- [x] ISC-22: Write branches use a deterministic Plexus prefix and never target the default branch.
- [x] ISC-23: Anti: force-push and default-branch update operations are absent.
- [x] ISC-24: Changes under `.github/workflows/` are rejected.
- [x] ISC-25: A guarded write primitive can create a blob/tree/commit and pull request using an installation token.
- [x] ISC-26: Pull-request metadata records the authenticated Plexus actor and workspace attribution.
- [x] ISC-27: Plexus can request GitHub connection status and an installation URL without receiving credentials.
- [x] ISC-28: Plexus repository verification no longer falls back to anonymous GitHub API or HTML requests.
- [x] ISC-29: Plexus maps unconfigured, suspended, forbidden, and verified states into explicit typed results.
- [x] ISC-30: Anti: GitHub App secrets and installation tokens do not appear in renderer, preload, settings, logs, or SQLite.
- [x] ISC-31: Decrypted Cloudflare Access JWTs are no longer injected into subprocess environments.
- [x] ISC-32: Worker focused GitHub App tests pass.
- [x] ISC-33: Plexus focused repository-security tests pass.
- [x] ISC-34: Both repository TypeScript/build gates pass for touched surfaces.
- [x] ISC-35: Configuration documentation lists only secret names and founder-provided non-secret inputs.
- [x] ISC-36: Anti: no production deployment or GitHub App registration is claimed without live probe evidence.

## Test Strategy

| ISC | Type | Check | Threshold | Tool |
|---|---|---|---|---|
| ISC-1 | git | clean isolated Plexus branch | zero initial changes | `git status --short --branch` |
| ISC-2 | git | clean isolated Worker branch | zero initial changes | `git status --short --branch` |
| ISC-3 | git | original worktree preservation | status snapshots unchanged | `git status --short` |
| ISC-4 | source | environment contract | names present, values absent | `rg` |
| ISC-5 | unit | GitHub App JWT | RS256, exp <= 10m | focused test |
| ISC-6 | unit | token exchange | installation endpoint and expiry parsed | focused test |
| ISC-7 | unit | token permissions | exact allowlist | focused test |
| ISC-8 | unit | state claims | four required claims | focused test |
| ISC-9 | unit | state signature | tamper rejected | focused test |
| ISC-10 | unit | state expiry | expired rejected | focused test |
| ISC-11 | integration | atomic nonce consumption | `meta.changes === 1`; second callback denied | route test |
| ISC-12 | OAuth | initiating GitHub identity | numeric user ID, token discarded | route test |
| ISC-12.1 | webhook | signed installation facts | numeric IDs staged | route test |
| ISC-12.2 | database | correlated binding | state actor equals webhook sender | D1 test query |
| ISC-12.3 | ordering | callback/webhook race | both orderings bind once | route test |
| ISC-13 | integration | installation repositories | numeric IDs sourced remotely | mocked GitHub API test |
| ISC-14 | anti | client authority | supplied name ignored/rejected | route test |
| ISC-15 | integration | private verification | workspace-bound repository verified | route test |
| ISC-16 | RBAC | workspace isolation | cross-workspace 403/404 | route test |
| ISC-17 | crypto | webhook signature | invalid signature 401 | route test |
| ISC-17.1 | auth boundary | public callback/webhook only | every other GitHub route 401 | route test |
| ISC-18 | idempotency | duplicate delivery | one state mutation | route test |
| ISC-19 | lifecycle | suspension/deletion | binding inactive | route test |
| ISC-20 | lifecycle | repository selection | binding set updated | route test |
| ISC-20.1 | integration | private activity sync | bound repo, date-bounded results | route test |
| ISC-20.2 | integration | private CI visibility | repository-scoped workflow/check evidence | route test |
| ISC-21 | mutation | base SHA guard | mismatch 409 | service test |
| ISC-22 | mutation | branch guard | deterministic non-default ref | service test |
| ISC-23 | anti | forbidden writes | no force/default update path | source search |
| ISC-24 | mutation | workflow guard | path rejected | service test |
| ISC-25 | integration | Git data and PR calls | expected API sequence | mocked GitHub API test |
| ISC-26 | audit | attribution | actor and workspace in PR body | service test |
| ISC-27 | IPC/API | non-secret desktop flow | status and install URL only | contract test |
| ISC-28 | anti | anonymous fallback removal | zero anonymous GitHub fetches | source search |
| ISC-29 | contract | typed states | four states serialized | unit test |
| ISC-30 | anti | secret boundary | zero forbidden source/storage matches | `rg` + tests |
| ISC-31 | anti | subprocess custody | zero `CF_ACCESS_JWT` child env injection | `rg` + unit test |
| ISC-32 | test | Worker suite | focused command exit 0 | package test command |
| ISC-33 | test | Plexus suite | focused command exit 0 | package test command |
| ISC-34 | build | compile gates | both exit 0 | package scripts |
| ISC-35 | docs | operator inputs | names and non-secrets documented | file read |
| ISC-36 | anti | proof honesty | live work marked deferred | evidence review |

## Features

| Name | Description | Satisfies | Depends on | Parallelizable |
|---|---|---|---|---|
| WorkerAppAuth | RS256 App JWT and installation-token exchange | ISC-4–ISC-7 | none | true |
| InstallationBinding | OAuth identity, signed state, webhook correlation, numeric repository binding | ISC-8–ISC-16 | WorkerAppAuth | false |
| WebhookLifecycle | Signature verification, dedupe, suspension, repository changes, activity and CI sync | ISC-17–ISC-20.2 | InstallationBinding | true |
| PullRequestControl | Base-SHA guard, deterministic branches, commit and PR creation | ISC-21–ISC-26 | InstallationBinding | true |
| PlexusClient | Secure status/install/verify IPC and typed UI states | ISC-27–ISC-30 | InstallationBinding | true |
| CredentialCustody | Remove Access JWT subprocess exposure | ISC-31 | none | true |
| VerificationAndHandoff | Tests, builds, configuration documentation, proof boundary | ISC-32–ISC-36 | all | false |

## Decisions

- 2026-07-13 16:11 +05:30: The existing root `ISA.md` records the completed Thoughtseed member-bridge feature and is not overwritten. This task uses a dedicated durable feature ISA because it spans Plexus and the sibling Worker repository.
- 2026-07-13 16:11 +05:30: Root cause enters at repository authority ingestion: the desktop currently supplies a repository name and falls back to anonymous GitHub, while the Worker lacks an installation binding. The fix therefore begins in the Worker authority model, then removes output-side fallbacks.
- 2026-07-13 16:11 +05:30: External registration and production secrets remain founder/operator actions. Source implementation may use generated test keys only inside tests and must never claim a live installation before deployment probes.
- 2026-07-13 16:11 +05:30: The `TF_GITHUB_TOKEN_GLOBAL` issue-sync path remains legacy compatibility but is not accepted as proof of GitHub App integration and is excluded from new repository-verification and PR-control authority.
- 2026-07-13 16:18 +05:30: refined: A valid state cannot safely bind an arbitrary callback `installation_id`. The initiating admin first proves a numeric GitHub user identity through the App OAuth callback; a signed installation webhook records installation facts; binding completes only when that verified actor matches the webhook sender. Either callback/webhook arrival order is supported, and redirect query parameters are never the installation source of truth.
- 2026-07-13 16:34 +05:30: refined: Repository verification alone does not make private evidence operational. ISC-20.1 now requires the existing activity-sync contract to use the same numeric workspace binding and installation-token authority instead of falling through to the Worker's reserved 501 response.
- 2026-07-13 16:38 +05:30: refined: GitHub cannot present Cloudflare Access identity on OAuth callbacks or webhooks. ISC-17.1 narrows the public source boundary to exactly those two routes, guarded by single-use state or webhook signature; production Access policy remains an explicitly deferred live configuration proof.
- 2026-07-13 17:18 +05:30: refined: The pasted architecture also requires CI visibility. ISC-20.2 keeps Actions and Checks read authority off discovery and write tokens, scopes it to the verified numeric repository, and requires bounded workflow/check evidence before source integration is called complete.

## Verification

Source integration is complete and independently verified in isolated worktrees.

- Worker: `pnpm check`; `pnpm test` (12 files, 106 tests); all migrations parsed in an in-memory SQLite database; `git diff --check`.
- Plexus: `npm run typecheck`; `npm run lint`; assistant tests (100 files, 372 tests); renderer tests (7 files, 51 tests); main, preload, and renderer production builds; `git diff --check`.
- Security: independent final audit found no remaining P0/P1 code blockers.
- Preservation: original Plexus and Worker dirty-worktree status snapshots remain unchanged.
- Deferred live proof: GitHub App registration/owner install, Worker secrets, exact Cloudflare Access bypasses, D1 migration/deploy, private-repository Actions/Checks probe, guarded branch-to-PR pilot, revocation/removal, and cross-workspace denial.
