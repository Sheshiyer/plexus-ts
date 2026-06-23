# Plexus v0.4.1 Visual Screenshot Check

Date: 2026-06-19
Mode: local Electron dev server via `npm run dev`
Window: `Plexus`, 1320 x 860

## Result

Status: **release caution**

The local visual sweep confirms the v0.4.1 shell, brand language, repo-backed work surfaces, settings/profile card, reports, local export, and backup routes render without timer-only identity or placeholder proof.

One item remains unproven before a tag/OTA push: the active Co-working lounge dock could not be visually captured because the live app was disconnected from Cloudflare Access, so `JOIN LOUNGE` did not transition into the joined state. The source contains the active dock with mic, speaker, camera, screen share, closeout, and leave controls, but release proof still needs either a valid Access session against the Worker or a real local realtime fixture that does not fake proof.

## Screenshots Captured

- `docs/evidence/2026-06-19-plexus-0.4.1/18-splash-reload.png` - splash confirms `Plexus` and `Work Coordination Layer · Thoughtseed`.
- `docs/evidence/2026-06-19-plexus-0.4.1/01-current-shell.png` - Onboarding route and Clio `v0.4.1` left tray version marker.
- `docs/evidence/2026-06-19-plexus-0.4.1/02-focus-session.png` - Focus Session shell with repo-backed work language.
- `docs/evidence/2026-06-19-plexus-0.4.1/03-projects.png` - Projects show `NEEDS REPO` and `ADD REPO` actions.
- `docs/evidence/2026-06-19-plexus-0.4.1/04-work-records.png` - Work Records show the repo-backed ledger and `LEGACY_UNVERIFIED` history.
- `docs/evidence/2026-06-19-plexus-0.4.1/05-reports.png` - Weekly Reports render local evidence metrics during Worker disconnect.
- `docs/evidence/2026-06-19-plexus-0.4.1/06-reports-daily.png` - Daily Reports render local summary during Worker disconnect.
- `docs/evidence/2026-06-19-plexus-0.4.1/07-reports-monthly.png` - Monthly Reports render local rollup during Worker disconnect.
- `docs/evidence/2026-06-19-plexus-0.4.1/08-coworking-lobby.png` - Co-working lobby degrades to explicit offline floor/rooms/lounge messages.
- `docs/evidence/2026-06-19-plexus-0.4.1/09-coworking-lounge-attempt.png` - Lounge join attempt remains in lobby while Access is disconnected.
- `docs/evidence/2026-06-19-plexus-0.4.1/10-settings-profile.png` - Settings profile card renders with editable local profile fields.
- `docs/evidence/2026-06-19-plexus-0.4.1/11-settings-health-notifications.png` - GitHub evidence health plus sound/breakwork controls render.
- `docs/evidence/2026-06-19-plexus-0.4.1/12-settings-rhythm.png` - Private rhythm controls are optional, private, and deletable.
- `docs/evidence/2026-06-19-plexus-0.4.1/13-fabric.png` - Fabric shows bridge health and handoff queue without blocking the app.
- `docs/evidence/2026-06-19-plexus-0.4.1/14-preferences.png` - Preferences render member working-style and report-visibility controls.
- `docs/evidence/2026-06-19-plexus-0.4.1/15-admin.png` - Admin degrades to explicit Cloudflare Access disconnect message.
- `docs/evidence/2026-06-19-plexus-0.4.1/16-export.png` - Export renders local data extraction controls.
- `docs/evidence/2026-06-19-plexus-0.4.1/17-backups.png` - Backups render local restore points and backup action.

## Visual Findings

- Pass: splash no longer presents Plexus as a timer.
- Pass: left tray shows Greek muse version signal `Clio v0.4.1` above the timer.
- Pass: navigation uses `Focus`, `Work Records`, `Projects`, `Reports`, `Co-working`, and operational labels instead of timer-only product language.
- Pass: Projects make missing GitHub repo binding explicit and actionable.
- Pass: Work Records preserve historical rows as `LEGACY_UNVERIFIED`.
- Pass: Reports degrade to local summaries when Worker KPI refresh is disconnected.
- Pass: Settings keep birthdate/rhythm data private and separate from CEO-visible preferences.
- Pass: Settings state ElevenLabs audio generation is Worker-side and stores no ElevenLabs key locally.
- Pass: Fabric bridge failure is explicit and does not block navigation.
- Caution: Cloudflare Access disconnect appears as visible red copy in Reports, Co-working, and Admin. It is honest, but could be softened later.
- Blocker for tag: active Co-working lounge media dock still needs runtime screenshot proof from a successful join.

## Commands Re-run After Screenshots

- `npm run lint` - pass.
- `npm run typecheck` - pass.
- CI/release banned-string scan - pass; `rg` returned no matches.
