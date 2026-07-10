---
project: Plexus
task: "Final cross-layer gap pass, OTA authority hardening, and release continuation"
effort: E3
effort_source: explicit
phase: verify
progress: 74/77
release_readiness: blocked-pre-tag
mode: interactive
started: 2026-07-10T13:22:00Z
updated: 2026-07-10T20:13:47Z
---

## Problem

Plexus `origin/main` is ahead of the currently published `v0.5.2` binary after the Hermes reporting cutover and P9 closeout, but the repository has no durable project ISA tying Electron trust boundaries, the Hermes/Workspace Worker authority split, signed packaging, and the Cloudflare R2 OTA feed into one release definition. A local green test suite alone cannot prove that the next binary is safe to sign, publish, discover, download, install, and roll back.

## Vision

An employee installs one signed Plexus build and gets a calm, local-per-member coordination app whose privileged work stays in Electron main, whose reporting travels directly to Hermes through a scoped member bridge, and whose updates are explicit, signed, observable, and recoverable. The founder reads reporting through Cambium TG Mini App, configured Telegram topics, and TeamForge-compatible operational views without Plexus reviving MultiCA or embedding Telegram routing.

## Out of Scope

- This pass does not push a release tag, publish signed binaries, upload to R2, or mutate live Hermes, Cambium, Cloudflare, or Telegram data-plane infrastructure.
- This pass may harden GitHub release-authority controls, but it cannot copy or delete opaque repository secret values; Apple/R2 secret migration remains a pre-tag operator action.
- This pass does not claim true OTA success; that requires a signed upgrade from the published `v0.5.2` app to the eventual candidate.
- This pass does not merge or modify unrelated PR #40 or the dirty architecture documents in the root checkout.
- This pass does not make Fabric/Paperclip a required reporting hop or restore any deprecated MultiCA authority.
- This pass does not expand the macOS OTA workflow into a Windows or Linux updater release.

## Principles

- Release correctness is an end-to-end property: source gates, packaged artifact, signature, feed metadata, download, install, relaunch, and rollback all matter.
- The renderer is untrusted; privileged capabilities and secrets remain in Electron main behind narrow validated IPC.
- Hermes owns reporting orchestration and founder routing; the Workspace Worker remains the member-data plane and degraded daily fallback.
- Evidence must distinguish deterministic local proof, CI proof, signed artifact proof, and live external proof.
- Prefer one strengthened release rule or information flow that prevents a failure class over many release-day reminders.

## Constraints

- Base all work on current `origin/main` in `/private/tmp/plexus-ota-final-gap-pass`; preserve the root checkout and its three dirty architecture documents byte-for-byte.
- Keep `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, restrictive CSP, and deny-by-default navigation/window opening.
- Keep Access JWTs, Worker tokens, member bridge tokens, local API bearer tokens, R2 credentials, and signing credentials out of renderer/preload data; member bridge tokens use main-process `safeStorage` only.
- Preserve one production publisher authority: the tag-triggered workflow is a secret-free candidate gate, while one default-branch `workflow_run` publisher owns signing, GitHub Release, and R2 publication.
- macOS OTA artifacts must be signed and notarized, and the workflow must fail tagged releases when Apple signing or R2 publishing secrets are missing.
- The next candidate version must be greater than the already-published and already-tagged `v0.5.2`.
- MultiCA is deprecated; active contracts, code, product copy, and release evidence must name Hermes/Cambium as current authority.
- Production publishing and data-plane mutation require an explicit later release step after the prepared PR is reviewed and merged; repository approval and tag-protection controls may be configured during preparation.

## Goal

Prepare the smallest reviewable `v0.5.3` release-candidate change set on a branch from `origin/main`: close all reachable high-impact Electron, reporting, packaging, feed, and release-gate gaps; prove the deterministic and unsigned packaging gates locally; and leave a PR with an exact signed OTA runbook while making no production release claim.

## Criteria

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
- [x] ISC-32: `electron-updater` keeps `autoDownload` disabled.
- [x] ISC-33: `electron-updater` keeps `autoInstallOnAppQuit` disabled.
- [x] ISC-34: Settings exposes distinct check, download, and install-restart states with error and disabled states observable to the user.
- [x] ISC-35: the updater feed resolves to the pinned HTTPS origin `https://plexus-upgrade.thoughtseed.space/plexus` by default.
- [x] ISC-36: updater errors produce a recoverable status and do not terminate the Electron main process.
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
- [ ] ISC-42.1: an unprivileged manual Release Candidate run passes on the exact post-hardening `main` SHA without invoking Publish OTA.
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

- isc: ISC-31..ISC-36.1
  type: updater-state-machine
  check: signed-build gate, manual download/install policy, Settings-visible states, error recovery
  threshold: all focused updater assertions pass
  tool: Vitest + source inspection

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

- isc: ISC-49..ISC-50
  type: anti-probe
  check: no tag/release/publish mutation and no overstated proof
  threshold: absent
  tool: git refs + gh release list + final evidence review
```

## Features

```yaml
- name: ElectronTrustBoundary
  description: Window hardening, typed preload, validated IPC, safeStorage token custody, CSP, and fuses
  satisfies: [ISC-21, ISC-22, ISC-23, ISC-24, ISC-25, ISC-26, ISC-27, ISC-28, ISC-29, ISC-30, ISC-30.1]
  depends_on: []
  parallelizable: true

- name: ManualSignedUpdater
  description: User-controlled updater state machine pinned to the signed HTTPS generic feed
  satisfies: [ISC-31, ISC-32, ISC-33, ISC-34, ISC-35, ISC-36, ISC-36.1]
  depends_on: [ElectronTrustBoundary]
  parallelizable: true

- name: HermesReportingAuthority
  description: Direct member bridge to Hermes, optional helper degradation, redacted founder review, and standup compliance
  satisfies: [ISC-44, ISC-44.1, ISC-45, ISC-46, ISC-47, ISC-48]
  depends_on: [ElectronTrustBoundary]
  parallelizable: true

- name: ReleaseGate
  description: Deterministic tests, security checks, artifact smoke, versioning, and candidate preparation
  satisfies: [ISC-3, ISC-4, ISC-5, ISC-7, ISC-8, ISC-9, ISC-10, ISC-10.1, ISC-11, ISC-12, ISC-13, ISC-14, ISC-15, ISC-16, ISC-17, ISC-18, ISC-19, ISC-20, ISC-20.1]
  depends_on: [ElectronTrustBoundary, ManualSignedUpdater, HermesReportingAuthority]
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
```

## Decisions

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

## Changelog

- 2026-07-10 — Conjectured: the existing Electron 33 and tag-owned publisher could be incrementally patched. Refuted by: the full lock audit exposed eighteen shipped Electron advisories and independent review showed tag-controlled workflow code could reach repository secrets. Learned: the release needs a current Electron runtime plus a default-branch trusted publisher. Criterion now: ISC-10.1, ISC-30.1, ISC-37, and ISC-37.1 require those executable boundaries.
- 2026-07-10 — Conjectured: manifest size checks and an R2 upload exit code were enough publication evidence. Refuted by: same-length corruption, cross-origin manifest references, partial drafts, and post-manifest reruns all remained possible. Learned: immutable writes, byte hashing, relative references, manifest-last order, draft reconciliation, and exact-current recovery must operate as one protocol. Criterion now: ISC-39, ISC-40, and ISC-40.1 encode that protocol.
- 2026-07-10 — Conjectured: reporting readiness could still include historical helper status and Worker standup synthesis. Refuted by: the Hermes authority contract and persisted-evidence requirement. Learned: Hermes/bridge owns founder delivery, Fabric/Paperclip is optional, and local persisted standups are the compliance source. Criterion now: ISC-44 through ISC-48 enforce the current authority model.
- 2026-07-10 — Conjectured: updater tests that passed on the macOS development host were platform-independent. Refuted by: protected CI run `29099595999` failed the Darwin-only cases on Ubuntu because those tests inherited the native runner platform; macOS passed them and Windows was canceled before testing. Learned: each updater test must establish its intended platform explicitly. Criterion now: ISC-18 requires the fixture to pass in all required CI environments.
- 2026-07-10 — Conjectured: reading a YAML workflow as UTF-8 produced identical strings on every checkout. Refuted by: Windows CI run `29099845036` converted tracked line endings to CRLF and failed one multiline literal after the updater suite passed. Learned: static workflow tests must normalize line endings before asserting content. Criterion now: ISC-18 covers semantic workflow contracts independently of platform checkout policy.
- 2026-07-10 — Conjectured: the long Windows assistant step indicated a Hermes polling or native-architecture deadlock. Refuted by: cancelled run `29121824890` completed those new tests while install, lint, and SQLite fixtures were all roughly six times slower than their baseline, and the next hosted runner restored normal install and lint timing. Learned: keep runtime behavior unchanged, expose suites separately, and bound each CI test step. Criterion now: ISC-18 remains observable and time-bounded on every matrix platform.

## Verification

- Repository base: `git merge-base HEAD origin/main` and `origin/main` both resolved to `e08fd4ea4c8d935b8eb54f9e7ae40c11c0797e5c` before this continuation; package and lock versions both report `0.5.3`; local and remote `v0.5.3` refs are absent.
- Complete gates: `npm run verify:all` passed lint, typecheck, placeholder scan, both zero-vulnerability security audits, fuse/CSP/evidence/closeout gates, 128 test files with 441 tests, production smoke, and renderer build.
- Package proof: `npm run release:dry-run` produced `latest-mac.yml` for `0.5.3`, a `156821683`-byte DMG, and a `154065948`-byte ZIP. Recursive `lipo` checks passed for all 16 packaged Mach-O/native binaries, including `node_sqlite3.node`; the fused packaged app launched, initialized a non-empty temporary SQLite database, and exited 0. The local app is unsigned and unnotarized, so this is not production-release evidence.
- Workflow syntax: actionlint `v1.7.7`, Ruby YAML parsing, and 23 focused workflow/proof tests passed the pinned CI, exact-main manual candidate, and Publish OTA workflows.
- Live baseline: public `latest-mac.yml` responds `200` with `cache-control: public, max-age=60`, and all four signed `v0.5.2` versioned objects also return the legacy 60-second policy. The runbook now blocks tagging until an authorized metadata-only repair makes the manifest revalidating and versioned objects immutable without changing their bytes; GitHub release `v0.5.2` retains its manifest, arm64 DMG/ZIP, and both blockmaps.
- GitHub controls: environment `ota-production` requires founder approval and a `main` deployment policy; active tag and main rulesets protect `v*` creation/mutation and require PR plus three-platform CI for `main`.
- Root preservation: the root checkout still contains only its three pre-existing dirty architecture documents. Their current SHA-256 values, refreshed after concurrent owner edits and without writing them from this worktree, are `9c5677374ff0f341fd897bca8e9f40409e8640bd2321dbf3c28a9978f9a28cca`, `f649b041b8af7e6d701f77eafa43706372c36d8b2330a32227ca6a0d7bdd52cc`, and `e5209195d71c745c67d80443165b159ded3815e8b22266afe0ed1e052756064a`.
- Blocking external prerequisites: an authorized R2 operator must repair and verify the legacy `v0.5.2` cache metadata, and `ota-production` has zero secrets while the nine legacy Apple/R2 names remain repository-scoped. GitHub does not expose existing values, so an authorized operator must enter them under the new unique `OTA_*` environment names, verify all nine environment entries, then delete the legacy repository copies before any `v0.5.3` tag.
