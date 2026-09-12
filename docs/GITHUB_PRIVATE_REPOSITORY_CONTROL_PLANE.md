# GitHub private-repository control plane

Status: current source contract, reconciled 2026-09-05 for v0.7.12.
The July investigation and test results below are historical. September name-only
Labs Worker inventory includes GitHub App secrets, but current grants, JWT use,
selected repositories and authenticated desktop operations remain unverified.
See [migration evidence](evidence/2026-09-05-labs-migration-review.md) and
[documentation map](DOCUMENTATION_MAP.md).

## Implemented source responsibilities

The private-repository integration is a GitHub App control plane shared by
Plexus and the Workspace Worker. The feature lineage includes:

- private GitHub App OAuth with server-held keys and short-lived installation
  tokens;
- exact allowlisted organization and founder account identities;
- founder actor enrollment using immutable numeric GitHub user IDs;
- signed installation and repository webhook facts with replay protection;
- callback replay, stale installation-hint recovery, compact repository facts,
  and return-to-Plexus handling;
- paginated repository discovery across multiple connected owners;
- private repository options carrying numeric installation and repository IDs;
- exact project-to-repository verification;
- project-scoped GitHub activity and CI evidence collection;
- guarded branch and pull-request writes with actor attribution;
- repository selectors in Project Manager and Time Entry project creation;
- truthful owner connection state and recovery guidance in Settings.

Relevant Plexus lineage: `0a0da62`, `cd1abe7`, `46fb708`, `a227c83`.
Relevant Workspace Worker lineage: `4991195`, `94645f1`, `49e66de`,
`53e6b4a`, `4e6c5f2`, `9e24654`.

## July 21 diagnosis — historical snapshot

The desktop did not truncate the repository list. It already mapped every
repository returned by the Worker into both selectors.

Two authority inputs created the one-repository result:

1. The July probe found one active `Sheshiyer` installation configured with
   `repository_selection=selected`, and its only active repository fact is
   `Sheshiyer/parkarea-aleph`. Another 232 discovered repository facts are
   marked removed.
2. The Worker rejected GitHub's valid `repository_selection=all` mode in
   connection, reconciliation, actor, lifecycle, and listing paths.

The July account inventory reported 233 repositories: 54 private and 179 public.
Those counts are not a current inventory. GitHub exposes only the repositories
granted to the App installation.

## Backend behavior recorded by the July implementation

The July implementation evidence records the following Worker behavior. The
local sibling directory inspected in September is not a version-verified Git
checkout of the deployed server and does not substantiate every App handler.
Reconcile deployed version/source before treating these statements as current
production capability:

- accepts exactly GitHub's `selected` and `all` installation modes;
- rejects missing, malformed, or unknown selection modes;
- preserves the exact account and founder actor allowlists;
- accepts signed lifecycle and recovery facts for either supported mode;
- paginates `GET /installation/repositories` at 100 repositories per page;
- returns every accessible repository across every active allowed owner;
- sorts options deterministically and deduplicates by numeric repository ID;
- returns the installation's repository-selection mode as descriptive metadata;
- retires stale repository facts when a complete grant is empty;
- performs no repository writes when pagination fails partway through;
- mints discovery tokens installation-wide with metadata-read only;
- mints metadata, activity, and write tokens with one exact `repository_ids`
  entry.

## Current Plexus client behavior

The current Plexus client (`src/main/teamforge.ts` and repository-selection surfaces):

- accepts and preserves `selected | all` scope metadata;
- rejects malformed scope metadata fail-closed;
- sorts and deduplicates repository options by installation/repository identity;
- shows whether each connected owner grants selected or all repositories;
- retains compatibility guidance for an older Worker that rejects `all`;
- continues to keep all GitHub secrets and installation tokens out of renderer
  code.

The July implementation removed ParkArea from its default `TF_INTEGRATION_CONFIG_JSON`. That legacy
mapping is display metadata returned by `/v1/credentials`; it is not GitHub App
authority and does not filter `/v1/github/repositories`.

## Authority boundaries

GitHub installation grant → signed installation fact → exact allowlisted account
binding → live repository discovery → exact project verification → token narrowed
to one numeric repository for each operation.

An `all` installation broadens discovery only to the repositories GitHub grants
that installation. It does not relax workspace membership, administrator checks,
founder actor policy, account allowlists, project binding, or per-operation token
scope.

GitHub documents both `selected` and `all` installation modes, paginated
installation repositories, and optional `repository_ids` narrowing for
installation access tokens:

- <https://docs.github.com/en/rest/apps/installations?apiVersion=2022-11-28>
- <https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28>
- <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app>

## Configuration map

| Configuration | Purpose | Repository authority |
|---|---|---|
| GitHub App installation setting | User chooses selected or all repositories | Canonical grant |
| `TF_GITHUB_ALLOWED_INSTALLATION_ACCOUNTS` | Exact organization/founder installation allowlist | Account boundary |
| `TF_GITHUB_ALLOWED_ACTORS` | Exact founder OAuth identities | Actor boundary |
| `TF_GITHUB_APP_*` variables/secrets | App identity, callback, signing, webhooks | Server-only trust |
| D1 installation/repository facts | Signed and discovered authority projection | Runtime verification |
| Project GitHub verification | One installation/repository identity tuple | Project boundary |
| `TF_INTEGRATION_CONFIG_JSON` | Legacy non-secret display mappings | Never OAuth authority |

## Remaining live acceptance

The July preparation did not perform these live actions. September is already
past a Labs API relocation, so do not blindly repeat a merge or deployment from
this old checklist. First establish the current Worker version, its scoped
configuration and the exact App/installation state.

Follow-up verification ID: `GH-ALL-REPOS-ACTIVATION-01`.

1. Compare the deployed Labs Worker version with reviewed server source and
   confirm the relevant handlers are present.
2. Prepare a targeted deployment only if that comparison establishes a source
   gap; preserve existing credentials and installation facts.
3. In the Thoughtseed GitHub App installation for each approved owner, choose
   either **All repositories** or **Only select repositories** and select every
   repository that should appear in Plexus.
4. Return to Plexus Settings and refresh/reconnect the owner so signed facts and
   discovery reflect the new grant.
5. Confirm Project Manager and Time Entry show the complete expected list.
6. Verify one private repository, sync read-only activity, and run a guarded
   write only if that project is intended to permit writes.

## Historical July verification evidence

- Workspace Worker: TypeScript check, retired-routing guard, and 168/168 tests.
- Plexus: typecheck, lint, 595/595 tests, main build, preload build, and renderer
  production build.
- Red/green coverage includes both scope modes, unknown values, lifecycle
  bootstrap, stale-hint recovery, 101 repositories across two pages, empty
  grants, partial-page failure, multi-owner aggregation, stable deduplication,
  scope presentation, and secret-field stripping.
- No Worker deployment, D1 mutation, GitHub installation change, commit, push,
  or pull request was performed.

The July task recorded dependency advisories without changing package files.
That is not a current audit result. Use the [security audit contract](SECURITY_AUDIT_WAIVERS.md)
for fresh release validation; this September documentation review ran no audit.

## Source references and schema boundary

Desktop owners are `src/main/teamforge.ts`,
`src/shared/github-repository-authority.ts`, `src/shared/github-connection-status.ts`,
`src/main/github-oauth-authorization.ts` and the repository selectors. Backend
App routes and D1 projections belong to sibling `team-forge-ts/cloudflare/worker`.
Use its Labs profile/configuration and actual migrations when preparing a
read-only probe; `plexus-db` and guessed installation columns are not authority.

Historical ISA selected-only criteria describe an older policy. Current desktop parsing
supports GitHub's `selected | all` modes; July backend evidence describes numeric
account/actor allowlists and per-operation repository narrowing. Verify those
server boundaries against the deployed revision. Do not rewrite that historical
criterion as a pass or force a database value to satisfy an obsolete checklist.
