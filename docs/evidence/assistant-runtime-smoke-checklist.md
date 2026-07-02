# Assistant Runtime Renderer Smoke Checklist

Date prepared: 2026-07-02
Status: checklist only; not executed in this documentation pass.

Use this checklist for packaged-app or dev-renderer screenshots after the native
assistant runtime UI lands. Mark each row with the screenshot path, viewport, and
whether the result is deterministic local proof or live Worker/Hermes proof.

## Proof Boundary

- Do not claim live Worker/Hermes/R2 delivery unless the smoke captures a current
  Worker/Hermes response or R2/vault confirmation.
- Local queue, mock model, and disabled-helper states are deterministic local
  proof only.
- The expected daily event path is `Plexus -> Worker/Hermes -> R2/vault`; offline
  Worker state should leave an explicit local queued/retry state.
- Fabric/Paperclip is optional helper/enrichment. Paperclip disabled or offline
  must not block Assistant, Timer, Reports, Settings, or local work capture.
- Bridge credentials must remain member-scoped. The Worker admin `BRIDGE_TOKEN`
  must not appear in renderer state, screenshots, logs, settings, or copied text.

## Manual Checks

| Check | Setup | Expected result | Proof type | Screenshot |
|---|---|---|---|---|
| Assistant panel | Open the assistant surface from the app shell. | Panel renders conversation state, context/suggestion area, and composer without blanking navigation. | Local renderer | |
| Settings assistant section | Open Settings and locate assistant settings. | Assistant enablement, model/provider state, session scanning, and Paperclip enrichment controls are visible without exposing secrets. | Local renderer | |
| Timer CTA | Open Focus Session/Timer with a verified cached project. | Assistant CTA is visible, does not shift timer controls, and routes to a draft assistant suggestion or confirmation state. | Local renderer | |
| Reports CTA | Open Reports with local entries available. | Assistant CTA can ask about local report context even when Worker KPI is stale/offline. | Local renderer | |
| Optional Helpers | Open Optional Helpers/Fabric surface. | Helper health is clearly optional; Paperclip disabled/offline is degraded helper state, not app failure. | Local renderer | |
| Admin Diagnostics | Open Admin Diagnostics. | Assistant diagnostics show model/provider, context gateway, daily queue, Worker/Hermes, and optional helper status as separate rows. | Local renderer | |
| Model unconfigured | Clear assistant model/provider configuration or use mock/unconfigured mode. | Assistant panel remains usable with setup/offline guidance; no crash, spinner loop, or fake model success. | Local renderer | |
| Offline Worker | Disable Worker network path or use a controlled offline/mock failure. | Daily event/send action records a local queued or failed-with-retry state; no live delivery is claimed. | Local renderer | |
| Paperclip disabled | Disable Paperclip enrichment or run without local Paperclip. | Assistant, Timer CTA, Reports CTA, and daily queue remain available; helper card explains disabled state. | Local renderer | |
| Action confirmation | Trigger a write-capable assistant suggestion such as start timer, sync project, or generate standup. | Confirmation modal/draft appears before the side effect; cancel leaves no persisted action. | Local renderer | |

## Capture Notes

For every screenshot:

- Record app version, branch, commit, and whether it is dev or packaged.
- Record the exact setup for model provider, Worker reachability, and Paperclip
  enabled/disabled state.
- Record any related command output, such as `npm run typecheck`,
  `npm run build:main`, `npm run build:preload`, or assistant smoke scripts.
- If a remote Worker/Hermes/R2 proof is captured, include the redacted response
  id or artifact ref and the command or UI action that produced it.
