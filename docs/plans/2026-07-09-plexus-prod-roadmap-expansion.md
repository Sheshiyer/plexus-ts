# Plexus MVP-to-Production Roadmap Expansion

Date: 2026-07-09
Scope: Plexus 2-3 day production-readiness planning expansion
Canonical GitHub hub: #49
Mapped epics: #41, #42, #43, #44, #45, #46, #47, #48, #50
Task count: 245

## Goal

Move Plexus from a strong MVP into a real product engineering workflow for an assistant-first digital co-working space. The app should make the employee flow and founder/operator proof loop visible, testable, and shippable:

Employee opens Plexus -> Clio Today shows the command center -> employee joins a co-working room -> receives or continues a bridge task -> uses Clio and Temperance dispatch -> captures evidence -> submits a report -> founder/operator sees proof.

## Ground Rules

- Keep member bridge tokens in Electron main process only, persisted through `safeStorage`.
- Treat Clio as the assistant-first operating layer, not a secondary chat tab.
- Treat UI/UX parity as a production workstream, not polish after backend work.
- Preserve Fabric/Paperclip as optional helpers; do not make them the product center.
- Keep GitHub execution-friendly: epic issues and selected task slices belong in GitHub; the full 245-task catalog belongs in this durable doc.
- Distinguish local deterministic proof, degraded/manual proof, and live external proof.
- Do not claim production readiness without CI, release, screenshot, and secret-custody evidence.

## Phase Overview

| Phase | Count | Primary Issues | Outcome |
|---|---:|---|---|
| P0 Approval + Spec Baseline | 20 | #49, #48, #50 | Freeze roadmap, task IDs, acceptance vocabulary, and GitHub sync rules. |
| P1 Production Guardrails | 24 | #47, #48, #43, #45 | Security, IPC, token custody, CI, and release gates defined first. |
| P2 Clio + Evidence Spine | 30 | #43, #45 | Assistant tool loop and evidence/report workflow become executable. |
| P3 Employee Today | 28 | #41, #43, #45, #50 | Employee starts in Clio Today with task, room, proof, and assistant context. |
| P4 Founder Proof Cockpit | 24 | #42, #45, #46, #48, #50 | Founder/admin starts in proof cockpit with six visible signal domains. |
| P5 Co-working Room | 30 | #46, #22, #23, #24, #26 | Co-working becomes an active room/stage workflow with proof closeout. |
| P6 Temperance Dispatch | 20 | #44, #43, #41, #45 | Skill hints become safe recommendations and confirmed work packets. |
| P7 Design-System Parity | 24 | #50, #41, #42, #46 | Cross-app viewport polish, status language, density, and screenshot QA. |
| P8 Hardening + Release Workflow | 27 | #47, #48 | Electron/security/workflow gates close or get explicitly deferred. |
| P9 Integration + Closeout | 18 | #49, #48, all | UAT, docs, GitHub sync, release packet, and verification ledger. |

## Task ID Schema

Task IDs use `P{phase}-W{wave}-T###`.

- `P` is the roadmap phase.
- `W` is the execution wave inside the phase.
- `T###` is a stable task number inside the phase.

## GitHub Sync Policy

Sync into GitHub:

- Epic issue summaries, acceptance criteria, selected phase checklists, PR links, blockers, screenshots, and CI/release proof.
- Execution-unit child issues only when independently assignable and verifiable.
- Labels and comments that help filter current work.

Keep in this durable doc:

- Full 245-task catalog.
- Dependency graph, phase logic, rationale, degraded-state rules, and detailed proof gates.
- Cross-cutting verification and release evidence requirements.

## Execution Decisions

| Date | Task IDs | Decision | Evidence |
|---|---|---|---|
| 2026-07-09 | P0-W3-T016 | Use one GitHub milestone for the production-readiness push: `Plexus MVP-to-Production Readiness`. Keep P0-P9 as phase labels/checklists inside #49 and the durable plan instead of creating ten separate milestones. | Created GitHub milestone #2 and applied it to #41-#50; #49 remains the canonical hub for P0-P9. |
| 2026-07-09 | P0-W3-T017 | Do not blindly merge PR #34 or #40 during roadmap execution. Close #34 as superseded by current v0.5.x co-working room-stage work; keep #40 as the clean narrow media-controls fix pending visual verification before merge. | `gh pr view 40` reported `mergeStateStatus: CLEAN`; PR audit found #40 is a one-file grid fix. `gh pr view 34` reported `mergeStateStatus: DIRTY`; PR audit found #34 is a stale/conflicting 0.4.14 ambient-floor branch. |
| 2026-07-09 | P0-W3-T018 | Keep `docs/plans/2026-07-05-coworking-meet-like-screen-wall.md` as a P5 supporting implementation plan. It should travel with the roadmap docs when the planning artifact is staged, not be deleted or ignored. | File exists under `docs/plans/` and defines the Meet-like room-stage rollout that maps to the P5 co-working phase. |

## Execution Ledger

| Date | Batch | Tasks | Result | Verification |
|---|---|---|---|---|
| 2026-07-09 | Batch 1 | P0-W3-T016, P0-W3-T017, P0-W3-T018, P0-W3-T020 | Started execution from the roadmap by creating the production milestone, pinning the PR disposition policy, classifying the co-working plan, and recording this first ledger entry. | `gh issue view 49 --comments` showed the full roadmap sync comment; `gh issue list` showed #41-#50 open under milestone #2; #49 checkpoint comment: https://github.com/Sheshiyer/plexus-ts/issues/49#issuecomment-4923159362. |
| 2026-07-09 | Batch 1 follow-up | P0-W3-T015, P0-W3-T019 | Closed the strict GitHub sync gaps found during read-only audit: #49 now has a selected execution slice, and #48 carries `priority:P0` for workflow/release parity. | #49 selected-task comment: https://github.com/Sheshiyer/plexus-ts/issues/49#issuecomment-4923202748; `gh issue view 48` verifies `priority:P0`. |
| 2026-07-09 | Batch 1 publish | P0-W3-T019, P0-W3-T020 | Opened PR #51 to publish the roadmap docs from an isolated branch instead of mixing them into PR #40. | PR: https://github.com/Sheshiyer/plexus-ts/pull/51; #49 PR-link comment: https://github.com/Sheshiyer/plexus-ts/issues/49#issuecomment-4923215946. |
| 2026-07-09 | Batch 2 | P1-W2-T009, P1-W2-T010, P1-W2-T011, P1-W2-T012 | Added aggregate `test:all` and `verify:all` scripts, wired all Vitest suites into CI, inserted tests before signed release artifact generation, and added `test:all` to OTA prep local gates. Windows CI exposed assistant SQLite cleanup locks, so `test:assistant` now disables file parallelism. | `npm run test:all` passed 70 files / 149 tests; `npm run verify:all` passed lint, typecheck, placeholder scan, tests, main/preload import smoke, and renderer build. `release:ota:prep` was not run because local tag `v0.5.2` already exists. |
| 2026-07-09 | Batch 3 | P1-W1-T002, P1-W1-T004 | Added focused Electron security regression tests and hardened the Cloudflare Access login child window with sandboxed web preferences, popup denial, navigation/redirect allowlisting, deny-by-default permissions, HTTPS-only targets, timeout cleanup, and token-safe logging. Post-merge Windows CI exposed one remaining sqlite temp cleanup lock, so the assistant DB fixture now awaits `closeDb()` before deleting temp directories. | `npx vitest run test/assistant/access-login-security.test.ts --no-file-parallelism` passed 10 tests; `npx vitest run test/assistant/daily-event-retry.test.ts --no-file-parallelism` passed 2 tests; `npm run test:assistant` passed 55 files / 115 tests; `npm run verify:all` passed lint, typecheck, placeholder scan, all tests, main/preload import smoke, and renderer build. |
| 2026-07-09 | Batch 4 | P1-W1-T005, P1-W1-T006, P1-W1-T007, P1-W2-T014, P1-W2-T015 | Added a central guarded IPC registration helper for sensitive channels, added runtime payload schemas for assistant model settings, Worker config, bridge/Fabric inputs, auth, backup restore, and member setup, moved Access JWT custody to `safeStorage` with legacy plaintext migration/clear, migrated Worker/local API bearer-token legacy rows into encrypted custody, removed the renderer-facing JWT debug helper, and stopped local API token logging. | `npm run test:assistant -- --run test/assistant/ipc-security.test.ts test/assistant/token-custody.test.ts test/assistant/secret-surface-regression.test.ts test/assistant/access-login-security.test.ts test/assistant/assistant-ipc.test.ts` passed 58 files / 128 tests; `npm run verify:all` passed lint, typecheck, placeholder scan, all tests, main/preload import smoke, and renderer build; exact `rg` scans found no token-bearing keys or debug JWT channel in `src/preload` or `src/renderer`. |
| 2026-07-09 | Batch 5 | P1-W2-T016, P1-W3-T017, P8-W1-T010, P8-W2-T011, P8-W2-T012 | Hardened backup restore around the active DB lifecycle and configured Electron fuse policy. Restore now derives the active `PLEXUS_DB_PATH`, rejects out-of-dir/symlink/non-SQLite backups, closes the SQLite handle, atomically replaces the DB, and reopens/migrates it. Electron builder now applies the production fuse policy, `verify:fuses` checks config and optional packaged apps, release prep and macOS release verify fuses, and `verify:all` includes the fuse gate. | `npm run test:assistant -- --run test/assistant/backup-restore.test.ts test/assistant/fuse-policy.test.ts` passed 60 files / 135 tests; `npm run verify:fuses` passed; `npm run typecheck` passed; `npm run verify:all` passed. |

## Next Batch Queue

| Batch | Recommended tasks | Rationale | Verification |
|---|---|---|---|
| Batch 2 | P1-W2-T009, P1-W2-T010, P1-W2-T011, P1-W2-T012 | Start with aggregate test/release guardrails before security code churn: add `test:all`, add `verify:all`, wire Vitest into CI, and put tests before signed release. | `npm run verify:all`; CI workflow includes tests; release workflow runs tests before signing. |
| Batch 3 | P1-W1-T002, P1-W1-T004 | Add Electron security regression tests first, then harden the Access login child window sandbox/navigation/popup posture. | Focused Vitest security tests plus `npm run typecheck` and `npm run lint -- --quiet`. |
| Batch 4 | P1-W1-T005, P1-W1-T006, P1-W1-T007, P1-W2-T014, P1-W2-T015 | Add the first sensitive IPC/token custody guard slice around bridge, assistant config, worker config, backup restore, member setup, Access JWT, and local API bearer token handling. | IPC security tests, secret-regression scans, and no token-bearing renderer/preload surfaces. |

## Dependency Spine

```text
#49 roadmap approval
  -> P0 spec baseline
  -> all later phases

#50 design-system parity
  -> #41 Clio Today
  -> #42 founder proof cockpit
  -> #43 Clio surfaces
  -> #44 Temperance recommendations
  -> #45 evidence/report UX
  -> #46 co-working room

#47 security and custody
  -> #43 assistant tool execution
  -> #45 bridge/evidence token custody
  -> #46 realtime/privacy controls
  -> P8 release hardening

#48 workflow parity
  -> P1 CI/test/release gates
  -> P8 release workflow
  -> P9 closeout packet

#43 Clio assistant spine
  -> #41 Clio Today command panel
  -> #44 dispatch packets
  -> #45 daily/report actions

#45 bridge/evidence workflow
  -> #41 assignment/proof status
  -> #42 operator proof signals
  -> #46 co-working closeout evidence
```

## P0 - Approval + Spec Baseline

Primary issues: #49, #48, #50
Outcome: a ratified planning spine exists before implementation churn.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P0-W1-T001 | #49 | P0 | Confirm #41-#50 as the production roadmap epic set. | #49 names all epics and there are no orphan P0 production lanes. |
| P0-W1-T002 | #49 | P0 | Record the golden path as the non-negotiable product workflow. | Employee-to-founder proof path is present in #49 and this doc. |
| P0-W1-T003 | #49 | P0 | Freeze task ID schema for GSD execution. | `P{phase}-W{wave}-T###` is documented and used consistently. |
| P0-W1-T004 | #50 | P0 | Freeze the design reference contract. | `docs/design/screen-references/app-component-viewport-design-sheet.png` is named as primary. |
| P0-W1-T005 | #50 | P0 | Define the shared viewport vocabulary. | PageHeader, InstrumentPanel, MetricRail, LedgerRail, CommandDock, EmptyStatePanel, and DegradedStatePanel are named. |
| P0-W1-T006 | #41 | P0 | Ratify employee launch behavior. | Employee default is Clio Today, not the old Focus-first experience. |
| P0-W1-T007 | #42 | P0 | Ratify founder/admin launch behavior. | Founder/admin default is the operator proof cockpit. |
| P0-W2-T008 | #48 | P0 | Create task-count budget per epic. | Each issue #41-#50 has a clear task budget in this doc. |
| P0-W2-T009 | #49 | P0 | Map every phase to GitHub issues. | Each phase table has issue links and no unmapped task clusters. |
| P0-W2-T010 | #49 | P0 | Define live, degraded, manual, and deferred proof types. | Acceptance language distinguishes proof types consistently. |
| P0-W2-T011 | #45 | P0 | Define evidence taxonomy. | Pending, matched, missing, weak, verified, rejected, and inaccessible states are canonical. |
| P0-W2-T012 | #47 | P0 | Define sensitive-boundary inventory categories. | Tokens, IPC, logs, backup restore, login windows, and local API are in scope. |
| P0-W2-T013 | #43 | P0 | Define assistant tool safety categories. | Read-only, confirm-required, admin-only, and blocked tools are documented. |
| P0-W2-T014 | #44 | P0 | Define Temperance dispatch scope. | Recommendations and confirmed handoffs are allowed; direct uncontrolled execution is not. |
| P0-W3-T015 | #48 | P0 | Define GitHub sync policy. | This doc is canonical; GitHub gets selected execution slices. |
| P0-W3-T016 | #48 | P1 | Decide milestone strategy. | Either P0-P9 milestones or a single production-readiness milestone is selected. |
| P0-W3-T017 | #48 | P1 | Decide PR #34 and #40 disposition policy. | Conflicting/open PRs have a written merge, supersede, or close path. |
| P0-W3-T018 | #48 | P1 | Classify the untracked co-working plan file. | `docs/plans/2026-07-05-coworking-meet-like-screen-wall.md` is committed, moved, or explicitly ignored. |
| P0-W3-T019 | #49 | P0 | Sync overview comment to #49. | #49 points to this expansion and summarizes the phase spine. |
| P0-W3-T020 | #49 | P0 | Add first verification ledger entry. | Local doc, GitHub sync, and dirty-worktree state are recorded. |

## P1 - Production Guardrails

Primary issues: #47, #48, #43, #45
Outcome: production boundaries are explicit before feature implementation.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P1-W1-T001 | #47 | P0 | Capture current security baseline. | Electron version, token storage, IPC guardrails, logs, and backup gaps are listed. |
| P1-W1-T002 | #47 | P0 | Add Electron security regression tests. | Tests assert context isolation, sandbox posture, and no Node integration. |
| P1-W1-T003 | #47 | P0 | Decide Electron supported-major upgrade scope. | Do-now versus defer is documented with release risk. |
| P1-W1-T004 | #47 | P0 | Harden Access login window design. | Navigation, popup, sandbox, and permissions policy are specified. |
| P1-W1-T005 | #47 | P0 | Design central IPC sender-origin guard. | Sensitive handlers reject non-app sender origins. |
| P1-W1-T006 | #47 | P0 | Design IPC payload schema layer. | Guarded handlers have typed runtime validation requirements. |
| P1-W1-T007 | #47 | P0 | Define Access JWT migration to safeStorage. | Plaintext `tf.accessJwt` is migrated or cleared. |
| P1-W1-T008 | #45 | P0 | Reconfirm bridge member-token custody. | Renderer/preload cannot receive bridge token values. |
| P1-W2-T009 | #48 | P0 | Add aggregate `test:all` plan. | Assistant, co-working, and identity suites have one command target. |
| P1-W2-T010 | #48 | P0 | Add `verify:all` orchestration plan. | Lint, typecheck, tests, smokes, builds, scans, and security checks are sequenced. |
| P1-W2-T011 | #48 | P0 | Wire Vitest suites into CI plan. | CI fails on assistant, co-working, or identity test failures. |
| P1-W2-T012 | #48 | P0 | Add tests before signed release plan. | Release workflow cannot sign before test gates pass. |
| P1-W2-T013 | #43 | P0 | Define assistant secret-regression checks. | Assistant snapshots and renderer surfaces cannot leak keys/tokens. |
| P1-W2-T014 | #45 | P0 | Define bridge token regression checks. | `rg` and tests prove no token-bearing renderer/preload surfaces. |
| P1-W2-T015 | #47 | P0 | Define local API bearer-token custody. | API tokens are encrypted, replaced, or removed from plaintext storage. |
| P1-W2-T016 | #47 | P1 | Define backup restore safety contract. | Restore is path-bounded and DB handles close/reopen safely. |
| P1-W3-T017 | #47 | P0 | Define Electron fuse policy. | RunAsNode, NodeOptions, inspect, and integrity posture are specified. |
| P1-W3-T018 | #47 | P1 | Define scrubbed logging policy. | Token-like keys redact recursively before logs/support packets. |
| P1-W3-T019 | #47 | P1 | Define crash and rejection policy. | Main/renderer errors are captured without secrets. |
| P1-W3-T020 | #48 | P1 | Define docs freshness gate. | README, ROADMAP, OTA, HANDOFF, and architecture docs must match current state. |
| P1-W3-T021 | #48 | P1 | Define release evidence packet. | OTA feed, signing, notarization, screenshots, and test proof are required. |
| P1-W3-T022 | #50 | P1 | Define screenshot QA gate. | Today, proof cockpit, Clio, co-working, and degraded states need images. |
| P1-W3-T023 | #49 | P0 | Add binary production-ready gate. | Production claim requires all P0 gates green or explicitly deferred. |
| P1-W3-T024 | #48 | P0 | Sync guardrail slice into #47/#48. | GitHub comments capture the P1 gate list. |

## P2 - Clio + Evidence Spine

Primary issues: #43, #45
Outcome: assistant runtime and proof workflow become one auditable product spine.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P2-W1-T001 | #43 | P0 | Define production assistant runtime contract. | Request, stream, tool, intent, audit, and outbox states are documented. |
| P2-W1-T002 | #43 | P0 | Add runtime state machine plan. | Idle, loading, streaming, tool_wait, error, and done are testable. |
| P2-W1-T003 | #43 | P0 | Wire model tool-call loop plan. | Read-only model tools execute and emit tool results. |
| P2-W1-T004 | #43 | P0 | Confirm write-tool confirmation boundary. | Confirm-required tools become draft intents, not automatic side effects. |
| P2-W1-T005 | #43 | P0 | Implement `daily.sendEvent` task plan. | Confirmed daily intent queues/sends event and persists audit. |
| P2-W1-T006 | #43 | P0 | Remove unaudited renderer write fallback plan. | Packaged app cannot run write action without persisted intent. |
| P2-W1-T007 | #43 | P0 | Add intent expiry and replay protection plan. | Expired or reused intents cannot execute side effects twice. |
| P2-W1-T008 | #43 | P0 | Expand tool audit schema. | Audit stores actor, duration, failure kind, and redacted input/output. |
| P2-W1-T009 | #43 | P0 | Add context source health envelope. | Every source returns data plus freshness/error metadata. |
| P2-W1-T010 | #45 | P0 | Define canonical proof status enum. | Local work and Fabric tasks share proof language. |
| P2-W2-T011 | #45 | P0 | Normalize Fabric task persistence plan. | Tasks move from settings JSON toward queryable records. |
| P2-W2-T012 | #45 | P0 | Store Fabric task history events separately. | Duplicate event IDs are idempotent and conflicts are visible. |
| P2-W2-T013 | #45 | P0 | Link Fabric tasks to projects and work records. | Task can resolve project/work entry IDs or remain actionable. |
| P2-W2-T014 | #45 | P0 | Add member-scoped ownership tests. | Wrong member cannot report/complete another member task. |
| P2-W2-T015 | #45 | P0 | Link GitHub activity to task evidence. | Matched commits/PRs can upgrade evidence status. |
| P2-W2-T016 | #45 | P0 | Add proof provenance fields plan. | Work record can store evidence source, artifact URL/id, and checked timestamp. |
| P2-W2-T017 | #45 | P0 | Extend reports with Fabric task proof. | Reports show task counts, proof strength, missing proof, and blockers. |
| P2-W2-T018 | #45 | P0 | Persist generated daily proof packets. | Daily packet can be retrieved by date and linked to standup evidence. |
| P2-W2-T019 | #45 | P0 | Send daily proof through Worker then bridge fallback. | Worker failure records retryable bridge fallback state. |
| P2-W2-T020 | #43 | P0 | Add assistant production smoke script plan. | Runtime, daily, and bridge smokes run deterministically. |
| P2-W3-T021 | #43 | P1 | Add per-scope context budgets to UI. | Renderer shows dropped counts and freshness by scope. |
| P2-W3-T022 | #43 | P1 | Add project/task context scope. | Clio can read task summaries without raw directives. |
| P2-W3-T023 | #43 | P1 | Add provider timeout and cancellation plan. | Hung provider aborts and fallback is deterministic. |
| P2-W3-T024 | #43 | P1 | Add model usage telemetry plan. | Usage metadata saves without prompts or secrets. |
| P2-W3-T025 | #43 | P1 | Surface daily outbox in diagnostics. | Pending/failed/sent events are visible with retry controls. |
| P2-W3-T026 | #45 | P1 | Add missing-proof repair workflow plan. | User can attach/link evidence and recompute report state. |
| P2-W3-T027 | #45 | P1 | Add rejected-candidate visibility. | Rejected evidence remains visible but not counted as verified. |
| P2-W3-T028 | #45 | P1 | Add founder-ready report export shape. | Export contains work, tasks, evidence, blockers, and no secrets. |
| P2-W3-T029 | #45 | P1 | Add employee-to-founder proof fixture. | Fixture covers assignment -> work -> evidence -> daily packet -> admin state. |
| P2-W3-T030 | #43/#45 | P0 | Sync Clio/evidence slice into #43 and #45. | GitHub comments capture P2 P0/P1 execution tasks. |

## P3 - Employee Today

Primary issues: #41, #43, #45, #50
Outcome: employee first screen becomes the product center.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P3-W1-T001 | #41 | P0 | Create Clio Today route decision. | Employee launch route resolves to Today. |
| P3-W1-T002 | #41 | P0 | Reframe Focus as Clio Today. | Nav/title/copy make Today the daily command center. |
| P3-W1-T003 | #41/#45 | P0 | Create Today aggregate IPC plan. | One call returns entries, timer, tasks, proof gaps, and standup state. |
| P3-W1-T004 | #41 | P0 | Create pure Today snapshot model. | Model derives timer, entries, projects, assistant status, sessions, and proof risk without DOM APIs. |
| P3-W1-T005 | #41/#45 | P0 | Share Today aggregate with Focus/Reports/Assistant. | Today totals do not diverge across surfaces. |
| P3-W1-T006 | #41 | P0 | Map bridge assignment into Today. | Current assignment has status, source, proof requirement, and next action. |
| P3-W1-T007 | #41/#46 | P0 | Map active room into Today. | Room join/share state appears without duplicating full Co-working tab. |
| P3-W1-T008 | #41/#43 | P0 | Map Clio runtime state into Today. | Runtime status, suggestions, and degraded state are visible. |
| P3-W1-T009 | #41/#44 | P1 | Map Temperance suggestions into Today. | Recommended skills/work packets appear as safe compact suggestions. |
| P3-W2-T010 | #41/#50 | P0 | Build Today hero command panel. | Active/idle states share a stable primary work panel. |
| P3-W2-T011 | #41 | P0 | Consolidate timer controls into CommandDock. | Start, pause, resume, stop remain visible and keyboard reachable. |
| P3-W2-T012 | #41/#45 | P0 | Add today proof ledger. | Recent entries show project, duration, evidence status, and next action. |
| P3-W2-T013 | #41/#43 | P0 | Add Clio suggestion rail. | Suggestions show type, route, risk, confidence, and action. |
| P3-W2-T014 | #41/#45 | P1 | Add proof readiness banner. | Ready, missing proof, standup missing, and bridge offline states are explicit. |
| P3-W2-T015 | #41/#50 | P1 | Add project readiness strip. | Verified, needs repo, inaccessible, and unlisted states are scannable. |
| P3-W2-T016 | #41/#45 | P1 | Add task-to-work-record association UI. | User can associate current session/manual entry with assigned task. |
| P3-W2-T017 | #41/#43 | P1 | Wire sidechat launch intent from Today. | "Review today" opens bounded Today context in Clio sidechat. |
| P3-W2-T018 | #41/#45 | P1 | Add prepare-founder-update action. | Action generates queued daily proof event after confirmation. |
| P3-W2-T019 | #41/#50 | P1 | Add Today empty state. | No entries/no verified projects gives one clear next action. |
| P3-W2-T020 | #41/#50 | P1 | Add Today degraded states. | Worker, assistant, project sync, and proof failures degrade independently. |
| P3-W3-T021 | #41 | P1 | Add Clio Today copy guards. | Tests reject old generic Focus-first command-center language. |
| P3-W3-T022 | #41/#50 | P1 | Add long-text overflow fixtures. | Long project/repo/task names do not overlap controls. |
| P3-W3-T023 | #41/#50 | P1 | Add Today screenshot at 1536x1024. | First viewport shows assignment, room, timer/proof, Clio, and report status. |
| P3-W3-T024 | #41/#50 | P1 | Add Today screenshot at 1040x700. | Action dock wraps cleanly and key work state remains usable. |
| P3-W3-T025 | #41/#43 | P1 | Add model-unconfigured Today screenshot. | Assistant degraded state is useful and non-blocking. |
| P3-W3-T026 | #41/#45 | P1 | Add missing-proof Today screenshot. | Evidence gap is visible and actionable. |
| P3-W3-T027 | #41/#50 | P2 | Add Today viewport trace layer. | Activity/proof trace does not reduce legibility. |
| P3-W3-T028 | #41 | P0 | Sync Today slice into #41. | #41 has selected P3 checklist and screenshot gates. |

## P4 - Founder Proof Cockpit

Primary issues: #42, #45, #46, #48, #50
Outcome: founder/admin sees work proof first, diagnostics second.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P4-W1-T001 | #42 | P0 | Create admin proof cockpit route decision. | Founder/admin launch route resolves to proof cockpit. |
| P4-W1-T002 | #42 | P0 | Define six-signal data contract. | Tasks/evidence, active rooms, blockers, reports, bridge health, and release health are typed. |
| P4-W1-T003 | #42/#45 | P0 | Create admin proof aggregate model. | Model derives project proof groups, identities, role, reports, blockers, and actions. |
| P4-W1-T004 | #42/#45 | P0 | Add task/evidence signal. | Admin sees assigned, active, blocked, done, verified, weak, and missing proof counts. |
| P4-W1-T005 | #42/#46 | P0 | Add active-room signal. | Admin sees active rooms, participant counts, and room health without full Co-working tab. |
| P4-W1-T006 | #42/#45 | P0 | Add reports-today signal. | Submitted, queued, failed, and missing daily proof packets are visible. |
| P4-W1-T007 | #42/#45 | P0 | Add bridge/Fabric/Hermes health signal. | Connected, degraded, manual, and offline states are explicit. |
| P4-W1-T008 | #42/#48 | P0 | Add release/CI/ops health signal. | Green/red/unknown release gate state appears with timestamp/source. |
| P4-W2-T009 | #42/#50 | P0 | Recompose Admin overview as proof cockpit. | First viewport shows proof coverage and action queue before raw diagnostics. |
| P4-W2-T010 | #42/#50 | P0 | Add workspace coverage map. | Verified, needs repo, inaccessible, and missing-proof proportions are visible. |
| P4-W2-T011 | #42/#50 | P0 | Add project proof group rails. | Projects group under verified, needs repo, inaccessible, and missing proof. |
| P4-W2-T012 | #42 | P0 | Upgrade identity ledger. | Rows show role, onboarding ratio, setup state, proof state, and test affordance. |
| P4-W2-T013 | #42 | P0 | Redesign employee setup inspector. | Selected employee shows required/optional steps and last update without clutter. |
| P4-W2-T014 | #42 | P0 | Add persistent admin test-mode banner. | Testing-as-employee cannot be mistaken for live employee session. |
| P4-W2-T015 | #42/#45 | P1 | Add Fabric/task proof queue preview. | Admin sees task proof state without opening dense Fabric page first. |
| P4-W2-T016 | #42/#48 | P1 | Add ops/release drill-through actions. | Admin can open release docs, CI evidence, and issue hub from cockpit. |
| P4-W2-T017 | #42 | P1 | Move raw diagnostics behind drawer/subtab. | Raw payloads do not dominate the first viewport. |
| P4-W2-T018 | #42 | P1 | Add role-aware admin access state. | Non-admin cannot render cockpit or call admin IPC. |
| P4-W3-T019 | #42 | P1 | Add proof cockpit copy guards. | Tests assert proof cockpit language and reject diagnostics-first headings. |
| P4-W3-T020 | #42/#50 | P1 | Add admin screenshot at 1536x1024. | All six signals fit above fold without diagnostics dominating. |
| P4-W3-T021 | #42/#50 | P1 | Add admin screenshot at 1280x800 with long emails. | Identity rows truncate or wrap predictably. |
| P4-W3-T022 | #42/#45 | P1 | Add blocker-report fixture. | Cockpit shows top blocker and next action within five seconds. |
| P4-W3-T023 | #42 | P2 | Add cockpit export/read-only snapshot affordance. | Admin can move to Reports/Export with preserved context. |
| P4-W3-T024 | #42 | P0 | Sync proof cockpit slice into #42. | #42 has selected P4 checklist and screenshot gates. |

## P5 - Co-working Room

Primary issues: #46, #22, #23, #24, #26
Outcome: co-working becomes a visible work room with honest media/proof states.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P5-W1-T001 | #46 | P0 | Extract co-working stage components. | Floor, rail, stage, wall, lounge, controls, and closeout have focused files. |
| P5-W1-T002 | #46 | P0 | Extend focused stage model with participants. | Stage tiles include room participants even without screen shares. |
| P5-W1-T003 | #46 | P0 | Preserve focus-only project selection. | Changing focused project never joins, publishes, or records. |
| P5-W1-T004 | #46 | P0 | Redesign floor as presence map. | Presence tiles show ring state, project tag, speaking state, and activation. |
| P5-W1-T005 | #46 | P0 | Build Meet-like focused project stage. | Empty, participant-only, wall, and pinned modes render with stable height. |
| P5-W1-T006 | #46 | P0 | Implement fullscreen stage shell. | Leave, closeout, media controls, people, and scrollable wall remain visible. |
| P5-W1-T007 | #46 | P0 | Redesign lounge as persistent ambient layer. | Lounge strip shows users, privacy chips, audio priority, and device controls. |
| P5-W1-T008 | #46 | P1 | Add project media control honesty. | Controls are visible, gated, and explicit when transport is deferred. |
| P5-W1-T009 | #46/#23 | P1 | Add recording consent shell. | Recording is project-scoped, explicit, and never appears as lounge default. |
| P5-W1-T010 | #46 | P1 | Add independent degraded states. | Floor, room detail, device, lounge, and transport errors render separately. |
| P5-W1-T011 | #46 | P1 | Add participant/wall/pin model tests. | Tests cover participants, pin cleanup, lounge priority, and no auto-join. |
| P5-W1-T012 | #46 | P2 | Polish co-working responsive layout. | 1040x700 and 1366x768 preserve floor, stage, and lounge without overlap. |
| P5-W2-T013 | #26 | P0 | Reconfirm SFU live transport acceptance. | True live proof and polished degraded fallback are separately defined. |
| P5-W2-T014 | #26 | P0 | Wire remote track subscription plan. | Remote mic/camera/screen tracks can map to focused room participants. |
| P5-W2-T015 | #26 | P0 | Add media provider health state. | SFU connected, degraded, simulated, and unavailable states are explicit. |
| P5-W2-T016 | #26 | P1 | Add screen wall live/pinned/fullscreen behavior. | Live screen tracks display, pin, unpin, and fullscreen reliably. |
| P5-W2-T017 | #23 | P0 | Add privacy/permission audit states. | Mic, camera, screen, recording, and captions permissions are visible. |
| P5-W2-T018 | #23 | P1 | Add room audit event plan. | Join, leave, media toggle, recording request, and closeout events are auditable. |
| P5-W2-T019 | #45/#46 | P1 | Add co-working proof closeout link. | Room closeout can create report/evidence draft without hidden side effects. |
| P5-W2-T020 | #22 | P1 | Feed non-transcript meeting memory into context. | Meeting memory summary is bounded, consent-based, and not raw transcript. |
| P5-W2-T021 | #24 | P1 | Add two-participant simulation regression. | Local/simulated test proves join/share/closeout without live credentials. |
| P5-W2-T022 | #25 | P2 | Keep transcription deferred unless reopened. | Transcription remains documented as deferred, not a hidden dependency. |
| P5-W3-T023 | #46/#50 | P1 | Add co-working screenshot at 1536x1024. | Floor, selected project, stage, and lounge read as one surface. |
| P5-W3-T024 | #46/#50 | P1 | Add co-working screenshot at 1366x768 pinned screen. | Fullscreen keeps leave, closeout, and controls visible. |
| P5-W3-T025 | #46/#23 | P1 | Add permission-denied screenshot. | Denied mic/camera/screen state is explicit and recoverable. |
| P5-W3-T026 | #46/#26 | P1 | Add SFU-unavailable screenshot. | Degraded transport state still feels intentional and useful. |
| P5-W3-T027 | #24 | P0 | Add co-working regression pack gate. | Model, UI, and smoke tests run in `test:coworking`. |
| P5-W3-T028 | #46/#45 | P1 | Add room closeout proof fixture. | Fixture covers room work -> closeout -> report/evidence status. |
| P5-W3-T029 | #46 | P0 | Sync co-working slice into #46. | #46 has selected P5 checklist and child issue mapping. |
| P5-W3-T030 | #24 | P1 | Record remaining live proof blockers. | Live SFU gaps are documented separately from local visual proof. |

## P6 - Temperance Dispatch

Primary issues: #44, #43, #41, #45
Outcome: skill hints and parallel handoffs become safe, typed workflows.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P6-W1-T001 | #44 | P0 | Define dispatch event schema. | Assignment, mode, status, evidence, and conflict events are typed. |
| P6-W1-T002 | #44/#45 | P0 | Normalize Fabric task storage dependency. | Dispatch can query task records rather than opaque settings JSON. |
| P6-W1-T003 | #44 | P0 | Add directive replay/idempotency tests. | Duplicate directives append once and conflicts report upstream. |
| P6-W1-T004 | #44 | P0 | Add dispatch lane status API. | Renderer can list assigned, delegated, blocked, and done lanes. |
| P6-W1-T005 | #44 | P0 | Parse `skillHints` safely. | Unknown hints preserve metadata but never execute directly. |
| P6-W1-T006 | #44 | P0 | Add generic tool harness runner plan. | Tool runs share permission, audit, timeout, and redaction invariants. |
| P6-W1-T007 | #44 | P0 | Add parallel-agent handoff record type. | Parent task links child sessions, owners, evidence, and status. |
| P6-W2-T008 | #44/#43 | P1 | Rank skill recommendations from task/session themes. | Engineering, design, docs, and test suggestions are deterministic. |
| P6-W2-T009 | #44/#41 | P1 | Surface recommendations in Clio Today. | Today shows bounded skill name, rationale, confidence, and action. |
| P6-W2-T010 | #44/#43 | P1 | Surface recommendations in Clio context drawer. | Clio sees recommendation records without raw skill file dumps. |
| P6-W2-T011 | #44 | P1 | Add lane diagnostics panel. | Task counts, conflicts, last sync, and retry state are visible. |
| P6-W2-T012 | #44/#43 | P0 | Add tool harness contract tests. | Read-only, write, and admin tools share invariant coverage. |
| P6-W2-T013 | #44/#43 | P1 | Add failure-kind taxonomy. | Auth, quota, network, validation, conflict, and user-cancel are classified. |
| P6-W2-T014 | #44/#45 | P0 | Link agent session candidates to dispatch tasks. | Accepted session can attach to task/lane evidence. |
| P6-W2-T015 | #44/#45 | P1 | Add delegated-work completion proof requirements. | Done requires evidence or explicit weak-evidence note. |
| P6-W3-T016 | #44 | P1 | Add delegated-mode conflict UI. | User sees override reason and locked mode state. |
| P6-W3-T017 | #44/#43 | P0 | Add dispatch/assistant correlation IDs. | Intent, tool audit, directive, and handoff share trace IDs. |
| P6-W3-T018 | #44/#48 | P1 | Add redacted runtime support packet. | Export includes state but no secrets or raw transcripts. |
| P6-W3-T019 | #44/#45 | P0 | Add local dispatch smoke. | Mock directive -> task -> mode -> report -> audit passes. |
| P6-W3-T020 | #44 | P0 | Sync dispatch slice into #44. | #44 has selected P6 checklist and safety boundaries. |

## P7 - Design-System Parity

Primary issues: #50, #41, #42, #46
Outcome: product-critical surfaces match the reference sheet.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P7-W1-T001 | #50 | P0 | Audit shared viewport primitives. | Every target page maps to the design sheet primitives. |
| P7-W1-T002 | #50 | P0 | Standardize PageHeader right-slot wrapping. | Header actions wrap before clipping at target widths. |
| P7-W1-T003 | #50 | P0 | Harden CommandDock density and hit areas. | Buttons stay visible, disabled, and at least 40px hit area. |
| P7-W1-T004 | #50 | P0 | Add shared overflow text affordance. | Long repo/email/URL/task strings never spill over action slots. |
| P7-W1-T005 | #50 | P0 | Complete StatusChip matrix. | Verified, connected, matched, pending, needs repo, inaccessible, offline, warning, error, and idle render consistently. |
| P7-W1-T006 | #50 | P0 | Normalize MetricRail sizing. | Numeric rails use tabular mono and no jitter. |
| P7-W1-T007 | #50 | P0 | Normalize LedgerRail column contract. | Main text stays readable and action slot remains stable. |
| P7-W1-T008 | #50 | P0 | Replace priority-lane ad hoc layouts. | #41, #42, and #46 use named classes for grids, docks, and rails. |
| P7-W2-T009 | #50 | P1 | Add EmptyStatePanel variants. | No records, no rooms, no backups, and no tasks states are designed. |
| P7-W2-T010 | #50 | P1 | Add DegradedStatePanel variants. | Offline, sync failed, repo missing, and proof inaccessible are distinct. |
| P7-W2-T011 | #50 | P1 | Rework viewport breakpoints. | 1040x700, 1280x800, 1536x1024, and sidechat layouts do not overlap. |
| P7-W2-T012 | #50 | P1 | Add screenshot fixture harness. | Script captures repeatable screenshots for key surfaces. |
| P7-W2-T013 | #50/#41 | P1 | Polish Clio Today visual density. | Today feels dense but readable and not hero/marketing sized. |
| P7-W2-T014 | #50/#42 | P1 | Polish proof cockpit visual density. | Admin cockpit shows proof first and diagnostics second. |
| P7-W2-T015 | #50/#46 | P1 | Polish co-working social floor. | Room reads as active digital workspace, not disconnected boxes. |
| P7-W2-T016 | #50/#43 | P1 | Polish Clio sidechat and full panel behavior. | Sidechat does not squeeze or hide primary page content. |
| P7-W2-T017 | #50/#45 | P1 | Polish reports/evidence states. | Missing, weak, verified, and rejected proof are scannable. |
| P7-W2-T018 | #50 | P1 | Add rose-tone audit. | Rose appears only for true failure, denial, or destructive confirmation. |
| P7-W3-T019 | #50 | P1 | Capture Today screenshot matrix. | Idle/running, long text, degraded assistant, and missing proof images exist. |
| P7-W3-T020 | #50 | P1 | Capture proof cockpit screenshot matrix. | Admin overview, long identities, degraded health, and blocker states exist. |
| P7-W3-T021 | #50 | P1 | Capture co-working screenshot matrix. | Floor/stage/lounge, pinned/fullscreen, permission denied, and SFU degraded exist. |
| P7-W3-T022 | #50 | P1 | Capture Clio and assistant screenshot matrix. | Full panel, sidechat, confirm modal, and context drawer are documented. |
| P7-W3-T023 | #50 | P1 | Run accessibility pass. | Keyboard, focus rings, reduced motion, and contrast are checked. |
| P7-W3-T024 | #50 | P0 | Sync design-system slice into #50. | #50 has selected P7 checklist and screenshot QA matrix. |

## P8 - Hardening + Release Workflow

Primary issues: #47, #48
Outcome: release candidate gates are real and repeatable.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P8-W1-T001 | #47 | P0 | Upgrade Electron or record deferral. | Supported-major decision is implemented or explicitly deferred with risk. |
| P8-W1-T002 | #47 | P0 | Rebuild native modules after Electron decision. | `sqlite3` loads in main build and packaged app. |
| P8-W1-T003 | #47 | P0 | Harden Access login BrowserWindow. | Popup, navigation, sandbox, Node, and permissions are locked down. |
| P8-W1-T004 | #47 | P0 | Add central permission policy. | Media permissions are explicit and login window cannot request arbitrary permissions. |
| P8-W1-T005 | #47 | P0 | Add central IPC sender-origin guard. | Sensitive IPC rejects non-app sender origins. |
| P8-W1-T006 | #47 | P0 | Add IPC payload schemas. | Auth, settings, worker, bridge, project, entry, report, evidence, realtime, and media inputs validate. |
| P8-W1-T007 | #47 | P0 | Move Access JWT to safeStorage. | Plaintext row is migrated or cleared and logout clears custody. |
| P8-W1-T008 | #47 | P0 | Encrypt or replace local API token storage. | API token is not plaintext and never printed. |
| P8-W1-T009 | #47 | P0 | Add secret inventory regression test. | No raw JWT, API key, or bridge token appears in settings/log/renderer output. |
| P8-W1-T010 | #47 | P0 | Harden backup restore. | Restore is backup-dir bounded and DB handle lifecycle is safe. |
| P8-W2-T011 | #47 | P0 | Configure Electron fuses. | RunAsNode, NodeOptions, inspect, ASAR, and integrity posture match policy. |
| P8-W2-T012 | #47 | P0 | Add packaged fuse verification command. | CI/release can fail on fuse mismatch. |
| P8-W2-T013 | #47 | P1 | Add renderer CSP/load-policy checks. | Packaged renderer has no remote script drift. |
| P8-W2-T014 | #47 | P1 | Add dependency/security audit gate. | High/critical runtime vulnerabilities block release or are waived explicitly. |
| P8-W2-T015 | #47 | P1 | Add shared redaction utility. | Authorization, cookie, JWT, signature, and token-like keys redact recursively. |
| P8-W2-T016 | #47 | P1 | Add crash/exception observability bootstrap. | Uncaught exceptions, rejections, and renderer crashes are captured redacted. |
| P8-W2-T017 | #47 | P1 | Define crashReporter policy. | Local-only or opt-in crash metadata posture is documented. |
| P8-W2-T018 | #47 | P1 | Add renderer console/error forwarding policy. | Renderer errors are bounded and redacted in main logs. |
| P8-W2-T019 | #47 | P1 | Add local API request validation. | Bad dates/project IDs return 400 and do not trigger broad scans. |
| P8-W3-T020 | #48 | P0 | Implement aggregate test commands. | `test:all` and `verify:all` exist and run focused suites. |
| P8-W3-T021 | #48 | P0 | Wire Vitest suites into CI. | CI includes assistant, co-working, and identity tests. |
| P8-W3-T022 | #48 | P0 | Add tests before release signing. | Release workflow runs tests before signed build. |
| P8-W3-T023 | #48 | P0 | Fold verify-all into release prep. | Release prep blocks on required local gates. |
| P8-W3-T024 | #48 | P1 | Add `smoke:all` command. | Existing deterministic smokes run through one command. |
| P8-W3-T025 | #48 | P1 | Refresh README/ROADMAP/OTA/HANDOFF. | Docs match current assistant, co-working, security, and release posture. |
| P8-W3-T026 | #48 | P0 | Decide PR #40 and #34 paths. | Merge, rebase, supersede, or close decisions are recorded. |
| P8-W3-T027 | #47/#48 | P0 | Sync hardening/workflow slice into #47/#48. | GitHub comments capture P8 gate list and no-tag rule. |

## P9 - Integration + Closeout

Primary issues: #49, #48, all
Outcome: roadmap execution has proof, docs, and release handoff.

| ID | Issue | Pri | Task | Done when |
|---|---|---:|---|---|
| P9-W1-T001 | #49 | P0 | Run golden-path UAT script. | Employee-to-founder flow is tested end to end with proof notes. |
| P9-W1-T002 | #41/#42 | P0 | Verify role-aware launch. | Employee starts in Today; founder/admin starts in proof cockpit. |
| P9-W1-T003 | #43/#45 | P0 | Verify Clio proof action loop. | Assistant can prepare a proof/report action through confirmed intent. |
| P9-W1-T004 | #44/#45 | P1 | Verify dispatch handoff loop. | Recommendation -> confirmed packet -> result/evidence ingestion is proven or degraded. |
| P9-W1-T005 | #46/#45 | P1 | Verify co-working closeout loop. | Room work can produce report/evidence state or documented degraded status. |
| P9-W1-T006 | #47/#48 | P0 | Verify security/release gate. | `verify:all` or equivalent gate passes before production-readiness claim. |
| P9-W2-T007 | #48 | P1 | Update roadmap docs. | `docs/ROADMAP.md` reflects #41-#50 and current production push. |
| P9-W2-T008 | #48 | P1 | Update architecture docs. | Services inventory names Worker, bridge, model providers, OTA, and optional helpers. |
| P9-W2-T009 | #48 | P1 | Update release docs. | OTA/signing/release checklist reflects current gates. |
| P9-W2-T010 | #48 | P1 | Update handoff docs. | Handoff names completed gates, remaining blockers, and next PR/release step. |
| P9-W2-T011 | #48 | P1 | Create evidence README for release candidate. | Screenshots, smokes, logs, and live/degraded proof are indexed. |
| P9-W2-T012 | #49 | P1 | Create deferred register. | #25 and any live-proof blockers are documented as deferred, not forgotten. |
| P9-W3-T013 | #49 | P0 | Sync final status to #49. | #49 comment summarizes phase completion and remaining approvals. |
| P9-W3-T014 | #41-#50 | P1 | Sync selected task chunks to epics. | Each epic has a concise task slice comment or updated checklist. |
| P9-W3-T015 | #48 | P1 | Update labels/milestones/status. | GitHub status reflects planned/in-progress/blocked/verifying/done accurately. |
| P9-W3-T016 | #48 | P0 | Confirm no local unrelated changes were disturbed. | Git status is reported; unrelated dirty files are preserved. |
| P9-W3-T017 | #49 | P0 | Produce release candidate recommendation. | Go, no-go, or go-with-degraded-live-proof is stated clearly. |
| P9-W3-T018 | #49 | P0 | Close planning expansion loop. | This doc, GitHub sync, and next execution packet are complete. |

## Verification Commands To Ratify During Execution

Current repo scripts already include:

```bash
npm run lint
npm run typecheck
npm run build:main
npm run build:preload
npm run build:renderer
npm run test:assistant
npm run test:coworking
npm run test:identity
npm run smoke:assistant-context
npm run smoke:assistant-models
npm run smoke:assistant-daily
npm run smoke:thoughtseed-bridge
npm run smoke:main-imports
npm run smoke:admin-fabric-paperclip
npm run release:scan-placeholders
npm run release:dry-run
```

Workflow hardening should add or ratify:

```bash
npm run test:all
npm run smoke:all
npm run verify:all
npm run verify:fuses
npm run verify:security
```

## GitHub Epic Sync Targets

| Issue | Sync content |
|---|---|
| #41 | P3 selected tasks for Clio Today and role-aware employee launch. |
| #42 | P4 selected tasks for founder/admin proof cockpit and six-signal first viewport. |
| #43 | P2 selected tasks for Clio runtime, tool loop, daily event, intent/audit, and assistant smokes. |
| #44 | P6 selected tasks for Temperance dispatch, skill recommendations, tool harness, and handoff proof. |
| #45 | P2/P3/P4 selected tasks for bridge/evidence/report workflow and employee-to-founder proof. |
| #46 | P5 selected tasks for co-working room visual/workflow redesign and realtime child issue mapping. |
| #47 | P1/P8 selected tasks for Electron/security/IPC/token/log/fuse hardening. |
| #48 | P0/P1/P8/P9 selected tasks for CI, release, docs, PR disposition, and issue workflow parity. |
| #50 | P7 selected tasks for design-system parity and screenshot QA. |
| #49 | Phase index, task count, and durable-doc pointer. |

## No-Tag Release Rule

Do not tag or claim production-ready until these P0 groups are either green or explicitly deferred with owner approval:

- Clio Today first viewport: P3 P0 tasks.
- Founder/admin proof cockpit first viewport: P4 P0 tasks.
- Assistant tool loop and intent/audit: P2 P0 tasks.
- Bridge/evidence custody and proof workflow: P2 P0 tasks.
- Co-working room stage and proof closeout: P5 P0 tasks.
- Electron/token/IPC/security gates: P1/P8 P0 tasks.
- CI/release parity: P1/P8 P0 tasks.
- Design-system screenshot QA for critical surfaces: P7 P0/P1 tasks.
