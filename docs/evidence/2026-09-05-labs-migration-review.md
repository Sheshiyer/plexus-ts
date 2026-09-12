# Plexus Labs migration review — 2026-09-05

Status: **preparation and historical reconciliation; live OTA migration incomplete**.
Source reviewed: `origin/main` `e8d3a74b94b08e97549209a5c5e1e0030995bcb1`, version `0.7.12`.
Implementation branch: `codex/labs-migration-preflight-20260905`.

## Existing authority, retained

This continues the August relocation; it does not restart CF-0 through CF-5.
The cross-project records are in the sibling `hermes-aws-ts` repository:

- `docs/plans/2026-08-05-cf-account-relocation-hermes-plexus-cambium.md`: CF-0 through CF-7; CF-6 residual retirement and CF-7 acceptance.
- `docs/evidence/2026-08-05-cf4-domain-cutover.md`: Labs custom-domain attachment and Access cutover.
- `docs/evidence/2026-08-05-cf5-secrets-and-hermes.md`: 73 large Plexus objects copied, 165:165 object counts on August 5. This is historical parity, not current parity.
- `docs/evidence/2026-08-06-cf5-secrets-mint.md`: follow-up secret provisioning, superseding earlier missing-secret lists.

The September vault draft `thoughtseed-labs/00-meta/plans/2026-09-01-cf-migration-completion.md`
is a residual checklist. Its old counts and possibly-missing secret names need
live reconciliation. It is not evidence that resources were drained.

## Ownership and current evidence

| Surface | Observed authority / result | Evidence boundary |
| --- | --- | --- |
| Legacy account | `9d9d23b27f32e70ae3afb6a1aa2c0f10`, profile `9d9d` | Preserve as update compatibility and rollback source |
| Labs account | `9d7cec1b5a32b2df8c6cdc1321ccd00b`, profile `thoughtseed-labs` | Explicit destination |
| Worker source | `team-forge-ts/cloudflare/worker/wrangler.labs.jsonc` | Sibling source; no Worker deployment performed |
| Labs D1 binding | `TEAMFORGE_DB`, `teamforge-primary`, `613f3e80-0dd5-4740-bccf-8c5913dd5d2e` | Configuration, not a live data-integrity probe |
| Labs OTA binding | `PLEXUS_UPDATES` → `plexus-updates` | Configuration plus successful remote manifest read |
| API | Labs worker health 200; anonymous whoami 401 `access_identity_required`; custom API redirects to `thoughtseedlabs.cloudflareaccess.com` | Reachability/auth boundary, not authenticated desktop acceptance |
| Current app feed | `https://pub-a25dc91980924ba09b031c07d6812e53.r2.dev/plexus` | Runtime and packaging pin match; profile-scoped R2 dev-url probe identifies **legacy account** |
| Legacy public manifest | HTTP 200, version **0.7.12**, ZIP 171805363 bytes, DMG 175156468 bytes | Manifest metadata; no new full artifact SHA-512 download in this pass |
| Labs manifest | Remote Wrangler read returns version **0.7.8**, ZIP 154780700 bytes, DMG 158015457 bytes | Shows manifest divergence; does not prove later artifacts absent |
| Labs public R2 URL | Disabled | Bucket management read; enabling it is not required for an R2 custom domain |
| `plexus-upgrade.thoughtseed.space` | 403, Cloudflare **1000**, “DNS points to prohibited IP,” using curl/updater-style agents; Python default also produced 1010 | Edge failure; do not infer Worker auth defect |
| Active legacy ZIP HTTP | HEAD 200, length 171805363; range 0–31 returns 206 / 32 bytes | Lightweight transport probe only |

The legacy public manifest SHA-256 was
`f02c1d9393b28b87dc3d3e6acf5e7ff8c3311a9bc432e159e28ffe21252aa9e7`.
Observed manifest/cache results are dated September 5, not a permanent guarantee.

Profile-scoped management probes succeeded after removing ambient token/account
overrides. Wrangler 4.124.0 accepts `--profile` for these resource commands;
`whoami --profile` is rejected by that installed version. `auth list` is the
profile-list command. No authentication defaults were rebound.

```bash
# Run from the TeamForge Worker directory, with ambient account/token overrides removed.
wrangler r2 bucket dev-url get plexus-updates --profile thoughtseed-labs --config wrangler.labs.jsonc
wrangler r2 bucket dev-url get plexus-updates --profile 9d9d --config wrangler.jsonc
wrangler r2 object get plexus-updates/plexus/latest-mac.yml --remote --file /tmp/plexus-labs-manifest.yml --profile thoughtseed-labs --config wrangler.labs.jsonc
wrangler secret list --profile thoughtseed-labs --config wrangler.labs.jsonc
```

Pairing profiles with explicit account-pinned configuration follows the
[Wrangler configuration contract](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Credential custody versus capability

GitHub name-only readback confirms **4/9** required environment secrets:
`OTA_APPLE_ID`, `OTA_APPLE_TEAM_ID`, `OTA_R2_ACCOUNT_ID`, `OTA_R2_BUCKET`.
The five values named by the user remain pending. Legacy repository Apple/R2
names are still present, along with a repository-level `OTA_R2_BUCKET`.
No GitHub or Worker secret values were read, copied, set, or deleted.

Secret-name presence does not establish account/bucket values. The existing
publisher's repository fallbacks explain successful earlier releases despite
incomplete custody migration. Keep that publisher transition separate from the
new cleanup workflow, which deliberately has no fallback and rejects the legacy
account before making requests.

Labs Worker name-only readback now includes the four GitHub App secret names
(client secret, private key, state-signing secret, webhook secret), both Realtime
names, `TF_SECRETS_MASTER_KEY`, and `TF_CREDENTIAL_ENVELOPE_KEY`, among 16 names.
Earlier “not provisioned” statements are stale. This does not prove usable App
credentials, installation permissions, selected repositories, or working media.
The user retains the authenticated App/D1/signing acceptance tasks.

## Historical ISA reconciliation

Initial executable count: **303/327 checked, 24 open**, with 327 unique IDs.
The stored frontmatter and P5 summary incorrectly said 299/327 and 28 gaps.
The following ten closures are historical CI/API evidence, not newly executed
releases or a current claim that the public feed is still an older version.

| Criteria | Evidence |
| --- | --- |
| ISC-42.1 | Manual main candidate [30273246772](https://github.com/Sheshiyer/plexus-ts/actions/runs/30273246772), SHA `f133581aa1b62cc6fb35dde6c6e95876568b4077`, succeeds including exact-main guard; dependent publisher [30273516496](https://github.com/Sheshiyer/plexus-ts/actions/runs/30273516496) skips all jobs. A workflow record can be created by `workflow_run`; no publishing job executes. |
| ISC-66/67/68 | [PR #99](https://github.com/Sheshiyer/plexus-ts/pull/99), head `dd72b39fe0909f79d6df785ac0634b42d74baed7`; three-platform CI [29233059038](https://github.com/Sheshiyer/plexus-ts/actions/runs/29233059038) completes before merge `956076420f8632821e3ad9b35b38ed756eadc8d4`; dereferenced v0.5.5 tag matches; candidate [29233526031](https://github.com/Sheshiyer/plexus-ts/actions/runs/29233526031) succeeds at that commit. |
| ISC-69 | v0.5.5 publisher [29233658887](https://github.com/Sheshiyer/plexus-ts/actions/runs/29233658887) passes explicit signature/notarization, immutable-byte verification, manifest publication and public-release verification. |
| ISC-111/112/113 | [PR #108](https://github.com/Sheshiyer/plexus-ts/pull/108), head `856d9d3770c94fee9df5ddab5e9508d56aef41ce`; CI [29420803951](https://github.com/Sheshiyer/plexus-ts/actions/runs/29420803951) completes before merge `8e2759de7dadbd3cfc3b8bdb2b72741646596f8d`; tag v0.5.6 matches; candidate [29421225594](https://github.com/Sheshiyer/plexus-ts/actions/runs/29421225594) succeeds; compact PR #107 merge `1963fbc22537b6c081fd9eb4a1980ad7dacc150e` is an ancestor. |
| ISC-114/115 | v0.5.6 publisher [29421385109](https://github.com/Sheshiyer/plexus-ts/actions/runs/29421385109) passes signing and GitHub/public asset verification. Downloaded GitHub manifest filenames/path/digests match release metadata: ZIP 154074459 bytes, DMG 157297020 bytes. Historical verifier checks exact artifact sets, hashes and cache. |

After these closures: **313/327 historical criteria checked, 14 open**.
New migration criteria are counted separately in the ISA. Remaining historical
items are `41.1`, `43.3`, `70`, `162–165`, `167–169`, `173–175`, `239`.

- ISC-70 still lacks the specifically required downloaded-published-ZIP launch proof.
- ISC-41.1 concerns original v0.5.2 objects; the runbook calls the repair historical/superseded, but exact original-object proof was not re-established. Preserve open for explicit disposition.
- ISC-239 records the failed v0.7.6→v0.7.7 Clio transition; ISC-246 already proves recovery through v0.7.7→v0.7.8. Preserve the failed history rather than re-publishing v0.7.7.
- ISC-162 permits proof or named deferral; existing `thoughtseed-vault#237` remains a follow-up, not new signed-desktop proof.

## Implemented preparation

The cleanup workflow now selects `ota-production`, uses only its four R2 secret
names, runs only on main, defaults to dry run, and shares the publisher lock.
The script pins the Labs account/bucket, inventories all channel manifests,
protects their referenced versions and retained rollback versions, and deletes
only exact immutable keys after explicit execution. Errors stop the command.
The Node fake-AWS suite covers these safeguards without cloud calls, and is
wired into `test:all` as `test:release-ops`.

The OTA runbook now matches the current source pin and describes its legacy
ownership, the divergent Labs manifest, and the compatibility bridge. No runtime
feed constant, version, publisher destination, domain, secret, or data changed.

## Next executable migration sequence

1. Inspect the Labs DNS/custom-domain registration for the upgrade hostname;
   resolve Error 1000 at its owning surface. Keep authentication protections on
   the API. Candidate design: an R2 custom domain, after removing the conflicting
   Worker ownership from the reviewed deployment configuration. Native R2
   delivery avoids implementing an HTTP file server. Do not manually CNAME to
   `r2.dev`; see [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).
2. Refresh an exact source/target OTA object inventory, classify differences,
   and verify hashes/sizes before an allowlisted copy. Do not treat the 0.7.8
   manifest or August counts as proof of which 0.7.12 files are missing.
3. If retaining the Worker proxy, fix and test its typed R2 `get` contract,
   `size` metadata, GET/HEAD, range/206/416, conditional requests, malformed paths,
   and all supported channel cache policies. Read-only typecheck currently
   reports TS2339 at `upgrade.ts:53` because `R2BucketLike` only exposes `head`.
   This is a source defect independent of the edge 403.
4. Prepare a signed bridge newer than 0.7.12 and a reviewed publication procedure
   that verifies identical assets at both historical feeds before advancing
   manifests. Coordinate the account-secret change with that procedure.
5. Prove both old-client cohorts upgrade, retain account/workspace state, stream
   Clio, and subsequently discover updates through Labs.
6. Only after those receipts, decide retention/retirement of legacy resources.
   Dormant clients require the legacy bridge feed beyond a generic soak window.

This task performs preparation and read-only verification. The user is handling
credentials; signing, credential mutation, publication, live routing changes,
cross-account object writes, and destructive retirement have not occurred.

## Verification limits and tooling

`temperance-project-init --check` passed the project rail's core file checks;
the GitHub Project link in its manifest is missing. GSD initialization sees no
standard phase directories and no ROADMAP in the initial root snapshot: this
was a partial planning bootstrap, not evidence that the milestone completed.
The next-wave generator initially selects the blocked secret task. The new
migration overlay supersedes that automatic selection for this scoped pass.

The in-app console was unavailable. The advisor CLI could not refresh OAuth.
Routed `noesis-build` failed with upstream HTTP 400 tool-schema errors and ended
`UNRESOLVED`; it produced no implementation. The bounded in-session fallback
produced the cleanup files. Local tests and independent review are reported
separately from provider-routing or deployed proof.

## Final scoped verification and route inventory

Final `npm run test:release-ops`: **15 tests, 15 pass, 0 fail**. Scoped ESLint,
YAML parse/environment/default assertions, `git diff --check`, package/lock
version verification, and documented/runtime/package feed equality all pass.
The parser accepts both actual captured manifests (Labs 0.7.8, source 0.7.12).
Built-in cleanup retention includes 0.5.2, the documented conservative 0.7.1
baseline, 0.7.8 and 0.7.12 regardless of the current target channel state.

Independent review corrected the ISA preservation wording, added the documented
0.7.1 rollback baseline to cleanup protection, and made the prior planning JSON
archive repository-local. Final count: **321/343 checked**: 313/327 historical
plus 8/16 new migration criteria; 22 total remain open. The project is not marked
complete and the release-readiness field remains blocked-labs-ota-cutover.

A final GET-only API inventory through profile-scoped Labs OAuth lists Worker
custom domains for forge and plexus-api on teamforge-api production, but **no
plexus-upgrade Worker registration**. The exact zone DNS-record query returns
**HTTP403**. Local wrangler.labs.jsonc declaring the route is therefore not live
registration proof. See `2026-09-05-labs-route-inventory.json`. No credential value
was persisted in that receipt. DNS write capability has not been requested or
exercised; a concrete repair must follow verified record ownership.

A second governed native advisor attempt (`gh-claude-sonnet-5`, tool-free,
finite budget) timed out without terminal JSON; it is not accepted as advisor or
provider proof. The independent in-session review and local checks above are
the available review evidence. Existing dirty root files still match the five
before-session hashes.

The Labs bucket custom-domain list also returns **no connected domains**. Neither a live Worker registration nor an R2 custom-domain binding currently serves the upgrade hostname, despite its presence in local Worker configuration. Exact DNS contents remain unreadable with the current scope.
