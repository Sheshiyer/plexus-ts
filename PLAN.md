# Plexus Delivery Plan — Swarm Architect

## Discovery Summary

- **Planning depth:** production
- **Delivery mode:** production
- **Release model:** single milestone → phased rollout
- **Quality bar:** type-safe, tested, secure, observable
- **Team topology:** solo agent (Hermes) with multi-skill routing
- **External constraints:** Electron security checklist, SQLite WAL, contextIsolation

## Assumptions & Constraints

1. Paperclip vault path is local filesystem access (not remote)
2. MultiCA bridge uses REST API with Bearer token auth
3. R2 uses S3-compatible API (Cloudflare)
4. All bridge ops are opt-in via Settings
5. macOS primary target (tray title, hiddenInset titlebar)

## Agent Ownership

| Role | Owner | Scope |
|------|-------|-------|
| Planner / Orchestrator | Hermes (this session) | Architecture, plan, issue graph |
| UI / App Implementation | Hermes | React renderer, shaders, charts |
| Cloud / Backend | Hermes | Bridge adapters, SQLite, IPC |
| Validation | Hermes | Build verification, manual QA |

## Phase Map

### Phase 1 — Foundation (COMPLETE)
- Wave 1: Electron scaffold + TypeScript + Vite
- Wave 2: SQLite schema + CRUD
- Wave 3: React UI shell + navigation

### Phase 2 — Core Time Tracking (COMPLETE)
- Wave 1: Timer engine (start/stop/continue)
- Wave 2: Project + entry CRUD
- Wave 3: Reports (daily/weekly/monthly)

### Phase 3 — Ecosystem Bridges (COMPLETE)
- Wave 1: Paperclip markdown sync
- Wave 2: MultiCA REST upstream
- Wave 3: R2 S3 archival

### Phase 4 — Polish & Platform (COMPLETE)
- Wave 1: Splash screen + Ribbons shader
- Wave 2: System tray + global shortcuts
- Wave 3: Idle detection + auto-sync

### Phase 5 — Hardening (PENDING)
- Wave 1: Unit tests (db, bridges)
- Wave 2: Error boundaries + retry logic
- Wave 3: Signed builds + auto-update

## Verification Strategy

- Build passes: `npm run build:main && npm run build:preload && npx vite build`
- Type safety: `tsc --noEmit`
- Manual QA: Timer → Entry → Report → Export → Bridge

## Risks & Fallbacks

| Risk | Mitigation |
|------|------------|
| Native module ABI mismatch on Electron upgrade | Pin Electron version; use electron-rebuild |
| SQLite corruption on power loss | WAL mode + atomic writes |
| Bridge auth token expiry | Settings UI for re-auth; error messages |
| Large entry list performance | Indexed queries; pagination (future) |

---

## GitHub Sync

Repo: `https://github.com/Sheshiyer/plexus-ts`
Branch: `main`
All work committed directly to main (solo dev).
