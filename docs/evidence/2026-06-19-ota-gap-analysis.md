# Plexus OTA Gap Analysis

Date: 2026-06-19
Scope: post-0.4.0 local worktree before the next signed OTA workflow; updated after executing the 0.4.1 patch-prep items.

## Release Decision

Status: **0.4.1 patch prep executed; hold for runtime and signed OTA proof**.

Do not publish the current dirty tree as `v0.4.0`. The public OTA feed already serves
`0.4.0`, and the earlier pre-bump dry-run emitted a different `0.4.0` artifact.
The package and lockfile have now been bumped to `0.4.1`; the remaining release
blockers are runtime proof, clean commit/tag state, and true signed OTA proof.

## Automated Gate Results

| Gate | Result | Notes |
|---|---:|---|
| `npm run typecheck` | Pass | `tsc --noEmit` completed. |
| `npm run build:main` | Pass | Main process TypeScript build completed. |
| `npm run build:preload` | Pass | Preload TypeScript build completed. |
| `npx vite build` | Pass | Renderer emitted successfully; existing parent `astro/tsconfigs/strict` warning remains. |
| `git diff --check` | Pass | No whitespace/conflict marker issues. |
| Focused no-placeholder scan | Pass | No banned old-brand, placeholder, or fake-proof strings found. |
| `npm run release:dry-run` | Pass after escalation | 0.4.1 run produced DMG, ZIP, blockmaps, and `latest-mac.yml`. |
| `npm run lint` | Pass | ESLint flat config now runs against source/config/helper scripts. |
| `npm ci --dry-run --ignore-scripts` | Pass | Hosted CI install shape is valid after the 0.4.1 lockfile update. |
| `npm audit --omit=dev --audit-level=high` | Pass | Production dependency audit is clean after `sqlite3` was upgraded to `6.0.1`. |

## Local Artifact Proof

Unsigned `0.4.1` dry-run artifacts were generated under `release/`:

- `Plexus-0.4.1-mac-arm64.dmg`
- `Plexus-0.4.1-mac-arm64.zip`
- `Plexus-0.4.1-mac-arm64.dmg.blockmap`
- `Plexus-0.4.1-mac-arm64.zip.blockmap`
- `latest-mac.yml`

Local `latest-mac.yml` reports `version: 0.4.1`.

The live OTA feed at `https://plexus-upgrade.thoughtseed.space/plexus/latest-mac.yml`
still reports `version: 0.4.0`, confirming that a signed `0.4.1` upload will be
a valid OTA update path.

## Release Workflow State

- GitHub release workflow exists at `.github/workflows/release.yml`.
- Required secret names are configured: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`.
- Latest GitHub release is `v0.4.0`.
- Existing tags include `v0.4.0`, `v0.3.4`, `v0.3.3`, `v0.3.2`, `v0.3.1`,
  `v0.3.0`, and `v0.2.0`.
- There are no open PRs.
- Open realtime proof issues remain: #22, #23, #24, #25, and #26.

## Blocking Gaps Before OTA

1. **Dirty tree must be committed/tagged cleanly.**
   The current `main` worktree contains many modified files plus untracked
   evidence/docs/components. Do not tag/release until the intended files are
   reviewed, staged, and committed.

2. **Runtime degradation proof is incomplete.**
   `docs/evidence/2026-06-19-resilience-smoke-matrix.md` still marks several
   required cases as needing runtime proof: Paperclip offline, Worker offline or
   Access expired, repo-required rejection, verified-cache offline work, media or
   closeout failure, and logout during active room cleanup.

3. **True signed OTA proof still required.**
   The dry-run proves unsigned local packaging only. The release is not done until
   a signed `0.4.0` install updates to signed `0.4.1` through Settings:
   check, download, install, restart, and confirm the relaunched version.

4. **Runtime proof is not enforced by GitHub Actions.**
   CI and Release now run lint plus the no-placeholder scan, but live screenshots
   and signed OTA proof remain manual evidence gates.

## Resolved In 0.4.1 Prep

- `package.json` and `package-lock.json` now report `0.4.1`.
- `sqlite3` upgraded to `6.0.1`; production high-severity audit is clean.
- ESLint installed and configured; `npm run lint` passes.
- CI and Release workflows now run lint and the no-placeholder scan.
- Local unsigned dry-run packaging emits `0.4.1` OTA metadata.

## Recommended Next Steps

1. Review and stage only intended modified/untracked files.
2. Capture the missing runtime proof screenshots/smoke records.
3. Commit, tag `v0.4.1`, push tag, watch the Release workflow, then perform true
   signed OTA upgrade proof from the installed prior signed app.
