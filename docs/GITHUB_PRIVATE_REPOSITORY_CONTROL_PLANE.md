# GitHub private-repository control plane

Status: source prepared and verified on 2026-07-21; production activation not
performed.

## What has already been built

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

## Root cause found

The desktop did not truncate the repository list. It already mapped every
repository returned by the Worker into both selectors.

Two authority inputs created the one-repository result:

1. Production has one active `Sheshiyer` installation configured with
   `repository_selection=selected`, and its only active repository fact is
   `Sheshiyer/parkarea-aleph`. Another 232 discovered repository facts are
   marked removed.
2. The Worker rejected GitHub's valid `repository_selection=all` mode in
   connection, reconciliation, actor, lifecycle, and listing paths.

The authenticated `Sheshiyer` account currently owns 233 repositories: 54
private and 179 public. GitHub will expose only the subset granted to this App.

## Prepared source behavior

The Workspace Worker now:

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

Plexus now:

- accepts and preserves `selected | all` scope metadata;
- rejects malformed scope metadata fail-closed;
- sorts and deduplicates repository options by installation/repository identity;
- shows whether each connected owner grants selected or all repositories;
- retains compatibility guidance for an older Worker that rejects `all`;
- continues to keep all GitHub secrets and installation tokens out of renderer
  code.

The default `TF_INTEGRATION_CONFIG_JSON` no longer names ParkArea. That legacy
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

## Production activation checklist

These steps were deliberately not executed during preparation:

Follow-up verification ID: `GH-ALL-REPOS-ACTIVATION-01`.

1. Review and merge the Workspace Worker and Plexus source branches.
2. Deploy the verified Workspace Worker version.
3. In the Thoughtseed GitHub App installation for each approved owner, choose
   either **All repositories** or **Only select repositories** and select every
   repository that should appear in Plexus.
4. Return to Plexus Settings and refresh/reconnect the owner so signed facts and
   discovery reflect the new grant.
5. Confirm Project Manager and Time Entry show the complete expected list.
6. Verify one private repository, sync read-only activity, and run a guarded
   write only if that project is intended to permit writes.

## Verification evidence

- Workspace Worker: TypeScript check, retired-routing guard, and 168/168 tests.
- Plexus: typecheck, lint, 595/595 tests, main build, preload build, and renderer
  production build.
- Red/green coverage includes both scope modes, unknown values, lifecycle
  bootstrap, stale-hint recovery, 101 repositories across two pages, empty
  grants, partial-page failure, multi-owner aggregation, stable deduplication,
  scope presentation, and secret-field stripping.
- No Worker deployment, D1 mutation, GitHub installation change, commit, push,
  or pull request was performed.

The existing Plexus lockfile still reports dependency advisories in the
production/release audit scripts. This task did not change `package.json` or
`package-lock.json`; dependency remediation is separate from repository-scope
authority.
