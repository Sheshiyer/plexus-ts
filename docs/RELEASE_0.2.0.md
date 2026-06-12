# Plexus v0.2.0 — Agent Fabric Release

> **Ship date:** 2026-06-12  
> **Branch:** `feat/forma-redesign` → `main` (pending merge)  
> **Tag target:** `v0.2.0`

---

## One-line pitch

Plexus graduates from a time tracker to a **personal agent cockpit** — every employee gets their own reskinned Paperclip agent fabric, daily standup KPIs, preference-driven context, and usage-learning suggestions, all wired to the TeamForge control plane with **zero device secrets**.

---

## What's new (for employees)

| Feature | What it does |
|---|---|
| **Agent Fabric Panel** | Live health dashboard showing your 6 agents (`ceo`, `scientist`, `engineer`, `designer`, `synthesist`, `hermes`), port status, bridge reachability, vault counts |
| **Today's Standup** | Auto-generated from `vault/standups/` + live KPI from D1 — yesterday, today plan, blockers, hours tracked, compliance status |
| **Standup Nudge** | In-app banner if you haven't tracked time today — same-day threshold, no guilt, just a prompt |
| **Preferences** | Set focus areas, working hours, CEO referral, comms prefs, notes — saved to Worker D1 and synced to your `agents/ceo/CONTEXT.md` |
| **Usage Learning** | Monthly agent suggestions based on 30-day activity patterns (focus blocks, burnout risk, compliance trends) |
| **Email-only login** | Cloudflare Access OTP — no tokens, no passwords, no device secrets |

## What's new (for the founder / CEO)

| Feature | What it does |
|---|---|
| **Weekly Member Reports** | `member-report-routine.sh` pushes per-employee KPI summary + full preferences snapshot to MultiCA |
| **Canonical D1 Source** | All time entries, preferences, and KPIs live in Worker D1 — single source of truth |
| **No Device Secrets** | Every config/credential flows from Worker after Access login; nothing stored locally |

---

## Architecture highlights

```
Plexus (Electron) ──Access JWT──▶ TeamForge Worker /v1/* ──▶ D1 (canonical)
         │                              │
         └─ local SQLite cache          └─ R2 (OTA artifacts)
         │
         └─ Paperclip runtime (:3100/:3101) — per-member agents
```

- **Local per-member**: each employee machine runs its own reskinned Paperclip
- **Worker-centric**: all auth, provisioning, KPIs, preferences served from `plexus-api.thoughtseed.space`
- **Paperclip cycle**: `sync-issues → member-context-sync → reconcile-local → usage-evolution → sync-heartbeats`

---

## Files changed

**Plexus (Electron client)**
- `src/main/fabric.ts` — standup reader + KPI fetcher
- `src/renderer/components/AgentFabricPanel.tsx` — standup tile + nudge banner
- `src/main/main.ts` — legacy bridge removed; usage signal emitter added
- `src/preload/preload.ts` — `memberKpi` + `emitUsageSignal` exposed
- `src/shared/types.ts` — `StandupData`, `MemberKpiSummary`, `UsageSignal` added
- `src/main/teamforge.ts` — context sync trigger + `emitUsageSignal` stub
- `package.json` — bumped to `0.2.0`

**Paperclip (agent fabric)**
- `scripts/standup-kpi-pipeline.sh` — Worker-driven standup generation
- `scripts/member-report-routine.sh` — KPI + preferences in weekly report
- `scripts/member-context-sync.sh` — **new** — syncs prefs to `CONTEXT.md`
- `scripts/usage-evolution.sh` — **new** — 30-day usage insights + suggestions
- `scripts/paperclip-cycle.sh` — integrated context-sync + usage-evolution steps
- `.thoughtseed/usage-signals/usage-1718112000.json` — seed data for testing

**Deleted (legacy bridge)**
- `src/bridge/multica.ts`
- `src/bridge/paperclip.ts`
- `src/main/auto-sync.ts`
- `src/renderer/components/BridgePanel.tsx`

---

## Verification checklist

- [ ] `npx tsc --noEmit` passes (0 errors)
- [ ] `npm run build` succeeds
- [ ] `npm run dev` opens Agent Fabric panel with standup tile
- [ ] Standup nudge appears when no time tracked today
- [ ] Preferences save → D1 → `CONTEXT.md` sync (check `agents/ceo/CONTEXT.md`)
- [ ] `paperclip-cycle.sh --dry-run` includes member-context-sync + usage-evolution steps
- [ ] `standup-kpi-pipeline.sh --dry-run` generates markdown at `vault/standups/`
- [ ] `member-report-routine.sh --dry-run` includes KPI + preferences snapshot

---

## Known limitations / next wave

1. **Phase 5 — OTA updates**: blocked on Apple Developer ID + notarization setup
2. **Context sync auth**: `member-context-sync.sh` requires valid `CF_ACCESS_JWT` or `tf.accessJwtEnc` in Plexus DB
3. **Usage signal accumulation**: currently writes to `.thoughtseed/usage-signals/`; long-term may move to Worker D1
4. **CEO preference visibility**: weekly report renders full `preferences_json` verbatim; curated snapshot may be desired later

---

## Marketing / merch angles

- **"Your personal agent fabric"** — every employee gets 6 agents, not just a time tracker
- **"Zero secrets, full context"** — email-only login, all config from the cloud
- **"Standups that write themselves"** — auto-generated from your actual tracked time
- **"Agents that learn you"** — monthly suggestions based on your real work patterns

---

## Merge plan

1. Merge `feat/forma-redesign` → `main`
2. Tag `v0.2.0`
3. Build release artifacts (`npm run build`)
4. Upload to R2 `teamforge-artifacts` for OTA (once Phase 5 unblocks)
5. Announce in TeamForge console + MultiCA founder digest
