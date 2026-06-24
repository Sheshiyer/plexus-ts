# Plexus Settings Component Design Sheet

Date: 2026-06-24
Purpose: convert the Settings visual direction into reproducible UI components.
Target surface: `src/renderer/components/Settings.tsx`, `src/renderer/components/ui.tsx`, `src/renderer/components/Onboarding.tsx`, and `src/renderer/theme.css`.

## Direction

Settings should feel like operator calibration for a work coordination field, not a SaaS preferences page. The page keeps the existing Plexus shell, HUD, sidebar, hard edges, hairline grid, mono telemetry labels, and chartreuse/mint palette. The redesign should be a component grammar that can be built with existing `px-*` primitives, plus a few new wrappers where the current generic table blocks overflow.

The last field-map render is useful as mood, but it is not the implementation target. The implementation target is a reusable component sheet.

## Source Components

- `PageHeader`, `Panel`, `SectionLabel`, `Button`, `Badge`, `StatusDot`, `Toggle`, `Input`, `Field`
- `ProfileCard`
- `OnboardingSetupPanel`
- Existing setting modules: account, member profile, session proof, setup and onboarding, bridge, appearance, updates, GitHub evidence, sound and breakwork, private rhythm, agent fabric
- Existing visual language: `px-form-band`, `px-settings-card`, `px-specs`, `px-flow-card`, `px-toggle`, `px-badge`, `px-statusdot`, `px-profile-card`

## Tokens

- Surface 0: `#001417`
- Surface 1: `#00272B`
- Surface 2: `#012F34`
- Accent: `#E0FF4F`
- Mint text: `#D6FFF6`
- Violet trace only: `#231651`, `#6E5BB0`
- Error only: `#F0A0A0`
- Labels: Geist Mono, 9.5-10px, uppercase, letter spacing 0.14-0.2em
- Body: Geist, 12-14px, opacity hierarchy
- Values: Geist Mono, tabular numerics, 13px compact, 18-22px primary
- Radius: 0 unless an existing primitive already requires a radius
- Borders: 1px hairlines using `--line`, `--line-2`, `--line-hot`
- Glow: inset only, never outer neon
- Spacing: 8, 10, 12, 14, 18, 24px

## Layout Primitives

### 01. SettingsPageFrame

Keeps the current Electron chrome, top HUD, and left nav. Main content uses a bounded scroll surface with a 12-column internal grid. Do not use a marketing hero. The title remains compact: `Settings` plus a mono subtitle such as `field calibration`.

States:
- default
- saved indicator visible
- worker offline status visible

Implementation notes:
- Preserve `PageHeader` and `Panel`.
- Keep `min-width: 0` on all grid children.
- Add a subtle field trace layer only inside the Settings panel, behind components.

### 02. CalibrationRail

An internal vertical index for Settings domains. This replaces the feeling of a generic form stack with a readable system map.

Items:
- identity
- profile
- proof
- setup
- bridge
- rhythm
- release
- fabric

States:
- current
- complete
- optional
- blocked

Implementation notes:
- Can be a sticky side rail inside the main panel on wide screens.
- Collapses to a horizontal segmented rail under 1120px.
- Use numbers, short labels, and small state dots.

### 03. SettingsSectionBand

The base component for each module. It evolves `px-form-band` into a titled calibration chamber.

Anatomy:
- section label
- short title or state sentence
- one-line note
- optional action slot
- body slot
- optional corner brackets

States:
- idle
- verified
- editable
- warning
- blocked

Rules:
- No card inside card nesting.
- Use bands as full-width rows or grid spans.
- Prefer open rails over boxed table cells.

### 04. DatumRail

The key data display component. This replaces most repeated `px-specs` table blocks.

Anatomy:
- mono label
- primary value
- optional secondary value
- optional status chip
- optional copy/action icon

Variants:
- compact: email, member id, endpoint, workspace id
- primary: role, quota, state, visibility
- metric: counts and version numbers
- secret: token and invite values

Overflow contract:
- Each rail uses `min-width: 0`.
- Long email, endpoint, identity, employee, token, and URL values use middle truncation or two-line wrap.
- Full value remains available through `title` and copy action where useful.
- Never use unbounded `white-space: nowrap` on rail containers.
- Values that cannot be truncated safely use `overflow-wrap: anywhere`.

### 05. StatusChip

Small mono capsule for system state. Replaces mixed badge/status treatments.

States:
- online
- connected
- verified
- granted
- complete
- saved
- skipped
- paused
- warning
- error
- idle

Rules:
- Chartreuse only for affirmative verified/complete/saved states.
- Mint for neutral active states.
- Rose only for errors.
- Keep labels short and stable.

### 06. ActionButtonStrip

Button clusters for module actions.

Variants:
- primary action
- ghost action
- destructive action
- disabled action
- busy action

Rules:
- Use existing `Button`.
- Group related bridge actions into two rows if width is limited.
- Icon plus text for tool actions where icons exist.

### 07. FormField

Settings form fields for profile, bridge invite, URLs, birthdate, and update feed values.

Variants:
- text
- URL
- secret/token
- date
- range

Rules:
- Labels remain mono and uppercase.
- Inputs never exceed their parent width.
- URL and token fields use `overflow: hidden` visually, but editing still scrolls naturally.

### 08. SegmentToggle

Existing `Toggle` restyled as segmented calibration control.

Instances:
- dark / light / system
- sound on / muted
- voice / text only
- enabled / paused

Rules:
- Active segment uses accent-dim fill.
- Disabled segments stay visible but low contrast.

## Domain Components

### 09. IdentityCredential

Shows verified Cloudflare Access identity and account entitlement.

Contains:
- member display name
- email
- role
- quota
- workspace
- visibility
- log out action

Preferred shape:
- credential header row
- two rows of DatumRails
- status chip: `verified`

Overflow cases:
- `Thoughtseed Labs Admin`
- `thoughtseedlabs@gmail.com`
- `ws_thoughtseed`

### 10. MemberProfileEditor

Combines `ProfileCard` preview and editable local profile fields.

Contains:
- profile preview
- display name
- handle
- title
- status
- avatar image URL
- saved/dirty action

Rules:
- The profile card should feel like a member credential, not a social avatar card.
- The form fields sit in a rail/grid beside it.
- Long names wrap in the preview; handles truncate with `@` preserved.

### 11. SessionProofCluster

Shows source of authentication and live worker/session proof.

Contains:
- Cloudflare Access
- worker endpoint
- identity id
- employee id
- required setup
- onboarding state
- connected status
- refresh proof action

Rules:
- Use DatumRails grouped by proof type.
- Endpoint and ids must never overflow.

### 12. SetupStepTile

Represents onboarding setup steps inside Settings.

Examples:
- Identity and project access
- Personal preferences
- Paperclip / Vapor Clip agent fabric
- Daily agent and standup

States:
- completed
- skipped
- deferred
- failed
- open

Rules:
- Each tile uses icon, title, source key, updated timestamp, status chip, and actions.
- Optional skipped is visible but not alarming.

### 13. PermissionGrantTile

Represents system permissions.

Examples:
- Microphone
- Camera
- Screen Recording

States:
- granted
- denied
- not checked

Rules:
- Use square icon well, status chip, and terse label.
- Three tiles should align in one row on wide screens and wrap safely.

### 14. ThoughtseedBridgeModule

Bridge connection and directive controls.

Contains:
- connected/closed state
- tenant
- member
- token expiry
- last seen
- endpoint
- invite token input
- redeem
- heartbeat
- poll
- ack all
- rotate
- disconnect
- directive message area

Rules:
- This is a dock, not a table.
- Token expiry, endpoint, and directive payloads must wrap or middle-truncate.
- Actions split into connection, polling, and maintenance groups.

### 15. AppearanceCalibration

Theme and palette control.

Contains:
- current render state
- dark/light/system segmented control
- save appearance action
- small token swatches for surface, accent, mint

Rules:
- Show palette as system calibration, not a preferences card.

### 16. ReleaseFeedModule

OTA update status and actions.

Contains:
- current version
- local app version
- channel
- state
- feed URL
- progress meter
- check/download/install actions

Rules:
- Feed URL uses compact DatumRail.
- Install action can become accent only when available.

### 17. EvidenceHealthModule

GitHub evidence health for daily work records.

Contains:
- entries today
- matched
- missing proof
- legacy
- refresh proof action

Rules:
- Counts are metric rails, not KPI cards.
- Missing proof gets warning only when greater than zero.

### 18. BreakworkSoundModule

Sound and breakwork controls.

Contains:
- sound state
- voice state
- volume
- snooze
- quiet start
- quiet end
- sound toggle
- voice toggle
- range slider

Rules:
- Keep privacy and worker-side voice note in the body copy.
- Slider must not stretch into unrelated columns.

### 19. PrivateRhythmModule

Local biorhythm settings.

Contains:
- enabled/paused state
- birthdate
- consent recorded
- pause/enable rhythm
- delete rhythm data

Rules:
- Private data is visually separate from CEO-visible preferences.
- Deletion is ghost/destructive tone, not accent.

### 20. AgentFabricModule

Local provisioning and setup actions.

Contains:
- local setup state
- provisioning action
- setup action
- error message area

Rules:
- Keep this as operational action dock.
- Do not imply autonomous unattended completion.

## Component Sheet Composition

The design sheet should show components, not a full app screen. Arrange as a Figma-style board on a dark Plexus canvas:

1. Token strip: color chips, typography, borders, spacing.
2. Primitive row: section band, datum rail, status chips, buttons, inputs, toggles, range.
3. Domain modules row: identity credential, profile editor, session proof, setup tile, permission tile.
4. System modules row: bridge dock, appearance calibration, release feed, evidence health, breakwork, private rhythm, agent fabric.
5. Overflow lab: same DatumRail with long email, long endpoint, long identity id, invite token, and directive payload.
6. State matrix: complete, skipped, deferred, blocked, error, idle.

## Non-Goals

- No full-page fantasy dashboard.
- No bento SaaS grid.
- No rounded glass cards.
- No decorative UI that cannot map back to React components.
- No generic analytics cards.
- No overflowing labels or values.
