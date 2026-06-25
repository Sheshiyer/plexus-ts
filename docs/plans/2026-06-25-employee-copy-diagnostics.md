# Employee Copy And Diagnostics Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strip employee-facing Plexus copy down to useful work language while moving raw endpoints, URLs, prompt text, and troubleshooting metadata into an admin-only diagnostics surface.
**Architecture:** Employee components keep concise state/action copy and stop rendering implementation details. `AdminDemoPanel` becomes the diagnostics home for raw worker, bridge, update, fabric, vault, and prompt/config details, reusing existing IPC data where possible and adding one typed diagnostics snapshot only if necessary.
**Tech Stack:** Electron main/preload IPC, React 18 renderer, TypeScript shared types, existing Plexus UI primitives, ESLint, `tsc`, Vite.

---

## What I Understand

Plexus has accumulated operator, developer, and prompt-construction language inside pages that employees see. The next OTA should feel more like a calm employee workspace and less like a debug console.

The employee-facing app should answer: what is my account state, what work is ready, what needs attention, and what action can I take next?

The admin-facing app should answer: which endpoint, feed, bridge, route, local helper, vault path, token expiry, event payload, source path, or prompt/config detail do I need to debug?

This means we should not delete useful technical information. We should move it behind the existing admin-only route and label it as diagnostics, while removing URLs, endpoints, raw prompts, copied instructions, internal IDs, and meta descriptions from employee surfaces.

## Hard Boundaries

- Employee UI must not show raw endpoints, feed URLs, bridge URLs, port numbers, vault source paths, prompt instructions, route names, raw payload JSON, or pasted implementation notes.
- Admin diagnostics may show technical details, but it must not expose actual secret token values.
- The existing admin route is role-gated in `src/renderer/App.tsx`; preserve that gate and place diagnostics behind it.
- Preserve current contracts unless one small typed diagnostics snapshot is clearly simpler than duplicating calls.
- This pass is copy and information architecture cleanup before OTA, not a release-process rewrite.

## Employee Copy Standard

Use employee language:

- "Account" instead of "Identity Credential".
- "Workspace connection" instead of "Session Proof".
- "Task assignments" instead of "Hermes tasks".
- "Local helpers" instead of "local agent-orchestration health & telemetry".
- "App update" instead of "Release feed".
- "Profile and preferences" instead of "operator character sheet".
- "Add project" instead of "Manual project resolver".

Avoid employee-facing terms:

- endpoint, route, URL, feed URL, worker endpoint, bridge API URL, token expiry, raw payload, event payload, port, latency, telemetry, source path, repo root, resolver cache, Meshy prompt, prompt instructions, Cloudflare Access implementation details, Paperclip bridge implementation details.

## Task 1: Add Copy Boundary Audit Script

**Files:**

- Create `scripts/audit-employee-copy.mjs`
- Modify `package.json`

**Steps:**

1. Create an audit script that scans employee-facing renderer files for banned dev-noise patterns.
2. Include these employee files:
   - `src/renderer/components/Login.tsx`
   - `src/renderer/components/Onboarding.tsx`
   - `src/renderer/components/Settings.tsx`
   - `src/renderer/components/AgentFabricPanel.tsx`
   - `src/renderer/components/ProjectManager.tsx`
   - `src/renderer/components/PreferencesPanel.tsx`
   - `src/renderer/components/AgentSessionsPanel.tsx`
   - `src/renderer/components/AgentSessionFocusRail.tsx`
3. Allow the same patterns inside admin diagnostics files:
   - `src/renderer/components/AdminDemoPanel.tsx`
   - `src/renderer/components/AdminDiagnosticsPanel.tsx`
4. Start with these banned patterns:
   - `https?://`
   - `endpoint`
   - `Worker endpoint`
   - `bridgeApiUrl`
   - `feedUrl`
   - `Runtime endpoints`
   - `telemetry`
   - `sourcePath`
   - `repoRoot`
   - `local resolver cache`
   - `Paperclip bridge`
   - `Meshy image prompt`
   - `Copy Prompt`
   - `Use Generated`
   - `Prompt for`
   - `raw payload`
   - `event payload`
5. Print filename, line number, and matched term for every violation.
6. Add `copy:audit` to `package.json`.
7. Run `node scripts/audit-employee-copy.mjs`; expect failure before cleanup.
8. Run `npm run copy:audit`; expect failure before cleanup.

**Commit:** `test: add employee copy boundary audit`

## Task 2: Add Admin Diagnostics Surface

**Files:**

- Create `src/renderer/components/AdminDiagnosticsPanel.tsx`
- Modify `src/renderer/components/AdminDemoPanel.tsx`

**Steps:**

1. Add `AdminDiagnosticsPanel` with compact sections and copyable values.
2. Keep the panel reachable only through the existing admin tab.
3. Add sections for:
   - Session and workspace diagnostics.
   - Worker and update diagnostics.
   - Thoughtseed Bridge diagnostics.
   - Local helper and fabric diagnostics.
   - Vault and project resolver diagnostics.
   - Prompt/config diagnostics when prompt text must be preserved.
4. Use existing IPC calls first:
   - `window.plexus.workerConfigGet`
   - `window.plexus.workerStatus`
   - `window.plexus.updatesGetStatus`
   - `window.plexus.thoughtseedBridgeStatus`
   - `window.plexus.fabricStatus`
   - `window.plexus.projectScanVault`
5. Render diagnostics errors as admin-only warnings, not employee-facing toasts.
6. Do not render bearer tokens, invite secrets, session tokens, or refresh tokens.

**Verify:**

- `npm run typecheck`
- `npm run lint`

**Commit:** `feat: add admin diagnostics panel`

## Task 3: Simplify Login And Onboarding Copy

**Files:**

- Modify `src/renderer/components/Login.tsx`
- Modify `src/renderer/components/Onboarding.tsx`

**Steps:**

1. Remove the visible implementation language around Cloudflare Access, Paperclip, agent fabric, runtime failure, and repo coverage.
2. Change the sign-in button to `Continue with Thoughtseed email`.
3. Change login support copy to explain the employee action, not the authentication provider.
4. Rename onboarding steps to:
   - `Connect account`
   - `Set preferences`
   - `Check local helpers`
   - `Review readiness`
5. Replace runtime/provider language with workspace, work proof, local helper, and update language.
6. Keep any needed debug detail available through admin diagnostics.

**Verify:**

- `npm run copy:audit` should still fail until later tasks.
- `npm run typecheck`

**Commit:** `copy: simplify login and onboarding language`

## Task 4: Simplify Settings Copy And Move Settings Diagnostics

**Files:**

- Modify `src/renderer/components/Settings.tsx`
- Modify `src/renderer/components/AdminDiagnosticsPanel.tsx`

**Steps:**

1. Change the page subtitle from `system calibration` to `workspace preferences`.
2. Replace calibration prompts:
   - `Confirm Access and Worker proof.` -> `Confirm your workspace is connected.`
   - `Bind Cambium bridge credentials.` -> `Connect task updates.`
   - `Check OTA feed readiness.` -> `Check for app updates.`
   - `Run local member provisioning.` -> `Check optional local helpers.`
3. Rename employee sections:
   - `Identity Credential` -> `Account`
   - `Session Proof` -> `Workspace connection`
   - `Thoughtseed Bridge` -> `Task updates`
   - `Release feed` -> `App update`
4. Remove employee `DatumRail` rows for worker endpoint, employee id, identity id, bridge endpoint, feed URL, tenant, token expiry, and last seen.
5. Remove the raw directive payload stream from employee Settings.
6. Replace raw bridge actions with employee actions:
   - `Connect task updates`
   - `Sync now`
   - `Mark updates read`
7. Add the removed endpoint/feed/bridge/token-expiry fields to admin diagnostics.

**Verify:**

- `npm run copy:audit` should still fail until later tasks.
- `npm run typecheck`

**Commit:** `copy: clean employee settings and relocate diagnostics`

## Task 5: Simplify Preferences And Prompt UI

**Files:**

- Modify `src/renderer/components/PreferencesPanel.tsx`
- Modify `src/renderer/components/AdminDiagnosticsPanel.tsx`

**Steps:**

1. Rename the page from `operator character sheet` to `profile`.
2. Rename `Member loadout profile` to `Profile and preferences`.
3. Replace `Plexus operator` with `Member profile`.
4. Remove employee-facing raw prompt controls:
   - `Meshy image prompt`
   - `Copy Prompt`
   - `Use Generated`
   - prompt textarea title text
5. Preserve any generated prompt text in admin diagnostics if it is needed for support.
6. Replace `Anything else the agent fabric should know` with `Notes for your work profile`.
7. Replace `Preference bundle` with `Preference summary`.
8. Keep preference data contracts intact.

**Verify:**

- `npm run copy:audit` should still fail until later tasks.
- `npm run typecheck`

**Commit:** `copy: simplify profile preferences and hide raw prompts`

## Task 6: Simplify Projects Copy

**Files:**

- Modify `src/renderer/components/ProjectManager.tsx`
- Modify `src/renderer/components/AdminDiagnosticsPanel.tsx`

**Steps:**

1. Change `GitHub-backed work surfaces` to `projects ready for work tracking`.
2. Change `Manual project resolver` to `Add project`.
3. Change `local resolver cache` to `local project list`.
4. Change `time row` to `work record`.
5. Hide vault source paths, repo roots, source candidates, and resolver internals from employee cards.
6. Add vault repo root, candidate source paths, and resolver status to admin diagnostics.
7. Keep employee import actions focused on selecting or adding assigned projects.

**Verify:**

- `npm run copy:audit` should still fail until later tasks.
- `npm run typecheck`

**Commit:** `copy: simplify project management language`

## Task 7: Simplify Agent And Fabric Copy

**Files:**

- Modify `src/renderer/components/AgentFabricPanel.tsx`
- Modify `src/renderer/components/AdminDiagnosticsPanel.tsx`

**Steps:**

1. Change `local agent-orchestration health & telemetry` to `task updates and local helper status`.
2. Hide the `Runtime endpoints` port tiles from employees.
3. Replace port, latency, bridge reachability, member id, and setup output with a simple local-helper status.
4. Rename `Hermes tasks` to `Task assignments`.
5. Hide task ids, event counts, raw history, raw payload status, and internal evidence statuses.
6. Replace admin override copy with `Choose how you'll handle this task. Ask an admin to change it later.`
7. Replace proof placeholders with employee language like `Link to proof or add a short note`.
8. Add the removed ports, latency, bridge status, raw event history, and setup output to admin diagnostics.

**Verify:**

- `npm run copy:audit` should still fail until the admin completeness pass.
- `npm run typecheck`

**Commit:** `copy: simplify task and local helper language`

## Task 8: Admin Diagnostics Completeness Pass

**Files:**

- Modify `src/renderer/components/AdminDiagnosticsPanel.tsx`
- Modify `src/renderer/components/AdminDemoPanel.tsx`

**Steps:**

1. Confirm every technical field removed from employee UI appears in admin diagnostics when available:
   - worker base URL
   - update feed URL and channel
   - bridge API URL
   - bridge tenant
   - bridge token expiry
   - bridge last seen
   - directive raw JSON and history counts
   - fabric ports and latency
   - local bridge reachability
   - vault repo root
   - project source paths
   - prompt/config text needed for support
2. Add grouped loading and empty states.
3. Add copy buttons for long technical values.
4. Confirm no secret token values render.
5. Confirm the diagnostics page is reachable only for `session.role === 'admin'`.

**Verify:**

- `npm run copy:audit` should pass.
- `npm run typecheck`
- `npm run lint`

**Commit:** `feat: complete admin diagnostics relocation`

## Task 9: Docs And Release Evidence

**Files:**

- Modify `CHANGELOG.md`
- Create `docs/evidence/2026-06-25-employee-copy-diagnostics.md`

**Steps:**

1. Record the employee copy cleanup.
2. Record the admin diagnostics relocation.
3. Record any intentionally preserved admin-only technical fields.
4. Add the command evidence for copy audit, typecheck, lint, and renderer build.

**Verify:**

- `npm run copy:audit`
- `npm run typecheck`
- `npm run lint`
- `npm run build:renderer`

**Commit:** `docs: record employee copy diagnostics evidence`

## Task 10: Visual QA Before OTA

**Files:**

- Create `docs/evidence/2026-06-25-employee-copy-diagnostics-screenshots.md`
- Add screenshots under `docs/evidence/screenshots/` if the repo already stores evidence images there.

**Steps:**

1. Capture employee screenshots for:
   - Login
   - Onboarding
   - Settings
   - Preferences
   - Projects
   - Task assignments/local helpers
2. Capture admin screenshot for diagnostics.
3. Confirm employee screenshots do not show raw endpoints, URLs, prompt instructions, payloads, port numbers, vault paths, or provider/debug implementation text.
4. Confirm admin diagnostics includes the details needed by an operator before OTA.
5. Fix any copy regressions found during screenshots.

**Verify:**

- Visual review of all screenshots.
- `npm run copy:audit`
- `npm run typecheck`

**Commit:** `test: add visual evidence for employee copy cleanup`

## Definition Of Done

- `npm run copy:audit` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build:renderer` passes.
- Employee-facing screens show plain work language and no raw implementation details.
- Admin diagnostics shows the technical fields needed for OTA support.
- No actual secret values are rendered anywhere.
- The app still preserves operator troubleshooting value without leaking it into employee workflows.

