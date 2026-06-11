# Plexus UI Redesign — Design Spec (Cambium brand)

**Date:** 2026-06-11 · **Status:** approved (full redesign) · **Reference:** [plexus-redesign-v1.html](../../design-references/plexus-redesign-v1.html)

## Goal
Take the Plexus renderer from ~5% to 100% taste. Currently 8 pages + 3 modals + splash, 100% inline styles, emoji labels, GitHub-dark palette, no design system. Replace with a cambium-brand design system: gun-metal HUD surfaces, chartreuse accent, mint text via opacity hierarchy, Variant mission-control structure, full taste-skill doctrine.

## Design tokens (source of truth → `src/renderer/theme.css`)
| token | value | use |
|---|---|---|
| `--bg-0` | `#001417` | app background (never pure black) |
| `--bg-1` | `#00272B` | sidebar / HUD / primary surface |
| `--bg-2` | `#012F34` | raised cards |
| `--bg-3` | `#06393F` | hover / elevated |
| `--accent` | `#E0FF4F` | chartreuse — single accent, <80% sat |
| `--mint` | `#D6FFF6` | primary text base |
| `--violet` / `--violet-2` | `#231651` / `#3A2A6B` | depth accent, tertiary series |
| `--t1..t4` | mint @ .96/.60/.38/.22 | **opacity-only** text hierarchy |
| `--line` / `--line-2` / `--line-hot` | mint @ .10/.16 / chartreuse @ .55 | hairline grouping (not cards) |
| `--rose` | `#F0A0A0` | restrained error only |
| `--glow-accent` | `inset 0 0 0 1px …, inset 0 0 14px …` | **inset only — no outer neon** |
| `--ease` | `cubic-bezier(.16,1,.3,1)` | all motion |
| fonts | Geist / Geist Mono | display + body / numerals + metadata. **No Inter.** |

## Architecture
- `theme.css` — tokens + base + scanline overlay + component classes (`px-*` prefixed), imported once in `main.tsx`.
- `components/ui.tsx` — primitives: `SectionLabel`, `Caption`, `Panel`, `Button` (accent/ghost/stop), `Input`/`Select`/`Textarea`/`Field`, `Badge`, `StatusDot`, `StatCard`, `Skeleton`, `EmptyState`, `Crosshairs`, `HudBar`, `PageHeader`.
- `components/Icons.tsx` — inline-SVG icon set (currentColor, 1.5 stroke) replacing ALL emoji. No new dependency (no Phosphor/Radix/framer-motion install).
- Pages/modals rewritten to consume primitives + tokens; inline styles removed.

## Taste-skill compliance (acceptance checks)
- [ ] No emoji anywhere (icons via `Icons.tsx`). No Inter. No pure `#000`. No outer neon glow (inset only).
- [ ] Numbers in `--font-mono`, tabular-nums. Text hierarchy by opacity, not new colors.
- [ ] Cards only where elevation matters; otherwise hairline rows / `border-t` / negative space.
- [ ] Loading = skeleton shimmer (no spinners). Composed empty states. Inline error states on forms.
- [ ] Tactile `:active` (`translate-y(-1px)`/`scale(.98)`). Motion = transform/opacity only, `--ease`, honors `prefers-reduced-motion`.
- [ ] Single accent (chartreuse). HUD top bar + sidebar active-rail + scanline atmosphere + crosshair panel corners.

## Build inventory
**Foundation (self):** theme.css · Icons.tsx · ui.tsx · index.html/main.tsx wiring.
**Shell + splash (self):** App.tsx (HUD bar + sidebar + content) · RibbonsShader (fix `tanh` → WebGL1 polyfill; recolor to chartreuse/gun-metal; harden compile/link early-return) · AnimatedLogo + SplashScreen recolor.
**Exemplar pages (self):** Timer · Reports · TimeChart.
**Fan-out (parallel subagents, given this spec + exemplars):** TimeEntryList · ProjectManager · ExportPanel · BridgePanel · BackupPanel · Settings · IdleDialog · Onboarding · ShortcutsModal.
**Icon (Higgsfield):** regenerate P-mark in chartreuse/mint/gun-metal → squircle/icns/tray pipeline → republish to Design/Plexus-Brand + repo.

## Shader bug (root cause)
`RibbonsShader.tsx` fragment shader calls `tanh()` — **not a built-in in WebGL1 GLSL ES 1.00** → fragment fails to compile → `linkProgram` fails → `getAttribLocation` on the unlinked program throws → render loop never starts → blank splash. Fix: add `vec3 tanh3(vec3)` polyfill, guard compile/link with early-return + null-bail, recolor grade to chartreuse over gun-metal.

## Verification
typecheck clean → run dev → screenshot every tab (Timer/Entries/Projects/Reports/Export/Bridge/Backups/Settings) + splash + a modal → confirm shader renders → before/after. Data flow (`window.plexus` API) unchanged.
