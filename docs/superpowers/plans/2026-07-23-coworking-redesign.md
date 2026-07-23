# Co-working Studio Floor Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Studio Floor legible: one persistent Meet-style media dock for any live join, a compact lounge strip, universal Join/Leave verbs, a single connection chip, and a quiet-floor state — then decompose `CoWorkingPanel.tsx`.

**Architecture:** A new pure `dock-model.ts` derives the dock's render state from existing join/busy/media state. A presentational `MediaDock` renders whenever a join owns the shared `RealtimeSession` (`hasSession`). The Ambient Lounge section collapses to a `LoungeStrip`; its media controls and device pickers move into the dock. Degraded worker states collapse into one telemetry-bar chip. Finally, the panel splits into focused components plus a `useRealtimeMedia` hook.

**Tech Stack:** React 18 + TypeScript (Electron renderer), vitest node env (pure-logic + source-assertion tests; no React render testing).

**Spec:** `docs/superpowers/specs/2026-07-23-coworking-redesign-design.md`

## Global Constraints

- IPC surface unchanged (`realtimeJoinRoom`, `realtimeLeaveCall`, `coworkingFloor`, `coworkingLounge`, `realtimeRooms`).
- Transport readiness is runtime-derived: `activeJoin.joined.cloudflare.configured`, behind the `PROJECT_MEDIA_WIRING_ENABLED` kill switch (already `true` in `CoWorkingPanel.tsx`).
- Only ONE red/destructive action on the floor: the dock's **Leave**.
- Verbs: **Join** / **Leave** ("Drop in" survives only as subtitle flavor). Place nouns (bench, floor, lounge) unchanged.
- Design language: hard corners, 1px hairlines, existing `px-*` CSS variables — no new dependencies, no rounded cards.
- Tests: `test/coworking/*.test.ts`; run `npx vitest run`; type-check `npx tsc --noEmit -p .`.
- Existing pure-logic modules (`coworkingModel.ts`, `focused-zone.ts`, `screen-wall-model.ts`) must not change behavior.

---

### Task 1: `dock-model.ts` — deriveDockState

**Files:**
- Create: `src/renderer/lib/dock-model.ts`
- Test: `test/coworking/dock-model.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks. Input shapes mirror `CoWorkingPanel.tsx`'s `ActiveJoin` (`{ scope: 'lounge' | 'project_room'; roomId: string; roomName: string; joined: RealtimeJoinResponse; hasSession: boolean }`).
- Produces (Task 2 renders this):

```ts
export interface DockJoinInput {
  scope: 'lounge' | 'project_room';
  roomId: string;
  roomName: string;
  hasSession: boolean;
  cloudflareConfigured: boolean;
  participantCount: number;
  joinedAt: string; // ISO — caller stamps at join time
}
export interface DockState {
  visible: boolean;
  contextLabel: string;        // "Ambient Lounge" | room name
  scope: 'lounge' | 'project_room' | null;
  transportReady: boolean;     // cloudflareConfigured && wiringEnabled
  micDisabled: boolean;        // busy-gated
  cameraDisabled: boolean;
  screenDisabled: boolean;
  participantCount: number;
  joinedAt: string | null;
}
export function deriveDockState(input: {
  joins: DockJoinInput[];
  busy: string | null;
  wiringEnabled: boolean;
}): DockState;
```

- [ ] **Step 1: Write the failing test**

```ts
// test/coworking/dock-model.test.ts
import { describe, expect, it } from 'vitest';
import { deriveDockState, type DockJoinInput } from '../../src/renderer/lib/dock-model';

const loungeJoin = (over: Partial<DockJoinInput> = {}): DockJoinInput => ({
  scope: 'lounge', roomId: 'r-lounge', roomName: 'Ambient Lounge',
  hasSession: true, cloudflareConfigured: true, participantCount: 2,
  joinedAt: '2026-07-23T09:00:00.000Z', ...over,
});
const roomJoin = (over: Partial<DockJoinInput> = {}): DockJoinInput => ({
  scope: 'project_room', roomId: 'r-hz', roomName: 'HeyZack Landing',
  hasSession: true, cloudflareConfigured: false, participantCount: 3,
  joinedAt: '2026-07-23T09:05:00.000Z', ...over,
});

describe('deriveDockState', () => {
  it('is hidden when no join owns a session', () => {
    const state = deriveDockState({ joins: [roomJoin({ hasSession: false })], busy: null, wiringEnabled: true });
    expect(state.visible).toBe(false);
    expect(state.scope).toBeNull();
  });

  it('shows lounge context with transport ready', () => {
    const state = deriveDockState({ joins: [loungeJoin()], busy: null, wiringEnabled: true });
    expect(state).toMatchObject({
      visible: true, scope: 'lounge', contextLabel: 'Ambient Lounge',
      transportReady: true, participantCount: 2, joinedAt: '2026-07-23T09:00:00.000Z',
    });
    expect(state.micDisabled).toBe(false);
  });

  it('shows a project room with transport NOT ready when cloudflare is unconfigured', () => {
    const state = deriveDockState({ joins: [roomJoin()], busy: null, wiringEnabled: true });
    expect(state.visible).toBe(true);
    expect(state.contextLabel).toBe('HeyZack Landing');
    expect(state.transportReady).toBe(false);
  });

  it('kill switch forces transport not ready', () => {
    const state = deriveDockState({ joins: [loungeJoin()], busy: null, wiringEnabled: false });
    expect(state.transportReady).toBe(false);
  });

  it('busy keys disable only the matching control', () => {
    const state = deriveDockState({ joins: [loungeJoin()], busy: 'camera', wiringEnabled: true });
    expect(state.micDisabled).toBe(false);
    expect(state.cameraDisabled).toBe(true);
    expect(state.screenDisabled).toBe(false);
  });

  it('picks the session-owning join when multiple entries exist', () => {
    const state = deriveDockState({
      joins: [roomJoin({ hasSession: false }), loungeJoin()],
      busy: null, wiringEnabled: true,
    });
    expect(state.scope).toBe('lounge');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/coworking/dock-model.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// src/renderer/lib/dock-model.ts

export interface DockJoinInput {
  scope: 'lounge' | 'project_room';
  roomId: string;
  roomName: string;
  hasSession: boolean;
  cloudflareConfigured: boolean;
  participantCount: number;
  joinedAt: string;
}

export interface DockState {
  visible: boolean;
  contextLabel: string;
  scope: 'lounge' | 'project_room' | null;
  transportReady: boolean;
  micDisabled: boolean;
  cameraDisabled: boolean;
  screenDisabled: boolean;
  participantCount: number;
  joinedAt: string | null;
}

const HIDDEN: DockState = {
  visible: false, contextLabel: '', scope: null, transportReady: false,
  micDisabled: true, cameraDisabled: true, screenDisabled: true,
  participantCount: 0, joinedAt: null,
};

/**
 * One media-capable join exists at a time (lounge XOR one project room —
 * enforced by leaveOtherActiveJoins). The dock renders for whichever join
 * owns the shared RealtimeSession.
 */
export function deriveDockState(input: {
  joins: DockJoinInput[];
  busy: string | null;
  wiringEnabled: boolean;
}): DockState {
  const active = input.joins.find((join) => join.hasSession) ?? null;
  if (!active) return HIDDEN;
  return {
    visible: true,
    contextLabel: active.roomName,
    scope: active.scope,
    transportReady: input.wiringEnabled && active.cloudflareConfigured,
    micDisabled: input.busy === 'mic',
    cameraDisabled: input.busy === 'camera',
    screenDisabled: input.busy === 'screen',
    participantCount: active.participantCount,
    joinedAt: active.joinedAt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/coworking/dock-model.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/lib/dock-model.ts test/coworking/dock-model.test.ts
git commit -m "feat(coworking): pure dock-state derivation"
```

---

### Task 2: `MediaDock` component

**Files:**
- Create: `src/renderer/components/coworking/MediaDock.tsx`
- Modify: `src/renderer/theme.css` (append)
- Test: `test/coworking/media-dock.test.ts`

**Interfaces:**
- Consumes: `DockState` (Task 1).
- Produces (Task 3 renders it):

```ts
export interface MediaDockProps {
  dock: DockState;
  micActive: boolean;
  cameraActive: boolean;
  screenActive: boolean;
  participants: { id: string; initials: string }[];
  deviceControls: React.ReactNode;      // gear popover body (device selects, passed in)
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onCloseout: () => void;
  onLeave: () => void;
  leaving: boolean;
  message: string | null;               // inline dock error/info line
}
```

- [ ] **Step 1: Write the failing source-assertion test**

```ts
// test/coworking/media-dock.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('MediaDock', () => {
  const dock = () => source('src/renderer/components/coworking/MediaDock.tsx');

  it('renders nothing unless the dock state is visible', () => {
    expect(dock()).toContain('if (!dock.visible) return null;');
  });

  it('has mic, camera, screen toggles gated on transport readiness', () => {
    expect(dock()).toContain('onClick={onToggleMic}');
    expect(dock()).toContain('onClick={onToggleCamera}');
    expect(dock()).toContain('onClick={onToggleScreen}');
    expect(dock()).toContain('!dock.transportReady');
    expect(dock()).toContain('Realtime media transport is not configured');
  });

  it('has the only red Leave action plus closeout and live indicator', () => {
    expect(dock()).toContain("variant=\"stop\"");
    expect(dock()).toContain('onClick={onLeave}');
    expect(dock()).toContain('onClick={onCloseout}');
    expect(dock()).toContain('px-dock-live');
    expect(dock()).toContain('aria-pressed={micActive}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/coworking/media-dock.test.ts`
Expected: FAIL — ENOENT

- [ ] **Step 3: Implement**

```tsx
// src/renderer/components/coworking/MediaDock.tsx
import React, { useEffect, useState } from 'react';
import { Button } from '../ui';
import { IconCamera, IconClose, IconMic, IconPaperclip, IconScreen, IconSettings } from '../Icons';
import type { DockState } from '../../lib/dock-model';

const TRANSPORT_HINT = 'Realtime media transport is not configured for this workspace yet.';

function useElapsed(sinceIso: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!sinceIso) return '';
  const total = Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * The one place that answers "am I live, and where are my controls?" —
 * identical for lounge and project-room joins. Renders only while a join
 * owns the shared RealtimeSession.
 */
export default function MediaDock({
  dock, micActive, cameraActive, screenActive, participants, deviceControls,
  onToggleMic, onToggleCamera, onToggleScreen, onCloseout, onLeave, leaving, message,
}: {
  dock: DockState;
  micActive: boolean;
  cameraActive: boolean;
  screenActive: boolean;
  participants: { id: string; initials: string }[];
  deviceControls: React.ReactNode;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onCloseout: () => void;
  onLeave: () => void;
  leaving: boolean;
  message: string | null;
}) {
  const [devicesOpen, setDevicesOpen] = useState(false);
  const elapsed = useElapsed(dock.joinedAt);
  if (!dock.visible) return null;
  const mediaHint = !dock.transportReady ? TRANSPORT_HINT : undefined;
  return (
    <div className="px-media-dock" role="region" aria-label="Live session controls">
      <div className="px-dock-context">
        <span className="px-dock-live" aria-hidden="true" />
        <strong>{dock.contextLabel}</strong>
        <span className="px-dock-elapsed">{elapsed}</span>
      </div>

      <div className="px-dock-controls">
        <button
          type="button"
          className={`px-dock-ctl${micActive ? ' on' : ''}`}
          onClick={onToggleMic}
          disabled={!dock.transportReady || dock.micDisabled}
          title={mediaHint ?? (micActive ? 'Mute microphone' : 'Unmute microphone')}
          aria-pressed={micActive}
          aria-label="Microphone"
        >
          <IconMic s={15} />
        </button>
        <button
          type="button"
          className={`px-dock-ctl${cameraActive ? ' on' : ''}`}
          onClick={onToggleCamera}
          disabled={!dock.transportReady || dock.cameraDisabled}
          title={mediaHint ?? (cameraActive ? 'Turn camera off' : 'Turn camera on')}
          aria-pressed={cameraActive}
          aria-label="Camera"
        >
          <IconCamera s={15} />
        </button>
        <button
          type="button"
          className={`px-dock-ctl${screenActive ? ' on' : ''}`}
          onClick={onToggleScreen}
          disabled={!dock.transportReady || dock.screenDisabled}
          title={mediaHint ?? (screenActive ? 'Stop sharing screen' : 'Share screen')}
          aria-pressed={screenActive}
          aria-label="Screen share"
        >
          <IconScreen s={15} />
        </button>
        <div className="px-dock-devices">
          <button
            type="button"
            className="px-dock-ctl"
            onClick={() => setDevicesOpen((v) => !v)}
            aria-expanded={devicesOpen}
            aria-label="Device settings"
            title="Microphone, speaker & camera devices"
          >
            <IconSettings s={15} />
          </button>
          {devicesOpen && <div className="px-dock-devices-pop">{deviceControls}</div>}
        </div>
      </div>

      <div className="px-dock-right">
        {message && <span className="px-dock-msg">{message}</span>}
        <div className="px-dock-people" aria-label={`${dock.participantCount} participants`}>
          {participants.slice(0, 4).map((person) => (
            <span key={person.id} className="px-mini-avatar"><span className="px-mini-initials">{person.initials}</span></span>
          ))}
          {dock.participantCount > 4 && <span className="px-dock-more">+{dock.participantCount - 4}</span>}
        </div>
        <Button variant="ghost" onClick={onCloseout}><IconPaperclip s={12} /> Closeout</Button>
        <Button variant="stop" onClick={onLeave} disabled={leaving}>
          <IconClose s={12} /> {leaving ? 'Leaving' : 'Leave'}
        </Button>
      </div>
    </div>
  );
}
```

Note: check `src/renderer/components/Icons.tsx` for `IconSettings` — if absent, use the existing gear-like icon there (grep `IconGear\|IconSettings\|IconSliders`); import whichever exists.

- [ ] **Step 4: Append CSS**

```css
/* ── Media dock ──────────────────────────────────────────────── */
.px-media-dock{position:sticky;bottom:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 14px;background:var(--surface);border:1px solid var(--line);border-bottom:0}
.px-dock-context{display:flex;align-items:center;gap:8px;min-width:0}
.px-dock-context strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-dock-live{width:8px;height:8px;background:var(--accent);animation:px-pulse 2s infinite}
.px-dock-elapsed{font-family:var(--mono);font-size:11px;color:var(--t3)}
.px-dock-controls{display:flex;gap:6px;align-items:center}
.px-dock-ctl{width:38px;height:34px;display:inline-flex;align-items:center;justify-content:center;background:none;border:1px solid var(--line);color:inherit;cursor:pointer}
.px-dock-ctl.on{background:var(--accent);color:var(--bg)}
.px-dock-ctl:disabled{opacity:.4;cursor:default}
.px-dock-devices{position:relative}
.px-dock-devices-pop{position:absolute;bottom:40px;right:0;z-index:30;min-width:240px;background:var(--surface);border:1px solid var(--line);padding:10px;display:grid;gap:8px}
.px-dock-right{display:flex;align-items:center;gap:10px}
.px-dock-msg{font-size:11px;color:var(--t3);max-width:220px}
.px-dock-people{display:flex;gap:4px;align-items:center}
.px-dock-more{font-family:var(--mono);font-size:11px;color:var(--t3)}
```

(If `@keyframes px-pulse` doesn't exist in theme.css — grep first — add: `@keyframes px-pulse{0%,100%{opacity:1}50%{opacity:.35}}`.)

- [ ] **Step 5: Run test + type-check**

Run: `npx vitest run test/coworking/media-dock.test.ts && npx tsc --noEmit -p .`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/coworking/MediaDock.tsx src/renderer/theme.css test/coworking/media-dock.test.ts
git commit -m "feat(coworking): Meet-style media dock component"
```

---

### Task 3: Integrate the dock; simplify stage header; Join/Leave verbs

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/components/coworking/ProjectMediaControls.tsx` → the stage no longer hosts media buttons; DELETE this file and its render site (the dock owns media now)
- Test: modify `test/coworking/project-media-controls.test.ts` (rewrite), `test/coworking/coworking-room-stage-ui.test.ts` (update strings)

**Interfaces:**
- Consumes: `deriveDockState`/`DockJoinInput` (Task 1), `MediaDock` (Task 2), existing `activeJoinList`, `busy`, `micActive/cameraActive/screenActive`, `toggleMic/toggleCamera/toggleScreen`, `leaveActiveJoin`, `openCloseout`, `PROJECT_MEDIA_WIRING_ENABLED`.
- Produces: `ActiveJoin` gains `joinedAt: string`.

- [ ] **Step 1: Update the tests first**

Rewrite `test/coworking/project-media-controls.test.ts` as the dock-integration contract:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('media dock integration', () => {
  const panel = () => source('src/renderer/components/CoWorkingPanel.tsx');

  it('derives dock state from joins and renders MediaDock', () => {
    expect(panel()).toContain("from '../lib/dock-model'");
    expect(panel()).toContain('deriveDockState');
    expect(panel()).toContain('<MediaDock');
    expect(panel()).toContain('wiringEnabled: PROJECT_MEDIA_WIRING_ENABLED');
  });

  it('stamps joinedAt on active joins', () => {
    expect(panel()).toContain('joinedAt: new Date().toISOString()');
  });

  it('stage no longer hosts media buttons', () => {
    expect(panel()).not.toContain('ProjectMediaControls');
  });

  it('uses Join/Leave verbs on the stage', () => {
    expect(panel()).toMatch(/'Joining' : 'Join'/);
    expect(panel()).not.toContain("'Drop in'");
  });
});
```

In `test/coworking/coworking-room-stage-ui.test.ts`: run it, then update any assertions referencing `ProjectMediaControls`, `Drop in`, or `Leave room` to the new contract (Join verb on stage; Leave lives in the dock). Keep all other assertions.

Run: `npx vitest run test/coworking/` — Expected: the rewritten tests FAIL against current source.

- [ ] **Step 2: Add `joinedAt` to `ActiveJoin`**

In `CoWorkingPanel.tsx`, the `ActiveJoin` type (near line 150) gains `joinedAt: string;`. Every `addActiveJoin({...})` call site (`joinLounge`, `dropInToRoom`) adds `joinedAt: new Date().toISOString(),`.

- [ ] **Step 3: Derive dock state + render MediaDock**

After the `activeMediaEntry` derivation (near line 852), add:

```tsx
const dockState = useMemo(() => deriveDockState({
  joins: activeJoinList.map((entry) => ({
    scope: entry.scope === 'lounge' ? 'lounge' as const : 'project_room' as const,
    roomId: entry.roomId,
    roomName: entry.scope === 'lounge' ? 'Ambient Lounge' : entry.roomName,
    hasSession: entry.hasSession,
    cloudflareConfigured: Boolean(entry.joined.cloudflare.configured),
    participantCount: entry.joined.call?.participantCount ?? remoteStreams.length + 1,
    joinedAt: entry.joinedAt,
  })),
  busy,
  wiringEnabled: PROJECT_MEDIA_WIRING_ENABLED,
}), [activeJoinList, busy, remoteStreams.length]);
```

Check the actual `RealtimeJoinResponse` shape for a participant count (grep `participantCount` in `src/shared/types.ts`); if absent, use `remoteStreams.length + 1` only.

At the bottom of the panel's root JSX (after the closeout modal region, inside the outermost `<div>`), render:

```tsx
<MediaDock
  dock={dockState}
  micActive={micActive}
  cameraActive={cameraActive}
  screenActive={screenActive}
  participants={dockParticipants}
  deviceControls={deviceControlsNode}
  onToggleMic={toggleMic}
  onToggleCamera={toggleCamera}
  onToggleScreen={toggleScreen}
  onCloseout={() => { if (activeMediaEntry) openCloseout(activeMediaEntry); }}
  onLeave={() => { if (activeMediaEntry) void leaveActiveJoin(activeMediaEntry, {}); }}
  leaving={busy === 'lounge_leave' || busy === 'room_leave'}
  message={deviceError}
/>
```

`dockParticipants`: derive from the focused zone / lounge members already computed — a minimal version:

```tsx
const dockParticipants = useMemo(() => (
  activeMediaEntry?.scope === 'lounge'
    ? loungePresence.map((p) => ({ id: p.participantId, initials: p.initials }))
    : focusedZone.members.map((m) => ({ id: m.participantId, initials: m.initials }))
), [activeMediaEntry?.scope, loungePresence, focusedZone.members]);
```

(Grep the panel for the lounge presence list variable name — it derives from `floor` (`deriveLoungeLayer` output or similar); use the actual variable. If no initials field exists on it, compute `name.split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase()`.)

`deviceControlsNode`: JSX moved verbatim from the lounge section's device pickers (the three `<Select>`s for mic/speaker/camera + refresh button, currently around lines 1400-1440) wrapped in a fragment. Build it in Task 4 — for this task pass the existing JSX inline; Task 4 relocates it.

`leaveActiveJoin` signature: grep its options param (`{ refresh?: boolean; silent?: boolean }`) and call with `{}`.

- [ ] **Step 4: Simplify the stage header (`FocusedRoomStage`)**

In the stage actions block (near line 289-308):
- The Closeout button is removed (dock owns it).
- The join/leave button becomes Join-only; leaving happens in the dock. Replace with:

```tsx
{room && !activeJoin && (
  <Button variant="accent" onClick={() => onDropIn(room)} disabled={pending}>
    <IconUsers s={12} /> {pending ? 'Joining' : 'Join'}
  </Button>
)}
{room && activeJoin && (
  <span className="px-stage-joined-chip"><span className="px-dot pulse" /> Joined · controls in the dock below</span>
)}
```

Add CSS: `.px-stage-joined-chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--t3);font-family:var(--mono)}`

Subtitle flavor: the stage `<p>` line (near line 287) appends `· drop in — presence-only until you enable media` when not joined.

Remove the `ProjectMediaControls` import, its render site, and the `mediaTransportReady`/`micActive`/`cameraActive`/`screenActive`/`mediaBusy`/`onToggleMic`/`onToggleCamera`/`onToggleScreen` props from `FocusedRoomStage` (dock supersedes them). Delete `src/renderer/components/coworking/ProjectMediaControls.tsx`.

- [ ] **Step 5: Run tests + type-check**

Run: `npx vitest run test/coworking/ && npx tsc --noEmit -p .`
Expected: PASS (including rewritten contract tests)

- [ ] **Step 6: Commit**

```bash
git add -A src/renderer test/coworking
git commit -m "feat(coworking): integrate media dock, Join verb, slim stage header"
```

---

### Task 4: `LoungeStrip` — collapse the lounge section

**Files:**
- Create: `src/renderer/components/coworking/LoungeStrip.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx` (replace lounge section; move device pickers into dock's `deviceControls`)
- Modify: `src/renderer/theme.css`
- Test: `test/coworking/lounge-strip.test.ts`

**Interfaces:**
- Produces:

```ts
export interface LoungeStripProps {
  presentCount: number;
  presentInitials: string[];   // up to 4
  joined: boolean;
  busy: boolean;
  error: string | null;
  onJoin: () => void;
}
```

(The strip has NO leave button and NO media controls — the dock owns both once joined.)

- [ ] **Step 1: Write the failing test**

```ts
// test/coworking/lounge-strip.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('LoungeStrip', () => {
  it('is a compact strip: presence, unrecorded note, one Join action, no media controls', () => {
    const strip = source('src/renderer/components/coworking/LoungeStrip.tsx');
    expect(strip).toContain('unrecorded');
    expect(strip).toContain('onClick={onJoin}');
    expect(strip).not.toContain('IconMic');
    expect(strip).not.toContain('IconCamera');
    expect(strip).not.toContain('getUserMedia');
  });

  it('replaces the full lounge section in the panel', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).toContain('<LoungeStrip');
    expect(panel).not.toContain('px-lounge-controls');
  });
});
```

Run: `npx vitest run test/coworking/lounge-strip.test.ts` — Expected: FAIL

- [ ] **Step 2: Implement `LoungeStrip.tsx`**

```tsx
// src/renderer/components/coworking/LoungeStrip.tsx
import React from 'react';
import { Button } from '../ui';
import { IconUsers } from '../Icons';

/**
 * Compact ambient-lounge strip. Presence + one Join action. All media
 * controls live in the MediaDock once joined — nothing to manage here.
 */
export default function LoungeStrip({
  presentCount, presentInitials, joined, busy, error, onJoin,
}: {
  presentCount: number;
  presentInitials: string[];
  joined: boolean;
  busy: boolean;
  error: string | null;
  onJoin: () => void;
}) {
  return (
    <section className="px-lounge-strip" aria-label="Ambient lounge">
      <div className="px-lounge-strip-id">
        <span className="px-lbl">Ambient lounge</span>
        <span className="px-lounge-strip-note">{presentCount} in lounge · unrecorded</span>
      </div>
      <div className="px-lounge-strip-people">
        {presentInitials.slice(0, 4).map((initials, index) => (
          <span key={`${initials}-${index}`} className="px-mini-avatar"><span className="px-mini-initials">{initials}</span></span>
        ))}
      </div>
      <div className="px-lounge-strip-act">
        {error && <span className="px-lounge-strip-err">{error}</span>}
        {joined
          ? <span className="px-stage-joined-chip"><span className="px-dot pulse" /> In the lounge</span>
          : <Button variant="accent" onClick={onJoin} disabled={busy}><IconUsers s={12} /> {busy ? 'Joining' : 'Join lounge'}</Button>}
      </div>
    </section>
  );
}
```

CSS append:

```css
.px-lounge-strip{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 14px;border:1px solid var(--line);background:var(--surface)}
.px-lounge-strip-id{display:grid;gap:2px}
.px-lounge-strip-note{font-family:var(--mono);font-size:11px;color:var(--t3)}
.px-lounge-strip-people{display:flex;gap:4px}
.px-lounge-strip-act{display:flex;align-items:center;gap:10px}
.px-lounge-strip-err{font-size:11px;color:var(--error,#e05f6d)}
```

- [ ] **Step 3: Replace the lounge section in `CoWorkingPanel.tsx`**

- Move the device-picker JSX (mic/speaker/camera `<Select>`s + refresh, currently in the lounge section ~lines 1400-1440) into a `deviceControlsNode` variable (plain JSX fragment) defined above the return, and pass it to `<MediaDock deviceControls={deviceControlsNode} />` (replacing Task 3's inline placement).
- Delete the remaining full lounge section JSX (waveform, `px-lounge-controls` buttons incl. captions toggle, leave button — leaving is dock-owned; if captions state is referenced elsewhere keep the state but drop the button, else delete `captionsOn` entirely).
- Render `<LoungeStrip presentCount={...} presentInitials={...} joined={Boolean(activeLoungeJoin)} busy={busy === 'lounge_join'} error={loungeError} onJoin={joinLounge} />` where the section was. Presence values come from the same variables the old section used (grep `loungeLayer`/lounge member list in the panel and map to initials as in Task 3).
- `useLoungeWaveform` and `WAVEFORM_BARS` become unused → delete.
- Keep remote-audio playback elements (`AudioSinkElement` usage) — they are functional, not decorative; relocate them adjacent to the dock render if they lived inside the deleted section.

- [ ] **Step 4: Run all coworking tests + type-check**

Run: `npx vitest run test/coworking/ && npx tsc --noEmit -p .`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src/renderer test/coworking
git commit -m "feat(coworking): compact lounge strip; device pickers move to dock"
```

---

### Task 5: Connection chip + quiet floor

**Files:**
- Modify: `src/renderer/components/CoWorkingPanel.tsx`
- Modify: `src/renderer/theme.css`
- Test: `test/coworking/quiet-floor.test.ts`

**Interfaces:**
- Consumes: existing error states (`floorError`, `roomsError`, `loungeError`) and whatever sets them (worker-unreachable errors contain "Not connected" / "sign in with Cloudflare Access" — grep the exact strings the IPC layer produces before coding).

- [ ] **Step 1: Write the failing test**

```ts
// test/coworking/quiet-floor.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('quiet floor / connection chip', () => {
  const panel = () => source('src/renderer/components/CoWorkingPanel.tsx');

  it('derives a single offline flag from connection-type errors', () => {
    expect(panel()).toContain('const floorOffline');
    expect(panel()).toContain('isConnectionError');
  });

  it('shows one amber chip in the telemetry bar instead of per-section panels', () => {
    expect(panel()).toContain('px-floor-offline-chip');
    // Worker-offline no longer renders three DegradedStatePanels:
    const degradedCount = (panel().match(/DegradedStatePanel/g) ?? []).length;
    expect(degradedCount).toBeLessThanOrEqual(3); // import + non-connection uses only
  });

  it('keeps floor structure visible while offline (quiet floor)', () => {
    expect(panel()).toContain('px-floor-quiet');
    expect(panel()).toContain('Team benches appear when the floor connects');
  });
});
```

Run: `npx vitest run test/coworking/quiet-floor.test.ts` — Expected: FAIL

- [ ] **Step 2: Implement**

2a. Helper (top of `CoWorkingPanel.tsx`, module scope):

```ts
function isConnectionError(message: string | null): boolean {
  if (!message) return false;
  return /not connected|cloudflare access|sign in/i.test(message);
}
```

2b. Derivation near the other memos:

```tsx
const floorOffline = isConnectionError(floorError) || isConnectionError(roomsError) || isConnectionError(loungeError);
```

2c. Telemetry bar: inside the existing telemetry/header bar JSX add:

```tsx
{floorOffline && (
  <button type="button" className="px-floor-offline-chip" onClick={() => window.dispatchEvent(new CustomEvent('plexus:navigate', { detail: { tab: 'settings' } }))} title="Sign in with Cloudflare Access to bring the floor online">
    ● OFFLINE — Sign in with Cloudflare Access
  </button>
)}
```

First grep how other components navigate (e.g. `selectTab` prop or a custom event — `grep -rn "plexus:navigate\|onOpenSettings" src/renderer/components/CoWorkingPanel.tsx src/renderer/App.tsx`). If the panel has no navigation prop, add an optional `onOpenSettings?: () => void` prop threaded from `App.tsx` (`<CoWorkingPanel onOpenSettings={() => selectTab('settings')} />`) and call that instead of a custom event.

2d. Suppress duplicate panels: wherever `DegradedStatePanel` renders for `floorError`/`roomsError`/`loungeError`, skip when the message is a connection error:

```tsx
{floorError && !isConnectionError(floorError) && <DegradedStatePanel title="Floor offline" message={floorError} tone="error" />}
```

(same pattern for the rooms and lounge error panels).

2e. Quiet floor: on the floor container element add the class + placeholder:

```tsx
<section className={`px-studio-floor${floorOffline ? ' px-floor-quiet' : ''}`} ...>
```

In the bench rail, when `floorOffline || (!floorLoading && !floor.length)` render:

```tsx
<div className="px-bench-placeholder">
  {[0, 1, 2].map((i) => <div key={i} className="px-bench-ghost" />)}
  <p>{floorOffline ? 'Team benches appear when the floor connects.' : 'No one is on the floor yet.'}</p>
</div>
```

CSS append:

```css
.px-floor-offline-chip{border:1px solid var(--warning,#d9a441);color:var(--warning,#d9a441);background:none;font-family:var(--mono);font-size:11px;padding:4px 10px;cursor:pointer}
.px-floor-quiet .px-studio-bench-rail,.px-floor-quiet .px-lounge-strip{opacity:.55}
.px-bench-placeholder{display:grid;gap:8px;padding:12px}
.px-bench-placeholder p{font-size:12px;color:var(--t3)}
.px-bench-ghost{height:56px;border:1px dashed var(--line);opacity:.5}
```

(Adjust the two class names in `.px-floor-quiet ...` to the actual container classes — grep `px-studio-bench-rail` which exists per current source; keep selectors aligned with reality.)

- [ ] **Step 3: Run tests + type-check**

Run: `npx vitest run test/coworking/ && npx tsc --noEmit -p .`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A src/renderer test/coworking src/renderer/App.tsx
git commit -m "feat(coworking): single offline chip + quiet floor state"
```

---

### Task 6: Decompose CoWorkingPanel — `useRealtimeMedia` + component extractions

**Files:**
- Create: `src/renderer/lib/useRealtimeMedia.ts`
- Create: `src/renderer/components/coworking/FloorTelemetryBar.tsx`
- Create: `src/renderer/components/coworking/StudioStage.tsx`
- Create: `src/renderer/components/coworking/TeamBenchRail.tsx`
- Modify: `src/renderer/components/CoWorkingPanel.tsx` (shrinks to orchestrator)
- Test: `test/coworking/panel-decomposition.test.ts`

This is a **mechanical refactor** — no behavior change. Existing tests are the safety net; run `npx vitest run test/coworking/` after each extraction.

**Interfaces:**

```ts
// useRealtimeMedia.ts — sole owner of RealtimeSession
export function useRealtimeMedia(options: {
  loungeRoom: RealtimeRoom | null;
  clientInstanceId: React.MutableRefObject<string>;
  onRefresh: () => Promise<void>;   // reload rooms + floor after join/leave
}): {
  activeJoins: Record<string, ActiveJoin>;
  activeJoinList: ActiveJoin[];
  activeLoungeJoin: ActiveJoin | null;
  activeMediaEntry: ActiveJoin | null;
  micActive: boolean; cameraActive: boolean; screenActive: boolean;
  busy: CoWorkingBusyKey;
  remoteStreams: RemoteStreamEntry[];
  loungeError: string | null; roomsError: string | null;
  deviceError: string | null;
  micDevices/speakerDevices/cameraDevices + selected ids + setters (as currently named);
  joinLounge: () => Promise<void>;
  dropInToRoom: (room: RealtimeRoom) => Promise<void>;
  leaveProjectRoom: (room: RealtimeRoom) => Promise<void>;
  leaveActiveJoin: (entry: ActiveJoin, opts?: { refresh?: boolean; silent?: boolean }) => Promise<void>;
  toggleMic: () => Promise<void>; toggleCamera: () => Promise<void>; toggleScreen: () => Promise<void>;
  loadMediaDevices: () => Promise<void>;
}
```

Copy the type names exactly as they exist in `CoWorkingPanel.tsx` today (`ActiveJoin`, `CoWorkingBusyKey`, remote stream entry type) — move those type declarations into `useRealtimeMedia.ts` and export them; the panel imports them back.

- [ ] **Step 1: Write the decomposition contract test**

```ts
// test/coworking/panel-decomposition.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coworking decomposition', () => {
  it('useRealtimeMedia is the sole RealtimeSession owner', () => {
    const hook = source('src/renderer/lib/useRealtimeMedia.ts');
    expect(hook).toContain('new RealtimeSession(');
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).not.toContain('new RealtimeSession(');
    expect(panel).toContain('useRealtimeMedia(');
  });

  it('panel composes the extracted components', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).toContain('<FloorTelemetryBar');
    expect(panel).toContain('<StudioStage');
    expect(panel).toContain('<TeamBenchRail');
    expect(panel).toContain('<LoungeStrip');
    expect(panel).toContain('<MediaDock');
  });

  it('panel stays an orchestrator (< 700 lines)', () => {
    const lines = source('src/renderer/components/CoWorkingPanel.tsx').split('\n').length;
    expect(lines).toBeLessThan(700);
  });
});
```

Run: `npx vitest run test/coworking/panel-decomposition.test.ts` — Expected: FAIL

- [ ] **Step 2: Extract `useRealtimeMedia.ts`**

Move verbatim from `CoWorkingPanel.tsx` into the hook: `sessionRef`, `activeJoins` state + `activeJoinsRef`, `addActiveJoin`, `replaceActiveJoins`, `leaveActiveJoin`, `leaveOtherActiveJoins`, the unmount cleanup effect, `joinLounge`, `dropInToRoom`, `leaveProjectRoom`, `toggleMic/toggleCamera/toggleScreen`, `loadMediaDevices` + device state, `micActive/cameraActive/screenActive` + local track refs, `remoteStreams` + ref, `busy`, `loungeError`, `roomsError`, `deviceError`, `stopLocalTracks`, `clearRemoteStreams`, and derived `activeJoinList`/`activeLoungeJoin`/`activeMediaEntry`/`activeMediaScopeLabel`. Also move `newLocalId`, `sinkIdForDevice`, `SYSTEM_DEVICE_ID`, `AudioSinkElement`, `buildProjectRoomJoinRequest` if only used here. The `setInfo` calls inside join functions: expose `info: string | null` from the hook too.

The hook receives `loungeRoom`, `clientInstanceId`, and `onRefresh` (wrapping `loadRooms` + `loadFloor`) — everything else it owns.

Run after extraction: `npx tsc --noEmit -p . && npx vitest run test/coworking/` — must stay green.

- [ ] **Step 3: Extract `StudioStage.tsx`, `TeamBenchRail.tsx`, `FloorTelemetryBar.tsx`**

Move verbatim, one at a time, running `npx tsc --noEmit -p .` after each:
- `StudioStage.tsx` ← `FocusedRoomStage` + `ScreenWall` + their prop types (rename export to `StudioStage`, keep internal names).
- `TeamBenchRail.tsx` ← the `<aside className="px-studio-bench-rail">` JSX block + `TeamBench` component + bench placeholder from Task 5, with props: `{ floor, floorError, floorLoading, floorOffline, onlineCount, floorSubtitle, onActivate }` (exact prop names from the JSX being moved).
- `FloorTelemetryBar.tsx` ← the telemetry/header bar JSX incl. the offline chip, with the counts/handlers it references as props.

Import all three into the panel; the panel keeps: data loading (floor/rooms/lounge polling), selection state (`selectedRoomId`, `pinnedTrackId`, `stageFullscreen`), closeout modal state + handlers, derived memos (`focusedZone`, `screenWall`, `roomOptions`, `dockState`), and composition.

- [ ] **Step 4: Full verification**

Run: `npx vitest run && npx tsc --noEmit -p .`
Expected: entire suite green, no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/renderer test/coworking
git commit -m "refactor(coworking): decompose panel — useRealtimeMedia hook + focused components"
```

---

### Task 7: Final sweep + manual verification

**Files:**
- Modify: `test/coworking/coworking-room-stage-ui.test.ts` (final contract pass), docs touch-ups if stale

- [ ] **Step 1: Full suite + types**

Run: `npx vitest run && npx tsc --noEmit -p .`
Expected: all green.

- [ ] **Step 2: Stale-reference sweep**

Run: `grep -rn "ProjectMediaControls\|px-lounge-controls\|Drop in\|useLoungeWaveform" src/ test/`
Expected: no hits in `src/` (docs/design references may still mention them — fine).

- [ ] **Step 3: Manual smoke (dev build)**

1. Launch the app signed out → co-working tab shows ONE amber offline chip, quiet floor with ghost benches, no red panels.
2. Sign in → floor populates; stage shows **Join**; lounge strip shows **Join lounge**.
3. Join lounge → MediaDock appears at the bottom: live dot, elapsed timer, mic/cam/screen (disabled with the transport hint while SFU credentials are absent), device gear, Closeout, red Leave. Lounge strip shows "In the lounge".
4. Leave via dock → dock disappears.
5. Join a project room → same dock, room name as context. Stage header shows the joined chip.
6. Window narrow/Clio side chat open → no layout break (dock is sticky within the panel).

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore(coworking): final sweep for studio floor clarity redesign"
```
