---
project: Plexus
task: "Reconcile repository documentation, planning and historical evidence without drift"
effort: E4
effort_source: classifier
phase: verify
progress: 329/351
release_readiness: blocked-labs-ota-cutover
mode: interactive
iteration: repository-docs-deep-pass-20260905
started: 2026-07-10T13:22:00Z
updated: 2026-09-05T11:52:09.530133+00:00
---

## Problem

Plexus documentation has accumulated July release targets, retired helper setup,
duplicated planning status, and source-only or historical observations phrased
as current production proof. Readers can choose different instructions depending
on which README, handoff, roadmap or plan they open.

Current source is v0.7.12. The September migration review establishes Labs API
Access but a legacy-account OTA feed; live Labs delivery and installed bridge
acceptance remain open. This documentation pass makes source, planning and dated
evidence distinguishable without erasing failed or superseded work.

<details>
<summary>Historical task framing and constraints (July–September 2026)</summary>

The current Co-working page places participant controls, operational health, transport proof, consent proof, room selection, presence, and lounge detail in one stateful renderer component. The normal page forces the project stage below dense diagnostic and ambient sections, while narrower windows compress the entire application shell instead of prioritizing the controls a presenter needs. The existing page-level fullscreen stage also expands audit detail rather than providing a small companion while another application is being presented.

Plexus has a working signed `v0.5.4` OTA baseline, but GitHub still reports fifteen open roadmap issues, one conflicting stale pull request, several historical branches/worktrees, three preserved stashes, and unrelated dirty generated documentation. The final `v0.5.5` update must consolidate repository truth without losing parallel work, close the actual assistant execution and skill-index gaps, and publish only after protected CI and signed packaged-renderer proof pass.

The earlier automatic-update problem statement below remains historical context for the release chain that v0.5.5 inherits.

The private-GitHub control plane currently collapses distinct authorization failures into `forbidden`. Production has one active Sheshiyer installation whose repository selection is `all`, while the exact policy requires `selected`; the organization flow also carries installation hint `146773007` even though GitHub reports the active selected `thoughtseed-labs` installation as `146468777`. A signed installation fact is missing for that organization installation, connection polling leaves founder state stale, and webhook delivery records omit the action, target, installation, and ignore reason needed to recover safely.

The public GitHub App registration currently requests the six required repository permissions plus five unnecessary administrative/project/hook permissions, while the installed organization instance reports an empty granted-permission set. Even a correctly correlated selected installation would therefore fail repository operations; permission registration, approval, signed permission facts, and connection status must converge as one recovery.

Plexus `origin/main` reports source version `0.5.3`, while the installed app, GitHub's latest release, and the public OTA manifest all remain `0.5.2`. The current runtime never checks automatically and only the Settings screen subscribes to update state, so an employee receives neither automatic discovery nor a global consent prompt even after a newer signed release is eventually published. A merged version bump is not an OTA release, and an assistant must not become the authority for feed trust or installation.

</details>

## Vision

During a presentation, Plexus becomes a small, calm companion that shows the active room, essential presence/timer context, explicit media controls, leave, and restore without competing with the shared content. Returning to standard mode restores the prior window geometry and the full Co-working workspace exactly, while maintainers can evolve presence, stage, lounge, and diagnostics as separate components rather than one monolith.

An employee installs one signed Plexus build and gets a calm, local-per-member coordination app whose privileged work stays in Electron main, whose reporting travels directly to Hermes through a scoped member bridge, and whose updates are explicit, signed, observable, and recoverable. When a newer signed release is published, Plexus notices without requiring Settings, keeps the employee's work visible, and asks separately before download and restart. The founder reads reporting through Cambium TG Mini App, configured Telegram topics, and TeamForge-compatible operational views without Plexus reviving MultiCA or embedding Telegram routing.

GitHub owner connection becomes self-explanatory and recoverable without weakening least privilege: every pinned owner has a truthful target state and reason, signed webhook facts can recover a uniquely correlated existing installation, stale actor state disappears, and operators never need direct D1 surgery or a destructive reinstall to resolve a missed creation event.

## Out of Scope

- This pass does not deploy, publish, change credentials, alter DNS, copy remote
  objects, retire infrastructure, or mark missing runtime acceptance complete.
- This pass does not implement source gaps discovered during documentation review;
  those gaps receive explicit source/evidence boundaries and follow-up ownership.
- Historical plans, failed probes and immutable evidence are retained. Labeling a
  document historical does not claim its unfinished work was completed.

<details>
<summary>Historical task framing and constraints (July–September 2026)</summary>

- The current v0.5.6 release does not add avatar movement, collision, navigable rooms, a permanent roster, live SFU transport, recording, transcription, or calculated biorhythm phases.
- The current v0.5.6 release does not alter the original dirty checkout or publish before protected integration and package gates pass.
- This pass does not implement live SFU transport, background recording, transcription, or automatic screen capture.
- This pass does not create a second meeting window or duplicate Co-working session state.
- The earlier PR #107 cleanup pass did not publish, tag, merge, or deploy an OTA release on its own.

- The earlier automatic-update preparation pass did not push a release tag, publish signed binaries, upload to R2, or mutate live Hermes, Cambium, Cloudflare, or Telegram data-plane infrastructure.
- This release-candidate branch does not itself create or push `v0.7.5`, publish a GitHub Release, or change the public R2 manifest; those remain exact merged-main actions behind the protected publisher.
- This preparation does not rewrite the already-proven candidate/publisher workflow unless a reproducible contract defect is found.
- This pass may harden GitHub release-authority controls, but it cannot copy or delete opaque repository secret values; Apple/R2 secret migration remains a pre-tag operator action.
- This pass does not claim true OTA success; that requires a signed upgrade from the published `v0.5.2` app to the eventual candidate.
- The current release does not merge or modify unrelated PR #40 or the dirty architecture documents in the root checkout.
- This pass does not make Fabric/Paperclip a required reporting hop or restore any deprecated MultiCA authority.
- This pass does not expand the macOS OTA workflow into a Windows or Linux updater release.
- The historical updater preparation did not tag or publish `v0.5.3`; subsequent protected releases established the signed publisher used by v0.5.6.
- This recovery does not allow `all`-repository installations, loosen pinned numeric owner identities, accept unsigned installation facts, or place GitHub credentials in the renderer.
- This recovery does not delete or reinstall an existing GitHub App installation as an automatic repair action.
- Selecting which personal repositories Plexus may access remains an explicit GitHub-owner choice.

</details>

## Principles

- Compact mode changes information priority, not merely scale; only actions needed during a presentation stay primary.
- Native-window policy has one trusted main-process owner, while the renderer owns declarative presentation state.
- Mode changes are reversible: standard bounds and normal stacking behavior must survive every compact round trip.

- Release correctness is an end-to-end property: source gates, packaged artifact, signature, feed metadata, download, install, relaunch, and rollback all matter.
- Upgrade correctness is a transition property: one signed installed baseline must observe and install a different signed version.
- The renderer is untrusted; privileged capabilities and secrets remain in Electron main behind narrow validated IPC.
- Hermes owns reporting orchestration and founder routing; the Workspace Worker remains the member-data plane and degraded daily fallback.
- Evidence must distinguish deterministic local proof, CI proof, signed artifact proof, and live external proof.
- Prefer one strengthened release rule or information flow that prevents a failure class over many release-day reminders.

## Constraints

- Continue from the reviewed source plus committed migration preparation in the
  isolated branch; preserve the pre-existing root checkout's code and document WIP.
- Keep runtime security boundaries, selected-only GitHub authorization, signed OTA
  custody and explicit publication authority unchanged.
- Use package/source for configuration truth, ISA for acceptance, .planning for
  the current queue, and dated receipts for historical/live observations.
- Preserve stable ISC IDs. Existing checkmarks remain dated evidence, not a claim
  that every old criterion describes today's package or live service.
- The next migration bridge must exceed the currently observed 0.7.12 feed;
  retain both historical update paths until installed-client transition is proven.
- Local documentation checks cannot establish authenticated D1/App, two-client
  media, signed publication, or installed desktop acceptance.

<details>
<summary>Historical task framing and constraints (July–September 2026)</summary>

- Keep one `BrowserWindow`; compact mode must not duplicate renderer, call, timer, or media state.
- Keep compact-window IPC named, typed, sender-guarded, and payload-validated in Electron main.
- Keep the existing native display picker and every capture/join/leave action explicit.
- Preserve the existing single-window hardening flags and deny-by-default navigation policy.

- Base all work on current `origin/main` in `.worktrees/automatic-update-consent`; preserve the root checkout and its three dirty architecture documents byte-for-byte.
- Keep `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, restrictive CSP, and deny-by-default navigation/window opening.
- Keep Access JWTs, Worker tokens, member bridge tokens, local API bearer tokens, R2 credentials, and signing credentials out of renderer/preload data; member bridge tokens use main-process `safeStorage` only.
- Preserve one production publisher authority: the tag-triggered workflow is a secret-free candidate gate, while one default-branch `workflow_run` publisher owns signing, GitHub Release, and R2 publication.
- macOS OTA artifacts must be signed and notarized, and the workflow must fail tagged releases when Apple signing or R2 publishing secrets are missing.
- The next candidate version must be greater than the already-published and already-tagged `v0.5.2`.
- MultiCA is deprecated; active contracts, code, product copy, and release evidence must name Hermes/Cambium as current authority.
- Production publishing and data-plane mutation require an explicit later release step after the prepared PR is reviewed and merged; repository approval and tag-protection controls may be configured during preparation.
- The preparation candidate is `v0.7.5`; `v0.7.4` remains the signed installed baseline and public feed until an explicit later release action.
- The workflow files remain unchanged unless an executable or live probe demonstrates a release-contract defect.
- GitHub installation recovery must remain fail-closed: exact pinned account tuple, selected repository scope, GitHub-signed delivery, allowed founder OAuth identity, and a unique correlation are mandatory.
- Existing dirty Plexus and TeamForge checkouts remain untouched; implementation occurs only in clean `origin/main` worktrees.
- Worker webhook diagnostics may store numeric identifiers, event action, and bounded reason codes, but never webhook payloads, OAuth codes, access tokens, or secrets.

### Risks

- The phrase “workflow release upgrade” could mean workflow-action dependency upgrades rather than preparing the next OTA application transition; live evidence currently favors the latter because every workflow action is already SHA-pinned and the latest protected run passed.
- The feature-bearing patch candidate must describe both its governed OmniRoute integration and its upgrade-canary purpose; it is no longer a version-only change.
- Copying the signed baseline into `/Applications` is reversible, but launching it will create or reuse real local Plexus application state; the evidence packet must capture state before and after upgrade.
- A full unsigned package can prove module closure and renderer boot but cannot substitute for the later protected signed/notarized publisher.
- A compact renderer could become a second implicit state machine instead of a presentation of the existing Co-working state.
- `alwaysOnTop` could persist after restore or behave differently across macOS, Windows, Linux, and multi-display moves.
- Source-string tests could stay green while extracted callbacks or focus restoration regress at runtime.
- A small viewport could hide the only restore or leave action, trapping the user in compact mode.

- Repeated startup, interval, or manual checks could overlap and replace an actionable `available` or `downloaded` state.
- A blocking modal or focus-stealing notification could interrupt active employee work; the global prompt must remain visible without taking workspace control.
- Session dismissal could become permanent or suppress a newer version if it is not keyed by state and release version.
- Renderer or assistant logic could accidentally become an update trust oracle; only the signed main-process updater may determine availability.
- Code-only proof could be mistaken for a shipped update even though the public feed still advertises `0.5.2`.

</details>

## Goal

Maintain one current documentation entry point and one acceptance/planning
chain: package and runtime source → ISA.md → .planning/STATE.md and P6 → current
runbooks → dated evidence. Every repository document has a cataloged role,
current guidance has valid local links, and a repeatable verification command
catches source/feed, ISA-count and planning drift.

Complete the scoped documentation cleanup while preserving existing root WIP
and historical evidence. The broader Labs OTA migration remains incomplete until
its live route, artifact, bridge-publication and installed-client criteria pass.

<details>
<summary>Historical task framing and constraints (July–September 2026)</summary>

Refactor Co-working into maintainable presentation components and add a reversible, secure compact casting companion on the existing main window. Done means the standard page retains explicit interaction behavior, compact mode exposes only essential participant controls, native bounds restore exactly, focused tests and both visual states pass, and no release or user-owned worktree state changes.

Ship a reviewable `v0.5.5` from a clean `origin/main` integration lane: preserve every unrelated worktree/stash change, reconcile all fifteen issues, add a bounded read-only assistant tool loop and bounded Temperance skill-index discovery, update release truth, pass every deterministic and packaged gate, merge through protected CI, and publish the signed OTA with explicit live/deferred boundaries.

Prepare the smallest reviewable automatic-update change on a branch from `origin/main`: trusted signed packaged macOS builds check at startup and on a bounded interval, every actionable update appears globally with separate download and restart consent, and the OTA handoff states exactly why the installed `0.5.2` app cannot see source-only `0.5.3` until a protected signed release updates the public feed.

Permanently repair the GitHub App control plane across the Worker and Plexus desktop: preserve selected-only authorization, recover one uniquely matching existing installation from signed facts, expose target-specific reasons, refresh founder state consistently, pass red-green regression coverage, merge through protected CI, deploy the Worker from its reviewed merge, and retain honest live/deferred proof for repository selection and signed desktop delivery.

Prepare an evidence-ready `v0.7.5` OTA upgrade lane without publishing it: install and verify signed `v0.7.4` as the real baseline, create a clean isolated patch candidate, record the exact upgrade and rollback probes, pass deterministic and unsigned packaged gates, and leave merge/tag/feed mutation as explicit later authority steps.

</details>

## Criteria

ISC-1 through ISC-246 retain their original release-specific wording and dated
verification; they are not current-version assertions. ISC-247 through ISC-262
track the September migration. The documentation-governance criteria below
cover this scoped cleanup. Open historical failures are explicitly retained.

### Repository and version boundary

- [x] ISC-1: `git merge-base HEAD origin/main` equals the original `origin/main` SHA used to create the release worktree.
- [x] ISC-2: `ISA.md` passes the E3 project completeness check with at least 32 unique atomic ISCs and at least one `Anti:` ISC.
- [x] ISC-3: `package.json` reports version `0.5.3`.
- [x] ISC-4: `package-lock.json` reports root package version `0.5.3`.
- [x] ISC-5: neither local nor remote refs contain tag `v0.5.3` before release preparation completes.
- [x] ISC-6: the isolated OTA pass does not stage or write the root checkout's three dirty architecture documents, and their final SHA-256 values are recorded in verification evidence.

### Deterministic release gates

- [x] ISC-7: `npm run lint` exits 0.
- [x] ISC-8: `npm run typecheck` exits 0.
- [x] ISC-9: `npm run release:scan-placeholders` exits 0.
- [x] ISC-10: `npm run security:audit:prod` exits 0 with no unwaived high or critical production vulnerability.
- [x] ISC-10.1: `npm run security:audit:release` exits 0 with no high or critical finding across the packaged Electron runtime and release toolchain.
- [x] ISC-11: `npm run verify:csp` exits 0.
- [x] ISC-12: `npm run verify:fuses` exits 0 against the configured production fuse policy.
- [x] ISC-13: `npm run verify:release-evidence` exits 0.
- [x] ISC-14: `npm run verify:release-candidate` exits 0.
- [x] ISC-15: `npm run test:all` exits 0.
- [x] ISC-16: `npm run smoke:all` exits 0 after main and preload builds.
- [x] ISC-17: `npm run build:renderer` exits 0.
- [x] ISC-18: `npm run verify:all` exits 0 on the final candidate commit.
- [x] ISC-19: `npm run release:ota:prep` exits 0 for `v0.5.3` without publishing.
- [x] ISC-20: `npm run release:ota:prep:full` exits 0 and generated `release/latest-mac.yml` reports `version: 0.5.3`.
- [x] ISC-20.1: the unsigned package gate emits only macOS arm64 update filenames and `lipo -archs` reports `arm64` without `x86_64` for the packaged executable.
- [x] ISC-20.2: the packaged architecture verifier rejects any non-arm64 Mach-O helper or native `.node` module inside `Plexus.app`.
- [x] ISC-20.3: a packaged-app bootstrap probe opens the bundled SQLite runtime, initializes a temporary database, and exits 0 before artifact upload.

### Electron trust boundary

- [x] ISC-21: every production `BrowserWindow` sets `contextIsolation: true`.
- [x] ISC-22: every production `BrowserWindow` sets `nodeIntegration: false`.
- [x] ISC-23: every production `BrowserWindow` sets `sandbox: true`.
- [x] ISC-24: every production `BrowserWindow` keeps `webSecurity` enabled.
- [x] ISC-25: production navigation and popup handlers deny untrusted destinations and allow only validated external HTTP(S) URLs through the OS browser.
- [x] ISC-25.1: the default Electron session denies media/display requests unless they originate from the exact trusted renderer WebContents, frame origin, and required user gesture.
- [x] ISC-26: the preload exposes named typed methods and never exposes raw `ipcRenderer`, Node `require`, or `process` to the renderer.
- [x] ISC-27: every renderer-to-main IPC channel that accepts data performs trusted-side validation before a privileged effect.
- [x] ISC-28: member bridge token persistence uses Electron main-process `safeStorage` and has no plaintext fallback.
- [x] ISC-29: production renderer artifacts contain no Access JWT, Worker admin token, scoped bridge token, R2 secret, signing credential, or Telegram routing credential.
- [x] ISC-30: the packaged application enforces the declared Electron fuse and ASAR integrity policy.
- [x] ISC-30.1: the Electron 43 `WasmTrapHandlers` fuse is explicitly declared, applied after pack, and verified rather than inheriting an ungoverned runtime default.
- [x] ISC-30.2: the signed publisher runs one post-build verifier that rejects an invalid code signature, unexpected TeamIdentifier, missing stapled ticket, Gatekeeper rejection, or invalid mounted-DMG app before artifact upload.
- [x] ISC-30.3: DYLD-environment and disabled-library-validation entitlements are removed or retained only with passing signed packaged-runtime necessity evidence.

### Update runtime and user control

- [x] ISC-31: automatic update checks are disabled for unsigned or unpackaged macOS builds unless an explicit development override is set.
- [x] ISC-31.1: one trusted signed packaged macOS process schedules exactly one startup update check without requiring the Settings screen.
- [x] ISC-31.2: one trusted process schedules a bounded periodic update check and application shutdown clears every automatic-check timer.
- [x] ISC-31.3: startup, interval, and manual requests share one in-flight check and automatic discovery skips `checking`, `available`, `downloading`, and `downloaded` states.
- [x] ISC-32: `electron-updater` keeps `autoDownload` disabled.
- [x] ISC-33: `electron-updater` keeps `autoInstallOnAppQuit` disabled.
- [x] ISC-34: Settings exposes distinct check, download, and install-restart states with error and disabled states observable to the user.
- [x] ISC-34.2: an `available` status renders a global version-specific consent prompt while Settings is unmounted.
- [x] ISC-34.3: choosing `Later` dismisses only the same state and version for the current app launch and invokes no updater action.
- [x] ISC-34.4: choosing `Download update` invokes one download only after explicit consent and exposes bounded accessible progress.
- [x] ISC-34.5: a `downloaded` status requires a second explicit `Install & restart` consent and repeated clicks cannot invoke installation twice.
- [x] ISC-34.6: `idle`, `checking`, `not-available`, `error`, and `disabled` statuses render no actionable global prompt.
- [DEFERRED-VERIFY] ISC-34.7: signed `0.5.3` launched against a newer protected feed surfaces the app-level prompt without opening Settings; follow-up task `OTA-AUTO-PROMPT-LIVE-1` owns the screenshot and installed-upgrade receipt.
- [x] ISC-35: the updater feed resolves to the pinned HTTPS origin `https://plexus-upgrade.thoughtseed.space/plexus` by default.
- [x] ISC-36: updater errors produce a recoverable status and do not terminate the Electron main process.
- [x] ISC-36.2: an automatic-check failure remains retryable and cannot trigger download, install, process termination, or an update-consent prompt.
- [x] ISC-36.1: packaged Windows/Linux builds keep OTA disabled until platform-specific signed feeds exist.
- [x] ISC-34.1: custom-feed runbook commands include every opt-in flag enforced by the updater runtime.

### Release workflow, feed, and rollback

- [x] ISC-37: the tag-triggered Release Candidate workflow has read-only permission, receives no Apple/R2 secrets, and builds unsigned arm64 evidence only.
- [x] ISC-37.1: production signing and R2 publication run only from the default-branch Publish OTA workflow after independent merged-main/tag/package validation.
- [x] ISC-37.2: every GitHub-owned Action in CI and OTA workflows is pinned to a full immutable commit SHA, with Dependabot configured for GitHub Actions updates.
- [x] ISC-37.3: a manual Release Candidate dispatch builds unsigned evidence from `main`, while Publish OTA rejects every non-tag-push candidate run.
- [x] ISC-37.4: privileged workflow references use unique `OTA_*` environment-secret names so repository-scoped legacy names cannot satisfy production custody checks.
- [x] ISC-38: the tagged Release workflow fails when any required Cloudflare R2 publishing secret is absent.
- [x] ISC-39: the workflow publishes a ZIP, DMG, matching blockmaps, and `latest-mac.yml` for the candidate version.
- [x] ISC-40: the workflow verifies public feed version, path, and SHA-512 against the locally generated manifest after R2 upload.
- [x] ISC-40.1: public DMG/ZIP bodies are streamed and SHA-512 compared to `latest-mac.yml`; same-length corruption and cross-origin/path-bearing artifact references fail.
- [x] ISC-40.2: GitHub Release asset verification fails when any expected asset lacks a server-provided digest.
- [x] ISC-41: the public feed responds over HTTPS with a non-error status and a bounded cache policy before a release is attempted.
- [ ] ISC-41.1: signed `v0.5.2` rollback objects satisfy the current manifest and immutable-object cache-policy verifier without changing their bytes.
- [x] ISC-42: the previous signed `v0.5.2` GitHub release and OTA assets remain available as the rollback/install baseline.
- [x] ISC-42.1: an unprivileged manual Release Candidate run passes on the exact post-hardening `main` SHA without invoking Publish OTA.
- [x] ISC-43: the release handoff requires recording the PR head SHA, merge commit, tag command, both workflow watch commands, artifact checks, feed check, and rollback boundary.
- [x] ISC-43.1: live GitHub configuration has founder-reviewed `ota-production` restricted to `main`, a founder-only creation/update/deletion ruleset for `v*` tags, and PR/three-platform-CI protection for `main`.
- [x] ISC-43.2: the runbook blocks `v0.5.3` until all nine Apple/R2 values exist as environment secrets and their repository-scoped copies are removed.
- [ ] ISC-43.3: `ota-production` contains all nine unique `OTA_*` secrets and no legacy Apple/R2 credential remains repository-scoped before tag authorization.

### Hermes reporting and infrastructure authority

- [x] ISC-44: active provisioning and reporting authority code contains no MultiCA endpoint, workspace, type, or sink.
- [x] ISC-44.1: Worker and member-bridge traffic are pinned to their canonical origins; renderer, stored legacy state, or redeem-response payloads cannot redirect credentials or reports.
- [x] ISC-44.2: current product and operator guidance uses Workspace Worker/Hermes vocabulary, with remaining TeamForge wording explicitly marked historical or compatibility-only.
- [x] ISC-45: Fabric/Paperclip failure cannot block local focus work, report generation, daily bridge queueing, or monthly Hermes review generation.
- [x] ISC-45.1: onboarding reports connected daily-update readiness only when the member bridge reports `connected`; Worker/local queue state is degraded fallback evidence.
- [x] ISC-45.2: optional Paperclip closeout initializes and resets to opt-in `false` and emits no untouched Paperclip write intent.
- [x] ISC-46: founder-review payloads use `audience: founder_review` and contain no Telegram chat ID, topic ID, bot token, or infrastructure-wide bridge token.
- [x] ISC-47: missing persisted standup evidence can feed both proactive nudges and monthly founder-review compliance.
- [x] ISC-47.1: proactive monthly founder-review activation has a typed, idempotent Hermes-to-member trigger or a live cross-repo Hermes scheduling receipt.
- [x] ISC-48: direct R2 archival code cannot ship a placeholder signature or require employee-side R2 credentials on a reachable production path.

### Anti-criteria

- [x] ISC-49: Anti: this pass creates no `v0.5.3` tag, GitHub Release, R2 upload, or direct push to `main`.
- [x] ISC-50: Anti: final reporting does not describe deterministic tests, unsigned packaging, or a feed HEAD request as a successful signed OTA upgrade.
- [x] ISC-50.1: Anti: no `v0.5.3` tag exists while any production-custody, rollback-policy, signed-runtime, or month-close activation criterion remains open.
- [x] ISC-50.2: Anti: neither renderer nor Hermes/Insight chooses the update feed, authenticates a release, fabricates availability, or silently downloads or installs an update.
- [x] ISC-50.3: Anti: final reporting does not claim the installed `0.5.2` binary will auto-prompt before a newer signed manifest is published; one manual Check is the bridge into this new behavior.

### v0.5.5 consolidation and closure

- [x] ISC-51: every registered worktree, local/remote branch, stash, open PR, and uncommitted path has an evidence-backed disposition.
- [x] ISC-52: the integration branch starts from current `origin/main` in a separate clean worktree.
- [x] ISC-53: no preserved stash, unrelated dirty file, historical worktree, or superseded branch is applied, deleted, or rewritten.
- [x] ISC-54: all fifteen open issues are mapped to close, update-and-close, implement-now, or explicit live/deferred scope.
- [x] ISC-55: model-emitted tool calls are accepted only for registered read-only tools with validated object payloads.
- [x] ISC-56: the model tool loop stops after at most four rounds and returns a bounded redacted failure when it cannot converge.
- [x] ISC-57: confirmation-required tools become visible suggestions and never execute silently inside the model loop.
- [x] ISC-58: tool results return to the model with stable call and tool identifiers for the next response round.
- [x] ISC-59: skill labels are loaded only in Electron main from the canonical local skill index with a one-megabyte file limit.
- [x] ISC-60: missing, malformed, or oversized skill-index input fails to an empty bounded catalog without exposing filesystem paths.
- [x] ISC-61: skill hints are deduplicated, deterministically ordered, and capped at eight.
- [x] ISC-62: package and lock versions both report `0.5.5` before release preparation.
- [x] ISC-63: CHANGELOG, README, deferred register, and release recommendation describe current v0.5.5 truth.
- [x] ISC-64: the final candidate passes `npm run verify:all` from a clean dependency installation.
- [x] ISC-65: the final candidate passes the full unsigned OTA/package preparation including packaged-renderer smoke.
- [x] ISC-66: protected pull-request CI passes on macOS, Ubuntu, and Windows for the exact reviewed head.
- [x] ISC-67: the reviewed head merges to `main` without bypassing required checks.
- [x] ISC-68: tag `v0.5.5` identifies the exact protected merge commit and its Release Candidate workflow passes.
- [x] ISC-69: the protected Publish OTA workflow produces signed/notarized artifacts and updates the public feed to `0.5.5`.
- [ ] ISC-70: a downloaded published ZIP passes packaged-renderer launch smoke before final success is claimed.
- [x] ISC-71: Anti: v0.5.5 does not claim live SFU, transcription, Paperclip acceptance, external skill execution, or fresh Worker/Access persistence proof.

### Co-working cleanup and compact casting companion

- [x] ISC-72: the implementation branch is created from current `origin/main` in a separate clean worktree.
- [x] ISC-72.1: Antecedent: the normal Co-working page renders the current focused room and presence state before compact entry.
- [x] ISC-73: the root checkout's three pre-existing architecture-document modifications remain byte-for-byte untouched by this pass.
- [x] ISC-74: the stateful Co-working controller delegates presence, diagnostics, lounge, and compact presentation markup to named child components.
- [x] ISC-75: `CoWorkingPanel.tsx` contains no duplicated child-component implementation retained after extraction.
- [x] ISC-76: extracted Co-working presentational components import no Electron, preload, database, Worker, or browser media authority.
- [x] ISC-77: existing project focus, join, leave, media, recording, and closeout callbacks retain their current explicit-action semantics.
- [x] ISC-78: all existing `test/coworking` tests pass after component extraction.
- [x] ISC-79: a shared typed contract represents only `standard` and `compact` main-window modes.
- [x] ISC-80: preload exposes named window-mode methods without exposing raw `ipcRenderer` or native window handles.
- [x] ISC-81: the renderer-to-main compact-mode payload is validated before any native window mutation.
- [x] ISC-82: compact entry stores the current standard window bounds before changing geometry.
- [x] ISC-83: compact mode applies bounded small-window dimensions that remain usable on the active display.
- [x] ISC-84: compact mode raises the existing main window without creating a second `BrowserWindow`.
- [x] ISC-85: standard-mode restoration reapplies the saved bounds and disables compact-only always-on-top behavior.
- [x] ISC-86: the compact renderer shows the focused room name or an honest no-room state.
- [x] ISC-87: the compact renderer shows current participant or presence count.
- [x] ISC-88: the compact renderer shows the current timer state without starting or stopping time implicitly.
- [x] ISC-89: the compact renderer preserves explicit mic, camera, and screen control affordances.
- [x] ISC-90: the compact renderer preserves explicit leave and restore actions.
- [x] ISC-91: compact mode hides global navigation, operational diagnostics, proof detail, and ambient lounge configuration.
- [x] ISC-92: compact controls have accessible names, keyboard focus visibility, and a reachable restore action.
- [x] ISC-93: Escape restores standard mode when no modal owns the key event.
- [x] ISC-94: compact-state tests cover entry, idempotence, bounds restoration, and invalid IPC payload rejection.
- [x] ISC-95: a deterministic renderer contract test covers compact information hierarchy and hidden audit surfaces.
- [x] ISC-96: a normal-width screenshot proves the cleaned standard Co-working page still renders.
- [x] ISC-97: a compact-window screenshot proves the casting companion at its target viewport.
- [x] ISC-98: `npm run typecheck`, main build, preload build, and renderer build all exit 0.
- [x] ISC-99: Anti: entering compact mode does not join a room, publish media, start recording, start a timer, or request capture permission.
- [x] ISC-100: Anti: the pass does not modify version metadata, create a release tag, publish OTA artifacts, or alter the user's original dirty checkout.

### Co-working My Studio and v0.5.6 release

- [x] ISC-101: PR #107 head `3814c67` merges through protected `main` before the My Studio release branch is created.
- [x] ISC-102: the standard Co-working surface leads with one selected project bench and its focused screen wall instead of a room-directory-first layout.
- [x] ISC-103: the team-presence rail renders rectangular member benches and caps the default visible set at six with honest overflow copy.
- [x] ISC-104: the top telemetry reports online, focused, lounge, floor, and local private-rhythm states without fabricated biometric measurements.
- [x] ISC-105: the ambient lounge remains secondary while retaining explicit media, device, closeout, and leave controls after joining.
- [x] ISC-106: compact mode remains a separate callback-only presentation of the same controller with one stable remote-audio layer across both modes.
- [x] ISC-107: release documentation includes only the approved My Studio moodboard, page, and component visual references from this iteration.
- [x] ISC-108: `package.json` and `package-lock.json` report candidate version `0.5.6` before tag creation.
- [x] ISC-109: `npm run verify:all` passes from the final v0.5.6 integration tree before the clean packaging commit.
- [x] ISC-110: `npm run release:ota:prep:full` produces an unsigned arm64 candidate whose `latest-mac.yml` reports `version: 0.5.6`.
- [x] ISC-111: protected pull-request CI passes on macOS, Ubuntu, and Windows for the exact My Studio v0.5.6 head.
- [x] ISC-112: the reviewed My Studio v0.5.6 head merges to `main` without bypassing required checks.
- [x] ISC-113: tag `v0.5.6` points to the exact protected merge commit and contains both PR #107 compact mode and My Studio.
- [x] ISC-114: the protected OTA publisher produces signed and notarized macOS artifacts and updates the public feed to `0.5.6`.
- [x] ISC-115: GitHub Release and public manifest assets have exact v0.5.6 filenames, paths, sizes, and SHA-512 metadata.
- [x] ISC-116: Anti: My Studio adds no avatar movement, spatial collision, implicit room join, automatic capture, recording, transcription, or simulated biorhythm percentage.
- [x] ISC-117: the original dirty checkout and its unrelated architecture edits remain untouched throughout integration and publication.
- [x] ISC-118: only the named packaged-renderer smoke receives an ephemeral local API port; normal Plexus startup remains pinned to the production loopback contract.
- [x] ISC-119: the packaged-renderer smoke loads the bundled `app.asar` DOM while another Plexus process owns production port `31339`.

### Private GitHub App permanent recovery

- [x] ISC-120: the Plexus implementation branch starts from current Plexus `origin/main` in a clean worktree.
- [x] ISC-120.1: the Worker implementation branch starts from current TeamForge `origin/main` in a clean worktree.
- [x] ISC-121: a read-only production D1 probe proves the bound Sheshiyer installation is active with `repository_selection = 'all'` before repair.
- [x] ISC-122: a read-only GitHub probe reports the active selected organization installation ID before repair.
- [x] ISC-122.1: a read-only D1 probe reports a different pending organization installation hint before repair.
- [x] ISC-123: Anti: neither original dirty checkout receives a task-authored file change.
- [x] ISC-124: the Worker returns one target-status entry for pinned owner `thoughtseed-labs`.
- [x] ISC-124.1: the Worker returns one target-status entry for pinned owner `Sheshiyer`.
- [x] ISC-124.2: the Worker returns one target-status entry for pinned owner `psychon7`.
- [x] ISC-125: an active exact installation with repository selection `all` returns reason `repository_scope_all`.
- [x] ISC-126: an unconsumed owner OAuth state returns reason `oauth_pending` for that exact target.
- [x] ISC-127: an OAuth-verified state without a signed installation fact returns reason `trust_anchor_missing`.
- [x] ISC-128: an OAuth-verified installation hint that differs from the unique signed target fact returns reason `installation_hint_mismatch` before recovery.
- [x] ISC-129: every Worker connection reason is emitted from a closed machine-readable enum.
- [x] ISC-130: a signed non-deletion installation lifecycle event can establish a missing fact for an exact allowlisted target.
- [x] ISC-131: a recovery fact is rejected unless its repository selection is `selected`.
- [x] ISC-132: an unsigned or invalid-signature webhook cannot create or update an installation fact.
- [x] ISC-133: a recovery fact is ignored unless its numeric account ID, login, and account type match the pinned target.
- [x] ISC-134: binding recovery requires the signed event actor to match the verified allowed-founder OAuth actor.
- [x] ISC-135: binding recovery succeeds only when exactly one active selected signed fact matches the target and actor.
- [x] ISC-136: multiple matching signed facts fail closed with an explicit ambiguity reason.
- [x] ISC-137: a stale installation hint may be replaced only by the unique signed fact selected by ISC-135.
- [x] ISC-138: successful recovery marks the exact connection state `bound`.
- [x] ISC-138.1: successful recovery upserts one active workspace installation binding.
- [x] ISC-139: webhook delivery diagnostics persist the normalized GitHub action.
- [x] ISC-140: webhook delivery diagnostics persist the positive installation ID when present.
- [x] ISC-141: webhook delivery diagnostics persist the positive account ID when present.
- [x] ISC-142: ignored and failed webhook deliveries persist a bounded machine-readable result reason.
- [x] ISC-143: replaying an already processed delivery returns the idempotent duplicate result.
- [x] ISC-143.1: replaying an already processed delivery creates no duplicate fact or binding.
- [x] ISC-144: the Plexus main-process client preserves Worker target status and reason fields without inventing authority.
- [x] ISC-145: terminal owner polling refreshes the connection state.
- [x] ISC-145.1: terminal owner polling refreshes the founder actor state.
- [x] ISC-146: manual GitHub refresh resolves the connection state.
- [x] ISC-146.1: manual GitHub refresh resolves the founder actor state.
- [x] ISC-147: Settings reports connected owners separately from known installation records and total pinned owners.
- [x] ISC-148: each owner action label is derived from its target status and reason.
- [x] ISC-149: repository-scope failure renders repository-selection guidance.
- [x] ISC-149.1: missing trust anchor renders signed-delivery recovery guidance.
- [x] ISC-149.2: installation-hint mismatch renders correlation-recovery guidance.
- [x] ISC-149.3: pending OAuth renders completion guidance for the exact owner.
- [x] ISC-149.4: suspended installation renders reactivation guidance.
- [x] ISC-149.5: connected installation renders successful authority guidance.
- [x] ISC-150: founder verification remains disabled until at least one exact selected installation is active.
- [x] ISC-151: Anti: no GitHub token, OAuth code, webhook payload, Worker admin secret, or bridge token enters renderer state or logs.
- [x] ISC-152: a focused Worker reason-mapping test fails for the expected missing behavior before implementation.
- [x] ISC-152.1: the focused Worker reason-mapping test passes after implementation.
- [x] ISC-153: a focused Worker existing-install recovery test fails for the expected missing behavior before implementation.
- [x] ISC-153.1: the focused Worker existing-install recovery test passes after implementation.
- [x] ISC-154: a focused Worker webhook-diagnostics test fails for the expected missing behavior before implementation.
- [x] ISC-154.1: the focused Worker webhook-diagnostics test passes after implementation.
- [x] ISC-155: a focused Plexus target-normalization test fails for the expected missing behavior before implementation.
- [x] ISC-155.1: the focused Plexus target-normalization test passes after implementation.
- [x] ISC-156: a focused Plexus Settings-state test fails for the expected missing behavior before implementation.
- [x] ISC-156.1: the focused Plexus Settings-state test passes after implementation.
- [x] ISC-157: the final Worker branch passes its focused GitHub tests from a clean dependency state.
- [x] ISC-157.1: the final Worker branch passes its full test command from a clean dependency state.
- [x] ISC-157.2: the final Worker branch passes typecheck from a clean dependency state.
- [x] ISC-158: the final Plexus branch passes its focused GitHub tests from a clean dependency state.
- [x] ISC-158.1: the final Plexus branch passes `npm run verify:all` from a clean dependency state.
- [x] ISC-159: the Worker change merges through required protected pull-request checks without bypass.
- [x] ISC-160: the production Worker deploy identifies the exact reviewed merge commit.
- [x] ISC-160.1: the public Worker health probe succeeds after deployment.
- [x] ISC-161: the Plexus change merges through required protected pull-request checks without bypass.
- [ ] ISC-162: signed desktop delivery proof is recorded for the first Plexus release containing the repaired GitHub surface, or a named deferred follow-up owns that proof.
- [ ] ISC-163: a live read-only D1 probe confirms the personal installation becomes `selected` before calling that owner connected.
- [ ] ISC-164: a live read-only D1 probe confirms `thoughtseed-labs` binds to actual installation `146468777` or a later GitHub-confirmed replacement.
- [ ] ISC-165: a live authenticated Plexus probe shows the founder actor as verified after an active selected binding exists.
- [x] ISC-166: Anti: repair performs no direct production D1 surgery.
- [x] ISC-166.1: Anti: repair performs no automatic GitHub App uninstall.
- [x] ISC-166.2: Anti: repair performs no pinned-owner relaxation.
- [x] ISC-166.3: Anti: repair performs no selected-only policy bypass.
- [ ] ISC-167: the GitHub App registration requests only metadata read, contents write, pull requests write, issues read, actions read, and checks read.
- [ ] ISC-168: the organization installation grants the complete required permission set before it is reported connected.
- [ ] ISC-169: the personal installation grants the complete required permission set before it is reported connected.
- [x] ISC-170: a selected exact installation missing any required permission returns reason `permissions_incomplete`.
- [x] ISC-171: signed installation facts persist a normalized bounded required-permission snapshot.
- [x] ISC-172: Anti: empty optional repository-event subscriptions do not block installation lifecycle processing.
- [ ] ISC-173: a read-only GitHub API probe confirms the registration contains no unnecessary administration, merge-queue, hook, organization-administration, or repository-project permission.
- [ ] ISC-174: a live installation-token probe lists at least one explicitly selected repository after permission approval.
- [ ] ISC-175: permission approval is performed through GitHub installation authority, not by direct database mutation.

### v0.7.5 OTA upgrade preparation

- [x] ISC-176: the release worktree starts at exact current `origin/main` commit `f133581aa1b62cc6fb35dde6c6e95876568b4077`.
- [x] ISC-177: the isolated release worktree is clean before candidate preparation begins.
- [x] ISC-178: the public OTA manifest reports stable version `0.7.4` before preparation.
- [x] ISC-179: GitHub's latest non-draft non-prerelease release is `v0.7.4`.
- [x] ISC-180: `package.json` reports candidate version `0.7.5`.
- [x] ISC-181: `package-lock.json` reports candidate version `0.7.5`.
- [x] ISC-182: local and remote refs contain no `v0.7.5` tag.
- [x] ISC-183: signed `v0.7.4` is installed at `/Applications/Plexus.app`.
- [x] ISC-184: the installed baseline reports bundle version `0.7.4`.
- [x] ISC-185: the installed baseline has a non-ad-hoc Developer ID signature.
- [x] ISC-185.1: the installed baseline signature reports a populated team identifier.
- [x] ISC-186: Gatekeeper accepts the installed baseline for execution.
- [x] ISC-187: the public `v0.7.4` manifest reports the expected version, path, size, and SHA-512 metadata.
- [x] ISC-187.1: every `v0.7.4` manifest artifact returns the declared byte length.
- [x] ISC-187.2: every hashed `v0.7.4` manifest artifact matches its declared SHA-512.
- [x] ISC-187.3: every versioned `v0.7.4` artifact has an immutable one-year cache policy.
- [x] ISC-187.4: public `latest-mac.yml` has a revalidating cache policy no longer than sixty seconds.
- [x] ISC-188: the release evidence packet names `v0.7.4` as from-version and `v0.7.5` as to-version.
- [x] ISC-189: the release evidence packet names the manual update-check probe.
- [x] ISC-189.1: the release evidence packet names the available-version prompt probe.
- [x] ISC-189.2: the release evidence packet names the explicit download probe.
- [x] ISC-189.3: the release evidence packet names the explicit install-and-restart probe.
- [x] ISC-189.4: the release evidence packet names the post-relaunch version probe.
- [x] ISC-189.5: the release evidence packet names the local-data retention probe.
- [x] ISC-189.6: the release evidence packet names the rollback decision probe.
- [x] ISC-190: `verify-release-ref --mode prepare` accepts `0.7.5` as newer than public `0.7.4`.
- [x] ISC-191: `npm run release:ota:prep` exits zero on the candidate.
- [x] ISC-192: `npm run release:ota:prep:full` exits zero from a clean candidate commit.
- [x] ISC-193: generated `release/latest-mac.yml` reports version `0.7.5`.
- [x] ISC-194: the unsigned packaged candidate passes the macOS arm64 architecture probe.
- [x] ISC-194.1: the unsigned packaged candidate passes the Electron fuse probe.
- [x] ISC-194.2: the unsigned packaged candidate passes the packaged SQLite bootstrap probe.
- [x] ISC-194.3: the unsigned packaged candidate passes the packaged main-process module smoke.
- [x] ISC-194.4: the unsigned packaged candidate passes the packaged renderer smoke.
- [x] ISC-195: the prepared branch changes no candidate or publisher workflow file unless a failing contract probe requires it.
- [x] ISC-196: the `ota-production` environment still requires founder review.
- [x] ISC-196.1: the `ota-production` environment still enforces a branch deployment policy.
- [x] ISC-197: the candidate branch contains no signing, Apple, R2, GitHub, or bridge secret value.
- [x] ISC-198: signed `v0.7.1` remains available as the current rollback baseline.
- [x] ISC-199: Anti: preparation creates no local or remote `v0.7.5` tag.
- [x] ISC-200: Anti: preparation creates no `v0.7.5` GitHub Release.
- [x] ISC-201: Anti: preparation does not mutate public `latest-mac.yml` or immutable `v0.7.4` artifacts.
- [x] ISC-202: a reviewable pull request owns the prepared candidate branch.
- [x] ISC-202.1: the handoff keeps merge, tag, publication, and live upgrade proof as explicit later steps.
- [x] ISC-203: the evidence packet labels unsigned preparation as partial proof rather than a completed OTA upgrade.
- [x] ISC-204: static workflow inspection confirms pull requests and version-file changes cannot invoke the protected publisher.
- [x] ISC-205: static workflow inspection confirms only a successful tag-push candidate can enter the protected publisher.
- [x] ISC-206: the evidence packet defers signed apply-and-relaunch proof until the protected `v0.7.5` publication.
- [x] ISC-207: the evidence packet describes rollback as explicit reinstall of a retained signed baseline, not automatic reversion.
- [x] ISC-208: the evidence packet records the installed `v0.7.4` artifact digest.
- [x] ISC-209: the evidence packet records the installed baseline signature team identifier.
- [x] ISC-210: the evidence packet requires a pre-upgrade local-state fingerprint.
- [x] ISC-211: the exact merged Hermes relay release is live behind Cloudflare Access with loopback-only listeners, authenticated model/SSE proof, secret-safe receipts, and a successful exact-digest rollback rehearsal.
- [x] ISC-212: the governed Plexus OmniRoute integration merges through green pull-request and merged-main macOS, Ubuntu, and Windows CI.
- [x] ISC-213: production packaging receives the canonical relay origin from repository variable authority and packages no relay credential.
- [x] ISC-214: the integrated v0.7.5 candidate passes the full clean-worktree OTA preparation, including all deterministic and unsigned packaged-app gates.

### v0.7.6 packaged OmniRoute authority hotfix

- [x] ISC-215: signed `v0.7.5` installs and relaunches through the production OTA consent flow.
- [x] ISC-216: the installed `v0.7.5` retains the authenticated member session and `ws_thoughtseed` workspace.
- [x] ISC-217: a live installed-app probe reproduces Clio `GATEWAY OFFLINE` with `PLEXUS_OMNIROUTE_RELAY_ORIGIN is required.`
- [x] ISC-218: the production relay authority is compiled into the packaged main-process runtime.
- [x] ISC-219: packaged origin resolution succeeds when `PLEXUS_OMNIROUTE_RELAY_ORIGIN` is absent.
- [x] ISC-220: packaged origin resolution rejects a canonical HTTPS origin that differs from the baked production authority.
- [x] ISC-221: non-packaged development retains an explicit loopback-only relay override.
- [x] ISC-222: every `fetchOmniRouteWithAccess` production caller supplies an already-resolved relay origin.
- [x] ISC-223: Anti: `fetchOmniRouteWithAccess` does not recover relay authority from process environment.
- [x] ISC-224: the unsigned packaged `app.asar` main-process smoke resolves the production relay authority with the process variable absent.
- [x] ISC-225: package and lock metadata both report candidate version `0.7.6`.
- [x] ISC-226: the complete clean-worktree OTA preparation passes for exact candidate version `0.7.6`.
- [x] ISC-227: the v0.7.6 pull request passes protected macOS, Ubuntu, and Windows CI before merge.
- [x] ISC-228: exact merged-main v0.7.6 commit is tagged once and passes protected Release Candidate plus Publish OTA.
- [x] ISC-229: the public OTA manifest and immutable artifacts verify as signed version `0.7.6`.
- [x] ISC-230: an installed signed `v0.7.5` upgrades to `v0.7.6` only after explicit download and restart consent.
- [x] ISC-231: the relaunched corrected Clio catalog reports `READY` and exposes the governed Temperance lane catalog without losing the authenticated session.

### v0.7.7 Cloudflare Access relay-carrier hotfix

- [x] ISC-232: installed v0.7.6 preserves the authenticated Thoughtseed admin workspace and stores the captured Access JWT only under encrypted `tf.accessJwtEnc`, while truthfully reporting Clio `sign_in_required`.
- [x] ISC-233: a live production SSM carrier matrix proves the origin-facing Access assertion header returns `302`, while the client-facing Access token header and Access cookie each return `200`.
- [x] ISC-234: the relay fetch strips caller authorization, cookie, Access assertion, and Access token headers before attaching the safe-storage-owned JWT as `Cf-Access-Token`.
- [x] ISC-235: package and lock metadata both report candidate version `0.7.7`.
- [x] ISC-236: the complete clean-worktree OTA preparation passes for exact candidate version `0.7.7`.
- [x] ISC-237: the v0.7.7 pull request passes protected macOS, Ubuntu, and Windows CI before merge.
- [x] ISC-238: exact merged-main v0.7.7 is tagged once, passes protected candidate/publication workflows, and its public OTA artifacts verify independently.
- [ ] ISC-239: installed signed v0.7.6 upgrades to v0.7.7 through separate consent boundaries, preserves account/workspace continuity, renders the governed lane catalog, and completes a content-bearing streamed Clio turn.

### v0.7.8 AI SDK instruction-shape hotfix

- [x] ISC-240: the installed v0.7.7 live Clio smoke captures `AI_InvalidPromptError` before any network request because system messages are no longer accepted in the SDK `messages` field.
- [x] ISC-241: shared AI SDK request construction extracts the canonical leading system-policy block into `instructions`, preserves its bytes, removes system roles from `messages`, and rejects interleaved system mutation.
- [x] ISC-242: focused and real-installed-SDK OmniRoute coverage proves instructions plus user, assistant tool-call, tool-result, and follow-up message preservation.
- [x] ISC-243: package and lock metadata both report candidate version `0.7.8`.
- [x] ISC-244: the complete clean-worktree OTA preparation passes for exact candidate version `0.7.8`.
- [x] ISC-245: exact merged-main v0.7.8 passes protected CI, is tagged once, and passes candidate/publication workflows with independent public artifact verification.
- [x] ISC-246: installed signed v0.7.7 upgrades to v0.7.8 through separate consent boundaries, preserves account/workspace continuity, keeps the governed catalog ready, and completes a content-bearing streamed Clio turn.

### Labs migration continuation, September 2026

- [x] ISC-247: the migration receipt identifies the source and Labs account/config authority using current repository and profile-scoped evidence.
- [x] ISC-248: a read-only comparison records the current source/Labs OTA manifest version pair with its observation date.
- [x] ISC-249: the migration receipt distinguishes live secret-name inventory from credential validity and authenticated capability proof.
- [x] ISC-250: the cleanup workflow binds its job to the protected ota-production environment.
- [x] ISC-251: the focused cleanup regression suite passes all destination, active-feed, dry-run, key-scope, and error-handling cases.
- [x] ISC-252: the OTA runbook declares the same default feed URL as current runtime and packaging source.
- [x] ISC-253: the migration plan preserves a bridge-update path for both historical installed-client feed cohorts.
- [x] ISC-254: Anti: this scoped preparation does not change any pre-existing dirty root file outside its explicit planning continuation pointer.
- [ ] ISC-255: the accepted Labs OTA hostname passes the manifest and artifact transport acceptance packet.
- [ ] ISC-256: an exact OTA object inventory reconciles the approved source/target key set with size and digest evidence.
- [ ] ISC-257: a reviewed bridge release newer than 0.7.12 pins the accepted Labs feed in runtime and packaging source.
- [ ] ISC-258: both historical feeds serve byte-identical signed bridge artifacts before either bridge manifest is advanced.
- [ ] ISC-259: an installed custom-feed baseline completes the signed bridge upgrade with account/workspace continuity.
- [ ] ISC-260: an installed legacy-r2.dev baseline completes the signed bridge upgrade with account/workspace continuity.
- [ ] ISC-261: the bridge-installed app discovers a subsequent signed release through the Labs feed.
- [ ] ISC-262: an explicit dormant-client retention policy precedes any legacy OTA feed retirement.

### Repository documentation governance, September 2026

- [x] ISC-263: every tracked repository document has a cataloged current, historical, evidence, archive or reference role.
- [x] ISC-264: current-guidance local file links pass the documentation verifier.
- [x] ISC-265: the documentation verifier confirms the current runbook feed matches runtime and packaging source.
- [x] ISC-266: active planning has one current phase consistent with NEXT-WAVE.
- [x] ISC-267: current ISA progress matches its unique criterion checklist.
- [x] ISC-268: the repository CI invokes documentation and release-operations checks.
- [x] ISC-269: original dated evidence and project memory records retain their before-pass bytes.
- [x] ISC-270: active setup guidance describes Fabric/Paperclip as retired and routes reporting to its current owner.

## Test Strategy

```yaml
- isc: ISC-1..ISC-6
  type: repository-integrity
  check: base SHA, version parity, duplicate tag absence, root dirty-file hashes
  threshold: exact match
  tool: git rev-parse + git ls-remote + node package JSON probe + shasum -a 256

- isc: ISC-7..ISC-20.1
  type: executable-release-gates
  check: deterministic quality and unsigned packaging commands
  threshold: every command exits 0; generated manifest version equals 0.5.3
  tool: npm scripts

- isc: ISC-21..ISC-30.1
  type: trust-boundary-regression
  check: window policy, preload surface, IPC validators, token custody, fuses, renderer secret surface
  threshold: zero unsafe production path
  tool: focused Vitest tests + source policy verifiers + packaged fuse verifier

- isc: ISC-31..ISC-36.2
  type: updater-state-machine
  check: signed-build gate, singleton startup/interval discovery, single-flight suppression, global state-and-version consent, explicit download/restart, error recovery
  threshold: every focused timer, state transition, accessibility, and no-side-effect assertion passes
  tool: Vitest fake timers + React SSR/component contract + source inspection

- isc: ISC-37..ISC-43.2
  type: release-workflow-contract
  check: signing/R2 fail-closed behavior, artifact inventory, public manifest parity, rollback baseline, operator runbook
  threshold: static workflow tests pass now; live artifact checks remain explicit release-step evidence
  tool: workflow contract tests + gh + curl

- isc: ISC-44..ISC-48
  type: authority-and-reachability
  check: Hermes authority guard, optional helper degradation, redacted payload, standup consumers, no reachable placeholder R2 signer
  threshold: no deprecated authority or credential-bearing reachable path
  tool: focused Vitest + rg/import graph inspection

- isc: ISC-49..ISC-50.3
  type: anti-probe
  check: no tag/release/publish mutation, no assistant/renderer trust authority, no silent update, and no overstated live proof
  threshold: absent
  tool: git refs + gh release list + final evidence review

- isc: ISC-72..ISC-78
  type: component-architecture
  check: isolated base, extraction boundaries, authority imports, preserved callback semantics, focused regressions
  threshold: clean scoped diff and all Co-working tests pass
  tool: git + rg + Vitest

- isc: ISC-79..ISC-85
  type: native-window-contract
  check: typed preload IPC, trusted validation, one-window compact entry, idempotence, and exact restoration
  threshold: focused main/preload tests pass with no security regression
  tool: Vitest + source-policy inspection

- isc: ISC-86..ISC-95
  type: compact-renderer-contract
  check: essential participant information remains, audit surfaces hide, controls stay explicit and accessible
  threshold: renderer contract and interaction tests pass
  tool: Vitest + React/source contract probes

- isc: ISC-96..ISC-100
  type: release-proportional-proof
  check: standard and compact screenshots, build gates, no implicit authority, no release mutation
  threshold: both screenshots captured, every command exits 0, anti-probes absent
  tool: screenshot harness + npm scripts + git refs/status

- isc: ISC-101..ISC-108
  type: my-studio-integration
  check: compact ancestry, focused workbench, bounded benches, truthful telemetry, lounge continuity, approved references, version parity
  threshold: exact main ancestry, component contracts pass, package and lock equal 0.5.6
  tool: git ancestry + Vitest + source contract + package JSON probe

- isc: ISC-109..ISC-119
  type: protected-ota-publication
  check: complete deterministic gates, arm64 package manifest, protected CI and merge, tag ancestry, signed assets, public feed, anti-probes
  threshold: every local and protected gate passes; public latest-mac.yml equals 0.5.6 and matches release assets
  tool: npm scripts + gh + curl + manifest parser + git refs

- isc: ISC-120..ISC-143
  type: github-worker-recovery
  check: clean isolation, live root-cause evidence, target reasons, signed-fact recovery, webhook diagnostics, idempotence, and fail-closed guards
  threshold: every focused Worker regression passes and anti-probes find no policy relaxation
  tool: git + Wrangler SELECT + GitHub API + Worker Vitest + migration schema probe

- isc: ISC-144..ISC-156
  type: plexus-github-operator-surface
  check: reason-preserving client normalization, synchronized actor refresh, truthful counts, status-aware actions, and distinct guidance
  threshold: focused client and renderer regressions pass with no secret-bearing renderer shape
  tool: Vitest + React/source contract probes + rg secret anti-scan

- isc: ISC-157..ISC-166
  type: protected-github-recovery-rollout
  check: clean full gates, protected merges, exact Worker deploy, signed/deferred desktop proof, and read-only live state confirmation
  threshold: deterministic gates and protected checks pass; live criteria remain open or named deferred until independently probed
  tool: npm scripts + gh + Wrangler deploy/status + curl + D1 SELECT + authenticated app capture

- isc: ISC-167..ISC-175
  type: github-app-permission-contract
  check: least-privilege registration, installation approval, signed permission facts, permission reason, and live repository-token proof
  threshold: exact six-permission registration, complete grants, no extras, and at least one explicitly selected repository visible
  tool: GitHub API + signed webhook fixture + Worker Vitest + installation-token repository list

- isc: ISC-176..ISC-210
  type: ota-upgrade-preparation
  check: exact main isolation, signed installed baseline, monotonic candidate metadata, evidence packet, deterministic package gates, protected authority, and no-publication anti-probes
  threshold: v0.7.4 remains installed/public; v0.7.5 is cleanly prepared and reviewable without any tag or feed mutation
  tool: git + gh + curl + codesign + spctl + npm release gates + manifest verifier

- isc: ISC-211..ISC-214
  type: governed-omniroute-release-integration
  check: exact merged relay deployment and rollback, Plexus protected integration, repository-origin authority, and full integrated OTA package proof
  threshold: live authenticated relay path and clean v0.7.5 packaged candidate pass without embedding credentials or mutating the public feed
  tool: Cloudflare Access + AWS SSM + GitHub CI + npm release:ota:prep:full

- isc: ISC-215..ISC-239
  type: installed-omniroute-ota-recovery
  check: packaged authority, protected signed releases, installed transitions, Cloudflare client carrier, governed catalog, and live Clio stream
  threshold: v0.7.7 reaches the authenticated relay through the same Plexus Access account flow and completes a streamed lane turn
  tool: Vitest + AWS SSM + GitHub Actions + public manifest verifier + installed Electron Computer Use
```

### September Labs migration probes

| ISC | Type | Check | Threshold | Tool |
| --- | --- | --- | --- | --- |
| 247–249 | inspection/live read | Account-pinned configs, profile dev-url/manifest reads, name-only secret metadata | Dated observations and limits recorded | Wrangler + gh + source read |
| 250 | workflow | cleanup.environment | ota-production | YAML/readback |
| 251 | regression | npm run test:release-ops | all cases pass, fake AWS only | Node test runner |
| 252 | source contract | runtime/package default equals documented current default | exact URL match | Python/source read |
| 253 | planning | both old-client cohort paths retained | bridge sequence recorded | source/tag and plan read |
| 254 | preservation | pre-existing root SHA-256 manifest | unchanged | SHA-256 comparison |
| 255 | live HTTP | Labs feed packet: manifest, bytes, HEAD/range, cache | every named probe passes | curl + artifact verifier |
| 256 | data | exact allowlisted object reconciliation | no unresolved key/digest conflict | scoped R2 inventory |
| 257 | release source | accepted feed and bridge version | >0.7.12; both pins equal | source + release verifier |
| 258 | publication | both historical bridge artifact sets | digest equality before manifests | protected publisher receipts |
| 259–260 | desktop | installed baseline-to-bridge transition | consent and continuity verified per cohort | packaged desktop probe |
| 261 | desktop | bridge-to-next update discovery | Labs endpoint observed | packaged update trace |
| 262 | policy | dormant-client retirement conditions | explicit retained bridge policy | reviewed retention record |

### Documentation governance verification

| ISC | Probe | Threshold |
| --- | --- | --- |
| 263–267 | npm run verify:docs | complete catalog, valid active links, exact source feed, one current phase, exact unique ISC count |
| 268 | CI workflow readback | verify:docs and test:release-ops steps present |
| 269 | SHA-256 comparison against before-pass inventory | every original dated evidence/project memory file unchanged |
| 270 | source/README/optional-helper contract review | retirement is explicit; source behavior and reporting ownership linked |

## Features

```yaml
- name: ElectronTrustBoundary
  description: Window hardening, typed preload, validated IPC, safeStorage token custody, CSP, and fuses
  satisfies: [ISC-21, ISC-22, ISC-23, ISC-24, ISC-25, ISC-26, ISC-27, ISC-28, ISC-29, ISC-30, ISC-30.1]
  depends_on: []
  parallelizable: true

- name: AutomaticDiscoveryConsentUpdater
  description: Trusted startup and periodic discovery with global version-scoped download and restart consent
  satisfies: [ISC-31, ISC-31.1, ISC-31.2, ISC-31.3, ISC-32, ISC-33, ISC-34, ISC-34.2, ISC-34.3, ISC-34.4, ISC-34.5, ISC-34.6, ISC-34.7, ISC-35, ISC-36, ISC-36.1, ISC-36.2, ISC-50.2, ISC-50.3]
  depends_on: [ElectronTrustBoundary]
  parallelizable: false

- name: HermesReportingAuthority
  description: Direct member bridge to Hermes, optional helper degradation, redacted founder review, and standup compliance
  satisfies: [ISC-44, ISC-44.1, ISC-45, ISC-46, ISC-47, ISC-48]
  depends_on: [ElectronTrustBoundary]
  parallelizable: true

- name: ReleaseGate
  description: Deterministic tests, security checks, artifact smoke, versioning, and candidate preparation
  satisfies: [ISC-3, ISC-4, ISC-5, ISC-7, ISC-8, ISC-9, ISC-10, ISC-10.1, ISC-11, ISC-12, ISC-13, ISC-14, ISC-15, ISC-16, ISC-17, ISC-18, ISC-19, ISC-20, ISC-20.1]
  depends_on: [ElectronTrustBoundary, AutomaticDiscoveryConsentUpdater, HermesReportingAuthority]
  parallelizable: false

- name: SignedFeedWorkflow
  description: Secret-free tag evidence plus trusted fail-closed signing/R2 publication with byte integrity, protected authority, rollback, and release-watch handoff
  satisfies: [ISC-37, ISC-37.1, ISC-38, ISC-39, ISC-40, ISC-40.1, ISC-41, ISC-42, ISC-43, ISC-43.1, ISC-43.2, ISC-49, ISC-50]
  depends_on: [ReleaseGate]
  parallelizable: false

- name: RepositoryIntegrity
  description: Main-based isolation, stable ISA, and preservation of unrelated root work
  satisfies: [ISC-1, ISC-2, ISC-6]
  depends_on: []
  parallelizable: false

- name: CoWorkingComponentCleanup
  description: Extract participant, presence, diagnostics, lounge, and compact presentation roles from the stateful controller
  satisfies: [ISC-72, ISC-73, ISC-74, ISC-75, ISC-76, ISC-77, ISC-78]
  depends_on: []
  parallelizable: false

- name: CompactNativeWindow
  description: Reversible validated one-window compact geometry and stacking contract
  satisfies: [ISC-79, ISC-80, ISC-81, ISC-82, ISC-83, ISC-84, ISC-85, ISC-94]
  depends_on: [ElectronTrustBoundary]
  parallelizable: true

- name: CompactCastingSurface
  description: Participant-first compact renderer with essential state, explicit controls, accessibility, and restore
  satisfies: [ISC-86, ISC-87, ISC-88, ISC-89, ISC-90, ISC-91, ISC-92, ISC-93, ISC-95, ISC-96, ISC-97, ISC-99]
  depends_on: [CoWorkingComponentCleanup, CompactNativeWindow]
  parallelizable: false

- name: CompactReleaseProof
  description: Focused regressions, deterministic builds, visual evidence, and release-mutation anti-probes
  satisfies: [ISC-78, ISC-94, ISC-95, ISC-96, ISC-97, ISC-98, ISC-100]
  depends_on: [CompactCastingSurface]
  parallelizable: false

- name: MyStudioWorkspace
  description: Focus-first standard workspace with bounded team benches, truthful rhythm telemetry, and a secondary ambient lounge
  satisfies: [ISC-102, ISC-103, ISC-104, ISC-105, ISC-107, ISC-116]
  depends_on: [CoWorkingComponentCleanup, CompactCastingSurface]
  parallelizable: false

- name: MyStudioOtaRelease
  description: One protected v0.5.6 lineage containing compact mode, My Studio, signed artifacts, and public feed proof
  satisfies: [ISC-101, ISC-106, ISC-108, ISC-109, ISC-110, ISC-111, ISC-112, ISC-113, ISC-114, ISC-115, ISC-117, ISC-118, ISC-119]
  depends_on: [MyStudioWorkspace, ReleaseGate, SignedFeedWorkflow]
  parallelizable: false

- name: GitHubWorkerRecovery
  description: Exact target reasons, signed existing-install recovery, webhook diagnostics, and fail-closed binding reconciliation
  satisfies: [ISC-120, ISC-121, ISC-122, ISC-123, ISC-124, ISC-125, ISC-126, ISC-127, ISC-128, ISC-129, ISC-130, ISC-131, ISC-132, ISC-133, ISC-134, ISC-135, ISC-136, ISC-137, ISC-138, ISC-139, ISC-140, ISC-141, ISC-142, ISC-143, ISC-151, ISC-152, ISC-153, ISC-154, ISC-157, ISC-159, ISC-160, ISC-166]
  depends_on: [ElectronTrustBoundary]
  parallelizable: true

- name: PlexusGitHubStatusUX
  description: Reason-preserving desktop contract, synchronized actor refresh, truthful owner counts, and actionable owner guidance
  satisfies: [ISC-144, ISC-145, ISC-146, ISC-147, ISC-148, ISC-149, ISC-150, ISC-151, ISC-155, ISC-156, ISC-158, ISC-161, ISC-162, ISC-165]
  depends_on: [GitHubWorkerRecovery]
  parallelizable: true

- name: LiveGitHubRecovery
  description: Least-privilege repository selection, exact organization binding, founder proof, and non-destructive operational closeout
  satisfies: [ISC-163, ISC-164, ISC-165, ISC-166, ISC-167, ISC-168, ISC-169, ISC-170, ISC-171, ISC-172, ISC-173, ISC-174, ISC-175]
  depends_on: [GitHubWorkerRecovery, PlexusGitHubStatusUX]
  parallelizable: false

- name: OtaUpgradePreparation
  description: Install the signed baseline, prepare a monotonic candidate, freeze live upgrade evidence, and preserve the protected publication boundary
  satisfies: [ISC-176, ISC-177, ISC-178, ISC-179, ISC-180, ISC-181, ISC-182, ISC-183, ISC-184, ISC-185, ISC-185.1, ISC-186, ISC-187, ISC-187.1, ISC-187.2, ISC-187.3, ISC-187.4, ISC-188, ISC-189, ISC-189.1, ISC-189.2, ISC-189.3, ISC-189.4, ISC-189.5, ISC-189.6, ISC-190, ISC-191, ISC-192, ISC-193, ISC-194, ISC-194.1, ISC-194.2, ISC-194.3, ISC-194.4, ISC-195, ISC-196, ISC-196.1, ISC-197, ISC-198, ISC-199, ISC-200, ISC-201, ISC-202, ISC-202.1, ISC-203, ISC-204, ISC-205, ISC-206, ISC-207, ISC-208, ISC-209, ISC-210, ISC-211, ISC-212, ISC-213, ISC-214]
  depends_on: [ReleaseGate, SignedFeedWorkflow]
  parallelizable: false
```

### September migration work breakdown

| Name | Satisfies | Depends on | Parallelizable |
| --- | --- | --- | --- |
| Reconcile historical and migration authority | 42.1, 66–69, 111–115, 247–249 | read-only GitHub/Cloudflare evidence | yes |
| Guarded cleanup and OTA documentation | 250–252, 254 | exact Labs account/bucket | yes |
| Bridge acceptance and retained-client planning | 253, 255–262 | hostname recovery, exact parity, user credential gates | no |

### Documentation maintenance

| Name | Satisfies | Depends on | Parallelizable |
| --- | --- | --- | --- |
| Active guide and architecture reconciliation | 264, 270 | current source and September evidence | yes |
| Historical plan/evidence indexes | 263, 269 | immutable receipt inventory | yes |
| ISA/planning cleanup and documentation verifier | 263–268 | explicit source authority and catalog policy | yes |

## Decisions

- 2026-07-29 12:11Z: `verified:` the live installed v0.7.7 Clio catalog reached `READY` with all 15 governed lanes, then the first explicit streamed turn failed before networking with `AI_InvalidPromptError` because the installed SDK no longer accepts system-role entries in `messages`.
- 2026-07-29 12:11Z: Root-cause-at-ingestion checkpoint — the invalid state enters in shared AI SDK request construction. v0.7.8 moves ordered system policy to `instructions` once, preserving all non-system and tool message shapes across providers.
- 2026-07-29 12:11Z: `verified:` the red-green OmniRoute regression passed, focused model/catalog coverage and typecheck passed, and `verify:all` passed 753 tests, both zero-vulnerability audits, deterministic smokes, and the renderer build with zero lint errors.
- 2026-07-29 12:29Z: `verified:` clean candidate `316c8dc1f4605ea29d174ff4b2422da345374056` passed `release:ota:prep:full` with 753 tests, both zero-vulnerability audits, deterministic smokes, an exact `0.7.8` manifest, arm64 architecture across all 16 packaged native binaries, fuses, SQLite, packaged main module closure, and an isolated renderer load from `app.asar`.
- 2026-07-29 13:08Z: `verified:` PR #131 and exact-main CI passed on macOS, Ubuntu, and Windows; merge/tag `3a2d66733d2521c0d97c25e973124d3fdecc27c0`, Release Candidate `30452752239`, and Publish OTA `30453055294` all passed with separate sign/publish approvals, signed/notarized artifacts, immutable R2 objects, and a public GitHub Release.
- 2026-07-29 13:08Z: `verified:` the independent artifact verifier used the signed GitHub Release manifest and streamed the public R2 ZIP and DMG through full SHA-512 verification on attempt one.
- 2026-07-29 13:08Z: `verified:` installed signed v0.7.7 discovered, downloaded, installed, and relaunched as signed/notarized v0.7.8 through separate consent boundaries; admin/workspace continuity remained intact, the exact 15-lane governed catalog rendered 12 healthy and 3 intentionally degraded fusion lanes, and the installed Clio returned `Clio live relay is ready.`
- 2026-07-29 10:23Z: `verified:` the production SSM carrier matrix returned `302` for the origin-facing assertion header and `200` for both client-facing Access token and cookie carriers without printing the credential; the corresponding rejected request never reached the relay journal.
- 2026-07-29 10:23Z: Root-cause-at-ingestion checkpoint — the bad state enters at the Cloudflare Access edge because `fetchOmniRouteWithAccess` used an origin header as a client carrier. The v0.7.7 correction strips every caller auth carrier and injects the safe-storage-owned JWT only as `Cf-Access-Token`.
- 2026-07-29 10:23Z: `verified:` the focused Access/OmniRoute/security suites passed 23 tests and `verify:all` passed 753 tests, both zero-vulnerability audits, typecheck, deterministic smokes, and the renderer build with zero lint errors.
- 2026-07-29 10:23Z: `verified:` clean `release:ota:prep:full` passed for v0.7.7 with all 753 tests, arm64 packaging, 16 native-binary checks, fuses, SQLite, packaged main/renderer probes, and no relay-origin process variable.
- 2026-07-29 09:31Z: `verified:` clean candidate `19f8f92` passed `release:ota:prep:full` with 753 tests, zero-vulnerability audits, deterministic smokes, arm64 architecture, 16 packaged native binaries, fuses, packaged SQLite, main/renderer `app.asar` boots, no-environment relay authority, and a `0.7.6` manifest.
- 2026-07-29 09:24Z: `refined:` signed v0.7.5 proved updater consent, download, apply, relaunch, version, login, workspace, and database continuity, but falsified runtime readiness because a Finder-launched app cannot inherit the CI packaging environment.
- 2026-07-29 09:24Z: Root-cause-at-ingestion checkpoint — the bad state enters when the packaged main process resolves relay authority from `process.env`; fixing the resolver and requiring explicit fetch dependencies removes the same hidden-environment failure from catalog, provider, and raw Access fetch paths.
- 2026-07-29 09:24Z: The v0.7.6 hotfix keeps one baked Cloudflare origin as production authority, permits only loopback development overrides, and rejects mismatched packaged overrides rather than creating a second application or account flow.
- 2026-07-29 08:24Z: `verified:` Hermes relay production is exact merged release `ac749e542bec007e63775ea32ce70efafb2ba2dc`; Cloudflare Access, public authenticated models/SSE, loopback listeners, secret-safe journal, canary, rollback, start-limit recovery, and exact merged-SHA redeploy all passed.
- 2026-07-29 08:24Z: `verified:` Plexus OmniRoute PR #128 merged as `20be3feb3b03190a5624e8abdeb3414718736100`; PR and merged-main macOS, Ubuntu, and Windows CI passed, and repository variable authority now supplies the canonical relay origin.
- 2026-07-29 08:24Z: `verified:` integration merge `d86b5a1d293a2a7935e9265323cf40bda3feccb8` retained version `0.7.5` and passed `release:ota:prep:full`, 752 tests, deterministic smokes, arm64 architecture, fuses, packaged SQLite, isolated packaged main/renderer boot, and manifest-version proof.
- 2026-07-29 08:24Z: `refined:` v0.7.5 is a feature-bearing governed OmniRoute release and an OTA upgrade canary, not the earlier version-only candidate. Signed publication and installed apply/relaunch proof remain separate protected steps.
- 2026-07-27 18:50Z: `verified:` draft PR #123 exact head `73daae7fb1128ed6c424b99f0d3c8987be9fff37` passed protected macOS, Ubuntu, and Windows CI in run `30295030981`; the PR remains open, draft, and mergeable.
- 2026-07-27 18:50Z: Post-deliverable Advisor accepted the preparation as an honest “staged, not shipped” state. Signing, notarization, signed feed generation, installed apply/relaunch, state continuity, architecture parity, tag creation, and publication remain later founder-gated release work.
- 2026-07-27 18:50Z: The runtime exposed but rejected the named `Cato` agent type. A neutral read-only auditor executed the identical Cato brief and returned PASS with no P0/P1 correctness, security, authority, or evidence-overclaim finding; the role-registry mismatch is retained rather than represented as a named Cato run.
- 2026-07-27 18:50Z: CheckCompleteness found all twelve required ISA sections, 291 unique criteria, 268 checked historical criteria, and all 52 `ISC-176` through `ISC-210` preparation criteria checked. The stale `268/292` denominator was corrected to the executable count `268/291`.
- 2026-07-27 23:59: `refined:` “OTA workflow release upgrade” is treated as preparation for a real `v0.7.4` → `v0.7.5` installed transition, not as permission to publish. The workflow already produced verified `v0.7.4`; the missing prerequisite is a signed installed baseline plus a newer unreleased candidate.
- 2026-07-27 23:59: IterativeDepth separated literal, failure, temporal, and meta views. The single-pass gap was that a green workflow cannot prove updater behavior when no signed Plexus build is installed in `/Applications`.
- 2026-07-27 23:59: FirstPrinciples classified version monotonicity, signature/notarization, exact tag ancestry, feed integrity, and two distinct signed builds as hard constraints. Rewriting proven workflows and publishing during preparation are rejected as assumptions.
- 2026-07-27 23:59: SystemsThinking identified a false-confidence loop: more workflow hardening creates more green CI, but absent installed-upgrade evidence preserves uncertainty and drives further hardening. Installing the signed baseline and freezing the transition checklist is the leverage point.
- 2026-07-27 23:59: The original detached dirty checkout remains evidence-only. All candidate changes occur in `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/.worktrees/plexus-ota-workflow-upgrade` on `codex/ota-workflow-release-upgrade`.
- 2026-07-27 23:55: Advisor accepted the pre-publication boundary but rejected calling unsigned package gates OTA proof. This preparation now labels itself partial, records exact baseline provenance, proves the PR cannot invoke the publisher, and defers signed apply/relaunch evidence until the later protected `v0.7.5` release.
- 2026-07-27 23:55: Advisor proposed a staging signing key/channel and automatic rollback test. The current production design has one protected signing authority and documents explicit retained-baseline reinstall rather than automatic reversion. Adding a second signing channel or claiming auto-rollback would expand the trust model, so both remain out of scope for this preparation.
- 2026-07-27 23:55: Forge was selected for the E4 coding pass but returned `unavailable` before editing because its required local Codex executable was absent. The primary agent retained the already-bounded five-file candidate implementation; no alternate agent silently substituted.
- 2026-07-27 23:55: Root-cause-at-ingestion checkpoint — the uncertainty enters before candidate code, where no signed previous build exists at the updater's installation boundary. Fixing workflow output cannot remove that class; installing and fingerprinting the real signed baseline does.
- 2026-07-16 11:08: IterativeDepth separated five lenses: operator recovery, signed-ingestion security, persistent diagnostics, desktop state synchronization, and protected rollout. The single-pass gap was that redelivery alone cannot repair a mismatched connection hint.
- 2026-07-16 11:08: SystemsThinking identified a fixes-that-fail loop: generic forbidden copy drives repeated setup attempts, each attempt creates more opaque state, and missing reason telemetry forces database inspection. The structural intervention is reason-bearing state plus signed unique recovery at ingestion.
- 2026-07-16 11:08: Kepner-Tregoe distinguished the two installations: personal binding exists but violates selected-only policy; organization installation is selected but has neither its signed fact nor the same ID as the OAuth hint. A single callback/admin diagnosis cannot explain both and is rejected.
- 2026-07-16 11:08: Science retained three falsifiable hypotheses: signed unique-fact fallback can safely repair stale hints; signed non-deletion lifecycle events can safely bootstrap a missing allowlisted fact; reason-bearing target state can remove UI ambiguity without changing authority. Each must fail in tests before implementation.
- 2026-07-16 11:18: `refined:` live GitHub metadata disproved the assumption that selected repository scope was sufficient. The App registration has five unnecessary permissions and the organization installation has approved none, so the repair now includes an exact six-permission contract, signed grant snapshot, `permissions_incomplete` state, and explicit installation approval proof.
- 2026-07-16 11:24: `verified:` TeamForge PR #94 passed its required `worker` check, merged as `9e246546`, and deployed as Cloudflare version `c077ffd7` after additive migration `0015`; Plexus PR #109 passed macOS, Ubuntu, and Windows protection and merged as `a227c831`.
- 2026-07-16 11:25: `refined:` the external registration and installation changes remain separate authority steps. Source, schema, deployment, and desktop delivery may proceed, but owner-selected repository scope and GitHub sudo-mode approval cannot be fabricated or replaced with D1 writes.
- 2026-07-16 10:55: `refined:` this iteration treats the screenshot as three coupled defects—over-broad personal scope, missing/mismatched organization trust correlation, and stale/generic desktop presentation—while preserving the selected-only and pinned-identity security model.
- 2026-07-16 10:55: implementation is isolated on `codex/github-control-plane-recovery` branches from Plexus `8e2759d` and TeamForge `cce99b7`; the dirty root checkouts are evidence-only and must remain untouched.
- 2026-07-16 10:55: the permanent recovery path will prefer GitHub-signed facts and unique exact correlation over direct database repair or destructive reinstall; ambiguity remains an explicit blocked state.

- 2026-07-15 18:40: refined: the v0.5.6 OTA is one causally ordered lineage: merge reviewed PR #107, layer My Studio on its component boundaries, pass clean package gates, merge protected CI, tag the exact merge, then verify signed publication. Parallel write agents were not used because these steps share mutable Git and release authority; independent compile and test commands run concurrently where safe.
- 2026-07-15 18:44: FirstPrinciples retained Gather's conceptual ownership model—each person has a bench and the lounge communicates ambient co-presence—while removing movement, circles, pixel-world simulation, and room-directory dominance. The primary object is the user's selected project bench; team and lounge state remain peripheral.
- 2026-07-15 18:47: Advisor required compact and My Studio to share one integration tag, exact main ancestry, explicit 0.5.6 metadata, and public manifest/asset verification. PR #107 merged at `1963fbc`, whose second parent is reviewed head `3814c67`, before this branch began.
- 2026-07-15 18:58: Root-cause-at-ingestion checkpoint — congestion entered where room navigation, proof, people, lounge, and controls competed as peer panels. My Studio fixes the composition boundary: one workbench leads, six benches summarize presence, lounge stays secondary, and diagnostics disclose only when degraded.
- 2026-07-15 19:05: Parallel read-only release review found no P0/P1 blocker, proved `3814c67` ancestry, and rechecked explicit project/lounging/media/leave plus shared-audio continuity. Its only P2 was an evidence filename/curation mismatch; the README now states the harness names and curated release names explicitly.
- 2026-07-15 19:12: The first clean package run built v0.5.6 artifacts and verified 16 arm64 binaries plus SQLite, then correctly failed the renderer smoke because the persistent reviewed preview already owned production port `31339`. The fix is test-path isolation at ingestion: a named packaged-renderer smoke uses port `0`; normal Plexus keeps the fixed port and the preview is not stopped.

- 2026-07-14 17:18: refined: “minified version while full-screen casting” is provisionally interpreted as an always-on-top companion using the existing main window; the E5 Interview question remains open for user correction until BUILD.
- 2026-07-14 17:19: FirstPrinciples eliminated CSS-only shrinking and a second BrowserWindow. One reversible native window plus a compact renderer shell preserves live Co-working state and minimizes trust-boundary growth.
- 2026-07-14 17:20: The pre-build Advisor command exited successfully but returned no review text. No approval is inferred; four independent Temperance audit tasks must return before implementation commitment.
- 2026-07-14 17:20: Root-cause-at-ingestion checkpoint — the density failure enters where participant, operator, and audit roles are composed inside `CoWorkingPanel`; fix display-down by extracting role-specific presentation boundaries before adding compact output.
- 2026-07-14 17:31: The final architecture uses one `BrowserWindow`, one mounted `CoWorkingPanel`, and one serialized main-process controller. Compact mode changes geometry and presentation while retaining the existing call, media, timer, and teardown authority.
- 2026-07-14 17:34: Dense transport diagnostics, stage evidence, recording consent, and lounge detail moved behind explicit disclosure controls. The default page now leads with people, media, and project actions without deleting operational proof.
- 2026-07-14 17:38: Independent Cato review found one priority-one audio continuity risk because branch replacement could remount remote audio. Both branches now render the same audio layer at a stable fragment index; the final review reports no priority-zero or priority-one blocker.
- 2026-07-14 17:42: Post-deliverable Advisor reports no blocker. Wayland geometry remains a documented platform limitation: Electron may reject programmatic positioning, so the native controller returns actual applied bounds instead of claiming exact placement.

- 2026-07-13: Interview synthesis — “final 5.5 update” means a protected signed OTA release after full repository and issue reconciliation, not a source-only version bump. Oversized live infrastructure work remains explicitly deferred rather than silently expanding the release.
- 2026-07-13: Inventory found PR #40 semantically superseded by a stronger merged layout fix; all historical release branches are merged ancestors or patch-equivalent. Three stashes contain two unique roadmap plans and conflicting old code, so all are preserved and none are applied wholesale.
- 2026-07-13: The fifteen issues resolve to eight completed parent/feature epics, three implementation/documentation closeouts, and four honest live/deferred boundaries. v0.5.5 implements only the bounded assistant tool loop, bounded skill-index read, and release/issue parity work.
- 2026-07-13: Advisor accepted the scope conditionally with hard bounds: four tool rounds, registered read-only execution only, confirmation actions as suggestions, redacted errors, one-megabyte skill index, eight deterministic hints, and no hidden external authority.

- 2026-07-10 13:22Z: Seeded the first project ISA from `README.md`, `package.json`, Vite/TypeScript config, release workflows, release evidence, the test inventory, and the latest 30 commits because `origin/main` had no `ISA.md`.
- 2026-07-10 13:22Z: Selected `v0.5.3` as the preparation target because `v0.5.2` already exists locally, remotely, in GitHub Releases, and in the public R2 manifest; reusing `0.5.2` would violate updater monotonicity and the repo's duplicate-tag gate.
- 2026-07-10 13:22Z: SystemsThinking/FindLeverage result — the highest feasible leverage is release-rule and information-flow hardening: make one executable gate prove version, trust boundary, signed-feed contract, and honest evidence. The bundled tactical intervention is focused regression coverage for each reachable gap.
- 2026-07-10 13:22Z: RootCauseAnalysis/FaultTree top event is "an employee receives an unsafe, undiscoverable, or un-installable update." Single-event cut sets to eliminate during prep are an unsigned build accepted by the updater, a missing/incorrect manifest, exposed privileged credentials, a duplicate/non-monotonic version, or an unvalidated renderer-to-main privileged call. External signing failure, R2 publication failure, and installed-upgrade failure remain release-step branches that local prep cannot truthfully close.
- 2026-07-10 13:22Z: Two read-only agents independently audit the Electron/updater surface and the backend/Cloudflare/security surface; the primary agent owns synthesis and all writes.
- 2026-07-10 13:58Z: Advisor recommended deferring the Electron 33→43 and builder 25→26 migration because a ten-major jump is a regression event. Fresh lockfile evidence showed that Electron itself carried eighteen advisories while being embedded in the shipped binary, so the migration is being run as a reversible experiment: retain it only if the full audit, all deterministic gates, and unsigned packaged-app verification pass. Re-call Advisor after those empirical results rather than silently overriding the recommendation.
- 2026-07-10 13:58Z: `npm version --no-git-tag-version` moved package and lock metadata to `0.5.3`; Electron `43.1.0`, electron-builder `26.15.3`, `@electron/fuses` `2.1.3`, and transitive `form-data` `4.0.6` reduce the complete audit from eleven high findings to zero.
- 2026-07-10 14:01Z: Independent review proved a tag workflow cannot enforce its own ancestry guard because GitHub loads workflow code from the tag. The release lane is therefore split: `Release Candidate` is unsigned/read-only/secret-free, while `Publish OTA` is loaded from the default branch through `workflow_run` and independently validates the candidate SHA before entering production authority.
- 2026-07-10 14:03Z: Configured live GitHub controls: `ota-production` requires `Sheshiyer` approval and permits deployments from `main` only; `Protect OTA v* tags` restricts matching tag creation, update, and deletion to `Sheshiyer`; `Protect main integration` requires a PR plus green macOS/Ubuntu/Windows CI and blocks deletion/force-push. Environment secret migration cannot be automated because GitHub never reveals existing repository-secret values, so the runbook blocks tagging until the nine values are re-entered and the repository copies removed.
- 2026-07-10 14:05Z: OTA immutability now means conditional create-only R2 writes with stored SHA-256 metadata, streamed public SHA-512 verification for DMG/ZIP bodies, same-origin relative artifact names, verified GitHub draft assets, and manifest-last publication.
- 2026-07-10 14:07Z: Reporting readiness is bridge/Hermes-only. Fabric/Paperclip stays as optional diagnostics, persisted local standup evidence is the compliance authority, and proactive nudges generate that evidence before any founder-delivery action.
- 2026-07-10 14:20Z: Advisor re-call accepted the Electron 43 migration after zero-vulnerability audits, all deterministic gates, and a real arm64 package proof. It approved merging the PR but rejected any claim that production release readiness is complete while the nine opaque Apple/R2 values remain repository-scoped. The ISA therefore closes the scoped engineering pass with `release_readiness: blocked-pre-tag`.
- 2026-07-10 14:20Z: Intel/x64 and universal packaging remain intentionally out of scope. Plexus `0.5.2` and this `0.5.3` candidate use the macOS arm64 OTA lane only.
- 2026-07-10 14:25Z: The first protected PR run exposed that macOS updater tests inherited each runner's native `process.platform`: Ubuntu entered the production non-Darwin disablement path, while macOS passed the tests and Windows had not reached them before matrix fail-fast cancellation. Production behavior was correct; the test fixture now selects Darwin explicitly while retaining a dedicated non-Darwin disablement case.
- 2026-07-10 14:31Z: The second protected PR run passed macOS and Ubuntu and proved the updater fixture on Windows, then exposed one CRLF-sensitive literal in the workflow contract test. The shared source reader now normalizes checkout line endings before semantic assertions.
- 2026-07-10 19:58Z: GitHub secret lookup semantics allow a repository secret to satisfy an environment job when the environment does not define the same name. The publisher now references nine unique `OTA_*` environment names, so the legacy repository-scoped names cannot silently bypass production custody.
- 2026-07-10 20:05Z: Signed release proof now fails closed on required notarization and independently verifies the Developer ID TeamIdentifier, strict code signature, Gatekeeper assessment, stapled ticket, and the app mounted from the DMG before upload. Broad DYLD-environment and disabled-library-validation entitlements were removed.
- 2026-07-10 20:13Z: Hermes remains the month-close scheduler. Plexus now polls only a connected member bridge for the typed `thoughtseed.member_review_activation.v1` directive, accepts only closed UTC months, reuses the stable review record, includes persisted standup compliance, and acknowledges only after bridge delivery or one durable retry handoff.
- 2026-07-10 20:28Z: PR #93 CI passed macOS and Ubuntu but failed Windows because one architecture-test assertion assumed the lipo shim preserved a spaced helper path as one argument. The verifier itself correctly rejected the x86 addon; the assertion now checks the helper token independently of shell path formatting so the same semantic proof is portable.
- 2026-07-10 20:47Z: A degraded Windows runner amplified file-backed SQLite tests by roughly six times without deadlocking. CI now exposes each suite as an independently bounded step, static workflow assertions normalize CRLF, and the release chain uses current immutable checkout `v7.0.0`, setup-node `v6.4.0`, upload-artifact `v7.0.1`, and download-artifact `v8.0.1` commits instead of deprecated Node 20 action majors.
- 2026-07-11 07:00: refined: The screenshot's bad state enters at the signed OTA manifest: public `latest-mac.yml` and GitHub Releases still advertise `0.5.2`. The runtime fix therefore adds trusted main-process discovery before global renderer presentation; it does not teach the renderer or Hermes/Insight to decide whether an update exists.
- 2026-07-11 07:00: Automatic discovery is process-global, idempotent, delayed once at startup, repeated every six hours, single-flight across manual and scheduled requests, and paused while an actionable update is available, downloading, or downloaded. Download and restart remain separate explicit user decisions.
- 2026-07-11 07:00: E4 completeness is retained with all twelve ISA sections, 88 stable atomic criteria, and three anti-criteria. The 128-criterion E4 floor is intentionally not inflated because the added updater feature has eleven independently probeable gaps; two read-only specialist audits plus one test-contract audit satisfy the delegation floor.
- 2026-07-11 07:25: refined: Cato found that the first global prompt draft was authenticated-tab-global but absent from the fixed login surface. The final prompt is created once, passed into Login as a stacked notice, rendered in the authenticated app frame, and suppressed during dirty preferences, sign-out, onboarding, loading, idle, and shortcuts. ISC-34.2 now covers both authenticated and logged-out surfaces; ISC-34.7 remains the signed live screenshot boundary.
- 2026-07-11 07:25: The installed Plexus app legitimately owns production loopback port `31339`; the API validation harness now requests port `0` and consumes the returned ephemeral port, preserving the production default while allowing release gates to run beside the installed app.
- 2026-07-11 07:25: The E4 ISA now contains 89 stable atomic criteria, including the explicit deferred signed-prompt proof `ISC-34.7`; no filler criteria were added to chase the soft 128-item floor.
- 2026-07-11 07:28: The post-deliverable Advisor returned a conditional pass. Its logged-out regression concern is covered by the explicit Login notice source contract and 14 renderer tests; mismatched TeamIdentifier, corrupted manifest/hash, non-monotonic candidate, rollback metadata, and no-silent-privileged-action paths already have executable release/updater tests. `release:ota:prep` performs the automated live `0.5.2` monotonicity probe. A targeted changed-file credential-pattern scan found no key/token signature, while protected CI and squash history remain mandatory before merge. Live signed prompting remains deferred rather than overstated.
- 2026-07-11 07:32: Full package verification initially used stale root dependencies, then correctly re-ran from a worktree-local `npm ci` at Electron `43.1.0`, electron-builder `26.15.3`, and `@electron/fuses` `2.1.3`. Its packaged SQLite probe exposed that a running installed Plexus process owns the default single-instance profile. The verifier now supplies a temporary `--user-data-dir`, isolating smoke-process lock state without changing production's single-instance or database behavior.

- 2026-09-05: refined: Continue the existing CF-6/CF-7 migration rather than recreate CF-0 through CF-5. The app API uses Labs Access, while its active OTA r2.dev feed still belongs to 9d9d; the Labs manifest is 0.7.8 versus source 0.7.12. Publication readiness remains blocked on an accepted bridge path.
- 2026-09-05: refined: Recount found 303/327 checked, not frontmatter 299/327. Ten historical criteria were reconciled from exact CI/run/tag/asset receipts, giving 313/327 before new migration criteria. Preserve ISC-41.1 and failed ISC-239 as historical open items pending explicit disposition.
- 2026-09-05: User handles signing/secret/App/D1 blockers. This pass authorizes preparation, safe local fixes, planning and read-only probes; no live credential, publishing, DNS, cross-account-copy or retirement action was taken.
- 2026-09-05: Cleanup was reading environment-secret names without selecting the environment. Fix that credential lookup boundary, pin Labs, default to plan-only and protect every inventoried channel before deletion; leave the publisher transition unchanged until both old feed paths are covered.
- 2026-09-05: Advisor OAuth could not refresh and noesis-build returned upstream tool-schema HTTP400 / UNRESOLVED. Bounded in-session implementation and review are the fallback; no provider resolution or deployed proof is claimed.

- 2026-09-05: refined: User requested a whole-repository deep documentation pass and fan-out. Current framing now precedes collapsible historical Problem/Goal/Constraints; old release targets and checkmarks retain stable IDs and dated provenance.
- 2026-09-05: Three bounded documentation workers own disjoint guide, runtime, and historical surfaces. Parent owns ISA/planning/catalog/verifier. No runtime behavior, production state or credential mutation is part of this pass.

## Changelog

- 2026-07-27 | conjectured: green workflow and unsigned packaging were sufficient OTA upgrade preparation.
  refuted by: Advisor and live installation evidence showed that unsigned packages cannot exercise production signature acceptance without a real signed baseline.
  learned: preparation is one signed installed baseline, one monotonic unreleased candidate, explicit partial-proof language, and a frozen transition receipt.
  criterion now: ISC-183 through ISC-210 bind baseline provenance, partial proof, protected triggers, state continuity, and explicit rollback.
- 2026-07-15 | conjectured: the full workspace could be made calmer by restyling the existing three-panel hierarchy.
  refuted by: the approved component and page references required project ownership, bounded presence, and ambient lounge to have distinct information priority.
  learned: decluttering requires changing component composition, not just spacing; compact and standard views can still share one session controller.
  criterion now: ISC-101 through ISC-119 bind My Studio, compact ancestry, anti-simulation constraints, package isolation, and the protected OTA publication proof.
- 2026-07-15 | conjectured: an isolated user-data directory was sufficient for the packaged renderer smoke to coexist with a running Plexus preview.
  refuted by: the first clean package gate loaded the renderer but startup exited on `EADDRINUSE` for the fixed local API port, which surfaced only as a DevTools `ErrorEvent`.
  learned: release-process isolation needs both profile isolation and an ephemeral loopback port while preserving the normal production port.
  criterion now: ISC-118 and ISC-119 require a named smoke-only override and a real concurrent-port packaged load.

- 2026-07-10 — Conjectured: the existing Electron 33 and tag-owned publisher could be incrementally patched. Refuted by: the full lock audit exposed eighteen shipped Electron advisories and independent review showed tag-controlled workflow code could reach repository secrets. Learned: the release needs a current Electron runtime plus a default-branch trusted publisher. Criterion now: ISC-10.1, ISC-30.1, ISC-37, and ISC-37.1 require those executable boundaries.
- 2026-07-10 — Conjectured: manifest size checks and an R2 upload exit code were enough publication evidence. Refuted by: same-length corruption, cross-origin manifest references, partial drafts, and post-manifest reruns all remained possible. Learned: immutable writes, byte hashing, relative references, manifest-last order, draft reconciliation, and exact-current recovery must operate as one protocol. Criterion now: ISC-39, ISC-40, and ISC-40.1 encode that protocol.
- 2026-07-10 — Conjectured: reporting readiness could still include historical helper status and Worker standup synthesis. Refuted by: the Hermes authority contract and persisted-evidence requirement. Learned: Hermes/bridge owns founder delivery, Fabric/Paperclip is optional, and local persisted standups are the compliance source. Criterion now: ISC-44 through ISC-48 enforce the current authority model.
- 2026-07-10 — Conjectured: updater tests that passed on the macOS development host were platform-independent. Refuted by: protected CI run `29099595999` failed the Darwin-only cases on Ubuntu because those tests inherited the native runner platform; macOS passed them and Windows was canceled before testing. Learned: each updater test must establish its intended platform explicitly. Criterion now: ISC-18 requires the fixture to pass in all required CI environments.
- 2026-07-10 — Conjectured: reading a YAML workflow as UTF-8 produced identical strings on every checkout. Refuted by: Windows CI run `29099845036` converted tracked line endings to CRLF and failed one multiline literal after the updater suite passed. Learned: static workflow tests must normalize line endings before asserting content. Criterion now: ISC-18 covers semantic workflow contracts independently of platform checkout policy.
- 2026-07-10 — Conjectured: the long Windows assistant step indicated a Hermes polling or native-architecture deadlock. Refuted by: cancelled run `29121824890` completed those new tests while install, lint, and SQLite fixtures were all roughly six times slower than their baseline, and the next hosted runner restored normal install and lint timing. Learned: keep runtime behavior unchanged, expose suites separately, and bound each CI test step. Criterion now: ISC-18 remains observable and time-bounded on every matrix platform.
- 2026-07-11 | conjectured: automatic update prompting was only a timer plus authenticated-renderer presentation gap.
  refuted by: Cato exposed the logged-out surface gap, and full packaging exposed the installed app's single-instance lock intercepting the SQLite smoke.
  learned: reliable OTA readiness requires published feed truth, process-global signed discovery, auth-independent consent presentation, separate download/restart authority, and isolated packaged probes.
  criterion now: ISC-31.1 through ISC-36.2 cover deterministic discovery/consent, while ISC-34.7 and `OTA-AUTO-PROMPT-LIVE-1` retain the signed live proof boundary.
- 2026-07-14 | conjectured: a compact casting surface could be implemented as a smaller renderer branch without affecting the active call.
  refuted by: independent review showed that replacing the remote-audio subtree would remount the sink during a live mode transition.
  learned: compact and standard presentations must share the same mounted session authority and a stable remote-audio layer while native geometry changes independently.
  criterion now: ISC-74 through ISC-77 and ISC-84 through ISC-100 cover extraction, continuity, explicit actions, accessibility, native restoration, and anti-side-effects.
- 2026-07-14 | conjectured: the primary native-window snapshot test was platform-neutral because Windows behavior had its own dedicated case.
  refuted by: protected Windows CI inherited `process.platform === 'win32'`, correctly skipped all-workspace mutation, and exposed a Darwin-specific expectation in the supposedly general test.
  learned: every platform-sensitive window-mode fixture must name its intended platform instead of inheriting the runner operating system.
  criterion now: ISC-94 requires deterministic platform-explicit transition coverage alongside the dedicated Windows no-op case.

- 2026-09-05 | conjectured: the remaining work was 28 infrastructure-blocked ISCs and a mostly completed account move.
  refuted by: executable count was 24 open; ten had historical proof; Labs dev-url was disabled, Labs manifest was 0.7.8, and the active 0.7.12 feed belonged to 9d9d.
  learned: credential custody, API relocation, OTA object parity and installed-client feed migration have independent acceptance boundaries.
  criterion now: preserve stable historical IDs and add ISC-247 through ISC-262 for the scoped migration continuation.

## Verification

- GitHub recovery local proof: Worker typecheck passed, the focused GitHub suite passed 64 tests, and the full Worker suite passed 170 tests. Plexus focused GitHub coverage passed 57 tests, while `npm run verify:all` passed 573 tests plus lint, typecheck, security audits, smokes, and the renderer build.
- GitHub recovery protected integration: TeamForge PR #94 required and passed the `worker` check; its merge-triggered Worker CI run `29474799750` passed. Plexus PR #109 passed protected macOS, Ubuntu, and Windows jobs in run `29474753078` and merged without bypass.
- GitHub recovery production rollout: D1 preflight found only `0015_github_webhook_diagnostics.sql` pending with six delivery rows. Migration application preserved all six rows, left `PRAGMA foreign_key_check` empty, and deployed exact merge `9e246546` as Worker version `c077ffd7-96cc-49b9-b2b8-dd17e3c64335`; `/healthz` returned 200 and the unauthenticated connection route remained 401.
- v0.5.7 release preparation: package and lock metadata agree at `0.5.7`, the remote tag is absent, the public feed remains `0.5.6`, and `npm run release:ota:prep` passed 573 tests, types, lint, both security audits, fuse/CSP/evidence checks, deterministic smokes, and renderer build without publishing.
- v0.5.6 integration gate: a worktree-local `npm ci` installed 637 packages with zero vulnerabilities; `npm run verify:all` passed lint, typecheck, placeholder scanning, both zero-vulnerability security audits, fuse/CSP/release evidence checks, 566 tests, production smokes, and the renderer build.
- v0.5.6 visual proof: the updated capture harness passed all standard, fullscreen, responsive, evidence, closeout, and 384×264 companion marker/overflow/overlap checks. `docs/evidence/2026-07-15-coworking-my-studio-ota/standard-1536.png` proves My Studio; `compact-384.png` proves the PR #107 companion remains in the same candidate.
- v0.5.6 ancestry: protected PR #107 head `3814c67fb7f0e911f75a4701f27a31a5d4eafebb` is parent two of `main` merge `1963fbc22537b6c081fd9eb4a1980ad7dacc150e`, and this My Studio branch starts at that merge.
- v0.5.6 independent audit: a read-only diff review found no P0/P1 security, correctness, performance, accessibility, component-boundary, or OTA blocker; four focused suites passed 15 tests and the P2 evidence curation note was corrected before commit.
- v0.5.6 first package attempt: builder emitted arm64 v0.5.6 DMG/ZIP and blockmaps, the architecture verifier passed all 16 native binaries, and packaged SQLite passed. The final renderer smoke failed because the persistent Plexus preview owned `127.0.0.1:31339`; the release remained blocked and no push or tag occurred.
- v0.5.6 clean package proof: after smoke-path isolation, `npm run release:ota:prep:full` passed from clean commit `1285a8f`; `release/latest-mac.yml` reports `0.5.6`, all 16 packaged binaries are arm64, packaged SQLite initialized, the renderer loaded from `app.asar`, and the packaged fuse policy passed while the persistent preview continued owning production port `31339`.

- Co-working compact iteration: `npm run verify:all` passed lint, typecheck, placeholder checks, both zero-vulnerability audits, fuse/CSP/release-evidence gates, 103 assistant files with 414 tests, 27 Co-working files with 88 tests, 3 identity files with 11 tests, 8 renderer files with 53 tests, production smokes, and the renderer build — 566 tests total.
- Native-window contract: focused tests passed standard/compact parsing, entry, idempotence, saved-bound restoration, display re-clamping, rollback, Windows workspace behavior, negative display origins, and asynchronous macOS fullscreen exit ordering. The primary snapshot fixture now names Darwin explicitly after protected Windows CI proved runner inheritance was unsafe; IPC tests reject modes outside the exact shared enum.
- Presentation contract: component-boundary and companion tests passed extracted-authority restrictions, one stable remote-audio layer, no implicit join/media/capture/timer/recording actions, accessible controls, honest timer/provider context, errors, and whole-display capture visibility warning.
- Visual proof: `/private/tmp/plexus-coworking-compact-proof-final/live-boundary-panels-1536.png` shows the cleaned normal-width stage with diagnostics and evidence collapsed; `/private/tmp/plexus-coworking-compact-proof-final/companion-384.png` shows the 384-pixel companion with room context, people, timer, media, leave, and reachable restore.
- Independent review: Cato's final audit reported no P0/P1 blocker after the stable remote-audio correction. The post-deliverable Advisor reported no blocker. Remaining Wayland geometry behavior is documented as platform best-effort rather than represented as exact-placement proof.
- Repository boundary: the isolated branch starts at current `origin/main` `03303ebd3cbabebe75ddf8cb6f443386dfaa5e3b`; package and lock metadata remain `0.5.5`; no release tag or OTA artifact was created. The original checkout still contains only its three owner-modified architecture documents with current SHA-256 values `a44eb4dcd34d84c9a3e6b11fbb8366b9df260c708b55452316c80f6fe661fec5`, `7bc5ee022f3928398573b06057c9fab1da9df32a0b386c0ecbfe766ed9ec85e0`, and `3ee4ea2348a043bc58bf4815e384a5d433f6225f67a3d9be6bace50c8660b6b7`.
- Scoped closeout: all 30 Co-working cleanup and compact-casting criteria passed. The shared project ISA is 131/140 overall because protected PR CI, merge, signed OTA publication, and historical live-release prerequisites remain deliberately outside this pre-release cleanup.

- v0.5.5 pre-merge gates: a worktree-local `npm ci` installed 637 packages with zero vulnerabilities; focused tool-loop/skill-index tests passed; `npm run verify:all` passed lint, typecheck, placeholder checks, both zero-vulnerability audits, fuse/CSP/evidence gates, 131 test files with 470 tests, deterministic production smokes, and the renderer build. `npm run release:ota:prep` confirmed package/feed monotonicity (`0.5.5` > public `0.5.4`) and all preparation gates.
- v0.5.5 package gate: `npm run release:ota:prep:full` built an unsigned arm64 DMG/ZIP, verified all 16 packaged native binaries, opened packaged SQLite, verified Electron fuses, and loaded `dist/renderer/index.html` from `app.asar`; `release/latest-mac.yml` reports `0.5.5`. This is deterministic packaging proof, not signed OTA publication.

- Repository base: `git merge-base HEAD origin/main` and `origin/main` both resolved to `e08fd4ea4c8d935b8eb54f9e7ae40c11c0797e5c` before this continuation; package and lock versions both report `0.5.3`; local and remote `v0.5.3` refs are absent.
- Complete gates: `npm run verify:all` passed lint, typecheck, placeholder scan, both zero-vulnerability security audits, fuse/CSP/evidence/closeout gates, 128 test files with 441 tests, production smoke, and renderer build.
- Package proof: `npm run release:dry-run` produced `latest-mac.yml` for `0.5.3`, a `156821683`-byte DMG, and a `154065948`-byte ZIP. Recursive `lipo` checks passed for all 16 packaged Mach-O/native binaries, including `node_sqlite3.node`; the fused packaged app launched, initialized a non-empty temporary SQLite database, and exited 0. The local app is unsigned and unnotarized, so this is not production-release evidence.
- Workflow syntax: actionlint `v1.7.7`, Ruby YAML parsing, and 23 focused workflow/proof tests passed the pinned CI, exact-main manual candidate, and Publish OTA workflows.
- Live baseline: public `latest-mac.yml` responds `200` with `cache-control: public, max-age=60`, and all four signed `v0.5.2` versioned objects also return the legacy 60-second policy. The runbook now blocks tagging until an authorized metadata-only repair makes the manifest revalidating and versioned objects immutable without changing their bytes; GitHub release `v0.5.2` retains its manifest, arm64 DMG/ZIP, and both blockmaps.
- GitHub controls: environment `ota-production` requires founder approval and a `main` deployment policy; active tag and main rulesets protect `v*` creation/mutation and require PR plus three-platform CI for `main`.
- Root preservation: the root checkout still contains only its three pre-existing dirty architecture documents. Their current SHA-256 values, refreshed after concurrent owner edits and without writing them from this worktree, are `9c5677374ff0f341fd897bca8e9f40409e8640bd2321dbf3c28a9978f9a28cca`, `f649b041b8af7e6d701f77eafa43706372c36d8b2330a32227ca6a0d7bdd52cc`, and `e5209195d71c745c67d80443165b159ded3815e8b22266afe0ed1e052756064a`.
- Blocking external prerequisites: an authorized R2 operator must repair and verify the legacy `v0.5.2` cache metadata, and `ota-production` has zero secrets while the nine legacy Apple/R2 names remain repository-scoped. GitHub does not expose existing values, so an authorized operator must enter them under the new unique `OTA_*` environment names, verify all nine environment entries, then delete the legacy repository copies before any `v0.5.3` tag.
- ISC-31.1: Vitest fake-timer probe — `automatic OTA discovery > schedules one startup check and one bounded periodic check per process` passed and `initAutoUpdates` is process-global/idempotent.
- ISC-31.2: Vitest timer/lifecycle probe — the startup/periodic test observed one bounded interval and `clears automatic discovery timers during application shutdown` passed; `main.ts` invokes `stopAutomaticUpdateChecks()` on `before-quit`.
- ISC-31.3: Vitest concurrency/state probe — `keeps automatic and manual checks single-flight` and `does not overwrite an actionable update` passed with one underlying feed request.
- ISC-34.2: React SSR plus source-wiring probe — `update-prompt.test.tsx` passed global `UpdatePrompt` mounting before Settings-only content and rendered the version-specific available prompt.
- ISC-34.3: Pure prompt-model probe — dismissal key `available:0.5.4` hid only that phase/version while `available:0.5.5` and `downloaded:0.5.4` remained visible.
- ISC-34.4: React SSR plus IPC source probe — available copy rendered `Download update`, downloading markup exposed a clamped `role="progressbar"`, and App calls only the typed `updatesDownload()` action.
- ISC-34.5: Vitest consent/deduplication probe — downloaded markup rendered a separate `Install & restart` choice while two main-process install requests ran cleanup once and invoked `quitAndInstall` once.
- ISC-34.6: Parameterized renderer probe — `disabled`, `idle`, `checking`, `not-available`, and `error` each produced an empty prompt model and empty markup.
- ISC-36.2: Vitest recovery probe — a rejected automatic check published `error`, invoked no download/install action, and retried only at the next configured interval.
- ISC-50.2: Source/security probe — `autoDownload = false`, `autoInstallOnAppQuit = false`, a pinned trusted main-process feed, typed IPC, and the no-privileged-action test preserve deterministic updater authority outside Hermes/Insight.
- ISC-50.3: Live release-boundary probe — public `latest-mac.yml` reports `0.5.2`, GitHub latest is `v0.5.2`, remote `v0.5.3` tag count is `0`, and `OTA-AUTO-PROMPT-LIVE-1` records the required manual bridge and later signed prompt proof.
- ISC-34.2: Cato re-audit plus renderer probe — the required logged-out gap was closed by passing the same prompt into Login's fixed surface; the non-modal labelled region and authenticated placement passed 14 focused renderer tests, and Cato returned `PASS` with no remaining required issue.
- Current automatic-updater gate: executable suite — `npm run verify:all` passed 129 files and 461 tests, lint, typecheck, placeholder scan, two zero-vulnerability audits, fuse/CSP/release evidence, production smokes, and renderer build on the stabilized diff.
- Release preparation: executable and live boundary — `npm run release:ota:prep` passed for `0.5.3`; the public manifest and latest GitHub Release remain `0.5.2`, the remote `v0.5.3` tag is absent, and `ota-production` still has zero secrets, so no publish claim or tag is authorized.
- Full package preparation: executable artifact probe — clean commit `4afd591` passed `release:ota:prep:full` with Electron `43.1.0`, electron-builder `26.15.3`, generated manifest `0.5.3`, 16 arm64 packaged native binaries, packaged fuse policy, and isolated packaged SQLite bootstrap; signing, notarization, and publication were intentionally disabled.
- Protected integration: PR #94 merged the exact reviewed head `63fa9696a21f17db9bba8fc5bc5cfd25e2d07861` into `main` as squash commit `e6cdd39d488e64db8f967f9c0e18be54da1c8664`; PR CI run `29144774560` and merge-triggered `main` CI run `29144915203` each passed macOS, Ubuntu, and Windows.
- Cleanup boundary: the automatic-update feature worktree and local/remote feature branch were removed after merge proof; obsolete merged or superseded branch refs were pruned, local `main` was aligned to `origin/main`, open PR #40 and the separate unmerged `385fcc6` local commit were preserved, and the root checkout's three unrelated architecture-document edits remain untouched.
- Scoped closeout: this engineering iteration is complete at 85/89 criteria. ISC-41.1, ISC-42.1, ISC-43.3, and ISC-34.7 remain explicit protected-release prerequisites rather than false local passes; `release_readiness: blocked-pre-tag` therefore remains authoritative until the signed `v0.5.3` publication and installed-upgrade proof occur.
- ISC-176: git ancestry probe — `HEAD`, `origin/main`, and merge-base each resolved `f133581aa1b62cc6fb35dde6c6e95876568b4077`.
- ISC-177: worktree creation probe — `git worktree add` completed at `f133581` and the immediately following `git status --short` was empty.
- ISC-178: public manifest probe — `public_feed_version=0.7.4`.
- ISC-179: GitHub release probe — `latest_release=v0.7.4 draft=false prerelease=false`.
- ISC-180: JSON probe — `package=0.7.5`.
- ISC-181: JSON probe — `lock=0.7.5 root=0.7.5`.
- ISC-182: git refs probe — `local_tag=absent` and `remote_tag=absent`.
- ISC-183: installed-path probe — `/Applications/Plexus.app` exists after digest-verified DMG installation.
- ISC-184: bundle metadata probe — `installed_version=0.7.4`.
- ISC-185: codesign probe — `Authority=Developer ID Application: Thoughtseed Private Limited (BS6SZR4929)` and strict deep verification exited zero.
- ISC-185.1: codesign probe — `TeamIdentifier=BS6SZR4929`.
- ISC-186: Gatekeeper probe — `/Applications/Plexus.app: accepted`, source `Notarized Developer ID`.
- ISC-187: public verifier — `public OTA release verified on attempt 1`; manifest SHA-256 `0048ac89f9f5291d2b61699d47fa43922fd59273751bb5d68039f80e28fb6279`.
- ISC-187.1: public verifier — both declared artifacts returned their exact manifest byte lengths.
- ISC-187.2: public verifier — streamed DMG and ZIP bodies matched their declared SHA-512 values.
- ISC-187.3: public verifier — every versioned artifact and blockmap passed the immutable one-year cache assertion.
- ISC-187.4: public verifier — `latest-mac.yml` passed the short revalidation cache assertion.
- ISC-188: file-content probe — packet records `From-version: v0.7.4` and `To-version: v0.7.5`.
- ISC-189: file-content probe — packet requires `Check for updates`.
- ISC-189.1: file-content probe — packet requires offered version `0.7.5`.
- ISC-189.2: file-content probe — packet requires explicit `Download update`.
- ISC-189.3: file-content probe — packet requires explicit `Install & restart`.
- ISC-189.4: file-content probe — packet requires version verification after relaunch.
- ISC-189.5: file-content probe — packet requires pre/post local-state fingerprints and readable work data.
- ISC-189.6: file-content probe — packet contains `## Rollback decision`.
- ISC-190: executable monotonicity probe — `[release-ref] candidate 0.7.5 is newer than public feed 0.7.4`.
- ISC-195: git diff probe — `committed_workflow_diff=none` and `worktree_workflow_diff=none`.
- ISC-196: GitHub environment probe — required reviewer list is `["Sheshiyer"]`.
- ISC-196.1: GitHub environment probe — deployment branch policy remains present with custom policies enabled.
- ISC-197: changed-content credential-pattern probe — `credential_pattern_scan=clean`.
- ISC-198: GitHub release probe — signed stable release `v0.7.1` remains non-draft and non-prerelease.
- ISC-199: git refs anti-probe — no local or remote `v0.7.5` tag exists.
- ISC-200: GitHub release anti-probe — `github_release_v0.7.5=absent`.
- ISC-201: public feed anti-probe — manifest SHA-256 remained `0048ac89f9f5291d2b61699d47fa43922fd59273751bb5d68039f80e28fb6279`.
- ISC-203: file-content probe — packet status is `prepared release candidate; unsigned local evidence only`.
- ISC-204: workflow trigger probe — neither release workflow declares a pull-request trigger.
- ISC-205: workflow trigger probe — Release Candidate requires a `v*` tag push and publisher requires source event `push`.
- ISC-206: file-content probe — packet says signed apply-and-relaunch proof remains blocked until protected publication.
- ISC-207: file-content probe — packet says rollback is explicit reinstall and disclaims automatic rollback.
- ISC-208: file-content probe — packet records DMG SHA-256 `92b1a2f14ec4f6831782e4387f19b4c8343478ee6e18191fb6920941983d7d83`.
- ISC-209: file-content probe — packet records team identifier `BS6SZR4929`.
- ISC-210: file-content probe — packet requires a pre-upgrade local-state fingerprint.
- ISC-191: executable release gate — `release:ota:prep` accepted `0.7.5 > 0.7.4`, passed 719 tests, types, lint, both zero-vulnerability audits, fuse/CSP/evidence gates, production smokes, renderer build, and placeholder scan.
- ISC-192: clean executable package gate — `release:ota:prep:full` exited zero from clean commit `98a2fe1` with the complete deterministic gate and unsigned builder pass.
- ISC-193: generated-manifest probe — `[ota-prep] release/latest-mac.yml reports 0.7.5`.
- ISC-194: architecture probe — `verify:release-architecture` verified the executable and all 16 packaged native binaries as arm64.
- ISC-194.1: fuse probe — `packaged app fuse policy ok`.
- ISC-194.2: packaged SQLite probe — `packaged SQLite bootstrap passed`.
- ISC-194.3: packaged main probe — `packaged main process booted from app.asar with a complete module graph`.
- ISC-194.4: packaged renderer probe — renderer loaded from isolated `app.asar/dist/renderer/index.html`.
- ISC-202: GitHub pull-request probe — draft PR `#123` owns branch `codex/ota-workflow-release-upgrade`.
- ISC-202.1: pull-request boundary probe — PR body explicitly withholds merge, tag, release, R2 manifest mutation, and completed upgrade claims.
- ISC-224: packaged main-process probe — `app.asar` resolved `https://clio-relay.thoughtseed.space` from an empty environment input and exited zero.
- ISC-225: JSON probe — `package=0.7.6` and lock root/package version `0.7.6`.
- ISC-226: clean executable package gate — candidate `19f8f92` passed 753 tests, audits, smokes, arm64/16-native-binary architecture, fuses, SQLite, isolated main/renderer `app.asar` boots, and generated manifest `0.7.6`.
- ISC-244: clean executable package gate — candidate `316c8dc` passed 753 tests, audits, smokes, an exact `0.7.8` manifest, arm64/16-native-binary architecture, fuses, SQLite, and isolated packaged main/renderer `app.asar` boots.
- ISC-245: protected release receipts — PR CI `30452023276`, exact-main CI `30452343575`, merge/tag `3a2d66733d2521c0d97c25e973124d3fdecc27c0`, Release Candidate `30452752239`, Publish OTA `30453055294`, GitHub Release `v0.7.8`, and independent public SHA-512 verification all passed.
- ISC-246: installed-app proof — Finder-launched signed v0.7.7 presented separate download/restart consent, relaunched as signed/notarized v0.7.8 with account/workspace continuity, rendered the governed 15-lane catalog, and returned the content-bearing live Clio response `Clio live relay is ready.`
- v0.7.5 protected PR proof: exact head `73daae7fb1128ed6c424b99f0d3c8987be9fff37` passed macOS, Ubuntu, and Windows CI in run `30295030981`; PR #123 remained open, draft, and mergeable.
- v0.7.5 post-deliverable review: Advisor returned an honest preparation pass, and the neutral read-only Cato-brief fallback returned PASS with no P0/P1 finding. Both retained signed/notarized publication and installed apply/relaunch/state-continuity proof as later protected work.
- v0.7.5 completeness: all twelve required ISA sections exist; the criteria list contains 291 unique IDs with 268 checked overall and all 52 preparation criteria `ISC-176` through `ISC-210` checked.

### September 5 reconciliation evidence

- ISC-42.1: historical GitHub run — manual main candidate 30273246772 succeeds at f133581; dependent publisher 30273516496 skips every job.
- ISC-66: historical CI — run 29233059038 passes macOS, Ubuntu and Windows for reviewed PR #99 head dd72b39 before merge.
- ISC-67: historical merge — PR #99 merges into main at 9560764 after all required platform jobs completed.
- ISC-68: historical tag/run — v0.5.5 dereferences to 9560764; Release Candidate 29233526031 succeeds at that SHA.
- ISC-69: historical publisher — 29233658887 passes explicit signed/notarized artifact, immutable-byte and public-feed verification for v0.5.5.
- ISC-111: historical CI — run 29420803951 passes three platforms for My Studio PR #108 head 856d9d3 before merge.
- ISC-112: historical merge — PR #108 merges into main at 8e2759d after the three required platform jobs completed.
- ISC-113: historical tag/ancestry — v0.5.6 equals 8e2759d and includes compact PR #107 merge 1963fbc plus My Studio PR #108.
- ISC-114: historical publisher — 29421385109 passes signature/notarization and public release verification for v0.5.6.
- ISC-115: historical publisher plus current GitHub metadata read — v0.5.6 exact ZIP/DMG filenames and sizes 154074459/157297020 match its manifest; publisher verifies full public hashes.
- ISC-247: configuration/CLI — Labs config pins 9d7cec1b5a32b2df8c6cdc1321ccd00b; source dev-url probe under 9d9d identifies pub-a25dc91980924ba09b031c07d6812e53.r2.dev.
- ISC-248: CLI/HTTP — source manifest HTTP200 is 0.7.12; target remote Wrangler object read is 0.7.8 on 2026-09-05.
- ISC-249: name-only CLI/API — GitHub environment remains 4/9; Labs Worker has 16 secret names including GitHub App/Realtime; validity remains unverified.
- ISC-253: plan/source inspection — docs/evidence/2026-09-05-labs-migration-review.md records custom-host cohort through 0.7.8 and r2.dev cohort 0.7.9–0.7.12 with retained bridge publication.

Full receipt: `docs/evidence/2026-09-05-labs-migration-review.md`; run metadata: `docs/evidence/2026-09-05-labs-migration-historical-runs.json`.

- ISC-250: workflow readback — cleanup job explicitly declares `environment: ota-production` and main-only guard.
- ISC-251: local fake-AWS suite — `npm run test:release-ops` reports 15 tests, 15 pass, 0 fail; focused ESLint and git diff --check pass.
- ISC-252: source/readback — documented current feed equals `DEFAULT_FEED_URL` and `package.json` build.publish URL byte-for-byte.
- ISC-254: SHA-256 preservation — all five pre-existing dirty root files match the before-session manifest; root code/ISA/README/architecture WIP is unchanged.

### Documentation verification — 2026-09-05

ISC-263–270 verified by the catalog/link/source/ISA/planning checks, focused
tests, parallel source review and historical SHA-256 preservation audit in
[the documentation receipt](docs/evidence/2026-09-05-documentation-deep-pass.md).
This closes documentation maintenance only; release readiness remains
`blocked-labs-ota-cutover`.
