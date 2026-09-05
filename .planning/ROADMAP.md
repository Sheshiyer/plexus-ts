# Plexus phase roadmap

[GitHub roadmap](GITHUB_ROADMAP.md) is the phase/package index and board projection.
[ISA](../ISA.md) owns acceptance. P6 remains active; no new phase is marked complete.

| Phase | Outcome | State |
| --- | --- | --- |
| P1–P4 | Infrastructure bootstrap | Historical, retained in archive |
| P5 | Historical gap reconciliation | Original evidence retained; outstanding items mapped into owning phases |
| [P6](phases/P6-labs-migration-acceptance.md) | Labs migration and release continuity | Active; live cutover pending |
| [P7](phases/P7-connected-operations.md) | Identity and project authority | Planned; dependency and owner gates explicit |
| [P8](phases/P8-governed-clio.md) | Governed Clio | Planned; dependency and owner gates explicit |
| [P9](phases/P9-reporting-receipts.md) | Work evidence and reporting | Planned; dependency and owner gates explicit |
| [P10](phases/P10-human-operations.md) | Human operations | Planned; dependency and owner gates explicit |
| [P11](phases/P11-realtime-acceptance.md) | Realtime acceptance | Planned; dependency and owner gates explicit |
| [P12](phases/P12-installed-acceptance.md) | Installed connected journey | Planned; dependency and owner gates explicit |

First installed value: P6 + P7 + P8 + daily P9 → P12. Source/fixture preparation
can run in parallel where the packages say so. Full monthly, HR and Realtime
acceptance is a later slice, not an artificial blocker to a safe migration bridge.

Do not republish old versions to satisfy historical checkboxes. Preserve dormant
client discovery and rollback until the retention policy is accepted.
