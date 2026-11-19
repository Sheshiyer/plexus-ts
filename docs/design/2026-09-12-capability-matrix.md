# Plexus capability matrix

12 September 2026. This is a bounded capability map for the Cambium-inspired
Plexus macOS redesign. It turns the existing design contract and experience audit
into an ordered set of local skills; it does not authorize a provider, install a
package, or replace the Electron architecture.

## Ground truth and admission rule

Plexus is an Electron main/preload/React-renderer application. Main owns native
menu and window policy, while the renderer must retain the typed bridge and route
contracts. The target is a calm workday workspace: compact native title bar and
toolbar, 192–208px sidebar, optional bounded inspector, factual states, and
system fonts that work offline. The design contract requires no 3D Identity view,
no permanent decorative animation, and visible keyboard focus.

An installed skill is only a local documentation/craft capability. It is not an
admitted runtime, provider credential, framework dependency, security approval,
or completion receipt. Check `package.json`, existing source, and the signed app
separately before adopting a library or claiming acceptance. Swift/iOS material is
an interaction-reference boundary only: **no Swift rewrite and no SwiftUI API is
to be introduced for this Electron pass.**

## Resolved local candidates

The following 18 paths were resolved from
`/Users/sheshnarayaniyer/.agents/skill-clusters/skill-index.json` and each path
existed on 12 September. They are intentionally a small design/native set, not a
catalogue scan.

| Capability | Existing path | Concrete output for Plexus | Limits / wave |
| --- | --- | --- | --- |
| Design core | `~/.agents/skill-clusters/skills/design-core/SKILL.md` | Decision ledger, token discipline and a reference-based slop gate for Cambium teal/mint/chartreuse. | Directional governance; Waves 0–5. |
| Design orchestrator | `~/.agents/skill-clusters/skills/design-orchestrator/SKILL.md` | Coordinates research, specification and implementation handoffs. | Orchestrates, does not prove UI. Wave 0. |
| Refero design | `~/.agents/skill-clusters/skills/refero-design/SKILL.md` | Reference ledger for macOS sidebar, toolbar, inspector and form patterns. | Use cited evidence, not generic gallery imitation. Wave 0. |
| Taste skill | `~/.agents/skill-clusters/skills/taste-skill/SKILL.md` | Dense work-surface review: divider-led grouping, factual loading/empty/error states and performance-aware motion. | Its web defaults must yield to DESIGN.md, Electron, system fonts and reduced motion. Waves 1–4. |
| Stitch design taste | `~/.agents/skill-clusters/skills/stitch-design-taste/SKILL.md` | Enforceable screen-level design decisions and reusable component acceptance notes. | Existing `DESIGN.md` remains contract; do not fork a competing ledger. Wave 0/1. |
| Design system | `~/.agents/skill-clusters/skills/design-system/SKILL.md` | Semantic color/type/space/control tokens shared by all routes. | Add no design-system dependency without source check. Wave 1. |
| Frontend design direction | `~/.agents/skill-clusters/skills/frontend-design-direction/SKILL.md` | Page-composition review for Today, Projects, Records and Clio. | Renderer only; preserve route keys and return context. Waves 2–4. |
| Accessibility | `~/.agents/skill-clusters/skills/accessibility/SKILL.md` | Semantic controls, labels, contrast, focus sequence, dialog escape/restore and live status guidance. | Test against actual Electron/Chromium behavior. Waves 1–5. |
| Motion foundations | `~/.agents/skill-clusters/skills/motion-foundations/SKILL.md` | 120–180ms transform/opacity state transitions and reduced-motion variants. | No infinite decorative motion or new animation runtime by default. Waves 1–4. |
| Motion patterns | `~/.agents/skill-clusters/skills/motion-patterns/SKILL.md` | Purposeful transitions for inspector, sheets, loading and route continuity. | Respect `prefers-reduced-motion`; avoid a visual-only proof. Waves 2–4. |
| Browser QA | `~/.agents/skill-clusters/skills/browser-qa/SKILL.md` | Repeatable renderer checks for forms, keyboard paths and states. | Does not replace packaged macOS acceptance. Wave 5. |
| Electron orchestrator | `~/.agents/skill-clusters/skills/electron-orchestrator/SKILL.md` | Coordinates native window, renderer and packaging concerns. | No architecture migration. Waves 1/5. |
| Electron core | `~/.agents/skill-clusters/skills/electron-core/SKILL.md` | Process-model guardrails for title bar, sidebar and companion-window changes. | Main remains authority for native policy. Waves 1/3/5. |
| Electron main-renderer IPC | `~/.agents/skill-clusters/skills/electron-main-renderer-ipc/SKILL.md` | Small typed bridge additions only when a redesigned surface needs a real main capability. | No raw Node, `ipcRenderer`, remote module or broadened renderer authority. Waves 1–4. |
| Electron security | `~/.agents/skill-clusters/skills/electron-security/SKILL.md` | Review checklist around UI-driven privileged actions and new bridge methods. | Security review, not authorization. Waves 1–5. |
| Electron builder packaging | `~/.agents/skill-clusters/skills/electron-builder-packaging/SKILL.md` | Packaging/signing acceptance checklist and installed-app receipt. | A build is not authenticated-service or owner approval. Wave 5. |
| Mobile iOS design | `~/.agents/skill-clusters/skills/mobile-ios-design/SKILL.md` | macOS-adjacent interaction lens for hierarchy, reversible navigation, touch targets and system restraint. | Reference only; no Swift/iOS implementation APIs. Waves 0/5. |
| SwiftUI patterns | `~/.agents/skill-clusters/skills/swiftui-patterns/SKILL.md` | Cross-check native information architecture, toolbar restraint and state clarity. | Reference only; no SwiftUI migration. Waves 0/5. |

## Read set and practical use

Four high-value files were read in full (549 lines total): `design-core`,
`taste-skill`, `electron-main-renderer-ipc`, and `accessibility`; the remaining
matrix entries were path-resolved only. The useful, source-compatible portions are:

1. **Wave 0 — evidence and design.** Use design-core/refero/stitch to retain the
   Cambium reference ledger, document token roles and reject generic cards, glow
   and speculative data. Use the iOS/SwiftUI entries only to inspect familiar
   macOS hierarchy, toolbar and reversible-sidebar expectations.
2. **Wave 1 — Identity and shared foundation.** Apply design-system/taste rules
   to compact surfaces, native window/title-bar clearance, sidebar selection,
   toolbar priority, system/offline font stacks, factual forms and status states.
   Accessibility defines semantic controls, 4.5:1 body contrast, visible focus,
   icon labels and error text; motion is bounded and reduced-motion-safe.
3. **Wave 2 — daily work and projects.** Use frontend direction and accessibility
   to build Now/Next/Recent, list-detail projects and records with keyboard
   traversal, preserved drafts, focus restoration and clear validation. Any data
   request crossing the privileged boundary follows typed named bridge methods.
4. **Wave 3 — context and collaboration.** Apply motion patterns to dock/expand,
   sheets and compact-window transitions only when they clarify current work.
   Electron core/IPC keep compact cast, media and window restoration under main
   ownership; security reviews action scopes and payload validation.
5. **Wave 4 — settings and team.** Use the same form, focus and role-scoped
   composition rules. A visible Team surface remains a projection of existing
   verified authorization, never a grant of authority.
6. **Wave 5 — native acceptance.** Test light/dark, offline-system-font fallback,
   transparency/reduced-motion, resize/sidebar/inspector behavior, menu and
   Command-key routes, modal focus/escape restoration, compact/fullscreen round
   trips, and signed packaged installation. Browser QA is supplementary only.

## Acceptance probes by concern

| Concern | Required observable check |
| --- | --- |
| Native window, sidebar and toolbar | Traffic-light/drag-region clearance remains; sidebar show/hide and inspector-on-demand preserve the selected route and current action. |
| Keyboard, menu and focus | Every visible Command shortcut has a working handler; menu action is reachable; modal/sheet traps then restores focus; Escape closes transient detail. |
| Forms and states | Label, helper/error, loading, real empty, partial failure, offline, stale and permission-limited states stay distinguishable without color alone. |
| Accessibility | Keyboard-only traversal, named icon controls, visible 2px focus, contrast, announced dynamic status and usable target sizes are checked in the actual app. |
| Motion and transparency | 120–180ms purposeful transitions use transform/opacity; reduced motion suppresses nonessential movement; transparency never obscures information. |
| Offline fonts | System sans/mono render with network unavailable; no remote font is required to preserve hierarchy or shortcut/provenance readability. |

## Model provenance

Terra low completed independent read-only app-flow and Cambium-reference audits.
Codex 5.3 Spark was dispatched through OmniRoute for a bounded native/design source
scan, but hit HTTP 429 before producing a final report; it is **not accepted as a
completed audit**. This matrix relies on the existing design/audit documents and
the local index/path checks above. No provider re-probe was performed.
