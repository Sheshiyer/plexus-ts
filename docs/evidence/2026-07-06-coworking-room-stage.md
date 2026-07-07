# Co-working Meet-like Room Stage — Verification Evidence

Date: 2026-07-06
Branch: `codex/coworking-room-stage` (based on `origin/main` @ 0.5.1)
Plan: `docs/plans/2026-07-06-coworking-meet-like-room-stage.md`

## Scope of this pass

Batch 1 (pure model foundation, Tasks 1–6) shipped earlier via 0.5.0 / 0.5.1 and
is already on `main`. This pass covers the **behavior gaps** of Batches 2–4 on top
of that foundation, per the agreed scope "behavior gaps + extract-as-touched":

| Task | What shipped | Commit |
|---|---|---|
| 10 | Project room join is always presence-only (media is an explicit post-join action) | `73ed330` |
| 11 | Explicit project media controls (mic/camera/screen) as a transport-deferred UI shell | `44e24c4` |
| 13 | Fullscreen stage closes on Escape and restores focus to its trigger | `1993afb` |
| 14 | This evidence document | (this commit) |

Tasks 7, 8, 9, 12 were assessed as **already implemented inline** in the shipped
0.5.1 `CoWorkingPanel.tsx` (grid removed; project rail selector with no auto-join;
focused stage; lounge-as-layer with `NO REC` / `NO TRANSCRIPT` chips; screen wall
with empty/wall/pinned + pin toggle). Their only outstanding item is pure
refactor-extraction into `components/coworking/*.tsx`, which was intentionally
deferred (no behavior change, non-trivial regression risk on a 1507-line file).

## Automated Gate Results

Commands run in this session (repo root):

```
npm run test:coworking     # vitest run test/coworking
npm run typecheck          # tsc --noEmit
git diff --check
```

| Gate | Result | Notes |
|---|---:|---|
| `npm run test:coworking` | Pass | 12 files, 29 tests passing (was 22 at branch base; +7 across the new specs below). |
| `npm run typecheck` | Pass | Clean. Only the pre-existing unrelated `astro/tsconfigs/strict` base-config warning remains. |
| `git diff --check` | Pass | No whitespace / conflict-marker issues. |

New/covering tests added this pass:

- `test/coworking/project-join-presence-only.test.ts` — proves `buildProjectRoomJoinRequest()` returns `intent: 'presence_only'` with all media disabled, even when the room has an active call (Task 10 regression guard).
- `test/coworking/project-media-controls.test.ts` — proves `ProjectMediaControls` renders mic/camera/screen gated on join + transport readiness with the deferred hint, and that `CoWorkingPanel` wires it behind `PROJECT_MEDIA_TRANSPORT_READY` (Task 11).
- `test/coworking/stage-fullscreen.test.ts` — proves the Escape-to-close listener and focus-restore path exist and the toggle routes through the focus-preserving handler (Task 13).

## Manual / live stories

These require running the Electron renderer against a realtime workspace. They were
**not executed in this session** (headless environment; project-room media transport
is additionally blocked on SFU credentials — see Known Gaps). Listed here as the
manual QA checklist to run before release:

| Story | Expected | Auto-covered? |
|---|---|---|
| Focus change | Selecting a different project in the rail refocuses the stage without joining. | Yes — `project-focus-behavior.test.ts`. |
| No auto-join | Selecting a project never calls join / `dropInToRoom`. | Yes — `project-focus-behavior.test.ts` (join spy). |
| Join presence-only | Dropping in requests presence only; no mic/camera/screen auto-enabled, even into a room with a live call. | Yes — `project-join-presence-only.test.ts`. Live confirm pending. |
| Project media controls | Mic/camera/screen render disabled with the "ships with realtime media transport" hint until transport lands. | Partial — source-scraped by `project-media-controls.test.ts`; visual state pending live run. |
| Screen wall empty / multi / pinned | Empty state, multi-tile wall, and click-to-pin all render. | Yes (model) — `screen-wall-model.test.ts`; visual pending live run. |
| Fullscreen controls | Fullscreen keeps screen wall, people, project media controls, and leave/stop visible. | Partial — overlay renders same section; visual pending live run. |
| Fullscreen Escape / focus | Escape collapses the stage; focus returns to the Fullscreen button. | Source-covered by `stage-fullscreen.test.ts`; live confirm pending. |
| Native screen picker | Lounge screen-share still opens the OS `getDisplayMedia` picker (no custom picker). | Unchanged path; live confirm pending. |

## Known Gaps

- **Project-room media transport is deferred.** `PROJECT_MEDIA_TRANSPORT_READY` is
  `false` in `CoWorkingPanel.tsx`. Project mic/camera/screen are a presentational
  shell until a project-scoped `RealtimeSession` is wired and Cloudflare Realtime
  SFU credentials are configured in the Worker (currently pending — blocks E2E media
  transport testing). Flip the flag once both land; the controls enable automatically.
- **Component extraction (Tasks 7/8/9/12) not performed.** The room-stage pieces
  remain inline functions in `CoWorkingPanel.tsx`. Behavior is complete and tested;
  extraction into `components/coworking/*.tsx` is a future no-behavior refactor.
- **Live/manual stories above not executed** in this headless session.
