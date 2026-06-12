# Changelog

## [0.2.0] — 2026-06-12

### Agent Fabric (Phase 6–9)

**Phase 6 — Agent Fabric Health Panel**
- Live port tiles for `:3100` (Paperclip UI) and `:3101` (runtime adapter) with latency
- 6 agent health tiles (`ceo`, `scientist`, `engineer`, `designer`, `synthesist`, `hermes`) with heartbeat freshness
- Bridge status tile showing MultiCA reachability
- Vault counts (standups + handoffs)
- Shell `health-check.sh` output streamed into panel
- Auto-refresh every 10s with pause/resume control

**Phase 7 — Per-member Provisioning (email-only)**
- Worker `GET /v1/member/provision` returns member bundle
- Plexus `memberSetup()` drives `setup-member.sh --id <id> --name <name>`
- Auto-provision on Cloudflare Access login
- Legacy `multicaToken` / `paperclipPath` / `multicaApiUrl` device settings deleted

**Phase 8 — Standup + KPI Loops**
- Worker `GET /v1/member/kpi` returns canonical D1 `time_entries` (today/week seconds + project breakdown + compliance)
- `standup-kpi-pipeline.sh` rewritten: reads Worker KPI, generates `vault/standups/<member>-<date>.md`
- `AgentFabricPanel` shows "Today's standup" tile with yesterday/today/blockers + hours + compliance
- Standup nudge banner (rose) appears when `standupCompliant=false` — same-day threshold
- `member-report-routine.sh` reads D1 KPIs + pushes weekly report to MultiCA
- Founder report includes per-employee KPI hours summary + compliance flag

**Phase 9 — Preferences + Usage Learning**
- `PreferencesPanel` (focus areas, working hours, CEO referral, comms prefs, notes)
- Worker `PUT /v1/member/preferences` → D1 `employee_preferences` (migration `0008` applied live)
- `member-context-sync.sh` syncs Worker prefs into `agents/ceo/CONTEXT.md` (integrated into `paperclip-cycle.sh`)
- `usage-evolution.sh` aggregates 30-day usage signals, writes insights + agent suggestions to `CONTEXT.md`
- Plexus emits usage signal on timer stop (active project, daily seconds, compliance, session duration)
- Founder weekly report includes full `preferences_json` verbatim per member

### Legacy Bridge Retirement
- Deleted: `src/bridge/multica.ts`, `src/bridge/paperclip.ts`, `src/main/auto-sync.ts`, `src/renderer/components/BridgePanel.tsx`
- Removed types: `BridgeConfig`, `PaperclipSyncPayload`, `MultiCAMessage`
- Added types: `StandupData`, `MemberKpiSummary`, `UsageSignal`
- No device secrets stored in Plexus settings; all config flows from Worker after Access login

### Paperclip Cycle Integration
- `paperclip-cycle.sh` now runs: sync-issues → member-context-sync → reconcile-local → usage-evolution → sync-heartbeats
- Best-effort, non-blocking steps; skips gracefully when auth or data is missing

### Build
- `npx tsc --noEmit` passes with zero errors
- Electron builder configured for macOS (DMG), Windows (NSIS), Linux (AppImage)

## [0.1.0] — 2026-05-15

### Foundation
- FORMA / cambium redesign — design tokens, primitives, all screens, GLSL splash shader
- Brand assets — GPT-Image-2 icon set, brand board, Swiss poster, DMG background
- Phase 0 — de-billing; internal employee model
- Phase 1 — email login + TeamForge project sync
- Phase 2 — time write-back to Worker
- Phase 3 — Clockify backfill into D1
- Phase 4 — Cloudflare Access OTP sign-in
- Auto-backup + restore system
- REST API server on `:31339`
