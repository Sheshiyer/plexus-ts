# Batch 12 Proof Cockpit Screenshot Evidence

Captured: 2026-07-10

Scope:

- Founder/admin launch path opens the proof cockpit by default.
- Proof cockpit shows the six signal domains: tasks/evidence, active rooms, blockers, reports today, bridge health, and release health.
- Task/evidence signal shows assigned, active, blocked, done, verified, weak, and missing-proof counts.

Files:

- `desktop.png` - 1536x1024 renderer capture.
- `compact.png` - 1280x800 renderer capture.

Method:

- Vite renderer served locally at `http://127.0.0.1:5177/?splash=0`.
- Playwright injected a mocked preload contract before app boot.
- The probe asserted the active admin subtab was Proof Cockpit, all six signal labels were present, weak-proof copy was visible, and the degraded admin overview banner was absent.

Boundary:

- This is deterministic renderer proof with mocked preload data. It is not live CI, OTA, bridge, or release-channel proof.
