# Plexus feature review and Phloem/calling map

Review date: 2026-10-23. Source worktree package version: 0.7.13.
This is a source inventory and local regression receipt. Installed app behavior,
server deployment parity and authenticated two-person calling remain separate acceptance gates.

## How the application fits together

Plexus is the employee-facing desktop workspace. React renders work records,
Clio and co-working. The preload exposes typed IPC. Electron main owns local
SQLite, OS integration, identity and network requests; it keeps privileged
credentials outside the renderer. The Workspace Worker resolves member authority
and stores canonical project and collaboration state. Clio is the assistant
experience inside Plexus; OmniRoute provides its model-routing service. Phloem is
the hosted routing surface named in this task. Audio/video collaboration uses a
separate WebRTC/SFU transport and the Workspace Worker application API.

```mermaid
flowchart LR
  UI[Plexus React UI] --> IPC[Typed preload IPC]
  IPC --> Main[Electron main]
  Main --> SQLite[(Local SQLite and outbox)]
  Main --> Worker[Workspace Worker: identity/projects/rooms]
  Main --> Relay[Clio Access relay]
  Relay -. server routing verification needed .-> Phloem[Hosted OmniRoute / Phloem]
  UI --> RTC[RTCPeerConnection]
  RTC -. SDP and provider broker required .-> SFU[Cloudflare Realtime media]
  Main --> Hermes[Scoped reporting bridge / Hermes]
```

The dashed routing link is an intended mapping that needs a server deployment
receipt. A reachable Phloem URL does not establish that Clio's relay points at it.
The dashed media link was incomplete in the inspected baseline contract; coordinated local Worker/client candidates now implement its negotiation path, pending deployment and live acceptance. Neither model
routing nor a successful room join supplies a media connection by itself.

## Feature inventory and source ownership

These are implemented surfaces/contracts, not a claim that every external
integration is currently operational for the signed-in user.

| Feature | What the user can understand/do | Primary source | External boundary |
| --- | --- | --- | --- |
| Sign-in and onboarding | Establish member identity, permissions and workspace setup | `Login.tsx`, `Onboarding.tsx`, `main/teamforge.ts` | Cloudflare Access and Worker session |
| Focus timer and recovery | Track work, pause/resume and recover an interrupted session | `Timer.tsx`, `main/timer-session.ts`, `main/idle.ts` | Local persistence; later Worker sync |
| Work ledger and evidence | Review time entries, charts and proof coverage | `TimeEntryList.tsx`, `TimeChart.tsx`, `main/evidence.ts`, `main/proof-report.ts` | Evidence identity and sync receipts |
| Canonical projects | Select verified projects and associate GitHub repositories | `ProjectManager.tsx`, `main/teamforge.ts`, `main/github-repository-binding-lock.ts` | Worker project authority and GitHub grants |
| Reports, reviews and growth | Inspect work summaries, periodic review and KPI signals | `Reports.tsx`, `GrowthOverviewPanel.tsx`, `main/review-cycle.ts`, `main/growth-overview.ts` | Worker summary and reporting delivery |
| Export | Prepare work data output | `ExportPanel.tsx` | Exported file contents/permissions |
| Backups and restore | List local backups and restore persisted work | `BackupPanel.tsx`, `main/backup.ts` | Local filesystem and restore confirmation |
| Clio conversation | Stream assistant responses with bounded work context and model selection | `AssistantPanel.tsx`, `main/assistant-runtime.ts`, `main/assistant-context.ts`, `main/assistant-omniroute.ts` | Authenticated relay and provider result |
| Assistant actions | Review/confirm/cancel write-capable tool intents | `AssistantActionConfirmModal.tsx`, `main/assistant-tools.ts`, `main/assistant-policy.ts`, `main/assistant-permissions.ts` | Action-specific authority and expiry |
| AI session activity | Discover/group local AI sessions; accept/dismiss work candidates | `AgentSessionsPanel.tsx`, `AgentActivityHub.tsx`, `main/agent-sessions.ts` | Local scanner provenance; accepting creates work data |
| Member reporting | Queue daily evidence, retry and hand off to Hermes | `main/assistant-daily.ts`, `main/thoughtseed-bridge.ts` | Bridge acknowledgement differs from final delivery |
| Co-working presence | See floor/lounge and focused project zones | `CoWorkingPanel.tsx`, `main/coworking-presence-controller.ts`, `main/coworking-presence.ts` | Authorized presence lifecycle and Worker readback |
| Audio, camera and screen controls | Request device access and publish/subscribe tracks in a project call | `renderer/lib/useRealtimeMedia.ts`, `renderer/lib/RealtimeSession.ts`, `coworking/DeviceControls.tsx`, `coworking/MediaDock.tsx`, `coworking/StudioStage.tsx` | SFU session/SDP negotiation and remote MediaStreams |
| Meeting closeout | Save manual notes, decisions/action items and linked work | `coworking/CoWorkingCloseoutModal.tsx`, `main/teamforge.ts` | Queued closeout is not downstream dispatch proof |
| Recording/transcription | Reserved/proposed recording contracts exist | `shared/types.ts`, `preload/preload.ts`, realtime contract | Main recording handlers and capture/storage path absent; not ready |
| Settings/profile | Manage preferences, identity and assistant settings | `Settings.tsx`, `PreferencesPanel.tsx`, `ProfileCard.tsx`, `IdentityPanel.tsx` | Per-member persistence and identity grants |
| Updates | Check, download and explicitly consent to installation/restart | `UpdatePrompt.tsx`, `main/updates.ts` | Signed/notarized published release plus installed proof |
| Administration/diagnostics | Inspect project/member operational evidence | `AdminDiagnosticsPanel.tsx`, `AdminProofCockpitPanel.tsx`, `AdminDemoPanel.tsx` | Admin authorization and diagnostic scope |
| Desktop integration | Tray, shortcuts, window modes, idle/device permissions | `main/tray.ts`, `main/shortcuts.ts`, `main/window-mode.ts`, `main/media-authorization.ts` | OS permissions and installed bundle |

Component names in this table are under `src/renderer/components/` unless a
`main/`, `preload/`, `shared/` or `renderer/lib/` prefix is shown; those prefixes
are relative to `src/`. Historical `teamforge` filenames are compatibility
implementation names. They do not create a second authority for project identity.

## A practical walkthrough

1. Sign in with your workspace identity and complete the OS permission checks.
2. Open Projects and choose a canonical project with verified repository access.
3. Start a focus session, describe the work, pause/resume as needed, and review its evidence in the work ledger.
4. Open Clio for a contextual assistant response. The desktop sends an authorized request to the Clio relay; the hosted relay candidate translates its selected lane to a Phloem combo.
5. Open Co-working, select a project room and join. Joining a project room establishes presence; it does not switch on your microphone or camera.
6. Use the microphone or camera control when ready. The client obtains a provider session, requests device capture, publishes its track through the authorized Worker and applies the returned SDP.
7. A teammate joining the same authorized room subscribes to each publication and completes the provider offer/answer exchange. Receiving a teammate does not automatically capture your devices.
8. Leave or end the call. The desktop stops local capture; the Worker candidate closes provider flows and records participant/track closure. Save meeting notes separately if needed.

Steps involving hosted Clio and media describe the coordinated candidate behavior. They remain pending deployment and live acceptance in this review.

## Clio to hosted Phloem mapping

| Layer | Source behavior | Required evidence before calling it working |
| --- | --- | --- |
| Plexus assistant UX | Context, prompts, tool intent confirmation and streamed replies | Signed-in request with real content and selected lane |
| Packaged origin | `assistant-omniroute.ts` bakes `https://clio-relay.thoughtseed.space`; arbitrary packaged overrides are rejected | Preserve the approved relay or make a separately reviewed origin migration |
| Model discovery | `assistant-model-catalog.ts` fetches authenticated `/v1/models` through `fetchOmniRouteWithAccess` | A current permitted lane catalog for this member |
| Model streaming | `assistant-omniroute.ts` constructs OpenAI-compatible model SDK requests with authenticated fetch | Content-bearing completed response, errors/cancellation and tool behavior |
| Access | `main/teamforge.ts` owns the Access fetch path and relay-origin restrictions | Valid member Access flow; no infrastructure keys in renderer |
| Hosted Phloem | Task target `https://omniroute.thoughtseed.space` | Canonical relay-to-Phloem upstream config and authenticated server receipt |
| Actual provider/model | Resolved backend may differ from requested lane | Upstream attribution for the completed request; lane name alone is insufficient |
| Calls | Worker realtime API plus Cloudflare provider transport | Independent two-client media proof; `/v1/models` does not negotiate a call |

Do not point media SDP, device streams or privileged Cloudflare credentials at
a model endpoint. Voice-to-Clio (speech input/output or realtime AI voice) is a
separate product integration; the current human collaboration media code does
not establish such a feature. A Phloem model catalog entry alone does not prove
speech, transcription or realtime voice capability.

## Calling findings and bounded repair

The source reconciliation in `REALTIME_WORKER_API_CONTRACT.md` identifies three
blocking server contracts: initial provider session creation expects SDP while
app join omits it; track handling records metadata rather than brokering
provider negotiation; renegotiation does not establish an implemented provider
round trip. A coordinated Worker candidate now implements session allocation without initial SDP,
track brokering and renegotiation in the existing route namespace. Its isolated
checkout is `../plexus-calling-worker-20261023` relative to this worktree.
Canonical deployed parity and authenticated calling still need verification.
The desktop changes consume that candidate contract; deploying only one side
will not complete calling.

The client previously returned track IDs and subscription counts when the
Worker recorded metadata without an SDP answer. It also swallowed SDP application
errors while returning publication success. That made UI state overstate media
readiness. The repaired `RealtimeSession` now:

- Requires a configured provider session before publishing media and refuses metadata-only publication as success.
- Publishes one matching media track with its transceiver mid and ICE-gathered typed offer; accepts a nonempty string answer or typed `{ type: 'answer', sdp }` and fails when the answer is absent, deferred or rejected.
- Subscribes one target per completed exchange with its matching media kind and application publication ID, applies the provider offer using the returned mid-to-publication mapping, creates an ICE-gathered answer and completes the authenticated Worker renegotiation route before counting subscriptions.
- Waits at most ten seconds for complete ICE gathering because the client has no separate trickle-candidate transport.
- Requires a provider track ID for successful local publication, closes a failed publication's metadata row, removes all associated senders and rolls back an outstanding offer.
- Counts subscribed targets only after the provider answer applies; deduplicates accepted subscriptions while waiting for `ontrack`.
- Serializes publish/subscribe/unpublish operations to avoid overlapping offers.
- Keeps temporarily muted remote streams mapped until `ended`, so resumable tracks stay identifiable.
- Prevents reinitialization and in-flight success after close; clears all senders and subscription maps on teardown.
- Lazily upgrades presence-only project membership to a provider media session before explicit capture or subscribing to an advertised remote publication. This does not capture a device on room join.
- Stops failed or delayed microphone/camera/screen capture after teardown and retains the owning session in screen-ended handlers.
- Surfaces actual peer connection state in project media health rather than equating provider configuration with connectivity.

An accepted SDP answer proves local negotiation acceptance only. Actual remote
track reception, connectivity and human-visible/heard media remain acceptance
requirements. Failed rollback and failed cleanup network requests retain a
best-effort boundary; room leave/Worker participant cleanup remains necessary.

## What must happen to finish audio/video

1. Pin the canonical Workspace Worker source and deployed revision, Access audience, provider configuration authority and workspace identity.
2. Resolve initial SDP/session creation in the Worker contract without weakening member/project authorization.
3. Implement and verify the existing track publish/subscribe and renegotiation contracts against Cloudflare Realtime, including provider IDs, SDP answers/offers and track closure. Keep provider credentials server-side.
4. Verify client initialization, device consent, mute/camera controls, screen capture permission and ICE traversal on real devices and different networks.
5. Run two authenticated members in one permitted room. Prove audio in both directions, camera display, concurrent screen sharing as supported, mute/unmute recovery, leave/rejoin, denied cross-project access and host/end cleanup. Capture increasing inbound RTP bytesReceived for both directions and increasing framesDecoded for received video; a track event alone is insufficient.
6. Reconcile Worker track/participant state and audit rows after normal leave and failure. Confirm no camera/microphone capture continues after closing.
7. Verify packaged Electron behavior. Browser mocks and unsigned development builds do not prove installed OS permission or media behavior.

Recording and automatic transcription remain separately scoped until explicit
consent, visible capture state, matching main handlers and finalized project
vault manifests exist.

## Local verification receipt

- `npx vitest run test/coworking`: 39 files, 158 tests passed, including 19 new behavior regressions covering fail-closed publication/subscription, rejected and typed SDP, sender cleanup, duplicate subscription avoidance, overlapping negotiations, ICE gathering, offer/answer renegotiation, mute recovery, capture teardown and close during publication.
- `npm run typecheck` and `npm run build:main`: passed.
- Focused ESLint for `RealtimeSession.ts` and its changed tests: passed.
- No authenticated media session, deployment, recording, credential mutation or installed two-client acceptance was performed by this repair.

Provider exchange reference: [Cloudflare SFU connection patterns](https://developers.cloudflare.com/realtime/sfu/get-started/connection-patterns/). The implementation uses the existing Worker routes to mediate those exchanges; no provider credential enters the renderer.

## October 23 parent verification and runtime boundaries

- Canonical desktop baseline: `3651c7c`; Worker baseline: `80714a5`; relay baseline: `0ec0893`. All changes use isolated checkouts; original root work remains preserved.
- Parent independently ran the desktop `test:all`: 117 assistant files/560 tests, 39 co-working files/158 tests, 2 identity files/10 tests and 11 renderer files/66 tests passed (794 tests before the additional hosted-settings display regression).
- Parent independently ran the Worker check and 17 files/204 tests, and the relay's 56 tests. Further relay deployment changes require a fresh result below.
- Public unauthenticated probes: Clio model route HTTP 403; Phloem model route HTTP 401. A scoped authenticated Phloem catalog attempt returned HTTP 403. None proves model inference.
- Existing EC2 status command found no installed relay service/config/credential files on its selected target. This is a target-specific readback, not proof of every public relay host's state.
- Current Wrangler identity is scoped to the legacy account. Labs production credentials/configuration and the exact deployed source remain prerequisites.
- No deployment, public release, installed client change or actual media call has been accepted.
