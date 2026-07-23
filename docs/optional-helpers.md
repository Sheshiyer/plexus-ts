# Optional Helpers (retired)

**Status (2026-07-23): the Paperclip/Fabric optional-helper surface has been removed from Plexus.**
Clio now runs the AgentScope-based runtime (see `docs/CLIO_AGENTSCOPE_REVIEW.md`), and channel
updates (daily standups, digests, KPI reports) are delivered by the Hermes bridge: Hermes cron
routines poll Plexus's Worker (`/v1/member/kpi`) and post to the team Telegram channel topics.
Spec: `docs/superpowers/specs/2026-07-23-paperclip-retirement-design.md`.

## What remains in the codebase

Wire-compatibility only — the Worker still speaks the original field names:

- `sendToPaperclip` request field and meeting `paperclipStatus` (queued/sent/failed) — surfaced
  in UI as the co-working "Send to team channel" handoff.
- Retry-ledger kinds `paperclip_closeout` / `paperclip_memory` (titles now read "Channel handoff …").
- `'paperclip'` in the thoughtseed-fabric-task `source` union (bridge may still receive such events).
- `src/main/vault-projects.ts` — a legacy import tool that reads a `thoughtseed-paperclip`
  checkout's vault directory if present on disk; harmless without one. Follow-up candidate.

Renaming the Worker-side fields is a follow-up in the Worker repo.

## Historical product rule (kept for context)

Helpers were always optional: if a helper was unavailable, Plexus kept the core workflow usable.
Helper failures never gated Clio identity readiness, the daily work flow, or Identity/Focus/
Projects/Work Records/Co-working. That principle is why the retirement was low-risk.
