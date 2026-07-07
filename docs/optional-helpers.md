# Optional Helpers

Fabric and Paperclip are optional helper surfaces for Plexus. They can accelerate local diagnostics, task updates, and advanced workspace support, but they are not required for Clio, Identity, Focus, Projects, Work Records, or Co-working.

## Product rule

If a helper is unavailable, Plexus should keep the core workflow usable and explain the state as optional.

Preferred states:

- `optional` — no helper configured and no action required
- `available` — at least one helper is healthy
- `paused` — user has disabled helper enrichment
- `attention` — a helper action failed or needs review

Avoid using helper failures to mark the whole Identity page, Clio runtime, or daily work flow as blocked.

## Evidence and setup

Work proof can still require project/repo evidence where the record itself depends on proof. That is separate from helper availability. Optional helpers may make evidence workflows faster, but missing helpers should never lower Clio identity readiness.

## Copy examples

Use:

- "Clio remains available without Fabric or Paperclip helper agents."
- "Optional helpers offline."
- "Use Paperclip enrichment when available."
- "Helper enrichment is paused; Clio remains available."

Avoid:

- "Fabric Command"
- "Paperclip companions"
- "Helper locked"
- "Local helpers blocked" for passive/unconfigured states
