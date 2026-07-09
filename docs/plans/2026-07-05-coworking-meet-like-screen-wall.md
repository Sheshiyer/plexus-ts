# Co-working Meet-like Screen Wall Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the focused project zone into a Google Meet-like room stage where all people and shared screens stay visible, the wall has stable height, and any share can be pinned or fullscreened without breaking the ambient lounge model.

**Architecture:** Ship this in two layers. First, make the renderer and pure coworking model produce a real meeting stage from room detail participants plus live screen-track metadata. Second, add room-scoped project media sessions and remote stream attachment so screen tiles become live video instead of metadata frames. The native OS screen picker stays intact; Plexus should improve the viewing stage around it, not replace it.

**Tech Stack:** Electron main/preload IPC, React 18 renderer, TypeScript shared realtime contracts, existing `RealtimeSession`, pure renderer model helpers, CSS fullscreen and fixed-height layout, Vitest coworking model tests, Vite/Electron validation commands.

---

## Current Understanding

The current focused project zone now has the right product direction, but the media area is still a placeholder wall. Native screen sharing controls work through `navigator.mediaDevices.getDisplayMedia`, backed by Electron's desktop media handler. The viewing UX is not yet Meet-like because people are outside the main wall, `RealtimeRoomDetail.participants` is currently discarded by the renderer, and `ScreenWall` renders screen metadata placeholders instead of a room stage.

Important current facts:

- `src/renderer/components/CoWorkingPanel.tsx` renders `ScreenWall` from `focusTracks`.
- `src/renderer/components/CoWorkingPanel.tsx` loads room detail but stores only `detail.tracks`, not `detail.participants`.
- `src/renderer/lib/coworkingModel.ts` has a pure `deriveScreenWall()` seam that can become the test-first wall model.
- `src/renderer/lib/RealtimeSession.ts` currently treats remote video tracks as camera and loses participant identity.
- Project-zone join is presence-only today. Lounge join owns the current `RealtimeSession`.
- Current screen publishing is tied to lounge session state, so true project-room screen publishing needs a later transport task.

## Product Rules

- Project dropdown selection focuses visually but never auto-joins.
- Project `Join` is still a separate action.
- People enter presence-only first, then opt into mic, camera, or screen.
- The project stage owns focused voice/screen priority once joined.
- The lounge remains visible and unrecorded by default.
- The lounge strip is passive during project fullscreen unless the user intentionally switches scope.
- Screen sharing uses the native OS picker. Do not build a custom picker.
- Pinning or fullscreening one share must not close, hide, or stop other shares.
- Recording remains explicit and project-scoped.

## Target UX

The focused project zone should feel like a compact Meet room:

- A stable-height media stage replaces the loose dashed screen area.
- In wall mode, participant tiles and screen-share tiles share the same stage.
- In pinned mode, one selected screen becomes the main focus and everyone else remains visible in a filmstrip or side rail.
- In fullscreen mode, the selected stage root enters DOM fullscreen. Controls render inside that fullscreen root.
- The stage empty state should show "room ready" rather than "missing content": participants are still visible even when no one shares.
- The screen share tile should show publisher identity, label, live/metadata state, and pin/fullscreen actions.

## Subagent Findings Integrated

- UX review: the screen wall needs layout modes, not just styling. The required modes are Ambient Floor, Focused Project Stage, Pinned Share, and Fullscreen Stage.
- Code-path review: current data path is `teamforge.getRealtimeRoomDetail()` -> IPC `realtime:roomDetail` -> `window.plexus.realtimeRoomDetail()` -> `loadFocusedRoomDetail()` -> `focusTracks` -> `deriveFocusedZone()` -> `ScreenWall`.
- Architecture review: fixed height, pinning, and fullscreen are renderer-local. True remote screen playback requires project-room `RealtimeSession` work after the renderer stage exists.

## Rollout Sequence

1. Renderer-only Meet stage: fixed-height room grid, participant tiles, screen tiles, pin, fullscreen, no backend churn.
2. Model upgrade: pure participant plus screen wall model and tests.
3. Project media session: separate project-room `RealtimeSession`, independent from lounge.
4. Remote playback: track metadata mapping, subscription/renegotiation, and real video elements.
5. Recording backend: keep explicit project-vault recording for a later Worker/R2 route pass.

---

## Task 1: Add A Pure Focused Stage Model

**Files:**

- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/screen-wall-model.test.ts`
- Test: `test/coworking/coworking-model-contract.test.ts`
- Optional shared type update: `src/shared/coworking.ts`

**Step 1: Write failing tests for participant and screen tiles**

Add tests proving:

- Live screen tracks become screen tiles.
- Joined participants become participant tiles even when no screens exist.
- Screen tiles include publisher display name when participant detail is available.
- Pinned tile is valid only when it exists.
- Fullscreen target is valid only when it exists.
- Closed or subscribe-direction tracks are excluded.

Example expected shape:

```ts
expect(stage.tiles.map((tile) => ({
  id: tile.id,
  kind: tile.kind,
  participantId: tile.participantId,
  displayName: tile.displayName,
  pinned: tile.pinned,
  fullscreen: tile.fullscreen,
}))).toEqual([
  {
    id: 'screen:track_screen_maya',
    kind: 'screen',
    participantId: 'participant_maya',
    displayName: 'Maya Rao',
    pinned: true,
    fullscreen: false,
  },
  {
    id: 'participant:participant_shesh',
    kind: 'participant',
    participantId: 'participant_shesh',
    displayName: 'Shesh Iyer',
    pinned: false,
    fullscreen: false,
  },
]);
```

**Step 2: Run the focused test and confirm failure**

Run:

```bash
npm run test:coworking -- test/coworking/screen-wall-model.test.ts
```

Expected: fails because the stage model does not exist or does not include participants.

**Step 3: Implement the minimal pure model**

Add a pure helper beside `deriveScreenWall()`:

```ts
export interface CoWorkingStageParticipant {
  participantId: string;
  displayName: string;
  initials: string;
  media: {
    audio: boolean;
    video: boolean;
    screen: boolean;
  };
}

export type CoWorkingStageTileKind = 'participant' | 'screen';

export interface CoWorkingStageTile {
  id: string;
  kind: CoWorkingStageTileKind;
  participantId: string;
  displayName: string;
  initials: string;
  label: string;
  pinned: boolean;
  fullscreen: boolean;
  screenTrack: RealtimeMediaTrack | null;
  media: {
    audio: boolean;
    video: boolean;
    screen: boolean;
  };
}

export interface CoWorkingFocusedStage {
  mode: 'empty' | 'wall' | 'pinned' | 'fullscreen';
  pinnedTileId: string | null;
  fullscreenTileId: string | null;
  tiles: CoWorkingStageTile[];
}
```

Keep the helper free of `window`, `document`, `navigator`, `MediaStream`, and Electron imports.

**Step 4: Run tests**

Run:

```bash
npm run test:coworking
```

Expected: all coworking tests pass.

**Step 5: Commit**

```bash
git add src/renderer/lib/coworkingModel.ts test/coworking/screen-wall-model.test.ts test/coworking/coworking-model-contract.test.ts src/shared/coworking.ts
git commit -m "feat(coworking): model focused meeting stage"
```

---

## Task 2: Preserve Focused Room Participants In Renderer State

**Files:**

- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Test: `test/coworking/project-focus-behavior.test.ts`

**Step 1: Add failing test coverage**

Add or update a model-level test proving a focused zone can render members from room detail participant data, not only floor presence. If this stays component-only, add a pure mapper in `coworkingModel.ts` and test that instead.

**Step 2: Add participant state**

In `CoWorkingPanel`, add:

```ts
const [focusParticipants, setFocusParticipants] = useState<RealtimeParticipant[]>([]);
```

Import `RealtimeParticipant` from `../../shared/types`.

**Step 3: Populate participant state from room detail**

In `loadFocusedRoomDetail()`, store both:

```ts
setFocusTracks(result.detail.tracks ?? []);
setFocusParticipants(result.detail.participants ?? []);
```

Clear both on missing room, failed detail, and room change.

**Step 4: Preserve no-auto-join behavior**

Verify project dropdown changes only call `setSelectedRoomId()`. They must not call `dropInToRoom()`, `joinLounge()`, media toggles, or recording handlers.

**Step 5: Run tests**

Run:

```bash
npm run test:coworking
npm run typecheck
```

Expected: both pass.

**Step 6: Commit**

```bash
git add src/renderer/components/CoWorkingPanel.tsx test/coworking/project-focus-behavior.test.ts
git commit -m "feat(coworking): keep focused room participants"
```

---

## Task 3: Replace ScreenWall With A Meet-like Focus Stage

**Files:**

- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/theme.css`

**Step 1: Create `FocusedStage` component**

Replace the metadata-only `ScreenWall` component with a component that accepts:

```ts
type FocusedStageProps = {
  stage: CoWorkingFocusedStage;
  remoteStreams: RemoteStream[];
  localScreenStream: MediaStream | null;
  onPin: (tileId: string | null) => void;
  onFullscreen: (tileId: string | null) => void;
};
```

For this task, it is acceptable for remote screen tiles to show metadata frames while the stream mapping is added later. The key is that the room layout is correct and people are visible.

**Step 2: Render all people and all screens**

The component should render:

- Main stage area.
- Participant tiles for every focused room participant.
- Screen tiles for every live focused screen track.
- Pin action on every screen tile.
- Fullscreen action on every tile or the stage root.
- Empty state only when there are zero participants and zero screens.

**Step 3: Keep the side rail informational**

The right side rail should no longer be the only place where people appear. It should summarize:

- Presence count.
- Join state.
- Recording target.
- Optional recording note.

People must be visible in the stage itself.

**Step 4: Run quick renderer validation**

Run:

```bash
npm run typecheck
npm run build:renderer
```

Expected: both pass.

**Step 5: Commit**

```bash
git add src/renderer/components/CoWorkingPanel.tsx src/renderer/theme.css
git commit -m "feat(coworking): render focused meeting stage"
```

---

## Task 4: Fix Height And Internal Stage Scrolling

**Files:**

- Modify: `src/renderer/theme.css`

**Step 1: Add stable stage dimensions**

Create a fixed but responsive stage block:

```css
.px-focus-stage {
  min-height: 320px;
  height: clamp(320px, 46vh, 560px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 220px);
  overflow: hidden;
}
```

Use internal scrolling only in thumbnail rails:

```css
.px-focus-stage-strip,
.px-focus-stage-people {
  min-height: 0;
  overflow: auto;
}
```

**Step 2: Add wall, pinned, and empty variants**

Required states:

- `.px-focus-stage.empty`
- `.px-focus-stage.wall`
- `.px-focus-stage.pinned`
- `.px-focus-stage.fullscreen`

Pinned mode should make the selected share the largest element while preserving a visible rail for people and other shares.

**Step 3: Prevent text overflow**

Set predictable tile sizes and truncation:

```css
.px-stage-tile-title,
.px-stage-tile-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Step 4: Verify at the minimum app size**

Run the app locally and inspect the Co-working tab at the current minimum window size. The screen wall must not push the lounge strip offscreen.

**Step 5: Commit**

```bash
git add src/renderer/theme.css
git commit -m "style(coworking): stabilize focused stage height"
```

---

## Task 5: Add DOM Fullscreen Focus Mode

**Files:**

- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/theme.css`

**Step 1: Add fullscreen state and refs**

Add:

```ts
const focusedStageRef = useRef<HTMLDivElement | null>(null);
const [fullscreenTileId, setFullscreenTileId] = useState<string | null>(null);
```

**Step 2: Implement request and exit helpers**

Use DOM fullscreen:

```ts
const enterStageFullscreen = useCallback(async (tileId: string | null) => {
  setFullscreenTileId(tileId);
  await focusedStageRef.current?.requestFullscreen?.();
}, []);

const exitStageFullscreen = useCallback(async () => {
  setFullscreenTileId(null);
  if (document.fullscreenElement) await document.exitFullscreen();
}, []);
```

Add `fullscreenchange` cleanup so state resets if the user presses Esc.

**Step 3: Render controls inside fullscreen root**

The fullscreen root must contain:

- Exit fullscreen.
- Pin or unpin.
- Share screen.
- Mic.
- Camera.
- Captions.
- Leave zone.
- Recording button only when project joined and recording is valid.

Do not render lounge-only controls as active project controls.

**Step 4: Add CSS fullscreen state**

Use:

```css
.px-focus-stage:fullscreen {
  width: 100vw;
  height: 100vh;
  background: var(--bg-0);
  padding: 16px;
}
```

**Step 5: Verify manually**

Run local dev, click fullscreen, press Esc, and confirm controls remain visible while fullscreen is active.

**Step 6: Commit**

```bash
git add src/renderer/components/CoWorkingPanel.tsx src/renderer/theme.css
git commit -m "feat(coworking): add focused stage fullscreen"
```

---

## Task 6: Separate Lounge Media Controls From Project Stage Controls

**Files:**

- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/theme.css`
- Test: `test/coworking/project-focus-behavior.test.ts`

**Step 1: Define active media scope rules**

Add a pure helper or local derived state:

```ts
type MediaControlScope = 'lounge' | 'project';
```

Rules:

- Not joined to project: lounge controls remain lounge-scoped.
- Project focused but not joined: show Join, not mic/camera/screen/record.
- Project joined presence-only: show project media opt-ins.
- Lounge remains passive while project stage is active.

**Step 2: Keep native screen picker path**

Do not change the native picker call:

```ts
navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
```

Short-term, the project screen button can be disabled with honest copy if project media transport is not wired. Do not silently publish a project share into the lounge session.

**Step 3: Update controls**

In focused stage controls:

- Share screen should target project scope only after Task 7 exists.
- Before Task 7, show a disabled project share control or a "Join zone to share" state.
- Lounge mini strip can still show the active lounge share, but it must not imply project recording or project share.

**Step 4: Run tests**

Run:

```bash
npm run test:coworking
npm run typecheck
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/renderer/components/CoWorkingPanel.tsx src/renderer/theme.css test/coworking/project-focus-behavior.test.ts
git commit -m "fix(coworking): separate lounge and project controls"
```

---

## Task 7: Add Project-room Media Session State

**Files:**

- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/lib/RealtimeSession.ts`
- Test: `test/coworking/project-focus-behavior.test.ts`

**Step 1: Add a separate project session ref**

Do not reuse `sessionRef` if it represents lounge. Add:

```ts
const projectSessionRef = useRef<RealtimeSession | null>(null);
const projectScreenRef = useRef<{ id: string; stream: MediaStream } | null>(null);
```

**Step 2: Initialize project session after explicit Join**

When `dropInToRoom(selectedRoom)` succeeds, create a `RealtimeSession` from that join response if the room has realtime media configuration.

**Step 3: Publish project screen through project session**

Add a `toggleProjectScreen()` that mirrors the native picker path but publishes through `projectSessionRef`, not lounge `sessionRef`.

**Step 4: Preserve lounge session**

Leaving project should stop project media tracks only. It must not leave the lounge unless the user explicitly leaves lounge.

**Step 5: Run checks**

Run:

```bash
npm run test:coworking
npm run typecheck
npm run build:renderer
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/renderer/components/CoWorkingPanel.tsx src/renderer/lib/RealtimeSession.ts test/coworking/project-focus-behavior.test.ts
git commit -m "feat(coworking): add project media session"
```

---

## Task 8: Attach Remote Streams To Stage Tiles

**Files:**

- Modify: `src/renderer/lib/RealtimeSession.ts`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Test: `test/coworking/screen-wall-model.test.ts`

**Step 1: Preserve remote track identity**

`RealtimeSession.ontrack` cannot leave `participantId` blank for the focused stage. Add a mapping strategy from subscribed track metadata to remote stream:

```ts
type RemoteStream = {
  participantId: string;
  trackId: string;
  trackKind: 'audio' | 'camera' | 'screen';
  stream: MediaStream;
};
```

If Cloudflare does not return enough metadata yet, keep this task behind a clear degraded path: metadata tiles remain valid, live video tiles wait for provider identity mapping.

**Step 2: Distinguish screen video from camera video**

Use the source `RealtimeMediaTrack.trackKind` when subscribing. Do not infer all video as camera.

**Step 3: Render video when stream exists**

In screen tiles:

```tsx
{stream ? (
  <video ref={attachStream(stream)} autoPlay playsInline muted={isLocal} />
) : (
  <ScreenMetadataFrame tile={tile} />
)}
```

Use `object-fit: contain` for screen shares and `object-fit: cover` for camera/person tiles.

**Step 4: Run checks**

Run:

```bash
npm run test:coworking
npm run typecheck
npm run build:renderer
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/renderer/lib/RealtimeSession.ts src/renderer/components/CoWorkingPanel.tsx test/coworking/screen-wall-model.test.ts
git commit -m "feat(coworking): attach remote stage streams"
```

---

## Task 9: Verify UX With Local App Proof

**Files:**

- Modify: none unless defects are found
- Evidence: `docs/evidence/<date>-coworking-meet-stage/`

**Step 1: Run full focused checks**

Run:

```bash
npm run test:coworking
npm run test:assistant
npm run typecheck
npm run lint
npm run build:renderer
npm run release:ota:prep
```

Expected: all pass.

**Step 2: Run local app**

Run:

```bash
npm run dev
```

Expected:

- Vite renderer starts.
- Electron opens Plexus.
- Co-working tab loads.

**Step 3: Capture manual proof**

Capture screenshots for:

- Empty focused stage with participants visible.
- Multi-participant wall.
- Screen share metadata tile.
- Pinned share.
- Fullscreen stage.
- Lounge mini strip while project focused.

**Step 4: Record verification notes**

Create:

```bash
mkdir -p docs/evidence/2026-07-05-coworking-meet-stage
```

Save the screenshots and a short `README.md` with command output summaries.

**Step 5: Commit**

```bash
git add docs/evidence/2026-07-05-coworking-meet-stage
git commit -m "docs(coworking): add Meet stage proof"
```

---

## Release Checklist

- `npm run test:coworking` passes.
- `npm run test:assistant` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build:renderer` passes.
- `npm run release:ota:prep` passes.
- Local screenshot proves fixed-height Meet stage.
- Native screen picker still opens from the screen control.
- Project dropdown still does not auto-join.
- Recording still requires explicit joined project zone.
- Lounge remains unrecorded by default.

## Recommended Execution Mode

Use **Subagent-Driven (this session)** with one fresh worker per task group:

- Worker 1: Tasks 1-2 model and participant state.
- Worker 2: Tasks 3-5 stage UI, height, fullscreen.
- Worker 3: Tasks 6-8 media scope and project session.
- Main agent: review diffs, run gates, capture local proof, amend the current hotfix PR.

Do not let workers edit the same files at the same time. Tasks 3-8 all touch `CoWorkingPanel.tsx`, so serialize implementation or use worktree isolation and integrate manually.
