# Assistant Runtime Release Gates

Date: 2026-07-02

## Summary

The native Plexus assistant runtime is now assistant-first, with Fabric/Paperclip kept as an optional helper/enrichment layer. Daily events use the local assistant context, queue locally, send through the Worker path first, and fall back to the member-scoped Thoughtseed bridge when configured.

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
- Worker daily endpoint proof needs the `/v1/member/daily-agent-events` endpoint available behind the current workspace credentials.
- Hermes/R2/vault confirmation proof needs the bridge/Worker confirmation path deployed and reachable.
- Screenshot proof was not captured; use `docs/evidence/assistant-runtime-smoke-checklist.md` for the manual pass.

## Rollback

- Disable `assistantEnabled` in settings to keep the app on offline/local behavior.
- Leave the local daily event queue intact; pending events can be retried after credentials/endpoints recover.
- Keep Fabric/Paperclip as optional helpers; helper failure should not block assistant context, local suggestions, or daily queueing.
- Do not tag OTA until the PR is merged and `npm run release:ota:prep` passes on the merge branch.
