# Batch 25 Temperance Dispatch Foundation Evidence

Roadmap slice:

- `P6-W1-T001` (`#44`): Dispatch events are projected from Fabric task history as typed assignment, mode, status, evidence, conflict, and completion events.
- `P6-W1-T002` (`#44`, `#45`): Dispatch reads existing queryable Fabric task rows instead of opaque settings JSON.
- `P6-W1-T003` (`#44`): Existing replay/idempotency rules remain covered and dispatch tests preserve duplicate/conflict semantics.
- `P6-W1-T004` (`#44`): A guarded lane status API exposes assigned, delegated, blocked, and done lanes to the renderer.
- `P6-W1-T005` (`#44`): `skillHints` are sanitized at directive parse time and remain confirm-required recommendations only.
- `P6-W1-T006` (`#44`): Tool harness run-plan invariants define permissions, audit, timeout, redaction, and failure-kind taxonomy.
- `P6-W1-T007` (`#44`): Parallel-agent handoff record type requires proof/evidence and shares Fabric correlation IDs.

Verification commands:

- `npx vitest run test/assistant/temperance-dispatch-model.test.ts test/assistant/dispatch-lane-status-api.test.ts test/assistant/fabric-task-parser.test.ts test/assistant/thoughtseed-fabric-history.test.ts test/assistant/today-snapshot.test.ts test/assistant/assistant-ipc.test.ts --no-file-parallelism --testTimeout 30000 --hookTimeout 30000 --teardownTimeout 30000`
- `npm run typecheck`
- `npm run lint -- --quiet`
- `npm run test:assistant`
- `npm run verify:all`

Boundary:

This batch is a local typed dispatch foundation. It does not claim live Cambium/Hermes parallel-agent execution compatibility. External bridge schema alignment and actual delegated agent execution remain later P6 work. Renderer-visible skill hints are recommendations only; they do not execute or load skill files.
