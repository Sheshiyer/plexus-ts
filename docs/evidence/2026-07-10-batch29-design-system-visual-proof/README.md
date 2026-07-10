# Batch29 Design-System Visual Proof

Captured on 2026-07-10T09:09:13.885Z with `npm run capture:design-system`.

## Coverage

- Today density: repeatable 1536x1024 and 1040x700 captures in `today/`.
- Proof cockpit density: 1536x1024 overview plus 1280x800 reports, export, diagnostics, and long-identity captures in `proof-cockpit/`.
- Co-working social floor: floor, stage, pinned fullscreen, live-boundary, compact, and closeout captures in `coworking-stage/`.
- Degraded co-working states: permission denied, SFU unavailable, rooms offline, and independent degraded-state captures in `coworking-degraded/`.
- Sidechat and breakpoint behavior is pinned by renderer contracts for 1280px, 1040px, and the `.px-shell.with-sidechat` / `.px-main.sidechat-open` layout guards.

## Variant Contract

- Empty states: no records, no rooms, no backups, and no tasks.
- Degraded states: offline, sync failed, repo missing, and proof inaccessible.
- Rose tone remains reserved for true failure, denial, inaccessible proof, or destructive confirmation; missing repo and offline states use warning/idle treatment.

See `capture.json` for command outputs, generated files, viewport coverage, and state coverage.
