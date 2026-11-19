# P10 — Human operations

Status: planned; native feature implementation and acceptance pending.
Acceptance: [ISA](../../ISA.md), ISC-288–293. This is W4 of the
[connected-operations overview](P7-connected-operations.md).

## Objective and ownership

Provide visible employee workflows for assigned human tasks, planning/capacity,
leave and holidays, backed by shared authoritative state and explicit roles.
Team work signal must convey its declared purpose without confusing employment
activation with online presence.

Accountable owner: Plexus product/desktop maintainer. Shared-state co-owner:
Workspace Worker/D1 maintainer. Human-operations policy owner defines calendars,
quotas, leave rules and communication scope before implementation. Cambium owns
only any separately admitted company WorkObject references.

## Scope and dependencies

- Agree API/data/role/state-machine contracts before UI construction. Existing
  inbound bridge tasks and assignment summaries do not complete a human task UI.
- Deliver assigned-task lifecycle and shared human sprint/planning state. Derive
  capacity from an agreed work calendar and quota, not a fixed display default.
- Implement leave request/approval and an auditable balance ledger; resolve the
  applicable holiday calendar by explicit member policy.
- Define team communication scope before adding features; room/media presence
  neither proves active employment nor implies a durable chat/thread product.
- Depend on P7's active-member, role, canonical project/client and WorkObject
  boundaries. Human-state writes stay in the shared human-operations authority;
  they do not create a competing Cambium Goal Graph or a GitHub engineering board.
  This phase need not block the safe P6 bridge or P9's first daily-report slice.

## Execution package

1. Inventory the canonical Worker schema and deployed/source revisions. Confirm
   existing backend coverage before proposing migrations; sibling source alone
   does not prove deployed functionality.
2. Obtain the policy owner's calendar/quota, leave transition/ledger and team
   signal contracts; record employee/admin operations and denial behavior.
3. Split implementation into task lifecycle, planning/capacity, leave/ledger,
   calendar and team-signal packages with owner-local API/data/UI fixtures.
4. Exercise shared-state behavior with two synthetic members and an approver,
   then perform role-specific installed acceptance against the pinned backend.

## Fixtures and acceptance probes

| Criterion | Required proof |
| --- | --- |
| ISC-288: An employee completes the visible assigned-human-task lifecycle with shared authoritative state. | Assignment, visible progress and completion survive reload/restart and appear on a second authorized client; another member cannot mutate the task. |
| ISC-289: A human planning view derives capacity from its agreed work-calendar and quota contract. | Sprint/planning fixtures cover different quotas, non-working days and approved policy adjustments; displayed capacity matches the agreed deterministic calculation. |
| ISC-290: A leave request passes the role-authorized request and approval state machine. | Employee submission and authorized approval follow allowed transitions; wrong-role, duplicate and conflicting transitions are rejected without unintended state changes. |
| ISC-291: Leave balances reconcile to an auditable approved leave ledger. | Approved, rejected and any policy-supported cancellation/adjustment cases reconcile opening balance and ledger movements; retry cannot double-debit. |
| ISC-292: The holiday calendar resolves the member applicable calendar under the agreed policy. | Members with different applicable calendars and calendar-boundary dates see the correct holidays; missing policy has an explicit state. |
| ISC-293: Team work signal distinguishes employment activation from realtime presence and declared communication scope. | Active-but-offline and inactive-but-cached members demonstrate separate employment and presence states; signal visibility/delivery respects the declared audience and scope. |

## Live gates and phase exit

Policy agreement and owner-approved schema/API changes precede live data changes.
Use synthetic HR records; do not import payroll, founder notes or private leave
content into models/reporting as a test shortcut. Document migration recovery and
history preservation before changing shared state. Real-member use needs its
specific role and privacy acceptance packet.

Exit requires ISC-288–293 with visible workflow and shared-state receipts, plus
the accepted policy/schema versions. Source-only APIs, screenshots and default
quotas cannot establish this phase's result. Hand accepted feature scope to
[P12](P12-installed-acceptance.md); retain any unfinished slice as open work.

## GitHub work packages

Phase epic: [P10](https://github.com/Sheshiyer/plexus-ts/issues/152). Current links and dependencies: [GitHub roadmap](../GITHUB_ROADMAP.md).

- [P10-TASKS](https://github.com/Sheshiyer/plexus-ts/issues/167): Complete human task lifecycle and calendar-based capacity — Blocked dependency.
- [P10-LEAVE](https://github.com/Sheshiyer/plexus-ts/issues/168): Implement leave ledger and member-specific holiday calendar — Blocked dependency.
- [P10-SIGNAL](https://github.com/Sheshiyer/plexus-ts/issues/169): Define and implement truthful team work signal — Blocked dependency.
