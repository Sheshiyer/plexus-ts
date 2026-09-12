# Plexus experience audit and build plan

12 September 2026. Design source: `cf8b71c`, package `0.7.12`. The concurrent local-installation receipt was committed as `83911f9`; its application source, package and tests are identical to this baseline. Work proceeds in `codex/plexus-experience-design-20260912`, preserving the original dirty root and separate acceptance checkout.

The owner asks for a compact, fully redesigned Identity without its 3D character and a deep Cambium-led redesign of the whole macOS app. The owner confirmed **member workspace first, role-aware team tools**. [DESIGN.md](../../DESIGN.md) is the visual contract; [ISA.md](../../ISA.md) is acceptance authority.

## What the current app actually is

Plexus is an Electron desktop application with a React renderer. Electron main owns authentication, local storage, privileged actions, timers, media/window policy and the typed bridge. A SwiftUI migration is unnecessary for this design pass.

The useful product spine already exists: session → project → timed work → record/evidence → report → team review. Clio supplies contextual help; local imported sessions offer optional context; co-working supplies optional presence and media. The design should make that spine visible.

Current route selection, URL entry, assistant navigation and role policy are split among `src/renderer/App.tsx:34`, `:61`, `:89`, and `src/renderer/routePolicy.ts:8`. Composition is centralized around `App.tsx:609`. These baseline line references predate this candidate and may shift as implementation changes.

## Current-to-target screen inventory

| Current screen | Existing action and authority | Main experience defect | Proposed composition and connection | Existing implementation |
| --- | --- | --- | --- | --- |
| Splash / login | Access sign-in → verified session | Branded waiting has little explanation; resumption is invisible | Brief welcome, current sign-in state, clear recovery; resume pending work after a valid session | `App.tsx:476`, `Login.tsx`, `splash/SplashScreen.tsx` |
| Onboarding | Required setup plus optional rhythm/privacy setup | Separate journey with a long handoff to the workspace; unresolved setup reappears elsewhere | Shared unresolved-setup object; one required next step, optional items collapsed, direct return to Today | Onboarding composition in `App.tsx`; settings setup section |
| Clio Today | Timer, project selection, next actions, proof/context via TodaySnapshot | Multiple operational bands compete with the active work session | **Now / Next / Recent work**; current task dominates, source inspection secondary | `components/Timer.tsx`, TodaySnapshot helpers |
| Identity | Preferences, settings, bridge, task/KPI and project reads | 3D test model, referral-derived name, invented levels and scored bars | Actual person and role, declared work preferences, actual work counts, connection facts; compact Edit preferences action | `components/IdentityPanel.tsx`, `identityLoadout.ts` |
| Work records | Local records, filter/add/delete, verified project bindings | Manual entry becomes a project creation and repository setup workflow | Date-filtered ledger, selected-record inspector, small entry sheet; dedicated project-resolution flow returns to preserved draft | `components/TimeEntryList.tsx:408` |
| Clio Memories | Consent-based local scan, accept/dismiss session candidates | Memory, scanning and recorded work sound interchangeable; consequences are unclear | **Work context** review inbox: source, time, suggested project, destination and retention before accepting | `components/AgentSessionsPanel.tsx` |
| Projects | Sync/create, vault brief imports, verified GitHub binding, commits/PRs | Readiness and proof are scattered across Today, Identity and Settings | Search/list + project detail: readiness, repository, work records, assignments and current work; one Fix connection path | `components/ProjectManager.tsx:428` |
| Co-working | Room selection/join, presence, media, screen share, compact cast, closeout | Ambient stage/floor/lounge and diagnostics compete with practical controls | Room purpose, people, essential media controls and contextual work; advanced health inspector; return to previous work on leave | `components/CoWorkingPanel.tsx:789`, co-working components |
| Clio page / side chat | Main-process assistant, context, proposals, approved actions | Two visual entry points and opaque route events obscure conversation continuity | One persistent conversation, dock/expand presentation; context scope and intended destination shown before action | `components/AssistantPanel.tsx:340`, assistant navigation helpers |
| Settings | Profile, preferences, assistant, GitHub/proof/setup/bridge, appearance, update/evidence/helpers | Long mixed-purpose scroll; changing a profile field requires finding the right subsystem | Four groups: **Profile, Connections, Privacy, App**; subsection deep links, clear save state; diagnostics under Advanced | `components/Settings.tsx:70`, `Settings.css`, `PreferencesPanel.tsx` |
| Admin | Proof cockpit, reports, exports, backups, diagnostics, employee test mode | Oversight feels like another personal page; raw status and duplicated summaries dominate | Separate authorized Team workspace: review queue → member/project proof → action; explicit scope banner and return to personal work | `components/AdminDemoPanel.tsx`, `App.tsx:529`, `routePolicy.ts` |

## Overlays and secondary surfaces

| Surface | Keep | Refine and verify |
| --- | --- | --- |
| Global update prompt | Separate download and restart consent | Compact progress, accessible action state, preserved work on dismissal |
| Idle-time decision | Explicit retain/discard choice | Explain affected time range; restore focus and current project |
| Shortcut sheet | Real implemented shortcuts | Use platform-correct modifier labels; keyboard entry/exit and focus restoration |
| Add project | Existing project creation | Separate optional repository resolution; clear created-versus-ready state |
| Repository binding | Verified inventory and selection | Explicit target project/repository, stale/inaccessible recovery, return to caller |
| Manual work record | Date, duration, project and description | Keep a draft while resolving project; one clear submit and recoverable validation |
| Assistant context drawer | Source inspection | Explain what is included and why; preserve conversation scroll and input draft |
| Assistant approval | Confirm exact action and scope | Include destination, affected record, authority and cancel; never infer consent from design state |
| Co-working closeout | Explicit summary/leave boundaries | Carry room/project context into proposed next actions without automatic sending |
| Compact companion | Current native reversible window mode | Essential controls only; test every standard/compact/fullscreen round trip |

## The connected journeys to build

1. **Start a day:** sign in → unresolved required setup if needed → Today → choose a ready project → start timer. If the repository needs attention, open the project connection step and return to the same timer draft.
2. **Finish work:** stop timer → review captured record and attached source → correct missing detail → create or preview the daily report → show delivery state and destination receipt. A queued report is not a delivered report.
3. **Use local context:** consent → scan → inspect provenance and proposed project → accept into the named destination → show resulting record. Dismissal is reversible where the existing data model supports it.
4. **Ask Clio:** current work context → conversation → inspect source/scope → approve a required action → navigate to the affected object with visible continuity → return without losing the draft.
5. **Co-work:** active project → relevant room → explicit media consent → compact companion → restore → closeout → return to work. Diagnostics remain available without occupying the main stage.
6. **Review as a founder:** enter authorized Team workspace → review queue → member/project proof → inspect provenance → resolve the specific blocker → return to personal workspace. UI visibility follows verified role; it does not grant authority.

## Findings that change implementation

**Identity is using an invented model.** `identityLoadout.ts:108` derives a name from a referral value or “Verified member”. Formulas at `:76`, `:123` and `:197` turn text length and empty-source defaults into levels, focus, cadence, signal and trust scores. The model URL at `:72` is a test GLB. The correct fix is to replace this representation, not reduce its dimensions. Existing `Session` and profile fields in `src/shared/types.ts:439` and `:488` already provide factual names, role and preferences.

**A score is not a state.** Settings contains real connection states and repository authority, but large cross-page status decks repeat them. Each source needs loading, successful empty, unavailable, stale and authorization-limited states. Do not collapse a rejected read into an empty array and then label it “no work”.

**There is a navigation contract to retain.** Assistant and startup routing use existing route keys; purely visual renaming must preserve those keys. New project/record drill-through requires explicit return context. A full routing refactor should be a bounded later wave with navigation and role tests.

**The native foundation already has useful behavior.** `src/main/main.ts:477` creates a 1320×860 hidden-inset window. `src/main/window-mode.ts` owns a 384×264 compact state and restoration of bounds, fullscreen, stacking and workspace visibility. The renderer must preserve that owner. Main/preload security does not need to change to make the work area calm.

**Some visible readiness is still only source evidence.** The installed app was observed during this pass showing an online workspace, an offline Clio state and Identity’s “GLB active” presentation. That confirms current UI behavior at observation time, not availability of all connected services. Founder proof, recording, delivery and signed update acceptance keep their existing criteria.

## Six ordered implementation waves

| Wave | Concrete tasks and owned files | Dependency / acceptance | Status in this candidate |
| --- | --- | --- | --- |
| 0 — Evidence and design | Inventory all routes/overlays; inspect Cambium references; map native/design skills; record owner choice; create DESIGN.md and current-to-target flow map | Existing source + owner direction; ISA-309–314 | Complete design pass and ten interactive page studies |
| 1 — Identity and shared foundation | Replace Identity model/view; remove 3D consumer and unused payload; factual unavailable states; profile deep link; compact shared navigation, typography, surfaces and controls | Wave 0; ISA-315–328, layout and regression checks | Implemented and locally verified; native acceptance remains open |
| 2 — Daily work and projects | Recompose Today as Now/Next/Recent; project list-detail; readiness repair that returns to timer; searchable/date-filtered work ledger; preserve manual-entry draft; explicit work-record detail | Wave 1, existing project authorization; ISC-329 | Planned |
| 3 — Context and collaboration | Rename/reframe memory inbox; source-to-record acceptance flow; unify Clio dock/page continuity; contextual room journey; simplify co-working controls and closeout; verify compact restoration | Wave 2 context contracts; current assistant/media authority; ISC-330 | Planned |
| 4 — Profile, setup and team | Group Settings into four sections; reliable subsection deep links; shared setup state; role-scoped Team workspace; proof review drill-through; reports/export/backups behind work review | Waves 2–3; current authenticated role and proof boundaries; ISC-331 | Planned |
| 5 — Native acceptance and finish | Full light/dark/reduced-motion pass; keyboard/focus/menu checks; window resize and companion round trips; actual signed packaged build; authenticated member/admin/degraded journeys; owner visual review | Waves 1–4; P6/P7 gates remain independent; ISC-332 | Planned |

Wave 2 can split into Today, Projects and Records workers only after a shared navigation-return contract is written. Wave 3 can split context review, assistant presentation and co-working layout, with a single coordinator for their shared selected-project state. Wave 4 can split Settings and Team, while role policy remains single-owner. Parallel mutation uses disjoint ownership or separate worktrees.

## Definition of a complete experience

Completion is measured by named journeys and verified states rather than a claimed design percentage. Each route must have its primary action, loading/empty/error behavior, keyboard path, responsive behavior, source provenance and return context accepted. The member-to-founder journey still needs a real destination receipt. The system must be tested in a packaged macOS window, not only a browser specimen.

The initial “20%” is the owner’s assessment of the experience. This report does not convert a source test count, screenshot or reference study into “100%”. ISA-329–332 deliberately remain open until the remaining implementation and acceptance work is performed.

## Model and evidence provenance

- Terra low performed independent read-only app-flow and Cambium-reference audits. The reference audit inspected five images; parent inspected the component sheet and native map reference directly.
- Terra low completed the disjoint Identity and shared-foundation implementation lanes, the 18-path skill matrix, and the ten interactive page studies. Parent integrated and refined the result, tested it through IAB, and retained the existing Clio side-chat contract.
- Codex 5.3 Spark was dispatched on `codex/gpt-5.3-codex-spark` through the existing OmniRoute wrapper for a bounded native/design capability audit. The scan ended with HTTP 429 and exit 1 before an accepted final report. Terra completed the 18-path capability matrix; Spark is credited only with the partial scan.
- Apple platform references were checked against official current macOS, sidebar, toolbar and focus guidance. Local skill availability is not proof of API/runtime installation or provider credentials.
- User screenshots and current installed Identity were visually inspected. Rendered design specimens, if present, are labeled separately from authenticated installed-app evidence.

## Reviewable outputs

The [local review board](http://127.0.0.1:5188/design-review.html) contains the implemented Identity component with illustrative state controls, plus ten proposed page compositions. It demonstrates project selection carrying into Today and Clio, keyboard record review, context review, local draft save, optional setup skip and team-to-member navigation. The board remains a development-only artifact. Run `npm run review:design` in the design worktree if its loopback server is not running.

The [verification receipt](../evidence/2026-09-12-member-experience-design.md) records source checks, layout measurements, model outcomes and remaining production work. These studies make the full-system design concrete; Waves 2–5 remain implementation and native/live acceptance work.
