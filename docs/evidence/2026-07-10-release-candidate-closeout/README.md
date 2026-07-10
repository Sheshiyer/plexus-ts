# Release Candidate Closeout Evidence

Date: 2026-07-10
Roadmap slice: P9 integration and closeout
Recommendation state: go-with-degraded-live-proof

This packet is the closeout index for the #41-#50 production-readiness push. It does not recapture every screenshot. It ties the final UAT tasks to the deterministic evidence produced in the previous execution batches and names the live-proof gaps that must stay outside a full production-ready claim.

## Golden Path

Employee opens Plexus -> Clio Today shows the command center -> employee can continue task/room work -> Clio prepares a confirmed proof action -> Temperance dispatch has a traceable handoff packet -> co-working can produce manual/degraded proof closeout -> founder/operator proof cockpit sees release, evidence, room, bridge, and blocker state.

## P9 UAT Matrix

| Task | Status | Evidence |
|---|---|---|
| `P9-W1-T001` | Covered by indexed UAT matrix. | This README plus `docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix/capture.json`. |
| `P9-W1-T002` | Deterministic local visual proof. | Today matrix and proof cockpit matrix cover employee/founder launch surfaces. |
| `P9-W1-T003` | Deterministic local proof. | Assistant matrix covers full panel, sidechat, confirm modal, and context drawer. |
| `P9-W1-T004` | Degraded/local proof only. | `docs/evidence/2026-07-10-batch27-dispatch-runtime-proof/README.md` covers correlation IDs, redacted support packet, and local dispatch smoke. External Cambium/Hermes execution is not claimed. |
| `P9-W1-T005` | Manual/degraded proof only. | `docs/evidence/2026-07-10-batch23-coworking-contract-closeout/README.md` and Batch 30 co-working screenshots cover proof closeout and SFU degraded states. |
| `P9-W1-T006` | Deterministic local gate. | `npm run verify:all`, PR CI, and post-merge main CI are required before production-readiness language. |

## Documentation Matrix

| Task | Status | Evidence |
|---|---|---|
| `P9-W2-T007` | Updated. | `docs/ROADMAP.md` points to this closeout packet and the deferred register. |
| `P9-W2-T008` | Updated by reference. | `docs/architecture/SERVICES.md` remains the service inventory; root worktree architecture edits are preserved outside this batch. |
| `P9-W2-T009` | Updated. | `docs/RELEASE_EVIDENCE.md` and `docs/OTA_RELEASE.md` include the release-candidate closeout verifier. |
| `P9-W2-T010` | Updated. | `docs/HANDOFF.md` points fresh sessions to this closeout packet, deferred register, and recommendation. |
| `P9-W2-T011` | Added. | This release-candidate evidence README is the index. |
| `P9-W2-T012` | Added. | `docs/DEFERRED_REGISTER.md` names #22, #23, #24, #25, #26, signed OTA, live Paperclip, SFU, and Cloudflare Access proof boundaries. |

## GitHub Sync Matrix

| Task | Status | Evidence |
|---|---|---|
| `P9-W3-T013` | Ready for final #49 sync after merge. | Final sync comment should link this packet, PR, CI, and recommendation. |
| `P9-W3-T014` | Ready for #41-#50 sync after merge. | Each epic can get a concise selected closeout slice rather than the full matrix. |
| `P9-W3-T015` | Ready for label/status update after merge. | `status:verifying` should become done or blocked/deferred according to the final recommendation. |
| `P9-W3-T016` | Operator proof required after merge. | Final receipt must report root dirty files were preserved. |
| `P9-W3-T017` | Added. | `docs/RELEASE_CANDIDATE_RECOMMENDATION.md` says go-with-degraded-live-proof. |
| `P9-W3-T018` | Ready after merge and sync. | Close this durable plan loop only after CI and GitHub comments land. |

## Evidence Anchors

- `docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix/capture.json`: Today, proof cockpit, co-working, Clio assistant, and accessibility screenshot matrix.
- `docs/evidence/2026-07-10-batch29-design-system-visual-proof/README.md`: visual density and degraded-state foundation.
- `docs/evidence/2026-07-10-batch27-dispatch-runtime-proof/README.md`: local Temperance dispatch runtime proof.
- `docs/evidence/2026-07-10-batch23-coworking-contract-closeout/README.md`: co-working proof closeout and transcription deferral boundary.
- `docs/RELEASE_EVIDENCE.md`: binary production-ready gate.
- `docs/DEFERRED_REGISTER.md`: explicit deferred/live-proof register.
- `docs/RELEASE_CANDIDATE_RECOMMENDATION.md`: release candidate recommendation.

## Verification Commands

Run these on the release-candidate commit:

```bash
npm run verify:release-candidate
npm run verify:all
```

Remote verification still needs main CI on macOS, Ubuntu, and Windows for the merge commit. Signed OTA proof and live external proof stay deferred until the Release workflow and live smokes run.

