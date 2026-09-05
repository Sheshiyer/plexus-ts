# Clio identity

Current source/copy contract reviewed 2026-09-05 for Plexus v0.7.12. Clio is the
front-facing assistant in Plexus. Identity describes member-provided preferences,
consent-based memory and work-evidence posture; it does not grant infrastructure
or GitHub authority. See [documentation map](DOCUMENTATION_MAP.md).

## Identity layers

1. **Clio identity** — the assistant's visible name and the member's profile.
2. **Local memory** — consent-gated local agent-session context. Clio can remain
   available when collection is disabled.
3. **Work proof** — GitHub-backed project bindings and evidence. This improves
   reporting context; authorization still comes from the Worker and numeric
   GitHub identities, never a displayed profile label.
4. **Member bridge/reporting context** — scoped reporting status for Hermes;
   a connected bridge or queued task is not a delivered founder/Telegram report.

`src/renderer/identityLoadout.ts` produces `primaryLayer`, `memoryLayer` and
`proofLayer`; `IdentityPanel.tsx` composes the view. It also derives illustrative
stats from preferences, cached evidence and bridge status. Those UI scores are
not measured productivity, employee performance, biorhythm or security posture.

## Current language

Use **Clio**, **Clio identity**, **Clio Memories**, **local memory** and concrete
connected/queued/error descriptions backed by the relevant source. Normal model
selection is a governed OmniRoute lane; provider keys are not employee identity
fields. See [assistant runtime](ASSISTANT_RUNTIME_CONTRACT.md).

Paperclip and the local agent Fabric runtime were retired in v0.7.9. Do not
present them as installable optional companions or as a condition for unlocking
Clio. `ThoughtseedFabricTask` and related historical field names are compatibility
records, not a runtime helper service.

One remaining `IdentityPanel.tsx` explanatory string mentions "optional helper
context". It should be reconciled in a product-copy change with its real inputs;
this docs pass does not imply that a helper layer still exists in the scaffold.
The v0.5.0 Clio-first terminology decision remains historical provenance, not the
current application version.
