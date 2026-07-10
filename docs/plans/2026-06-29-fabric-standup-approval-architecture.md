# Fabric Standup Evidence + Approval Workflow Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a foolproof Fabric workflow where Hermes (admin lane) and Paperclip (employee lane) both write structured daily standup artifacts to files, then Plexus ingests those files into an admin review queue with approve/reject/request-changes decisions and audit history.

**Architecture:** Treat artifact files as the source of truth and keep DB tables as indexed projections for fast UI queries. The write path runs at task-report/history-event boundaries and stores immutable, hash-addressed artifacts under `vault/fabric/standups/`. The read path ingests artifacts into review tables, exposes typed IPC endpoints, and renders an admin review queue while employee views only consume approval outcomes.

**Tech Stack:** Electron main/preload IPC, React 18 renderer, TypeScript shared contracts, sqlite (`src/db/database.ts`), existing handoff resilience flow, existing Thoughtseed bridge task flow, Node smoke scripts in `scripts/*.mjs`, `npm run typecheck`, `npm run lint`, `npm run build:main`, `npm run build:renderer`.

---

## Execution guardrails

- Skills during execution: `@superpowers:executing-plans`, `@superpowers:verification-before-completion`.
- Do not add new dependencies.
- Keep Hermes and Paperclip writing the same artifact schema; only `lane` differs.
- Preserve current Fabric behavior unless explicitly migrated in tasks below.
- Use append-only decisions (no destructive review-history edits).
- Continue using resilience handoffs for recoverable write/ingest failures.

---

### Task 1: Add standup artifact contracts to shared types

**Files:**
- Modify: `src/shared/types.ts`

**Steps:**
1. Add `FabricStandupLane = 'paperclip' | 'hermes'`.
2. Add `FabricStandupArtifact` interface with required fields:
   - `artifactId`, `artifactHash`, `schemaVersion`, `createdAt`, `lane`, `workspaceId`, `tenantId`, `memberId`, `identityId`, `projectId`, `projectName`, `taskId`, `status`, `summary`, `proof`, `sourceEvent`.
3. Add nested `proof` structure with typed evidence list and normalized URLs/refs.
4. Add `sourceEvent` fields for `historyEventId`, `payloadHash`, `correlationId`.
5. Keep all new interfaces exported and colocated near existing Fabric task contracts.
6. Run `npm run typecheck`.

**Commit:** `feat: add shared standup artifact contracts`

---

### Task 2: Add review queue domain contracts to shared types

**Files:**
- Modify: `src/shared/types.ts`

**Steps:**
1. Add `FabricStandupReviewStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested'`.
2. Add `FabricStandupReviewDecisionType = 'approve' | 'reject' | 'request_changes'`.
3. Add interfaces:
   - `FabricStandupReviewItem`
   - `FabricStandupReviewDecision`
   - `FabricStandupReviewListResult`
   - `FabricStandupReviewActionInput`
   - `FabricStandupReviewActionResult`
4. Include admin actor fields (`reviewedByIdentityId`, `reviewedByEmail`) and reason fields.
5. Include lane/source metadata so admin can compare Hermes vs Paperclip submissions.
6. Run `npm run typecheck`.

**Commit:** `feat: add shared review queue contracts`

---

### Task 3: Add IPC contract entries for artifact/review APIs

**Files:**
- Modify: `src/shared/types.ts`

**Steps:**
1. Extend `PlexusAPI` with:
   - `fabricStandupList`
   - `fabricStandupGet`
   - `fabricStandupReview`
   - `fabricStandupIngest`
   - `fabricStandupIngestStatus`
2. Type each method using interfaces from Tasks 1–2.
3. Keep names aligned to existing IPC naming style (`fabric:*` / `thoughtseed:*`).
4. Run `npm run typecheck`.

**Commit:** `feat: extend ipc contracts for standup review`

---

### Task 4: Add DB table for ingested artifact projection

**Files:**
- Modify: `src/db/database.ts`

**Steps:**
1. Add migration block for `fabric_standup_artifacts` with columns:
   - ids/hashes/schema/lane/member/project/task/date/status/file_path/raw_json/created_at/ingested_at.
2. Add unique index on `artifact_hash`.
3. Add query indexes on `(member_id, standup_date)`, `(project_id, standup_date)`, `(lane, standup_date)`.
4. Add `ensureColumn` calls for future-safe rollout if table already exists.
5. Run `npm run typecheck`.

**Commit:** `feat: add fabric standup artifact table`

---

### Task 5: Add DB table for current review state

**Files:**
- Modify: `src/db/database.ts`

**Steps:**
1. Add migration block for `fabric_standup_reviews` keyed by `artifact_id`.
2. Include `status`, `reason`, `reviewed_by_identity_id`, `reviewed_by_email`, `reviewed_at`.
3. Add indexes on `(status, reviewed_at)` and `(member_id, standup_date, status)`.
4. Ensure `artifact_id` references the artifact projection row id.
5. Run `npm run typecheck`.

**Commit:** `feat: add fabric standup review state table`

---

### Task 6: Add DB table for append-only review audit trail

**Files:**
- Modify: `src/db/database.ts`

**Steps:**
1. Add migration block for `fabric_standup_review_events`.
2. Columns: `event_id`, `artifact_id`, `decision_type`, `reason`, actor fields, timestamp, metadata JSON.
3. Add index `(artifact_id, created_at)`.
4. Keep this table append-only; no update helper in DB API.
5. Run `npm run typecheck`.

**Commit:** `feat: add standup review audit event table`

---

### Task 7: Add DB helper functions for artifact upsert/list/get

**Files:**
- Modify: `src/db/database.ts`

**Steps:**
1. Add `upsertFabricStandupArtifact(row)` with unique hash conflict handling.
2. Add `listFabricStandupArtifacts(filters)` supporting date/member/project/lane/status filters.
3. Add `getFabricStandupArtifact(artifactId)`.
4. Return typed rows matching `FabricStandupReviewItem`.
5. Run `npm run typecheck`.

**Commit:** `feat: add db helpers for standup artifacts`

---

### Task 8: Add DB helper functions for review state and events

**Files:**
- Modify: `src/db/database.ts`

**Steps:**
1. Add `setFabricStandupReviewState(input)` for latest state projection.
2. Add `appendFabricStandupReviewEvent(input)` for audit trail.
3. Add `listFabricStandupReviewEvents(artifactId)`.
4. Ensure updates set `updated_at` style timestamps consistently.
5. Run `npm run typecheck`.

**Commit:** `feat: add db helpers for review decisions`

---

### Task 9: Add artifact schema validator module

**Files:**
- Create: `src/main/fabric-standup-schema.ts`
- Test: `scripts/smoke-fabric-standup-schema.mjs`

**Steps:**
1. Create `isFabricStandupArtifact(value): value is FabricStandupArtifact`.
2. Validate required top-level and nested fields; reject malformed payloads.
3. Export `validateFabricStandupArtifact(value)` returning `{ ok, errors[] }`.
4. Add smoke script with one valid and two invalid fixtures.
5. Run failing smoke first: `npm run build:main && node scripts/smoke-fabric-standup-schema.mjs` (expect fail before implementation, pass after).

**Commit:** `test: add fabric standup schema validator smoke`

---

### Task 10: Add canonical hash helper for artifacts

**Files:**
- Create: `src/main/fabric-standup-hash.ts`
- Test: `scripts/smoke-fabric-standup-hash.mjs`

**Steps:**
1. Add `canonicalArtifactJson` and `hashFabricStandupArtifactPayload`.
2. Reuse deterministic hashing approach from bridge crypto style.
3. Ensure field-order changes do not change hash.
4. Add smoke assertions for deterministic hash behavior.
5. Run `npm run build:main && node scripts/smoke-fabric-standup-hash.mjs`.

**Commit:** `feat: add deterministic standup artifact hashing`

---

### Task 11: Add vault path resolver for artifact files

**Files:**
- Create: `src/main/fabric-standup-paths.ts`
- Modify: `src/main/fabric.ts`

**Steps:**
1. Add helper to resolve base vault root via existing repo-root logic.
2. Add directory builder:
   - `vault/fabric/standups/YYYY-MM-DD/<memberId>/<projectId>/`.
3. Add `buildArtifactFileName(artifact)` including timestamp + short hash.
4. Export path helpers for both writer and ingestor modules.
5. Run `npm run typecheck`.

**Commit:** `feat: add vault standup artifact path helpers`

---

### Task 12: Add atomic file writer helper for artifacts

**Files:**
- Create: `src/main/fabric-standup-writer.ts`

**Steps:**
1. Write artifacts using temp file + rename for atomicity.
2. Always include pretty JSON output plus final newline.
3. Return file path + byte size.
4. Surface explicit errors (no silent fallback).
5. Run `npm run typecheck`.

**Commit:** `feat: add atomic standup artifact writer`

---

### Task 13: Add immutable append-only decision log file writer

**Files:**
- Modify: `src/main/fabric-standup-writer.ts`

**Steps:**
1. Add writer for `vault/fabric/reviews/YYYY-MM-DD/review-events.ndjson`.
2. Append one line per decision event.
3. Include event hash and previous hash pointer for tamper-evident chain.
4. Reuse atomic append pattern.
5. Run `npm run typecheck`.

**Commit:** `feat: add review decision ndjson writer`

---

### Task 14: Add artifact builder from employee task reports (Paperclip lane)

**Files:**
- Create: `src/main/fabric-standup-artifact-builder.ts`
- Modify: `src/main/thoughtseed-bridge.ts`

**Steps:**
1. Add `buildStandupArtifactFromTaskReport(task, input, context)` function.
2. Set `lane: 'paperclip'` for employee task-report write path.
3. Populate summary/proof/sourceEvent fields from report payload.
4. Include admin employee-test-mode metadata if active.
5. Run `npm run typecheck`.

**Commit:** `feat: build paperclip standup artifacts from task reports`

---

### Task 15: Add artifact builder from Hermes history events

**Files:**
- Modify: `src/main/fabric-standup-artifact-builder.ts`
- Modify: `src/main/thoughtseed-bridge.ts`

**Steps:**
1. Add `buildStandupArtifactFromHistoryEvent(task, event, context)`.
2. Map event source `hermes|cambium` to `lane: 'hermes'`.
3. Generate artifact only for relevant completion/review-oriented events.
4. Preserve source correlation and actor identity.
5. Run `npm run typecheck`.

**Commit:** `feat: build hermes standup artifacts from history events`

---

### Task 16: Wire artifact writing into `reportThoughtseedFabricTask`

**Files:**
- Modify: `src/main/thoughtseed-bridge.ts`

**Steps:**
1. After successful local task mutation, build artifact from task report.
2. Hash artifact payload, write artifact JSON file, and store file path.
3. Upsert artifact row in `fabric_standup_artifacts`.
4. On write failure, record `handoff` with kind `standup_evidence_sync`.
5. Run `npm run typecheck`.

**Commit:** `feat: write standup artifacts on task report`

---

### Task 17: Wire artifact writing into Hermes event application path

**Files:**
- Modify: `src/main/thoughtseed-bridge.ts`

**Steps:**
1. In `applyFabricHistoryDirective`, when event type is review/completion-related, build artifact.
2. Write artifact to file and upsert DB projection.
3. Keep conflict handling behavior unchanged.
4. Record handoff on writer failure.
5. Run `npm run typecheck`.

**Commit:** `feat: write standup artifacts for hermes history events`

---

### Task 18: Add duplicate suppression by hash/date/member/task

**Files:**
- Modify: `src/main/fabric-standup-artifact-builder.ts`
- Modify: `src/db/database.ts`

**Steps:**
1. Before write, query for existing `artifact_hash`.
2. Skip duplicate write if identical artifact already ingested.
3. Keep event idempotency across refresh/replay cycles.
4. Add helper return flag `duplicate: true`.
5. Run `npm run typecheck`.

**Commit:** `feat: dedupe standup artifacts by deterministic hash`

---

### Task 19: Add ingestion scanner module for vault artifacts

**Files:**
- Create: `src/main/fabric-standup-ingest.ts`

**Steps:**
1. Implement recursive scan over `vault/fabric/standups/`.
2. Read `.json` files, parse, validate schema, and upsert projection table.
3. Return ingest summary: scanned/ingested/duplicates/invalid/errors.
4. Keep parse/validation failures isolated (continue scan).
5. Run `npm run typecheck`.

**Commit:** `feat: add standup artifact ingest scanner`

---

### Task 20: Add invalid artifact quarantine handling

**Files:**
- Modify: `src/main/fabric-standup-ingest.ts`

**Steps:**
1. Move invalid files to `vault/fabric/quarantine/` with reason suffix.
2. Write quarantine event to handoff record with `error`.
3. Include original file path and parse/validation errors.
4. Keep scanner resilient for batch runs.
5. Run `npm run typecheck`.

**Commit:** `feat: quarantine malformed standup artifacts`

---

### Task 21: Add ingest status persistence

**Files:**
- Modify: `src/main/fabric-standup-ingest.ts`
- Modify: `src/db/database.ts`

**Steps:**
1. Persist last ingest timestamp and counters under settings keys.
2. Add helper `getFabricStandupIngestStatus()`.
3. Include last error message and last scanned path.
4. Run `npm run typecheck`.

**Commit:** `feat: persist standup ingest status snapshot`

---

### Task 22: Add review-rule evaluator for approval readiness

**Files:**
- Create: `src/main/fabric-standup-review-rules.ts`
- Test: `scripts/smoke-fabric-standup-review-rules.mjs`

**Steps:**
1. Add `evaluateStandupArtifactForAutoSignals(artifact)` returning warnings/errors.
2. Rules: missing project/task, weak evidence, no summary, broken proof url format.
3. Output must not auto-approve; only advisory for admin reviewer.
4. Add smoke script with pass/warn/fail fixtures.
5. Run `npm run build:main && node scripts/smoke-fabric-standup-review-rules.mjs`.

**Commit:** `feat: add standup review rule evaluator`

---

### Task 23: Add review service for approve/reject/request-changes

**Files:**
- Create: `src/main/fabric-standup-review-service.ts`
- Modify: `src/db/database.ts`

**Steps:**
1. Add `reviewFabricStandupArtifact(input, reviewer)` service.
2. Validate state transitions and require `reason` for reject/request_changes.
3. Update review projection row.
4. Append immutable review-event row.
5. Append review event to NDJSON file log.
6. Run `npm run typecheck`.

**Commit:** `feat: add standup review decision service`

---

### Task 24: Add list API service for review queue

**Files:**
- Modify: `src/main/fabric-standup-review-service.ts`

**Steps:**
1. Add `listFabricStandupReviewQueue(filters)` for pending/all statuses.
2. Support filters: date range, member, project, lane, status, text search.
3. Include latest decision metadata and advisory rule output.
4. Keep paging params (`limit`, `cursor`) for large queues.
5. Run `npm run typecheck`.

**Commit:** `feat: add standup review queue listing service`

---

### Task 25: Add artifact detail API service

**Files:**
- Modify: `src/main/fabric-standup-review-service.ts`

**Steps:**
1. Add `getFabricStandupReviewItem(artifactId)` returning artifact + decisions + file path.
2. Include complete evidence list and source event metadata.
3. Include hermes/paperclip lane marker for parity checks.
4. Run `npm run typecheck`.

**Commit:** `feat: add standup review detail service`

---

### Task 26: Add main-process IPC handlers for standup review APIs

**Files:**
- Modify: `src/main/main.ts`

**Steps:**
1. Register:
   - `fabric:standupList`
   - `fabric:standupGet`
   - `fabric:standupReview`
   - `fabric:standupIngest`
   - `fabric:standupIngestStatus`
2. Wrap mutation calls with resilience error recording.
3. Ensure reviewer identity is taken from current session (`auth:session`) context.
4. Run `npm run typecheck`.

**Commit:** `feat: expose standup review ipc handlers`

---

### Task 27: Add preload bridges for standup review APIs

**Files:**
- Modify: `src/preload/preload.ts`

**Steps:**
1. Add typed renderer APIs mapping to new IPC handlers.
2. Keep method naming consistent with existing `window.plexus` style.
3. Rebuild preload typing satisfaction with `PlexusAPI`.
4. Run `npm run typecheck`.

**Commit:** `feat: expose standup review apis to renderer`

---

### Task 28: Add admin section key for review queue navigation

**Files:**
- Modify: `src/renderer/components/AdminDemoPanel.tsx`

**Steps:**
1. Add `AdminSection` key `fabricReview`.
2. Add tab metadata label/hint/icon entry.
3. Keep existing admin sections unchanged.
4. Run `npm run typecheck`.

**Commit:** `feat: add admin fabric review section shell`

---

### Task 29: Create admin review queue panel component scaffold

**Files:**
- Create: `src/renderer/components/AdminFabricReviewPanel.tsx`
- Modify: `src/renderer/theme.css`

**Steps:**
1. Create panel with page header + loading + error + empty states.
2. Fetch review list via `window.plexus.fabricStandupList`.
3. Render top metrics (pending/approved/rejected/changes requested).
4. Add base CSS layout classes for list/detail split.
5. Run `npm run typecheck`.

**Commit:** `feat: scaffold admin fabric review panel`

---

### Task 30: Add queue filter controls in review panel

**Files:**
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Add date, status, lane, member, project filters.
2. Add query input for task title/proof search.
3. Debounce query updates to avoid excess IPC calls.
4. Keep filter state in URL-like local state object.
5. Run `npm run typecheck`.

**Commit:** `feat: add filters to fabric review queue`

---

### Task 31: Add review list ledger rows with safety metadata

**Files:**
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Render each item with project/member/date/lane chips.
2. Show evidence strength and current review status.
3. Display warning badge when rule evaluator reports issues.
4. Make row selectable for detail view.
5. Run `npm run typecheck`.

**Commit:** `feat: render standup review queue ledger rows`

---

### Task 32: Add review detail drawer/pane

**Files:**
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Fetch selected artifact via `window.plexus.fabricStandupGet`.
2. Show summary text, evidence list, source event metadata.
3. Show file path and artifact hash in copy-safe fields.
4. Show decision history timeline.
5. Run `npm run typecheck`.

**Commit:** `feat: add standup review detail pane`

---

### Task 33: Add approve action workflow

**Files:**
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Add Approve button in detail pane.
2. Call `window.plexus.fabricStandupReview({ decisionType: 'approve' ... })`.
3. Refresh queue + detail on success.
4. Show inline success/error messages.
5. Run `npm run typecheck`.

**Commit:** `feat: add approve action to standup review`

---

### Task 34: Add reject action workflow with required reason

**Files:**
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Add reject modal/inline form.
2. Require non-empty reason before submit.
3. Submit review action with `decisionType: 'reject'`.
4. Refresh queue and show updated status chips.
5. Run `npm run typecheck`.

**Commit:** `feat: add reject action with reason`

---

### Task 35: Add request-changes action workflow

**Files:**
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Add request changes form with checklist + reason.
2. Submit `decisionType: 'request_changes'`.
3. Keep reason visible in queue/detail.
4. Refresh row state and timeline.
5. Run `npm run typecheck`.

**Commit:** `feat: add request changes action`

---

### Task 36: Wire admin panel section to render review component

**Files:**
- Modify: `src/renderer/components/AdminDemoPanel.tsx`

**Steps:**
1. Import `AdminFabricReviewPanel`.
2. Render component when `section === 'fabricReview'`.
3. Keep reports/export/backups/diagnostics flows unaffected.
4. Run `npm run typecheck`.

**Commit:** `feat: mount fabric review panel in admin workspace`

---

### Task 37: Add diagnostics rows for ingest/review pipeline health

**Files:**
- Modify: `src/renderer/components/AdminDiagnosticsPanel.tsx`

**Steps:**
1. Query `fabricStandupIngestStatus`.
2. Add rows for scanned count, invalid count, last ingest time, last error.
3. Add action button to trigger ingest manually.
4. Mask sensitive file paths if needed, consistent with diagnostics conventions.
5. Run `npm run typecheck`.

**Commit:** `feat: add standup ingest diagnostics`

---

### Task 38: Add employee-side review status chips in Fabric task cards

**Files:**
- Modify: `src/renderer/components/AgentFabricPanel.tsx`

**Steps:**
1. Extend task card view model to include latest review status (if available).
2. Display chips: `pending review`, `approved`, `changes requested`, `rejected`.
3. Keep employee copy non-technical; no raw review payload details.
4. Preserve existing write/report behavior.
5. Run `npm run typecheck`.

**Commit:** `feat: show review status in employee fabric cards`

---

### Task 39: Add report metrics for approved vs pending standups

**Files:**
- Modify: `src/renderer/components/Reports.tsx`
- Modify: `src/shared/types.ts`

**Steps:**
1. Add API field shape for review summary counters.
2. Show counters in Reports metric rail.
3. Keep existing KPI rendering unchanged.
4. Run `npm run typecheck`.

**Commit:** `feat: add standup approval counters to reports`

---

### Task 40: Integrate approval state into KPI compliance calculation

**Files:**
- Modify: `src/main/teamforge.ts`
- Modify: `src/main/main.ts`
- Modify: `src/shared/types.ts`

**Steps:**
1. Update KPI logic so daily proof compliance requires approved standup artifact.
2. Preserve fallback when no review pipeline is enabled yet.
3. Keep return shape stable (`MemberKpiSummary`).
4. Run `npm run typecheck`.

**Commit:** `feat: gate kpi standup compliance on approvals`

---

### Task 41: Create follow-up record when review is rejected

**Files:**
- Modify: `src/main/fabric-standup-review-service.ts`
- Modify: `src/db/database.ts`

**Steps:**
1. On reject/request_changes, write a handoff item for the assignee.
2. Include artifact id, task id, reason, and expected remediation.
3. Use existing handoff kind conventions; add new kind if needed.
4. Run `npm run typecheck`.

**Commit:** `feat: create follow-up handoffs from review decisions`

---

### Task 42: Enforce role guard for review actions

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/fabric-standup-review-service.ts`

**Steps:**
1. Reject review mutations unless current session role is `admin`.
2. Allow employees to read their own item status only (if implementing read endpoint for employee).
3. Return explicit authorization errors.
4. Run `npm run typecheck`.

**Commit:** `feat: enforce admin-only review mutations`

---

### Task 43: Add admin-employee-mode parity metadata to artifacts

**Files:**
- Modify: `src/main/fabric-standup-artifact-builder.ts`
- Modify: `src/shared/types.ts`

**Steps:**
1. Add optional `testModeContext` block (`isAdminEmployeeMode`, `adminIdentityId`, `emulatedIdentityId`).
2. Populate only in admin emulation lane.
3. Show this context in admin detail pane for debugging parity.
4. Run `npm run typecheck`.

**Commit:** `feat: annotate artifacts with admin emulation context`

---

### Task 44: Add lane parity checker utility (Hermes vs Paperclip)

**Files:**
- Create: `src/main/fabric-standup-parity.ts`
- Test: `scripts/smoke-fabric-standup-parity.mjs`

**Steps:**
1. Add function comparing same-member/day artifacts across lanes.
2. Flag mismatches in summary/proof/status fields.
3. Expose parity warning count for admin diagnostics/review panel.
4. Add smoke fixtures for matching and mismatching cases.
5. Run `npm run build:main && node scripts/smoke-fabric-standup-parity.mjs`.

**Commit:** `feat: add hermes-paperclip parity checker`

---

### Task 45: Surface parity warnings in admin review queue

**Files:**
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Add parity warning chip on rows with mismatch.
2. Show mismatch details in detail pane.
3. Keep warnings advisory; do not block actions.
4. Run `npm run typecheck`.

**Commit:** `feat: display lane parity warnings in review ui`

---

### Task 46: Add manual ingest trigger and progress state in UI

**Files:**
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Add `Run ingest` button and busy state.
2. Show ingest result summary toast/panel.
3. Refresh queue after ingest success.
4. Show explicit error panel on ingest failure.
5. Run `npm run typecheck`.

**Commit:** `feat: add manual ingest trigger to review queue`

---

### Task 47: Add review timeline rendering component reuse

**Files:**
- Create: `src/renderer/components/FabricReviewTimeline.tsx`
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Extract timeline UI for decision events.
2. Render actor, decision, reason, timestamp.
3. Reuse component in diagnostics detail if needed.
4. Run `npm run typecheck`.

**Commit:** `refactor: extract reusable fabric review timeline`

---

### Task 48: Add file-link open action for artifacts (admin only)

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/preload/preload.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/components/AdminFabricReviewPanel.tsx`

**Steps:**
1. Add admin-only IPC endpoint to open artifact folder/file.
2. Add button in detail pane to reveal artifact on disk.
3. Protect endpoint from non-admin invocation.
4. Run `npm run typecheck`.

**Commit:** `feat: add admin artifact file reveal action`

---

### Task 49: Add ingest + review smoke script for happy path

**Files:**
- Create: `scripts/smoke-fabric-standup-review-flow.mjs`

**Steps:**
1. Build fixtures for one paperclip artifact and one hermes artifact.
2. Run validator + ingest against temp fixture directory.
3. Assert queue shows `pending`.
4. Simulate approve action and assert state/event updates.
5. Run `npm run build:main && node scripts/smoke-fabric-standup-review-flow.mjs`.

**Commit:** `test: add standup review flow smoke script`

---

### Task 50: Add smoke script for reject/request-changes path

**Files:**
- Create: `scripts/smoke-fabric-standup-review-rejections.mjs`

**Steps:**
1. Ingest pending artifact fixture.
2. Submit reject decision with reason; assert handoff record created.
3. Submit request_changes decision; assert latest status transitions correctly.
4. Assert review event append-only count increments.
5. Run `npm run build:main && node scripts/smoke-fabric-standup-review-rejections.mjs`.

**Commit:** `test: add review rejection/request-changes smoke`

---

### Task 51: Add npm scripts for new smoke checks

**Files:**
- Modify: `package.json`

**Steps:**
1. Add scripts:
   - `smoke:fabric-standup-schema`
   - `smoke:fabric-standup-review`
2. Keep script names consistent with existing smoke pattern.
3. Ensure scripts call `npm run build:main` before node execution.
4. Run `npm run typecheck`.

**Commit:** `chore: add fabric standup smoke script commands`

---

### Task 52: Update Fabric panel copy for source-of-truth model

**Files:**
- Modify: `src/renderer/components/AgentFabricPanel.tsx`

**Steps:**
1. Update copy to clarify: daily proof is file-backed and admin-reviewed.
2. Keep language employee-friendly (no raw pipeline jargon).
3. Keep admin test-mode warning copy explicit for guarded override context.
4. Run `npm run typecheck`.

**Commit:** `copy: clarify file-backed standup review workflow`

---

### Task 53: Update Admin diagnostics copy for Hermes/Paperclip parity

**Files:**
- Modify: `src/renderer/components/AdminDiagnosticsPanel.tsx`

**Steps:**
1. Add short explanatory note about lane parity expectations.
2. Keep sensitive data masked; expose only actionable diagnostics.
3. Add quick-glance counters for `paperclip artifacts`, `hermes artifacts`, `parity mismatches`.
4. Run `npm run typecheck`.

**Commit:** `copy: add lane parity diagnostics framing`

---

### Task 54: Add operator runbook docs for daily review workflow

**Files:**
- Create: `docs/FABRIC_STANDUP_REVIEW.md`

**Steps:**
1. Document end-to-end flow:
   - write artifacts
   - ingest
   - review queue
   - approve/reject/request_changes
2. Document admin emulation flow and guarded override caveat.
3. Include troubleshooting matrix for common failures.
4. Include smoke command checklist.

**Commit:** `docs: add fabric standup review runbook`

---

### Task 55: Add release notes for structural Fabric approval workflow

**Files:**
- Modify: `CHANGELOG.md`

**Steps:**
1. Add entry summarizing new file-backed standup review architecture.
2. Call out Hermes/Paperclip lane parity behavior.
3. Call out admin review queue + audit trail.
4. Mention migration compatibility and no secret exposure.

**Commit:** `docs: add changelog entry for standup review architecture`

---

### Task 56: Final verification + merge-ready cleanup

**Files:**
- Modify: touched files from Tasks 1–55

**Steps:**
1. Run:
   ```bash
   npm run typecheck
   npm run lint
   npm run build:main
   npm run build:renderer
   npm run smoke:thoughtseed-bridge
   npm run smoke:fabric-standup-schema
   npm run smoke:fabric-standup-review
   ```
2. Verify admin flow:
   - ingest -> review -> approve/reject/request_changes.
3. Verify employee flow:
   - task update writes artifact and shows review status.
4. Verify admin employee-test-mode still follows guarded override constraints.
5. Stage and commit remaining implementation batch.

**Commit:** `chore: finalize fabric standup review architecture rollout`

---

## Suggested execution order

1. Tasks 1–13 (contracts + storage + writer primitives)  
2. Tasks 14–27 (write/ingest/review services + IPC)  
3. Tasks 28–48 (admin UI + employee integration + parity tooling)  
4. Tasks 49–56 (smoke coverage, docs, final validation)

