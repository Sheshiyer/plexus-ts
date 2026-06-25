# Employee Copy And Diagnostics Evidence

Checked at: 2026-06-25T15:44:36Z

## Scope

- Employee pages now use work/account/task language instead of implementation language.
- Raw endpoints, feed URLs, bridge URLs, ports, payload summaries, vault paths, and prompt/config details are collected in the admin diagnostics panel.
- Secret token values are not rendered; diagnostics show configuration state and token expiry only.

## Employee Surfaces Reviewed

- `src/renderer/components/Login.tsx`
- `src/renderer/components/Onboarding.tsx`
- `src/renderer/components/Settings.tsx`
- `src/renderer/components/PreferencesPanel.tsx`
- `src/renderer/components/ProjectManager.tsx`
- `src/renderer/components/AgentFabricPanel.tsx`
- `src/renderer/components/AgentSessionsPanel.tsx`
- `src/renderer/components/AgentSessionFocusRail.tsx`

## Admin Diagnostics Coverage

- Worker base URL, workspace id, token configured flag, and status.
- OTA state, current version, available version, channel, feed URL, message, and error.
- Thoughtseed Bridge configured/connected state, API URL, tenant, member id, token expiry, last seen, and last error.
- Pending directive payload summaries and copyable raw payloads.
- Fabric helper health, bridge reachability, install path, host, server port, and adapter port.
- Vault repo root, candidate count, imported count, scan message, and candidate source paths.
- Prompt/config text when present in preferences.

## Verification

- `npm run copy:audit` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build:renderer` passed.

## Remaining Before OTA

- Capture visual screenshots for employee pages and admin diagnostics.
