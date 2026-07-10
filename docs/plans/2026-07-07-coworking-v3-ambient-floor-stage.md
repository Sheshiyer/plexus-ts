# Co-working V3 Ambient Floor Stage Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the shipped Co-working room-console UI with the approved V3 ambient-floor direction: one immersive social floor instrument, a focus-only project command island, spatial project-zone nodes, room instruments, and a persistent lounge strip.

**Architecture:** Keep the existing Electron IPC, native screen picker, room join/leave flows, lounge media controls, and pure renderer model boundary. Add one small pure model helper for selecting spatial project-zone nodes, then refactor `CoWorkingPanel.tsx` so the visible UI is one ambient-floor composition instead of stacked floor/stage/list panels. Implement the V3 FORMA styling in the existing `theme.css` co-working block using square-edge, hairline, crosshair, inset-glow CSS only.

**Tech Stack:** Electron + React 18 + TypeScript renderer, existing `window.plexus.*` preload API, existing `RealtimeSession`, Vitest source/model tests, CSS in `src/renderer/theme.css`, FORMA primitives from `src/renderer/components/PlexusUI.tsx` and `src/renderer/components/ui.tsx`.

---

## Reference Context

### Approved Visual Direction

- V3 approval mockup: `/Users/sheshnarayaniyer/.copilot/session-state/7466effd-bea3-44f2-993d-b81f2a277a27/files/coworking-ui/plexus-coworking-design-referenced-v3.png`
- Prior generated direction: `/Users/sheshnarayaniyer/.copilot/session-state/7466effd-bea3-44f2-993d-b81f2a277a27/files/coworking-ui/plexus-coworking-ambient-floor-v2.png`

### Repo Design Contracts

- `docs/design/ambient-floor-reframe.md`
- `docs/design/screen-references/co-working.prompt.txt`
- `docs/design/screen-references/co-working.png`
- `docs/design/screen-references/app-component-viewport-design-sheet.md`
- `docs/design/screen-references/app-component-viewport-design-sheet.png`
- `docs/design/screen-references/settings-component-design-sheet.md`
- `docs/design/screen-references/settings-component-design-sheet.png`
- `docs/superpowers/specs/2026-06-11-plexus-ui-redesign-design.md`

### Product Rules That Must Survive

1. Project selection is focus-only until the user explicitly clicks Drop in.
2. Drop in starts presence-only; mic, camera, screen, and recording stay opt-in.
3. Do not replace or bypass the native macOS screen picker.
4. The lounge remains visible as a persistent mini layer.
5. Lounge audio must not visually imply hidden recording or hidden capture.
6. The screen wall defaults to all live shares; pinning is visual only.
7. Fullscreen/stage mode must keep controls visible inside the stage.
8. No new transport, database schema, R2 bucket, or recording backend work in this phase.

### Current Code Surfaces

| File | Current Role | V3 Change |
| --- | --- | --- |
| `src/renderer/components/CoWorkingPanel.tsx` | Main co-working page, current stacked floor/stage/lounge render | Replace visible composition with V3 ambient floor while reusing existing loaders, join/leave, media controls, closeout modal, and derived model state. |
| `src/renderer/lib/coworkingModel.ts` | Pure project options/focus/lounge/screen wall model | Add `selectAmbientFloorZones()` to choose a small spatial node set without making the floor an all-project list. |
| `test/coworking/coworking-room-stage-ui.test.ts` | Source guard for hotfix room-stage wiring | Update guard so it prevents regressions back to the room-list/admin-console UI. |
| `test/coworking/ambient-floor-zones.test.ts` | New model test | Cover project-zone node selection and selected-room priority. |
| `src/renderer/theme.css` | FORMA app CSS, co-working block starts near line 1197 | Replace/extend co-working styles with ambient floor, command island, project nodes, room instruments, and lounge mini layer. |

## Implementation Strategy

- Do not add a new component library or dependency.
- Prefer local component extraction inside `CoWorkingPanel.tsx` for this phase because the existing page state types (`ActiveJoin`, room actions, media state) are local and tightly coupled.
- Add only one new pure model helper because spatial node selection is logic, not styling.
- Keep the current old room-card CSS as legacy/fallback if it is still referenced elsewhere, but the main `CoWorkingPanel` render must no longer present the project-room list as the primary experience.
- Use source-level tests for copy/class contracts and pure model tests for behavior. Avoid brittle pixel/image tests.

---

## Task 1: Update the UI Source Contract Test for V3

**Files:**
- Modify: `test/coworking/coworking-room-stage-ui.test.ts`

**Step 1: Write the failing test**

Replace the current test file with:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coworking V3 ambient floor UI', () => {
  it('renders the approved ambient-floor project stage instead of a room-list console', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    expect(panel).toContain('selectAmbientFloorZones');
    expect(panel).toContain('Ambient floor');
    expect(panel).toContain('Focus-only project zone');
    expect(panel).toContain('Room instruments');
    expect(panel).toContain('Screen wall ready');
    expect(panel).toContain('Stage mode keeps controls inside fullscreen');
    expect(panel).toContain('project voice takes priority');
    expect(panel).toContain('Drop in starts presence-only');
    expect(panel).toContain('native picker');

    expect(panel).not.toContain('Project co-working stage');
    expect(panel).not.toContain('Project rooms</span>');
  });

  it('keeps the screen picker and media controls explicit', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    expect(panel).toContain('navigator.mediaDevices.getDisplayMedia');
    expect(panel).toContain('aria-label={screenActive ? \\'Stop screen sharing\\' : \\'Share screen\\'}');
    expect(panel).toContain('Mic off');
    expect(panel).toContain('Camera off');
    expect(panel).toContain('Recording off');
    expect(panel).toContain('Lounge muted');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:coworking -- coworking-room-stage-ui
```

Expected: FAIL because `selectAmbientFloorZones`, V3 text, and the new room instruments do not exist yet.

**Step 3: Commit**

```bash
git add test/coworking/coworking-room-stage-ui.test.ts
git commit -m "test: specify coworking ambient floor UI"
```

---

## Task 2: Add Pure Model Tests for Spatial Project Zones

**Files:**
- Create: `test/coworking/ambient-floor-zones.test.ts`
- Modify: `src/renderer/lib/coworkingModel.ts` only if TypeScript needs exported type placeholders for the red test; otherwise do not modify implementation in this task.

**Step 1: Write the failing test**

Create `test/coworking/ambient-floor-zones.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  selectAmbientFloorZones,
  type CoWorkingProjectRoomOption,
} from '../../src/renderer/lib/coworkingModel';
import type { RealtimeRoom } from '../../src/shared/types';

function room(id: string, projectName: string): RealtimeRoom {
  return {
    id,
    workspaceId: 'workspace_1',
    projectId: `project_${id}`,
    projectName,
    name: `${projectName} room`,
    slug: id,
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: null,
    activeCall: null,
    presence: { participants: 0, screenShares: 0 },
    metadata: {},
    lastActivityAt: '2026-07-07T06:00:00.000Z',
    createdAt: '2026-07-07T05:00:00.000Z',
    updatedAt: '2026-07-07T06:00:00.000Z',
  };
}

function option(input: {
  roomId: string;
  label: string;
  activeMemberCount?: number;
  screenShareCount?: number;
}): CoWorkingProjectRoomOption {
  return {
    roomId: input.roomId,
    projectId: `project_${input.roomId}`,
    label: input.label,
    activeMemberCount: input.activeMemberCount ?? 0,
    screenShareCount: input.screenShareCount ?? 0,
    room: room(input.roomId, input.label),
  };
}

describe('ambient floor project zone selection', () => {
  it('keeps the selected project first even when it is quiet', () => {
    const zones = selectAmbientFloorZones(
      [
        option({ roomId: 'portal', label: 'MayDeck Portal', activeMemberCount: 3, screenShareCount: 1 }),
        option({ roomId: 'heyzack', label: 'HeyZack Estimate' }),
        option({ roomId: 'sym', label: 'Symphonance', activeMemberCount: 1 }),
      ],
      'heyzack',
    );

    expect(zones.map((zone) => zone.roomId)).toEqual(['heyzack', 'portal', 'sym']);
    expect(zones[0]).toMatchObject({
      label: 'HeyZack Estimate',
      selected: true,
      stateLabel: 'FOCUS',
      occupancyLabel: '0 present',
      screenLabel: '0 screens',
    });
  });

  it('limits the floor to a small relevant node set and reports hidden overflow', () => {
    const zones = selectAmbientFloorZones(
      [
        option({ roomId: 'a', label: 'A', activeMemberCount: 4 }),
        option({ roomId: 'b', label: 'B', screenShareCount: 2 }),
        option({ roomId: 'c', label: 'C', activeMemberCount: 1 }),
        option({ roomId: 'd', label: 'D' }),
        option({ roomId: 'e', label: 'E' }),
        option({ roomId: 'f', label: 'F' }),
      ],
      'a',
      4,
    );

    expect(zones).toHaveLength(5);
    expect(zones.slice(0, 4).map((zone) => zone.roomId)).toEqual(['a', 'b', 'c', 'd']);
    expect(zones[4]).toMatchObject({
      roomId: '__overflow__',
      label: '+ 2 more',
      stateLabel: 'MORE',
      selected: false,
      room: null,
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:coworking -- ambient-floor-zones
```

Expected: FAIL because `selectAmbientFloorZones` is not exported.

**Step 3: Commit**

```bash
git add test/coworking/ambient-floor-zones.test.ts
git commit -m "test: specify ambient floor project zone selection"
```

---

## Task 3: Implement Ambient Floor Project-Zone Selection

**Files:**
- Modify: `src/renderer/lib/coworkingModel.ts`
- Test: `test/coworking/ambient-floor-zones.test.ts`

**Step 1: Add exported type and helper**

Add this below `CoWorkingProjectRoomOption`:

```ts
export interface CoWorkingAmbientFloorZone {
  roomId: string;
  projectId: string | null;
  label: string;
  selected: boolean;
  stateLabel: 'FOCUS' | 'ACTIVE' | 'SHARING' | 'QUIET' | 'EMPTY' | 'MORE';
  occupancyLabel: string;
  screenLabel: string;
  activeMemberCount: number;
  screenShareCount: number;
  room: RealtimeRoom | null;
}
```

Add this helper after `listProjectRoomOptions`:

```ts
function stateLabelForProjectZone(option: CoWorkingProjectRoomOption, selected: boolean): CoWorkingAmbientFloorZone['stateLabel'] {
  if (selected) return 'FOCUS';
  if (option.screenShareCount > 0) return 'SHARING';
  if (option.activeMemberCount > 1) return 'ACTIVE';
  if (option.activeMemberCount === 1) return 'QUIET';
  return 'EMPTY';
}

export function selectAmbientFloorZones(
  options: CoWorkingProjectRoomOption[],
  selectedRoomId: string | null,
  limit = 4,
): CoWorkingAmbientFloorZone[] {
  const selected = selectedRoomId
    ? options.find((option) => option.roomId === selectedRoomId) ?? null
    : null;
  const remaining = options.filter((option) => option.roomId !== selected?.roomId);
  const visibleOptions = [
    ...(selected ? [selected] : []),
    ...remaining,
  ].slice(0, Math.max(1, limit));

  const zones: CoWorkingAmbientFloorZone[] = visibleOptions.map((option) => {
    const isSelected = option.roomId === selected?.roomId;
    return {
      roomId: option.roomId,
      projectId: option.projectId,
      label: option.label,
      selected: isSelected,
      stateLabel: stateLabelForProjectZone(option, isSelected),
      occupancyLabel: `${option.activeMemberCount} ${option.activeMemberCount === 1 ? 'present' : 'present'}`,
      screenLabel: `${option.screenShareCount} ${option.screenShareCount === 1 ? 'screen' : 'screens'}`,
      activeMemberCount: option.activeMemberCount,
      screenShareCount: option.screenShareCount,
      room: option.room,
    };
  });

  const hiddenCount = Math.max(0, options.length - visibleOptions.length);
  if (hiddenCount > 0) {
    zones.push({
      roomId: '__overflow__',
      projectId: null,
      label: `+ ${hiddenCount} more`,
      selected: false,
      stateLabel: 'MORE',
      occupancyLabel: `${hiddenCount} hidden`,
      screenLabel: 'open rail',
      activeMemberCount: 0,
      screenShareCount: 0,
      room: null,
    });
  }

  return zones;
}
```

**Step 2: Run focused model test**

Run:

```bash
npm run test:coworking -- ambient-floor-zones
```

Expected: PASS.

**Step 3: Run all coworking tests**

Run:

```bash
npm run test:coworking
```

Expected: only the V3 UI source test still fails until the UI is implemented. Model tests should pass.

**Step 4: Commit**

```bash
git add src/renderer/lib/coworkingModel.ts test/coworking/ambient-floor-zones.test.ts
git commit -m "feat: select ambient floor project zones"
```

---

## Task 4: Refactor CoWorkingPanel Derived State for V3

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx`

**Step 1: Import the model helper**

Change the model import:

```ts
import {
  deriveFocusedZone,
  deriveLoungeLayer,
  deriveScreenWall,
  listProjectRoomOptions,
  selectAmbientFloorZones,
  type CoWorkingAmbientFloorZone,
  type CoWorkingProjectRoomOption,
  type CoWorkingScreenWall,
} from '../lib/coworkingModel';
```

**Step 2: Add `stageModeLabel` and `ambientFloorZones` derived state**

After `screenWall`:

```ts
const ambientFloorZones = useMemo(
  () => selectAmbientFloorZones(roomOptions, selectedProjectRoom?.id ?? null, 4),
  [roomOptions, selectedProjectRoom?.id],
);
const stageModeLabel = stageFullscreen ? 'Exit stage mode' : 'Stage mode';
```

**Step 3: Add Escape key support for stage mode**

Below the selected-room detail effect:

```ts
useEffect(() => {
  if (!stageFullscreen) return undefined;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setStageFullscreen(false);
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [stageFullscreen]);
```

**Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/CoWorkingPanel.tsx
git commit -m "refactor: prepare coworking ambient floor state"
```

---

## Task 5: Replace the Stage Components with V3 Ambient Floor Components

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx:187-357`

**Step 1: Replace `ProjectRoomRail` with `AmbientProjectZoneMap`**

Remove `ProjectRoomRail` and add:

```tsx
function AmbientProjectZoneMap({
  zones,
  onSelect,
}: {
  zones: CoWorkingAmbientFloorZone[];
  onSelect: (roomId: string) => void;
}) {
  return (
    <div className="px-ambient-zone-map" aria-label="Ambient project zones">
      {zones.map((zone, index) => {
        const actionable = Boolean(zone.room);
        return (
          <button
            key={zone.roomId}
            type="button"
            className={`px-ambient-zone-node node-${index + 1}${zone.selected ? ' selected' : ''} state-${zone.stateLabel.toLowerCase()}`}
            onClick={() => actionable && onSelect(zone.roomId)}
            disabled={!actionable}
            aria-pressed={zone.selected}
          >
            <span className="px-ambient-node-kicker">{zone.stateLabel}</span>
            <strong>{zone.label}</strong>
            <small>{zone.occupancyLabel} · {zone.screenLabel}</small>
          </button>
        );
      })}
      <span className="px-ambient-trace trace-a" aria-hidden="true" />
      <span className="px-ambient-trace trace-b" aria-hidden="true" />
      <span className="px-ambient-trace trace-c" aria-hidden="true" />
    </div>
  );
}
```

**Step 2: Replace `ScreenWall` empty copy and slot rendering**

Keep the existing `ScreenWall` name, but make it render V3 slot language:

```tsx
function ScreenWall({
  wall,
  onPin,
}: {
  wall: CoWorkingScreenWall;
  onPin: (trackId: string | null) => void;
}) {
  if (!wall.tiles.length) {
    return (
      <div className="px-ambient-screen-empty">
        <div className="px-ambient-screen-slots" aria-hidden="true">
          <span>PIN TARGET</span>
          <span>SCREEN WALL READY</span>
          <span>ROOM NOTES</span>
        </div>
        <div className="px-ambient-screen-ready">
          <IconScreen s={30} />
          <strong>Screen wall ready</strong>
          <span>Native picker opens when you share. No screen, mic, or camera starts from focus alone.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-ambient-screen-grid ${wall.mode}`}>
      {wall.tiles.map((tile) => (
        <button
          key={tile.trackId}
          type="button"
          className={`px-ambient-screen-tile${tile.pinned ? ' pinned' : ''}`}
          onClick={() => onPin(tile.pinned ? null : tile.trackId)}
          aria-pressed={tile.pinned}
        >
          <span className="px-ambient-screen-preview">
            <IconScreen s={34} />
          </span>
          <span className="px-ambient-screen-meta">
            <strong>{tile.label}</strong>
            <small>{tile.pinned ? 'Pinned screen' : 'Click to pin'}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
```

**Step 3: Add `RoomInstrumentsRail`**

Add:

```tsx
function RoomInstrumentsRail({
  zone,
  wall,
  activeJoin,
  micActive,
  cameraActive,
  screenActive,
}: {
  zone: ReturnType<typeof deriveFocusedZone>;
  wall: CoWorkingScreenWall;
  activeJoin?: ActiveJoin;
  micActive: boolean;
  cameraActive: boolean;
  screenActive: boolean;
}) {
  const primaryMember = zone.members[0] ?? null;
  const state = activeJoin ? 'Presence only' : 'Focus only';
  return (
    <aside className="px-room-instruments" aria-label="Room instruments">
      <div className="px-room-instruments-head">
        <span className="px-lbl">Room instruments</span>
        <StatusChip tone={activeJoin ? 'accent' : 'idle'}>{state}</StatusChip>
      </div>
      <div className="px-room-instrument-rails">
        <div className="px-room-instrument-rail">
          <span>People</span>
          <strong>{primaryMember ? primaryMember.displayName : 'No one present'}</strong>
          <small>{primaryMember ? `${primaryMember.initials} · ${primaryMember.ringState}` : 'waiting for presence'}</small>
        </div>
        <div className="px-room-instrument-rail">
          <span>Media</span>
          <strong>{screenActive || wall.tiles.length ? 'Screen ready' : 'Screen idle'}</strong>
          <small>{micActive ? 'Mic on' : 'Mic off'} · {cameraActive ? 'Camera on' : 'Camera off'}</small>
        </div>
        <div className="px-room-instrument-rail">
          <span>Capture</span>
          <strong>Recording off</strong>
          <small>No hidden transcript · no automatic Paperclip</small>
        </div>
        <div className="px-room-instrument-rail">
          <span>Priority</span>
          <strong>Lounge muted</strong>
          <small>project voice takes priority</small>
        </div>
      </div>
    </aside>
  );
}
```

**Step 4: Replace `FocusedRoomStage` with `AmbientFloorStage`**

Remove `FocusedRoomStage` and add:

```tsx
function AmbientFloorStage({
  zone,
  wall,
  ambientFloorZones,
  roomDetailError,
  fullscreen,
  activeJoin,
  pending,
  micActive,
  cameraActive,
  screenActive,
  onSelectZone,
  onDropIn,
  onLeave,
  onCloseout,
  onPin,
  onToggleFullscreen,
}: {
  zone: ReturnType<typeof deriveFocusedZone>;
  wall: CoWorkingScreenWall;
  ambientFloorZones: CoWorkingAmbientFloorZone[];
  roomDetailError: string | null;
  fullscreen: boolean;
  activeJoin?: ActiveJoin;
  pending: boolean;
  micActive: boolean;
  cameraActive: boolean;
  screenActive: boolean;
  onSelectZone: (roomId: string) => void;
  onDropIn: (room: RealtimeRoom) => void;
  onLeave: (room: RealtimeRoom) => void;
  onCloseout: (entry: ActiveJoin) => void;
  onPin: (trackId: string | null) => void;
  onToggleFullscreen: () => void;
}) {
  const room = zone.room;
  const primaryMember = zone.members[0] ?? null;
  const joined = Boolean(room && activeJoin);
  return (
    <section className={`px-ambient-floor${fullscreen ? ' stage-mode' : ''}`} aria-label="Ambient floor">
      <div className="px-ambient-field" aria-hidden="true" />
      <header className="px-ambient-floor-head">
        <div>
          <span className="px-lbl">Ambient floor</span>
          <h3>{zone.projectName || 'Select a project zone'}</h3>
          <p>Focus-only project zone · {zone.members.length} people · {wall.tiles.length} screens · {joined ? 'presence only' : 'not joined'}</p>
        </div>
        <div className="px-room-stage-actions">
          {room && (
            <Button
              variant={activeJoin ? 'stop' : 'accent'}
              onClick={() => (activeJoin ? onLeave(room) : onDropIn(room))}
              disabled={pending}
            >
              {activeJoin ? <IconClose s={12} /> : <IconUsers s={12} />}
              {activeJoin ? (pending ? 'Leaving' : 'Leave room') : (pending ? 'Joining' : 'Drop in')}
            </Button>
          )}
          <Button variant="ghost" onClick={onToggleFullscreen} disabled={!room}>
            <IconScreen s={13} /> {fullscreen ? 'Exit stage mode' : 'Stage mode'}
          </Button>
          {room && activeJoin && (
            <Button variant="ghost" onClick={() => onCloseout(activeJoin)} disabled={pending}>
              <IconPaperclip s={12} /> Paperclip
            </Button>
          )}
        </div>
      </header>

      <div className="px-ambient-floor-grid">
        <AmbientProjectZoneMap zones={ambientFloorZones} onSelect={onSelectZone} />

        <div className="px-project-command-island">
          <div className="px-project-command-head">
            <div>
              <span className="px-lbl">Focus-only project zone</span>
              <strong>{zone.projectName || 'No project selected'}</strong>
              <small>Drop in starts presence-only. Mic, camera, and screen stay opt-in.</small>
            </div>
            <div className="px-project-command-states" aria-label="Project zone state">
              <StatusChip tone={joined ? 'accent' : 'idle'}>{joined ? 'PRESENCE ONLY' : 'FOCUS ONLY'}</StatusChip>
              <StatusChip tone={zone.members.length ? 'mint' : 'idle'}>{zone.members.length} PRESENT</StatusChip>
              <StatusChip tone={wall.tiles.length ? 'accent' : 'idle'}>{wall.tiles.length} SCREENS</StatusChip>
              <StatusChip tone="idle">NOT RECORDING</StatusChip>
            </div>
          </div>

          {roomDetailError && <DegradedStatePanel title="Room detail unavailable" message={roomDetailError} tone="warning" />}

          <div className="px-project-command-body">
            <ScreenWall wall={wall} onPin={onPin} />
            <div className="px-project-participant-orbit" aria-label="Focused room participant">
              <span className="px-mini-avatar">{primaryMember?.initials ?? 'RA'}</span>
              <strong>{primaryMember?.displayName ?? 'Waiting for room presence'}</strong>
              <small>{primaryMember ? `${primaryMember.ringState} · project zone` : 'presence appears after drop-in'}</small>
            </div>
          </div>

          <div className="px-stage-mode-note">
            Stage mode keeps controls inside fullscreen · native picker opens from Share screen
          </div>
        </div>

        <RoomInstrumentsRail
          zone={zone}
          wall={wall}
          activeJoin={activeJoin}
          micActive={micActive}
          cameraActive={cameraActive}
          screenActive={screenActive}
        />
      </div>
    </section>
  );
}
```

**Step 5: Run tests**

Run:

```bash
npm run test:coworking -- coworking-room-stage-ui
npm run typecheck
```

Expected: The source test may still fail until the main render is replaced in Task 6. Typecheck should pass after fixing imports/props.

**Step 6: Commit**

```bash
git add src/renderer/components/CoWorkingPanel.tsx
git commit -m "refactor: add coworking ambient floor components"
```

---

## Task 6: Replace the Main Render with the V3 Composition

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx:1139-1268`

**Step 1: Change the page header copy and action dock**

Replace the `PageHeader` block with:

```tsx
<PageHeader
  title="Co-working"
  sub="ambient floor · focus-only project zones · screen wall"
  right={
    <div className="px-coworking-command-dock">
      {inLounge ? (
        <Button variant="stop" onClick={leaveLounge} disabled={busy === 'lounge_leave'}>
          <IconClose s={14} /> {busy === 'lounge_leave' ? 'LEAVING' : 'LEAVE LOUNGE'}
        </Button>
      ) : (
        <Button variant="accent" onClick={joinLounge} disabled={!loungeRoom || busy === 'lounge_join'}>
          <IconMic s={14} /> {busy === 'lounge_join' ? 'JOINING' : 'JOIN LOUNGE'}
        </Button>
      )}
      <Button variant="ghost" onClick={() => void Promise.all([loadFloor(), loadRooms()])}>
        <IconSync s={13} /> REFRESH FLOOR
      </Button>
      <Button variant="ghost" onClick={() => setStageFullscreen((current) => !current)} disabled={!selectedProjectRoom}>
        <IconScreen s={13} /> {stageModeLabel}
      </Button>
    </div>
  }
/>
```

**Step 2: Replace the two separate floor/stage panels with one ambient-floor panel**

Replace sections `§01 · TODAY'S FLOOR` and `§02 · PROJECT STAGE` with:

```tsx
<InstrumentPanel
  label="01 · ambient floor"
  title="Social floor viewport"
  note={`${floorSubtitle} · selection is focus-only until drop-in`}
  actions={(
    <div className="px-coworking-metric-strip">
      <StatusChip tone={roomOptions.length ? 'accent' : 'idle'}>{roomOptions.length} ROOMS</StatusChip>
      <StatusChip tone={onlineCount ? 'mint' : 'idle'}>{onlineCount} LIVE</StatusChip>
      <StatusChip tone={screenWall.tiles.length ? 'accent' : 'idle'}>{screenWall.tiles.length} SHARING</StatusChip>
    </div>
  )}
  className="px-coworking-section px-coworking-ambient-section"
  trace
>
  {floorError && <DegradedStatePanel title="Floor offline" message={floorError} tone="error" />}
  {roomsError && <DegradedStatePanel title="Rooms offline" message={roomsError} tone="error" />}

  {(floorLoading || roomsLoading) && !roomOptions.length && !roomsError && (
    <Skeleton lines={4} widths={['80%', '65%', '90%', '72%']} />
  )}

  {!roomsLoading && !roomOptions.length && !roomsError && (
    <EmptyStatePanel
      icon={<IconCloud s={24} />}
      title="No project zones available"
      message="Workspace rooms appear once project room state is available."
    />
  )}

  {roomOptions.length > 0 && selectedProjectRoom && (
    <AmbientFloorStage
      zone={focusedZone}
      wall={screenWall}
      ambientFloorZones={ambientFloorZones}
      roomDetailError={roomDetailError}
      fullscreen={stageFullscreen}
      activeJoin={activeProjectJoin}
      pending={(busy === 'drop_in' || busy === 'room_leave') && roomActionTargetId === selectedProjectRoom.id}
      micActive={micActive}
      cameraActive={cameraActive}
      screenActive={screenActive}
      onSelectZone={setSelectedRoomId}
      onDropIn={dropInToRoom}
      onLeave={leaveProjectRoom}
      onCloseout={openCloseout}
      onPin={setPinnedTrackId}
      onToggleFullscreen={() => setStageFullscreen((current) => !current)}
    />
  )}
</InstrumentPanel>
```

**Step 3: Keep the lounge section, but change its copy**

In the lounge `InstrumentPanel`, update:

```tsx
title="Persistent lounge layer"
note={`${loungeStrapline} · ambient · unrecorded · project voice takes priority`}
```

In the active signal chips, ensure these exact labels remain:

```tsx
<span className="px-lounge-live-chip muted">UNRECORDED</span>
<span className="px-lounge-live-chip muted">NO HIDDEN CAPTURE</span>
```

**Step 4: Run source test**

Run:

```bash
npm run test:coworking -- coworking-room-stage-ui
```

Expected: PASS.

**Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/renderer/components/CoWorkingPanel.tsx test/coworking/coworking-room-stage-ui.test.ts
git commit -m "feat: render coworking ambient floor stage"
```

---

## Task 7: Implement V3 Ambient Floor CSS

**Files:**
- Modify: `src/renderer/theme.css:1197-1346`

**Step 1: Replace/extend the co-working block**

Keep reusable avatar/lounge classes where still used, but add the V3 classes below `.px-coworking-info`:

```css
.px-coworking-command-dock{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.px-coworking-metric-strip{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}
.px-coworking-ambient-section .pxds-panel-body{min-height:clamp(34rem,58vh,45rem)}
.px-ambient-floor{position:relative;isolation:isolate;min-height:clamp(34rem,58vh,45rem);border:1px solid var(--line-2);background:
  radial-gradient(70% 80% at 48% 50%,rgba(224,255,79,.08),transparent 66%),
  radial-gradient(44% 58% at 78% 18%,rgba(35,22,81,.22),transparent 68%),
  linear-gradient(180deg,rgba(1,47,52,.42),rgba(0,20,23,.74));overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr);gap:14px;padding:14px}
.px-ambient-floor.stage-mode{position:fixed;inset:18px;z-index:30;min-height:0;background:
  radial-gradient(80% 72% at 50% 52%,rgba(224,255,79,.10),transparent 70%),
  var(--bg-0)}
.px-ambient-field{position:absolute;inset:0;z-index:-1;opacity:.92;background-image:
  linear-gradient(rgba(214,255,246,.045) 1px,transparent 1px),
  linear-gradient(90deg,rgba(214,255,246,.045) 1px,transparent 1px),
  radial-gradient(circle at 22% 28%,rgba(110,91,176,.18),transparent 17rem),
  radial-gradient(circle at 68% 58%,rgba(224,255,79,.08),transparent 18rem);
  background-size:44px 44px,44px 44px,100% 100%,100% 100%}
.px-ambient-floor-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:start;min-width:0}
.px-ambient-floor-head h3{margin-top:5px;font-size:22px;line-height:1.05;color:var(--mint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-ambient-floor-head p{margin-top:7px;font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--t3)}
.px-ambient-floor-grid{display:grid;grid-template-columns:minmax(12rem,.30fr) minmax(0,1fr) minmax(12rem,.28fr);gap:14px;min-height:0;overflow:hidden}
.px-ambient-zone-map{position:relative;min-height:0;border:1px solid var(--line);background:rgba(0,20,23,.30);padding:12px;overflow:hidden}
.px-ambient-zone-node{position:relative;z-index:2;width:100%;min-width:0;margin-bottom:10px;border:1px solid var(--line);background:rgba(0,20,23,.52);color:var(--t1);padding:10px;text-align:left;display:grid;gap:5px;cursor:pointer;transition:transform var(--dur) var(--ease),border-color var(--dur) var(--ease),background var(--dur) var(--ease)}
.px-ambient-zone-node:hover:not(:disabled){transform:translateY(-1px);border-color:var(--line-hot);background:var(--accent-dim)}
.px-ambient-zone-node.selected{border-color:var(--line-hot);box-shadow:var(--glow-accent)}
.px-ambient-zone-node:disabled{cursor:default;opacity:.7}
.px-ambient-zone-node strong{font-size:12px;color:var(--mint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-ambient-zone-node small{font-family:var(--font-mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-ambient-node-kicker{font-family:var(--font-mono);font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
.px-ambient-zone-node.state-empty .px-ambient-node-kicker,
.px-ambient-zone-node.state-more .px-ambient-node-kicker{color:var(--t4)}
.px-ambient-trace{position:absolute;left:50%;width:1px;background:linear-gradient(180deg,transparent,var(--line-hot),transparent);opacity:.38;transform-origin:top}
.px-ambient-trace.trace-a{top:12%;height:42%;transform:rotate(31deg)}
.px-ambient-trace.trace-b{top:30%;height:48%;transform:rotate(-24deg)}
.px-ambient-trace.trace-c{top:52%;height:34%;transform:rotate(15deg)}
.px-project-command-island{position:relative;min-width:0;min-height:0;border:1px solid var(--line-hot);background:linear-gradient(180deg,rgba(1,47,52,.72),rgba(0,20,23,.70));box-shadow:var(--glow-accent);display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:12px;padding:14px;overflow:hidden}
.px-project-command-island::before,
.px-project-command-island::after{content:"";position:absolute;width:16px;height:16px;border-color:var(--line-hot);border-style:solid;pointer-events:none}
.px-project-command-island::before{left:8px;top:8px;border-width:1px 0 0 1px}
.px-project-command-island::after{right:8px;bottom:8px;border-width:0 1px 1px 0}
.px-project-command-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;min-width:0}
.px-project-command-head strong{display:block;margin-top:5px;color:var(--mint);font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-project-command-head small{display:block;margin-top:6px;font-family:var(--font-mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);overflow-wrap:anywhere}
.px-project-command-states{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;max-width:22rem}
.px-project-command-body{display:grid;grid-template-rows:minmax(0,1fr) auto;gap:12px;min-height:0;overflow:hidden}
.px-ambient-screen-empty{position:relative;min-height:18rem;border:1px solid var(--line);background:
  linear-gradient(rgba(214,255,246,.04) 1px,transparent 1px),
  linear-gradient(90deg,rgba(214,255,246,.04) 1px,transparent 1px),
  radial-gradient(70% 70% at 50% 48%,rgba(224,255,79,.10),rgba(0,20,23,.30) 62%);
  background-size:34px 34px,34px 34px,100% 100%;display:grid;place-items:center;overflow:hidden}
.px-ambient-screen-slots{position:absolute;inset:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.px-ambient-screen-slots span{border:1px dashed var(--line);display:grid;place-items:center;font-family:var(--font-mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--t4);padding:10px;text-align:center}
.px-ambient-screen-ready{position:relative;z-index:2;display:grid;place-items:center;text-align:center;gap:8px;color:var(--t3);max-width:28rem;padding:24px;background:rgba(0,20,23,.64);border:1px solid var(--line-2)}
.px-ambient-screen-ready svg{color:var(--accent)}
.px-ambient-screen-ready strong{font-size:15px;color:var(--mint)}
.px-ambient-screen-ready span{font-size:12px;line-height:1.55}
.px-ambient-screen-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:10px;min-height:0;overflow:auto}
.px-ambient-screen-grid.pinned{grid-template-columns:1fr}
.px-ambient-screen-tile{appearance:none;border:1px solid var(--line);background:rgba(0,20,23,.38);color:var(--t1);padding:0;display:grid;grid-template-rows:minmax(9rem,1fr) auto;text-align:left;min-height:14rem;cursor:pointer;overflow:hidden}
.px-ambient-screen-tile.pinned{border-color:var(--line-hot);box-shadow:var(--glow-accent)}
.px-ambient-screen-preview{display:grid;place-items:center;background:radial-gradient(70% 70% at 50% 50%,rgba(224,255,79,.14),rgba(214,255,246,.035) 44%,rgba(0,20,23,.42));color:var(--accent)}
.px-ambient-screen-meta{display:grid;gap:4px;padding:10px;border-top:1px solid var(--line)}
.px-ambient-screen-meta strong{font-size:12px;color:var(--mint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-ambient-screen-meta small{font-family:var(--font-mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--t3)}
.px-project-participant-orbit{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:center;border:1px solid var(--line);background:rgba(0,20,23,.34);padding:9px;max-width:22rem}
.px-project-participant-orbit strong{display:block;color:var(--mint);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-project-participant-orbit small{display:block;font-family:var(--font-mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--t3)}
.px-stage-mode-note{font-family:var(--font-mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--t3);border-top:1px solid var(--line);padding-top:10px}
.px-room-instruments{min-height:0;border:1px solid var(--line);background:rgba(0,20,23,.36);padding:12px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px;overflow:hidden}
.px-room-instruments-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.px-room-instrument-rails{display:grid;gap:8px;align-content:start;overflow:auto;min-height:0}
.px-room-instrument-rail{border:1px solid var(--line);background:rgba(214,255,246,.025);padding:9px;display:grid;gap:4px;min-width:0}
.px-room-instrument-rail span{font-family:var(--font-mono);font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--t3)}
.px-room-instrument-rail strong{font-size:12px;color:var(--mint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-room-instrument-rail small{font-family:var(--font-mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);overflow-wrap:anywhere}
```

**Step 2: Add responsive behavior**

Add below the V3 block:

```css
@media (max-width: 1180px){
  .px-ambient-floor-grid{grid-template-columns:1fr}
  .px-ambient-zone-map{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:8px}
  .px-ambient-zone-node{margin-bottom:0}
  .px-ambient-trace{display:none}
  .px-room-instruments{max-height:none}
  .px-project-command-head{grid-template-columns:1fr}
  .px-project-command-states{justify-content:flex-start;max-width:none}
}

@media (max-width: 980px){
  .px-ambient-floor.stage-mode{inset:8px}
  .px-ambient-floor-head{grid-template-columns:1fr}
  .px-room-stage-actions{justify-content:flex-start}
  .px-ambient-screen-slots{grid-template-columns:1fr}
}
```

**Step 3: Run CSS/source checks**

Run:

```bash
npm run test:coworking -- coworking-room-stage-ui
npm run lint
npm run typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/renderer/theme.css
git commit -m "style: add coworking ambient floor stage"
```

---

## Task 8: Tighten Lounge Strip Copy and Privacy Signals

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx:1253-1420`
- Modify: `src/renderer/theme.css:1298-1346`

**Step 1: Update lounge active strip labels**

In the lounge active signal row, replace:

```tsx
<span className="px-lounge-live-chip"><IconCheck s={10} /> AUDIT</span>
<span className="px-lounge-live-chip muted">NO REC</span>
<span className="px-lounge-live-chip muted">NO TRANSCRIPT</span>
```

with:

```tsx
<span className="px-lounge-live-chip"><IconCheck s={10} /> AMBIENT</span>
<span className="px-lounge-live-chip muted">UNRECORDED</span>
<span className="px-lounge-live-chip muted">NO HIDDEN CAPTURE</span>
```

**Step 2: Update idle lounge copy**

Replace:

```tsx
<span className="px-lbl">drop in for ambient co-presence — open mic, no agenda.</span>
```

with:

```tsx
<span className="px-lbl">ambient · unrecorded · project voice takes priority.</span>
```

**Step 3: Keep controls unchanged**

Do not change `toggleMic`, `toggleCamera`, `toggleScreen`, `captionsOn`, `openCloseout`, or `leaveLounge` behavior in this task.

**Step 4: Run focused tests**

Run:

```bash
npm run test:coworking -- coworking-room-stage-ui
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/CoWorkingPanel.tsx src/renderer/theme.css
git commit -m "fix: clarify coworking lounge privacy signals"
```

---

## Task 9: Run Full Verification Gates

**Files:**
- No source changes expected.

**Step 1: Run coworking tests**

Run:

```bash
npm run test:coworking
```

Expected: PASS.

**Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

**Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

**Step 4: Run renderer build**

Run:

```bash
npm run build:renderer
```

Expected: PASS.

**Step 5: Commit if verification required small fixes**

Only if fixes were necessary:

```bash
git add <fixed-files>
git commit -m "fix: stabilize coworking ambient floor verification"
```

---

## Task 10: Manual Visual Approval Pass

**Files:**
- No source changes expected unless visual issues are found.

**Step 1: Start dev app**

Run:

```bash
npm run dev
```

Expected: Electron opens on localhost Vite renderer.

**Step 2: Visit Co-working**

Manual check:

- Left nav highlights Co-working.
- Page header reads `Co-working`.
- Subtitle reads `ambient floor · focus-only project zones · screen wall`.
- The primary visible surface is `01 · ambient floor`, not `today's floor` plus a room list.
- The selected project appears as a command island.
- Project zones appear as spatial nodes, not a full directory.
- Room instruments rail appears on the right.
- Empty screen wall state reads `Screen wall ready`.
- Stage mode/fullscreen keeps Drop in, Stage mode, and Paperclip controls visible.
- Lounge strip reads `ambient · unrecorded · project voice takes priority`.
- Native screen picker still opens only after pressing the screen share control.

**Step 3: Capture evidence**

Save a screenshot outside the repo, for example:

```bash
mkdir -p ~/.copilot/session-state/7466effd-bea3-44f2-993d-b81f2a277a27/files/coworking-ui
```

Use the OS screenshot tool and save:

```text
~/.copilot/session-state/7466effd-bea3-44f2-993d-b81f2a277a27/files/coworking-ui/coworking-v3-implemented-smoke.png
```

**Step 4: Stop dev app cleanly**

Stop the dev process with `Ctrl-C` in its terminal.

**Step 5: Commit only if visual polish fixes were made**

```bash
git add src/renderer/components/CoWorkingPanel.tsx src/renderer/theme.css
git commit -m "fix: polish coworking ambient floor visual pass"
```

---

## Success Criteria

- `npm run test:coworking` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build:renderer` passes.
- Co-working no longer looks like the old room-list/admin console.
- The visible UI follows `docs/design/` FORMA rules: hard edges, hairlines, chartreuse/mint, crosshair/instrument styling, no generic SaaS cards.
- The ambient floor is primary; project rooms are focused zones inside it.
- Project selection remains focus-only until Drop in.
- Drop in remains explicit and presence-only first.
- Screen sharing still uses the native picker via `navigator.mediaDevices.getDisplayMedia`.
- Lounge strip stays visible and clearly unrecorded.
- Stage mode keeps controls visible inside fullscreen.

## Non-Goals

- No version bump in this implementation plan.
- No OTA release/tag workflow in this implementation plan.
- No new realtime media transport.
- No recording backend implementation.
- No database migrations.
- No standalone R2 bucket.
- No new npm dependencies.
- No full rewrite of `RealtimeSession`.
- No image-generation assets committed to the repo.

