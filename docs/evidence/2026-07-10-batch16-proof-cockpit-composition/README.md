# Batch 16 Proof Cockpit Composition Evidence

Captured: 2026-07-10

Scope:

- `P4-W2-T009`: proof cockpit content appears before the admin utility switcher on the proof tab.
- `P4-W2-T010`: workspace coverage map shows verified project coverage and total visible projects.
- `P4-W2-T011`: project proof group rails list verified, needs-repo, inaccessible, and missing-proof groups.
- `P4-W2-T014`: persistent admin employee test-mode banner is visible and explicit.

Files:

- `desktop.png` - 1536x1024 renderer capture.
- `compact.png` - 1280x800 renderer capture.
- `narrow.png` - 1040x700 renderer capture.
- `capture.json` - capture URL, viewport list, and asserted text markers.

Method:

- Vite renderer served locally at `http://127.0.0.1:5180/?splash=0&tab=admin`.
- Chrome DevTools Protocol injected a mocked preload contract and seeded `plexus.adminEmployeeModeContext` before app boot.
- The probe asserted viewport-visible markers for `Founder proof cockpit`, `Admin employee test mode`, `Testing as Shesh`, `Project proof coverage`, `Coverage groups`, `Next founder actions`, and all four proof group labels before screenshots were written.

Boundary:

- This is deterministic renderer proof with mocked preload data and local storage. It is not live employee impersonation, live bridge, Paperclip, Hermes, CI, OTA, or release-channel proof.
