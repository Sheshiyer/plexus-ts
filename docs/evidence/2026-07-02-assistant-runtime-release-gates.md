# Assistant Runtime Release Gates

Date: 2026-07-02

> **Superseded reporting note:** This dated evidence predates the current Hermes
> authority boundary. Use
> [`docs/architecture/HERMES_REPORTING_CONTRACT.md`](../architecture/HERMES_REPORTING_CONTRACT.md)
> and the active renderer smoke checklist for current release decisions.

## Summary

The native Plexus assistant runtime was verified as assistant-first, with Fabric/Paperclip kept as an optional helper/enrichment layer. The current route queues locally, sends through the member-scoped bridge to Hermes first, and uses Workspace Worker fallback only after bridge failure while retaining bridge retry eligibility.

## Local Verification

Passed:

```bash
npm run test:assistant
npm run smoke:assistant-context
npm run smoke:assistant-models
npm run smoke:assistant-daily
npm run typecheck
npm run lint -- --quiet
npm run build:main
npm run build:preload
npm run build:renderer
npm run release:dry-run
```

Latest assistant test result: 53 files passed, 97 tests passed.

Smoke proof:

- Context smoke: built assistant context with project, work entry, session group, and secret redaction.
- Model smoke: deterministic fallback moved from a failing Google provider to NVIDIA with attempt metadata.
- Daily smoke: built schema `thoughtseed.plexus_daily_agent_event.v1`, queued an in-memory dry-run event, read confirmation, and marked the local record skipped/failed after proof.

## Known Live Blockers

- Live Google model proof needs a valid `GOOGLE_GENERATIVE_AI_API_KEY`.
- Live NVIDIA NIM proof needs a valid `NVIDIA_API_KEY`.
- Degraded Worker fallback proof needs the `/v1/member/daily-agent-events` endpoint available behind the current workspace credentials.
- Hermes receipt proof needs the member bridge and downstream Hermes confirmation path deployed and reachable; Worker/R2 fallback storage is not that receipt.
- Screenshot proof was not captured; use `docs/evidence/assistant-runtime-smoke-checklist.md` for the manual pass.

## Rollback

- Disable `assistantEnabled` in settings to keep the app on offline/local behavior.
- Leave the local daily event queue intact; pending events can be retried after credentials/endpoints recover.
- Keep Fabric/Paperclip as optional helpers; helper failure should not block assistant context, local suggestions, or daily queueing.
- Do not tag OTA until the PR is merged and `npm run release:ota:prep` passes on the merge branch.
