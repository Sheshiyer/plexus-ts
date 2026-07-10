---
project: Plexus
task: "Final cross-layer gap pass and OTA release preparation"
effort: E3
effort_source: explicit
phase: execute
progress: 0/59
mode: interactive
started: 2026-07-10T13:22:00Z
updated: 2026-07-10T13:58:00Z
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

- [ ] ISC-1: `git merge-base HEAD origin/main` equals the original `origin/main` SHA used to create the release worktree.
- [ ] ISC-2: `ISA.md` passes the E3 project completeness check with at least 32 unique atomic ISCs and at least one `Anti:` ISC.
- [ ] ISC-3: `package.json` reports version `0.5.3`.
- [ ] ISC-4: `package-lock.json` reports root package version `0.5.3`.
- [ ] ISC-5: neither local nor remote refs contain tag `v0.5.3` before release preparation completes.
- [ ] ISC-6: SHA-256 hashes of the three dirty root architecture documents match the preserved pre-pass hashes.

### Deterministic release gates

- [ ] ISC-7: `npm run lint` exits 0.
- [ ] ISC-8: `npm run typecheck` exits 0.
- [ ] ISC-9: `npm run release:scan-placeholders` exits 0.
- [ ] ISC-10: `npm run security:audit:prod` exits 0 with no unwaived high or critical production vulnerability.
- [ ] ISC-10.1: `npm run security:audit:release` exits 0 with no high or critical finding across the packaged Electron runtime and release toolchain.
- [ ] ISC-11: `npm run verify:csp` exits 0.
- [ ] ISC-12: `npm run verify:fuses` exits 0 against the configured production fuse policy.
- [ ] ISC-13: `npm run verify:release-evidence` exits 0.
- [ ] ISC-14: `npm run verify:release-candidate` exits 0.
- [ ] ISC-15: `npm run test:all` exits 0.
- [ ] ISC-16: `npm run smoke:all` exits 0 after main and preload builds.
- [ ] ISC-17: `npm run build:renderer` exits 0.
- [ ] ISC-18: `npm run verify:all` exits 0 on the final candidate commit.
- [ ] ISC-19: `npm run release:ota:prep` exits 0 for `v0.5.3` without publishing.
- [ ] ISC-20: `npm run release:ota:prep:full` exits 0 and generated `release/latest-mac.yml` reports `version: 0.5.3`.
- [ ] ISC-20.1: the unsigned package gate emits only macOS arm64 update filenames and `lipo -archs` reports `arm64` without `x86_64` for the packaged executable.

### Electron trust boundary

- [ ] ISC-21: every production `BrowserWindow` sets `contextIsolation: true`.
- [ ] ISC-22: every production `BrowserWindow` sets `nodeIntegration: false`.
- [ ] ISC-23: every production `BrowserWindow` sets `sandbox: true`.
- [ ] ISC-24: every production `BrowserWindow` keeps `webSecurity` enabled.
- [ ] ISC-25: production navigation and popup handlers deny untrusted destinations and allow only validated external HTTP(S) URLs through the OS browser.
- [ ] ISC-26: the preload exposes named typed methods and never exposes raw `ipcRenderer`, Node `require`, or `process` to the renderer.
- [ ] ISC-27: every renderer-to-main IPC channel that accepts data performs trusted-side validation before a privileged effect.
- [ ] ISC-28: member bridge token persistence uses Electron main-process `safeStorage` and has no plaintext fallback.
- [ ] ISC-29: production renderer artifacts contain no Access JWT, Worker admin token, scoped bridge token, R2 secret, signing credential, or Telegram routing credential.
- [ ] ISC-30: the packaged application enforces the declared Electron fuse and ASAR integrity policy.
- [ ] ISC-30.1: the Electron 43 `WasmTrapHandlers` fuse is explicitly declared, applied after pack, and verified rather than inheriting an ungoverned runtime default.

### Update runtime and user control

- [ ] ISC-31: automatic update checks are disabled for unsigned or unpackaged macOS builds unless an explicit development override is set.
- [ ] ISC-32: `electron-updater` keeps `autoDownload` disabled.
- [ ] ISC-33: `electron-updater` keeps `autoInstallOnAppQuit` disabled.
- [ ] ISC-34: Settings exposes distinct check, download, and install-restart states with error and disabled states observable to the user.
- [ ] ISC-35: the updater feed resolves to the pinned HTTPS origin `https://plexus-upgrade.thoughtseed.space/plexus` by default.
- [ ] ISC-36: updater errors produce a recoverable status and do not terminate the Electron main process.
- [ ] ISC-36.1: packaged Windows/Linux builds keep OTA disabled until platform-specific signed feeds exist.

### Release workflow, feed, and rollback

- [ ] ISC-37: the tag-triggered Release Candidate workflow has read-only permission, receives no Apple/R2 secrets, and builds unsigned arm64 evidence only.
- [ ] ISC-37.1: production signing and R2 publication run only from the default-branch Publish OTA workflow after independent merged-main/tag/package validation.
- [ ] ISC-38: the tagged Release workflow fails when any required Cloudflare R2 publishing secret is absent.
- [ ] ISC-39: the workflow publishes a ZIP, DMG, matching blockmaps, and `latest-mac.yml` for the candidate version.
- [ ] ISC-40: the workflow verifies public feed version, path, and SHA-512 against the locally generated manifest after R2 upload.
- [ ] ISC-40.1: public DMG/ZIP bodies are streamed and SHA-512 compared to `latest-mac.yml`; same-length corruption and cross-origin/path-bearing artifact references fail.
- [ ] ISC-41: the public feed responds over HTTPS with a non-error status and a bounded cache policy before a release is attempted.
- [ ] ISC-42: the previous signed `v0.5.2` GitHub release and OTA assets remain available as the rollback/install baseline.
- [ ] ISC-43: the release handoff requires recording the PR head SHA, merge commit, tag command, both workflow watch commands, artifact checks, feed check, and rollback boundary.
- [ ] ISC-43.1: live GitHub configuration has founder-reviewed `ota-production` restricted to `main`, a founder-only creation/update/deletion ruleset for `v*` tags, and PR/three-platform-CI protection for `main`.
- [ ] ISC-43.2: the runbook blocks `v0.5.3` until all nine Apple/R2 values exist as environment secrets and their repository-scoped copies are removed.

### Hermes reporting and infrastructure authority

- [ ] ISC-44: active provisioning and reporting authority code contains no MultiCA endpoint, workspace, type, or sink.
- [ ] ISC-44.1: Worker and member-bridge traffic are pinned to their canonical origins; renderer, stored legacy state, or redeem-response payloads cannot redirect credentials or reports.
- [ ] ISC-45: Fabric/Paperclip failure cannot block local focus work, report generation, daily bridge queueing, or monthly Hermes review generation.
- [ ] ISC-46: founder-review payloads use `audience: founder_review` and contain no Telegram chat ID, topic ID, bot token, or infrastructure-wide bridge token.
- [ ] ISC-47: missing persisted standup evidence can feed both proactive nudges and monthly founder-review compliance.
- [ ] ISC-48: direct R2 archival code cannot ship a placeholder signature or require employee-side R2 credentials on a reachable production path.

### Anti-criteria

- [ ] ISC-49: Anti: this pass creates no `v0.5.3` tag, GitHub Release, R2 upload, or direct push to `main`.
- [ ] ISC-50: Anti: final reporting does not describe deterministic tests, unsigned packaging, or a feed HEAD request as a successful signed OTA upgrade.

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
