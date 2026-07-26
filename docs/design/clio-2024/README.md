# Clio First Visual System

This direction treats Clio as a quiet operator: present, precise, and calm under load. The interface keeps Plexus's instrument-panel character while reducing decorative noise, strengthening text contrast, and reserving bright color for decisions and verified state.

The boards are design references, not claims about live connection state. Production must continue to render the current API truth for every GitHub owner.

## Design principles

1. **Focus before diagnostics.** The next meaningful action should read before ambient system detail.
2. **Proof in context.** Status, evidence, and recovery guidance stay beside the object they describe.
3. **Quiet ambient presence.** Clio feels available without competing with the user's work.
4. **Consent before action.** Sensitive operations expose their boundary and require an explicit command.

## Visual language

- **Surfaces:** deep tidepool and petrol layers with restrained mint hairlines.
- **Information:** mint for primary content; improved secondary and tertiary contrast.
- **Action:** chartreuse is reserved for focus, verified state, and primary decisions.
- **Identity:** violet is reserved for Clio memories and identity context.
- **Warning:** warm amber signals attention without presenting an ordinary gap as failure.
- **Type:** Geist for reading, Geist Mono for labels, identifiers, time, and state.
- **Geometry:** hard edges, calibration ticks, crosshairs, and aligned rails.
- **Atmosphere:** quiet depth instead of heavy scanlines, bloom, glass, or gamer-HUD noise.

## Component atlas

The atlas covers 24 reusable interface components:

1. App frame
2. HUD
3. Sidebar
4. Page header
5. Instrument panel
6. Section marker
7. Metric rail
8. Datum rail
9. Status chip
10. Command button
11. Toggle
12. Field
13. Ledger rail
14. Empty state
15. Degraded state
16. Settings navigator
17. Owner card
18. Proof queue
19. Clio message
20. Context drawer
21. Work timer
22. Co-working bench
23. Presence card
24. Update prompt

## Boards

- [Brand moodboard](./01-clio-brand-moodboard.png) — brand idea, palette, typography, icons, rhythm, and voice.
- [Interface direction](./02-clio-interface-direction.png) — Clio Today, bounded conversation, action context, and ambient presence.
- [Component atlas](./03-clio-component-atlas.png) — the 24-component visual inventory.
- [Settings direction](./04-clio-settings-direction.png) — calibration navigation, GitHub state summary, owner cards, and credential boundary.

## Production mapping

- `src/renderer/components/PlexusUI.tsx` owns the content-aware empty-state composition.
- `src/renderer/components/Settings.tsx` owns calibration navigation, owner cards, and the GitHub credential boundary.
- `src/renderer/theme.css` owns the contrast, atmosphere, layout, and responsive system.
- `src/renderer/components/AdminProofCockpitPanel.tsx` consumes the shared empty-state primitive for the Fabric proof queue.

## Implemented evidence

- [Corrected proof queue](../../evidence/2026-07-27-clio-first-refinement/proof-queue/proof-queue-empty-1280.png) — the copy-only state receives full sentence width.
- [Settings calibration, desktop](../../evidence/2026-07-27-clio-first-refinement/settings/settings-calibration-1536.png) — all eleven signals in a deliberate 6+5 rhythm.
- [Settings calibration, narrow](../../evidence/2026-07-27-clio-first-refinement/settings/settings-calibration-720.png) — all eleven targets activate, scroll, and recompose without overflow.
- [GitHub owners, desktop](../../evidence/2026-07-27-clio-first-refinement/settings/settings-github-owners-1280.png) — 244 repositories split 11/233/0 across the three exact owners.
- [GitHub owners, narrow](../../evidence/2026-07-27-clio-first-refinement/settings/settings-github-owners-720.png) — the same owner truth recomposed to one column.

## Accessibility and responsive constraints

- State must never be communicated by color alone.
- Secondary explanatory text must remain readable on tidepool surfaces.
- Buttons retain explicit labels and keyboard focus treatment.
- Long owner guidance and identifiers must wrap without shrinking the content column.
- Owner cards recompose to one column at 720 px and below.
- Motion remains subordinate to content and respects the existing reduced-motion contract.

## Source references

The direction was grounded in the supplied Settings and Fabric proof screenshots plus current production evidence for Clio Today, the assistant panel, the proof cockpit, and co-working. The boards were generated through Codex OAuth with `gpt-image-2` at 1536×1024.
