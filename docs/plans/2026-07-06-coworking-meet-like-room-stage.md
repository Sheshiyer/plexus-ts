# Co-working Meet-like Room Stage Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Plexus Co-working tab renderer-first into a Meet-like room stage with a stable focused project zone, people plus screen tiles, pin/fullscreen behavior, internal stage scrolling, and project controls inside fullscreen while preserving the native screen picker.

**Architecture:** Keep the existing Electron IPC and realtime room/call primitives. First complete the pure renderer model (`coworkingModel.ts`) so the UI derives project options, focused zone state, lounge layer state, and screen wall state without browser/runtime APIs. Then replace the card-grid renderer with componentized React stage pieces and wire project media controls to explicit post-join actions; project-room media transport remains a later phase after the room stage is stable.

**Tech Stack:** Electron main/preload IPC, React 18 CSR renderer, TypeScript shared contracts, Vitest model tests, Vite/Electron build checks, existing `RealtimeSession` helper, existing `window.plexus.*` bridge.

---

## Context Map

### Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `src/renderer/lib/coworkingModel.ts` | Pure renderer state model | Implement project room options, focused zone, lounge layer, and screen wall derivation. Must remain free of `window`, `document`, `navigator`, Electron, and media runtime APIs. |
| `test/coworking/project-room-options.test.ts` | New pure model test | Cover dropdown options: exclude lounge, sort active rooms first, include member/screen counts. |
| `test/coworking/focused-zone.test.ts` | New pure model test | Cover visual focus, no auto-join, member filtering, live screen filtering, pinned id cleanup. |
| `test/coworking/lounge-layer.test.ts` | New pure model test | Cover lounge members, mini strip visibility, and project media priority. |
| `test/coworking/screen-wall-model.test.ts` | Existing pure model test | Already covers multi-screen tiles and pin behavior; production model must satisfy it. |
| `package.json` | Existing scripts | Add `test:coworking` for repeatable focused verification. |
| `src/renderer/components/CoWorkingPanel.tsx` | Main co-working UI | Later: replace room card grid with focused stage, project selector, explicit project controls, fullscreen shell. |
| `src/renderer/components/coworking/*.tsx` | New component folder | Later: extract `ProjectZoneSelect`, `FocusedProjectStage`, `ScreenWall`, `StageFullscreenShell`, `ProjectControls`, and lounge mini-strip components. |
| `src/renderer/theme.css` | FORMA layout tokens/styles | Later: add `.px-coworking-stage`, `.px-focused-zone`, `.px-screen-wall`, `.px-stage-fullscreen`, and internal scroll rules. |

### Dependencies

| File | Relationship |
|------|--------------|
| `src/shared/coworking.ts` | Defines `CoWorkingFocusedZone`, join-state, and recording-state types consumed by `coworkingModel.ts`. |
| `src/shared/types.ts` | Defines `RealtimeRoom`, `FloorPresence`, `RealtimeMediaTrack`, and `PlexusAPI` IPC facade used by renderer and tests. |
| `src/preload/preload.ts` | Exposes existing room/detail/join/publish APIs and must not expose raw Electron or secrets. |
| `src/main/main.ts` | Owns privileged IPC handlers and native screen picker registration; do not replace `getDisplayMedia` path. |
| `src/renderer/lib/RealtimeSession.ts` | Existing media session helper; later transport work must preserve screen track kind and subscribe to focused-room tracks. |
| `src/renderer/App.tsx` | Routes the `realtime` tab to `CoWorkingPanel`; likely no change until UI replacement needs project data. |

### Test Files

| Test | Coverage |
|------|----------|
| `test/coworking/coworking-model-contract.test.ts` | Existing export/default/purity contract. |
| `test/coworking/project-focus-behavior.test.ts` | Existing no-auto-join focus behavior contract. |
| `test/coworking/screen-wall-model.test.ts` | Existing wall/pin model contract. |
| `test/coworking/coworking-types.test.ts` | Existing shared type contract. |
| `test/coworking/recording-ipc-contract.test.ts` | Existing recording facade contract; full handler implementation is later. |

### Reference Patterns

| File | Pattern |
|------|---------|
| `src/renderer/components/CoWorkingPanel.tsx` | Existing local state, IPC loading, explicit media toggles, closeout modal, and native screen picker button. |
| `src/renderer/theme.css` | Existing FORMA CSS style: tokenized colors, simple selectors, responsive media blocks. |
| `src/main/main.ts:574-587` | Native display media handler; preserve this instead of introducing custom screen picker UI. |

### Risk Assessment

- [ ] Breaking changes to public API: avoid in first renderer-model slice.
- [ ] Database migrations needed: no for renderer-first stage.
- [ ] Configuration changes required: add only `test:coworking` script.
- [ ] Electron security boundary: renderer model remains pure; no direct R2/Worker secrets or raw `ipcRenderer`.
- [ ] UX regression risk: old room-grid behavior changes later; gate with pure model and UI tests/manual evidence.

## Non-Negotiable Product Rules

1. Do not replace the native screen picker.
2. Project focus changes visual focus only; it does not join, publish media, or record.
3. Joining a project zone starts presence-only.
4. Mic, camera, screen, recording, and closeout are explicit post-join project controls.
5. The lounge can remain ambient while a project zone is focused.
6. Screen wall defaults to showing every live screen; pin/fullscreen changes layout only.
7. Fullscreen must contain project controls and internal scrolling; it must not hide leave/stop/share controls.
8. Renderer code never receives secrets, R2 credentials, raw Node handles, or raw `ipcRenderer`.

## Batch 1 - Pure Model Foundation

### Task 1: Add project room option derivation tests

**Files:**
- Create: `test/coworking/project-room-options.test.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

Create `test/coworking/project-room-options.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { listProjectRoomOptions } from '../../src/renderer/lib/coworkingModel';
import type { FloorPresence, RealtimeMediaTrack, RealtimeRoom } from '../../src/shared/types';

function room(input: Partial<RealtimeRoom> & Pick<RealtimeRoom, 'id' | 'name' | 'roomType'>): RealtimeRoom {
  return {
    workspaceId: 'workspace_1',
    projectId: input.roomType === 'project_room' ? `project_${input.id}` : null,
    projectName: input.name,
    slug: input.id,
    state: 'open',
    visibility: 'workspace',
    activeCallId: null,
    activeCall: null,
    presence: { participants: 0, screenShares: 0 },
    metadata: {},
    lastActivityAt: '2026-07-06T10:00:00.000Z',
    createdAt: '2026-07-06T09:00:00.000Z',
    updatedAt: '2026-07-06T10:00:00.000Z',
    ...input,
  };
}

function presence(roomId: string, participantId: string): FloorPresence {
  return {
    participantId,
    displayName: participantId,
    initials: participantId.slice(0, 2).toUpperCase(),
    ringState: 'online',
    roomId,
    roomName: roomId,
    projectTag: roomId,
    isSpeaking: false,
  };
}

function screen(roomId: string, id: string): RealtimeMediaTrack {
  return {
    id,
    workspaceId: 'workspace_1',
    roomId,
    callSessionId: 'call_1',
    participantId: 'participant_1',
    identityId: 'identity_1',
    trackKind: 'screen',
    direction: 'publish',
    state: 'live',
    label: id,
    sourceId: null,
    cloudflareSessionId: null,
    cloudflareTrackId: null,
    targetTrackIds: [],
    metadata: {},
    startedAt: '2026-07-06T10:00:00.000Z',
    endedAt: null,
    updatedAt: '2026-07-06T10:00:00.000Z',
  };
}

describe('coworking project room options', () => {
  it('excludes the lounge and sorts active project rooms before inactive rooms by label', () => {
    const rooms = [
      room({ id: 'lobby', name: 'Lounge', roomType: 'workspace_lobby' }),
      room({ id: 'zeta', name: 'Zeta room', roomType: 'project_room', projectName: 'Zeta' }),
      room({ id: 'alpha', name: 'Alpha room', roomType: 'project_room', projectName: 'Alpha' }),
    ];

    const options = listProjectRoomOptions(
      rooms,
      [presence('zeta', 'participant_zed')],
      [screen('zeta', 'screen_1')],
    );

    expect(options.map((option) => option.roomId)).toEqual(['zeta', 'alpha']);
    expect(options[0]).toMatchObject({
      projectId: 'project_zeta',
      label: 'Zeta',
      activeMemberCount: 1,
      screenShareCount: 1,
    });
    expect(options[1]).toMatchObject({
      label: 'Alpha',
      activeMemberCount: 0,
      screenShareCount: 0,
    });
  });
});
```

**Step 2: Add the focused test script**

Modify `package.json` scripts:

```json
"test:coworking": "vitest run test/coworking"
```

**Step 3: Run test to verify it fails**

Run:

```bash
npm run test:coworking -- project-room-options
```

Expected: FAIL because `listProjectRoomOptions` still returns `[]`.

**Step 4: Commit**

After the RED failure is confirmed:

```bash
git add package.json test/coworking/project-room-options.test.ts
git commit -m "test: specify coworking project room options"
```

### Task 2: Implement project room option derivation

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/project-room-options.test.ts`

**Step 1: Write minimal implementation**

Implement `listProjectRoomOptions` to:

1. Keep only `room.roomType === 'project_room'`.
2. Count floor members where `presence.roomId === room.id`.
3. Count live published screen tracks where `track.roomId === room.id`, `track.trackKind === 'screen'`, `track.direction === 'publish'`, and `track.state === 'live'`.
4. Use `room.projectName ?? room.name` as label.
5. Sort by active count descending, then screen count descending, then label ascending.

**Step 2: Run test to verify it passes**

Run:

```bash
npm run test:coworking -- project-room-options
```

Expected: PASS.

**Step 3: Run existing model defaults**

Run:

```bash
npm run test:coworking -- coworking-model-contract
```

Expected: PASS after adjusting the old default test to expect a project-room option only if necessary. Prefer preserving current safe empty behavior for empty inputs.

**Step 4: Commit**

```bash
git add src/renderer/lib/coworkingModel.ts test/coworking/project-room-options.test.ts
git commit -m "feat: derive coworking project room options"
```

### Task 3: Add focused zone derivation tests

**Files:**
- Create: `test/coworking/focused-zone.test.ts`

**Step 1: Write the failing tests**

Cover:

1. Members filter to selected room.
2. Live screen tracks filter to selected room.
3. `joinState` is `presence_only` when `activeRoomId` equals selected room id.
4. Unknown `pinnedTrackId` is cleared.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:coworking -- focused-zone
```

Expected: FAIL because `deriveFocusedZone` returns empty members/tracks and does not derive join state.

**Step 3: Commit**

```bash
git add test/coworking/focused-zone.test.ts
git commit -m "test: specify coworking focused zone derivation"
```

### Task 4: Implement focused zone derivation

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/focused-zone.test.ts`

**Step 1: Write minimal implementation**

Update `deriveFocusedZone` to:

1. Return lounge defaults when no `selectedRoom` exists.
2. Filter `members` by selected room id.
3. Filter `screenTracks` by selected room id and live published screen tracks.
4. Set `joinState` to `presence_only` when `activeRoomId === selectedRoom.id`; otherwise `not_joined`.
5. Preserve `recordingState`, defaulting to `idle`.
6. Preserve `pinnedTrackId` only when it matches a live screen track.

**Step 2: Run tests**

Run:

```bash
npm run test:coworking -- focused-zone project-focus-behavior coworking-model-contract
```

Expected: PASS.

**Step 3: Commit**

```bash
git add src/renderer/lib/coworkingModel.ts
git commit -m "feat: derive coworking focused zone"
```

### Task 5: Add and implement lounge layer derivation

**Files:**
- Create: `test/coworking/lounge-layer.test.ts`
- Modify: `src/renderer/lib/coworkingModel.ts`

**Step 1: Write the failing test**

Test that lounge members are those with `presence.roomId === loungeRoom.id` or `ringState === 'lounge'`, mini controls are visible when a project zone is active, and audio priority becomes project only when `projectZoneActive` is true.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:coworking -- lounge-layer
```

Expected: FAIL because `members` is always empty.

**Step 3: Implement minimal code**

Update `deriveLoungeLayer` to filter members and keep the existing visibility/priority contract.

**Step 4: Run tests**

Run:

```bash
npm run test:coworking -- lounge-layer coworking-model-contract
```

Expected: PASS.

**Step 5: Commit**

```bash
git add test/coworking/lounge-layer.test.ts src/renderer/lib/coworkingModel.ts
git commit -m "feat: derive coworking lounge layer"
```

### Task 6: Implement screen wall derivation

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/screen-wall-model.test.ts`

**Step 1: Run existing failing test**

Run:

```bash
npm run test:coworking -- screen-wall-model
```

Expected: FAIL because `deriveScreenWall` returns no tiles.

**Step 2: Implement minimal code**

Update `deriveScreenWall` to:

1. Keep only live published screen tracks.
2. Sort by `startedAt`, then id for deterministic wall order.
3. Map each track to `{ trackId, participantId, label, pinned, track }`.
4. Use `track.label ?? participantId` for label.
5. Enter `pinned` mode only when the pinned id matches a tile.

**Step 3: Run tests**

Run:

```bash
npm run test:coworking -- screen-wall-model coworking-model-contract focused-zone
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/renderer/lib/coworkingModel.ts
git commit -m "feat: derive coworking screen wall"
```

## Batch 2 - Renderer Stage Shell

### Task 7: Create component folder and project selector

**Files:**
- Create: `src/renderer/components/coworking/ProjectZoneSelect.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Test: `test/coworking/project-focus-behavior.test.ts`

**Steps:**
1. Add `selectedRoomId` state.
2. Derive project options from `listProjectRoomOptions`.
3. Render a labeled `<select>` in the page header actions or floor toolbar.
4. On change, update `selectedRoomId` only.
5. Verify `dropInToRoom` is not called by selection.
6. Run `npm run test:coworking -- project-focus-behavior && npm run typecheck`.
7. Commit: `feat: add coworking project focus selector`.

### Task 8: Replace room grid with focused stage shell

**Files:**
- Create: `src/renderer/components/coworking/FocusedProjectStage.tsx`
- Create: `src/renderer/components/coworking/AmbientPeopleRail.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/theme.css`

**Steps:**
1. Create `FocusedProjectStage` props from `CoWorkingFocusedZone`.
2. Render room name, members, join state, empty screen wall placeholder, and stage actions slot.
3. Move floor avatars into `AmbientPeopleRail`.
4. Stop rendering the project room card grid as the primary experience.
5. Run `rg -n "rooms.map" src/renderer/components/CoWorkingPanel.tsx` and confirm the old primary grid is gone.
6. Run `npm run typecheck`.
7. Commit: `feat: render coworking focused project stage`.

### Task 9: Keep lounge as a layer

**Files:**
- Create: `src/renderer/components/coworking/LoungeMiniStrip.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/theme.css`

**Steps:**
1. Render lounge summary below or beside focused stage, not as a detached third panel.
2. Show mini controls when project zone is focused.
3. Preserve `NO REC` and `NO TRANSCRIPT` chips.
4. Keep leave lounge available.
5. Run `npm run typecheck`.
6. Commit: `feat: keep coworking lounge layer visible`.

## Batch 3 - Project Controls and Screen Wall UI

### Task 10: Make project join presence-only

**Files:**
- Create: `test/coworking/project-join-presence-only.test.ts`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`

**Steps:**
1. Test desired `realtimeJoinRoom` input shape for project rooms.
2. Run test and verify RED: active call currently requests `intent: "media"`.
3. Change project joins to always send `intent: "presence_only"` and `media: { audio: false, video: false, screen: false }`.
4. Run focused test and typecheck.
5. Commit: `feat: make project room join presence-first`.

### Task 11: Add project media controls

**Files:**
- Create: `src/renderer/components/coworking/ProjectMediaControls.tsx`
- Modify: `src/renderer/components/coworking/FocusedProjectStage.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`

**Steps:**
1. Render mic, camera, screen, closeout, leave, and fullscreen buttons.
2. Disable mic/camera/screen until the user has a project active join.
3. Keep the screen button calling `navigator.mediaDevices.getDisplayMedia`; do not introduce a custom picker.
4. Keep closeout explicit and Paperclip checkbox visible.
5. Run `npm run typecheck`.
6. Commit: `feat: add explicit project media controls`.

### Task 12: Render screen wall and pin behavior

**Files:**
- Create: `src/renderer/components/coworking/ScreenWall.tsx`
- Modify: `src/renderer/components/coworking/FocusedProjectStage.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/theme.css`

**Steps:**
1. Add `pinnedTrackId` state to `CoWorkingPanel`.
2. Derive screen wall using `deriveScreenWall`.
3. Render empty state, wall layout, and pinned layout.
4. Clicking a tile toggles pinned mode.
5. Run `npm run test:coworking -- screen-wall-model && npm run typecheck`.
6. Commit: `feat: add coworking screen wall pinning`.

## Batch 4 - Fullscreen Stage

### Task 13: Add fullscreen shell with internal scrolling

**Files:**
- Create: `src/renderer/components/coworking/StageFullscreenShell.tsx`
- Modify: `src/renderer/components/coworking/FocusedProjectStage.tsx`
- Modify: `src/renderer/theme.css`

**Steps:**
1. Add fullscreen state in `CoWorkingPanel`.
2. Render fullscreen overlay with stage title, screen wall, people rail, and project controls.
3. Put overflowing content inside an internal scroll container.
4. Restore focus to the fullscreen button on exit.
5. Close on `Escape`.
6. Run `npm run typecheck`.
7. Commit: `feat: add coworking stage fullscreen`.

### Task 14: Add visual/manual verification evidence

**Files:**
- Create: `docs/evidence/2026-07-06-coworking-room-stage.md`

**Steps:**
1. Record exact commands run.
2. Capture manual stories: focus change, no auto-join, join presence-only, screen wall empty/multi/pinned, fullscreen controls, native picker trigger.
3. Include known gaps for project-room media transport if not implemented yet.
4. Run `git diff --check`.
5. Commit: `docs: add coworking room stage verification evidence`.

## Completion Criteria

- `npm run test:coworking` passes.
- `npm run typecheck` passes.
- `git diff --check` passes.
- Co-working tab no longer uses the room card grid as the primary experience.
- Native screen picker path is preserved.
- Focus/select does not auto-join.
- Project join is presence-only.
- Screen wall supports empty, wall, pinned, and fullscreen states.
- Fullscreen includes project controls and internal scrolling.

