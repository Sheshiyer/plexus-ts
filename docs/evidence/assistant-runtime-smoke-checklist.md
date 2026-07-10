# Assistant Runtime Renderer Smoke Checklist

Date prepared: 2026-07-02
Status: checklist only; not executed in this documentation pass.

Use this checklist for packaged-app or dev-renderer screenshots after the native
assistant runtime UI lands. Mark each row with the screenshot path, viewport, and
whether the result is deterministic local proof, bridge request proof, or
confirmed Hermes receipt proof.

## Proof Boundary

- Do not claim live Hermes delivery unless the smoke captures a current
  member-scoped bridge to Hermes response and the required downstream receipt.
- Local queue, mock model, and disabled-helper states are deterministic local
  proof only.
- The expected daily event path is `Plexus -> member bridge -> Hermes`. The
  Workspace Worker fallback only after bridge failure is degraded delivery and
  remains queued for bridge retry; Worker/R2 storage does not prove Hermes receipt.
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
| Admin Diagnostics | Open Admin Diagnostics. | Assistant diagnostics show model/provider, context gateway, daily queue, bridge/Hermes reporting readiness, and optional helper status as separate rows. | Local renderer | |
| Model unconfigured | Clear assistant model/provider configuration or use mock/unconfigured mode. | Assistant panel remains usable with setup/offline guidance; no crash, spinner loop, or fake model success. | Local renderer | |
| Bridge failure and Worker fallback | Fail the member bridge, then allow the Worker fallback. | Worker acceptance remains visibly degraded and queued for a later bridge retry; the UI does not claim Hermes receipt. | Deterministic delivery boundary | |
| Bridge and Worker offline | Disable both delivery paths or use controlled failures. | Daily event/send action records a local queued or failed-with-retry state; no live delivery is claimed. | Local renderer | |
| Paperclip disabled | Disable Paperclip enrichment or run without local Paperclip. | Assistant, Timer CTA, Reports CTA, and daily queue remain available; helper card explains disabled state. | Local renderer | |
| Action confirmation | Trigger a write-capable assistant suggestion such as start timer, sync project, or generate standup. | Confirmation modal/draft appears before the side effect; cancel leaves no persisted action. | Local renderer | |

## Capture Notes

For every screenshot:

- Record app version, branch, commit, and whether it is dev or packaged.
- Record the exact setup for model provider, Worker reachability, and Paperclip
  enabled/disabled state.
- Record any related command output, such as `npm run typecheck`,
  `npm run build:main`, `npm run build:preload`, or assistant smoke scripts.
- If remote bridge or Hermes proof is captured, include the redacted response id,
  receipt class, and the command or UI action that produced it. A Worker/R2
  artifact reference must be labeled fallback storage, not Hermes receipt.
