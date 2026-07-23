---
task: "Extend private GitHub App across exact founder repository owners"
slug: 20260713-161136_plexus-private-github-app
project: plexus-ts-and-workspace-worker
effort: E3
effort_source: classifier
phase: complete
progress: 72/72
mode: interactive
started: 2026-07-13T16:11:36+05:30
updated: 2026-07-14T12:02:00+05:30
---

## Problem

Plexus currently calls a reserved Workspace Worker repository-verification route and then falls back to anonymous GitHub requests, so private repositories cannot be verified. The Worker also relies on a shared global GitHub token for unrelated issue synchronization. Access JWTs are encrypted at rest on current main, but decrypted values are still copied into subprocess environments. There is no installation-scoped GitHub App authority, webhook lifecycle, or guarded branch-to-pull-request write path.

The merged control plane now supports one organization-owned installation per workspace and separately enrolls both founders, but that single-installation assumption prevents selected repositories owned by `Sheshiyer` or `psychon7` from coexisting with `thoughtseed-labs`. Moving every repository into the organization would hide the data-model limitation rather than solve it. A public-but-unlisted App also needs an exact account allowlist before it can safely accept personal-account installations.

## Vision

Plexus connects selected private repositories through a Thoughtseed-owned GitHub App. Founders grant access explicitly, the Worker resolves numeric installation and repository identities, every token is short-lived and least-privileged, and Plexus can verify repository access without possessing GitHub credentials. Any future write is auditable and constrained to branch, commit, and pull-request operations.

One App can be installed separately on `thoughtseed-labs`, `Sheshiyer`, and `psychon7`, while each founder still authorizes Plexus as an individual immutable GitHub actor. Projects retain their exact installation authority, so organization and founder-owned repositories appear together without shared PATs or repository transfers.

## Out of Scope

- Registering the GitHub App or entering production private keys during source implementation.
- Transferring repositories between personal accounts and a shared organization.
- Direct writes to default branches, force pushes, ruleset bypasses, or workflow-file changes.
- Storing GitHub private keys, installation tokens, webhook secrets, or personal access tokens in Plexus.
- Replacing existing Thoughtseed member-bridge authentication.
- Deploying the Worker before founder-owned GitHub inputs and secret configuration are available.
- Storing expiring GitHub user access or refresh tokens for exact human-side GitHub attribution.
- Transferring `Sheshiyer/parkarea-aleph` into `thoughtseed-labs` solely to satisfy a single-installation schema.

## Constraints

- GitHub App secrets and installation tokens live only in the Workspace Worker secret boundary.
- Plexus renderer and preload receive status and non-secret installation URLs only.
- Plexus member bridge tokens remain main-process-only and are persisted with Electron `safeStorage`.
- Repository authority is keyed by GitHub numeric installation, account, and repository IDs; client-supplied names are never authoritative.
- Installation state is admin-only, expiring, signed, and single-use.
- Webhook payloads are accepted only after `X-Hub-Signature-256` verification and delivery-id deduplication.
- Existing dirty worktrees are preserved; implementation occurs on isolated `codex/` branches.
- Existing `TF_GITHUB_TOKEN_GLOBAL` behavior is not silently repurposed as GitHub App authority.
- Installation accounts are exact allowlisted triples of account type, login, and immutable numeric ID.
- Founder actors remain a separate exact login-and-numeric-ID policy from installation owners.
- Every project operation resolves its persisted installation ID; no workspace-default installation fallback exists.
- A public App may receive unrelated signed webhooks, which are ignored before installation facts or repository rows are persisted.

## Goal

Implement and test the source-level private-repository control plane across Plexus and its Workspace Worker: secure GitHub App token minting, multiple exact installation bindings for `thoughtseed-labs`, `Sheshiyer`, and `psychon7`, signed lifecycle webhooks, installation-scoped repository verification, a guarded branch-to-pull-request mutation primitive, separate founder actor enrollment, desktop owner selection, removal of anonymous private-repository fallback, and removal of Access JWT subprocess exposure. Leave only external GitHub App visibility/installation, secrets, founder choices, deployment, and live pilot proof pending.

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

### Multi-owner installation extension

- [x] ISC-37: Worker configuration parses exact `Type:login:id` installation-account allowlist entries.
- [x] ISC-38: Migration `0014` permits multiple installation bindings for one workspace.
- [x] ISC-39: Migration `0014` preserves an existing `0013` workspace installation binding.
- [x] ISC-40: Connection state records the exact intended account type, login, and numeric ID.
- [x] ISC-41: Anti: a signed webhook for an unallowlisted installation account persists no installation fact.
- [x] ISC-42: One workspace cannot bind two installations for the same numeric account.
- [x] ISC-43: One installation cannot bind to two Plexus workspaces.
- [x] ISC-44: Connection status returns every installation binding as `installations[]`.
- [x] ISC-45: Connection status returns the exact configured installation targets.
- [x] ISC-46: Connection start rejects an account ID absent from the installation target allowlist.
- [x] ISC-47: Connection start signs the selected allowlisted account into its single-use state.
- [x] ISC-48: Repository discovery aggregates active repositories across every workspace installation.
- [x] ISC-49: Each discovered repository includes its numeric installation and owning account metadata.
- [x] ISC-50: Project verification requires both numeric `installationId` and numeric `repositoryId`.
- [x] ISC-51: Project verification persists the selected installation ID with the repository ID.
- [x] ISC-52: Activity synchronization mints its token from the project's persisted installation.
- [x] ISC-53: Guarded writes mint their token from the project's persisted installation.
- [x] ISC-54: Founder actor enrollment accepts access through any active workspace installation.
- [x] ISC-55: `github_workspace_actors` still binds one Plexus identity to one immutable GitHub user per workspace.
- [x] ISC-56: Anti: no shared PAT, classic PAT, or reusable OAuth token enters the control plane.
- [x] ISC-57: Plexus client contracts consume multiple installations and installation-qualified repositories.
- [x] ISC-58: Plexus GitHub settings let an administrator choose one of the three exact installation owners.
- [x] ISC-59: The bundled founder setup command reports all exact installation owners without requesting secrets.
- [x] ISC-60: Configuration documentation names Thoughtseed Labs, Sheshiyer, and psychon7 with immutable IDs.
- [x] ISC-61: Fresh-schema and `0013` to `0014` migration tests pass.
- [x] ISC-62: Worker focused GitHub control-plane tests pass.
- [x] ISC-63: Plexus focused GitHub client and setup tests pass.
- [x] ISC-64: Both repository typecheck/build gates pass for touched surfaces.
- [x] ISC-65: Existing actor enrollment for `Sheshiyer:7611727` and `psychon7:47470954` remains independently usable.
- [x] ISC-66: Anti: source completion does not claim live App visibility, installation, Worker deployment, or founder OAuth proof.

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
| ISC-37–ISC-43 | schema/security | exact account allowlist and multi-binding invariants | every invalid or conflicting account fails closed | migration + route tests |
| ISC-44–ISC-49 | API | multi-installation status and repository aggregation | exact arrays and installation-qualified repositories | route tests |
| ISC-50–ISC-55 | authority | persisted project installation and separate founder actor binding | no workspace-default fallback | route/service tests + source search |
| ISC-56 | anti | personal token custody | zero PAT or reusable user-token path | source and environment scan |
| ISC-57–ISC-60 | desktop/docs | owner selection, qualified repositories, preflight guidance | all three exact owners visible without secrets | Vitest + script smoke + file read |
| ISC-61–ISC-66 | verification | migrations, focused suites, builds, and proof boundary | commands exit 0; live claims remain deferred | package scripts + evidence review |

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
| MultiOwnerInstallations | Exact owner allowlist, multi-binding migration, target-bound state, repository aggregation, and persisted installation routing | ISC-37–ISC-56 | InstallationBinding, WebhookLifecycle, PullRequestControl | false |
| MultiOwnerDesktop | Owner selection, installation-qualified repository contracts, founder setup guidance, and regression verification | ISC-57–ISC-66 | MultiOwnerInstallations, PlexusClient | false |

## Decisions

- 2026-07-13 16:11 +05:30: The existing root `ISA.md` records the completed Thoughtseed member-bridge feature and is not overwritten. This task uses a dedicated durable feature ISA because it spans Plexus and the sibling Worker repository.
- 2026-07-13 16:11 +05:30: Root cause enters at repository authority ingestion: the desktop currently supplies a repository name and falls back to anonymous GitHub, while the Worker lacks an installation binding. The fix therefore begins in the Worker authority model, then removes output-side fallbacks.
- 2026-07-13 16:11 +05:30: External registration and production secrets remain founder/operator actions. Source implementation may use generated test keys only inside tests and must never claim a live installation before deployment probes.
- 2026-07-13 16:11 +05:30: The `TF_GITHUB_TOKEN_GLOBAL` issue-sync path remains legacy compatibility but is not accepted as proof of GitHub App integration and is excluded from new repository-verification and PR-control authority.
- 2026-07-13 16:18 +05:30: refined: A valid state cannot safely bind an arbitrary callback `installation_id`. The initiating admin first proves a numeric GitHub user identity through the App OAuth callback; a signed installation webhook records installation facts; binding completes only when that verified actor matches the webhook sender. Either callback/webhook arrival order is supported, and redirect query parameters are never the installation source of truth.
- 2026-07-13 16:34 +05:30: refined: Repository verification alone does not make private evidence operational. ISC-20.1 now requires the existing activity-sync contract to use the same numeric workspace binding and installation-token authority instead of falling through to the Worker's reserved 501 response.
- 2026-07-13 16:38 +05:30: refined: GitHub cannot present Cloudflare Access identity on OAuth callbacks or webhooks. ISC-17.1 narrows the public source boundary to exactly those two routes, guarded by single-use state or webhook signature; production Access policy remains an explicitly deferred live configuration proof.
- 2026-07-13 17:18 +05:30: refined: The pasted architecture also requires CI visibility. ISC-20.2 keeps Actions and Checks read authority off discovery and write tokens, scopes it to the verified numeric repository, and requires bounded workflow/check evidence before source integration is called complete.
- 2026-07-14 14:30 +05:30: refined: `psychon7` is the confirmed co-founder GitHub login; `psychon07` is display-name wording, not a third account. The exact actor policy remains `Sheshiyer:7611727,psychon7:47470954`.
- 2026-07-14 14:30 +05:30: Installing one public-but-unlisted App on three selected owners is safer and less disruptive than transferring personal repositories or sharing PATs. Repository-owner authority and human-actor authority therefore remain separate policies.
- 2026-07-14 14:30 +05:30: Implementation is isolated in `/private/tmp/plexus-multi-owner-github-app` and `/private/tmp/teamforge-multi-owner-github`; the dirty root checkouts and every existing worktree remain preservation boundaries.
- 2026-07-14 14:42 +05:30: The commitment-boundary Advisor was invoked twice and produced no textual verdict, so it is not treated as approval. The earlier independent security and multi-owner audits plus executable migration, route, and compatibility tests remain the evidence gate.
- 2026-07-14 14:42 +05:30: Delegation is limited to one isolated Worker producer because schema, route, and test writes are sequentially coupled. A second write agent would overlap the same authority files; the primary owns diff review and the later Plexus batch.
- 2026-07-14 11:56 +05:30: Repository choices remain globally numeric but now carry their installation ID and exact owner metadata through Worker, Electron main, preload, and renderer contracts. Verification refuses either missing number, and retry handoffs persist both.
- 2026-07-14 11:56 +05:30: Settings uses one full-width owner row per pinned account so immutable IDs, status, and connect/manage actions remain visible without multi-column overflow. The screenshot harness now captures this state with an administrator session.

## Verification

Source integration is complete and verified in isolated worktrees.

- Worker: `pnpm check`; GitHub route/migration suite (13 files, 125 tests after the two-founder enrollment matrix); real SQLite fresh-schema and `0013` to `0014` upgrade rehearsals; `git diff --check`.
- Plexus: `npm run lint`; `npm run typecheck`; focused GitHub client/setup tests (2 files, 34 tests); assistant suite (102 files, 397 tests); renderer suite (7 files, 51 tests); co-working suite (25 files, 77 tests); identity suite (3 files, 11 tests); main, preload, and renderer production builds; `git diff --check`.
- UI: the administrator Settings screenshot matrix passes horizontal-overflow, full-row density, keyboard-reachability, and exact-owner marker probes. Local proof: `/private/tmp/plexus-github-owner-visual-proof-confirmed/settings-github-owners-1280.png`.
- Security: renderer contracts expose only numeric public identities, installation state, and repository choices; App secrets, installation tokens, PATs, and reusable OAuth tokens remain outside Plexus.
- Preservation: original Plexus and Worker dirty-worktree status snapshots remain unchanged.
- Deferred live proof: GitHub App visibility/registration, three owner installations, Worker secrets and deployment, D1 production migration, real founder OAuth, private-repository Actions/Checks, guarded branch-to-PR pilot, revocation/removal, and cross-workspace denial.

## Changelog

- 2026-07-14 12:02 +05:30: Conjectured that authenticated Worker tuples were sufficient desktop authority; refuted by the final trust-boundary reread showing a valid-looking misconfigured tuple could reach OAuth and the renderer; learned that both sides should independently pin product identities; criterion now ISC-57 and ISC-58 require Plexus to reject any owner or actor outside the three exact installation targets and two exact founders.
