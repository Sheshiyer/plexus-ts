# Thoughtseed GitHub Founder Onboarding ISA

Date: 2026-07-13
Status: implementation contract
Owners: Plexus desktop and TeamForge Worker

## Problem

Plexus can connect one GitHub App installer to a workspace, but it does not yet provide a repeatable, post-install flow that lets both founders independently verify their GitHub identity and act through the same `thoughtseed-labs` installation. A shared token or username-only allowlist would make setup easy but would collapse the security boundary.

## Vision

After Plexus is installed, either `Sheshiyer` or `psychon7` can run one bundled command, receive local preflight guidance, open the exact GitHub settings surface, finish OAuth inside the existing Worker-controlled flow, and gain only the repository authority GitHub currently grants that verified numeric user.

## Out of scope

- Creating or rotating GitHub App private keys, client secrets, webhook secrets, or Worker service credentials.
- Installing the GitHub App into repositories without a founder's explicit GitHub interaction.
- Granting access to every repository in the organization.
- Direct pushes to default branches, workflow-file writes, automated merges, or bypassing branch protection.
- Treating local `gh` authentication as Plexus authorization.
- Replacing the existing Thoughtseed member/session bridge.

## Constraints

- The organization hint is exactly `thoughtseed-labs`.
- The initial founder login hints are `Sheshiyer` and `psychon7`.
- The immutable organization policy id is `65741640`.
- The immutable founder policy ids are `Sheshiyer=7611727` and `psychon7=47470954`.
- Login strings may gate enrollment eligibility but never become durable authority.
- Durable authority uses the numeric GitHub user id returned by OAuth.
- Every write rechecks the current actor's live repository permission.
- Worker and member credentials remain in Electron main and `safeStorage`.
- The renderer and onboarding script never receive Worker credentials or GitHub tokens.
- Existing selected-repositories-only installation and deterministic PR-write guardrails remain intact.
- Existing dirty worktrees and unrelated branches remain untouched.

## Goal

Ship a cross-platform, bundled founder setup command plus multi-actor Worker enrollment that is safe to repeat, safe to fail, and independently usable by both founders.

## Acceptance criteria

### Configuration and discovery

- [ ] C01. The bundled setup command identifies `thoughtseed-labs` as the expected organization.
- [ ] C02. The bundled setup command recognizes only `Sheshiyer` and `psychon7` as initial login hints.
- [ ] C03. Organization and login hints contain no secret material.
- [ ] C04. The command has a deterministic `--check` or equivalent preflight mode.
- [ ] C05. The command documents platform-specific invocation after installation.
- [ ] C06. The packaged application contains the command on macOS, Windows, and Linux builds.

### Local preflight

- [ ] C07. Missing `gh` produces a clear installation/recovery message and a non-zero exit.
- [ ] C08. An unauthenticated `gh` session produces a clear login recovery message and a non-zero exit.
- [ ] C09. An unexpected GitHub login fails closed before Plexus setup is opened.
- [ ] C10. Organization membership is checked locally when the available `gh` scope permits it.
- [ ] C11. Membership-check ambiguity never grants authority and is surfaced as a recovery step.
- [ ] C12. The command never accepts a PAT, OAuth token, App key, or Worker token argument.
- [ ] C13. The command never prints credential-bearing environment variables or `gh` responses containing tokens.
- [ ] C14. Child processes receive an allowlisted or sanitized environment.

### Desktop boundary

- [ ] C15. The setup command opens Plexus only through a fixed, validated setup intent.
- [ ] C16. Arbitrary deep-link paths, query values, and external URLs cannot trigger privileged IPC.
- [ ] C17. The setup intent focuses the GitHub settings section after the renderer is ready.
- [ ] C18. The setup surface shows the expected organization and founder login hints.
- [ ] C19. The setup surface distinguishes installation status from the current founder's actor status.
- [ ] C20. Only an active workspace administrator can start installation or actor enrollment.
- [ ] C21. Renderer APIs expose status and authorize URLs, never Worker credentials.
- [ ] C22. Worker/member credentials remain encrypted through Electron `safeStorage`.

### Worker identity and authorization

- [ ] C23. Each enrolled Plexus identity maps to one verified numeric GitHub user id per workspace.
- [ ] C24. The initial installation connector is migrated or recorded as an enrolled actor.
- [ ] C25. A second founder completes a separate, signed, expiring, single-use OAuth state.
- [ ] C26. OAuth callback state remains bound to both workspace and initiating Plexus identity.
- [ ] C27. An inactive or demoted initiating identity cannot finish enrollment.
- [ ] C28. A login outside the configured founder hint set is rejected before actor persistence.
- [ ] C29. OAuth login and numeric id must both match one immutable configured founder pair before actor persistence.
- [ ] C30. Actor status reports the verified login/id without returning OAuth or installation tokens.
- [ ] C31. Guarded writes select the current caller's actor mapping rather than the installation connector.
- [ ] C32. Every guarded write requires current GitHub `write`, `maintain`, or `admin` permission for the same numeric user id.
- [ ] C33. Selected-repositories-only, numeric repository identity, base-SHA, path, size, idempotency, and default-branch protections remain enforced.
- [ ] C34. Removing/deactivating an actor immediately prevents new guarded writes.
- [ ] C34a. The connected installation account must match organization login `thoughtseed-labs`, type `Organization`, and numeric id `65741640`.

### Reliability and evidence

- [ ] C35. Re-running setup is idempotent and reports the already-enrolled identity.
- [ ] C36. OAuth cancellation or timeout leaves no usable partial actor enrollment.
- [ ] C37. Worker migration applies cleanly to a database containing migration `0012` data.
- [ ] C38. Tests cover both allowed founders and at least one denied login.
- [ ] C39. Tests cover state replay, actor mismatch, demotion, and numeric-id mismatch.
- [ ] C40. Tests cover local command success, missing `gh`, wrong login, and membership failure.
- [ ] C41. Existing GitHub App connection, repository listing, evidence sync, and guarded-write tests stay green.
- [ ] C42. Release documentation states which live GitHub App and Worker configuration remains operator-owned.

## Anti-criteria

- [ ] A01. No shared founder PAT or reusable OAuth token is introduced.
- [ ] A02. No username string alone authorizes a repository read or write.
- [ ] A03. No script calls privileged Worker endpoints directly.
- [ ] A04. No renderer value can reveal the encrypted member bridge token.
- [ ] A05. No default-branch push, workflow-file mutation, or automatic merge is enabled.
- [ ] A06. No unrelated worktree, branch, stash, or local change is modified or removed.

## Features

1. Bundled `setup-thoughtseed-github` command with local `gh` preflight.
2. Fixed Plexus setup intent that focuses the GitHub settings surface.
3. Founder actor status and enrollment controls in existing branded settings components.
4. Worker-backed per-workspace GitHub actor table and OAuth enrollment lifecycle.
5. Guarded writes attributed to and authorized for the current verified actor.

## Test strategy

- Unit-test command parsing, process environment sanitation, identity normalization, and intent validation.
- Route-test signed state creation/consumption, actor persistence, allowlist rejection, and admin demotion.
- Route-test guarded writes for connector, cofounder, unbound identity, stale login, and numeric-id mismatch.
- Run Worker typecheck, migrations, and full test suite.
- Run Plexus typecheck, focused renderer/main tests, production security audits, and packaged-resource assertions.
- Perform a release dry-run or package inspection before tagging the next OTA release.
- Keep live installation/deployment proof explicitly pending until GitHub App configuration and a selected pilot repository are confirmed.

## Verification evidence

Source status: complete on isolated branches. Live deployment status: pending.

- Worker: TypeScript check passed; 12 files and 117 tests passed; migrations `0001` through `0013` applied to a fresh SQLite database.
- Plexus: TypeScript, ESLint, no-placeholder, fuse, CSP, and both production security audits passed.
- Plexus tests: 102 assistant files/393 tests, 25 coworking files/77 tests, 3 identity files/11 tests, and 7 renderer files/51 tests passed.
- Package: unsigned macOS arm64 directory build passed; all three helpers were present; the packaged shell helper passed live `--check`; `Info.plist` registered only `plexus`.
- Live identity preflight: `Sheshiyer` resolved to `7611727` with active `thoughtseed-labs` membership and organization id `65741640`.
- Live gates: deploy Worker migration/config, confirm both Plexus admins exist, run `psychon7` preflight, complete both OAuth enrollments, and verify one selected pilot repository before OTA publication.
