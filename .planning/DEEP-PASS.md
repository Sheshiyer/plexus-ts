# Deep Pass — Plexus Operational Infrastructure

## Context

Plexus-ts is the identity layer in the Cambium ecosystem. The product is mature
(299/327 ISCs, 48/50 GH issues closed) but the operational infrastructure that
connects it to the Temperance/GSD pipeline was never wired.

## Macro Map

```
Cambium (compile/admit)
  └─ Plexus (identity gate) ← THIS PROJECT
       └─ Temperance Engine (classify: Native | Algorithm)
            ├─ Speculum (reflection) ← NOT REGISTERED
            ├─ GSD (.planning phases) ← BOOTSTRAP ONLY, 0%
            └─ plan-issue-sync ← NOT TARGETING plexus-ts
                 └─ GitHub Issues ← 2 open, no project board
                      └─ OmniRoute (te-* lane → seat)
                           ├─ Superset (Hands)
                           └─ Hermes (Phloem)
```

## Deep Layers

### Layer 1: Speculum Registration

The speculum (`~/.claude/MEMORY/STATE/speculum-mini.txt`) tracks project state
for the Temperance runtime. Currently only `wtfmedia` is registered. Plexus-ts
must be added so `temperance-next-wave`, dispatch, and reconcile can see it.

Format: `<path>|<status>|<label>|<heartbeat>|<url>|<issues_open>|<current_phase>|<gsd_pct>|<isa_pct>`

### Layer 2: GSD Phase Bootstrap

`.planning/STATE.md` says "bootstrap, 0%" but the ISA has 299/327 ISCs done.
The disconnect: ISA was built outside GSD. Fix: create GSD phases that reflect
the actual remaining work (28 open ISCs + 2 open GH issues + realtime workspace
phase 14 wave 3).

### Layer 3: GitHub Project Board

13 project boards exist; none for plexus. Create one to track the remaining
work as a proper roadmap, linked to the 2 open issues and the ISA gaps.

### Layer 4: Plan-Issue-Sync

`plan-issue-sync.ts` targets `Sheshiyer/thoughtseed-vault`. It needs to also
target `Sheshiyer/plexus-ts` for plexus-specific planning docs, or the existing
vault-targeting needs to cover plexus planning docs that live under the vault.

### Layer 5: ISA ↔ GSD Reconciliation

The ISA has 28 unchecked ISCs. These need to be mapped to GSD phases so the
next-wave orchestrator can dispatch them. The 2 open GH issues (RW-011, RW-014)
are both `phase:p14, wave:w3` — they belong to the realtime workspace epic.

## Remaining Open Work (from ISA + GH)

| ID | Work | Source | Phase |
|---|---|---|---|
| RW-014 | Wire Cloudflare Realtime SFU | GH issue | p14/w3 |
| RW-011 | Privacy/permission/audit hardening | GH issue | p14/w3 |
| ISC gaps | 28 unchecked ISCs in ISA.md | ISA | mixed |

## Anti-Collapse Rules

- Do not put Hermes agent runs into Superset tabs
- Do not put portfolio Hands coding onto Phloem
- Speculum registration is a config write, not a code change
- GSD phases derive from ISA evidence, not from猜测
- GitHub Project board is an organizational surface, not execution
