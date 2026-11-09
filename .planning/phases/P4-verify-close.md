# Phase P4 — Verify + Close

**Status**: complete
**Combo**: te-validate
**Parallelism**: T10 and T11 parallel

## Goal

Verify the entire operational infrastructure is wired end-to-end.

## Tasks

- [x] T10: End-to-end verification (speculum + GSD + GH board consistency)
- [x] T11: ORCHESTRATION.json refresh with fresh fingerprints

## Acceptance Criteria

- `temperance-next-wave --cwd .` dispatches correctly
- speculum shows plexus-ts with correct state
- GH project board has all items
- ORCHESTRATION.json state is `ready` with valid fingerprints

## Dependencies

- All previous phases complete
