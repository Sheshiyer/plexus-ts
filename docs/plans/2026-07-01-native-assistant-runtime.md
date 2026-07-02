# Native Assistant Runtime Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Plexus-native assistant runtime that can read bounded local app context, group local AI sessions, suggest/navigate existing Electron features, and send daily work events to Hermes/Worker while keeping Paperclip/Fabric optional.

**Architecture:** The Electron main process owns model calls, secret custody, read-only SQLite access, action permissions, daily event delivery, and retry queues. The renderer receives typed IPC snapshots, streams, suggestions, and explicit action confirmations; it never reads the database or model keys directly. Fabric/Paperclip remains an optional adapter surfaced through Settings and diagnostics, not the core daily-agent dependency.

**Tech Stack:** Electron main/preload IPC, React 18 renderer, TypeScript shared contracts, SQLite, existing `teamforge` Worker client, existing `thoughtseed-bridge` member bridge, AI SDK `ai` with `@ai-sdk/google` and `@ai-sdk/openai-compatible`, NVIDIA NIM/OpenAI-compatible API, Vitest or smoke scripts for assistant-specific tests.

---

## Current Understanding

Plexus already has the right raw material: local SQLite work records, projects, evidence, standup records, local agent session scanning, Worker usage signals, bridge credentials, handoff retries, Fabric task cards, app navigation, and admin diagnostics. The problem is that Fabric/Paperclip became the visible center of the "agent" story. The new direction is to make the assistant a first-class Plexus runtime that can read and reason over these capabilities safely.

The assistant is not a chatbot bolted onto a page. It is a main-process service with:

- read-only context tools,
- explicit write/action tools,
- bounded model context,
- model fallback routing,
- session grouping,
- daily event outbox,
- app navigation intents,
- and optional Paperclip enrichment.

## Non-Negotiable Boundaries

- Renderer never receives API keys, bridge member tokens, raw Access JWTs, or direct database handles.
- Model calls happen in the main process only.
- All local database reads go through bounded read-only context functions.
- All actions require typed intent records and user confirmation unless they are explicitly classified as safe read-only.
- Daily/Hermes delivery must queue locally when offline and retry through existing handoff patterns.
- Paperclip/Fabric must be optional and cannot block daily assistant use, onboarding completion, session grouping, reports, or core work capture.
- The assistant may summarize session metadata and bounded excerpts only after consent; it must not stream full private session files into the model by default.

## Source References

- AI SDK Google provider docs: https://ai-sdk.dev/v5/providers/ai-sdk-providers/google-generative-ai
- AI SDK NVIDIA NIM provider docs: https://ai-sdk.dev/providers/openai-compatible-providers/nim
- NVIDIA NIM LLM API reference: https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html
- Existing Plexus bridge contract: `docs/THOUGHTSEED_BRIDGE_HANDOFF.md`
- Existing resilience review: `docs/APP_RESILIENCE_REVIEW.md`

## Parallel Dispatch Map

Use the dispatching-parallel-agents skill after Task 8 when the shared contracts exist.

| Workstream | Independent Scope | First Tasks | Shared Files To Avoid |
|---|---|---:|---|
| A. Contracts and tests | Shared assistant types, fixtures, smoke harness | 1-8 | `src/shared/types.ts` |
| B. Read-only context | DB gateway, context providers, session grouping | 9-25 | `src/main/assistant-context.ts` |
| C. Model runtime | AI SDK providers, fallback routing, streaming | 26-39 | `src/main/assistant-models.ts` |
| D. Tool permissions | Tool registry and action confirmation | 40-48 | `src/main/assistant-tools.ts` |
| E. Daily delivery | Daily event schema, Worker/Hermes client, queue | 49-57 | `src/main/assistant-daily.ts` |
| F. Renderer UX | Assistant panel, suggestions, settings, modals | 58-72 | `src/renderer/components/*Assistant*` |
| G. Optional Fabric demotion | Onboarding, Fabric page, diagnostics copy | 73-78 | `AgentFabricPanel.tsx`, `Onboarding.tsx`, `Settings.tsx` |
| H. Verification and docs | Smoke scripts, docs, release checks | 79-85 | `docs/*`, `scripts/*` |

## Verification Commands

Run these after each milestone, not only at the end:

```bash
npm run typecheck
npm run lint -- --quiet
npm run build:main
npm run build:preload
npm exec vite -- build
npm run smoke:thoughtseed-bridge
```

Add assistant-specific commands as tasks introduce them:

```bash
npm run test:assistant
npm run smoke:assistant-context
npm run smoke:assistant-models
npm run smoke:assistant-daily
```

## Implementation Tasks

### Task 1: Add Assistant Test Harness

**Files:**
- Modify: `package.json`
- Create: `test/assistant/README.md`
- Create: `test/assistant/fixtures/README.md`

**Steps:**
1. Install test dependencies with `npm install -D vitest`.
2. Add `test:assistant` script: `vitest run test/assistant`.
3. Add `test:assistant:watch` script: `vitest test/assistant`.
4. Create fixture README explaining that tests use mock DB/model providers and never call live AI APIs.
5. Run `npm run test:assistant`; expect PASS with no tests or a Vitest no-test warning depending configuration.

**Commit:** `test: add assistant test harness`

### Task 2: Add Assistant Fixture Builders

**Files:**
- Create: `test/assistant/fixtures/builders.ts`
- Create: `test/assistant/fixtures/sample-data.ts`

**Steps:**
1. Export builders for `Project`, `TimeEntry`, `GitHubActivity`, `AgentSessionCandidate`, `HandoffRecord`, and `ThoughtseedBridgeStatus`.
2. Keep all fixture timestamps deterministic, using `2026-07-01T09:00:00.000Z`.
3. Include one project with verified GitHub evidence and one project with missing evidence.
4. Include Codex, Claude, Cursor, and OpenCode agent session candidates.
5. Run `npm run test:assistant`; expect no TypeScript import failures once tests reference the builders.

**Commit:** `test: add assistant fixture builders`

### Task 3: Add Assistant Shared Contract File

**Files:**
- Create: `src/shared/native-assistant.ts`
- Modify: `src/shared/types.ts`

**Steps:**
1. Define `AssistantRole = 'user' | 'assistant' | 'system' | 'tool'`.
2. Define `AssistantToolSafety = 'read_only' | 'confirm_required' | 'admin_only'`.
3. Define `AssistantIntentStatus = 'draft' | 'confirmed' | 'running' | 'succeeded' | 'failed' | 'cancelled'`.
4. Define `AssistantContextScope = 'today' | 'week' | 'project' | 'session_group' | 'infra' | 'app'`.
5. Re-export these from `src/shared/types.ts`.

**Verify:**
```bash
npm run typecheck
```

**Commit:** `feat: add native assistant shared contracts`

### Task 4: Add Assistant Request And Response Types

**Files:**
- Modify: `src/shared/native-assistant.ts`
- Test: `test/assistant/native-assistant-types.test.ts`

**Steps:**
1. Add `AssistantTurnRequest` with `conversationId`, `message`, `contextScopes`, and optional `routeKey`.
2. Add `AssistantStreamEvent` union for `message_delta`, `tool_call`, `tool_result`, `suggestion`, `error`, and `done`.
3. Add `AssistantSuggestion` with `id`, `title`, `body`, `intent`, `confidence`, `safety`.
4. Add a type-level smoke test that imports these symbols.
5. Run `npm run test:assistant -- native-assistant-types`; expect PASS.

**Commit:** `feat: type assistant turn protocol`

### Task 5: Add Assistant Tool Id Registry

**Files:**
- Modify: `src/shared/native-assistant.ts`
- Test: `test/assistant/tool-registry.test.ts`

**Steps:**
1. Add `AssistantToolId` union for `context.projects`, `context.entries`, `context.reports`, `context.sessions`, `context.infra`, `app.navigate`, `app.generateStandup`, `app.acceptSession`, `app.startTimer`, `app.syncProjects`, and `daily.sendEvent`.
2. Add `ASSISTANT_READ_ONLY_TOOLS` constant.
3. Add `ASSISTANT_CONFIRM_REQUIRED_TOOLS` constant.
4. Test that every tool id appears in exactly one safety bucket.
5. Run `npm run test:assistant -- tool-registry`; expect PASS.

**Commit:** `feat: register assistant tool ids`

### Task 6: Add Assistant Settings Types

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/native-assistant.ts`

**Steps:**
1. Extend `PlexusSettings` with `assistantEnabled?: boolean`.
2. Add `assistantModelProvider?: 'google' | 'nvidia' | 'auto' | 'mock'`.
3. Add `assistantSessionScanEnabled?: boolean`.
4. Add `assistantPaperclipEnrichmentEnabled?: boolean`.
5. Run `npm run typecheck`; expect any missing `PlexusSettings` default handling to be revealed.

**Commit:** `feat: add assistant settings contract`

### Task 7: Add Assistant Security Policy Constants

**Files:**
- Create: `src/main/assistant-policy.ts`
- Test: `test/assistant/assistant-policy.test.ts`

**Steps:**
1. Export max context budgets: `MAX_CONTEXT_ITEMS`, `MAX_TEXT_CHARS_PER_ITEM`, `MAX_SESSION_EXCERPT_CHARS`.
2. Export banned secret keys: `token`, `authorization`, `cookie`, `bridgeToken`, `accessJwt`, `signature`.
3. Add helper `isSecretLikeKey(key: string): boolean`.
4. Test that common key variants are detected case-insensitively.
5. Run `npm run test:assistant -- assistant-policy`; expect PASS.

**Commit:** `security: add assistant policy constants`

### Task 8: Add Assistant Migration Tables

**Files:**
- Modify: `src/db/database.ts`
- Test: `test/assistant/database-assistant-schema.test.ts`

**Steps:**
1. Add `assistant_conversations` table with `id`, `title`, `created_at`, `updated_at`.
2. Add `assistant_messages` table with `id`, `conversation_id`, `role`, `content`, `metadata`, `created_at`.
3. Add `assistant_intents` table with `id`, `conversation_id`, `tool_id`, `status`, `payload`, `result`, `created_at`, `updated_at`.
4. Add `assistant_daily_events` table with `id`, `date`, `status`, `payload`, `error`, `created_at`, `updated_at`, `next_retry_at`.
5. Add indexes by conversation/date/status.
6. Run `npm run build:main`; expect migration compiles.

**Commit:** `feat: add assistant database tables`

### Task 9: Add Conversation Persistence Accessors

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/shared/native-assistant.ts`
- Test: `test/assistant/conversation-store.test.ts`

**Steps:**
1. Add `createAssistantConversation(title?: string)`.
2. Add `listAssistantConversations(limit?: number)`.
3. Add `insertAssistantMessage(message)`.
4. Add `listAssistantMessages(conversationId, limit)`.
5. Test insertion and ordering using deterministic fixture data.
6. Run `npm run test:assistant -- conversation-store`; expect PASS.

**Commit:** `feat: persist assistant conversations`

### Task 10: Add Intent Persistence Accessors

**Files:**
- Modify: `src/db/database.ts`
- Test: `test/assistant/intent-store.test.ts`

**Steps:**
1. Add `insertAssistantIntent`.
2. Add `updateAssistantIntent`.
3. Add `listAssistantIntents`.
4. Store payload/result as JSON with parse fallback to `{}`.
5. Test status transitions from `draft` to `confirmed` to `succeeded`.
6. Run `npm run test:assistant -- intent-store`; expect PASS.

**Commit:** `feat: persist assistant intents`

### Task 11: Add Daily Event Outbox Accessors

**Files:**
- Modify: `src/db/database.ts`
- Test: `test/assistant/daily-event-outbox.test.ts`

**Steps:**
1. Add `insertAssistantDailyEvent`.
2. Add `listPendingAssistantDailyEvents`.
3. Add `updateAssistantDailyEvent`.
4. Add `getAssistantDailyEvent`.
5. Test failed event retry timestamps and sent status.
6. Run `npm run test:assistant -- daily-event-outbox`; expect PASS.

**Commit:** `feat: persist assistant daily events`

### Task 12: Add Assistant Context Gateway Shell

**Files:**
- Create: `src/main/assistant-context.ts`
- Test: `test/assistant/context-gateway.test.ts`

**Steps:**
1. Define `AssistantContextSnapshot` shape in `src/shared/native-assistant.ts`.
2. Add `buildAssistantContext(input)` in `src/main/assistant-context.ts`.
3. Return empty arrays for each context section initially.
4. Test that requesting no scopes returns a valid empty snapshot.
5. Run `npm run test:assistant -- context-gateway`; expect PASS.

**Commit:** `feat: add assistant context gateway`

### Task 13: Add Date Range Guard

**Files:**
- Create: `src/main/assistant-date-range.ts`
- Test: `test/assistant/date-range.test.ts`

**Steps:**
1. Add `assistantDateRange(scope, now)` for today/week/month.
2. Clamp ranges to ISO strings.
3. Reject ranges longer than 31 days for model context.
4. Test today and week boundaries.
5. Run `npm run test:assistant -- date-range`; expect PASS.

**Commit:** `feat: add assistant date range guard`

### Task 14: Add Redaction Helper

**Files:**
- Create: `src/main/assistant-redaction.ts`
- Test: `test/assistant/redaction.test.ts`

**Steps:**
1. Add recursive `redactForAssistant(value)`.
2. Replace secret-like keys with `[redacted]`.
3. Truncate long strings using policy constants.
4. Preserve dates, ids, project names, titles, and non-secret metadata.
5. Run `npm run test:assistant -- redaction`; expect PASS.

**Commit:** `security: add assistant context redaction`

### Task 15: Add Context Budgeter

**Files:**
- Create: `src/main/assistant-context-budget.ts`
- Test: `test/assistant/context-budget.test.ts`

**Steps:**
1. Add `limitAssistantItems(items, limit)`.
2. Add `limitAssistantText(text, maxChars)`.
3. Add dropped-item metadata so the assistant can say context was summarized.
4. Test deterministic truncation.
5. Run `npm run test:assistant -- context-budget`; expect PASS.

**Commit:** `feat: bound assistant context payloads`

### Task 16: Add Projects Context Provider

**Files:**
- Modify: `src/main/assistant-context.ts`
- Test: `test/assistant/context-projects.test.ts`

**Steps:**
1. Read projects using existing `listProjects`.
2. Include id, name, client, repo status, evidence status, archived flag.
3. Exclude raw worker tokens and internal settings.
4. Sort active projects before archived projects.
5. Run `npm run test:assistant -- context-projects`; expect PASS.

**Commit:** `feat: expose read-only project context`

### Task 17: Add Work Entries Context Provider

**Files:**
- Modify: `src/main/assistant-context.ts`
- Test: `test/assistant/context-entries.test.ts`

**Steps:**
1. Read time entries for the requested date range with `listEntries`.
2. Include project id, description, start/end, duration, tags, evidence status.
3. Do not include synced worker payloads.
4. Add total duration summary.
5. Run `npm run test:assistant -- context-entries`; expect PASS.

**Commit:** `feat: expose read-only work entry context`

### Task 18: Add Running Timer Context Provider

**Files:**
- Modify: `src/main/assistant-context.ts`
- Test: `test/assistant/context-timer.test.ts`

**Steps:**
1. Use `getRunningEntry`.
2. Include running state, project id, description, target seconds, elapsed estimate.
3. Do not allow the provider to stop or mutate the timer.
4. Test running and not-running states.
5. Run `npm run test:assistant -- context-timer`; expect PASS.

**Commit:** `feat: expose read-only timer context`

### Task 19: Add Evidence And Report Context Provider

**Files:**
- Modify: `src/main/assistant-context.ts`
- Test: `test/assistant/context-evidence.test.ts`

**Steps:**
1. Use existing `computeEvidenceSummary`.
2. Include missing/evidenced entry counts and project repo coverage.
3. Include current standup evidence record if available.
4. Keep GitHub activity details separate from evidence summary.
5. Run `npm run test:assistant -- context-evidence`; expect PASS.

**Commit:** `feat: expose assistant evidence context`

### Task 20: Add GitHub Activity Context Provider

**Files:**
- Modify: `src/main/assistant-context.ts`
- Test: `test/assistant/context-github-activity.test.ts`

**Steps:**
1. Query `listGitHubActivity` by project and date range.
2. Include kind, title, url, actor, occurredAt, repo full name.
3. Limit activity to policy budget.
4. Redact metadata through `redactForAssistant`.
5. Run `npm run test:assistant -- context-github-activity`; expect PASS.

**Commit:** `feat: expose bounded github activity context`

### Task 21: Add Agent Session Context Provider

**Files:**
- Modify: `src/main/assistant-context.ts`
- Modify: `src/main/agent-sessions.ts`
- Test: `test/assistant/context-agent-sessions.test.ts`

**Steps:**
1. Reuse `agentSessionStatus` and pending session candidates.
2. Include provider, title, project, confidence, match status, duration, and source label.
3. Exclude full file paths unless admin diagnostics requests them.
4. Include consent state.
5. Run `npm run test:assistant -- context-agent-sessions`; expect PASS.

**Commit:** `feat: expose assistant session context`

### Task 22: Add Session Grouping Algorithm

**Files:**
- Create: `src/main/assistant-session-groups.ts`
- Test: `test/assistant/session-groups.test.ts`

**Steps:**
1. Group sessions by project id when available.
2. Group unmatched sessions by repo root or normalized title.
3. Add provider counts and earliest/latest timestamps.
4. Add confidence rollup using average confidence and match status.
5. Run `npm run test:assistant -- session-groups`; expect PASS.

**Commit:** `feat: group local agent sessions for assistant`

### Task 23: Add Session Theme Extractor

**Files:**
- Modify: `src/main/assistant-session-groups.ts`
- Test: `test/assistant/session-theme.test.ts`

**Steps:**
1. Derive lightweight themes from candidate title, project, repo, and confidence reasons.
2. Avoid reading full prompt text in this task.
3. Normalize common themes like release, review, bugfix, design, planning, deploy, docs.
4. Add deterministic test cases.
5. Run `npm run test:assistant -- session-theme`; expect PASS.

**Commit:** `feat: infer assistant session group themes`

### Task 24: Add Infra Context Provider

**Files:**
- Modify: `src/main/assistant-context.ts`
- Test: `test/assistant/context-infra.test.ts`

**Steps:**
1. Include Worker connection status through `workerStatus`.
2. Include Thoughtseed bridge configured/connected state without token values.
3. Include update status summary.
4. Include optional Fabric/Paperclip status only as `optionalHelpers`.
5. Run `npm run test:assistant -- context-infra`; expect PASS.

**Commit:** `feat: expose read-only infra context`

### Task 25: Add App Route Context Provider

**Files:**
- Modify: `src/shared/native-assistant.ts`
- Modify: `src/main/assistant-context.ts`
- Modify: `src/renderer/App.tsx`

**Steps:**
1. Add renderer-to-main IPC payload for current route key and selected project id.
2. Store the current route state in memory in main process.
3. Include route state in assistant context.
4. Verify `npm run typecheck`.
5. Confirm no database writes happen from route context updates.

**Commit:** `feat: expose app route context to assistant`

### Task 26: Add Model Provider Config Types

**Files:**
- Create: `src/main/assistant-model-config.ts`
- Modify: `src/shared/native-assistant.ts`
- Test: `test/assistant/model-config.test.ts`

**Steps:**
1. Define provider types for `google`, `nvidia`, `auto`, and `mock`.
2. Add default model names in one config object.
3. Add environment variable names: `GOOGLE_GENERATIVE_AI_API_KEY`, `NVIDIA_API_KEY`.
4. Add `resolveAssistantModelConfig(settings, env)`.
5. Run `npm run test:assistant -- model-config`; expect PASS.

**Commit:** `feat: add assistant model config`

### Task 27: Add Secure Model Key Storage

**Files:**
- Create: `src/main/assistant-secrets.ts`
- Modify: `src/db/database.ts`
- Test: `test/assistant/assistant-secrets.test.ts`

**Steps:**
1. Mirror the safeStorage custody pattern used by bridge credentials.
2. Store Google key under `assistant.googleApiKeyEnc`.
3. Store NVIDIA key under `assistant.nvidiaApiKeyEnc`.
4. Return only booleans in status responses.
5. In tests, mock encryption helpers rather than using live Electron keychain.

**Commit:** `security: store assistant model keys securely`

### Task 28: Add Model Settings IPC Contract

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/preload/preload.ts`
- Modify: `src/main/main.ts`

**Steps:**
1. Add `assistantModelStatus()` to `PlexusAPI`.
2. Add `assistantModelSetConfig(input)` to `PlexusAPI`.
3. Add IPC handlers in main.
4. Ensure responses include provider, model names, and `hasGoogleKey`/`hasNvidiaKey` only.
5. Run `npm run build:preload && npm run build:main`.

**Commit:** `feat: add assistant model settings IPC`

### Task 29: Install AI SDK Provider Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Steps:**
1. Run `npm install ai @ai-sdk/google @ai-sdk/openai-compatible`.
2. Confirm package-lock changes are scoped to these packages and transitive deps.
3. Run `npm run typecheck`.
4. If package ESM types conflict with Electron main build, isolate imports behind dynamic import in later tasks.
5. Commit only package files for this task.

**Commit:** `deps: add assistant model provider packages`

### Task 30: Add Provider Abstraction

**Files:**
- Create: `src/main/assistant-models.ts`
- Test: `test/assistant/model-router.test.ts`

**Steps:**
1. Define `AssistantModelProvider` interface with `generate`, `stream`, and `health`.
2. Add `AssistantModelMessage` and `AssistantModelResult`.
3. Add mock provider implementation for tests and offline smoke.
4. Test that mock provider echoes deterministic content and usage metadata.
5. Run `npm run test:assistant -- model-router`; expect PASS.

**Commit:** `feat: add assistant model abstraction`

### Task 31: Add Google AI Provider

**Files:**
- Modify: `src/main/assistant-models.ts`
- Test: `test/assistant/google-provider.test.ts`

**Steps:**
1. Use `@ai-sdk/google` with AI SDK `generateText`/`streamText`.
2. Keep API key lookup in main process only.
3. Accept model name from `assistant-model-config`.
4. Add a unit test with mocked AI SDK module or fetch.
5. Do not call live Google APIs in CI/local tests.

**Commit:** `feat: add google assistant provider`

### Task 32: Add NVIDIA NIM Provider

**Files:**
- Modify: `src/main/assistant-models.ts`
- Test: `test/assistant/nvidia-provider.test.ts`

**Steps:**
1. Use `@ai-sdk/openai-compatible` `createOpenAICompatible`.
2. Default base URL to `https://integrate.api.nvidia.com/v1`.
3. Read `NVIDIA_API_KEY` or secure stored key.
4. Add mocked test for request construction and model selection.
5. Do not call live NVIDIA APIs in CI/local tests.

**Commit:** `feat: add nvidia nim assistant provider`

### Task 33: Add Provider Fallback Chain

**Files:**
- Modify: `src/main/assistant-models.ts`
- Test: `test/assistant/model-fallback.test.ts`

**Steps:**
1. Add `AssistantModelRouter`.
2. Try configured primary provider first.
3. On quota, auth, timeout, or network failures, try fallback provider.
4. Return fallback metadata so the UI can show degraded state.
5. Run `npm run test:assistant -- model-fallback`; expect PASS.

**Commit:** `feat: add assistant model fallback routing`

### Task 34: Add Model Health Checks

**Files:**
- Modify: `src/main/assistant-models.ts`
- Modify: `src/main/main.ts`
- Test: `test/assistant/model-health.test.ts`

**Steps:**
1. Add `assistantModelHealth()` main function.
2. Health checks should validate config presence without spending tokens by default.
3. Add optional live probe behind explicit `probeLive: true`.
4. Surface auth missing, offline, quota, and ok states.
5. Run `npm run test:assistant -- model-health`; expect PASS.

**Commit:** `feat: add assistant model health checks`

### Task 35: Add Stream Event Normalizer

**Files:**
- Create: `src/main/assistant-stream.ts`
- Test: `test/assistant/assistant-stream.test.ts`

**Steps:**
1. Convert model stream chunks into `AssistantStreamEvent`.
2. Include `message_delta` chunks.
3. Include `error` event with redacted error message.
4. Always finish with `done`.
5. Run `npm run test:assistant -- assistant-stream`; expect PASS.

**Commit:** `feat: normalize assistant model streams`

### Task 36: Add Tool Schema Builder

**Files:**
- Create: `src/main/assistant-tool-schema.ts`
- Test: `test/assistant/tool-schema.test.ts`

**Steps:**
1. Convert `AssistantToolId` registry into model-call tool definitions.
2. Only include read-only tools during initial assistant answer generation.
3. Include write/action tools only when the runtime is creating suggestions, not auto-executing.
4. Test tool schema has no unknown ids.
5. Run `npm run test:assistant -- tool-schema`; expect PASS.

**Commit:** `feat: add assistant tool schemas`

### Task 37: Add Offline Suggestion Provider

**Files:**
- Create: `src/main/assistant-offline.ts`
- Test: `test/assistant/offline-suggestions.test.ts`

**Steps:**
1. Generate deterministic suggestions from context without an LLM.
2. Suggest standup generation when today's work exists and standup proof is missing.
3. Suggest session review when pending grouped sessions exist.
4. Suggest project sync when Worker is connected and project cache is stale.
5. Run `npm run test:assistant -- offline-suggestions`; expect PASS.

**Commit:** `feat: add offline assistant suggestions`

### Task 38: Add Assistant Prompt Builder

**Files:**
- Create: `src/main/assistant-prompt.ts`
- Test: `test/assistant/assistant-prompt.test.ts`

**Steps:**
1. Build a concise system prompt for Plexus-native work assistance.
2. State that context is read-only unless an explicit tool intent is confirmed.
3. Tell the model to prefer app navigation and daily proof suggestions over generic chat.
4. Include optional Paperclip status only as optional helper context.
5. Snapshot test the prompt.

**Commit:** `feat: add assistant system prompt`

### Task 39: Add Assistant Runtime Orchestrator

**Files:**
- Create: `src/main/assistant-runtime.ts`
- Test: `test/assistant/runtime.test.ts`

**Steps:**
1. Combine context builder, prompt builder, model router, stream normalizer, and persistence.
2. Persist user message before model call.
3. Persist assistant final message after stream completion.
4. Fall back to offline suggestions when no model is configured.
5. Run `npm run test:assistant -- runtime`; expect PASS.

**Commit:** `feat: add assistant runtime orchestrator`

### Task 40: Add Permission Registry

**Files:**
- Create: `src/main/assistant-permissions.ts`
- Test: `test/assistant/assistant-permissions.test.ts`

**Steps:**
1. Map each tool id to safety level.
2. Mark context tools as read-only.
3. Mark app actions and daily sending as confirm-required.
4. Mark model config and diagnostics tools admin-only.
5. Run `npm run test:assistant -- assistant-permissions`; expect PASS.

**Commit:** `security: add assistant permission registry`

### Task 41: Add Read-Only Tool Executor

**Files:**
- Create: `src/main/assistant-tools.ts`
- Test: `test/assistant/read-only-tools.test.ts`

**Steps:**
1. Add `executeAssistantTool(toolId, payload, actor)`.
2. Route read-only context tools to context gateway.
3. Reject confirm-required tools unless an approved intent id is present.
4. Redact every tool result.
5. Run `npm run test:assistant -- read-only-tools`; expect PASS.

**Commit:** `feat: execute assistant read-only tools`

### Task 42: Add Navigation Intent Tool

**Files:**
- Modify: `src/main/assistant-tools.ts`
- Modify: `src/shared/native-assistant.ts`
- Modify: `src/renderer/App.tsx`

**Steps:**
1. Define route keys for existing tabs: focus, entries, agents, projects, reports, export, assistant, bridge, realtime, backups, admin, settings.
2. Add `app.navigate` intent payload with `routeKey`.
3. Renderer receives confirmed navigation event and calls existing tab selection.
4. Test invalid route rejection.
5. Run `npm run typecheck`.

**Commit:** `feat: add assistant navigation intent`

### Task 43: Add Standup Generation Intent Tool

**Files:**
- Modify: `src/main/assistant-tools.ts`
- Modify: `src/main/main.ts`
- Test: `test/assistant/standup-tool.test.ts`

**Steps:**
1. Extract current `standup:generate` body into reusable function `generateStandupEvidence(date)`.
2. Reuse that function from IPC and assistant tool.
3. Require confirmation before execution.
4. Persist the intent result with generated record id.
5. Run `npm run test:assistant -- standup-tool`; expect PASS.

**Commit:** `feat: add assistant standup tool`

### Task 44: Add Accept Session Intent Tool

**Files:**
- Modify: `src/main/assistant-tools.ts`
- Modify: `src/main/agent-sessions.ts`
- Test: `test/assistant/accept-session-tool.test.ts`

**Steps:**
1. Wrap existing `acceptAgentSession`.
2. Require confirmation and verified project status.
3. Return created time entry id.
4. Preserve existing failure messages for missing verified repo.
5. Run `npm run test:assistant -- accept-session-tool`; expect PASS.

**Commit:** `feat: add assistant accept-session tool`

### Task 45: Add Start Timer Intent Tool

**Files:**
- Modify: `src/main/assistant-tools.ts`
- Modify: `src/main/timer-session.ts`
- Modify: `src/main/main.ts`
- Test: `test/assistant/start-timer-tool.test.ts`

**Steps:**
1. Extract timer start logic into reusable main function.
2. Require project id and description.
3. Require confirmation before starting.
4. Reject if another timer is running unless future task adds switch flow.
5. Run `npm run test:assistant -- start-timer-tool`; expect PASS.

**Commit:** `feat: add assistant start-timer tool`

### Task 46: Add Sync Projects Intent Tool

**Files:**
- Modify: `src/main/assistant-tools.ts`
- Test: `test/assistant/sync-projects-tool.test.ts`

**Steps:**
1. Wrap existing `syncProjects` from `teamforge.ts`.
2. Require confirmation.
3. Return synced count and message.
4. On failure, create handoff only if existing sync path does so.
5. Run `npm run test:assistant -- sync-projects-tool`; expect PASS.

**Commit:** `feat: add assistant project-sync tool`

### Task 47: Add Tool Confirmation Flow

**Files:**
- Modify: `src/main/assistant-runtime.ts`
- Modify: `src/main/assistant-tools.ts`
- Test: `test/assistant/tool-confirmation.test.ts`

**Steps:**
1. When the assistant proposes a confirm-required action, persist an intent in `draft`.
2. Return the intent id to the renderer.
3. Add `confirmAssistantIntent(intentId)` main function.
4. Execute only after status changes to `confirmed`.
5. Run `npm run test:assistant -- tool-confirmation`; expect PASS.

**Commit:** `feat: require confirmation for assistant actions`

### Task 48: Add Tool Result Audit Records

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/main/assistant-tools.ts`
- Test: `test/assistant/tool-audit.test.ts`

**Steps:**
1. Record start/end time for every confirm-required tool execution.
2. Store redacted input and output.
3. Store failure messages without stack traces.
4. Add list function for admin diagnostics.
5. Run `npm run test:assistant -- tool-audit`; expect PASS.

**Commit:** `feat: audit assistant tool executions`

### Task 49: Add Daily Event Contract

**Files:**
- Modify: `src/shared/native-assistant.ts`
- Test: `test/assistant/daily-event-contract.test.ts`

**Steps:**
1. Add `AssistantDailyEvent` with date, employee/member id, project summaries, session groups, blockers, suggestions, evidence summary.
2. Add `AssistantDailyEventStatus = 'queued' | 'sent' | 'failed'`.
3. Add schema version `thoughtseed.plexus_daily_agent_event.v1`.
4. Test required fields.
5. Run `npm run test:assistant -- daily-event-contract`; expect PASS.

**Commit:** `feat: define assistant daily event contract`

### Task 50: Add Daily Event Builder

**Files:**
- Create: `src/main/assistant-daily.ts`
- Test: `test/assistant/daily-event-builder.test.ts`

**Steps:**
1. Build daily event from assistant context for a date.
2. Include grouped sessions and evidence summary.
3. Include generated standup record id when present.
4. Exclude raw prompt/session file contents.
5. Run `npm run test:assistant -- daily-event-builder`; expect PASS.

**Commit:** `feat: build assistant daily events`

### Task 51: Add Worker Daily Endpoint Client

**Files:**
- Modify: `src/main/teamforge.ts`
- Modify: `src/main/assistant-daily.ts`
- Test: `test/assistant/daily-worker-client.test.ts`

**Steps:**
1. Add `sendDailyAssistantEvent(event)` to Worker client.
2. Target default path `/v1/member/daily-agent-events`.
3. Use existing authenticated `wpost`.
4. Return `{ ok, message, artifactRef? }`.
5. Mock Worker responses in tests.

**Commit:** `feat: send daily assistant events to worker`

### Task 52: Add Hermes Bridge Fallback For Daily Events

**Files:**
- Modify: `src/main/assistant-daily.ts`
- Modify: `src/main/thoughtseed-bridge.ts`
- Test: `test/assistant/daily-bridge-fallback.test.ts`

**Steps:**
1. Export a narrow `sendThoughtseedBridgePayload` helper or add a dedicated daily event function.
2. Send payload type `daily_agent_event` through signed bridge ingest when Worker path is unavailable and bridge is configured.
3. Preserve member-scoped token boundary.
4. Test Worker failure then bridge success.
5. Do not use admin `BRIDGE_TOKEN`.

**Commit:** `feat: add bridge fallback for daily assistant events`

### Task 53: Add Daily Event Queueing

**Files:**
- Modify: `src/main/assistant-daily.ts`
- Modify: `src/db/database.ts`
- Test: `test/assistant/daily-event-queue.test.ts`

**Steps:**
1. Queue event before sending.
2. Mark sent on successful Worker or bridge response.
3. Mark failed with retry timestamp on failure.
4. Store remote artifact reference when returned.
5. Run `npm run test:assistant -- daily-event-queue`; expect PASS.

**Commit:** `feat: queue assistant daily events`

### Task 54: Add Daily Event Retry Worker

**Files:**
- Modify: `src/main/assistant-daily.ts`
- Modify: `src/main/main.ts`
- Test: `test/assistant/daily-event-retry.test.ts`

**Steps:**
1. Add `flushAssistantDailyEvents`.
2. Run it at startup after DB ready.
3. Run it on an interval similar to time entry flush.
4. Avoid parallel flushes with an in-memory lock.
5. Test idempotent retry behavior.

**Commit:** `feat: retry assistant daily events`

### Task 55: Add Handoff Integration For Daily Failures

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/assistant-daily.ts`
- Modify: `src/main/main.ts`

**Steps:**
1. Add `assistant_daily_event` to `HandoffKind`.
2. Record failed daily sends as retryable handoffs.
3. Wire `retryHandoff` to flush the specific daily event when possible.
4. Show concise employee copy in the follow-up queue.
5. Run `npm run typecheck`.

**Commit:** `feat: add daily assistant handoffs`

### Task 56: Add Vault/R2 Confirmation Reader

**Files:**
- Modify: `src/main/teamforge.ts`
- Modify: `src/main/assistant-daily.ts`
- Test: `test/assistant/daily-confirmation.test.ts`

**Steps:**
1. Add optional `getDailyAssistantEventStatus(date)` Worker client.
2. Read artifact ref or R2/vault confirmation when Worker supports it.
3. Return unknown status without failing if endpoint is absent.
4. Test ok, missing, and endpoint-not-found cases.
5. Keep this read-only.

**Commit:** `feat: read daily assistant delivery status`

### Task 57: Add Daily Summary Generator

**Files:**
- Modify: `src/main/assistant-daily.ts`
- Test: `test/assistant/daily-summary.test.ts`

**Steps:**
1. Generate a short local summary from event payload.
2. Include yesterday/today/blockers style fields when possible.
3. Include top session groups.
4. Include missing proof note.
5. Run `npm run test:assistant -- daily-summary`; expect PASS.

**Commit:** `feat: summarize assistant daily events`

### Task 58: Add Proactive Suggestion Engine

**Files:**
- Create: `src/main/assistant-suggestions.ts`
- Test: `test/assistant/proactive-suggestions.test.ts`

**Steps:**
1. Generate suggestions from context and offline provider.
2. Add suggestion types for standup, session grouping, missing proof, navigate reports, sync projects, check settings.
3. Add confidence scores.
4. Deduplicate suggestions by type and project/date.
5. Run `npm run test:assistant -- proactive-suggestions`; expect PASS.

**Commit:** `feat: add proactive assistant suggestions`

### Task 59: Add Suggestion Throttling

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/main/assistant-suggestions.ts`
- Test: `test/assistant/suggestion-throttle.test.ts`

**Steps:**
1. Add `assistant_suggestion_dismissals` table or reuse settings for per-suggestion cooldowns.
2. Dismissed suggestions should not reappear for the configured cooldown.
3. Critical missing-proof suggestions may reappear the next day.
4. Test cooldown behavior.
5. Run `npm run test:assistant -- suggestion-throttle`; expect PASS.

**Commit:** `feat: throttle assistant suggestions`

### Task 60: Add Focus Nudge Integration

**Files:**
- Modify: `src/main/focus-nudge.ts`
- Modify: `src/main/assistant-suggestions.ts`
- Test: `test/assistant/focus-nudge-suggestions.test.ts`

**Steps:**
1. Let focus nudge request read-only assistant suggestions.
2. Do not call models from the nudge loop unless assistant is enabled and model health is ok.
3. Prefer offline suggestions for background nudges.
4. Keep existing nudge behavior if assistant is off.
5. Run `npm run test:assistant -- focus-nudge-suggestions`; expect PASS.

**Commit:** `feat: connect assistant suggestions to focus nudges`

### Task 61: Add Assistant IPC Surface

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/preload/preload.ts`
- Modify: `src/main/main.ts`

**Steps:**
1. Add `assistantStatus`.
2. Add `assistantAsk`.
3. Add `assistantStream` or event subscription pattern.
4. Add `assistantSuggestions`.
5. Add `assistantConfirmIntent` and `assistantCancelIntent`.
6. Run `npm run build:preload && npm run build:main`.

**Commit:** `feat: expose assistant ipc api`

### Task 62: Add Assistant Event Subscription

**Files:**
- Modify: `src/preload/preload.ts`
- Modify: `src/main/main.ts`
- Modify: `src/shared/types.ts`

**Steps:**
1. Add `onAssistantEvent(callback)` to `PlexusAPI`.
2. Stream events through `mainWindow.webContents.send('assistant:event', event)`.
3. Return unsubscribe function in preload.
4. Ensure event payloads match `AssistantStreamEvent`.
5. Run `npm run build:preload && npm run build:main`.

**Commit:** `feat: stream assistant events to renderer`

### Task 63: Add Assistant Panel Component

**Files:**
- Create: `src/renderer/components/AssistantPanel.tsx`
- Modify: `src/renderer/App.tsx`

**Steps:**
1. Render a work-focused assistant surface as an actual tool, not a marketing page.
2. Include conversation list, current messages, context summary, suggestions, and action confirmations.
3. Use existing `InstrumentPanel`, `CommandDock`, `StatusChip`, and `Button`.
4. Add app tab key `assistant`.
5. Run `npm run typecheck`.

**Commit:** `feat: add assistant panel`

### Task 64: Add Assistant Message List

**Files:**
- Create: `src/renderer/components/AssistantMessageList.tsx`
- Modify: `src/renderer/components/AssistantPanel.tsx`

**Steps:**
1. Render user, assistant, tool, and error messages.
2. Keep messages compact and scannable.
3. Show model provider/fallback state in small metadata.
4. Do not show raw tool JSON by default.
5. Run `npm run typecheck`.

**Commit:** `feat: render assistant messages`

### Task 65: Add Assistant Composer

**Files:**
- Create: `src/renderer/components/AssistantComposer.tsx`
- Modify: `src/renderer/components/AssistantPanel.tsx`

**Steps:**
1. Add textarea input with send button.
2. Disable send while streaming.
3. Add context scope selector: today, week, project, session groups, infra.
4. Submit `assistantAsk` through `window.plexus`.
5. Run `npm run typecheck`.

**Commit:** `feat: add assistant composer`

### Task 66: Add Assistant Context Drawer

**Files:**
- Create: `src/renderer/components/AssistantContextDrawer.tsx`
- Modify: `src/renderer/components/AssistantPanel.tsx`

**Steps:**
1. Show which context sections are included.
2. Show counts and truncation notices.
3. Avoid raw session text.
4. Show optional helper status separately from core context.
5. Run `npm run typecheck`.

**Commit:** `feat: show assistant context drawer`

### Task 67: Add Assistant Suggestion Rail

**Files:**
- Create: `src/renderer/components/AssistantSuggestionRail.tsx`
- Modify: `src/renderer/components/AssistantPanel.tsx`

**Steps:**
1. Render proactive suggestions from `assistantSuggestions`.
2. Include action buttons for navigate, generate standup, review sessions, and sync projects.
3. Require confirmation for every action.
4. Add dismiss button.
5. Run `npm run typecheck`.

**Commit:** `feat: render assistant suggestions`

### Task 68: Add Action Confirmation Modal

**Files:**
- Create: `src/renderer/components/AssistantActionConfirmModal.tsx`
- Modify: `src/renderer/components/AssistantPanel.tsx`

**Steps:**
1. Render pending intent title, body, payload summary, and safety explanation.
2. Provide Confirm and Cancel actions.
3. Call `assistantConfirmIntent` or `assistantCancelIntent`.
4. Show result message after execution.
5. Run `npm run typecheck`.

**Commit:** `feat: add assistant action confirmations`

### Task 69: Add Assistant Settings Section

**Files:**
- Modify: `src/renderer/components/Settings.tsx`

**Steps:**
1. Add assistant enabled toggle.
2. Add provider selector: auto, Google, NVIDIA, mock.
3. Add secure key input flows that never echo stored keys.
4. Add session scanning consent toggle.
5. Add Paperclip enrichment toggle.
6. Run `npm run typecheck`.

**Commit:** `feat: add assistant settings`

### Task 70: Add Assistant Status To Header

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/ConnectionStatus.tsx`

**Steps:**
1. Show assistant status as ready, needs model key, offline suggestions, or disabled.
2. Keep status compact.
3. Do not make assistant status an app-wide blocker.
4. Link status click to Settings or Assistant panel.
5. Run `npm run typecheck`.

**Commit:** `feat: surface assistant status`

### Task 71: Add Timer Page Assistant CTA

**Files:**
- Modify: `src/renderer/components/Timer.tsx`
- Modify: `src/renderer/components/AgentSessionFocusRail.tsx`

**Steps:**
1. Add "Review today's context" assistant CTA.
2. Add "Group recent sessions" CTA when pending sessions exist.
3. Navigate to Assistant tab with scope preset.
4. Preserve existing timer UX.
5. Run `npm run typecheck`.

**Commit:** `feat: connect assistant to focus surface`

### Task 72: Add Reports Page Assistant CTA

**Files:**
- Modify: `src/renderer/components/Reports.tsx`

**Steps:**
1. Add "Prepare daily update" CTA.
2. Add "Explain missing proof" CTA.
3. Pass date/report context to Assistant panel.
4. Keep reports usable without assistant enabled.
5. Run `npm run typecheck`.

**Commit:** `feat: connect assistant to reports`

### Task 73: Demote Paperclip In Onboarding

**Files:**
- Modify: `src/renderer/components/Onboarding.tsx`
- Modify: `src/main/teamforge.ts`

**Steps:**
1. Keep `paperclip` optional.
2. Change `daily_agent` readiness to assistant/Worker readiness, not Fabric port reachability.
3. Allow daily agent step completion when assistant is enabled and Worker or local queue is ready.
4. Keep local helper check as optional.
5. Run `npm run typecheck`.

**Commit:** `fix: decouple daily agent onboarding from fabric`

### Task 74: Rename Fabric Navigation Copy

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/AgentFabricPanel.tsx`

**Steps:**
1. Rename nav label from `Fabric` to `Local Helpers` or `Optional Helpers`.
2. Keep task assignment card available if bridge credentials exist.
3. Remove implication that Fabric is the agent runtime center.
4. Link users to Assistant for daily agent work.
5. Run `npm run typecheck`.

**Commit:** `copy: demote fabric to optional helpers`

### Task 75: Split Fabric Status From Daily Proof

**Files:**
- Modify: `src/main/fabric.ts`
- Modify: `src/renderer/components/AgentFabricPanel.tsx`

**Steps:**
1. Stop using Paperclip repo standup files as the primary daily proof source.
2. Prefer assistant daily event/standup evidence status.
3. Keep Paperclip vault standups as optional enrichment.
4. Label optional helper failures as optional.
5. Run `npm run typecheck`.

**Commit:** `fix: make daily proof provider-neutral`

### Task 76: Add Assistant Diagnostics

**Files:**
- Modify: `src/renderer/components/AdminDiagnosticsPanel.tsx`
- Modify: `src/main/main.ts`

**Steps:**
1. Add assistant model status.
2. Add context sections and truncation counts.
3. Add daily outbox state.
4. Add last tool execution result.
5. Do not show API key values or tokens.
6. Run `npm run typecheck`.

**Commit:** `feat: add assistant admin diagnostics`

### Task 77: Update Resilience Review

**Files:**
- Modify: `docs/APP_RESILIENCE_REVIEW.md`

**Steps:**
1. Add assistant as a core-but-degradable service.
2. State model outage results in offline suggestions, not app failure.
3. State Paperclip outage does not block assistant daily flow.
4. State Worker outage queues daily events.
5. Keep security boundaries explicit.

**Commit:** `docs: update assistant resilience model`

### Task 78: Update Architecture Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/HANDOFF.md`
- Modify: `docs/THOUGHTSEED_BRIDGE_HANDOFF.md`

**Steps:**
1. Replace Fabric-first architecture language with assistant-first architecture.
2. Mark Paperclip/Fabric as optional helper layer.
3. Document daily event path: Plexus -> Worker/Hermes -> R2/vault.
4. Preserve member-scoped bridge token warning.
5. Run `npm run copy:audit` if present.

**Commit:** `docs: document native assistant architecture`

### Task 79: Add Context Gateway Smoke Script

**Files:**
- Create: `scripts/smoke-assistant-context.mjs`
- Modify: `package.json`

**Steps:**
1. Build main first or import compiled `dist/main` modules.
2. Request today/week/session/infra context.
3. Assert no secret-like values appear.
4. Print section counts.
5. Add `smoke:assistant-context` script.

**Verify:**
```bash
npm run build:main
npm run smoke:assistant-context
```

**Commit:** `test: add assistant context smoke`

### Task 80: Add Model Router Smoke Script

**Files:**
- Create: `scripts/smoke-assistant-models.mjs`
- Modify: `package.json`

**Steps:**
1. Use mock provider by default.
2. Add optional live mode when `ASSISTANT_LIVE_MODEL_SMOKE=1`.
3. Assert fallback metadata is present when primary mock fails.
4. Add `smoke:assistant-models` script.
5. Run with default mock mode.

**Commit:** `test: add assistant model smoke`

### Task 81: Add Daily Event Smoke Script

**Files:**
- Create: `scripts/smoke-assistant-daily.mjs`
- Modify: `package.json`

**Steps:**
1. Build daily event for today's date.
2. Queue it locally with `dryRun: true`.
3. Assert payload has schema version and no secrets.
4. Assert queue record can be marked skipped/dry-run.
5. Add `smoke:assistant-daily` script.

**Commit:** `test: add assistant daily smoke`

### Task 82: Add Renderer Smoke Checklist

**Files:**
- Create: `docs/evidence/assistant-runtime-smoke-checklist.md`

**Steps:**
1. List manual screenshot checks for Assistant panel, Settings, Timer CTA, Reports CTA, Optional Helpers, Admin Diagnostics.
2. Include model-unconfigured state.
3. Include offline Worker state.
4. Include Paperclip disabled state.
5. Include assistant action confirmation state.

**Commit:** `docs: add assistant runtime smoke checklist`

### Task 83: Run Full Local Verification

**Files:**
- No source edits unless failures require follow-up tasks.

**Steps:**
1. Run `npm run test:assistant`.
2. Run `npm run smoke:assistant-context`.
3. Run `npm run smoke:assistant-models`.
4. Run `npm run smoke:assistant-daily`.
5. Run `npm run typecheck`.
6. Run `npm run lint -- --quiet`.
7. Run `npm run build:main`.
8. Run `npm run build:preload`.
9. Run `npm exec vite -- build`.

**Commit:** `chore: verify assistant runtime locally`

### Task 84: Run Packaged-App Preview

**Files:**
- Create: `docs/evidence/YYYY-MM-DD-assistant-runtime-preview/README.md`

**Steps:**
1. Run `npm run release:dry-run` with existing notarization skip env if needed.
2. Launch packaged app.
3. Capture screenshots of Assistant, Settings assistant section, Reports CTA, Optional Helpers, and Admin Diagnostics.
4. Record which checks are deterministic local proof versus live model/Worker proof.
5. Do not claim live provider proof unless live probes were actually run.

**Commit:** `docs: add assistant packaged preview evidence`

### Task 85: Prepare PR And Release Handoff

**Files:**
- Modify: `docs/HANDOFF.md`
- Create: `docs/evidence/YYYY-MM-DD-assistant-runtime-release-gates.md`

**Steps:**
1. Summarize changed files by subsystem.
2. Include all verification command outputs.
3. Include known live blockers: model API keys, Worker endpoint availability, Hermes/R2 confirmation.
4. Include rollback plan: disable assistant flag, keep Fabric optional helper unchanged.
5. Open PR with focused title: `feat: add Plexus native assistant runtime`.
6. Do not tag OTA release until PR is merged and `release:ota:prep` passes.

**Commit:** `docs: prepare assistant runtime handoff`

## Execution Handoff

Plan complete. Suggested execution mode:

1. Implement Tasks 1-8 in one small branch to establish contracts and test harness.
2. Split Tasks 9-78 across the parallel workstreams above.
3. Rejoin at Tasks 79-85 for smoke scripts, packaged preview, and release handoff.

Use subagents only after the shared contracts land. Before Task 8, shared files are too volatile and parallel edits would create churn.
