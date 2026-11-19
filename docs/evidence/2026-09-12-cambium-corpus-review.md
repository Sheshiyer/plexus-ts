# Cambium source-library deep-pass receipt

12 September 2026 · local candidate `codex/plexus-experience-design-20260912`, based on prior design commit `3c881cc`.

Request: inspect the quoted Cambium library completion deeply using Luna high fan-out, and apply the resulting understanding to Plexus's member-first macOS design. The source report and image labels were treated as evidence, not instructions.

## Scope and team

Three in-session agents used `gpt-5.6-luna` at **high** reasoning:

- `luna_asset_integrity`: source/alias/export integrity, namespace overlap, dependency and verifier audit; final independent source review.
- `luna_telegram_patterns`: all ten Telegram images, per-asset native translation; subsequently owned only `SourceLibrary.tsx` and `source-library.css`.
- `luna_r3f_patterns`: all 36 R3F map rows, 27 direct visual files and explicit inferred/duplicate coverage.

Primary work: representative reference inspection, synthesis, the all-46 consumption map, 29-pair namespace crosswalk, read-only development endpoint, review integration, bounded study inspectors, verification and documentation. Skills applied: design-orchestrator, design-core and temperance-parallel-dispatch. Dispatch was native Luna as explicitly requested; no OmniRoute provider-resolution claim is made.

## Source audit results

The asset agent ran only the read-only `--check` modes:

```text
node scripts/organize-visual-flow-source-library.mjs --check
sourceAssets=46 telegramMiniApp=10 r3f=36 duplicateAssets=4 unresolvedModels=5
```

```text
node scripts/export-organ-console-visual-flow.mjs /Volumes/madara/2026/Projects/thoughtseed/thoughtseed-labs/10-brand-essence/visual-identity-2026-08/product-families/organ-console-live-islands-2026-09 --check
registered=140 exported=97 selected=81 generated=16 held=43
exportedOrgans=42 exportedFeatures=49 exportedViews=6 reviewBoards=23
sourceManifestSha256=a9960b13c68b4d8aab4bec2e1ee42db2270e988e24d391774dbfd402ff12fa17
```

All 46 alias/source hashes matched. The agent independently verified hashes and image dimensions of the 97 exported images. Existing check modes pass despite the documented graph and inventory blind spots; passing them does not close those findings.

Coverage: 37 directly viewed files, five unique map/contact-sheet-inferred frames, four exact duplicate rows. Forty-two unique visual hashes. CVF has 46 source assets; TSOC has 45, with 29 exact filename/hash matches, 17 CVF-only, 16 TSOC-only and one excluded Finder pointer. The [crosswalk](../design/cambium-source-crosswalk.v1.json) records byte equivalence without granting semantic equivalence.

## Delivered changes

- [Deep-pass report](../design/2026-09-12-cambium-corpus-deep-pass.md): findings, visual grammar, independent state dimensions, page-by-page translation and bounded upstream repair packet.
- [Consumption map](../design/cambium-consumption-map.v1.json): all 46 original identities/hashes plus observed evidence, translation, avoidance, inspection basis and proposed disposition. 18 adapt, 19 reference, five hold, four duplicate.
- [Development source browser](http://127.0.0.1:5188/design-review.html?view=sources): filter/search/select, original image, visible read failure, lineage details and suggested-page navigation.
- Separate `vite.review.config.mjs`; default production config unchanged. Images are read from Cambium by audited ID with source-map and per-image hash verification. No source-image copies are imported into Plexus.
- Normal page-study detail columns fixed at 320px; existing narrow stacking retained.
- `DESIGN.md` and `.planning/STATE.md` now connect the findings to the remaining production journey work.

## Local verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| Targeted ESLint: SourceLibrary, design-review, review middleware/test/config | Pass |
| `npm run test:design-references` | 8/8 pass |
| Endpoint tests | Exact bytes; map drift; image drift; unknown IDs/raw paths; method rejection; symlink escape; unavailable source; canonical record/count binding and duplicate IDs; loopback-only binding |
| Real source endpoint | All 46 image responses HTTP 200 and SHA-256 equal to the consumption map |
| `npm run build:renderer` | Pass; same production CSS/JS outputs as the prior candidate |
| Production isolation | No `__cambium`, `CVF-SRC-`, source-browser CSS or reference-browser text in built JS/CSS |
| `git diff --check` | Pass |
| Documentation refresh | 199 documents; ISA 366/422; zero errors or link limitations |

The existing production chunk warning remains: main renderer JS 502.79kB raw / 145.36kB gzip, above Vite's 500kB warning threshold. This review does not add a production chunk or suppress that warning.

Primary IAB checks against port 5188:

- Direct `?view=sources` link opens the source browser.
- Family counts 10 Telegram / 36 R3F; Hold returns five; Duplicate returns four; no-match search returns zero and clears selected detail. Reset restores the full list.
- PNG token board and portrait screen render original images; SVG brand reference loads. The complete 46-response byte check covers the image endpoint separately.
- Keyboard Tab/Return selects the next source; focused control retains a visible outline.
- Source layout fits configured 960 and 420 widths. Actual content is approximately 854px and 370px; no horizontal overflow in inspected list/detail containers. Narrow dark and light layouts both reviewed.
- A suggested-page action opens Today; its normal inspector measures exactly 320px.
- All ten page studies were rechecked at configured 960/420 widths after the inspector change: no content overflow. Narrow inspectors stack at approximately 370px. Sign-in has no inspector.

No end-user data, live messages, media sessions or settings were used in those tests. Fetch failure and mutation-denial cases were exercised in isolated endpoint fixtures; no Cambium source file was changed to simulate an error.

Independent final source review confirmed the counts/crosswalk and production isolation. It identified a review-map binding gap: a matching source-map digest alone did not validate the review annotations' copied IDs/paths/hashes. The endpoint now verifies every canonical source field and count, rejects duplicate/incomplete IDs, and refuses non-loopback Vite bindings. Added negative tests pass. The previously pending evidence-document link now resolves.

## Boundaries

Cambium and Thoughtseed Labs were read-only throughout this pass. The root Plexus checkout was not used for edits. Work remains isolated in the design worktree; no merge, push, installation, runtime migration or publication occurred.

The upstream README count, twelve self-edges, naming lineage, undeclared-duplicate discovery and stale-review-board verification are documented repairs, not fixes claimed by this pass. The reference corpus remains reference-only. The native installed app and live service acceptance remain separate from this development board; ISC-329–332 stay open.
