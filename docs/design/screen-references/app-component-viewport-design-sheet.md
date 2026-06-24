# Plexus App Component Viewport Design Sheet

Date: 2026-06-24
Purpose: extend the Settings component-sheet method across the rest of Plexus.
Scope: all authenticated pages except Settings, which already has its own component sheet.
Target files:
- `src/renderer/App.tsx`
- `src/renderer/components/Timer.tsx`
- `src/renderer/components/TimeEntryList.tsx`
- `src/renderer/components/ProjectManager.tsx`
- `src/renderer/components/Reports.tsx`
- `src/renderer/components/ExportPanel.tsx`
- `src/renderer/components/AgentFabricPanel.tsx`
- `src/renderer/components/CoWorkingPanel.tsx`
- `src/renderer/components/BackupPanel.tsx`
- `src/renderer/components/PreferencesPanel.tsx`
- `src/renderer/components/AdminDemoPanel.tsx`
- `src/renderer/theme.css`

## Diagnosis

Plexus already has a strong shell: top HUD, left nav, hard edges, mono telemetry, gun-metal surfaces, chartreuse/mint signal, and scanline atmosphere. The messiness comes from page bodies drifting apart:

- Too many one-off inline grids and flex rows.
- Some pages feel like instruments while others feel like utility forms.
- Data tables, stat cards, empty states, and action clusters are inconsistent.
- Red/error tone is overused for missing setup states.
- Utility pages lack authored composition.
- Long project names, URLs, emails, ids, and repo strings need a shared overflow contract.
- Page density is uneven: Focus is rich, Export and Backups are bare, Fabric is crowded, Admin is chip-heavy.

The cleanup should not replace the FORMA/Plexus language. It should turn every page into a recognizable mode of the same operating instrument.

## Shared Tokens

Use the same token contract as the Settings component sheet:

- `--bg-0 #001417`
- `--bg-1 #00272B`
- `--bg-2 #012F34`
- `--bg-3 #06393F`
- `--accent #E0FF4F`
- `--mint #D6FFF6`
- `--violet` only as faint field trace
- `--rose` only for real errors, denied permissions, inaccessible proof, destructive action confirmation
- hard edges, 1px hairlines, no rounded card language
- inset glow only, no outer neon
- Geist for text, Geist Mono for labels, ids, values, and timers

## App-Wide Cleanup Rules

### 01. Page Viewport Contract

Each page gets a named viewport archetype:

- Focus: command viewport
- Work Records: ledger viewport
- Projects: proof coverage viewport
- Reports: review viewport
- Export: utility extraction viewport
- Fabric: operations viewport
- Co-working: social floor viewport
- Backups: restore vault viewport
- Preferences: member profile viewport
- Admin: oversight viewport

Each viewport has:

- compact `PageHeader`
- one primary composition band
- one secondary scan/detail band
- action dock in a stable slot
- consistent empty, loading, degraded, and success states

### 02. Page Header Contract

Keep `PageHeader`, but standardize:

- title: 18-22px, never hero sized
- subtitle: mono, status-oriented, not marketing copy
- right slot: action dock only, no loose labels
- saved/dirty/offline chips use `StatusChip`, not ad hoc text

### 03. InstrumentPanel

New shared pattern for primary page content.

Anatomy:
- section label
- short operating state
- optional command dock
- body grid
- crosshair corners
- optional field trace

Use for:
- Focus timer and activity hub
- Reports summary
- Fabric operations
- Co-working floor
- Admin workspace overview

### 04. LedgerRail

A replacement for repeated `px-row` variants.

Anatomy:
- index or status dot
- icon/swatch
- primary text
- secondary metadata
- status chip
- value
- action slot

Use for:
- Work Records rows
- Projects rows
- Reports project breakdown rows
- Backup snapshots
- Fabric handoffs
- Admin identities

Overflow contract:
- primary text can wrap to two lines on utility and admin pages
- metadata uses middle truncation for repo names, endpoints, ids, and emails
- action slot never compresses the main text below 220px on desktop
- rows use `minmax(0, 1fr)` for text columns

### 05. MetricRail

A replacement for loose `StatCard` clusters and generic KPI cards.

Anatomy:
- mono label
- primary numeric or state
- optional hint
- optional spark/mini trace

Use for:
- Focus telemetry
- Reports KPI
- Fabric health summary
- Admin totals

Tone rules:
- accent for active/verified/healthy
- mint for neutral available
- rose only for actual failure
- missing setup is `warning` or `idle`, not always red

### 06. CommandDock

Stable action surface.

Variants:
- page actions: refresh, sync, export, backup
- record actions: add, delete, restore
- runtime actions: pause, resume, stop
- bridge actions: heartbeat, poll, sync

Rules:
- grouped by intent
- wraps to two rows before clipping
- icon plus text for main actions
- disabled actions remain visible

### 07. FieldDock

Shared form pattern for date ranges, filters, export format, and preferences.

Rules:
- label above input
- compact field widths with responsive fallback
- no ad hoc inline style grids when a shared class can hold it
- validation shown as inline degraded state

### 08. EmptyStatePanel

Empty states should look designed, not like missing content.

Variants:
- no records
- no verified projects
- no rooms
- no backups
- no fabric tasks
- worker unreachable

Rules:
- one icon/sigil
- one concise message
- optional primary action
- no long paragraphs

### 09. DegradedStatePanel

A consistent surface for offline, failed, stale, missing repo, and inaccessible proof states.

Rules:
- not every degraded state is red
- `rose` only for true failure or denied access
- missing setup is chartreuse warning or low-contrast idle
- include last good timestamp when available
- include retry action when possible

### 10. Viewport Trace Layer

Pages can share subtle field traces:

- Focus: active session orbit and recent work pulses
- Work Records: ledger scan line
- Projects: repo proof graph
- Reports: evidence/review path
- Fabric: service topology
- Co-working: floor map
- Backups: snapshot stack
- Preferences: member signal profile
- Admin: workspace coverage map

Trace layer stays behind content and never reduces legibility.

## Page Viewport Recipes

### Focus - Command Viewport

Current strengths:
- strong timer panel
- activity hub already feels brand-native

Cleanup:
- Make start state and running state share the same component anatomy.
- Use `CommandDock` for start/pause/resume/stop.
- Turn today's rows into `LedgerRail`.
- Move repo-required warnings into `DegradedStatePanel`.

Components:
- FocusCommandPanel
- ActiveSessionDock
- ActivitySignalPanel
- TodayLedger
- FocusMetricRail

### Work Records - Ledger Viewport

Current issue:
- Sparse list page with loose date controls.

Cleanup:
- Date range becomes `FieldDock`.
- Manual record action joins header `CommandDock`.
- Rows become `LedgerRail`.
- Evidence status uses `StatusChip`.
- Empty state includes path to Focus/Projects.

Components:
- LedgerFilterDock
- ManualRecordModal
- WorkRecordRail
- EvidenceStatusChip

### Projects - Proof Coverage Viewport

Current issue:
- Project rows work but feel transactional and red-heavy.

Cleanup:
- Add proof coverage summary: verified, needs repo, inaccessible, total.
- Rows become `ProjectProofRail`.
- `needs repo` is warning/idle, not rose unless inaccessible.
- Add repo modal as a focused verification chamber.

Components:
- ProjectCoverageStrip
- ProjectProofRail
- RepoVerifyModal
- RepoOptionField

### Reports - Review Viewport

Current issue:
- Report cards and stat rows feel generic.

Cleanup:
- Convert KPI strip to `MetricRail`.
- Make report summary an evidence review band.
- Chart and breakdown sit in a two-zone review viewport.
- Empty/loading/degraded states occupy the same frame.

Components:
- ReviewModeDock
- KpiMetricRail
- EvidenceSummaryPanel
- ReviewChartPanel
- ProjectAllocationLedger

### Export - Utility Extraction Viewport

Current issue:
- Bare utility form feels under-designed.

Cleanup:
- Treat export as a data extraction instrument.
- One primary extraction chamber with range, format, and command dock.
- Format details become compact output schema rails.
- Success/error state appears in a consistent `DegradedStatePanel` or `StatusChip`.

Components:
- ExtractionChamber
- ExportRangeDock
- ExportFormatToggle
- OutputSchemaRail

### Fabric - Operations Viewport

Current issue:
- Operationally rich but crowded and inconsistent.

Cleanup:
- Split into status topology, task directives, runtime health, retry queue.
- Replace loose stat cards with `MetricRail`.
- Replace random panels with `OperationsBand`.
- Keep Hermes tasks as command cards, but tighten hierarchy.

Components:
- FabricTopologyPanel
- RuntimePortRail
- FabricMetricRail
- HermesTaskDirectiveCard
- HandoffRetryLedger
- BridgeHealthDock

### Co-working - Social Floor Viewport

Current strength:
- Has a distinct page concept.

Cleanup:
- Make floor, project rooms, and lounge feel like one social map.
- Standardize room cards with status chips and action dock.
- Use a floor map trace layer.
- Keep offline failures calm and actionable.

Components:
- FloorPresenceMap
- PresenceAvatarTile
- ProjectRoomCard
- LoungeControlStrip
- MediaPreviewDock

### Backups - Restore Vault Viewport

Current issue:
- Functional but too bare.

Cleanup:
- Create a vault panel with latest backup, retention, next auto-backup hint.
- Snapshot rows become `LedgerRail`.
- Restore confirmation becomes a high-friction destructive modal.

Components:
- BackupVaultSummary
- SnapshotRail
- RestoreConfirmModal

### Preferences - Member Profile Viewport

Current issue:
- Similar to Settings forms, but less authored.

Cleanup:
- Treat preferences as member signal profile.
- Group into working style, comms cadence, fabric context.
- Use `FieldDock` and `SegmentToggle` consistently.
- Add dirty/saved state in the header and footer.

Components:
- PreferenceProfilePanel
- WorkingStyleFieldGroup
- CadenceToggleGroup
- FabricContextNotes

### Admin - Oversight Viewport

Current issue:
- Project overview is chip-heavy and rose-heavy.

Cleanup:
- Replace project chip cloud with coverage rails and grouped proof states.
- Use `warning` for needs repo and `rose` for inaccessible/failed only.
- Identities list becomes `LedgerRail`.
- Employee onboarding oversight becomes `SetupStepTile` reuse from Settings sheet.

Components:
- WorkspaceCoverageMap
- ProjectProofGroup
- IdentityLedger
- EmployeeSetupInspector

## Visual Sheet Composition

Generate a Figma-style design sheet, not a full app screenshot.

Sections:

1. `01 SHELL VIEWPORTS`
   - authenticated shell frame
   - PageHeader contract
   - CommandDock
   - FieldDock

2. `02 WORK MODES`
   - Focus command viewport
   - Work Records ledger viewport
   - Projects proof coverage viewport

3. `03 REVIEW + EXTRACTION`
   - Reports review viewport
   - Export extraction viewport
   - Backups vault viewport

4. `04 OPERATIONS + SOCIAL`
   - Fabric operations viewport
   - Co-working social floor viewport
   - Admin oversight viewport

5. `05 SHARED COMPONENTS`
   - LedgerRail
   - MetricRail
   - StatusChip state matrix
   - EmptyStatePanel
   - DegradedStatePanel

6. `06 OVERFLOW LAB`
   - long project names
   - long repo full names
   - long emails
   - long endpoints
   - long task directive titles

## Implementation Order

1. Add shared CSS/component primitives without changing behavior.
2. Convert Work Records, Projects, Export, and Backups first.
3. Convert Reports and Admin next because they need status-tone corrections.
4. Convert Fabric and Co-working last because they are broader, richer pages.
5. Run typecheck and renderer build after each page group.

## Non-Goals

- No new product model or workflow behavior.
- No hidden data remapping.
- No full rebrand away from FORMA/Plexus.
- No generic SaaS dashboard bento grid.
- No rounded glass card style.
- No changing authentication, repo-proof, or bridge semantics.
