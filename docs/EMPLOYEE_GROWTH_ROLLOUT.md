# Employee growth rollout packet

Status: reviewed source candidate and no-traffic Worker version; activation pending.

## Exact reviewed artifacts

| Component | Candidate | Prior/live boundary |
| --- | --- | --- |
| Cambium | source eb181c6; staged b33a1a6e-6edc-412d-b974-10e437379dc0 | live efb161d2-3dbe-439f-b1f9-c4deb49f74e9 at 100%, source 8835d6 |
| Hermes + Clio relay | source 09b3369 | runtime file hashes match8ea7a8e; runtime /opt/hermes-aws-ts, not source checkout |
| Vault docs/context | isolated branch codex/plexus-employee-growth-docs, commit 04df969bc93978d3820b36744fec15f76ac0fc11 | canonical dirty work and unrelated Relovo registry commit preserved |
| Plexus | source includes 56819a5 response-loss recovery | local acceptance package, no signed release or OTA publication |

The staged Worker retains all39 active-version bindings and the same runtime
compatibility settings. Four new growth variables admit tenant cambium to runner
hermes-runner, at three pending and ten daily requests per member. No production
traffic changed. Earlier staged74ed1a69 is superseded and must not be promoted.

## Activation sequence requiring the existing production boundary

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
6. Inspect the exact clio-relay DNS record and Access binding using a DNS-capable
   Labs session, then prepare/apply the reviewed route repair. Current OAuth can
   read the Labs zone/tunnel but DNS-record reads return403. The current tunnel
   configuration has Phloem ingress but no clio-relay ingress. Do not guess a
   DNS target, remove Access or expose the loopback listener publicly.
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

## Open live evidence

No production migration/promotion, Hermes activation, credential installation or
DNS repair has occurred in this implementation pass. A real employee-to-Hermes
result in an installed app is not yet proven. The existing repository AGENTS.md
production deployment boundary requires separate owner approval of this packet.
