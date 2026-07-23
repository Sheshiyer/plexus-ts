# GitHub repository-link recovery

Date: 2026-07-23

## Observed failure

The UI reported the workspace connection as ready and showed a connected
owner, but the repository-link action surfaced:

> Workspace Worker returned an invalid GitHub OAuth authorization request.

The exception is thrown in the Electron main process before repository
verification. The previous validator accepted exactly three query keys:
client_id, redirect_uri, and state.

## Root cause

GitHub's OAuth authorization endpoint documents optional parameters including
scope, login, allow_signup, prompt, code_challenge, and
code_challenge_method. Plexus rejected every URL containing any of them, even
when the URL still targeted github.com and the canonical Worker callback.

## Fix

The validator now accepts only the documented optional keys, validates each
value, rejects unknown or duplicate keys, requires PKCE fields as a pair, and
keeps the exact GitHub host/path, Worker callback, signed state, and main-only
external navigation boundaries.

## Verification

- github-oauth-authorization.test.ts: 15 tests passed
- assistant suite: 107 files / 464 tests passed
- coworking suite: 32 files / 110 tests passed
- typecheck and lint passed
- main, preload, renderer builds passed
- main import smoke passed

## Remaining runtime boundary

This fixes the client-side OAuth launch rejection. After authorization, the
Thoughtseed Worker still must receive the callback, finish installation sync,
and return the selected repository with matching installation/repository IDs
and a verified timestamp. A pending installation is not treated as verified.
No Worker credentials or GitHub tokens are committed.

Source contract reference: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps

