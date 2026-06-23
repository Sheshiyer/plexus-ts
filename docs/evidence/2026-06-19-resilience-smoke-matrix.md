# Plexus Resilience Smoke Matrix

Date: 2026-06-19
Scope: execution batches A-E from `docs/APP_RESILIENCE_REVIEW.md`.

## Automated Gates

- `npm run typecheck`
- `npm run build:main`
- `npm run build:preload`
- `npx vite build`
- `git diff --check`
- Focused no-placeholder scan from `docs/evidence/2026-06-18-plexus-0.4.0/no-placeholder-quality-gate.md`

## Degradation Cases

| Case | Expected behavior | Evidence status |
|---|---|---|
| Paperclip offline | Fabric shows degraded install/ports and handoff queue; Timer, Entries, Reports, Export, Settings, and Logout remain usable. | Needs runtime screenshot/proof. |
| AI model quota exceeded | Fabric records rate-limit/degraded handoff state instead of blocking Timer or Co-working. | Needs Paperclip adapter proof once model error can be simulated. |
| Worker offline | Projects/Preferences/KPI/closeout show scoped errors or handoffs; local Timer/Entries/Reports/Export continue. | Partially covered by local-first code paths; needs runtime proof. |
| Never-verified GitHub project | Focus Session start and Manual Entry creation fail before local insert. | Covered by main-process repo guard; needs runtime proof. |
| Previously verified GitHub project while Worker offline | Cached repo binding allows local work record creation and queues sync handoff. | Covered by verified-cache rule; needs runtime proof. |
| GitHub activity sync failure | Missing activity appears as evidence gap and retryable handoff, not fake proof. | Needs Worker/mock proof. |
| Access expired mid-session | Settings proof shows refresh failure; cached local data remains visible. | Needs installed-app or dev-app proof. |
| No media permission | Permissions gate and Co-working show per-device failure; leave remains visible. | Existing media gate plus Co-working controls; needs screenshot proof. |
| SFU negotiation failure | User remains joined only if Worker accepted presence; media controls show track failure and leave remains usable. | Needs Cloudflare/SFU or mocked Worker proof. |
| Closeout Paperclip handoff failure | Meeting closeout creates failed/pending handoff record with retry in Fabric. | Covered by new handoff queue path; needs live Worker/Paperclip proof. |
| Timer stop while Worker/Paperclip down | Local entry saves first; time sync and standup/usage signals become retryable handoffs. | Covered by main-process local-first path; needs runtime failure proof. |
| Preferences save failure | Draft stays in form, unsaved badge remains, navigation warns, failed save becomes retryable handoff. | Covered by renderer guard; needs UI proof. |
| Logout during active room | Renderer dispatches session teardown, local tracks stop, leave calls are best-effort, session still clears. | Covered by teardown event path; needs runtime proof. |
| OTA failure | Settings update card shows scoped error; auth, timer, backup, and logout remain usable. | Existing card-scoped updater flow; needs failure proof. |
| Admin failure | Admin page shows scoped error without affecting personal tabs. | Existing page-scoped Admin flow; needs runtime proof. |

## Current Implementation Evidence

- Shared handoff model: `src/shared/types.ts`, `src/db/database.ts`, `src/main/main.ts`, `src/preload/preload.ts`.
- Shared renderer primitives: `src/renderer/lib/resilience.tsx`.
- Fabric handoff queue: `src/renderer/components/AgentFabricPanel.tsx`.
- Local-first Timer/Entries/Reports/Projects/Preferences changes: respective renderer components plus timer/entry IPC in `src/main/main.ts`.
- Realtime logout teardown: `src/renderer/components/CoWorkingPanel.tsx` and `src/renderer/components/Settings.tsx`.

## Patch Release Gate

The patch can proceed only after automated gates pass and at least one runtime proof is captured for each of:

- Paperclip offline.
- Worker offline or Access expired.
- Timer stop with optional sync failure.
- Repo-required focus start and manual entry rejection.
- Verified-cache focus start with Worker offline.
- Preferences save failure.
- Co-working join/leave with media or closeout failure.
- Logout after active room cleanup.
