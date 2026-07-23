# Batch 15 Proof Cockpit Signal Evidence

Captured: 2026-07-10

Scope:

- `P4-W1-T005`: active-room signal shows open rooms, live calls, participants, screen shares, and idle room count.
- `P4-W1-T006`: reports-today signal shows submitted, queued, failed, and missing daily proof packet state.
- `P4-W1-T007`: bridge/Fabric/Hermes signal shows connected, degraded, manual, and offline-ready source health.
- `P4-W1-T008`: release/CI/ops signal shows green/red/unknown release gate state with timestamp and source.

Files:

- `desktop.png` - 1536x1024 renderer capture.
- `compact.png` - 1280x800 renderer capture.
- `capture.json` - capture URL, viewport list, and asserted text markers.

Method:

- Vite renderer served locally at `http://127.0.0.1:5180/?splash=0&tab=admin`.
- Chrome DevTools Protocol injected a mocked preload contract before app boot.
- The probe asserted `Founder proof cockpit`, `Room health`, `Daily proof packets`, `Bridge/Fabric/Hermes`, and `Release gate` were present before screenshots were written.

Boundary:

- This is deterministic renderer proof with mocked preload data. It is not live CI, OTA, bridge, Paperclip, Hermes, or release-channel proof.
