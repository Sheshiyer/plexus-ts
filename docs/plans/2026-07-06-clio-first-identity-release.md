# Clio First Identity Release Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Clio the front-facing identity layer for Plexus 0.5.0 while keeping Fabric and Paperclip as optional helpers that never gate core identity readiness.

**Architecture:** Keep the release renderer-first and model-first. Add pure identity model contracts in `src/renderer/identityLoadout.ts`, then make Identity, Settings, Agent Sessions, and shell copy consume that language without changing Electron IPC or helper transport behavior. Preserve proof requirements for work evidence, but separate proof health from Clio availability.

**Tech Stack:** Electron, React 18, TypeScript, Vite, Vitest, existing Plexus UI primitives. No new dependencies.

---

### Task 1: Identity model contract

**Files:**
- Create: `test/identity/clio-identity-loadout.test.ts`
- Modify: `vitest.config.mjs`
- Modify: `package.json`
- Modify: `src/renderer/identityLoadout.ts`

**Step 1: Write the failing test**

Create tests that assert:
- `buildIdentitySkills` does not include `fabric-command`.
- Missing Fabric/Paperclip does not create warning/error helper skills.
- `buildIdentityPerks` exposes helper status as optional, not locked.
- A new Clio scaffold helper names Clio as the front-facing identity.

**Step 2: Run test to verify it fails**

Run: `npm run test:identity`

Expected: FAIL because `test:identity` and the Clio scaffold do not exist yet.

**Step 3: Wire the test command**

Add `test:identity` to `package.json` and include `test/identity/**/*.test.ts` in `vitest.config.mjs`.

**Step 4: Implement minimal model changes**

In `src/renderer/identityLoadout.ts`:
- Replace the `fabric-command` skill with `clio-memory`.
- Add `statusLabel` to `IdentityPerk`.
- Add `AgentIdentityScaffold` plus `buildAgentIdentityScaffold`.
- Keep helper posture optional: `optional_available`, `optional_paused`, or `optional_unavailable`.

**Step 5: Run test to verify it passes**

Run: `npm run test:identity`

Expected: PASS.

**Step 6: Commit**

```bash
git add package.json vitest.config.mjs src/renderer/identityLoadout.ts test/identity/clio-identity-loadout.test.ts
git commit -m "feat(identity): model Clio first optional helpers"
```

### Task 2: Identity page copy and helper posture

**Files:**
- Create: `test/identity/clio-identity-copy.test.ts`
- Modify: `src/renderer/components/IdentityPanel.tsx`

**Step 1: Write the failing test**

Create a source-level copy guard that asserts:
- Identity page contains `Clio identity`.
- Identity page contains `optional helpers`.
- Identity page does not contain `Unlocked capabilities`, `locked`, `unlocked`, `Fabric Command`, or `paperclip companions`.

**Step 2: Run test to verify it fails**

Run: `npm run test:identity`

Expected: FAIL while old copy is still present.

**Step 3: Update Identity UI**

In `IdentityPanel.tsx`:
- Page subtitle: `Clio identity`.
- Loading copy: `Reading Clio identity scaffold`.
- Hero label: `Clio identity`.
- Skill panel: `Clio identity signals`.
- Perk panel: `Identity posture`.
- Companion panel: `Optional local helpers`.
- Helper unavailable state: calm optional/offline copy, not degraded/gated language.

**Step 4: Run test to verify it passes**

Run: `npm run test:identity`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/IdentityPanel.tsx test/identity/clio-identity-copy.test.ts
git commit -m "feat(identity): make Clio front-facing"
```

### Task 3: Shell, Settings, and local memory language

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/ConnectionStatus.tsx`
- Modify: `src/renderer/components/AgentSessionsPanel.tsx`
- Modify: `src/renderer/components/Settings.tsx`
- Modify: `test/identity/clio-identity-copy.test.ts`

**Step 1: Extend the copy guard**

Assert:
- App navigation says `Clio Memories` instead of `Agent Sessions`.
- Assistant status button user-facing copy says `Clio`.
- Settings helper summary uses optional status, not blocked/ready gating.

**Step 2: Run test to verify it fails**

Run: `npm run test:identity`

Expected: FAIL on old shell and Settings copy.

**Step 3: Update copy only**

Make safe renderer copy changes:
- App tab: `Clio Memories`, hint `local agent context`.
- Assistant status button labels/titles/aria: `Clio`.
- Agent sessions page title: `Clio Memories`, subtitle `local agent context`.
- Settings helper section: optional/check wording; errors show as `attention`, not identity blockers.

**Step 4: Run test to verify it passes**

Run: `npm run test:identity`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/ConnectionStatus.tsx src/renderer/components/AgentSessionsPanel.tsx src/renderer/components/Settings.tsx test/identity/clio-identity-copy.test.ts
git commit -m "feat(identity): align Clio release copy"
```

### Task 4: Documentation and release checks

**Files:**
- Create: `docs/clio-identity.md`
- Create: `docs/optional-helpers.md`

**Step 1: Write docs**

Document:
- Clio is the front-facing assistant identity.
- Local memories are consent-based context.
- Fabric/Paperclip helpers are optional accelerators.
- Work proof remains evidence quality, not identity availability.

**Step 2: Run verification**

Run:
```bash
npm run test:identity
npm run test:assistant
npm run test:coworking
npm run typecheck
npm run lint
npm run release:ota:prep
```

Expected: all pass.

**Step 3: Commit**

```bash
git add docs/clio-identity.md docs/optional-helpers.md
git commit -m "docs(identity): document Clio identity and optional helpers"
```

### Task 5: Release hygiene

**Files:**
- No code changes expected.

**Step 1: Inspect git state**

Run: `git status --short --branch`

Expected: clean branch after commits.

**Step 2: Push feature branch only**

Run: `git push origin sheshiyer-silver-goggles`

Expected: branch pushes. Do not create `v0.5.0` tag or push `main` from this worktree.
