# Clio Identity

Clio is the front-facing assistant identity in Plexus. The Identity page describes the operator, the local memory posture, work proof posture, and optional helper posture that Clio can use when responding.

## Identity layers

1. **Clio identity** — the visible assistant layer and the user's operator profile.
2. **Local memory** — consent-based local agent session summaries. Clio works without this, but memory improves continuity when enabled.
3. **Work proof** — GitHub-backed evidence and project links. Proof improves record quality and reporting confidence; it does not gate Clio availability.
4. **Optional helpers** — Fabric and Paperclip helper agents. They can enrich context or automate advanced support workflows, but Clio remains available when they are offline, paused, or not configured.

## Release posture

Plexus 0.5.0 uses Clio-first language across the shell, Identity, Settings, and local memory surfaces. User-facing copy should avoid presenting helper infrastructure as a locked capability, required gate, or identity constraint.

Use:

- "Clio"
- "Clio identity"
- "Clio Memories"
- "Optional local helpers"
- "local memory"

Avoid:

- "Fabric Command"
- "locked/unlocked" helper states
- "Paperclip companions" as a primary identity label
- "blocked" for optional helper setup unless a user explicitly invoked a helper action and that action failed
