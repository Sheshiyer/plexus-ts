# Ambient Floor Reframe Product Contract

**Status:** Contract freeze  
**Area:** Product and interaction model  
**Scope:** Plexus Co-working / Realtime Workspace reframe  
**Source context:** `docs/design/screen-references/co-working.prompt.txt` and `docs/REALTIME_WORKSPACE_CONTRACT.md`

## Purpose

Ambient Floor Reframe turns the existing co-working surface into one real digital co-working space: a persistent ambient floor with visible presence, focused project zones, shared screens, and explicit media controls. It should feel closer to a calm Gather-style workplace than a meeting scheduler, but it must not become a WASD/avatar-walking simulation.

The product center is not a list of projects. The center is the shared floor. A selected project room becomes the focused zone inside that floor, with a separate user decision to join.

## Contract Decisions

1. **Hybrid primary unit:** Plexus presents one ambient floor as the primary unit, with a selected project room as the focused zone inside it.
2. **Focus-only project selection:** Choosing a project from navigation or a selector is focus-only. It visually focuses the project zone, but it does not join the user to that room.
3. **Separate Join action:** Project room presence requires an explicit Join action after selection. Dropdown selection, card selection, or search selection must not auto-join.
4. **lounge-as-layer:** The lounge is both a visible default floor zone and a persistent mini-control strip when the user enters focused project zones. The lounge layer must not imply hidden double-presence, hidden capture, or lounge audio leakage.
5. **Hybrid screen wall:** The default screen sharing layout is a screen wall that can show multiple active shares. Clicking any share pins it as the main focus while the remaining shares stay available.
6. **Explicit project-zone recording:** Recording is explicit recording for focused project zones only. The lounge remains unrecorded unless it is explicitly converted into a named project/session with consent, visible recording state, manifest association, and capture scope before capture starts.
7. **project vault storage:** Recordings use the associated R2 projects Thoughtseed vault already present as the project vault, not a standalone bucket.
8. **Presence-only join and audio priority:** Users enter presence-only first, then opt into mic, camera, or screen. A user can stay ambiently in the lounge while focused in a project zone, but project voice and screen take priority while the project zone is active.

## Recording Artifact Contract

Recording is a focused project-zone action, not a floor default. Starting a recording must make the destination, project association, capture scope, and visible recording state clear before any capture begins.

The recording artifact is manifest-first in the project vault:

- A manifest records project ID, room/session ID, zone type, participants, explicit consent state, capture scope, start/end timestamps, source track references, and retention metadata.
- Raw tracks are stored separately so audio, camera, and screen tracks can be retained, processed, or discarded independently.
- Composed playback is optional and derived from the manifest plus raw tracks. It is not the canonical record.
- Lounge presence, ambient lounge audio, and passive floor activity are not recorded unless the lounge is explicitly converted into a named project/session with consent, visible recording state, manifest association, and capture scope before capture starts.
- It must remain impossible to silently record ambient lounge activity.

## Interaction Model

### Floor

The floor is the durable co-working surface. It shows who is present, which project zones are active, which screens are being shared, and whether the lounge is active. It must avoid becoming an all-project directory.

Required behavior:

- Show the current floor state and a small set of relevant active project zones.
- Keep the lounge visible as the default ambient place.
- Preserve presence if media negotiation fails.
- Make project focus visually legible without implying room membership.

### Project Zones

Project zones are focused work areas inside the ambient floor.

Required behavior:

- Selecting a project highlights the zone in focus-only state.
- Joining a project zone is a separate command with visible state change.
- Joining starts presence-only state first.
- Mic, camera, and screen are opt-in controls after presence is established.
- Project voice and screen priority override lounge audio when the user is focused in a project zone.

### Lounge

The lounge remains the low-friction ambient layer.

Required behavior:

- It appears as a visible default floor zone.
- It continues as a mini-control strip while a project zone is focused or joined.
- It supports ambient presence without implying project participation.
- It must not imply hidden double-presence, hidden capture, or background lounge publishing while the user is active in a project zone.
- Lounge audio must not leak into a project zone. Project voice and screen priority applies while the project zone is active.
- It is unrecorded by default.

### Screens

Screen sharing is a first-class co-working behavior, not an edge case.

Required behavior:

- The default layout is a hybrid screen wall.
- Every shared screen identifies its publisher.
- Clicking a share pins it as the main focus.
- Pinning does not stop other shares.
- Multiple screen shares remain visible or reachable at the minimum supported app size.

## Non-Goals

- No all-project list on the floor.
- No auto-join from dropdown selection, project search, room cards, or focus changes.
- No automatic recording.
- No standalone R2 bucket for Ambient Floor recordings.
- No WASD/avatar-walking simulation.
- No hidden transcription, hidden Paperclip write, or hidden time-entry creation from presence.
- No hidden capture from lounge-as-layer, lounge mini-controls, or ambient lounge presence.
- No assumption that screen sharing, camera, or microphone starts from presence alone.

## Acceptance Checklist

- The ambient floor is the primary unit, and project rooms are focused zones within it.
- Project selection is focus-only until an explicit Join action.
- Join begins presence-only before mic, camera, or screen opt-in.
- The lounge exists both as a visible default zone and as a persistent mini-control layer.
- The lounge layer does not create hidden double-presence, hidden capture, or lounge audio leakage.
- The screen sharing default is a screen wall with click-to-pin focus.
- Recording is explicit recording for focused project zones only.
- Lounge recording is possible only after explicit conversion into a named project/session with consent, visible recording state, manifest association, and capture scope before capture starts.
- Recording artifacts are manifest-first with separate raw tracks and optional composed playback.
- Recording storage is the existing project vault, not a standalone bucket.
- The recording manifest includes zone type and capture scope.
- No hidden Paperclip, transcription, time-entry, or lounge capture side effects exist.
