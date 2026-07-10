# P3-W3 Today Founder Update Evidence

Captured: 2026-07-10

## Scope

- `P3-W2-T018`: Today exposes a prepare-founder-update path that routes to the Assistant with `daily.sendEvent` metadata.
- `P3-W3-T023`: Today screenshot at 1536x1024.
- `P3-W3-T024`: Today screenshot at 1040x700.

## Captures

- `desktop.png` - 1536x1024 first viewport with proof banner, hero command cards, proof ledger, founder update suggestion rail, and daily proof packet action.
- `compact.png` - 1040x700 first viewport with the same Today command center compressed into the compact layout.
- `capture.json` - local capture metadata from the reproducible Chrome DevTools harness.

## Method

- Ran `node scripts/capture-today-command-center.mjs`.
- The script starts the local Vite renderer, injects a mocked `window.plexus` preload contract before React boots, asserts `Prepare founder update` and `Daily command center` are visible, and captures both viewports through headless Google Chrome.

## Boundary

- This is deterministic renderer proof with mocked local data.
- It is not packaged Electron proof, live bridge proof, OTA proof, or a production-ready tag claim.
