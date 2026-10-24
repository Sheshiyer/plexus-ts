# Employee growth rollout packet

Status: approved backend rollout and original receipt ACK verified on October 24. Hosted Clio relay, Access/DNS route and tunnel ingress are installed and read back. Ordinary-employee packaged acceptance remains open; signed installed 0.7.14 preparation is the current desktop priority.

## Exact reviewed artifacts

| Component | Candidate | Prior/live boundary |
| --- | --- | --- |
| Cambium | receipt-repair source `3851c65`; downloaded bundle SHA-256 `88c2788e875a5fc49bd4c2ce6e265cb847ab0d924e4268b1556a32e160ad4131` | `15622021-5fad-48e0-a0f2-4dc6ff9b6943` live at100%; rollback `b33a1a6e-6edc-412d-b974-10e437379dc0` |
| Hermes + Clio relay | source 09b3369 | Clio relay installed from reviewed archive; Hermes growth-only runtime and private member result verified; global execution remains off |
| Vault docs/context | isolated branch codex/plexus-employee-growth-docs, commit 04df969bc93978d3820b36744fec15f76ac0fc11 | canonical dirty work and unrelated Relovo registry commit preserved |
| Plexus | source freeze `db9ae12`, package 0.7.14 | 897-test release pipeline passed; signing/notarization retry in progress; no OTA publication |

Historical first-growth staging: that Worker retained all39 active-version bindings and the same runtime
compatibility settings. Four new growth variables admit tenant cambium to runner
hermes-runner, at three pending and ten daily requests per member. The staging receipt records the pre-approval state; consult the current promotion receipt before treating a staged version as live. Earlier staged74ed1a69 is superseded and must not be promoted.

## Historical first activation sequence (completed; do not reapply)

1. Publish reviewed source branches for review. Apply only migration0011 to the
   existing cambium-bridge D1 database after schema readback and backup/rollback
   preparation; preserve all existing data and migration history.
2. Promote exactly b33a1a6e to the reviewed production percentage and verify the
   deployed version, binding parity and new member-scoped routes. Keep efb161d2
   as Worker rollback. Do not deploy the obsolete feature-base branch.
3. Install the reviewed Hermes release into a new immutable runtime directory;
   capture existing /opt runtime files, unit/config/enable state and hashes.
   Mount a read-only Git-sourced snapshot of commit 04df969b for growth context.
   Do not overwrite the canonical vault checkout or widen Bridge A write zones.
4. Provision server-only inference credentials through protected files/systemd
   credentials. Enable HERMES_RUNNER_EXECUTE_GROWTH_DIRECTIVES=true while keeping
   HERMES_RUNNER_EXECUTE_DIRECTIVES=false and LEGACY_ACK_WITHOUT_EXECUTION=false.
   Set the pinned growth vault root and a verified governed growth model.
5. Install the hosted-mode Clio relay with a dedicated service account, exact
   Phloem upstream, separate receipt HMAC key and pinned Labs Access/workspace.
   Preserve auth, active membership verification and loopback-only listener.
6. Completed during the approved rollout: the Labs Plexus API Access application
   now covers both plexus-api and clio-relay hostnames, preserving its two policies
   and 24-hour session. The Clio DNS record is a proxied CNAME to the verified tunnel.
   Tunnel configuration version2 adds the exact Clio loopback service before the
   catchall while preserving every prior entry and setting. OAuth Access/DNS record
   reads remain permission-limited; the Access/DNS evidence is authenticated UI
   readback, distinct from the successful tunnel API readback.
7. Run the packaged employee journey: real sign-in, authenticated catalog and
   content-bearing stream, scoped handoff, runner claim/outcome, draft display,
   denial checks, response-loss retry, and durable readback. Record requested and
   resolved inference evidence separately. Clear only named disposable fixtures.

## Current receipt-repair rollout and rollback

The owner-approved native-768 repair is live. All 43 previous Worker bindings,
runtime and global settings are preserved; the three approved additions bring
the total to 46. The legacy 1024/cosine index is unchanged. Only the Hermes
receipt URL changed to `/v1/context/hermes-receipts`. Global execution remains
off, growth-only execution remains on, and legacy ACK bypass remains off.

The original execution `exec_a70be697082631a6ff86300f7631a147` remains attempt 1.
Canonical `bridge_directives.delivered=1` and local phase `acked` are verified.
The requesting member still retrieves the same 1,211-character draft with digest
`sha256:d8e0fcd340c5f27a77e3c8c20d95994bf078b069df1d723284b772da816f4071`.
Vector readback confirms 768 finite, nonzero values and the expected source/space
metadata. This is admin-self backend proof; ordinary-employee/native UI is separate.

The [pinned production receipt](https://github.com/Sheshiyer/cambium/blob/a8ecb18/docs/evidence/2026-10-24-hermes-receipts-768-production.json)
and [exact rollout/rollback packet](https://github.com/Sheshiyer/cambium/blob/a8ecb18/docs/runbooks/cortex-hermes-receipts-v2-768-rollout.md)
record the deployment. Roll back this receipt repair to `b33a1a6e` and restore
only the previous runner ingestion URL if necessary; retain the additive index
and execution evidence. The known legacy embedding retirement would hold ACK
again. Do not erase receipts or regenerate the completed draft.

## Historical first-activation rollback scope

Stop admitting new growth requests and disable the growth-only execution flag.
Restore the previous Worker version, relay snapshot and immutable Hermes runtime
pointer/config. Leave the additive D1 table and audit rows intact; never delete
requests to hide a failed rollout. Pending work retains its admitted source pins;
keep required Git context snapshots until those requests are drained or explicitly
cancelled through their owning contract. Global execution stays disabled.

Rollback for first relay install removes only its service/ingress additions and
restores the exact prior DNS/Access record captured before mutation. No DNS change
is authorized from an inferred record. The reviewed install tooling's hosted
mode must not modify OmniRoute's database, provider routing or existing service.

## Verified relay deployment and remaining acceptance

The user approved this rollout. Source09b3369 relay deployment completed with a
loopback listener and protected credentials. Its helper verified anonymous401,
a15-lane mapped catalog and SSE framing (data plus DONE). These framing assertions
alone do not establish substantive model output. The authenticated in-app browser
subsequently returned healthz200 and models200 with15 lanes and mappingphloem-lanes.v1.
An independent anonymous Node health request redirected302 to Access as expected.

See the sanitized [relay deployment receipt](evidence/2026-10-24-clio-relay-deployment.json),
[Access/DNS receipt](evidence/2026-10-24-clio-access-dns.json), and
[tunnel ingress receipt](evidence/2026-10-24-clio-tunnel-ingress.json).
The relay rollback snapshot is
/var/lib/hermes-clio-relay/rollback/phloem-20261023T195749Z-2036230.

Native acceptance is moving to a normally installed, signed/notarized 0.7.14
client so persistence and actual OTA can be verified first. A substantive native
Clio response and the complete ordinary-employee request → Hermes execution →
draft display journey remain unaccepted. Keep ISA end-to-end and native criteria
open. Initial migration0011 and growth version b33a1a6e were verified separately
in Cambium receipt `2026-10-24-growth-production-rollout.json`; the current
receipt-repair version and rollback are listed above. The actual admin-self draft,
runner activation and final ACK now have their own live readbacks. No signed
0.7.14 release, public installer or OTA publication is claimed yet.
