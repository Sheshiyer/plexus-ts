---
task: Reskin four Plexus renderer files to cambium brand
slug: 20260611-000000_reskin-four-renderer-files
effort: advanced
phase: verify
progress: 30/30
mode: interactive
started: 2026-06-11T07:47:58Z
updated: 2026-06-11T07:55:00Z
---

## Context

Reskin the Plexus Electron React renderer's four remaining unstyled components to the cambium chartreuse brand design system defined in `src/renderer/theme.css` and the `ui.tsx` primitives. Timer.tsx and Reports.tsx are the exemplar pattern (PageHeader, Panel, SectionLabel, Field, Button, Modal, px-fadein, Crosshairs, mono numbers, token colors).

Files to rewrite (presentation only — ALL logic/props/state/window.plexus.*/callbacks preserved EXACTLY):
- Settings.tsx — full page
- IdleDialog.tsx — modal (px-backdrop/px-modal, has 3-way onAction)
- Onboarding.tsx — multi-step overlay
- ShortcutsModal.tsx — modal

Requested: Modal primitive or px-backdrop/px-modal for modals; SectionLabel + px-divider grouping in Settings; Field/Input/Select/Textarea; Button for actions; saved confirmation in var(--accent); replace all emoji with Icons.tsx icons; no inline color/layout styles except dynamic; ShortcutsModal kbd-styled keys; inline errors via Field error; async disables Button; mono numbers; var(--t1..t4) hierarchy; must typecheck.

NOT requested: touching files outside the four (Icons.tsx exempt — STEP 1 sanctions adding new icons "following the same pattern if needed"); npm/build/git; pure #000; outer neon glow; Inter; multiple accents; ANY behavior change.

### Risks
- Changing a callback signature or window.plexus.* call → behavior regression. Mitigate: diff logic line-by-line, copy verbatim.
- TS errors from primitive prop mismatches (e.g. Button variant, Field label/error types). Mitigate: match exemplar usage exactly.
- Emoji with no clean icon equivalent (scissors/trim, wave, pause, keyboard). Mitigate: add 4 minimal icons to Icons.tsx in existing pattern.
- IdleDialog/Onboarding are NOT in nav — full-viewport overlays; must keep their own high z-index semantics (px-backdrop is z-1000; original IdleDialog z-20000). px-backdrop is fine since these render above the app shell.

### Plan
- Add IconPause, IconScissors, IconKeyboard, IconHand to Icons.tsx (pattern: base(s), 24x24, stroke currentColor).
- Settings: full-page rewrite. PageHeader title="Settings" right={saved Badge}. Five sections via SectionLabel + px-divider. Each field = `<Field label><Input/Select/></Field>`. Preserve update/updateBridge/settingsGet/settingsSet exactly. Loading state via existing pattern.
- IdleDialog: keep props/onAction. Render via px-backdrop/px-modal (custom layout — 3 stacked action rows). Map discard→IconStop, trim→IconScissors, keep→IconCheck. Times in px-num/mono. Idle highlight var(--rose), active var(--accent). Keep formatTime.
- Onboarding: keep STEPS + step state + next() + onComplete. px-backdrop overlay (opaque) or Panel-centered. Map icons: welcome→IconHand, timer→IconTimer, paperclip→IconBridge, m4→IconBridge (or distinct). Step dots styled with tokens. Primary chartreuse Button.
- ShortcutsModal: keep SHORTCUTS + onClose. Modal primitive (title + onClose). Each shortcut a px-row; keys wrapped `<span className="px-mono">` with kbd inline style (border 1px var(--line-2), padding 2px 7px). Keyboard icon in title.

## Criteria

Settings.tsx:
- [ ] ISC-1: Settings imports primitives from ./ui (PageHeader, Panel, Field, Input, Select, Button, Badge, SectionLabel)
- [ ] ISC-2: Settings renders PageHeader with title "Settings"
- [ ] ISC-3: Saved confirmation shows in var(--accent) (Badge/text) after save, gated on `saved`
- [ ] ISC-4: Member ID field uses Field+Input, wired to update({memberId})
- [ ] ISC-5: Theme field uses Field+Select with dark/light/system, wired to update({theme})
- [ ] ISC-6: Paperclip path field uses Field+Input wired to updateBridge({paperclipPath})
- [ ] ISC-7: MultiCA url+token fields wired to updateBridge, token type=password
- [ ] ISC-8: R2 endpoint/bucket/accessKeyId/secretAccessKey fields wired to updateBridge, secret type=password
- [ ] ISC-9: Sections separated by SectionLabel headers and px-divider
- [ ] ISC-10: No #000/#161920/#8b949e/#0f1115 hex literals remain in Settings
- [ ] ISC-11: update/updateBridge/settingsGet/settingsSet logic preserved verbatim

IdleDialog.tsx:
- [ ] ISC-12: IdleDialog keeps props (idleSeconds, activeSeconds, entryId, onAction) unchanged
- [ ] ISC-13: Renders via px-backdrop + px-modal classes
- [ ] ISC-14: Three buttons call onAction('discard'|'trim'|'keep') — signatures identical
- [ ] ISC-15: ⏸ ⏹ ✂️ ✓ emoji replaced with Icons.tsx icons
- [ ] ISC-16: idle time in var(--rose) accent, active time emphasized, both in mono
- [ ] ISC-17: formatTime helper preserved verbatim

Onboarding.tsx:
- [ ] ISC-18: Onboarding keeps onComplete prop and STEPS data (titles+bodies)
- [ ] ISC-19: step state + next() completion logic preserved verbatim
- [ ] ISC-20: 👋 ⏱ 📎 🌉 emoji replaced with Icons.tsx icons per step
- [ ] ISC-21: Primary action is chartreuse Button; label switches Next/Get Started
- [ ] ISC-22: Step progress dots styled with tokens (active = var(--accent))
- [ ] ISC-23: Uses Panel/Field/Button primitives, no raw hex colors

ShortcutsModal.tsx:
- [ ] ISC-24: ShortcutsModal keeps onClose prop and SHORTCUTS data unchanged
- [ ] ISC-25: Renders via Modal primitive (title + onClose)
- [ ] ISC-26: Each shortcut rendered as a row (action + keys)
- [ ] ISC-27: Each key wrapped span.px-mono with kbd styling (border var(--line-2), padding 2px 7px)
- [ ] ISC-28: ⌨️ and ✕ emoji removed (icon + Modal close)

Global:
- [ ] ISC-29: `npx tsc --noEmit` passes with zero errors
- [ ] ISC-30: No Inter font, no outer neon glow, no second accent introduced in the four files

### Anti-criteria
- [ ] ISC-A1: No window.plexus.* call added, removed, or altered
- [ ] ISC-A2: No file outside the four targets + Icons.tsx modified

## Decisions

- Confirmed PlexusSettings.bridge: BridgeConfig (types.ts:62-80) — all original field wiring is type-correct. Keep `as any` on theme cast verbatim to avoid behavioral nuance.
- Onboarding STEPS have title/body/icon only — NO input fields. "keep all steps/fields" = preserve the informational steps; use Panel+Button, not Field. Error/async-disable criteria N/A to Onboarding (no form, no async).
- Add 4 icons to Icons.tsx (sanctioned by STEP 1 "add new ones here following the same pattern if needed"): IconPause (⏸), IconScissors (✂️ trim), IconKeyboard (⌨️), IconHand (👋 welcome). Map ⏹→IconStop, ✓→IconCheck, ⏱→IconTimer, 📎→IconBridge, 🌉→IconSync, ✕→IconClose (via Modal).
- ShortcutsModal uses Modal primitive; keys get inline kbd style (border 1px var(--line-2), padding 2px 7px, radius var(--r)) on span.px-mono — inline style permitted here per explicit instruction.
- IdleDialog + Onboarding use px-backdrop/px-modal directly (custom stacked layouts), not Modal primitive — both sanctioned by prompt. px-backdrop z-1000 > app shell z-3, sufficient.

## Verification
