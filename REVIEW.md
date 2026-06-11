# Plexus — Code & Security Review

**Date:** 2026-06-11 · **Scope:** full app (Electron 33 + Vite/React + sqlite3) with focus on the uncommitted working tree (ESM migration + main-process wiring) · **Method:** Electron-aware security recon + 7-angle diff review (line-by-line, removed-behavior, cross-file trace, reuse, simplification, efficiency, altitude) with per-finding verification.

## Executive summary

The app's renderer/main boundary is well built — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a narrow promise-based `contextBridge` API. The serious issues were all on the **other** trust boundaries: an unauthenticated REST API bound to all interfaces, a renderer-reachable backup-restore IPC that accepted arbitrary filesystem paths, and unsanitized interpolation into Paperclip vault filenames/markdown. All three HIGH findings plus one CONFIRMED runtime bug were **fixed this session** (see "Fixes applied"). Medium/low findings are documented for follow-up.

## Severity table

| ID | Sev | Location | Finding | Status |
|----|-----|----------|---------|--------|
| H1 | HIGH | `src/main/api-server.ts:11,96` | `:31339` API: `cors()` any-origin, `listen(PORT)` on 0.0.0.0, zero auth → leaked timer state, projects, entries, reports to any local process or LAN peer | **FIXED** |
| H2 | HIGH | `src/main/main.ts:309` + `src/main/backup.ts:78` | `backup:restore` IPC accepted an arbitrary absolute path and copied it over the live DB (renderer-reachable path traversal) | **FIXED** |
| H3 | HIGH | `src/bridge/paperclip.ts:22,45` | `${memberId}-${month}.md` filename unsanitized (traversal via memberId); entry description/projectId interpolated raw into markdown table (`\|`/newline injection) | **FIXED** |
| B1 | HIGH (bug) | `src/main/auto-sync.ts:18,32` | `await import('../db/database')` missing `.js` extension → `ERR_MODULE_NOT_FOUND` at runtime the moment auto-sync fires (ESM migration miss) | **FIXED** |
| M1 | MED | `src/main/main.ts:292,336,348` | Bridge credentials (`multicaToken`, `r2AccessKeyId`, `r2SecretAccessKey`) stored plaintext in `~/.plexus/plexus.db` settings table | Deferred — migrate to Electron `safeStorage` |
| M2 | MED | `src/main/main.ts:201–266`, `api-server.ts` report routes | No date-format validation on IPC/API params. SQL layer is fully parameterized (verified — injection-safe); impact is garbage queries / `new Date(garbage)` misbehavior, not injection | Deferred |
| M3 | MED | `src/main/main.ts` | No single-instance lock → two instances = concurrent sqlite writers | **FIXED** |
| M4 | MED | `src/main/backup.ts:80` | Restore copies over the DB while the sqlite handle is open (corruption risk even for legit restores) | Deferred — close handle before copy |
| L1 | LOW | `api-server.ts` | No rate limiting on report endpoints (expensive range queries) | Deferred |
| L2 | LOW | `src/bridge/r2.ts:43` | `Authorization: AWS …:SIGNATURE_PLACEHOLDER` stub — uploads can never authenticate; also sends the access-key id to the endpoint | Deferred — needs real SigV4 (aws4fetch) |
| L3 | LOW | `src/main/idle.ts` | `powerMonitor.getSystemIdleTime()` polled every 30 s — disclose in settings/onboarding; allow opt-out | Deferred |
| L4 | LOW | `src/main/main.ts:295` | `settings:set` returns `ipcMain.emit('settings:get', …)` — a boolean, not `PlexusSettings`; renderer gets a wrong-shaped response | Deferred (functional bug) |
| L5 | LOW | `src/main/main.ts:284–351` | `sync:r2` reads 4 `r2*` settings that `settings:set` never persists → R2 sync unconfigurable via UI | Deferred (functional bug) |
| L6 | LOW | `src/renderer/components/RibbonsShader.tsx:123` | Console: `WebGL: INVALID_OPERATION: getAttribLocation: program not linked` on every launch | Deferred |
| L7 | LOW | `src/main/backup.ts` | `restoreBackup` dir comparison is exact-string (`path.dirname === BACKUP_DIR`) — fine on macOS; revisit for Windows separators/symlinks if app ships there | Note |

**Positive findings:** hardened `webPreferences` (`main.ts:34–39`); narrow typed `contextBridge` surface (`preload.ts`); all SQL parameterized (`database.ts`); WAL mode; auto-backup with rotation.

## Quality / efficiency observations (report-only, pre-existing)

- Weekly reports run **7 sequential `listEntries` queries** (`main.ts:221–240`, `api-server.ts` weekly route) — fetch the week range once and slice in memory.
- `entry:update` fetches **all entries 1970→2099** to return one updated row (`main.ts:179`) — query by id.
- Timer ticker hits the DB every second regardless of state (`main.ts:101–115`) — cache the running entry.
- Duration aggregation (`reduce` + billable `filter().reduce()`) is duplicated across `api-server.ts`, `main.ts`, `paperclip.ts`, `multica.ts` — extract shared helpers in `src/shared/`.
- `formatDuration` / elapsed-HH:MM:SS formatting duplicated in `tray.ts` and bridges.
- `cleanupOldBackups()` and `listBackups()` duplicate the backup-file listing logic.

## Fixes applied this session

1. **H1** — `api-server.ts`: binds `127.0.0.1` only; CORS restricted to localhost origins; bearer-token middleware on everything except `/api/health`. Token is generated once, **persisted as the `apiToken` settings row** (stable across restarts), and printed to the dev console on startup. ⚠️ **Breaking for integrations:** the Paperclip agent must now send `Authorization: Bearer <token>` — read the token from the settings table (`~/.plexus/plexus.db`) or the startup log.
2. **H2** — `backup.ts`: restore path must resolve inside `~/.plexus/backups/` and match `plexus-*.db` naming.
3. **H3** — `paperclip.ts`: `memberId` sanitized to `[A-Za-z0-9_-]`, `month` must match `YYYY-MM`, table cells escape `|` and newlines.
4. **B1** — `auto-sync.ts`: both dynamic imports now use `../db/database.js`.
5. **M3** — `main.ts`: `requestSingleInstanceLock()` with second-instance focus/recreate.
6. **Tray** — `tray.ts` now loads `trayTemplate.png` (macOS template image, auto dark/light) without the resize call that strips the template flag.
7. **Icons** — `package.json`: mac → `assets/icons/icon.icns`, win/linux → `assets/icons/icon-fullbleed.png`. New icon set generated via Higgsfield (squircle master, 16–1024 sizes, icns, tray templates) in `assets/icons/` and `…/03-Resources/Design/Plexus-Brand/icons/`.
8. **Hardening** — `startApiServer()` awaited in `app.whenReady` (was a floating promise that would swallow startup errors).

## Deferred (recommended next)

safeStorage credential migration (M1) · close DB handle before restore copy (M4) · real R2 SigV4 signing (L2) · `settings:set` return shape + r2 settings persistence (L4/L5) · date param validation (M2) · weekly-report query consolidation.

## Verification appendix

- `npm run typecheck` → clean after all fixes.
- Baseline run: `/api/health` 200, `/api/projects` 200 JSON, Electron process up, auto-backup fired on launch (backup count 1→2), UI interactive (screenshot), no ABI/NODE_MODULE_VERSION errors.
- Post-fix run: see session summary (401 without token / 200 with token / 127.0.0.1-only bind / template tray glyph).
