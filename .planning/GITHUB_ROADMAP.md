# Plexus GitHub execution roadmap

Updated: 2026-09-05. [Project 17](https://github.com/users/Sheshiyer/projects/17) is the human roadmap.
[ISA](../ISA.md) owns acceptance; [State](STATE.md) owns the current phase.
The structured [issue map](github-roadmap.json) records stable package keys, owner repositories, dependencies and criterion coverage.

## Phase sequence

| Phase | Epic | Plan |
| --- | --- | --- |
| P6 | [Labs migration and release continuity](https://github.com/Sheshiyer/plexus-ts/issues/148) | [Phase packet](phases/P6-labs-migration-acceptance.md) |
| P7 | [Identity and project authority](https://github.com/Sheshiyer/plexus-ts/issues/149) | [Phase packet](phases/P7-connected-operations.md) |
| P8 | [Governed Clio](https://github.com/Sheshiyer/plexus-ts/issues/150) | [Phase packet](phases/P8-governed-clio.md) |
| P9 | [Work evidence and reporting](https://github.com/Sheshiyer/plexus-ts/issues/151) | [Phase packet](phases/P9-reporting-receipts.md) |
| P10 | [Human operations](https://github.com/Sheshiyer/plexus-ts/issues/152) | [Phase packet](phases/P10-human-operations.md) |
| P11 | [Realtime acceptance](https://github.com/Sheshiyer/plexus-ts/issues/153) | [Phase packet](phases/P11-realtime-acceptance.md) |
| P12 | [Installed connected journey](https://github.com/Sheshiyer/plexus-ts/issues/154) | [Phase packet](phases/P12-installed-acceptance.md) |

## Work packages

Readiness is a dated planning decision. Ready local means bounded source/fixture work, not deployment approval.
All 52 pending implementation/acceptance criteria map once to 20 primary packages; a Cambium supporting package owns its boundary implementation.

| Package | Owning issue | Acceptance | Dependencies | Readiness |
| --- | --- | --- | --- | --- |
| P6-RELEASE | [Sheshiyer/plexus-ts#155](https://github.com/Sheshiyer/plexus-ts/issues/155) | ISC-43.3, ISC-70, ISC-162, ISC-239 | None for local preparation | Operator gate |
| P6-ROUTE | [Sheshiyer/plexus-ts#156](https://github.com/Sheshiyer/plexus-ts/issues/156) | ISC-255 | None for local preparation | Operator gate |
| P6-OBJECTS | [Sheshiyer/plexus-ts#157](https://github.com/Sheshiyer/plexus-ts/issues/157) | ISC-41.1, ISC-256 | None for local preparation | Ready local |
| P6-BRIDGE | [Sheshiyer/plexus-ts#158](https://github.com/Sheshiyer/plexus-ts/issues/158) | ISC-257, ISC-258 | [P6-RELEASE](https://github.com/Sheshiyer/plexus-ts/issues/155), [P6-ROUTE](https://github.com/Sheshiyer/plexus-ts/issues/156), [P6-OBJECTS](https://github.com/Sheshiyer/plexus-ts/issues/157) | Blocked dependency |
| P6-COHORTS | [Sheshiyer/plexus-ts#159](https://github.com/Sheshiyer/plexus-ts/issues/159) | ISC-259, ISC-260, ISC-261, ISC-262 | [P6-BRIDGE](https://github.com/Sheshiyer/plexus-ts/issues/158) | Blocked dependency |
| P7-MAPPING | [Sheshiyer/plexus-ts#160](https://github.com/Sheshiyer/plexus-ts/issues/160) | ISC-271, ISC-275, ISC-276, ISC-277 | [P7-CAMBIUM](https://github.com/Sheshiyer/cambium/issues/371) | Blocked dependency |
| P7-ACTOR | [Sheshiyer/plexus-ts#161](https://github.com/Sheshiyer/plexus-ts/issues/161) | ISC-272, ISC-273, ISC-274 | [P7-MAPPING](https://github.com/Sheshiyer/plexus-ts/issues/160) | Blocked dependency |
| P7-APP-PERMISSIONS | [Sheshiyer/plexus-ts#162](https://github.com/Sheshiyer/plexus-ts/issues/162) | ISC-167, ISC-168, ISC-169, ISC-173, ISC-175 | None for local preparation | Operator gate |
| P7-APP-ACCEPTANCE | [Sheshiyer/plexus-ts#163](https://github.com/Sheshiyer/plexus-ts/issues/163) | ISC-163, ISC-164, ISC-165, ISC-174 | [P7-APP-PERMISSIONS](https://github.com/Sheshiyer/plexus-ts/issues/162) | Blocked dependency |
| P8-TRANSPORT | [Sheshiyer/hermes-aws-ts#156](https://github.com/Sheshiyer/hermes-aws-ts/issues/156) | ISC-278, ISC-279 | [P7-ACTOR](https://github.com/Sheshiyer/plexus-ts/issues/161) | Blocked dependency |
| P8-TOOLS | [Sheshiyer/plexus-ts#164](https://github.com/Sheshiyer/plexus-ts/issues/164) | ISC-280, ISC-281 | None for local preparation | Ready local |
| P9-DAILY | [Sheshiyer/plexus-ts#165](https://github.com/Sheshiyer/plexus-ts/issues/165) | ISC-282, ISC-283, ISC-284 | [P7-ACTOR](https://github.com/Sheshiyer/plexus-ts/issues/161), [P7-APP-ACCEPTANCE](https://github.com/Sheshiyer/plexus-ts/issues/163), [Hermes receipts #95](https://github.com/Sheshiyer/hermes-aws-ts/issues/95) | Blocked dependency |
| P9-MONTHLY | [Sheshiyer/hermes-aws-ts#157](https://github.com/Sheshiyer/hermes-aws-ts/issues/157) | ISC-285, ISC-286 | [P9-DAILY](https://github.com/Sheshiyer/plexus-ts/issues/165) | Blocked dependency |
| P9-CLOSEOUT | [Sheshiyer/plexus-ts#166](https://github.com/Sheshiyer/plexus-ts/issues/166) | ISC-287 | [P9-DAILY](https://github.com/Sheshiyer/plexus-ts/issues/165) | Blocked dependency |
| P10-TASKS | [Sheshiyer/plexus-ts#167](https://github.com/Sheshiyer/plexus-ts/issues/167) | ISC-288, ISC-289 | [P7-ACTOR](https://github.com/Sheshiyer/plexus-ts/issues/161), [P7-MAPPING](https://github.com/Sheshiyer/plexus-ts/issues/160), [P10-LEAVE](https://github.com/Sheshiyer/plexus-ts/issues/168) | Blocked dependency |
| P10-LEAVE | [Sheshiyer/plexus-ts#168](https://github.com/Sheshiyer/plexus-ts/issues/168) | ISC-290, ISC-291, ISC-292 | [P7-ACTOR](https://github.com/Sheshiyer/plexus-ts/issues/161) | Blocked dependency |
| P10-SIGNAL | [Sheshiyer/plexus-ts#169](https://github.com/Sheshiyer/plexus-ts/issues/169) | ISC-293 | [P7-ACTOR](https://github.com/Sheshiyer/plexus-ts/issues/161) | Blocked dependency |
| P11-SFU | [Sheshiyer/plexus-ts#26](https://github.com/Sheshiyer/plexus-ts/issues/26) | ISC-294 | [P7-ACTOR](https://github.com/Sheshiyer/plexus-ts/issues/161) | Operator gate |
| P11-PRIVACY | [Sheshiyer/plexus-ts#23](https://github.com/Sheshiyer/plexus-ts/issues/23) | ISC-295, ISC-296 | None for local preparation | Ready local |
| P12-JOURNEY | [Sheshiyer/plexus-ts#170](https://github.com/Sheshiyer/plexus-ts/issues/170) | ISC-297, ISC-298, ISC-299, ISC-300 | [P6-COHORTS](https://github.com/Sheshiyer/plexus-ts/issues/159), [P7-ACTOR](https://github.com/Sheshiyer/plexus-ts/issues/161), [P7-APP-ACCEPTANCE](https://github.com/Sheshiyer/plexus-ts/issues/163), [P8-TRANSPORT](https://github.com/Sheshiyer/hermes-aws-ts/issues/156), [P8-TOOLS](https://github.com/Sheshiyer/plexus-ts/issues/164), [P9-DAILY](https://github.com/Sheshiyer/plexus-ts/issues/165) | Blocked dependency |
| P7-CAMBIUM | [Sheshiyer/cambium#371](https://github.com/Sheshiyer/cambium/issues/371) | Supports ISC-277 | None for local preparation | Review pending |

Cambium’s reviewed graph-reference contract and negative fixtures support Plexus mapping implementation.
Authenticated resource binding and action-specific admission remain separate requirements.
Paired integration and production configuration receipts are then accepted jointly under ISC-277;
they are not prerequisites for handing over that contract. Hermes #95 is an explicit
`external_depends_on` entry on P9-DAILY in the structured issue map.

## Current execution

P7 epic, P7-MAPPING and P7-CAMBIUM are In Progress. The
[source receipt](../docs/evidence/2026-09-05-p7-source-foundations.md) records tested
identity retention and committed-reference validation; the Cambium candidate is
Review pending for integration. [The continuation](P7-identity-continuation.md)
keeps current mapping authority, revocation and authenticated integration next.
No operational criterion closes. P6-OBJECTS also remains In Progress; its
[first receipt](../docs/evidence/2026-09-05-p6-first-execution.md) retains partial
byte verification and open transport/parity gates.

## First installed slice

P6 distribution + P7 identity/projects + P8 Clio + daily P9 → P12 installed receipt.
Monthly reporting, full HR and Realtime are subsequent slices. P10 calendar/quota rules precede capacity arithmetic.
ISC-299/300 privacy and admission invariants constrain every package.

## Retained history and external ownership

- Vault issues [236](https://github.com/Sheshiyer/thoughtseed-vault/issues/236), [237](https://github.com/Sheshiyer/thoughtseed-vault/issues/237), [238](https://github.com/Sheshiyer/thoughtseed-vault/issues/238) are preserved historical pointers to owning-repository work.
- [Documentation #147](https://github.com/Sheshiyer/plexus-ts/issues/147) remains open pending main integration; its pushed fix is not silently marked merged.
- [Hermes migration #127](https://github.com/Sheshiyer/hermes-aws-ts/issues/127) remains the broader relocation context.
- Hermes owner tasks also appear on [Project 10](https://github.com/users/Sheshiyer/projects/10); the Cambium boundary task also appears on [Project 14](https://github.com/users/Sheshiyer/projects/14).
- TeamForge is the Workspace Worker/backend asset name, not a restored desktop application or a new founder workspace.
- No dates, estimates, assignees, live approvals or done states were invented by this publication.

## Closeout discipline

Attach exact source and test evidence before changing acceptance. Installed, deployed and recipient behavior need their own receipts.
Historical criteria retain their failed or unproven status until original proof or explicit disposition is recorded.
Changes to issues or board readiness should update the structured issue map and this generated table together.
