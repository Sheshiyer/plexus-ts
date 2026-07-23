# Plexus — Historical Code & Security Review

**Date:** 2026-06-11 · **Scope:** full app (Electron 33 + Vite/React + sqlite3) with focus on the uncommitted working tree (ESM migration + main-process wiring) · **Method:** Electron-aware security recon + 7-angle diff review (line-by-line, removed-behavior, cross-file trace, reuse, simplification, efficiency, altitude) with per-finding verification.

> **Authority refresh (2026-07-10):** This is a dated review, not the current
> architecture contract. Direct MultiCA, Paperclip-report, and employee-side R2
> bridge implementations described below were removed. Current member reporting
> is bridge-first to Hermes; the Workspace Worker is a daily fallback only after
> bridge failure, and Fabric/Paperclip remains optional enrichment. Current token
> custody uses Electron `safeStorage`. See
> [`docs/architecture/HERMES_REPORTING_CONTRACT.md`](docs/architecture/HERMES_REPORTING_CONTRACT.md).

## Executive summary

The app's renderer/main boundary is well built — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a narrow promise-based `contextBridge` API. The serious issues were all on the **other** trust boundaries: an unauthenticated REST API bound to all interfaces, a renderer-reachable backup-restore IPC that accepted arbitrary filesystem paths, and unsanitized interpolation into Paperclip vault filenames/markdown. All three HIGH findings plus one CONFIRMED runtime bug were **fixed this session** (see "Fixes applied"). Medium/low findings are documented for follow-up.

## Severity table

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| H1 | HIGH | `src/main/api-server.ts:11,96` | `:31339` API: `cors()` any-origin, `listen(PORT)` on 0.0.0.0, zero auth → leaked timer state, projects, entries, reports to any local process or LAN peer | **FIXED** |
| H2 | HIGH | `src/main/main.ts:309` + `src/main/backup.ts:78` | `backup:restore` IPC accepted an arbitrary absolute path and copied it over the live DB (renderer-reachable path traversal) | **FIXED** |
| H3 | HIGH | `src/bridge/paperclip.ts:22,45` | `${memberId}-${month}.md` filename unsanitized (traversal via memberId); entry description/projectId interpolated raw into markdown table (`\|`/newline injection) | **FIXED** |
| B1 | HIGH (bug) | `src/main/auto-sync.ts:18,32` | `await import('../db/database')` missing `.js` extension → `ERR_MODULE_NOT_FOUND` at runtime the moment auto-sync fires (ESM migration miss) | **FIXED** |
| M1 | MED | Deleted legacy bridge settings | MultiCA and direct-R2 credentials were stored in plaintext settings. | **REMOVED** — retired settings are deleted; current Worker, Access, bridge, model, and local API credentials use main-process secure custody. |
| M2 | MED | `src/main/main.ts:201–266`, `api-server.ts` report routes | No date-format validation on IPC/API params. SQL layer is fully parameterized (verified — injection-safe); impact is garbage queries / `new Date(garbage)` misbehavior, not injection | Deferred |
| M3 | MED | `src/main/main.ts` | No single-instance lock → two instances = concurrent sqlite writers | **FIXED** |
| M4 | MED | `src/main/backup.ts:80` | Restore copies over the DB while the sqlite handle is open (corruption risk even for legit restores) | Deferred — close handle before copy |
| L1 | LOW | `api-server.ts` | No rate limiting on report endpoints (expensive range queries) | Deferred |
| L2 | LOW | Deleted `src/bridge/r2.ts` | An unreachable direct-R2 stub contained a placeholder signature. | **REMOVED** — Plexus has no employee-side R2 credential or direct bucket-write path. |
| L3 | LOW | `src/main/idle.ts` | `powerMonitor.getSystemIdleTime()` polled every 30 s — disclose in settings/onboarding; allow opt-out | Deferred |
| L4 | LOW | `src/main/main.ts:295` | `settings:set` returns `ipcMain.emit('settings:get', …)` — a boolean, not `PlexusSettings`; renderer gets a wrong-shaped response | Deferred (functional bug) |
| L5 | LOW | Deleted direct-R2 IPC/settings | Direct R2 sync was unconfigurable and violated the server-mediated storage boundary. | **REMOVED** — Worker bindings own member-data R2 writes; GitHub Actions owns OTA R2 credentials. |
| L6 | LOW | `src/renderer/components/RibbonsShader.tsx:123` | Console: `WebGL: INVALID_OPERATION: getAttribLocation: program not linked` on every launch | Deferred |
| L7 | LOW | `src/main/backup.ts` | `restoreBackup` dir comparison is exact-string (`path.dirname === BACKUP_DIR`) — fine on macOS; revisit for Windows separators/symlinks if app ships there | Note |

**Positive findings:** hardened `webPreferences` (`main.ts:34–39`); narrow typed `contextBridge` surface (`preload.ts`); all SQL parameterized (`database.ts`); WAL mode; auto-backup with rotation.

## Quality / efficiency observations (report-only, pre-existing)

- Weekly reports run **7 sequential `listEntries` queries** (`main.ts:221–240`, `api-server.ts` weekly route) — fetch the week range once and slice in memory.
- `entry:update` fetches **all entries 1970→2099** to return one updated row (`main.ts:179`) — query by id.
- Timer ticker hits the DB every second regardless of state (`main.ts:101–115`) — cache the running entry.
- The 2026-06-11 duration-aggregation duplication included bridge modules that
  have since been deleted; current consolidation work should inspect only live
  report builders before proposing a shared helper.
- `formatDuration` / elapsed-HH:MM:SS formatting duplicated in `tray.ts` and bridges.
- `cleanupOldBackups()` and `listBackups()` duplicate the backup-file listing logic.

## Fixes applied this session

1. **H1** — `api-server.ts`: binds `127.0.0.1` only; CORS is restricted to localhost origins; bearer-token middleware protects everything except `/api/health`. A later hardening pass migrated the token to Electron `safeStorage`, clears the legacy plaintext row, and no longer prints token values to startup logs.
2. **H2** — `backup.ts`: restore path must resolve inside `~/.plexus/backups/` and match `plexus-*.db` naming.
3. **H3** — `paperclip.ts`: `memberId` sanitized to `[A-Za-z0-9_-]`, `month` must match `YYYY-MM`, table cells escape `|` and newlines.
4. **B1** — `auto-sync.ts`: both dynamic imports now use `../db/database.js`.
5. **M3** — `main.ts`: `requestSingleInstanceLock()` with second-instance focus/recreate.
6. **Tray** — `tray.ts` now loads `trayTemplate.png` (macOS template image, auto dark/light) without the resize call that strips the template flag.
7. **Icons** — `package.json`: mac → `assets/icons/icon.icns`, win/linux → `assets/icons/icon-fullbleed.png`. New icon set generated via Higgsfield (squircle master, 16–1024 sizes, icns, tray templates) in `assets/icons/` and `…/03-Resources/Design/Plexus-Brand/icons/`.
8. **Hardening** — `startApiServer()` awaited in `app.whenReady` (was a floating promise that would swallow startup errors).

## Deferred (recommended next)

Close DB handle before restore copy (M4) · verify the remaining `settings:set`
return-shape finding against current code (L4) · weekly-report query
consolidation. Direct R2 signing/settings and MultiCA credential work are retired,
not deferred.

## Verification appendix

- `npm run typecheck` → clean after all fixes.
- Baseline run: `/api/health` 200, `/api/projects` 200 JSON, Electron process up, auto-backup fired on launch (backup count 1→2), UI interactive (screenshot), no ABI/NODE_MODULE_VERSION errors.
- Post-fix run: see session summary (401 without token / 200 with token / 127.0.0.1-only bind / template tray glyph).
