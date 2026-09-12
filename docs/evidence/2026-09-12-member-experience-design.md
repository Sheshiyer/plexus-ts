# Member experience design evidence

12 September 2026 · source baseline `cf8b71c` · package `0.7.12` · isolated
branch `codex/plexus-experience-design-20260912`.

This receipt records a local design and focused verification pass. It separates
source, browser specimen, packaged-native, live-service, and owner-approval
evidence. The concurrent local-installation receipt `83911f9` has no application
source, package, or test difference from the stated baseline.

The visual and interaction contract is [DESIGN.md](../../DESIGN.md). The full
route inventory and remaining build sequence are in the
[experience audit](../design/2026-09-12-experience-audit.md); local capability
selection is in the [capability matrix](../design/2026-09-12-capability-matrix.md).

## Implemented source candidate

Wave 1 now supplies a compact factual Identity and shared member-workspace
foundation:

- Identity uses actual preference and project data, with unavailable and
  cached-refresh states labelled as such. It has a primary deep link to
  preferences rather than an invented personality display.
- The character viewer, legacy score module, Three.js dependencies, and the
  12,821,280-byte GLB payload were removed. This removes the test character;
  it does not prove profile or connected-service availability.
- Today is now the default for both member and admin sessions. Existing explicit setup links and
  role guards are retained rather than inferred from a visual route.
- Shared navigation and CSS use compact macOS-oriented surfaces, system fonts,
  and light-mode contrast. Main/preload are outside this UI lane and were not
  changed: the bounded diff of `src/main`, `src/preload` and `src/shared` is empty.

## Member workspace flow — current implementation

Wave 2 now has a narrow source implementation inside the existing renderer:

- A selected project is held as a renderer-session convenience and is visible in
  the workspace trail. It crosses the existing Projects → Today and Work
  records → Projects paths without adding IPC, a provider call, or a role grant.
- Projects has a searchable work list and one selected-project inspector. Only
  a project with existing verified repository proof exposes **Open in Today**;
  administrator-only repository binding remains unchanged.
- Work records has a selected-record inspector for its existing time window,
  project, source and proof values. Opening the project and deleting a record
  remain explicit controls; selecting a record makes no write.
- The compact Clio composition can display the selected project as a local UI
  label. It does not receive that value as assistant context, source freshness,
  or authorization.

`PLEXUS_CAPTURE_MEMBER_WORKSPACE_ONLY=1` ran five temporary browser-fixture
captures against mocked existing renderer IPC: wide Projects list/detail, the
explicit verified Projects → Today handoff, wide Work records list/detail,
Projects with side chat, and the compact Work records inspector. The fixture
checks selectors, text, horizontal overflow, keyboard reachability where a
control is present, and the selected-project handoff. Its artifacts are local
temporary review evidence; they do not prove the native package, a live
workspace, provider state, or owner acceptance.

## Development board and local observations

`http://127.0.0.1:5188/design-review.html` is development-only. It renders the
real Identity component with an illustrative bridge and ten proposed page studies.
It is neither implementation of the remaining pages nor signed, installed, live,
or authenticated acceptance. Study actions are local illustrations and do not
write application data.

Parent IAB observations in this session found:

| Surface / condition | Observed result | Evidence boundary |
| --- | --- | --- |
| Identity, dark normal and narrow | Normal content measured 861.86 × 399.43px; no horizontal overflow and no canvas. | Browser specimen only. |
| Identity, light mode | Readable light treatment rendered. | Browser specimen only. |
| Successful empty | Count rendered as `0`. | Focused visual state. |
| Offline | State rendered as `Unavailable`. | Focused visual state. |
| Cached refresh | Labelled preferences remained during refresh. | Focused visual state. |
| Long name at 370px content | No horizontal overflow. | One narrow-width observation. |
| Ten study routes at 960px / 420px configured widths | No horizontal overflow; wide content was 854–862px and narrow content 370px. | Development board only. |
| Projects | Search/filter and selection responded locally. | Does not certify project authority. |
| Settings study | Edit plus Save specimen draft showed saved status. | Local specimen draft, not settings persistence. |
| Setup study | Optional preference could be skipped before Today. | Design-journey navigation only. |
| Work records study | Tab + Return selected Cambium source audit, updated the inspector, and Review changed to Clear review. | Keyboard/local React state only. |
| Project continuity | Cambium source audit selection carried into Today and Clio; the study marked setup for review and disabled resume for that sample. | Illustrative cross-page context. |
| Clio preview | Review proposed action opened the illustrative action preview. | No model call or message delivery. |

Development hot reload initially reported duplicate React roots; the review entry now disposes its root on module replacement. A fresh final reload showed no new console errors or warnings.

No screenshots were saved. These are in-session browser observations, not reusable
visual artifacts or proof of installed-app behavior.

Start the board with `npm run review:design` in this worktree if the loopback server is not running.

## Focused validation completed

| Check | Result | Scope |
| --- | --- | --- |
| `npm run typecheck` | Pass | TypeScript source. |
| Identity tests | 10/10 pass | Identity behavior/copy coverage. |
| Renderer tests | 66/66 pass | Focused renderer suite, including member-workspace flow coverage. |
| ESLint | 0 errors; 7 pre-existing Co-working warnings | Full source lint after the renderer changes. |
| Member workspace browser fixture | Pass | Five mocked-IPC captures cover wide and compact list-detail layouts plus the verified Projects → Today handoff. |
| Renderer build | Pass | Bundle emits 516.10kB raw / 149.13kB gzip. |
| Main and preload builds | Pass | Existing native and bridge compilation still succeed without source changes in those layers. |
| Contrast calculation | Pass | Readable t1/t2/t3 tokens exceed 4.5:1 on all base surfaces in both themes. |
| Documentation verification | Pass | 197 classified documents; ISA count 360/416; no link errors. |
| Fresh review reload | Pass | No new browser errors or warnings after final reload. |

The renderer build retains Vite's default 500kB raw-chunk warning. The checks are
focused and are not a full release gate.

## Review and model provenance

An independent QATester source review identified loading, missing-value,
cached-refresh, and navigation issues; those source findings were fixed. That
agent did not have isolated-IAB access, so the browser observations above were
performed by the parent session.

Terra low completed the independent audits, implementation lanes, 18-skill matrix,
and studies. A Codex 5.3 Spark OmniRoute source scan ended with HTTP 429 / exit 1
before a final report and is not accepted as a completed audit.

## Remaining work and acceptance boundaries

Wave 2 still needs its deeper Today composition and draft-preserving repository
resolution. Waves 3–5 remain: context and collaboration; settings/setup/team
integration; then keyboard, menu, focus, light/dark, reduced-motion,
window/companion, packaged macOS, authenticated member/admin and degraded-journey
acceptance. The board keyboard/context checks above are complete; production and
packaged-app journeys remain open.

No package installation, publish, merge, deployment, runtime/provider readiness,
or signed/native/live acceptance is evidenced by this document. The design pass
does not claim 100% completion.
