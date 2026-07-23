# Co-working Studio Floor Clarity Redesign

**Date:** 2026-07-23
**Status:** Approved design, pending implementation plan
**Trigger:** Tester feedback — "This UI is pretty confusing, need something like Gather or Google Meet." Co-working meet controls read as broken/disabled; error states dominate when disconnected.

## Goal

Keep the existing Studio Floor concept (stable benches, team rail, ambient lounge — already Gather-inspired, per `docs/design/screen-references/co-working-*` July 15 references) but make it legible to a first-time user: universal action verbs, one unmistakable "you are live" surface with Meet-style media controls, and designed quiet/degraded states.

Success criterion: a tester can join the lounge or a project room, control mic/camera/screen, and leave — without explanation.

## Decisions made

1. **Direction:** clarify the Studio Floor, do not replace it.
2. **In-call architecture:** persistent media dock (Slack-huddle model), not a full-screen call takeover. The floor always stays visible; one dock serves lounge and project rooms alike.
3. **Build the in-call layer now:** it operates presence-only today and activates automatically when Cloudflare Realtime SFU credentials land (`joined.cloudflare.configured` runtime gate — wiring already exists).
4. **Empty states:** full treatment (single connection chip + quiet-floor rendering), not just error consolidation.
5. **Vocabulary:** familiar verbs (Join/Leave), keep place nouns (bench, studio floor, lounge).

## Layout

1. **Telemetry bar** (kept): counts, floor state, private biorhythm, Join Lounge. Gains a single connection chip (see Degraded states).
2. **Studio floor** (main): project stage ("My bench") dominant with screen-wall tile grid; team bench rail beside it. Stage header simplifies to room name + one primary **Join** / red **Leave** + fullscreen. Closeout moves to the dock.
3. **Lounge strip:** Ambient Lounge shrinks from a full section (waveform, device pickers, six controls) to a compact strip: presence avatars, "N in lounge · unrecorded", **Join lounge**. Its media controls are removed — the dock owns them. Device pickers move to a gear popover in the dock.
4. **Media dock** (new): fixed bottom bar inside the panel, rendered only while a join owns the shared `RealtimeSession` (`hasSession`).

## Media dock

```
● LIVE · <room/lounge name> · <elapsed>   [Mic][Cam][Screen][⚙]   (avatars)+N   [Closeout] [Leave (red)]
```

- Left: pulsing live indicator, context name, elapsed time.
- Center: three large square toggles — accent-filled when on, neutral off, disabled with honest tooltip when `cloudflare.configured` is false ("Realtime media transport is not configured for this workspace yet"). Gear popover hosts mic/speaker/camera device selectors (moved from lounge section).
- Right: participant avatar stack, Closeout, red **Leave** — the only red action on the floor.
- View-only component over existing state: generalized `toggleMic/Camera/Screen`, `activeMediaEntry` (added in the media-wiring fix). No new session logic.

## Vocabulary

| Today | Redesign |
|---|---|
| "Drop in" | **Join** (subtitle flavor: "drop in · presence-only until you enable media") |
| "Leave room" | **Leave** (red, in dock) |
| "Join lounge" | unchanged |
| Place nouns (bench/floor/lounge) | unchanged |

## Degraded & quiet states

- **One connection chip** in the telemetry bar replaces the three per-section red `DegradedStatePanel`s for worker-unreachable: `● OFFLINE — Sign in with Cloudflare Access` (amber; click → sign-in).
- **Quiet floor:** disconnected/alone still renders structure — own bench + project selector, grayed bench placeholders ("Team benches appear when the floor connects"), dimmed lounge strip. Reads as a quiet place, not a broken dashboard.
- Local action errors (join failed, permission denied) stay inline near the action, and on a dock message line while live.

## Component architecture

`CoWorkingPanel.tsx` (~1,600 lines) splits along the new seams; pure-logic modules (`coworkingModel.ts`, `focused-zone.ts`, `screen-wall-model.ts`) unchanged:

```
components/coworking/
  MediaDock.tsx          new — presentational dock
  LoungeStrip.tsx        new — compact lounge strip
  FloorTelemetryBar.tsx  extracted
  StudioStage.tsx        extracted (FocusedRoomStage + ScreenWall)
  TeamBenchRail.tsx      extracted
renderer/lib/
  useRealtimeMedia.ts    extracted hook — sessionRef, joins, toggles,
                         activeMediaEntry, device state (sole RealtimeSession owner)
  dock-model.ts          new pure fn deriveDockState(...) — unit-testable
```

`CoWorkingPanel.tsx` remains the orchestrator (~300-400 lines): data loading, polling, composition.

## Data flow & errors

- IPC surface unchanged (`realtimeJoinRoom`, `coworkingFloor`, `realtimeLeaveCall`, …).
- `deriveDockState(activeJoinList, busy, micActive, cameraActive, screenActive, transportConfigured)` — pure derivation, no new wiring.
- Worker-unreachable → telemetry chip only. Action failures → inline + dock message line.

## Testing

Repo conventions (no component-render testing):

- Unit tests for `dock-model.ts` (pattern: `test/coworking/focused-zone.test.ts`).
- Update source-assertion tests: `project-media-controls.test.ts`, `coworking-room-stage-ui.test.ts`.
- New assertions: dock renders only when a join has `hasSession`; Leave styled destructive; lounge strip contains no media toggles; single connection chip replaces per-section offline panels.

## Out of scope

- Knock/visit semantics from the design references (not currently implemented; separate initiative).
- SFU credential configuration (infra, tracked separately).
- Clio chat UI simplification (separate task).
