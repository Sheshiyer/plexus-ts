# Source gaps surfaced by the documentation review

Reviewed 2026-09-05. These are follow-up candidates, not newly accepted features
or an automatically executable wave. P6 migration remains the active phase.
These findings are mapped into the [P6–P12 GitHub roadmap](GITHUB_ROADMAP.md),
owner-repository work packages and pending ISA criteria.
Detailed source boundaries are in the [runtime map](../docs/architecture/RUNTIME_MAP.md).

| Finding | Next bounded work | Acceptance needed |
| --- | --- | --- |
| Meeting closeout copy promises Hermes/Telegram; inspected sibling handler only queues a compatibility payload | Reconcile canonical/deployed Worker revision, then delivery contract and UI wording | Actual destination receipt or accurately limited queue status |
| `daily.sendEvent` executor exists while catalog reports `declared_only` | Reconcile capability registration and executor availability | Catalog/intent behavior agrees with executable path |
| Preload recording methods lack corresponding main handlers | Decide whether to remove unavailable API exposure or implement the proposed path | Sender validation, consent, storage and end-to-end recording proof |
| Client SDP scaffolding exists; inspected Worker track route lacks provider negotiation | Continue issue #26 after reconciling canonical server source | Two-client SFU transport and privacy acceptance |
| Identity source copy still refers to optional helpers | Review surviving compatibility copy in the employee flow | Rendered wording agrees with retired-helper operating policy |

The sibling Worker directory has no verified Git/deployed revision. Its source
findings must not be presented as confirmed live defects. Documentation is now
explicit about these limitations; no implementation gap was fixed by this pass.
