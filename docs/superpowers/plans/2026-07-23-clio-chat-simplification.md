# Clio Chat Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the instrumentation-heavy AssistantPanel into a chat-first Clio surface: one conversation, one status dot, humanized tool events, suggestion chips above the composer.

**Architecture:** A new pure module (`assistant-thread-model.ts`) owns tool-event humanization; a new `AssistantStatusDot` collapses all runtime telemetry into a dot + popover; `AssistantPanel.tsx` drops the thread list, metric rails, and seeded conversations and becomes composition + data loading. The side-chat CSS `display:none` hacks are replaced by real conditional rendering keyed on the existing `surface` prop.

**Tech Stack:** React 18 + TypeScript (Electron renderer), vitest (node env — no React render tests; pure-logic + source-assertion tests only, per repo convention).

**Spec:** `docs/superpowers/specs/2026-07-23-clio-chat-simplification-design.md`

## Global Constraints

- User-visible copy says **Clio**, never "Assistant" ("Assistant" survives only in code/type names).
- IPC contract unchanged: `assistantAsk`, `assistantSuggestions`, `onAssistantEvent`, `conversationId` still sent (constant `'clio'`).
- No new dependencies. No React Testing Library — vitest node env only.
- Repo test layout: pure logic → `test/assistant/*.test.ts`; source assertions read files via `readFileSync(resolve(process.cwd(), path))`.
- Run all tests with `npx vitest run`; type-check with `npx tsc --noEmit -p .`.

---

### Task 1: `assistant-thread-model.ts` — humanizeToolEvent

**Files:**
- Create: `src/renderer/lib/assistant-thread-model.ts`
- Test: `test/assistant/assistant-thread-model.test.ts`

**Interfaces:**
- Consumes: `AssistantToolId` from `src/shared/native-assistant.ts` (union incl. `'app.startTimer' | 'app.navigate' | 'app.generateStandup' | 'app.syncProjects' | 'app.acceptSession' | 'context.*' | 'daily.sendEvent' | 'admin.*'`).
- Produces: `humanizeToolEvent(toolId: AssistantToolId, phase: 'call' | 'result'): string` — used by Task 3/4.

- [ ] **Step 1: Write the failing test**

```ts
// test/assistant/assistant-thread-model.test.ts
import { describe, expect, it } from 'vitest';
import { humanizeToolEvent } from '../../src/renderer/lib/assistant-thread-model';

describe('humanizeToolEvent', () => {
  it('humanizes known action tools for both phases', () => {
    expect(humanizeToolEvent('app.startTimer', 'call')).toBe('Starting the timer…');
    expect(humanizeToolEvent('app.startTimer', 'result')).toBe('Timer started');
    expect(humanizeToolEvent('app.navigate', 'call')).toBe('Opening a page…');
    expect(humanizeToolEvent('app.navigate', 'result')).toBe('Opened the page');
    expect(humanizeToolEvent('app.generateStandup', 'call')).toBe('Drafting standup proof…');
    expect(humanizeToolEvent('app.generateStandup', 'result')).toBe('Standup draft ready');
    expect(humanizeToolEvent('app.syncProjects', 'call')).toBe('Syncing projects…');
    expect(humanizeToolEvent('app.syncProjects', 'result')).toBe('Projects synced');
    expect(humanizeToolEvent('app.acceptSession', 'result')).toBe('Session accepted');
  });

  it('humanizes read-only context tools as checks', () => {
    expect(humanizeToolEvent('context.entries', 'call')).toBe('Checking the work log…');
    expect(humanizeToolEvent('context.entries', 'result')).toBe('Checked the work log');
    expect(humanizeToolEvent('context.infra', 'result')).toBe('Checked infra status');
  });

  it('falls back to the raw tool id for unknown tools', () => {
    expect(humanizeToolEvent('admin.diagnostics', 'result')).toBe('Ran admin.diagnostics');
    expect(humanizeToolEvent('admin.diagnostics', 'call')).toBe('Running admin.diagnostics…');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/assistant/assistant-thread-model.test.ts`
Expected: FAIL — `Cannot find module '../../src/renderer/lib/assistant-thread-model'`

- [ ] **Step 3: Write the implementation**

```ts
// src/renderer/lib/assistant-thread-model.ts
import type { AssistantToolId } from '../../shared/native-assistant';

/**
 * Plain-language labels for tool activity in the Clio thread.
 * phase 'call' = in progress, phase 'result' = finished.
 * Unknown tools fall back to the raw id so nothing is ever hidden.
 */
const TOOL_COPY: Partial<Record<AssistantToolId, { call: string; result: string }>> = {
  'app.startTimer': { call: 'Starting the timer…', result: 'Timer started' },
  'app.navigate': { call: 'Opening a page…', result: 'Opened the page' },
  'app.generateStandup': { call: 'Drafting standup proof…', result: 'Standup draft ready' },
  'app.syncProjects': { call: 'Syncing projects…', result: 'Projects synced' },
  'app.acceptSession': { call: 'Accepting the session…', result: 'Session accepted' },
  'context.projects': { call: 'Checking projects…', result: 'Checked projects' },
  'context.entries': { call: 'Checking the work log…', result: 'Checked the work log' },
  'context.reports': { call: 'Checking reports…', result: 'Checked reports' },
  'context.sessions': { call: 'Checking sessions…', result: 'Checked sessions' },
  'context.infra': { call: 'Checking infra status…', result: 'Checked infra status' },
  'daily.sendEvent': { call: 'Sending daily update…', result: 'Daily update sent' },
};

export function humanizeToolEvent(toolId: AssistantToolId, phase: 'call' | 'result'): string {
  const copy = TOOL_COPY[toolId];
  if (copy) return copy[phase];
  return phase === 'call' ? `Running ${toolId}…` : `Ran ${toolId}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/assistant/assistant-thread-model.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/lib/assistant-thread-model.ts test/assistant/assistant-thread-model.test.ts
git commit -m "feat(clio): humanized tool-event copy model"
```

---

### Task 2: `AssistantStatusDot` component

**Files:**
- Create: `src/renderer/components/AssistantStatusDot.tsx`
- Modify: `src/renderer/theme.css` (append styles at end of file)
- Test: `test/assistant/assistant-status-dot.test.ts`

**Interfaces:**
- Produces (consumed by Task 3):

```ts
export type ClioStatusTone = 'ready' | 'local' | 'error';
export interface AssistantStatusDotProps {
  tone: ClioStatusTone;
  runtimeLabel: string;      // e.g. "runtime ready"
  runtimeMessage: string;    // plain-language detail
  provider: string;          // e.g. "google" | "local mode"
  capabilityCount: number | null;
  contextGeneratedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}
```

- [ ] **Step 1: Write the failing source-assertion test**

```ts
// test/assistant/assistant-status-dot.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('AssistantStatusDot', () => {
  it('renders a dot with three tones and a details popover', () => {
    const dot = source('src/renderer/components/AssistantStatusDot.tsx');
    expect(dot).toContain("'ready' | 'local' | 'error'");
    expect(dot).toContain('px-clio-status-dot');
    expect(dot).toContain('px-clio-status-pop');
    expect(dot).toContain('onRefresh');
    // Popover carries the telemetry the old metric rails showed.
    expect(dot).toContain('provider');
    expect(dot).toContain('capabilityCount');
    expect(dot).toContain('contextGeneratedAt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/assistant/assistant-status-dot.test.ts`
Expected: FAIL — `ENOENT ... AssistantStatusDot.tsx`

- [ ] **Step 3: Write the component**

```tsx
// src/renderer/components/AssistantStatusDot.tsx
import React, { useState } from 'react';
import { Button } from './ui';
import { IconSync } from './Icons';

export type ClioStatusTone = 'ready' | 'local' | 'error';

export interface AssistantStatusDotProps {
  tone: ClioStatusTone;
  runtimeLabel: string;
  runtimeMessage: string;
  provider: string;
  capabilityCount: number | null;
  contextGeneratedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * One dot replaces the old metric rails + status chips: green = runtime
 * ready with a model provider, amber = local/offline mode, red = error.
 * Everything else lives in the click-to-open popover.
 */
export default function AssistantStatusDot({
  tone, runtimeLabel, runtimeMessage, provider,
  capabilityCount, contextGeneratedAt, refreshing, onRefresh,
}: AssistantStatusDotProps) {
  const [open, setOpen] = useState(false);
  const toneLabel = tone === 'ready' ? 'Clio is ready' : tone === 'local' ? 'Offline mode' : 'Clio has a problem';
  return (
    <div className="px-clio-status">
      <button
        type="button"
        className={`px-clio-status-dot tone-${tone}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Clio status: ${toneLabel}`}
        title={toneLabel}
      />
      {open && (
        <div className="px-clio-status-pop" role="dialog" aria-label="Clio status details">
          <strong>{toneLabel}</strong>
          <p>{runtimeMessage}</p>
          <dl>
            <div><dt>runtime</dt><dd>{runtimeLabel}</dd></div>
            <div><dt>model</dt><dd>{provider}</dd></div>
            <div><dt>capabilities</dt><dd>{capabilityCount ?? '—'}</dd></div>
            <div><dt>context</dt><dd>{contextGeneratedAt ? new Date(contextGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'not loaded'}</dd></div>
          </dl>
          <Button variant="ghost" onClick={onRefresh} disabled={refreshing}>
            <IconSync s={13} /> {refreshing ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Append styles to `src/renderer/theme.css`** (end of file)

```css
/* ── Clio status dot ─────────────────────────────────────────── */
.px-clio-status{position:relative;display:inline-flex}
.px-clio-status-dot{width:10px;height:10px;border:1px solid var(--line);background:var(--t4);cursor:pointer;padding:0}
.px-clio-status-dot.tone-ready{background:var(--accent)}
.px-clio-status-dot.tone-local{background:var(--warning, #d9a441)}
.px-clio-status-dot.tone-error{background:var(--error, #e05f6d)}
.px-clio-status-pop{position:absolute;top:16px;right:0;z-index:30;min-width:220px;background:var(--surface);border:1px solid var(--line);padding:10px;display:grid;gap:8px;font-size:12px}
.px-clio-status-pop dl{display:grid;gap:4px;margin:0}
.px-clio-status-pop dl div{display:flex;justify-content:space-between;gap:12px}
.px-clio-status-pop dt{color:var(--t3);font-family:var(--mono)}
.px-clio-status-pop dd{margin:0}
```

- [ ] **Step 5: Run test + type-check**

Run: `npx vitest run test/assistant/assistant-status-dot.test.ts && npx tsc --noEmit -p .`
Expected: PASS, no type errors

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/AssistantStatusDot.tsx src/renderer/theme.css test/assistant/assistant-status-dot.test.ts
git commit -m "feat(clio): status dot with telemetry popover"
```

---

### Task 3: AssistantPanel restructure — single conversation, chat-first layout

**Files:**
- Modify: `src/renderer/components/AssistantPanel.tsx` (major)
- Create: `src/renderer/components/AssistantSuggestionChips.tsx`
- Delete: usage of `AssistantSuggestionRail` in the panel (leave the file; remove import). If nothing else imports it afterwards (`grep -rn AssistantSuggestionRail src/`), delete `src/renderer/components/AssistantSuggestionRail.tsx`.
- Modify: `src/renderer/theme.css`
- Test: `test/assistant/assistant-panel-layout.test.ts`

**Interfaces:**
- Consumes: `AssistantStatusDot` (Task 2 props), `humanizeToolEvent` (Task 1).
- Produces: `AssistantSuggestionChips` props consumed nowhere else:

```ts
interface AssistantSuggestionChipsProps {
  suggestions: AssistantSuggestion[];
  dismissedIds: Set<string>;
  onConfirm: (intent: AssistantPendingIntent) => void;
  onDismiss: (id: string) => void;
}
```

- [ ] **Step 1: Write the failing source-assertion test**

```ts
// test/assistant/assistant-panel-layout.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('AssistantPanel chat-first layout', () => {
  const panel = () => source('src/renderer/components/AssistantPanel.tsx');

  it('drops the metric rails, page header, and thread list', () => {
    expect(panel()).not.toContain('MetricRailGroup');
    expect(panel()).not.toContain('STARTER_CONVERSATIONS');
    expect(panel()).not.toContain('seedMessages');
    expect(panel()).not.toContain('PageHeader');
  });

  it('uses one stable conversation id and a Clio welcome', () => {
    expect(panel()).toContain("const CLIO_CONVERSATION_ID = 'clio'");
    expect(panel()).toContain("I'm Clio.");
  });

  it('renders status dot, context toggle, and suggestion chips', () => {
    expect(panel()).toContain('<AssistantStatusDot');
    expect(panel()).toContain('<AssistantSuggestionChips');
    expect(panel()).not.toContain('<AssistantSuggestionRail');
    expect(panel()).toContain('contextOpen');
  });

  it('humanizes tool events through the thread model', () => {
    expect(panel()).toContain("humanizeToolEvent(event.toolId, 'call')");
    expect(panel()).toContain("humanizeToolEvent(event.toolId, 'result')");
  });
});

describe('side chat sizing', () => {
  it('removes the display:none surface hacks and the 42vh cap', () => {
    const css = source('src/renderer/theme.css');
    expect(css).not.toContain('minmax(260px,42vh)');
    expect(css).not.toMatch(/surface-sidechat[^}]*\.pxds-panel:first-child\{display:none\}/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/assistant/assistant-panel-layout.test.ts`
Expected: FAIL on every assertion group

- [ ] **Step 3: Create `AssistantSuggestionChips.tsx`**

```tsx
// src/renderer/components/AssistantSuggestionChips.tsx
import React, { useState } from 'react';
import type { AssistantSuggestion } from '../../shared/types';
import type { AssistantPendingIntent } from './AssistantActionConfirmModal';
import { IconClose } from './Icons';

const VISIBLE_LIMIT = 3;

/**
 * Horizontal suggestion chips above the composer. Click confirms via the
 * existing action modal; the ✕ dismisses. Confidence values are hidden.
 */
export default function AssistantSuggestionChips({
  suggestions, dismissedIds, onConfirm, onDismiss,
}: {
  suggestions: AssistantSuggestion[];
  dismissedIds: Set<string>;
  onConfirm: (intent: AssistantPendingIntent) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = suggestions.filter((item) => !dismissedIds.has(item.id));
  if (!active.length) return null;
  const visible = expanded ? active : active.slice(0, VISIBLE_LIMIT);
  const hidden = active.length - visible.length;
  return (
    <div className="px-clio-chips" aria-label="Suggested actions">
      {visible.map((suggestion) => (
        <span key={suggestion.id} className="px-clio-chip" title={suggestion.body}>
          <button
            type="button"
            className="px-clio-chip-act"
            onClick={() => suggestion.intent && onConfirm({ ...suggestion.intent, suggestionId: suggestion.id })}
          >
            {suggestion.title}
          </button>
          <button type="button" className="px-clio-chip-x" aria-label={`Dismiss ${suggestion.title}`} onClick={() => onDismiss(suggestion.id)}>
            <IconClose s={10} />
          </button>
        </span>
      ))}
      {hidden > 0 && (
        <button type="button" className="px-clio-chip more" onClick={() => setExpanded(true)}>+{hidden} more</button>
      )}
    </div>
  );
}
```

Note: check `AssistantPendingIntent` in `AssistantActionConfirmModal.tsx` before writing — if it has no `suggestionId` field, pass `suggestion.intent` unchanged (`onConfirm(suggestion.intent)`), matching how `AssistantSuggestionRail` calls it today. Mirror the rail's existing confirm call exactly.

- [ ] **Step 4: Restructure `AssistantPanel.tsx`**

Keep all data-loading logic (`loadRuntime`, `loadContext`, `loadSuggestions`, `applyStreamEvent`, `submit`, `parseAskResult`, suggestion helpers). Apply these changes:

4a. Replace conversation state (delete `ConversationItem`, `STARTER_CONVERSATIONS`, `conversations`, `conversationId` state, `messagesByConversation`, `seedMessages`):

```tsx
const CLIO_CONVERSATION_ID = 'clio';
const WELCOME: AssistantUiMessage = {
  id: 'welcome',
  role: 'assistant',
  content: "I'm Clio. I can check today's work, prep standup proof, review sessions, or navigate the app.",
  createdAt: new Date().toISOString(),
  status: 'done',
  provider: 'local',
};

const [messages, setMessages] = useState<AssistantUiMessage[]>([WELCOME]);
const [contextOpen, setContextOpen] = useState(false);
```

`appendMessage` becomes `(message: AssistantUiMessage) => setMessages((current) => [...current, message])`. In `applyStreamEvent`, replace every `event.conversationId !== conversationId` guard with `event.conversationId !== CLIO_CONVERSATION_ID`, and the `stream:${conversationId}` id with `stream:clio`. In `submit`, send `conversationId: CLIO_CONVERSATION_ID`.

4b. Humanize tool events in `applyStreamEvent` (replace the two payload-summary branches):

```tsx
if (event.type === 'tool_call') {
  appendMessage(toolMessage(humanizeToolEvent(event.toolId, 'call'), event.toolId));
  return;
}
if (event.type === 'tool_result') {
  appendMessage(toolMessage(humanizeToolEvent(event.toolId, 'result'), event.toolId));
  return;
}
```

Add import: `import { humanizeToolEvent } from '../lib/assistant-thread-model';`

4c. Derive the dot tone from existing state:

```tsx
const statusTone: ClioStatusTone = runtimeState.tone === 'error'
  ? 'error'
  : runtimeState.tone === 'accent' || runtimeState.tone === 'mint' ? 'ready' : 'local';
```

Rewrite the two dev-copy fallbacks in `loadRuntime`/`submit`:
- `'Assistant IPC is optional in this build; renderer fallbacks are active.'` → `'Clio is running in offline mode — answers use local data only.'`
- `'Assistant ask method is available.'` → `'Clio is connected and ready.'`
- `'Assistant IPC is not exposed yet; local state remains usable.'` → `'Clio is running in offline mode — answers use local data only.'`
- In `localAssistantReply`, replace the first sentence with `"I'm in offline mode right now, so I'm answering from local data."`

4d. Replace the whole `return (...)` JSX with the chat-first layout:

```tsx
return (
  <div className={`px-fadein px-clio-page surface-${surface}`}>
    <header className="px-clio-head">
      <div className="px-clio-head-id">
        <strong>Clio</strong>
        <AssistantStatusDot
          tone={statusTone}
          runtimeLabel={runtimeState.label}
          runtimeMessage={runtimeState.message}
          provider={providerLabel}
          capabilityCount={capabilityCatalog?.capabilities.length ?? null}
          contextGeneratedAt={contextState.generatedAt}
          refreshing={contextState.loading}
          onRefresh={() => { void loadRuntime(); void loadContext(); }}
        />
      </div>
      <Button variant="ghost" onClick={() => setContextOpen((v) => !v)} aria-expanded={contextOpen}>
        {contextOpen ? 'Hide context' : 'What Clio can see'}
      </Button>
    </header>

    {contextOpen && (
      <AssistantContextDrawer
        sections={contextState.sections}
        helpers={contextState.helpers}
        generatedAt={contextState.generatedAt}
        loading={contextState.loading}
      />
    )}

    <div className="px-clio-thread">
      <AssistantMessageList messages={messages} streaming={streaming} providerLabel={providerLabel} />
    </div>

    <div className="px-clio-foot">
      <AssistantSuggestionChips
        suggestions={suggestions}
        dismissedIds={dismissedIds}
        onConfirm={setPendingIntent}
        onDismiss={(id) => setDismissedIds((current) => new Set([...current, id]))}
      />
      <AssistantComposer streaming={streaming} onSubmit={submit} />
    </div>

    {pendingIntent && (
      <AssistantActionConfirmModal
        intent={pendingIntent}
        onClose={() => setPendingIntent(null)}
        onResult={recordActionResult}
      />
    )}
  </div>
);
```

Remove now-unused imports (`PageHeader`, `CommandDock`, `InstrumentPanel`, `Ledger`, `LedgerRail`, `MetricRail`, `MetricRailGroup`, `StatusChip`, `DegradedStatePanel`, `IconSync`, `AssistantSuggestionRail`). Keep `error` state — surface it as an inline thread error (already appended via `errorMessage` in `submit`); delete the top `DegradedStatePanel` blocks.

4e. CSS — in `src/renderer/theme.css` delete the `surface-sidechat` display-hack block (the rules at ~lines 211-220 that hide `.px-page-h`, hero metrics, and `.pxds-panel:first-child`, and the `minmax(260px,42vh)` row cap). Append:

```css
/* ── Clio chat-first layout ──────────────────────────────────── */
.px-clio-page{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:12px;min-height:100%}
.px-clio-page.surface-page{max-width:860px;margin:0 auto;width:100%}
.px-clio-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.px-clio-head-id{display:flex;align-items:center;gap:10px}
.px-clio-head-id strong{font-size:16px}
.px-clio-thread{min-height:0;overflow-y:auto;border:1px solid var(--line);background:var(--surface)}
.px-clio-foot{display:grid;gap:8px}
.px-clio-chips{display:flex;flex-wrap:wrap;gap:6px}
.px-clio-chip{display:inline-flex;align-items:center;border:1px solid var(--line);background:var(--surface)}
.px-clio-chip-act{background:none;border:0;color:inherit;padding:5px 8px;cursor:pointer;font-size:12px}
.px-clio-chip-x{background:none;border:0;border-left:1px solid var(--line);color:var(--t3);padding:5px 6px;cursor:pointer}
.px-clio-chip.more{background:none;color:var(--t3);padding:5px 8px;cursor:pointer;font-size:12px}
```

Search `theme.css` for remaining `px-assistant-page`/`px-assistant-layout` selectors; keep message-list styles (still used), delete layout-grid rules that referenced the removed panels.

- [ ] **Step 5: Run tests + type-check**

Run: `npx vitest run test/assistant/assistant-panel-layout.test.ts && npx tsc --noEmit -p .`
Expected: PASS, no type errors

- [ ] **Step 6: Run the full suite (existing assistant tests must not regress)**

Run: `npx vitest run`
Expected: all pass. If an existing test asserts removed strings (e.g. greps for `MetricRailGroup` in AssistantPanel), update that test to the new contract — check `test/assistant/` and `test/identity/` for hits first: `grep -rln "AssistantPanel\|Work threads" test/`.

- [ ] **Step 7: Commit**

```bash
git add -A src/renderer test/assistant
git commit -m "feat(clio): chat-first panel — single conversation, status dot, suggestion chips"
```

---

### Task 4: Message chrome simplification (`AssistantMessageList`)

**Files:**
- Modify: `src/renderer/components/AssistantMessageList.tsx`
- Modify: `src/renderer/theme.css` (tool-row style, appended)
- Test: extend `test/assistant/assistant-panel-layout.test.ts`

**Interfaces:**
- Consumes: `AssistantUiMessage` (unchanged shape).
- Produces: same default export; tool messages render as compact rows.

- [ ] **Step 1: Add failing assertions**

Append to `test/assistant/assistant-panel-layout.test.ts`:

```ts
describe('message chrome', () => {
  it('drops per-message status chips and metadata lines', () => {
    const list = source('src/renderer/components/AssistantMessageList.tsx');
    expect(list).not.toContain('StatusChip');
    expect(list).not.toContain('metadataLine');
  });

  it('renders tool messages as compact rows with toolId tooltip', () => {
    const list = source('src/renderer/components/AssistantMessageList.tsx');
    expect(list).toContain('px-clio-tool-row');
    expect(list).toContain('title={message.toolId');
  });
});
```

Run: `npx vitest run test/assistant/assistant-panel-layout.test.ts` — Expected: the two new tests FAIL.

- [ ] **Step 2: Rewrite the message renderer**

Replace the `article` body in `AssistantMessageList.tsx`. Tool messages become a dedicated row; user/assistant/error keep glyph + content with a subtle timestamp; drop `StatusChip` and `metadataLine` entirely (delete both the import and the `metadataLine` function; keep `roleIcon`, delete `roleLabel`/`roleTone` if unused after the change):

```tsx
return (
  <div className="px-assistant-message-list" aria-live="polite">
    {messages.map((message) => (
      message.role === 'tool' ? (
        <div key={message.id} className="px-clio-tool-row" title={message.toolId ?? undefined}>
          <span aria-hidden="true">▸</span> {message.content}
        </div>
      ) : (
        <article key={message.id} className={`px-assistant-message role-${message.role}`}>
          <div className="px-assistant-message-marker">{roleIcon(message.role, message.status)}</div>
          <div className="px-assistant-message-main">
            <div className="px-assistant-message-content">{message.content}</div>
            <span className="px-clio-msg-time">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {message.status && message.status !== 'done' ? ` · ${message.status}` : ''}
            </span>
          </div>
        </article>
      )
    ))}
    {streaming && (
      <div className="px-assistant-stream-indicator">
        <span className="px-dot pulse" />
        <span>Clio is thinking…</span>
      </div>
    )}
  </div>
);
```

The `providerLabel` prop becomes unused — remove it from `Props` and from the call site in `AssistantPanel.tsx`. Append CSS:

```css
.px-clio-tool-row{padding:4px 10px;font-size:12px;font-family:var(--mono);color:var(--t3)}
.px-clio-msg-time{font-size:10px;color:var(--t4);font-family:var(--mono)}
```

- [ ] **Step 3: Run tests + type-check**

Run: `npx vitest run test/assistant/ && npx tsc --noEmit -p .`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/AssistantMessageList.tsx src/renderer/components/AssistantPanel.tsx src/renderer/theme.css test/assistant/assistant-panel-layout.test.ts
git commit -m "feat(clio): compact message chrome, humanized tool rows"
```

---

### Task 5: Clio naming sweep + final verification

**Files:**
- Modify: user-visible copy only — check `src/renderer/components/ClioSideChat.tsx`, `src/renderer/components/Settings.tsx` (workbench section labels), `src/renderer/App.tsx` (HUD button title/labels)
- Test: extend `test/assistant/assistant-panel-layout.test.ts`

- [ ] **Step 1: Find remaining user-visible "Assistant" strings**

Run: `grep -rn '"Assistant\|>Assistant\|Assistant "' src/renderer/components/ src/renderer/App.tsx | grep -v 'Assistant[A-Z]' | grep -v import`
Review each hit: rename user-visible labels to "Clio" (e.g. Settings section title "Assistant workbench" → "Clio workbench"). Do NOT rename component/type identifiers.

- [ ] **Step 2: Add a guard assertion**

```ts
it('user-visible surface says Clio, not Assistant', () => {
  const panel = source('src/renderer/components/AssistantPanel.tsx');
  expect(panel).not.toMatch(/title="Assistant"/);
  expect(panel).toContain('<strong>Clio</strong>');
});
```

- [ ] **Step 3: Full verification**

Run: `npx vitest run && npx tsc --noEmit -p .`
Expected: all pass, no type errors.

Manual smoke (if a dev build is feasible): open the app → HUD CLIO button → side chat shows slim header, thread filling the panel, chips above composer; Settings workbench shows the same chat-first panel with `surface-page` max-width.

- [ ] **Step 4: Commit**

```bash
git add -A src test
git commit -m "feat(clio): naming sweep — Clio in all user-visible copy"
```
