# Services inventory

Source review: 2026-09-05, Plexus v0.7.12 plus the scoped migration preparation.
This is an inventory of integrations and their acceptance boundaries, not a live
service-health report. Start with [the runtime map](RUNTIME_MAP.md) and
[documentation map](../DOCUMENTATION_MAP.md).

## Product services

| Service | Current responsibility | Source and proof boundary |
| --- | --- | --- |
| Electron main + SQLite | Member work records, timers, settings, intent/audit/outbox storage, local API and trusted IPC | `src/main/main.ts`, `src/db/database.ts`, `src/main/api-server.ts`; local storage is distinct from Worker sync |
| Cloudflare Access | Member login and Access-backed requests | Access login handlers in `src/main/main.ts`, `src/main/teamforge.ts`; current API redirect uses Labs Access, but authenticated desktop acceptance remains separate |
| Workspace Worker / Plexus API | Member identity, projects, time, KPI, preferences, GitHub authority and realtime metadata | Compatibility client `src/main/teamforge.ts`; server source remains in sibling `team-forge-ts/cloudflare/worker` |
| Member bridge + Hermes | Signed member events, monthly review activation, reporting and downstream routing | `src/main/thoughtseed-bridge.ts`, `assistant-daily.ts`, `review-cycle.ts`; Worker fallback is not Hermes receipt |
| Governed Clio relay | Authenticated model catalog and streamed Clio turns through OmniRoute | `src/main/assistant-omniroute.ts`; production origin `https://clio-relay.thoughtseed.space`; model-provider credentials stay beyond the desktop relay boundary |
| GitHub App | Installation-scoped repository discovery, project binding, evidence and guarded operations | [Control-plane contract](../GITHUB_PRIVATE_REPOSITORY_CONTROL_PLANE.md); App secret names do not establish grants or a successful private-repository operation |
| Cloudflare R2 OTA | Signed macOS arm64 manifests and immutable artifacts | Runtime/package default still points to the legacy account; Labs cutover remains incomplete; see [OTA runbook](../OTA_RELEASE.md) |
| Cloudflare Realtime SFU | Intended backend-brokered media transport | Client SDP scaffolding exists, but inspected Worker track handler persists metadata; live two-client transport remains [#26](https://github.com/Sheshiyer/plexus-ts/issues/26) |

## Credential and product boundaries

The renderer receives typed data and operations through preload. Access JWTs,
member bridge tokens and local API bearer credentials stay in main-process
custody. GitHub App keys and Cloudflare media credentials belong to the Worker;
signing and R2 publication credentials belong to the protected release workflow.
A source-level custody rule does not replace a live redaction/authentication test.

Paperclip and the local agent Fabric runtime were retired in v0.7.9. They are not
installable optional product services. Retained `paperclip*`, `fabric*` and
`teamforge*` field/type names preserve stored/wire compatibility; they do not
reactivate a helper or establish downstream delivery. Recording/transcription
is not a shipped end-to-end capability; see [realtime API scope](../REALTIME_WORKER_API_CONTRACT.md).

## Generation ownership

The host `ArchitectureAssetsSync.hook.ts` can overwrite this file on a
release-shaped command. Its `ServicesScanner.ts` reads dependency/config hints;
it does not follow this app's runtime calls or the sibling Worker bindings.
A generic scan is therefore incomplete for this repository. This September
inventory was manually checked against source, not emitted by that scanner.
Keep the authored [runtime map](RUNTIME_MAP.md) and reporting contract as the
semantic authority when reconciling future generated output. The hook was not
run for this review because it also writes planning and host observability.
