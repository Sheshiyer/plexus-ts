# Batch 28 Design-System Parity Foundation

Date: 2026-07-10
Branch: `codex/plexus-batch28-design-system-parity`
Base: `origin/main` at `ac48c407758e6535c71cf00ffda7e6c787d8fe3b`
Scope: `#50` P7-W1-T001 through P7-W1-T008.

## Scope

- Added a shared viewport registry for Focus, Work Records, Projects, Reports, Export, Fabric, Co-working, Backups, Preferences, and Admin.
- Standardized `PageHeader` copy/right wrappers so right-slot actions have a stable wrapping target.
- Hardened `CommandDock`, `MetricRail`, `LedgerRail`, `StatusChip`, and overflow text contracts in the shared Plexus design-system layer.
- Moved the Agent Fabric assignment and workspace connection slice from inline grids/stat blocks onto shared named primitives.
- Added a renderer design-system contract test for viewport mapping, status matrix, overflow affordance, header wrapping, CSS invariants, and Fabric adoption.

## Boundary

This is deterministic source/static proof only. It does not claim screenshot fixture coverage, packaged Electron proof, live bridge proof, or visual QA proof. `P7-W2-T012` screenshot fixture harness remains outside this W1 foundation batch.

## Source Matrix

| Task | Source proof |
| --- | --- |
| P7-W1-T001 | `PAGE_VIEWPORTS` and `PageViewport` in `src/renderer/components/PlexusUI.tsx` |
| P7-W1-T002 | `px-page-copy` / `px-page-right` wrappers in `src/renderer/components/ui.tsx` and `src/renderer/theme.css` |
| P7-W1-T003 | `.pxds-command-dock` wrapping and 40px dock button target in `src/renderer/theme.css` |
| P7-W1-T004 | `OverflowText` plus title preservation in `src/renderer/components/PlexusUI.tsx` |
| P7-W1-T005 | `PlexusStatusState` and `PLEXUS_STATUS_TONE` matrix in `src/renderer/components/PlexusUI.tsx` |
| P7-W1-T006 | `.pxds-metric` sizing and tabular value contract in `src/renderer/theme.css` |
| P7-W1-T007 | `.pxds-ledger-rail` named grid areas and 220px desktop main-column floor in `src/renderer/theme.css` |
| P7-W1-T008 | Agent Fabric task and connection adoption in `src/renderer/components/AgentFabricPanel.tsx` |

## Verification

- `npm run typecheck` passed.
- `./node_modules/.bin/vitest run test/renderer/design-system-contract.test.tsx --no-file-parallelism` passed 1 file / 6 tests.
- `npm run lint -- --quiet` passed.
- `./node_modules/.bin/vitest run test/assistant/today-renderer-contract.test.ts test/assistant/temperance-dispatch-renderer-contract.test.ts test/identity/clio-identity-copy.test.ts test/coworking/coworking-room-stage-ui.test.ts --no-file-parallelism` passed 4 files / 8 tests.
- `git diff --check` passed.
- `npm run test:assistant` passed 83 files / 218 tests.
- `npm run build:renderer` passed.
- `npm run verify:all` passed, including lint, typecheck, no-placeholder scan, security audit, fuse/CSP/release-evidence checks, assistant/coworking/identity tests, production smokes, and renderer build.

## Known Follow-Up Surface

- Co-working, onboarding, and timer still contain bespoke page-specific rails; those are mapped as later P7 slices rather than pulled into this W1 foundation batch.
- The old `.px-fabric-connection-grid` CSS remains available for any untouched surface, but Agent Fabric no longer renders the connection section through `.px-stat` blocks.
