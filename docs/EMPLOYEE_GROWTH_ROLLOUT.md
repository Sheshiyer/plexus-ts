# Employee growth rollout packet

Status: owner-approved live rollout in progress. Hosted Clio relay, Access/DNS route and tunnel ingress are installed and read back. Packaged employee acceptance remains open.

## Exact reviewed artifacts

| Component | Candidate | Prior/live boundary |
| --- | --- | --- |
| Cambium | source eb181c6; approved b33a1a6e-6edc-412d-b974-10e437379dc0 | b33a1a6e live at100%; rollback efb161d2-3dbe-439f-b1f9-c4deb49f74e9 |
| Hermes + Clio relay | source 09b3369 | Clio relay installed from reviewed archive; Hermes runtime activation/readback tracked separately |
| Vault docs/context | isolated branch codex/plexus-employee-growth-docs, commit 04df969bc93978d3820b36744fec15f76ac0fc11 | canonical dirty work and unrelated Relovo registry commit preserved |
| Plexus | source includes 56819a5 response-loss recovery | local acceptance package, no signed release or OTA publication |

The staged Worker retains all39 active-version bindings and the same runtime
compatibility settings. Four new growth variables admit tenant cambium to runner
hermes-runner, at three pending and ten daily requests per member. The staging receipt records the pre-approval state; consult the current promotion receipt before treating a staged version as live. Earlier staged74ed1a69 is superseded and must not be promoted.

## Approved activation sequence and progress

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

## Rollback

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

Native sign-in is awaiting a fresh owner OTP in the isolated acceptance app.
A substantive installed Clio response and the complete real employee request →
Hermes execution → draft display journey remain unaccepted. Keep ISA end-to-end
and native criteria open. Cambium promotion is separately verified: versionb33a1a6e at100%, deployment
256bd7d9-9dfe-4858-a14c-0b926d6bb19e. Additive migration0011 was applied with
34 prior table schemas and nine prior migration rows preserved, one new history
row, the ten-column growth table and its member index. All39 prior bindings,
four growth variables and runtime settings were preserved. The authoritative
Cambium receipt is docs/evidence/2026-10-24-growth-production-rollout.json in
its release worktree, commit0a5fa0b. Hermes activation and employee provisioning
still require their own readback; relay and Worker receipts do not establish
those separate outcomes. No signed desktop release or OTA publication is claimed.
