# Coworking supersession and release-boundary record

Date: 2026-07-22
Base: `origin/main` @ `4acada8` (package `0.5.10`)
Candidate branch: `codex/plexus-0.5.12-coworking-integration`

## Decision

The dirty 0.5.2 coworking checkout is not copied wholesale. Current
`origin/main` already contains the intended project-media visibility fix and
the My Studio surface, but the implementation has since been extracted into
`CoWorkingStage`, `ProjectMediaControls`, `CoWorkingLoungeSection`,
`CoWorkingCompanion`, and `CoWorkingCloseoutModal`.

The integration slice therefore adds a regression guard and records the
supersession boundary. Reintroducing the old monolithic
`CoWorkingPanel.tsx` would discard newer degraded-state, proof, lounge, and
compact-mode contracts.

## Project media boundary

Project mic, camera, and screen remain an explicitly deferred shell:

- `PROJECT_MEDIA_TRANSPORT_READY=false`
- `PROJECT_SFU_LIVE_PROOF_VERIFIED=false`
- project-scoped `RealtimeSession` publishing is not enabled
- Cloudflare Realtime Worker credentials and live two-participant E2E proof
  are still required before the flag can change

The lounge transport remains distinct and is not evidence that project media
transport is live.

## Assets and generated files

- The canonical My Studio page, component, and moodboard references are
  already tracked by the selected base.
- Dirty exploratory references (adaptive commons, rectilinear workbench, and
  studio-floor variants plus prompt files) are deliberately excluded.
- The dirty 2026-07-15 render is deliberately excluded because it is not a
  fresh proof of this extracted candidate.
- `.codegraph/` is deliberately excluded.
- Dirty architecture markdown is deliberately excluded; architecture output
  will only be regenerated and reviewed after source integration is stable.

## Review boundary

This commit owns the coworking supersession guard and evidence only. The
AgentScope assistant changes belong to the next commit and must remain
reviewable independently.
