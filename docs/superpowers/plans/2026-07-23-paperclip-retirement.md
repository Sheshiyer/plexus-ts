# Paperclip Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Paperclip optional-helpers surface from plexus-ts, repoint the closeout handoff and standup preference to the Hermes/Telegram channel path, with zero change to daily-update delivery (already Worker/bridge + Hermes cron).

**Architecture:** Pure removal + copy repointing. Wire contract preserved: `sendToPaperclip`, meeting `paperclipStatus`, retry kinds, and the bridge `'paperclip'` source stay. No new network code.

**Tech Stack:** Electron/TypeScript, vitest node env (pure-logic + source-assertion tests).

**Spec:** `docs/superpowers/specs/2026-07-23-paperclip-retirement-design.md`

## Global Constraints

- No user-visible "Paperclip" strings remain in renderer copy after Task 3 (code identifiers for wire fields exempt: `sendToPaperclip`, `paperclipStatus`, retry kinds, bridge source union).
- Keep parsing/sending: `sendToPaperclip` request field, meeting `paperclipStatus`, retry kinds `paperclip_closeout`/`paperclip_memory`, `'paperclip'` in `thoughtseed-fabric-task.ts` source union.
- No new dependencies; no Telegram client or tokens in this repo.
- Standup preference migration: stored `'paperclip'` reads as `'telegram'`; new default `'telegram'`.
- Verify with `npx vitest run` + `npx tsc --noEmit -p .` before every commit.
- Exploration line refs (fabric.ts, main.ts ~1763-1765, preload.ts ~113-115, teamforge.ts ~528/~988-989/~1083-1107, assistant-context.ts ~198/236/294-296/764-766, assistant-runtime.ts ~188/198/206, Settings.tsx ~1076-1079/~1324, IdentityPanel.tsx ~135-141/~332-350, PreferencesPanel.tsx ~347-353, identityLoadout.ts ~145, main.ts ~806 `paperclipStatus` snapshot, ~1476/~1519 enrichment setting) are pre-drift hints — ALWAYS re-grep before editing.

---

### Task 1: Main-process + shared-types removal

**Files:**
- Delete: `src/main/fabric.ts`
- Modify: `src/main/main.ts`, `src/preload/preload.ts`, `src/main/teamforge.ts`, `src/main/assistant-context.ts`, `src/main/assistant-runtime.ts`, `src/shared/types.ts`
- Test: `test/paperclip/retirement.test.ts` (new), update any failing existing tests

**Interfaces:**
- Produces: main process free of `fabric.ts` imports; `PlexusAPI` without `fabricStatus`/`fabricHealthProbe`/`fabricInstallStatus`; assistant context without `optionalHelpers`.

- [ ] **Step 1: Write the failing source-assertion test**

```ts
// test/paperclip/retirement.test.ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('paperclip retirement — main process', () => {
  it('fabric.ts is deleted and unreferenced', () => {
    expect(existsSync(resolve(process.cwd(), 'src/main/fabric.ts'))).toBe(false);
    expect(source('src/main/main.ts')).not.toContain("from './fabric");
  });

  it('fabric IPC channels and preload methods are gone', () => {
    expect(source('src/main/main.ts')).not.toContain("'fabric:");
    expect(source('src/preload/preload.ts')).not.toContain('fabric');
    expect(source('src/shared/types.ts')).not.toContain('fabricInstallStatus');
  });

  it('assistant context and prompt no longer reference Paperclip', () => {
    expect(source('src/main/assistant-context.ts')).not.toMatch(/paperclip/i);
    expect(source('src/main/assistant-runtime.ts')).not.toMatch(/paperclip/i);
  });

  it('wire-contract fields survive', () => {
    expect(source('src/shared/types.ts')).toContain('sendToPaperclip');
    expect(source('src/shared/types.ts')).toContain('paperclipStatus');
    expect(source('src/shared/thoughtseed-fabric-task.ts')).toContain("'paperclip'");
  });
});
```

- [ ] **Step 2: Run to see RED** — `npx vitest run test/paperclip/retirement.test.ts` — expect first three tests FAIL, fourth PASS.

- [ ] **Step 3: Remove, guided by grep**

Work through `grep -rn "fabric\|[Pp]aperclip" src/main/ src/preload/ src/shared/` hit by hit:
- Delete `src/main/fabric.ts`.
- `main.ts`: remove the three `fabric:*` `ipcMain.handle` blocks, the `./fabric` import, the assistant-snapshot `paperclipStatus` mapping (~806), and the `assistantPaperclipEnrichmentEnabled` setting read/write (~1476/~1519). KEEP the retry-ledger kinds `paperclip_closeout`/`paperclip_memory` and the closeout queueing (~1811-1827) — they serve the (renamed) channel handoff.
- `preload.ts`: remove `fabricStatus`, `fabricHealthProbe`, `fabricInstallStatus`.
- `teamforge.ts`: remove the `paperclip` onboarding step default (~528), `tf.paperclipRepoRoot`/`tf.paperclipCompanyId` writes (~988-989), and `syncMemberContext()` (~1083-1107) plus callers (grep `syncMemberContext`).
- `assistant-context.ts`: remove `optionalHelpers` plumbing entirely if paperclip was its only member (grep `optionalHelpers` first; if another helper exists, remove only the paperclip entry).
- `assistant-runtime.ts`: delete the three "Paperclip is optional helper context" prompt lines.
- `types.ts`: remove `PaperclipInstallStatus`, `PaperclipPortConfig`, `optionalHelperProof`, the three fabric API methods. KEEP `sendToPaperclip` + meeting `paperclipStatus` + retry kinds.

- [ ] **Step 4: GREEN + full suite** — `npx vitest run test/paperclip/retirement.test.ts && npx vitest run && npx tsc --noEmit -p .`. Renderer files still referencing removed APIs will fail tsc — that is Task 2's scope; if tsc cannot pass without touching renderer files, note it and make ONLY the minimal renderer edits needed for compilation (delete the calls), leaving copy/UI restructure to Task 2. Existing tests asserting fabric behavior: update or delete per their intent (list each in the report).

- [ ] **Step 5: Commit** — `git add -A src test && git commit -m "refactor(paperclip): remove main-process fabric runtime and helper plumbing"`

---

### Task 2: Renderer removal

**Files:**
- Delete: `src/renderer/components/AgentFabricPanel.tsx`
- Modify: `src/renderer/App.tsx` (route/tab if any), `src/renderer/components/Onboarding.tsx`, `Settings.tsx`, `IdentityPanel.tsx`, `AssistantContextDrawer.tsx`, `AssistantPanel.tsx`
- Test: extend `test/paperclip/retirement.test.ts`

- [ ] **Step 1: Failing assertions**

```ts
describe('paperclip retirement — renderer', () => {
  it('AgentFabricPanel is deleted and unrouted', () => {
    expect(existsSync(resolve(process.cwd(), 'src/renderer/components/AgentFabricPanel.tsx'))).toBe(false);
    expect(source('src/renderer/App.tsx')).not.toContain('AgentFabricPanel');
  });

  it('onboarding, settings, identity lose the helper surfaces', () => {
    expect(source('src/renderer/components/Onboarding.tsx')).not.toContain('PaperclipPreflight');
    expect(source('src/renderer/components/Settings.tsx')).not.toMatch(/paperclip/i);
    expect(source('src/renderer/components/IdentityPanel.tsx')).not.toMatch(/paperclip/i);
  });
});
```

- [ ] **Step 2: RED**, then remove guided by `grep -rn "fabric\|[Pp]aperclip" src/renderer/`:
- Delete `AgentFabricPanel.tsx` + its route/tab/nav entry.
- `Onboarding.tsx`: remove `PaperclipPreflight`, the `paperclip` stepId special copy (`copyForStep`/`iconFor`/`displayNameForStep` branches) and `memberSetup` runner IF paperclip-only (grep `memberSetup`); server-sent unknown steps fall to the existing generic fallback branch.
- `Settings.tsx`: enrichment toggle + "Run helper setup".
- `IdentityPanel.tsx`: helper perks block.
- `AssistantContextDrawer.tsx` + `AssistantPanel.tsx`: remove the `helpers` prop/row and its `fabricStatus`-derived state (the `AssistantOptionalHelperStatus` type too, if unreferenced after).
- CSS: grep `theme.css` for fabric/helper-panel classes now unreferenced; delete confirmed-dead rules only.

- [ ] **Step 3: GREEN + full suite + tsc.** Update existing renderer tests that asserted removed strings (list each in report).

- [ ] **Step 4: Commit** — `git add -A src test && git commit -m "refactor(paperclip): remove renderer helper surfaces"`

---

### Task 3: Repoint closeout + standup preference

**Files:**
- Modify: `src/renderer/components/coworking/StudioStage.tsx` and/or `CoWorkingPanel.tsx` (closeout modal copy — grep `paperclipStatusCopy`, `sendToPaperclip` checkbox), `src/renderer/components/PreferencesPanel.tsx`, `src/renderer/lib/identityLoadout.ts`
- Create: `src/renderer/lib/standup-channel.ts` (migration helper)
- Test: `test/paperclip/standup-channel.test.ts` + extend retirement test

- [ ] **Step 1: Failing tests**

```ts
// test/paperclip/standup-channel.test.ts
import { describe, expect, it } from 'vitest';
import { normalizeStandupChannel, STANDUP_CHANNEL_OPTIONS } from '../../src/renderer/lib/standup-channel';

describe('standup channel migration', () => {
  it('offers plexus and telegram, defaulting to telegram', () => {
    expect(STANDUP_CHANNEL_OPTIONS).toEqual(['plexus', 'telegram']);
    expect(normalizeStandupChannel(undefined)).toBe('telegram');
    expect(normalizeStandupChannel(null)).toBe('telegram');
  });
  it('migrates stored paperclip to telegram', () => {
    expect(normalizeStandupChannel('paperclip')).toBe('telegram');
  });
  it('passes through valid values', () => {
    expect(normalizeStandupChannel('plexus')).toBe('plexus');
    expect(normalizeStandupChannel('telegram')).toBe('telegram');
  });
});
```

Plus in `retirement.test.ts`:

```ts
it('closeout copy says team channel, not Paperclip', () => {
  const stage = source('src/renderer/components/coworking/StudioStage.tsx');
  expect(stage).not.toMatch(/Paperclip/);
  expect(stage).toContain('Send to team channel');
});
```

(Adjust the file if `paperclipStatusCopy`/checkbox live in `CoWorkingPanel.tsx` — grep first, assert the actual host file.)

- [ ] **Step 2: Implement**

```ts
// src/renderer/lib/standup-channel.ts
export const STANDUP_CHANNEL_OPTIONS = ['plexus', 'telegram'] as const;
export type StandupChannel = (typeof STANDUP_CHANNEL_OPTIONS)[number];

/** Stored 'paperclip' values migrate to 'telegram' (Hermes delivers to the TG channel). */
export function normalizeStandupChannel(value: unknown): StandupChannel {
  if (value === 'plexus') return 'plexus';
  return 'telegram';
}
```

- `PreferencesPanel.tsx`: options from `STANDUP_CHANNEL_OPTIONS`, read via `normalizeStandupChannel`, default `'telegram'`.
- `identityLoadout.ts` (~145): `standupChannel === 'paperclip'` branch → telegram copy (e.g. "channel digest"); route through `normalizeStandupChannel` so stored legacy values hit the telegram branch.
- Closeout: checkbox label "Send to team channel", hint "Delivered through Hermes to the team Telegram channel"; `paperclipStatusCopy` strings → "Channel handoff not requested / requested / queued / sent / failed" (function may keep its identifier name — wire field).

- [ ] **Step 3: GREEN + full suite + tsc.**
- [ ] **Step 4: Commit** — `git add -A src test && git commit -m "feat(standup): Hermes/Telegram-first channel copy and preference migration"`

---

### Task 4: Sweep + verification

- [ ] **Step 1:** `grep -rn "[Pp]aperclip" src/ | grep -v "sendToPaperclip\|paperclipStatus\|paperclip_closeout\|paperclip_memory\|thoughtseed-fabric-task"` — every remaining hit must be justified in the report (expected: none, or wire-only).
- [ ] **Step 2:** `grep -rn "fabric" src/ --include="*.ts*" | grep -vi "fabric-task"` — expect zero.
- [ ] **Step 3:** Full `npx vitest run` + `npx tsc --noEmit -p .` green.
- [ ] **Step 4:** Update `docs/optional-helpers.md` if it documents the removed surfaces (mark Paperclip retired, Hermes as the channel path).
- [ ] **Step 5:** Commit — `git add -A && git commit -m "chore(paperclip): retirement sweep + docs"`
