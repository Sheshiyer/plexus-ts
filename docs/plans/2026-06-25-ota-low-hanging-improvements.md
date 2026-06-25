# OTA Low-Hanging Improvements Review

> **For Codex:** Use `superpowers:dispatching-parallel-agents` for implementation batches. Split work by disjoint file ownership and run verification after each batch.

**Date:** 2026-06-25  
**Branch reviewed:** `codex/employee-copy-diagnostics`  
**Goal:** Identify 30-40 low-hanging improvements that can be executed before the next Plexus OTA release.  
**App utility:** Plexus is a native employee/admin work coordination shell. It turns projects, focus sessions, manual work records, agent/CLI work, co-working presence, GitHub activity, and Fabric task reports into reviewable proof for standups, admin visibility, and release handoff.

## Current State

- Copy and diagnostics cleanup is already implemented on this branch.
- Core gates passed after that cleanup: `npm run copy:audit`, `npm run typecheck`, `npm run lint`, and `npm run build:renderer`.
- Current working tree still has pre-existing uncommitted Settings/theme layout edits:
  - `src/renderer/components/Settings.tsx`
  - `src/renderer/theme.css`
- This review did not edit product code.

## Recommended OTA Execution Order

1. Release safety and proof repeatability.
2. Admin/bridge/security hardening.
3. Evidence/date correctness and project proof freshness.
4. Employee workflow polish and visual/accessibility cleanup.
5. Product vocabulary/docs refresh and final screenshot QA.

## P0: Release Safety And Security

| # | Improvement | Files | Effort | Risk | Verification |
|---|-------------|-------|--------|------|--------------|
| 1 | Fail tag releases when R2 upload is disabled | `.github/workflows/release.yml`, `docs/OTA_RELEASE.md` | S | Low | Tag workflow with missing R2 secrets fails before GitHub Release success. |
| 2 | Add post-upload public feed verification | `.github/workflows/release.yml`, `scripts/prepare-ota-release.mjs` | S | Low | Workflow curls `latest-mac.yml` and asserts version/path/sha match tag artifacts. |
| 3 | Make prep script clearly fail on already released versions | `scripts/prepare-ota-release.mjs`, `package.json` | S | Low | Running prep on an already tagged version says “bump package version first.” |
| 4 | Add a signed OTA proof template per release | `docs/evidence/`, `docs/OTA_RELEASE.md` | S | Low | Release evidence records prior install version, workflow URL, feed output, check/download/install/restart proof. |
| 5 | Add main-process admin authorization guards | `src/main/main.ts`, `src/renderer/App.tsx` | S/M | Low | Non-admin calls to `adminDemo:*` fail with forbidden; admin calls still pass. |
| 6 | Move Access JWT back to secure storage | `src/main/teamforge.ts`, `src/main/thoughtseed-bridge.ts` | M | Med | SQLite has no plaintext `tf.accessJwt`; login, refresh, logout, and expiry clearing work. |
| 7 | Validate Worker base URL before storing | `src/main/teamforge.ts`, `src/main/thoughtseed-bridge.ts` | S | Low/Med | Reject external `http://`, accept default HTTPS, allow localhost only in dev. |
| 8 | Redact copyable diagnostic payloads | `src/renderer/components/AdminDiagnosticsPanel.tsx` | S | Low | Seed token-like fields and confirm rendered/copied text is redacted. |
| 9 | Redact and bound local helper health output | `src/main/fabric.ts`, `src/shared/types.ts` | S | Low | Token-like helper output is truncated/redacted while exit code remains visible. |
| 10 | Make diagnostics passive by default | `src/renderer/components/AdminDiagnosticsPanel.tsx`, `src/main/main.ts` | M | Low | Opening diagnostics offline performs no bridge directive poll until explicit action. |

## P1: OTA Runtime And Diagnostics

| # | Improvement | Files | Effort | Risk | Verification |
|---|-------------|-------|--------|------|--------------|
| 11 | Expose OTA readiness reasons | `src/main/updates.ts`, `src/shared/types.ts`, `AdminDiagnosticsPanel.tsx` | S | Low | Unsigned preview shows packaged/signature/force-check/feed-source blockers. |
| 12 | Add explicit `installing` update state | `src/main/updates.ts`, `src/shared/types.ts`, `Settings.tsx` | S | Med | Install action shows installing and disables repeated actions before relaunch. |
| 13 | Persist short update event history for diagnostics | `src/main/updates.ts`, `AdminDiagnosticsPanel.tsx` | M | Low | Bad feed URL leaves timestamped check/error/feed/version events. |
| 14 | Deduplicate no-placeholder release scan | `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `scripts/prepare-ota-release.mjs` | S | Low | CI, Release, and local prep call the same script with identical output. |
| 15 | Align CI typecheck command with package script | `.github/workflows/ci.yml`, `package.json` | S | Low | CI uses `npm run typecheck`, matching local/release docs. |
| 16 | Update OTA docs from old fixed gates to rolling gates | `docs/OTA_RELEASE.md`, `docs/evidence/2026-06-19-ota-gap-analysis.md` | S | Low | Old version strings only appear as archived context. |
| 17 | Add bridge fetch timeouts | `src/main/thoughtseed-bridge.ts` | S | Low | Blackhole endpoint returns timeout error within target window. |
| 18 | Make bridge status decrypt-aware and clear stale disconnect state | `src/main/thoughtseed-bridge.ts` | M | Low | Corrupt bridge token reports disconnected; disconnect clears member/token/task cache. |
| 19 | Queue or rollback Fabric reports on upstream failure | `src/main/thoughtseed-bridge.ts`, `src/main/main.ts` | M | Med | Mocked 500 leaves pending sync or rolls back with redacted handoff evidence. |

## P1: Evidence, Reports, And Proof Correctness

| # | Improvement | Files | Effort | Risk | Verification |
|---|-------------|-------|--------|------|--------------|
| 20 | Fix local-day boundaries | `Timer.tsx`, `TimeEntryList.tsx`, `ExportPanel.tsx`, `src/main/main.ts` | M | Med | Seed entries near local midnight and compare timer, records, reports, export, evidence totals. |
| 21 | Align monthly report totals and breakdowns | `Reports.tsx`, `src/main/main.ts` | M | Med | Month starting midweek reconciles total, project breakdown, and evidence seconds. |
| 22 | Expose GitHub proof refresh in records/reports | `preload.ts`, `src/main/main.ts`, `TimeEntryList.tsx`, `Reports.tsx` | M | Low | Sync known activity and confirm pending entries become matched. |
| 23 | Auto-refresh evidence after creating work records | `src/main/main.ts`, `src/main/agent-sessions.ts` | M | Med | New manual/agent record overlapping GitHub activity becomes matched without manual refresh. |
| 24 | Make proof status explain itself | `TimeEntryList.tsx`, `ExportPanel.tsx`, `src/main/evidence.ts` | S | Low | Fixtures for each evidence state show checked-at, activity count/link, and failure reason. |
| 25 | Return exact project verification errors | `ProjectManager.tsx`, `src/main/teamforge.ts` | S | Low | Invalid URL, private repo, Worker failure, and public fallback show distinct next action. |
| 26 | Make exports self-describing proof bundles | `ExportPanel.tsx`, `src/main/evidence.ts` | S | Low | CSV/JSON includes generated-at, timezone/range, totals, and evidence summary. |
| 27 | Prefill timer from default or only verified project | `Timer.tsx`, `src/shared/types.ts` | S | Low | Default/only verified project is selected automatically; user only adds note. |
| 28 | Attach co-working closeouts to work records | `CoWorkingPanel.tsx` | M | Med | Active timer plus project-room closeout links meeting to the current entry. |

## P2: Employee Workflow Polish

| # | Improvement | Files | Effort | Risk | Verification |
|---|-------------|-------|--------|------|--------------|
| 29 | Show why task-update actions are disabled | `Settings.tsx`, `AgentFabricPanel.tsx` | S | Low | Disconnected bridge fixture shows inline reason and reconnect CTA. |
| 30 | Route waiting updates to Task Assignments | `Settings.tsx`, `App.tsx` | S | Low | Waiting task updates CTA opens Task Assignments without losing state. |
| 31 | Add proof requirement helper before Done | `AgentFabricPanel.tsx` | S | Low | Empty draft explains note/proof requirement; adding note enables Done. |
| 32 | Display submitted proof details, not just “added” | `AgentFabricPanel.tsx` | M | Low | Fixture task renders proof type, value, and strength chips. |
| 33 | Add stale-time context to scans and syncs | `ProjectManager.tsx`, `AgentSessionsPanel.tsx` | S | Low | Successful scan/sync shows “last checked” timestamp. |
| 34 | Unify Agent Sessions panel and focus rail outcomes | `AgentSessionsPanel.tsx`, `AgentSessionFocusRail.tsx` | S | Low | Accept/dismiss from either surface shows matching success/error copy. |
| 35 | Warn before continuing past required onboarding | `Onboarding.tsx` | S | Low | Required-open session shows non-blocking warning before entering app. |
| 36 | Confirm destructive rhythm deletion | `PreferencesPanel.tsx`, `Onboarding.tsx` | S | Low | Delete opens confirm; cancel preserves rhythm settings. |
| 37 | Improve login failure recovery copy | `Login.tsx` | S | Low | Mocked failed login suggests retry plus checking Thoughtseed email/browser approval. |
| 38 | Add focus-visible states for keyboard navigation | `theme.css` | S | Low | Tab through app at 1040x700 and every actionable control has visible focus. |
| 39 | Refresh stale product vocabulary before OTA | `README.md`, `CHANGELOG.md`, docs | S | Low | Active docs stop using stale `MultiCA`/`src/main/db.ts` vocabulary except archived context. |

## Suggested First Batch

These are the safest first batch for immediate OTA hardening:

1. Fail tag releases when R2 upload is disabled.
2. Add post-upload public feed verification.
3. Add signed OTA proof template.
4. Deduplicate no-placeholder release scan.
5. Align CI typecheck command with package script.
6. Redact copyable diagnostic payloads.
7. Redact and bound local helper output.
8. Validate Worker base URL before storing.
9. Add bridge fetch timeouts.
10. Show why task-update actions are disabled.
11. Add proof requirement helper before Done.
12. Improve login failure recovery copy.

## Verification Set For Any Implementation Batch

- `npm run copy:audit`
- `npm run typecheck`
- `npm run lint`
- `npm run build:renderer`
- Relevant smoke or workflow proof for release/bridge/evidence changes.

