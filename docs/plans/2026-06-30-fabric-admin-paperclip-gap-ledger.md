# Fabric Admin Paperclip Gap Ledger

Date: 2026-06-30

Scope: focused Fabric/admin/Paperclip pass for PR #29 and OTA v0.4.9 readiness.

Relevant skill-cluster routing:

- `electron-orchestrator`, `electron-core`, `electron-main-renderer-ipc`, `electron-security`, `electron-auto-update`, `electron-builder-packaging`
- `frontend-web-orchestrator`, `frontend-web-core`, `frontend-a11y`, `react-testing`, `vite-patterns`
- `browser-automation-orchestrator`, `browser-automation-core`
- `security-orchestrator`, `security-core`, `security-review`
- `git-pr-ops-orchestrator`, `git-pr-ops-core`

## Gaps And Fixes

1. BrowserWindow did not explicitly disable worker/subframe Node integration.
   Fixed by adding `nodeIntegrationInWorker: false`, `nodeIntegrationInSubFrames: false`, and `webSecurity: true`.

2. Renderer `window.open` was not denied by default at the Electron boundary.
   Fixed with a main-process `setWindowOpenHandler` that denies renderer popups and opens only validated `http:`/`https:` URLs externally.

3. Top-level navigation could leave the trusted renderer route.
   Fixed with a `will-navigate` guard that allows only the app renderer origin/file URL and sends safe external URLs to the OS browser.

4. Renderer HTML had no explicit CSP.
   Fixed with a CSP meta tag that blocks arbitrary script/object/frame execution and allowlists only needed connect/font/media sources.

5. CSP could not be fully inline-style-free yet because the existing design system uses React style props extensively.
   Captured as compatibility debt; script policy is strict while `style-src 'unsafe-inline'` remains limited to styles.

6. Thoughtseed invite redemption IPC accepted unvalidated renderer payloads.
   Fixed with trusted-side invite and bridge URL normalization.

7. Directive ack IPC accepted arbitrary payloads.
   Fixed with array/string validation, trimming, dedupe, and non-empty enforcement.

8. Fabric work-mode IPC accepted arbitrary task ids and modes.
   Fixed with bounded task id validation and strict `manual | delegated` validation.

9. Fabric task report IPC accepted arbitrary objects.
   Fixed with runtime validation for task id, status, note, blocker, evidence type, evidence value, and evidence label.

10. Onboarding IPC accepted arbitrary state and metadata.
    Fixed with strict onboarding state validation and bounded object metadata.

11. Admin demo onboarding IPC relied on TypeScript types after the preload boundary.
    Fixed with active admin-session enforcement plus runtime validation for identity id, step id, state, and metadata.

12. Metadata payloads had no size ceiling at the main-process boundary.
    Fixed by bounding IPC metadata JSON to 4096 characters.

13. Fabric card allowed progress/done actions before work mode was selected.
    Fixed by allowing acknowledge separately while requiring a selected work mode for progress, blocked, or done.

14. Agent Fabric "Refresh assignments" only polled directives instead of ingesting tasks.
    Fixed by calling `thoughtseedSyncFabricTasks`, applying tasks locally, and surfacing conflict state.

15. Task sync did not seed draft state for newly ingested tasks in every path.
    Fixed with a shared task-application helper that creates drafts for new tasks.

16. Stale drafts for removed tasks could persist after sync.
    Fixed by rebuilding the draft map from the current task list.

17. Fabric panel hid upstream/main-process errors behind generic messages.
    Fixed by surfacing real error messages from bridge, sync, work-mode, report, handoff, and helper checks.

18. Error panels did not recognize all new validation/bridge failure strings.
    Fixed by broadening degraded-message detection for blocked, expired, invalid, required, unavailable, and refused states.

19. Auto-refresh pause leaked the admin employee mode event listener.
    Fixed by always returning cleanup and only making the interval conditional.

20. Paperclip task source was not visible to operators.
    Fixed by displaying a source chip for Hermes, Cambium, or Paperclip on each assignment card.

21. Admin employee test-mode localStorage writes assumed storage was always available.
    Fixed by making write/clear defensive so storage failure cannot break the app shell.

22. Paperclip smoke API calls could hang indefinitely.
    Fixed with a per-request abort timeout, defaulting to 5000 ms.

23. Paperclip smoke accepted malformed routes internally.
    Fixed with a route validator requiring `/`-prefixed API paths.

24. Paperclip smoke lacked a built-in help surface.
    Fixed with `--help` documentation for write/json/company/member/tenant/evidence flags.

25. Explicit Paperclip company id fallback could select another test org if the id was missing.
    Fixed by refusing fallback when `--company-id` is supplied but absent.

26. Paperclip smoke could create a company without an up-front disposable/test safety check.
    Fixed by validating the planned company descriptor before POST `/companies`.

27. The admin Fabric/Paperclip changes lacked a single release-gate ledger.
    Fixed with this file and an OTA v0.4.9 gate in `docs/OTA_RELEASE.md`.

## Verification Targets

- `npm run typecheck`
- `npm run build:main`
- `npm run build:preload`
- `npm run build:renderer`
- `npm run lint -- --quiet`
- `npm run smoke:thoughtseed-bridge`
- `npm run smoke:admin-fabric-paperclip`
- `npm run smoke:admin-fabric-paperclip -- --write --json`
- Browser smoke of `/?splash=0&tab=fabric` with console/network checks after renderer changes
- `npm run release:ota:prep`

## Residual Risks

- Production dependency audit is clean with `npm audit --omit=dev --json`.
- Full dependency audit still reports high-severity dev/build-chain findings that require major `electron` and `electron-builder` upgrades. Those are intentionally left for a separate packaging-maintenance pass because this PR is scoped to Fabric/admin/Paperclip safety.
- The renderer CSP still allows inline styles because existing app components use React style props heavily. Script/object/frame controls are tightened here; removing inline-style compatibility needs a broader design-system migration.
