# P9 — Attributable work reports and destination receipts

Status: planned; implementation and live acceptance pending.
Acceptance: [ISA](../../ISA.md), ISC-282–287. This is W3 of the
[connected-operations overview](P7-connected-operations.md).

## Objective and ownership

Carry complete, attributable work evidence from Plexus through its canonical
consumer to a durable founder receipt, with truthful status and retry behavior.

Accountable owner: Plexus reporting maintainer. Co-owners: Cambium member-bridge
maintainer for ingestion/event state and Hermes reporting maintainer for scoped
activation, consumption, deduplication and destination delivery. The destination
owner supplies the permitted audience and observable receipt contract.

## Scope and dependencies

- Separate deterministic full-day aggregation from bounded model context; retain
  bounded GitHub artifact references, revision and custody provenance.
- Correlate stable daily event IDs across outbox, bridge, canonical consumer and
  destination. Distinguish fallback/ingestion acceptance from actual delivery.
- Locate or implement the matching monthly activation producer and review
  consumer at their owners; cover closed-month selection and offline members.
- Apply the same truthful destination-state distinction to meeting closeout.
- Fixtures can proceed alongside P7/P8. End-to-end acceptance requires P7's actor
  and project boundaries and P8's accepted Clio contract where inference is used.
  Daily reporting is the first installed slice; monthly work is separately gated.

## Execution package

1. Pin each producer, consumer, event schema and destination owner/revision; trace
   the daily, monthly and closeout paths without assuming a missing consumer.
2. Build synthetic complete-day, multi-member, retry and closed-month fixtures;
   specify durable event keys and every observable state transition.
3. Implement bounded evidence envelopes, aggregation and status changes at their
   owning boundaries. Preserve offline work and existing event identity on retry.
4. Run local producer/consumer tests, then perform the approved recipient probe.
   Capture redacted event correlation and destination receipt, including replay.

## Fixtures and acceptance probes

| Criterion | Required proof |
| --- | --- |
| ISC-282: A day with more than fifty work records produces complete totals independent of model-context truncation. | Use at least 51 records with known durations and day boundaries; compare the full deterministic totals with bounded prompt context. |
| ISC-283: A submitted work report retains bounded GitHub artifact references and revision/custody provenance. | Trace selected-repository artifact references, commit/revision and custody through the submitted envelope; enforce limits and reject unauthorized provenance. |
| ISC-284: Replaying one daily event yields one event-correlated destination receipt. | Retry before/after ingestion and delivery, including a timeout after successful delivery; observe one correlated recipient result for the stable event ID. |
| ISC-285: A scoped Hermes activation reaches the correct member for a closed-month review. | Two members/tenants, an offline member and a boundary-month fixture prove correct closed-month targeting and eventual scoped activation. |
| ISC-286: A closed-month review produces a durable founder receipt through the canonical consumer. | Trace activation through review submission and the identified consumer to a persistent founder-visible receipt; replay does not create duplicate delivery. |
| ISC-287: Meeting closeout status distinguishes queued ingestion from actual Hermes destination delivery. | Queue, delayed consumer, failed delivery and successful delivery display distinct states correlated to the closeout event. |

## Live gates and phase exit

Resolve the deployed bridge and Hermes revisions, destination access and approved
synthetic recipient before sending a live report. No Telegram or other external
send is authorized merely by this document. Retain queued events and document
consumer/schema rollback without deleting report history or changing event IDs.

Exit requires ISC-282–287 receipts; queue acceptance, Worker fallback and HTTP 200
cannot stand in for destination delivery. The daily subset ISC-282–284 can feed
[P12](P12-installed-acceptance.md) before monthly/closeout completion; the remaining
criteria stay open and the accepted slice must name that limit.

## GitHub work packages

Phase epic: [P9](https://github.com/Sheshiyer/plexus-ts/issues/151). Current links and dependencies: [GitHub roadmap](../GITHUB_ROADMAP.md).

- [P9-DAILY](https://github.com/Sheshiyer/plexus-ts/issues/165): Deliver complete daily evidence with correlated receipts — Blocked dependency.
- [P9-MONTHLY](https://github.com/Sheshiyer/hermes-aws-ts/issues/157): Implement scoped monthly activation and founder review delivery — Blocked dependency.
- [P9-CLOSEOUT](https://github.com/Sheshiyer/plexus-ts/issues/166): Reconcile meeting closeout queue and delivery status — Blocked dependency.
