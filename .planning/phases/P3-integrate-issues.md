# Phase P3 — Integrate Issues

**Status**: complete
**Combo**: te-plan + native
**Parallelism**: T7 parallel with T8/T9

## Goal

Connect all remaining work to the GitHub Project board and refresh the
next-wave orchestrator.

## Tasks

- [x] T7: Add RW-011 and RW-014 to the Plexus project board
- [x] T8: Create GH issues for ISA gap clusters
- [x] T9: Reset NEXT-WAVE.json with fresh phase structure

## Acceptance Criteria

- RW-011 and RW-014 appear on the Plexus project board
- Each ISA gap cluster has a corresponding GH issue
- `temperance-next-wave --cwd .` picks up new phases

## Dependencies

- T2 (project board must exist)
- T4 (phase definitions must exist)
