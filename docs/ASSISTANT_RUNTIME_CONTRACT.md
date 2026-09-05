# Assistant Runtime Contract

This contract defines the local Clio assistant loop for confirm-required actions,
runtime state transitions, and audit evidence. Source reviewed 2026-09-05 at
v0.7.12. This contract is source-level authority; current provider health and
installed-app behavior require their own receipts. See [the documentation
map](DOCUMENTATION_MAP.md).

## Current runtime and routing

`assistant-runtime.ts` builds bounded context, streams versioned run/model/tool
events, and exposes `buildAssistantCapabilityCatalog()`. Normal model selection
uses a governed OmniRoute lane via `assistant-omniroute.ts`; the production relay
is `https://clio-relay.thoughtseed.space`. An explicitly selected deterministic
mock is the test alternative. Google/NVIDIA/local adapter functions remain in
`assistant-models.ts`, but `createAssistantModelProviders()` and `providerOrder()`
do not select them as the production fallback chain. Provider failover belongs
to the remote governed service, not employee API-key settings.

The packaged relay origin is source-pinned. Loopback development overrides and
authenticated Access requests are main-process responsibilities. The renderer
receives catalog/status/events, not relay provider credentials. Paperclip and
the local Fabric runtime are retired; neither is a runtime dependency.

The automatic AI SDK ToolSet contains bounded read-only tools. Confirm-required
writes remain outside that set and use the persisted intent path below. A
catalog entry, selected lane or `READY` status is not proof that a content-bearing
streamed turn completed.

## Runtime States

Assistant renderer state is derived from stream events and must stay read-only
until a confirmed action is executed by the main process.

| State | Entered by | Leaves by |
|---|---|---|
| `idle` | no active turn | user message |
| `loading` | turn accepted and context building | first streamed token, suggestion, error, or done |
| `streaming` | model or offline assistant content is emitted | suggestion, error, or done |
| `tool_wait` | confirm-required suggestion is materialized | confirm, cancel, expiry, or turn reset |
| `error` | runtime/model/tool failure | next user turn |
| `done` | runtime emits final done event | next user turn |

The renderer never marks a side effect complete from local UI state alone. It
only renders tool completion after the main process returns an execution result
or a persisted intent update.

Renderer-local suggestions are guidance only when they do not include a
persisted `intentId`. They cannot run write-capable fallback IPC from the
renderer.

## Intent Lifecycle

Confirm-required tools use persisted `assistant_intents` rows.

| Status | Meaning | Allowed next statuses |
|---|---|---|
| `draft` | suggestion exists, user has not confirmed | `confirmed`, `cancelled`, `failed` |
| `confirmed` | user approved the exact payload | `running`, `cancelled`, `failed` |
| `running` | intent has been atomically claimed | `succeeded`, `failed` |
| `succeeded` | action completed and audit was written | terminal |
| `failed` | action failed, expired, or validation rejected | terminal |
| `cancelled` | user cancelled before execution | terminal |

Draft intents receive an `expires_at` timestamp when they are materialized.
Confirmation preserves that timestamp or assigns a fresh 15 minute TTL for
legacy rows. Execution can only claim a row when it is `confirmed`,
`consumed_at IS NULL`, and `expires_at` is either null or still in the future.

`consumed_at` is written by the database claim operation before side effects
run. Replay attempts reject before dispatching navigation, timers, sync,
standup generation, or daily event delivery.

## Confirmed Tool Payloads

The payload used at execution must match the confirmed payload exactly. The
runtime rejects mismatched payloads before any side effect. This makes the
confirmation dialog the durable approval record for:

- `app.navigate`
- `app.generateStandup`
- `app.acceptSession`
- `app.startTimer`
- `app.syncProjects`
- `daily.sendEvent`

Read-only context tools do not require persisted intent rows.

## Daily Event Boundary

`daily.sendEvent` is a confirm-required action. After confirmation it builds a
fresh assistant context in the main process, creates a daily event payload, and
queues delivery through `queueAndSendAssistantDailyEvent`.

Execution rechecks the active UTC date, member identity and persisted standup
evidence against the confirmed payload before enqueueing. The assistant returns
the persisted daily event id, date, delivery status,
artifact reference, and retry timestamp. Worker and bridge delivery remain in
the daily event service. The confirmed action enqueues and may attempt delivery;
its response reports the observed state. A queued event or Worker fallback is
not proof of Hermes receipt. See the [reporting contract](architecture/HERMES_REPORTING_CONTRACT.md).

There is an unresolved source discrepancy: `assistant-tools.ts` implements
`daily.sendEvent`, while `buildAssistantCapabilityCatalog()` in
`assistant-runtime.ts` marks it `declared_only` alongside admin tools. Admin
`modelConfig` and `diagnostics` throw because they have no executor; daily
send is different. Keep the catalog's actual status visible until its declaration
and executor tests are reconciled; do not describe daily send as unimplemented.

## Audit Evidence

Every confirm-required execution writes an `assistant_tool_audits` row after the
intent has been claimed.

Audit rows include:

- `intent_id`, `tool_id`, `status`, `actor_id`
- `started_at`, `ended_at`, `duration_ms`
- redacted input and output JSON
- sanitized error text for failures
- `failure_kind` for failed executions

`failure_kind` values are:

- `expired`
- `replay`
- `validation`
- `permission`
- `execution`

Secrets are redacted recursively before input, output, or failure content is
persisted.

Proof-bearing actions also write `proof_custody_records`; see
[proof custody](PROOF_CUSTODY.md).

## Local Proof Commands

These commands are validation instructions, not results from this documentation pass:

```bash
npm run typecheck
npm run test:assistant -- --run test/assistant/tool-confirmation.test.ts test/assistant/tool-audit.test.ts test/assistant/intent-store.test.ts test/assistant/database-assistant-schema.test.ts
npm run smoke:assistant-daily
npm run verify:all
```
