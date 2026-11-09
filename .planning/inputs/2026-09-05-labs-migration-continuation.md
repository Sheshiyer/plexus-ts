# September 5 migration continuation

## Current checkpoint — September 12 repository recovery

Planning checkpoint `f3255cb02c7637f0a7ed0c6bf088c3e3b6cb1396` is pushed on
`codex/plexus-local-acceptance-20260912` in
`/Volumes/madara/2026/Projects/thoughtseed/.worktrees/plexus-local-acceptance-20260912`.
Use its ISA and planning; original root WIP remains preserved.

Root cause reproduced with Computer: Labs D1 saves verified repositories, but
current deployed mapping GET omits that proof. Old desktop sync reduced ready
projects from four to two of twenty while D1 retained four bindings. The user's
Airdronauts choice remains Sheshiyer/skyline-viewer-ashwin-sheth-group. Detailed
client crosswalk and final D1/visual receipts are private under
`~/Library/Application Support/Plexus-Acceptance-20260912/evidence`.

Paired source candidates are committed/pushed, draft and unmerged:
- Worker `bcc11669446f188a5c3a7161cc1ee20ba7a9bede`, https://github.com/Sheshiyer/team-forge-ts/pull/102
- Desktop `cd5e38cb8e4e5fd9570663b062baf1be68078abd`, https://github.com/Sheshiyer/plexus-ts/pull/171

Worker has 223 passing tests; desktop has 108 focused passing tests, types/lint
and independent review. Two prior source-text failures remain outside that set.
194 documents and 7 verifier tests pass. ISA 350/403, all 53 pending criteria map
exactly once. ISC-321 is on #160 for paired deployed/installed fresh-profile
recovery; all 52 prior operational criteria stay open. Issues #160/#163 updated.

Next: reconcile explicit Labs source/config/rollback, integrate paired source,
deploy/install the matching candidate and test restoration plus repeated sync.
Canonical Worker main defaults to legacy D1; the local non-Git sibling is
incomplete. Do not deploy either by inference. Current installed app is still
the earlier ad-hoc v0.7.12; this source fix was not deployed or installed.
Broader mapping expiry/revocation, account-switch/queued actor guards, Clio
sign_in_required and P6 signed migration remain open. No activity was created.

The Luna high source/asset review is complete and saved locally; it inspected
32 images. Its visual states are design proposals, not authority or live proof.
Receipt: https://github.com/Sheshiyer/plexus-ts/blob/f3255cb02c7637f0a7ed0c6bf088c3e3b6cb1396/docs/evidence/2026-09-12-repository-binding-recovery.md

## Earlier September 12 checkpoint — local installed acceptance

Commit `83911f977336b1a455699e537d5e4680b12d0b45` is pushed on `codex/plexus-local-acceptance-20260912`.
Persistent worktree: `/Volumes/madara/2026/Projects/thoughtseed/.worktrees/plexus-local-acceptance-20260912`. The earlier September 5 temporary worktrees are
no longer present; their pushed commits remain available. Use this persistent
worktree's ISA and planning. Original root WIP remains preserved.

Local ad-hoc v0.7.12 Labs login, primary views and isolated session relaunch pass.
Installed path: `~/Applications/Plexus.app`. Recovery is under
`~/Library/Application Support/Plexus-Recovery/20260912`. The running validation
profile has a fresh work database; original work-database upgrade is unproven.
ISA is 345/397, with all 52 prior operational criteria still open. Clio remains
sign_in_required, 20 projects need repository proof, and P7 current authority,
revocation/queued actor binding plus P6 signed OTA migration remain pending.
Exact receipt: `https://github.com/Sheshiyer/plexus-ts/blob/83911f977336b1a455699e537d5e4680b12d0b45/docs/evidence/2026-09-12-local-installed-acceptance.md`.

## Historical September 5 checkpoint — P7 source foundations

Plexus `cf8b71cb5095418cb0fded8cd53ec8ea48f3535f` and Cambium
`1ee87a597ca87d92a81ddcd1c8837fd20cf74a8e` are committed and pushed on their isolated
branches. Plexus worktree remains `/private/tmp/plexus-labs-migration-20260905`;
Cambium is `/private/tmp/cambium-plexus-p7-20260905` on
`codex/plexus-admission-contract-20260905`. Both review worktrees are clean.

P7 is current source work; P6 migration acceptance stays open. Start at the
Plexus branch's `.planning/P7-identity-continuation.md`, `NEXT-WAVE.json` and
`docs/evidence/2026-09-05-p7-source-foundations.md`. Identity/provenance retention
passes 16 sync/SQLite tests; Cambium reference validation passes 55 tests.
Type checks and scoped lint pass; 192 documents verify, 7 doc tests pass.
Two pre-existing source-text tests in `repo-verify-retry.test.ts` still fail.

Next: canonical Worker provenance and current mapping authority contract,
removed/revoked reconciliation and consumer guards, trusted Cambium adapter and
resource-grant producer, then actor/account-switch integration. Graph-reference
success and retained fields grant no execution authority. ISA remains 337/389;
no operational criterion closed. Main integration, deployment, credentials,
App/installed acceptance and all P6 live gates remain pending.

Project 17 P7 epic #149, mapping #160 and Cambium #371 are In Progress; Cambium
is Review pending. Its Project 14 item also reads In Progress. Original Plexus
and Cambium checkout WIP inventories and hashes are preserved. Historical
entries below are dated snapshots, not the current active phase.

## Prior checkpoints

Reviewed source: origin/main e8d3a74 (v0.7.12).
Completed local branch: codex/labs-migration-preflight-20260905.
Commits: ddeb49d (cleanup), 9334ecc808d8ce2a09fcead784bd89cf7fc83f83 (migration planning/evidence), 5db1ec7 (repository documentation cleanup and drift checks).
Worktree: /private/tmp/plexus-labs-migration-20260905

Use that branch's ISA.md, .planning/STATE.md and P6 plan for current acceptance.
The root code/ISA/README/architecture files remain byte-for-byte preserved WIP.
Root's older ISA and P5 snapshot therefore intentionally do not carry these
new checkmarks; do not execute their obsolete secret-first next-wave blindly.

Historical criteria: 313/327 checked after ten exact evidence-backed closures.
After documentation acceptance: 329/351 checked; eight live migration criteria
and fourteen historical/external criteria remain open. ISC-263–270 cover verified
documentation maintenance; they do not close live migration gates.

Verified preparation: Labs-only protected cleanup, default dry run, retained
rollback/current versions, active-channel protection, exact keys and failure
propagation. Fifteen Node fake-AWS tests and scoped lint pass. Runbook default
matches runtime and packaging. No production or credential changes occurred.

Current blocker beyond the user-owned secrets/App/signing tasks: Labs upgrade
host has no Worker or R2 custom-domain registration, public requests fail with
Cloudflare1000, and exact DNS-record reads return403. The target manifest is
0.7.8 while installed v0.7.9–0.7.12 use the personal feed serving0.7.12.

Next: obtain exact DNS read/repair packet, refresh exact OTA-object differences,
recover and verify Labs delivery, then prepare a signed bridge newer than0.7.12
served through both old update paths. Keep the personal bridge feed for dormant
clients until a specific retirement policy is approved.

The branch commits preserve all received planning in
.planning/archive/2026-08-22-gap-snapshot. No secret values are in the receipts.
Detailed proof: docs/evidence/2026-09-05-labs-migration-review.md on that branch.

Repository documentation cleanup: 100 files changed, 179 documents cataloged,
22 focused tests pass, zero local link errors. Current navigation starts at
docs/DOCUMENTATION_MAP.md; proof is in
docs/evidence/2026-09-05-documentation-deep-pass.md. Source gaps surfaced by the
review are preserved in .planning/documentation-followups.md. The isolated
worktree is the review surface; this root retains the original user WIP.

Connected-operations review and GitHub roadmap are committed and pushed in
8e4a6354ab6165cec298fe0a81603821459271b6 on the same isolated branch.
Project17: https://github.com/users/Sheshiyer/projects/17 .
Seven phase epics (Plexus#148–154) and twenty primary packages map all52pending
criteria exactly once; one Cambium contract support package avoids duplicated
acceptance. Hermes owns relay#156/monthly#157 on Project10; Cambium#371 is also
on Project14. Existing Realtime#23/#26 and Hermes#95/#127 were reused.

Start at .planning/GITHUB_ROADMAP.md and .planning/github-roadmap.json on that
branch; phase packets cover P6–P12. ISA337/389 (52open) records review and
publication proof, not product readiness. P6 remains active. First installed
slice: P6+P7+P8+dailyP9 -> P12; monthly, fullHR and Realtime follow separately.
Cambium contract/fixtures unblock mapping; joint integration stays ISC277.

GitHub readback verified34board items,21native subissue links, owner-board
membership, exact52criterion coverage and an acyclic dependency graph.
188documents verify with no link errors; release-policy checks pass.
The rootWIP files remain preserved. An explicit memory extension records this
continuation; old vault issues stay open as historical pointers. Main integration
and all live credential, deployment, signing/delivery acceptance remain pending.

P6 first execution is pushed in 3fa055c59e6ca3a65d202821bbc59b9a4ab07831: see the branch receipt
docs/evidence/2026-09-05-p6-first-execution.md. 181legacy/165Labs objects;82shared
keys byte-identical,82shared binary digests pending,16missing artifacts and one
manifest conflict. Eight hashed blockmaps are partial unapproved copy candidates.
164Labs objects lack explicit cache metadata. Route/DNS gate remains; no cloud
mutation occurred. Project17 P6 epic and object package are In Progress.
