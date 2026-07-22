# Clio + AgentScope 2.x review

Reviewed 2026-07-22 against the dirty AgentScope proposal and current main.

## Safe primitives retained

Clio already has model routing, bounded context, typed IPC streaming, persisted
approval intents, permission policy, and main-process secret custody. This
slice adds the lowest-risk AgentScope-shaped primitives without replacing that
existing trust boundary:

- versioned run and model-call lifecycle events;
- one run identifier per assistant turn;
- explicit approval-required events for confirmed intents;
- a deterministic capability catalog with safety and availability metadata;
- provider normalization for tool-call, tool-result, tool-error, and stream
  error parts with bounded redaction;
- an optional max-tool-step signal passed to the model provider.

## Deliberate boundary

Current main's runtime still owns tool validation, confirmation, timeouts, and
execution through `executeAssistantTool()`. The automatic AI SDK keyed ToolSet
is exposed as a typed capability seam but is not installed as an implicit
execution path in this slice. This avoids bypassing confirmed intents or
running a new tool middleware path without an end-to-end security review.

Confirm-required and admin tools therefore remain absent from automatic model
execution. Admin diagnostics and daily delivery are reported as
`declared_only` in the capability catalog. Lifecycle, catalog, and tool events
contain no model keys, bridge tokens, cookies, JWTs, raw file paths, or raw
transcripts.

## Deferred AgentScope work

- automatic read-only ToolSet execution through the AI SDK;
- middleware hooks around prompt/model/tool stages;
- sandboxed workspaces or remote code execution;
- context compression and long-session result compaction;
- multi-tenant serving, agent teams, RAG, and long-term memory services.

Those changes need a separate trust-model, persistence, and E2E review. This
document is scope evidence for the assistant commit, not a claim that the
complete AgentScope feature set has shipped.
