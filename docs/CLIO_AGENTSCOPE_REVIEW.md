# Clio + AgentScope 2.x review — historical design input

Status: historical July review, reconciled with Plexus v0.7.12 source on
2026-09-05. AgentScope is design inspiration, not a dependency or service shipped
with Plexus; the external project's current version/capabilities were not
re-audited here. See [runtime contract](ASSISTANT_RUNTIME_CONTRACT.md) and
[documentation map](DOCUMENTATION_MAP.md).

## September source disposition

- The current normal model route is a governed OmniRoute lane through the Clio
  relay. Explicit mock selection is the deterministic alternative. Direct local,
  Google and NVIDIA adapter functions remain in source, but normal provider
  construction/order no longer selects them as a desktop fallback chain.
- Versioned run events, keyed read-only tool descriptors, the full-stream adapter
  and persisted approval intents remain source responsibilities; none proves a
  successful live model turn in this documentation pass.
- Admin capabilities remain declared-only with no executor. `daily.sendEvent`
  has a confirmed-action executor but is also labeled declared-only in the
  catalog. That mismatch requires source reconciliation, not a claim that the
  daily executor does not exist.
- Paperclip/local Fabric have been retired. Local memory remains consent-gated;
  member reporting follows the bridge/Hermes contract.

## Original July review

Reviewed 2026-07-22 against the official [AgentScope repository](https://github.com/agentscope-ai/agentscope) and its [2.0 release notes](https://github.com/agentscope-ai/agentscope/releases).

## What AgentScope contributes

AgentScope 2.x is not just an agent loop. Its important production ideas are:

- A unified event stream that makes model calls, text blocks, tool calls, and human-in-the-loop states visible to a frontend.
- Fine-grained permissions around tools and resources.
- A toolkit abstraction that makes capabilities discoverable and composable.
- Middleware hooks around the reasoning/acting loop.
- Context compression and tool-result compaction for long sessions.
- Optional workspaces and sandboxes for isolated tool execution.
- Multi-session/multi-tenant service infrastructure and agent teams.

The official repository also calls out RAG, agentic memory, Mem0/ReMe integrations, and agent teams as current ecosystem capabilities. These are valuable future directions, but they are not all appropriate for a native employee desktop app.

## Clio baseline at the July review

Clio already has several of the right primitives:

| Concern | July Clio surface |
|---|---|
| Model routing | `src/main/assistant-models.ts` with local/Google/NVIDIA/mock providers and fallback |
| Bounded context | `src/main/assistant-context.ts` with item and text budgets |
| Tool declarations | `buildAssistantToolSchemas()` in `src/main/assistant-runtime.ts` |
| Permission boundary | `src/main/assistant-permissions.ts` and `src/main/assistant-tools.ts` |
| Human approval | persisted draft/confirmed intents in `assistant-tools.ts` and `main.ts` IPC |
| Frontend stream | typed `assistant:event` IPC through `src/preload/preload.ts` |
| Local memory | consent-gated agent-session discovery in `src/main/agent-sessions.ts` |
| Secret boundary | model secrets and bridge tokens stay in the Electron main process |

## Important gap found and fixed

The baseline had two disconnected contracts: `buildAssistantToolSchemas()` returned an array, while AI SDK 7 expects a name-keyed `ToolSet`; and the provider adapter consumed `textStream` only, which discards tool-call/result parts. That prevented any model-emitted capability from becoming an observable runtime event.

This slice now supplies a keyed ToolSet and consumes the AI SDK full stream for read-only tools. Read-only calls can execute through Clio's existing `executeAssistantTool()` choke point and appear as redacted `tool_call` / `tool_result` events. Confirm-required and admin tools remain absent from the automatic model ToolSet and continue through the explicit intent path.

## Source changes recorded in the July slice

This upgrade borrows the low-risk primitives first:

1. The existing `assistant:event` channel now carries versioned run lifecycle records for model and offline turns.
2. Each turn has one run identifier, with explicit model-call start/end and final run status.
3. The installed AI SDK receives a keyed read-only ToolSet and full stream parts are normalized into Clio events.
4. Confirmation-backed suggestions emit an `approval_required` record with only the tool id and intent id.
5. A read-only `assistant:capabilities` IPC method returns a deterministic descriptor catalog for every registered tool, including safety, confirmation, admin-only, execution-class, and availability metadata.
6. Admin and daily-delivery entries were marked `declared_only`. The September source audit above distinguishes the implemented daily executor from unimplemented admin executors; the status alone cannot prove executor absence.
7. Catalog, tool events, and lifecycle payloads are descriptors only; they do not contain raw payloads, file paths, model keys, bridge tokens, cookies, JWTs, or transcript content.

## Deliberately deferred

- Automatic execution of confirm-required or admin tools.
- Middleware hooks for prompt/model/tool stages.
- Sandboxed workspaces or remote code execution.
- Multi-tenant serving, agent teams, RAG, and long-term memory services.

Those features need a separate trust-model and persistence design. The next safe step would be a read-only tool execution prototype, followed by explicit approval integration for write-capable tools; automatic writes should not be added as a side effect of this review.
