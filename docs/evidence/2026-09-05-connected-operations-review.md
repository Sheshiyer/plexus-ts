# Plexus connected-operations planning review — 2026-09-05

## Review scope

Compared the user-named company growth maps, canonical system-of-record notes,
current Plexus acceptance and desktop source, Cambium identity gate, and the
local Hermes relay/reporting source. The durable next-work packet is
[P7 connected operations](../../.planning/phases/P7-connected-operations.md).
This is a planning/source review, not deployed integration acceptance.

Reviewed Plexus base: `5db1ec75a31337876ab900188d846303f2bd7cd9` (pushed branch
`codex/labs-migration-preflight-20260905`, v0.7.12 application source).
Vault HEAD and freshly queried origin/main: `2a06f92a8a6dcadfc3f5ff42fd5f5aa595ac23b6`.
Cambium checkout HEAD: `746acf814b4ffce1a6ccef295ba1f4b0a09760b6`, with unrelated
working changes. The sibling Hermes/Worker source was inspected as local source;
no deployed revision was established. No connected repository was edited.

Paths below use `Plexus`, `Vault`, `Hermes`, or `Cambium` as repository/source-root
labels. SHA-256 source fingerprints are in
[the source inventory](2026-09-05-connected-operations-sources.json).

## Intent versus implementation

| Finding | Evidence anchor | Implication |
| --- | --- | --- |
| Plexus owns more than timer/Clio/release | Vault `00-meta/system-of-records.md:53` through human-ops/identity rows | Tasks, sprints, capacity, leave, holidays and team signal must have acceptance |
| Organs are bounded means | Vault `20-operations/growth/department/cambium-temperance-organ-atlas.md:28`, `:48` | Five Cambium organs, six Temperance organs, support surfaces and D1 authority remain distinct |
| Broader Clio operator promise exceeds verified tool surface | Vault `00-meta/inference-bindings.md:51`; Plexus `src/main/assistant-runtime.ts:156` | Admit mapping/parity/admin tools individually; keep unavailable capabilities truthful |
| Access and bridge identity are independent | Plexus `src/main/teamforge.ts:811`; `src/main/thoughtseed-bridge.ts:664`; `src/main/main.ts:2905` | Logout/account switch must not retain another actor's write authority; bind identity namespaces server-side |
| Inactive/session refresh needs explicit handling | Plexus `src/shared/types.ts:483`; `src/main/teamforge.ts:663`, `:805`, `:1493` | Cached roles are not current employment or project permission proof |
| Cache existence is called canonical mapping | Plexus `src/main/vault-projects.ts:249`, `:295`; `src/main/teamforge.ts:582`, `:829` | Distinguish fallback summaries, stale/revoked cache, and currently authorized mappings |
| Local IDs are not Worker admission | Plexus `src/main/main.ts:2097`; `src/renderer/components/ProjectManager.tsx:410` | A locally created UUID must not be promoted into a canonical project |
| Client identity/provenance is dropped | Plexus `src/shared/types.ts:107`; `src/db/database.ts:115`; `src/main/teamforge.ts:829` | Preserve canonical client/workspace identity and mapping provenance |
| WorkObject admission is another boundary | Vault `00-meta/vault-teamforge-mapping-contract.md:55`; Plexus `src/shared/thoughtseed-fabric-task.ts:202` | Copying project/client/quest IDs is not Cambium admission proof |
| Clio relay pins old Access issuer | Hermes `src/clio-omniroute-relay.ts:25`, `:159`, `:302` | A Labs-only issuer change requires coordinated code/config/tests; no environment-only fix |
| Model catalog remains te-* | Plexus `src/shared/native-assistant.ts:222`; Hermes `src/clio-omniroute-relay.ts:28` | Version desktop/relay/upstream compatibility independently of Mac noesis-* routing |
| Daily aggregation uses capped model context | Plexus `src/main/assistant-context.ts:440`, `:443`, `:459`; `src/main/assistant-daily.ts:163`, `:266` | A day with over 50 records can have totals inconsistent with uncapped evidence |
| GitHub proof exists locally but report carries summaries | Plexus `src/main/teamforge.ts:1350`; `src/main/github-ci-evidence.ts:34`; `src/main/assistant-daily.ts:266` | Carry bounded artifact references and revision/custody, not just counts |
| Bridge sent does not prove founder receipt | Plexus `src/main/thoughtseed-bridge.ts:302`, `:563`; `src/main/assistant-daily.ts:483`; `src/main/teamforge.ts:546` | Correlate ingestion, projection, orchestration and destination status |
| Monthly activation/consumer incomplete across owners | Plexus `src/main/review-cycle.ts:167`, `:187`, `:284`; no matching executable member_review_activation/member_review_cycle in audited Hermes src/ops/hermes | Implement or locate canonical producer/consumer, verify closed-month/offline-member behavior |
| Hermes defaults need multi-member proof | Hermes `ops/hermes/thoughtseed-routine-context.py:97`; `ops/hermes/plugins/thoughtseed-telegram/ts_commands.py:217` | Existing default tenant/member is not company-wide aggregation evidence |
| Task APIs have no complete employee task UI | Plexus `src/main/thoughtseed-bridge.ts:794`, `:904`, `:969`; `src/renderer/components/Timer.tsx:224` | Assignment summary is not an assignment-to-completion workflow |
| Capacity/leave/calendar absent from inspected desktop | Plexus `src/renderer/App.tsx:34`; `src/shared/types.ts:107`; `src/db/database.ts:115` | Native implementation work is needed, not only a credential refresh |
| Media wiring is enabled | Plexus `src/renderer/components/CoWorkingPanel.tsx:78`, `:486`; `src/renderer/lib/useRealtimeMedia.ts:453` | Do not repeat the old disabled-scaffold claim; live SFU is separately unaccepted |
| Closeout/recording promises exceed inspected implementation | [Runtime map](../architecture/RUNTIME_MAP.md) | Queue receipt is not Hermes delivery; preload declarations are not recording handlers |

## Vault visibility and drift

Seven requested existing maps are tracked and clean at the same local/remote
vault HEAD. The old statement that the whole department awaits commit/push is
therefore stale. The organ atlas is untracked, as are the capability-hit design
files; those additions are not present in the checked shared Git contract.
Remote equality does not prove EC2 has pulled the same head.

The whitepaper enrollment JSON lists Cambium only; it cannot establish executable
Plexus enrollment. The capability-hit system explicitly remains design-only and
disabled. Growth is outside current Bridge A write zones. Old NO_GIT statements
in the execution plan conflict with the later remount note and must be rechecked
against the owning checkout rather than blindly rerun.

Labs Worker Access and Clio's old relay issuer are different surfaces. This review
does not declare the latter migrated, nor recommend reverting the Worker. Any
relay account migration must preserve exact origins, membership verification and
consumer compatibility. The same distinction applies to te-* and noesis-* lanes.

## Verification and acceptance disposition

- Three independent, read-only reviewers covered growth authority, Clio/reporting,
  and human-ops/mapping source. Parent reconciled their findings and checked the
  relay issuer directly after correcting an initial overbroad migration inference.
- Fresh `node --test workers/quests/src/plexus-gate.test.ts` in Cambium passes
  **18/18**: role normalization, denied/inactive identities, invalid JWTs and cache
  binding. Fixtures do not prove deployment or live inactive-member propagation.
- Existing Plexus tests were inspected for daily fallback/outbox, monthly retry,
  CI custody, task ownership, route restriction, vault rejection and media wiring;
  no new application behavior or full application test pass is claimed.
- GitHub read-only issue inventory returned #23, #26 and #147. No issue was
  opened/closed and no merge was performed. #147's fix is on the pushed branch.
- ISA retains all 22 pre-existing open criteria. New ISC-271–300 are **pending
  operational acceptance**, not implementation completed by writing this plan.
  ISC-301–304 cover this review's map, evidence, ordering and retained scope.
- The external advisor attempt failed with an expired OAuth session. No advisor
  opinion or resolved external provider is claimed; independent local reviews
  supplied the available second-opinion evidence.

No credentials, production services, GitHub state, vault files, host routing or
connected repository source were changed. Docs verification and source-fingerprint
checks validate the planning packet, not the target system's runtime behavior.
