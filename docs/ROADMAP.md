# Plexus product roadmap

Current work and acceptance live in [planning state](../.planning/STATE.md),
[planning roadmap](../.planning/ROADMAP.md), and [ISA](../ISA.md).
Start with the [documentation map](DOCUMENTATION_MAP.md). This roadmap describes
product direction without maintaining another independent phase/count table.

## Product direction

Plexus is the local-per-member desktop client for work coordination, focused
work, the native Clio assistant, reporting and Co-working. Electron main owns
privileged execution and credentials; the renderer uses bounded IPC. The
Workspace Worker/Plexus API is the member data plane. Hermes owns reporting
orchestration toward Cambium and configured Telegram destinations.

Fabric/Paperclip and MultiCA are retired product/reporting dependencies.
Remaining legacy names or fallbacks do not make them installable prerequisites.
See [reporting ownership](architecture/HERMES_REPORTING_CONTRACT.md) and
[retired helper guidance](optional-helpers.md).

## Workstreams

| Workstream | Authority and remaining proof |
| --- | --- |
| Labs OTA migration | [P6](../.planning/phases/P6-labs-migration-acceptance.md): accepted Labs delivery, exact object parity, a signed bridge for both client cohorts, subsequent Labs discovery |
| GitHub connection acceptance | [Control-plane contract](GITHUB_PRIVATE_REPOSITORY_CONTROL_PLANE.md): selected-only App authorization and authenticated desktop proof remain distinct from secret-name inventory |
| Realtime workspace | [Workspace contract](REALTIME_WORKSPACE_CONTRACT.md): distinguish client scaffolding from live two-client transport and authorization/audit acceptance |
| Assistant and reporting | [Runtime contract](ASSISTANT_RUNTIME_CONTRACT.md): source-owned capabilities and explicit delivery receipts; a queued record is not delivery proof |
| Documentation maintenance | [Documentation map](DOCUMENTATION_MAP.md): current guidance, historical records and repeatable drift checks |

Live SFU, recording/transcription, external delivery and production updates need
their own evidence. This roadmap grants no publication or infrastructure action.

## Historical roadmap and release gates

The [pre-refresh roadmap](archive/2026-09-05/pre-refresh-roadmap.md) preserves
June/July phases, old release notes, helper routines and former next steps.
The current queue does not inherit its instructions to rename Access apps,
publish old releases or install retired helpers.

The historical P9 packet remains at
`docs/evidence/2026-07-10-release-candidate-closeout/README.md`; supporting records
are `docs/DEFERRED_REGISTER.md` and `docs/RELEASE_CANDIDATE_RECOMMENDATION.md`.
`npm run verify:release-candidate` checks that retained packet. Current production
acceptance still requires [release evidence policy](RELEASE_EVIDENCE.md),
exact-head checks and new signed, installed and live receipts.

See [CHANGELOG](../CHANGELOG.md) for release history and the
[evidence index](evidence/README.md) for dated observations.
