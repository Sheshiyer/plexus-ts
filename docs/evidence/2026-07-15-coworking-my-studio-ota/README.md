# Co-working My Studio OTA evidence

Captured from the v0.5.6 integration worktree after PR #107 merged to `main`.

- `standard-1536.png` — curated from harness output `desktop-1536.png`; My Studio with truthful telemetry, one primary focus bench, rectangular team benches, a focused screen wall, and the ambient lounge as a secondary strip.
- `compact-384.png` — curated from harness output `companion-384.png`; the reviewed PR #107 compact casting companion with participant context, timer state, explicit controls, leave, and expand.

The capture harness passed marker, horizontal-overflow, critical-overlap, compact-call-ledger, and viewport checks. The standard and compact surfaces share one controller and remote-audio layer; neither capture implies a second session, automatic media capture, movement system, or fabricated biorhythm value.

Reproduce from the repository root:

```bash
PLEXUS_COWORKING_STAGE_EVIDENCE_DIR=/tmp/plexus-my-studio-proof \
PLEXUS_SCREENSHOT_PORT=5192 \
PLEXUS_CHROME_DEBUG_PORT=9342 \
node scripts/capture-coworking-stage.mjs
```

The command produces the full eight-image matrix and `capture.json` under `/tmp/plexus-my-studio-proof`; this repository folder intentionally retains only the two release-relevant curated images above.
