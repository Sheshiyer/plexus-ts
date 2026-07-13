# Thoughtseed Labs founder GitHub setup

Plexus ships a guarded onboarding helper for the two preconfigured founder accounts:

- organization: `thoughtseed-labs`
- founders: `Sheshiyer`, `psychon7`

The public numeric identities were live-verified on 2026-07-13 and are pinned by the preflight: `Sheshiyer=7611727`, `psychon7=47470954`, and `thoughtseed-labs=65741640`. A legitimate account or organization rename requires a deliberate reviewed update to these pairs; a matching login alone is not accepted.

The helper is a read-only preflight. It checks the current GitHub CLI credential-store session and active organization membership, then opens the fixed `plexus://github/setup/v1` route. It does not grant repository authority. Plexus completes a separate in-app OAuth verification through the Workspace Worker.

## Run after installing Plexus

macOS:

```sh
sh "/Applications/Plexus.app/Contents/Resources/setup-thoughtseed-github"
```

Windows PowerShell (default per-user install):

```powershell
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Programs\Plexus\resources\setup-thoughtseed-github.ps1"
```

Use `--check` to validate prerequisites without opening Plexus. The helper accepts no account, organization, URL, repository, token, or secret arguments.

## Prerequisites and recovery

1. Install GitHub CLI from the official GitHub CLI distribution.
2. Run `gh auth login --hostname github.com` as `Sheshiyer` or `psychon7`.
3. If organization membership cannot be read, run `gh auth refresh --hostname github.com --scopes read:org`.
4. Confirm the account is an active member of `thoughtseed-labs` with `gh api user/memberships/orgs/thoughtseed-labs`.
5. Run the packaged helper again and finish GitHub verification inside Plexus Settings.

If the GitHub App installation has not been connected yet, a workspace administrator must first choose **Connect GitHub** and grant selected repositories only. Each founder then chooses **Verify founder** for their own Plexus member identity.

## Guardrails

- The native shell helpers use the existing `gh` executable; Plexus does not bundle GitHub CLI or require an external Node runtime for the documented installed-app command.
- The helper resolves `gh` once from the user's trusted local `PATH`; securing that local developer toolchain remains a prerequisite. The preflight itself grants no authority.
- Environment token variables are removed from helper child calls so the preflight uses the GitHub CLI credential store.
- The preflight never accepts or prints PATs, private keys, webhook secrets, Cloudflare Access credentials, or member bridge tokens.
- The protocol route is fixed and versioned. Query strings, fragments, credentials, ports, and alternate paths are rejected.
- Renderer code receives only setup intent metadata: version, organization login, and allowed founder login hints.
- Worker/member credentials remain inside Electron main and OS-backed `safeStorage`.
- Usernames are enrollment hints only. Worker authority uses the OAuth-verified immutable GitHub account id plus live repository permission checks.
- GitHub write operations remain admin-only and selected-repository-scoped.

## Development check

From the repository:

```sh
node resources/setup-thoughtseed-github.mjs --check
```

The packaged-resource and protocol registration contract is covered by `test/assistant/founder-github-setup.test.ts`.
