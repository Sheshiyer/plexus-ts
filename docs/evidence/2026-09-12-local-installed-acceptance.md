# Local installed acceptance — 2026-09-12

Status: local ad-hoc candidate installation, authenticated desktop handoff and
isolated session relaunch verified. P6 migration and P7 runtime authority remain open.
Source: `cf8b71cb5095418cb0fded8cd53ec8ea48f3535f`, v0.7.12, built in the persistent
`codex/plexus-local-acceptance-20260912` worktree. No application source changed.

## Artifact and data custody

Installed `~/Applications/Plexus.app`, whose app.asar SHA-256 is
`666bd8b82624db91b4863b3adfe3f387dac84347df69bcfb8777e4d3e4896678`.
The installed digest equals the built candidate. Strict deep codesign verification
passes with an ad-hoc signature; this is not Developer ID or notarized acceptance.
The old root release/mac-arm64 app was v0.7.9, digest
`12de14851e253eb8f15cc111aac557bfeb582204b8c6a029a59dd30728d5a773`.

The previous app, complete work data and Electron profile were copied to
`~/Library/Application Support/Plexus-Recovery/20260912` before installation.
The backup SQLite integrity check passes and its digest matches the original.
The old app remains in place. Original root WIP hashes are preserved.

Computer acceptance used a fresh `acceptance.db` under
`~/Library/Application Support/Plexus-Acceptance-20260912`, with PLEXUS_DB_PATH
set explicitly and a separate Electron profile copied from the same app's
existing authenticated profile. No work database or queued work was copied.
A normal future launch defaults to the original work database; this receipt
proves isolated acceptance, not upgrade/migration of the original database.
Private local logs are under `/private/tmp/plexus-local-acceptance-20260912`.

## Labs Access and OTP

The authenticated Cloudflare dashboard confirms account
`9d7cec1b5a32b2df8c6cdc1321ccd00b`, team domain
`thoughtseedlabs.cloudflareaccess.com`, and Plexus API application
`b419f0f1-fbbc-4711-a23b-c82a17d4c2fe` for `plexus-api.thoughtseed.space`.
Its Allow policy `thoughtseed-team-emails` includes the intended administrator;
One-time PIN is available. Session duration is 24 hours. The legacy team display
name is branding, not evidence of a different account. No policies were changed.

The initial native OTP page displayed a misspelled administrator address
(`thougthseedlabs` rather than `thoughtseedlabs`). Cloudflare intentionally shows
an email-sent screen even for addresses denied by policy; delivery cannot be
inferred from that screen. The subsequently supplied whoami response and native
handoff establish the correctly spelled administrator's successful authentication.
See [Cloudflare OTP troubleshooting](https://developers.cloudflare.com/cloudflare-one/access-controls/troubleshooting/).

The old v0.7.9 bundle baked audience
`5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200`
and stalled at raw whoami JSON. The new candidate bakes current Labs audience
`38b502a01f4063c5521191e084c7fd9b086099c0061b045145cd93165b9af8d0`
and completed native handoff. The artifact mismatch is confirmed; successful
candidate handoff resolves the observed symptom without changing Access policy.

Wrangler's refreshed Labs OAuth could read the account and Worker deployments,
but Access API inventory returned empty arrays while the dashboard showed seven
apps. Organization API returned 403. Treat that API inventory as incomplete;
it does not prove missing Access configuration. Latest observed Worker deployment:
`ed7f7ecd-f491-4591-9d7a-c82668d92870`, 2026-08-12T05:56:38.163Z, version created
2026-08-12T05:55:52.370Z, message “Align thoughtseedlabs Cloudflare Access audience”.
A canonical source-to-deployment match is still missing (ISC-271).

## Native observations

Computer observed the installed file-backed v0.7.12 renderer, authenticated admin
in ws_thoughtseed, Plexus Online, and 20 projects. Today, Identity, Projects,
Work Records, Settings and the admin proof cockpit rendered without a crash.
After clean quit and launch with the same isolated database/profile, the admin
session and 20-project catalog persisted. No timer, manual work, model generation,
report delivery or invitation was initiated by the assistant.

Read-only SQLite corroborated 20 worker_mapping projects, all with workspace IDs
and 18 with client IDs; time_entries remained zero. Encrypted Access JWT, session
and workspace settings were present; no legacy bearer setting was present.
No credential values were printed or copied into these receipts.

Remaining visible limits:

- All 20 projects need repository proof; catalog visibility does not grant work.
- Clio remains offline/sign_in_required after fresh Settings/status reads and
  relaunch. Worker and Clio use different authentication paths: Worker sends
  assertion/cookie; the Clio catalog GET sends Cf-Access-Token and rejects redirects.
  Missing JWT, blocked redirect and HTTP 401/403 collapse to the same UI reason.
  Relay policy/audience/carrier denial is a candidate, not a confirmed root cause.
  Unauthenticated public GETs to both hosts returned 403, which does not diagnose
  authenticated relay denial. Next proof needs redacted status/request metadata.
- The member bridge is unconnected/manual. No member-to-founder receipt is proven.
- Admin release “green” reflects local policy/workflow file presence with zero CI
  proof; it does not establish release readiness. Logs also contain GLTF blob
  texture CSP failures; rendering a view is not full visual-asset acceptance.

## Checks

| Check | Result |
| --- | --- |
| Typecheck and main/preload/renderer builds | Pass |
| Clean-environment release:mac, publish never | Pass, ad-hoc v0.7.12 |
| Packaged architecture and SQLite/main/renderer isolated probes | Pass, 16 arm64 native binaries |
| Installed digest and strict deep codesign | Pass; ad-hoc only |
| Five Access/private-GitHub security suites | 90 passed |
| Main and identity suites | 36 passed, 2 unchanged source-text assertion failures |
| Clio model catalog and OmniRoute suites | 17 passed |
| Computer authenticated views and isolated relaunch | Pass |
| Documentation catalog/links and verifier tests | 193 documents, zero errors; 7 tests passed |
| Original checkout status and five WIP hashes | Unchanged |

The two failures remain in repo-verify-retry.test.ts and expect obsolete inline
source instead of the shared helper. The repository suite is not fully green.
The aggregate test:all script also omits test/main; keep explicit main coverage.

## Next boundary

Follow [the P7 continuation](../../.planning/P7-identity-continuation.md).
Valid empty mapping responses currently leave existing cached rows intact;
removed/inactive reconciliation is not implemented. Timer/manual/agent/repository
consumers lack a common current authority check. Queued time-entry delivery uses
the current employee/workspace instead of an immutable queued actor; logout and
account switch do not supply the required revocation boundary. Preserve records
while denying stale authority, then prove the trusted Cambium adapter and grants.

ISC-309–316 close only this local acceptance slice. The 52 prior operational
criteria, P6 parity/DNS/bridge/signing, selected-repository App acceptance and
end-to-end member-to-founder journey remain open. No merge, deployment, signing,
secret mutation, release publication or Access-policy change occurred.
