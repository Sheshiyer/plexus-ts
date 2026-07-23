# Clio Chat Simplification

**Date:** 2026-07-23
**Status:** Approved design
**Trigger:** Tester feedback — "This CLIO chat UI is also pretty confusing."

## Problem

`AssistantPanel.tsx` reads as a debug console with a chat attached: five metric rails and cycling status chips sit above the conversation; three pre-seeded "Work threads" carry canned dev copy; every message shows a role chip plus metadata like `app.navigate / local / fallback ipc-pending`; tool events read "Requested app.startTimer; payload summary has 3 fields"; the right rail exposes context internals and confidence decimals; naming is split between "CLIO" and "Assistant". The side chat crams all of it into a narrow column with the thread capped at 42vh.

## Decisions

1. **Chat-first:** thread + composer become ~90% of the surface; telemetry demotes to one status dot.
2. **One conversation:** no thread list; stable `conversationId: 'clio'`; one welcome line.
3. **Tool events humanized:** compact one-line chips, raw toolId in tooltip.
4. **Clio everywhere** in user-visible copy; "Assistant" stays in code/type names only.

## Layout (both surfaces, real conditional rendering — remove `surface-sidechat` CSS display hacks, theme.css ~211-220)

- **Header (slim):** "Clio" + status dot + "context" button + refresh. `PageHeader`, `MetricRailGroup`, and both top `DegradedStatePanel`s removed.
- **Thread** fills remaining height; side chat loses the 42vh cap; composer pinned bottom.
- **Suggestion chips:** one horizontal row above the composer (max 3 visible, "+N"), replacing `AssistantSuggestionRail`'s right-rail placement. Click → existing `AssistantActionConfirmModal`; confidence hidden; dismiss per chip.
- **Context drawer:** existing `AssistantContextDrawer` content moves behind the header "context" button as a collapsible overlay ("What Clio can see").
- Conversation-list panel ("Work threads") deleted.

## Status & telemetry

One status dot: green (runtime ready + provider), amber (local mode / partial context), red (error). Popover: runtime label, provider, capability count, context freshness, Refresh. Blocking errors also render inline in the thread. Dev copy rewritten plainly (e.g. "Clio is running in offline mode — answers use local data only").

## Conversation & messages

- Delete `STARTER_CONVERSATIONS`, `seedMessages`, per-conversation map → single `messages[]`, `conversationId: 'clio'` (IPC contract unchanged).
- Welcome: "I'm Clio. I can check today's work, prep standup proof, review sessions, or navigate the app."
- Message chrome: role glyph + content; subtle timestamp; per-message `StatusChip` and metadata line removed. Streaming indicator kept. Errors stay prominent.
- Tool events: pure `humanizeToolEvent(toolId, phase)` — `tool_call` → "▸ Starting timer…", `tool_result` → "▸ Timer started"; unknown → "▸ Ran <toolId>".

## Architecture

```
renderer/lib/assistant-thread-model.ts  new, pure — stream-event reducer + humanizeToolEvent
components/AssistantStatusDot.tsx       new — dot + popover
AssistantPanel.tsx                      slims to composition + data loading
ClioSideChat.tsx                        shell unchanged; panel fills it properly
```

## Testing

- Unit tests for reducer + humanizer (repo pure-logic pattern).
- Source assertions: `AssistantPanel` renders no `MetricRailGroup`/thread list; suggestions render as chips; side chat has no 42vh cap rule.

## Out of scope

- Real thread persistence (returns when persistence IPC lands).
- Assistant runtime/provider changes (`assistant-runtime.ts`, models) — UI only.
- Co-working redesign (separate spec, 2026-07-23-coworking-redesign-design.md).
