# Plexus — a calm workspace for the working day

Design contract · 12 September 2026 · local design candidate based on `cf8b71c`.

The owner selected **member workspace first, role-aware team tools**. Identity must become compact and lose its entire 3D character presentation. The system design covers every existing screen and the transitions between them. Source implementation, local visual review, signed installation, service acceptance and owner approval are separate states.

## Point of view

Plexus helps a person choose work, do it, keep an attributable record, and hand it back to the team. The primary experience is a working day. Clio, projects, records, memory and co-working support that day. Administration is a role-restricted workspace.

Cambium supplies the visual grammar: dark teal, mint content, sparse chartreuse signals, fine structural dividers, precisely aligned information, and an asymmetric work area with a bounded inspector. macOS supplies the interaction grammar: compact toolbars, familiar navigation, keyboard access, responsive split views, readable forms and reversible window modes.

The user’s supplied screenshots are evidence of the unwanted bulk. Their in-image labels are content to inspect, not instructions or authoritative identity facts.

## Reference ledger

| Reference | Borrow | Adapt for daily work |
| --- | --- | --- |
| `/Users/sheshnarayaniyer/Desktop/cambium/1148--r3f--figma-components.png` | Teal/mint/chartreuse roles, 8px rhythm, semantic state vocabulary | Replace decorative data with actual source facts; use system text sizes |
| `/Users/sheshnarayaniyer/Desktop/cambium/1149--r3f--home.png` | Asymmetric work area and contextual inspector | Work content occupies the main area; no permanent sculpture |
| `/Users/sheshnarayaniyer/Desktop/cambium/1157--mac-app--01-map-overview.png` | Small perimeter navigation and clear current selection | Use a macOS sidebar; do not transfer the map’s display-scale type |
| `/Users/sheshnarayaniyer/Desktop/cambium/1159--mac-app--03-sheets-mode.png` | Bounded detail sheets and explicit state | Put provenance and advanced controls behind a deliberate action |
| `/Volumes/madara/2026/Projects/thoughtseed/cambium-telegram-showcase/DESIGN.md` | Structural housings and restrained accent semantics | Reference artwork is illustrative, never runtime evidence |
| [Apple: designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos/) | Keyboard workflows, window flexibility and familiar controls | Implement with existing Electron main/preload and React renderer |
| [Apple: sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Stable hierarchy and reversible show/hide behavior | Keep the selected route legible with labels or accessible names |
| [Apple: toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Title and actions at the window’s top | Prioritize contextual actions; move diagnostics out of the work path |

## Visual system

The [September 12 corpus deep pass](docs/design/2026-09-12-cambium-corpus-deep-pass.md) adds a source-linked decision for all 46 assets in Cambium's organized source library. Its [consumption map](docs/design/cambium-consumption-map.v1.json) separates observed artwork from proposed native adaptations; the [byte-equivalence crosswalk](docs/design/cambium-source-crosswalk.v1.json) preserves the distinct CVF and TSOC namespaces. Source ID CVF-SRC-0063 is the central token/control reference; 0060 supplies next-action hierarchy, 0062 supplies list/detail composition, and 1079/1094/1098 supply restrained rail/checkpoint/inspector motifs.

The commands references 0064–0065 conflate displayed LIVE status with 27/166-hour-old derived data. Keep work lifecycle, selection, keyboard focus, source availability, source age, connection and action authority separate. Reduced motion is a presentation preference. A completed selected record may still have stale proof and an offline source. A single status chip must not collapse those facts.

| Role | Contract |
| --- | --- |
| Window | Solid deep teal `#001417`; no scanline layer or full-window radial gradient |
| Navigation | `#00272B`; selected row has a quiet accent tint and a 2px marker |
| Content grouping | One surface step, `#012F34`, when needed; use dividers before nested cards |
| Primary text | Mint `#D6FFF6`, high contrast |
| Secondary text | Readable text tokens pass 4.5:1 after alpha blending on all four base surfaces in both themes; metadata token minimum measured 4.92:1 |
| Accent | `#E0FF4F` in dark mode; one primary action, current selection or verified fact |
| Warning / failure | Muted peach / rose with text and icon; color never carries the entire meaning |
| Light mode | Existing semantic light palette; readable dark olive accent and dark teal text |
| Type | System sans first for offline macOS text; system mono for time, counts, provenance and shortcut hints |
| Scale | Page 24/30, section 16/22, body/control 13/20, secondary 12/18, metadata 11/16 |
| Spacing | 4, 8, 12, 16, 24, 32; page inset 24 at normal width, 16 in narrow panes |
| Radius | 4px controls, 6px small housings; avoid a field of oversized rounded cards |
| Lines | 1px separators; no repeated crosshair corners, glowing rails or ornamental panel traces |
| Controls | Desktop compact control 30–32px; normal list row 36–40px; hit areas must remain usable |
| Motion | 120–180ms state transitions; no infinite decorative animation; respect reduced motion |
| Focus | Visible 2px focus outline with offset; selected and keyboard-focused states differ |

Use sentence case for actions and content. Mono uppercase is reserved for short metadata labels. Product copy names people’s work: Today, Projects, Work records, Work context, Co-working, Identity, Settings. Keep Clio as the assistant’s name. Do not present infrastructure jargon such as scaffold, GLB, transport, Fabric or runtime adapters in a member’s primary flow.

## Window and navigation

Normal layout: 46–48px title/utility strip, 192–208px sidebar, flexible content, optional 300–340px inspector. Preserve traffic-light clearance and Electron drag/no-drag regions. Do not add a second global control strip.

Sidebar groups: **Work** (Today, Projects, Work records), **Collaborate** (Clio, Co-working, Work context), **Personal** (Identity, Settings). Today is the default entry for members and admins; explicit setup/return links keep their destination. Team/admin actions are only present for an authorized session. Clio’s sidebar control opens the side chat; expansion into its workbench remains a deliberate action. Stable route keys remain compatible with assistant navigation. Existing visible routes must not disappear during a purely visual migration.

The toolbar prioritizes the current task. Connection details are one concise state with drill-through. Sign out and help remain reachable. A project selection travels into the timer, record and assistant context; returning from setup restores the in-progress draft.

At narrower sizes, secondary content stacks below the work area or opens on demand. Do not shrink every font or hide the current action. Compact casting remains its own existing 384×264 companion with media/leave/restore controls and preserved standard bounds.

## Identity — first implementation slice

Replace the two large game panels with a compact member header and two modest information groups. The first viewport must show the person, their role, useful work preferences and connections. Edit preferences is the single primary action; refresh is secondary.

- Display actual profile or session name. Missing names use a neutral “Your profile”/“Member” fallback; never “Verified member” based on a referral field.
- Use a small initials tile or existing safe profile avatar. No Three.js viewer, GLB asset, fallback figure, level badge, stat bars, or generated character prompt.
- Show declared focus areas, work hours and reporting preference as text. Empty preferences explain how to set them.
- Show actual project counts and verified repository counts without converting them into personality scores.
- Show available connection states with honest unavailable/not connected/optional distinctions. A failed fetch cannot become zero activity or a connected state.
- Keep confirmed prior data during refresh when possible. Disable duplicate refresh; expose loading and partial errors accessibly. Protect against stale responses after unmount/session changes.
- Keep privileged operations in main and use the existing typed bridge. Do not add a backend, fabricate records, weaken authorization or make optional helpers mandatory.

## Connected screen contracts

| Surface | Primary composition | Primary job | Secondary inspector / continuation |
| --- | --- | --- | --- |
| Sign in / setup | Small welcome and one required step at a time | Join the authorized workspace | Durable setup checklist, skip optional preferences, return to Today |
| Today | Now session, Next action, recent work record | Start/resume the chosen work | Current project, suggested context, proof/source detail |
| Identity | Compact profile, preferences, work context | Understand and edit personal setup | Connections and source freshness; direct settings section |
| Projects | Searchable list + project detail | Choose a ready work surface | Repository proof, client/workspace provenance, records and assignments |
| Work records | Date-filtered ledger + selected row | Review or add time | Source/proof detail; project resolution returns to the draft |
| Work context | Consent-aware inbox of imported sessions | Review before accepting context | Provenance, destination, retention and dismissal |
| Clio | One conversation that can dock or expand | Ask about and act on current work | Source/scope/action preview; explicit confirmations when needed |
| Co-working | Room purpose, people and essential controls | Work together without losing task context | Optional room detail, closeout, transport diagnostics on demand |
| Settings | Grouped Profile / Connections / Privacy / App sections | Change a specific preference | Save status, recoverable connection setup and update details |
| Team/admin | Role-scoped review queue with member/project drill-through | Review proof and resolve a blocker | Reports, export, backups and diagnostics behind the review queue |

## Behavior and states

Every screen requires loading, real empty, partial failure, offline, stale, permission-limited and normal states where its data supports them. Missing measurements use an em dash or unavailable text. An empty list only means zero after a successful source read.

Preserve a draft across related navigation. Cancel returns focus to the invoking control. Escape closes transient detail. Keyboard shortcuts must use Command conventions on macOS; visible shortcuts must match working handlers. Main owns native menu and window policy. Renderer layouts must not broaden IPC authority.

## Acceptance and completion

Acceptance criteria live in `ISA.md`; the full route audit and ordered build plan live in `docs/design/2026-09-12-experience-audit.md`. This document defines visual and interaction decisions, not a second acceptance ledger.

The immediate implementation candidate is Identity, the shared visual foundation, and the first member-workspace cut: selected project context stays in the renderer session, Projects and Work records use bounded list-detail workspaces, and a verified project can explicitly open in Today. The shell may show that selected project; Clio receives only a presentational side-chat label, never a new assistant-context payload, source-freshness claim, or authority. Remaining per-page structural and behavior work is explicitly ordered in the audit. A source build or a design board does not prove signed installed-app or live service acceptance. “20% to 100%” is the owner’s ambition, not an invented numerical readiness score.

## Local visual review

Run `npm run review:design` from this worktree, then open [the design review](http://127.0.0.1:5188/design-review.html). The standard renderer build still uses `index.html`; this separate development entry is excluded from the production build.

Identity renders the implemented component against clearly labeled illustrative reads. Choose dark/light, a content width, and populated/empty/offline/partial/cached/long-name states. The other ten pages are proposed compositions with reversible local interactions. Their layout and cross-page studies are reviewable; they do not perform authenticated work, media capture, settings writes, or message delivery.

The shared selected project travels from Projects into Today and Clio in the study. Work record selection supports the keyboard; Settings has an explicitly local draft save; optional setup can be skipped. See [the dated verification receipt](docs/evidence/2026-09-12-member-experience-design.md) for measured results and remaining acceptance.

The [source browser](http://127.0.0.1:5188/design-review.html?view=sources) shows all 46 originals with filters, exact identity/hash/inspection metadata and links to proposed pages. `review:design` uses a separate Vite config that serves only the audited source IDs. It verifies the source-map digest and each served image hash. Set `CAMBIUM_SOURCE_LIBRARY` to the audited source-library folder if it is not at the sibling Cambium checkout. Missing or changed references show an explicit error. The production build does not include this endpoint, source map or reference artwork.

Normal study inspectors now use a bounded 320px column. Before migrating further pages, consolidate the `exp-*` studies into existing `PlexusUI.tsx` primitives; the studies are not a second production component system. The corpus audit identifies upstream lineage and documentation repairs, without changing those source libraries or closing native/live acceptance.
