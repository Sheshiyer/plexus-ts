# Task Graph — Plexus Operational Infrastructure

## Phase 1: Register (parallel-safe, no dependencies)

### T1 — Speculum Registration
- **What**: Add plexus-ts to `~/.claude/MEMORY/STATE/speculum-mini.txt`
- **Acceptance**: `speculum-mini.txt` contains a plexus-ts entry with correct path, status, label
- **Combo**: native (single file write)
- **Skill**: none needed

### T2 — GitHub Project Board Creation
- **What**: Create "Plexus — Venture-OS Roadmap" GitHub Project board via `gh project create`
- **Acceptance**: Board exists, linked to Sheshiyer/plexus-ts repo
- **Combo**: native (gh CLI)
- **Skill**: none needed

### T3 — ISA Audit (extract unchecked ISCs)
- **What**: Parse ISA.md for all unchecked `[ ]` ISCs, produce `.planning/isa-gaps.md`
- **Acceptance**: Every unchecked ISC listed with its ID, description, and section
- **Combo**: native (grep/parse)
- **Skill**: none needed

## Phase 2: Bootstrap GSD (depends on T3)

### T4 — GSD Phase Definition
- **What**: Create `.planning/phases/` with phase definitions derived from T3's ISA gaps + 2 open GH issues
- **Acceptance**: Each phase has: id, title, ISCs covered, GH issues linked, acceptance criteria
- **Combo**: te-plan (reasoning about grouping)
- **Skill**: none needed

### T5 — Update STATE.md
- **What**: Move STATE.md from "bootstrap, 0%" to first active phase with proper progress %
- **Acceptance**: STATE.md reflects actual phase, progress calculated from ISA completion
- **Combo**: native (file write)
- **Skill**: none needed

### T6 — Wire Plan-Issue-Sync for Plexus
- **What**: Ensure plan-issue-sync covers plexus-ts planning docs. Either add plexus-ts to the script's `projectsRoots` or verify vault targeting already covers it.
- **Acceptance**: `bun ~/.temperance_engine/scripts/plan-issue-sync.ts --dry-run` shows plexus planning docs
- **Combo**: native (config check + possible edit)
- **Skill**: none needed

## Phase 3: Integrate Remaining Issues (depends on T2, T4)

### T7 — Add Open Issues to Project Board
- **What**: Add RW-011 and RW-014 to the new Plexus project board
- **Acceptance**: Both issues appear on the board with correct status
- **Combo**: native (gh CLI)
- **Skill**: none needed

### T8 — Create Issues for ISA Gaps
- **What**: For each ISA gap cluster (grouped by section), create a GH issue linked to the ISA
- **Acceptance**: Each ISA gap has a corresponding GH issue, linked to project board
- **Combo**: te-plan (grouping decisions)
- **Skill**: none needed

### T9 — NEXT-WAVE.json Reset
- **What**: Replace stale NEXT-WAVE.json with fresh wave pointing at Phase 1 tasks
- **Acceptance**: `temperance-next-wave --cwd .` picks up new phase structure
- **Combo**: native (file write)
- **Skill**: none needed

## Phase 4: Verify + Close (depends on all above)

### T10 — End-to-End Verification
- **What**: Run `temperance-next-wave --cwd .` and verify it dispatches correctly. Check speculum shows plexus. Check GH project board has items.
- **Acceptance**: All three surfaces (speculum, GSD, GH board) show consistent state
- **Combo**: te-validate
- **Skill**: none needed

### T11 — ORCHESTRATION.json Refresh
- **What**: Regenerate ORCHESTRATION.json with fresh fingerprints and new phase structure
- **Acceptance**: Orchestration state is `ready` not `awaiting_approval` with expired timestamp
- **Combo**: native (temperance-next-wave regeneration)
- **Skill**: none needed

## Dependency Graph

```
T1 ──────────────────────────────────────┐
T2 ──────────────────────────────────────┤
T3 ──→ T4 ──→ T5 ────────────────────────┤
       T4 ──→ T6 ────────────────────────┤
T2 ──→ T7 ───────────────────────────────┤
T4 ──→ T8 ───────────────────────────────┤
       T4 ──→ T9 ────────────────────────┤
                                         └─→ T10
                                         └─→ T11
```

## Parallelism

- **Wave 1** (parallel): T1, T2, T3 — no dependencies, can run concurrently
- **Wave 2** (sequential): T4 — needs T3 output
- **Wave 3** (parallel): T5, T6, T7, T8, T9 — all depend on T4 (and T2 for T7)
- **Wave 4** (parallel): T10, T11 — verification

## SKILL GAPS

None. All tasks use native CLI tools (gh, file writes, grep) or existing
Temperance Engine scripts. No specialized skills needed.
