# Plexus App Resilience Review

Date: 2026-06-19
Scope: splash, sign-in, onboarding, Focus Session, work records, projects, reports, export, fabric, co-working, backups, preferences, admin, settings, updates, and logout.

Update 2026-07-02: this review now includes the native assistant runtime. The assistant is a first-class Plexus service for bounded local context, session grouping, feature suggestions, and daily event delivery, while Fabric/Paperclip is an optional helper and enrichment layer.

## Product Goal

Plexus should become the one place where the team can track work, coordinate rooms, preserve meeting memory, manage agent context, and recover from local or cloud failure without losing the working session.

Core rule: no optional dependency may hold the whole app hostage. If Paperclip is offline, a model provider is unconfigured or rate-limited, the member bridge to Hermes is temporarily unreachable, the degraded Workspace Worker fallback is also unavailable, Cloudflare Realtime is not configured, OTA metadata fails, or a daily event sync breaks, the user should still be able to continue verified cached work, ask for offline/local suggestions where available, join or leave rooms where possible, review cached state, and explicitly retry the failed handoff. New work records still fail closed unless the selected project already has a verified GitHub repo binding in the local cache.

## Resilience Principles

- Shell first: the app frame, navigation, active work-session state, today total, Settings, and logout must remain reachable even when a page-level request fails.
- Verified cache first: focus sessions, manual entries, export, backups, and cached projects continue from the local database only after project-level GitHub repo verification has been cached. Never-verified projects cannot create local-only work records.
- Assistant first, helpers optional: the native assistant owns bounded local context, model routing, explicit action confirmation, daily event queueing, and renderer suggestions. Fabric/Paperclip can enrich that flow, but cannot be required for core assistant use.
- Optional integrations are adapters: Paperclip, model providers, standup/event sync, OTA, admin oversight, and realtime media transport must fail as cards or jobs, not as app-wide blockers.
- Every handoff has a queue state: if a page hands data to another subsystem, the source page must save the user action and expose pending, sent, failed, and retry states.
- Standup compliance is local-first: persisted standup evidence from an explicit confirmed generation action is the canonical daily signal; Worker KPI is only a mirror and Fabric/Paperclip is optional enrichment.
- Daily events have a local outbox: Plexus sends first through the member-scoped bridge to Hermes. Only a bridge failure may use the Workspace Worker daily-event fallback, and that degraded success remains queued for bridge retry. Worker/R2 data-plane storage is not Hermes receipt.
- Stale is visible: cached or last-good data may remain visible, but the app must say when the refresh failed and what timestamp the user is seeing.
- Fail closed for permissions and authorization: room joins, admin actions, and identity proof cannot silently downgrade to a weaker security model.
- Close every live resource: media tracks, realtime participants, timers, update listeners, and polling intervals must clean up on navigation, logout, app close, and network loss.

## Full Flow Review

| Surface | Primary role | Critical dependencies | Current failure mode to protect | Required resilient behavior |
|---|---|---|---|---|
| Splash | Brand handoff into app shell | Renderer animation only | Animation or shader issue could delay reaching login/session state | Skip remains available; shell/session loading should not depend on animation completion beyond the designed minimum. |
| Login | Cloudflare Access session start | Access BrowserWindow, Worker `/v1/whoami` | OTP succeeds but no role-aware app session is stored | Show exact sign-in error, keep retry, and do not mark auth proof complete until JWT -> Worker -> session -> UI route succeeds. |
| App shell/HUD/sidebar | Stable workspace frame | Local DB, IPC preload, session cache | A failing refresh can affect projects, work records, and the active session all at once | Wrap refresh phases independently; one failed sync should not clear existing projects, work records, the active session, or session display. |
| Onboarding | Real setup state | Worker onboarding state, assistant readiness, optional Paperclip install probe, media permissions | Optional Paperclip/daily-agent failure can block app flow | Required steps block only required actions; assistant readiness can pass with Worker or local queue available; optional helper steps can be skipped/deferred/failed and resumed. |
| Permissions gate | Native media readiness | macOS permissions, media APIs | Permission denied can dead-end co-working setup | Denial remains visible with System Settings/re-check path; user can continue without media. |
| Focus Session | Core work capture | Local DB, timer IPC, verified GitHub repo cache, optional Agent Activity Hub | Agent/Fabric or standup sync issue could distract from work capture | Start must require a verified repo; pause/resume/stop stay local and independent of Paperclip, Worker, model quotas, and standup sync once the session exists. |
| Work Records | Local evidence ledger | Local DB, project cache | Bad project cache or delete failure can hide local work | Work records render with project-id fallback, show create/delete errors, and keep loaded rows intact on mutation failure. |
| Projects | Workspace Worker project cache | Worker project sync, local cache | Worker sync failure can make app feel empty | Keep existing local project cache, show sync failure, and allow timer/entries to use cached projects. |
| Reports | Local analytics plus Worker KPI | Local entries, Worker KPI | KPI refresh failure can obscure local reports | Local reports render independently; KPI failure appears as stale/failed side status. |
| Export | Local data extraction | Local entries, browser download | Empty date range or invalid range can look like a broken export | Validate range, report empty result, and never require Worker/Paperclip. |
| Native Assistant | Core but degradable assistant runtime | Main-process context gateway, model provider, local queue, member bridge, degraded Worker daily fallback | Model/provider outage, bridge/Worker outage, or missing helper config can look like product failure | Keep the panel reachable; model-unconfigured state offers setup/offline suggestions; delivery outage queues daily events locally; action tools require explicit confirmation before writes. |
| Optional Helpers | Optional runtime health | Paperclip binary/config, ports, shell health, local vault | Paperclip offline or model quota exceeded can look like product failure | Treat each capability as a separate tile with retry; rate limit means helper degraded, not app or assistant degraded. |
| Co-working | Presence, rooms, media, closeout | Worker rooms, WebRTC/SFU, media devices, closeout route, optional Paperclip handoff | Live room flow can break if media, closeout, or Paperclip fails mid-meeting | Joining/leaving remains available; media controls degrade per-device; closeout saves or queues even if Paperclip handoff fails. |
| Backups | Local recovery | Filesystem backup/restore | Restore failure can leave user unsure what happened | Show chosen backup, busy state, clear success/failure, and require restart note after restore. |
| Preferences | Team context profile | Worker preferences | Preference save failure can discard typed state | Keep draft in form, show error, allow retry, and warn if navigating away with unsaved changes. |
| Admin | Workspace oversight | Worker admin routes | Admin overview failure can block non-admin app use | Admin page failure stays local to Admin; no effect on Focus Session, co-working, or settings. |
| Settings | Account, session proof, theme, OTA, provisioning, logout | Local settings, Worker, updater, Paperclip setup, Access partition | Update/provision/session failure can block logout or appearance | Sign out remains reachable; theme preview/save is local; OTA and provisioning failures stay scoped to their cards. |
| Logout | Clear local session and Access partition | Local settings, Electron session partition, live page cleanup | Leaving rooms/timers/sessions active after logout | Best-effort room leave and media cleanup, then clear session; logout should not depend on Paperclip/Worker success. |

## Cross-Page Handoff Risks

- Focus Session -> Reports -> Standup: session stop writes the local work record first. Persisted standup evidence is created only through an explicit confirmed generation action; session stop does not synthesize it or route it through Worker/Paperclip.
- Focus Session -> Native Assistant -> Daily Event: session stop writes the local work record first. The assistant may enqueue a daily event, then send it through the member bridge to Hermes. Workspace Worker delivery is fallback-only after bridge failure and remains retryable through the bridge; neither a local queue nor Worker/R2 storage proves Hermes receipt.
- Focus Session -> Assistant suggestions: model outage or AI quota failure should only degrade suggestions/insights, never the session controls.
- Projects -> Focus/Work Records/Reports: project sync failure should leave cached projects usable; missing project ids should render stable fallback labels.
- Co-working -> Paperclip: meeting closeout should persist the meeting record first, then mark Paperclip handoff pending/sent/failed.
- Co-working -> Work Records: linking a meeting to a work record should be explicit and retryable; closeout failure must not trap the user in a room.
- Onboarding -> Paperclip setup: setup failure marks the optional step failed with retry/defer, not a blocked app.
- Settings -> Assistant setup: missing model configuration, disabled Paperclip enrichment, or offline Worker state stays scoped to assistant/helper cards and does not block Settings save, logout, or local work capture.
- Preferences -> Agent context: preference save failure keeps the draft and does not mutate local optimistic state as if the Worker accepted it.
- Settings -> OTA: update errors must not affect auth/session controls or app data.
- Settings/logout -> Co-working: logout triggers local media cleanup and best-effort leave, but failure to notify Worker must not prevent session clearing.

## Release-Blocking Use Cases

- A member can launch Plexus, skip splash, sign in, and reach Onboarding or Focus Session even if Paperclip is not installed.
- A member can start, pause, resume, and stop a focus session while Worker project sync is failing, as long as the selected cached project already has a verified GitHub repo.
- A member cannot start a focus session or create a manual entry for a never-verified project; no `time_entries` row is inserted.
- A member can stop a work session while Paperclip, standup sync, or model-backed activity insight is down; the local work record is still saved.
- A member can open the Assistant panel when the model provider is unconfigured; the panel shows setup/offline guidance and does not blank the app shell.
- A member can stop a session while both the member bridge and Workspace Worker fallback are offline; the assistant daily event is queued locally and clearly marked pending retry.
- A member can open Reports when Worker KPI is down; local report data still renders with a stale/failed KPI message.
- A member can use Timer and Reports assistant CTAs without Paperclip installed; Paperclip enrichment remains disabled/degraded, not blocking.
- A member can export entries with no Worker session active.
- A member can enter the lounge, deny camera, keep mic/speaker controls usable, and leave the lounge.
- A member can lose Paperclip during a meeting; closeout remains saveable to Worker or clearly queued/failed for retry.
- A member can hit an AI-model rate limit in Paperclip; Fabric shows degraded/rate-limited state while Focus Session, Co-working, Work Records, and Reports continue.
- A member can navigate away from Co-working while joined; the renderer attempts leave and stops local tracks.
- A member can sign out from Settings while Fabric, OTA, or Paperclip setup is failing.
- An admin can fail to load Admin Workspace without losing access to personal focus sessions, reports, co-working, settings, or logout.

## Edge Cases To Add To The Plan

- Access token expired mid-session: Settings proof shows expired/unavailable, cached local data stays visible, protected Worker actions ask for refresh.
- Worker returns non-JSON Cloudflare Access page: page-level error explains Access did not return Plexus session JSON; no placeholder data is inserted.
- Project sync returns zero projects: distinguish true empty workspace from sync failure; do not delete local cache until the response is trusted.
- Local DB write fails during session stop: keep active session state visible, show recovery path, and do not pretend the work record synced.
- Session tick listener fails or pauses: app reloads current timer IPC state without resetting elapsed time.
- Daily standup generation fails after session stop: the work record remains saved, no compliance evidence is written, and the member can retry the confirmed generation action from Assistant without depending on Fabric/Paperclip.
- Daily assistant event fails after session stop: work record remains saved; event state goes pending/failed in the assistant local outbox and retries the member bridge, using Workspace Worker fallback only after a bridge failure.
- Assistant model provider unconfigured: composer and suggestions show configuration/offline state; no API keys or bridge tokens are exposed to the renderer.
- Assistant action proposed: write-capable tools stay in draft state until the user confirms; cancellation leaves no side effect.
- Member bridge and degraded Worker fallback offline: local queue preserves payload and retry metadata until connectivity or credentials return.
- Paperclip runtime starts after onboarding loads: pre-flight re-probe updates status without requiring navigation.
- Paperclip model quota exceeded: show rate-limited status and next retry window if available; do not mark agent files missing.
- Preferences save fails after edits: keep dirty draft and show save failure; navigation warning remains active.
- Backup restore fails: current DB remains in place, status says restore failed, no restart prompt unless restore succeeded.
- OTA check/download fails: Settings update card shows scoped error; app remains usable.
- Realtime Worker join succeeds but SFU media negotiation fails: participant can still leave; media controls show failure without hiding leave.
- Screen share track ends from native picker: local screen state clears and Worker close-track is best-effort.
- Closeout save succeeds but Paperclip handoff fails: meeting record stays saved, handoff is marked failed and retryable.
- Logout while in lounge/project room: local tracks stop immediately; Worker leave is best-effort; local session still clears.

## Implementation Plan

### Batch A: Shared Resilience Primitives

- [ ] Add a small `AsyncBoundary` or equivalent helper for renderer pages to keep last-good data, scoped errors, busy state, and retry callbacks consistent.
- [ ] Add a shared handoff status type for `pending`, `sent`, `failed`, `retrying`, and `skipped` states across Paperclip, standup, closeout, preferences, and project sync.
- [ ] Add a page-level error card primitive that never replaces the whole app shell unless the shell itself failed.
- [ ] Add a last-good timestamp pattern for Worker-backed cards.

### Batch B: Core Local Work Must Survive Integrations

- [ ] Session stop persists local work record before any Worker, Paperclip, standup, or activity-hub side effect.
- [ ] Focus Session and Work Records expose local DB write failures without clearing active form/session state.
- [ ] Reports render local report data when Worker KPI fails, with stale timestamp.
- [ ] Export remains local-only and works without Worker, Paperclip, or session refresh.

### Batch C: Team Coordination Handoffs Become Retryable

- [ ] Meeting closeout saves Worker meeting record independently from Paperclip handoff.
- [ ] Paperclip handoff failures surface as retryable closeout/handoff records, not lost modal errors.
- [ ] Persisted standup evidence is created only by explicit confirmed generation; a failed attempt leaves compliance missing and retryable from Assistant without blocking Focus Session.
- [ ] Assistant daily events use a local pending/failed/retry state before bridge-first delivery to Hermes; Worker fallback is attempted only after bridge failure and never counts as Hermes receipt.
- [ ] Preferences save keeps unsaved draft and prompts before navigation when dirty.

### Batch D: Realtime And Logout Safety

- [ ] Logout triggers a shared best-effort teardown for active realtime joins and local media tracks before clearing session.
- [ ] Co-working leaves remain visible and usable during media/SFU/closeout errors.
- [ ] Project-room and lounge joins are not lost on polling refresh.
- [ ] Screen-share attribution and close-track cleanup are covered by regression proof.

### Batch E: Verification Matrix

- [ ] Add smoke cases for Assistant panel, Settings assistant section, Timer CTA, Reports CTA, Optional Helpers, Admin Diagnostics, model-unconfigured state, offline Worker state, Paperclip disabled state, action confirmation, Paperclip rate-limited, Worker Access expired, no media permission, SFU negotiation failure, closeout handoff failure, and logout during active room.
- [ ] Capture one screenshot per major degradation state without placeholder copy.
- [ ] Add a release gate that verifies local Focus Session/Work Records/Export still work while Worker and Paperclip are unavailable.

## Patch Release Exit Criteria

- No page-level optional dependency can blank the full app.
- Every Worker-backed page keeps local/cached state when refresh fails.
- Every handoff either succeeds, queues, or shows retryable failure.
- Logout, Settings, Focus Session, and Backups remain reachable from every recoverable degraded state.
- No user-visible placeholder or fake success state is introduced while adding resilience states.
