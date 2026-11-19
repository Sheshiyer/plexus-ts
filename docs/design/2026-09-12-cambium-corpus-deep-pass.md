# Cambium corpus → Plexus design decisions

12 September 2026 · three `gpt-5.6-luna` agents at high reasoning · source and local design review.

The organization is sound at the file level. All 46 originals match their discovery aliases, the four declared duplicates are exact, and the five unresolved models remain unnamed. The library is useful for visual reference. It is not yet a complete implementation package: these are 45 PNGs and one SVG, every row is reference-only, and several lineage and state semantics need reconciliation.

The quoted completion report was an audit target. In-image labels, previous handoffs and generated manifests are evidence to inspect; they do not issue instructions or establish live product state.

## Reviewable result

- [Source browser](http://127.0.0.1:5188/design-review.html): select **Source library**, then search, filter and inspect an original beside its proposed Plexus use.
- [Consumption map](cambium-consumption-map.v1.json): all 46 source IDs, original paths/hashes, inspection coverage, observed facts, proposed translation, exclusions and page mappings. **18 adapt, 19 reference, 5 hold, 4 duplicate.** These are design recommendations, not changes to Cambium's classifications.
- [Namespace crosswalk](cambium-source-crosswalk.v1.json): 29 filename-and-byte matches between CVF and TSOC, explicitly without semantic equivalence.
- [Verification receipt](../evidence/2026-09-12-cambium-corpus-review.md): checks and local review boundaries.

Plexus remains a member workspace first, with team tools appearing by role. Identity stays compact, with no replacement organ sculpture, 3D character, GLB, synthetic level or personality score.

## What the audit actually covers

| Surface | Coverage | Limit |
| --- | --- | --- |
| Telegram | All 10 original images directly viewed | Screenshots do not prove interactions or timing |
| R3F metadata | All 36 mapped rows | R3F family names do not make these executable meshes |
| R3F visuals | 27 directly viewed files: 12 semantic/components, 5 unresolved, 1 product, 2 contact sheets, 1 rendered SVG, 6 turntable frames | Five unique turntable frames were map/contact-sheet inferred; four duplicate rows use hash equivalence |
| Combined | 37 direct visual files, 5 inferred frames, 4 duplicate rows | 42 distinct hashes, not 46 distinct designs |
| Organ Console export | 140 registered records; 97 exported images and 23 review boards checked | Record count is not implemented component count |

Direct turntable inspection: CVF-SRC-1065, 1066, 1067, 1071, 1073, 1074. Inferred frames: 1068, 1069, 1072, 1075, 1076. Favicon 1085 was rendered from SVG in memory. No source image was edited or regenerated.

## Findings that change the implementation plan

| Finding | Evidence | Consequence and correction |
| --- | --- | --- |
| File organization passes | Organizer check: 46 assets, 10 Telegram, 36 R3F, 4 duplicates, 5 unresolved; every original/alias hash matches | Use source IDs and original filenames as provenance. Organized paths remain discovery aliases |
| Freshness and connection are conflated in references | CVF-SRC-0064 shows LIVE with derived 27h ago; 0065 shows derived 166h ago | Show connection, last successful source read, work state and permission independently |
| Named owner confidence is broader than direct proof | 28 rows use `explicit-name-or-adaptation-lineage`; contact sheet says build/ops while map owners say hands/will | Preserve both presentation and canonical names. Add documentary lineage before turning them into app semantics |
| Export lineage is not acyclic | Twelve upstream usage records derive from themselves; held Run River and Held Gate consequently block on themselves | Repair upstream source edges and validate graph integrity before treating the exported dependency graph as actionable |
| One narrative count is stale | Upstream Organ Console README says 75 selected/22 generated; current manifest and exported README say 81/16 | Refresh the upstream README from the manifest; the Cambium export README is already current |
| The two corpora overlap but differ | 46 CVF rows and 45 TSOC source assets share 29 numbered filenames/hashes; 17 CVF-only, 16 TSOC-only, 1 excluded Finder pointer | Use the explicit crosswalk. Do not add 46 and 140 as unique asset coverage or merge namespaces by name |
| Verification has bounded blind spots | Organizer uses a fixed asset list and declared duplicate pairs; exporter lacks dependency/collision/ID validation | Add inventory discovery and graph/collision checks before making completeness or integration claims |
| Durability is local | Cambium main is dirty, four commits behind the locally recorded origin/main; source library/scripts are untracked | Review does not establish committed or published availability. Do not absorb unrelated WIP |

The graph issue belongs to the upstream Organ Console generation manifest, not the 46-row source-library map. The exported package passes its existing verifier despite those source graph defects.

## One visual language, three source layers

**Interface grammar — 0059–0068.** Fine dividers organize information. A stable state label accompanies a small icon. A work list leads to bounded detail. One next action receives emphasis. This layer should drive Plexus composition and controls.

**Material and silhouette grammar — 1065–1079, 1088–1098, 1100.** Stratified dark teal edges, pale structural caps, radial anchors and sparse chartreuse traces create continuity. Translate that into small markers, a clear selected edge and one surface step. Literal stone texture, 3D plates and glowing circuits are unsuitable for the daily work area.

**Spatial explanation — 0062, 1086, 1087, 1099.** The map and contact sheets help explain relationships and compare specimens. For the app, translate selection → detail → next action into a list and inspector. Keep the original illustrations in the development reference browser.

The five unresolved previews (1080–1084) depart from the established material family and carry no owner. They remain visible in review with Hold labels. Shape resemblance cannot resolve identity.

## Token and interaction decisions

| Source observation | Plexus decision | Verification target |
| --- | --- | --- |
| 0063 labels teal `#00272B`, surface `#012F34`, mint `#D6FFF6`, accent `#E0FF4F` | Retain those semantic roles within the existing dark/light themes | Contrast against every base surface; labels survive without color |
| Large condensed display headings and 8px grid | System sans for member content; 13/20 body, 11/16 metadata; 4/8/12/16/24/32 spacing | Native-scale readability and narrow-pane wrapping |
| Selected halos and active orbits overlap | Selection gets a thin edge/tint; keyboard focus gets a separate outline; work state gets text | A selected stale item can still be keyboard-focused without implying completion |
| 0061 sequences show movement but no duration | 120–180ms event feedback is our design choice; static reduced-motion equivalent | No infinite animation or loss of state in reduced motion |
| 0062 and 1086 place detail at the edge | Standardize the normal study inspector at 320px, stack below at narrow widths | Main content remains usable; no miniature typography |
| 0060 gives one next action | Today foregrounds start/resume; detail exposes context and subsequent review | Project choice follows into Today and Clio |

Do not build one flat enum containing active, selected, stale, offline and reducedMotion. They describe different dimensions and must coexist:

| Dimension | Example values | Meaning |
| --- | --- | --- |
| Work lifecycle | idle, running, paused, complete, blocked | What happened to this work item |
| Selection | selected / unselected | Which item the person is inspecting |
| Keyboard focus | focused / unfocused | Which control receives keyboard input |
| Source availability | available, partial, unavailable | Which reads succeeded |
| Source age | timestamp plus source-specific fresh/stale/unknown rule | When data was last successfully read; no universal age cutoff invented |
| Connection | connected, reconnecting, offline, unknown | Transport health, independent from cached content |
| Authority | allowed, restricted, not established | Whether the current role can perform the action |
| Motion preference | standard / reduced | Presentation preference; never a work status |

Example: a **selected, completed record** may have **stale proof**, an **offline connection**, and **read-only access**. Preserve its confirmed content and completion state, mark its proof age and failed refresh, and offer the appropriate recovery. A single green LIVE badge would lose this meaning.

## Whole-app translation

| Page | Adopted composition | Source IDs | Transition to preserve | Outstanding production work |
| --- | --- | --- | --- | --- |
| Identity | Small profile; text preferences; independent source reads | 0063 | Edit preferences → Settings; project context → Projects | Native packaged visual acceptance; no 3D returns |
| Today | Now, one next action, recent work; 320px project detail | 0060, 1079, 1094 | Project → session → record → context → Clio | Real state adapters and persistent draft/session continuation |
| Projects | Searchable list, selected row, readiness detail | 0062, 1086, 1098 | Resolve setup → return to original action | Repository proof, role boundaries and return destination wired |
| Work records | Keyboard-selectable ledger and attributable detail | 0059, 1089, 1096 | Review record → source/proof → return to ledger | Source age, edits and proof failures across real data |
| Work context | Inbox, provenance, destination and consent | 0060, 0064, 1091 | Review → accept/dismiss → Today/Clio | Retention, destination and actual consent persistence |
| Clio | One dockable conversation; visible scope and action preview | 0064, 0065, 1079, 1096 | Keep selected project and draft across dock/expand | Real source/status separation and governed action completion |
| Co-working | Room purpose, people, media state, leave/restore | 0061, 1094 | Join → work → closeout → Today | Native media permission, compact casting and room lifecycle checks |
| Settings | Grouped forms and explicit save feedback | 0063, 0066–0068, 1097 | Deep link to specific setting → return to draft | Existing typed settings bridge and recovery states |
| Team | Role-scoped review queue, blocker and selected evidence | 0060, 0062, 1094 | Member/project drill-through → deliberate resolution | Authenticated permissions and actual proof queue |
| Sign in / Setup | Small welcome and one required step at a time | 0060, 0063 | Authorized entry → required setup → Today; skip optional | Progress retention and return destination on real session |

The reference does not supply a macOS permission, titlebar or media-control contract. Existing Electron main/preload policies and native acceptance remain authoritative. Mobile tabs and large touch cards do not replace the macOS sidebar and toolbar.

## Component consolidation before further page migration

Build on `src/renderer/components/PlexusUI.tsx`: `StatusChip`, `LedgerRail`, `InstrumentPanel`, `PageViewport`, `EmptyStatePanel`, `DegradedStatePanel`, `CommandDock`. The `exp-*` page studies are visual hypotheses; do not grow them into a competing production component system.

1. Separate source availability/age from work-state props. Keep explicit text and screen-reader descriptions.
2. Extend existing status primitives only where a real backend contract supplies the state. Add source-age presentation with per-source timestamps and no invented freshness threshold.
3. Consolidate list selection, detail width, source/proof rows and empty/degraded states into existing primitives.
4. Wire the daily journey first: project selection, active work, attributable record, context and Clio. Check draft restoration across every setup detour.
5. Migrate support and role-scoped pages, then run native packaged, live-authority and owner visual acceptance. ISC-329–332 remain open.

## Governance repair packet

These are bounded follow-ups, not changes performed in Cambium or Thoughtseed Labs by this pass.

| Priority | Owner surface | Repair | Acceptance |
| --- | --- | --- | --- |
| Before graph consumption | Upstream generation manifest + exporter | Remove self-edges using actual source parent evidence; reject unknown IDs, repeated canonical IDs, cycles and output collisions | Negative fixtures reject each defect; 140 records reconcile without self-blocking |
| Before completeness claim | Organizer | Discover numbered candidates; report unexpected files and undeclared hash duplicates; verify exclusion metadata | Extra file and undeclared duplicate fixtures fail with specific findings |
| Before taxonomy use | Source provenance | Document Hands/Build and Will/Ops adaptation sources; keep 1093 and 1100 distinct meanwhile | Every owner mapping cites a source decision beyond filename/shape |
| Documentation maintenance | Upstream package README | Refresh 81 selected, 16 generated, 43 held, 0 implemented from authoritative manifest | README agrees with current manifest |
| Before export freshness claim | Exporter review-board check | Compare destination with the current source board, not only its stored destination hash | Modified upstream board causes a stale-export failure |
| Before durable delivery | Cambium integration | Review the scoped source/library/script changes against unrelated WIP and current main | Isolated reviewed commit; originals and other work preserved |

## Evidence pointers

Source library: `/Volumes/madara/2026/Projects/thoughtseed/cambium/docs/assets/visual-flow/source-library/`.

- `SOURCE-ASSET-MAP.v1.json`, SHA-256 `2a684719531148d9423a03f3e415404ce960a16e311bf29ea063540a4cb22fd0`.
- `scripts/organize-visual-flow-source-library.mjs`: fixed list/classification at 73–131; bounded verification at 176–193.
- `scripts/export-organ-console-visual-flow.mjs`: derived blocker processing at 104–108; review-board checks at 247–264.
- Exported `docs/assets/visual-flow/organ-console/README.md:5–15` is current. `ASSET-MAP.v1.json:1761–1783` and `2074–2096` contain the self-blocking held usages.
- Upstream root: `/Volumes/madara/2026/Projects/thoughtseed/thoughtseed-labs/10-brand-essence/visual-identity-2026-08/product-families/organ-console-live-islands-2026-09/`. Its `README.md:28–36` is stale; `manifests/generation-manifest.v1.json:16–23` is the current count source, SHA-256 `a9960b13c68b4d8aab4bec2e1ee42db2270e988e24d391774dbfd402ff12fa17`.

Self-derived usage suffixes, all under `TSOC-FEAT-…-USAGE-V1`: EVIDENCE_SOCKET (2893), STREAM_CONTINUITY (3157), MULTI_CLOCK (3400), LISTENER_SENSOR (3657), RUN_RIVER (3906), PROVIDER_EVIDENCE (4132), IDENTITY_SEAM (4389), HELD_GATE (4640), RECEIPT_STRATA (4866), WORK_SHORELINE (5123), TYPED_HANDOFF (5369), RESPONSIVE_COMPRESSION (5619). Parenthesized values are source-manifest line pointers.
