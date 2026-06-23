# Plexus 0.4.1 Local Preview

Date: 2026-06-23

## Package

- Launched packaged app from `release/mac-arm64/Plexus.app`.
- Local app card shows `Clio v0.4.1`.
- Update metadata was generated at `release/latest-mac.yml` with `version: 0.4.1`.

## Gates

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build:preload` passed.
- `npm exec vite -- build` passed.
- `npm run smoke:thoughtseed-bridge` passed.
- `npm run release:dry-run` passed with `SKIP_NOTARIZATION=true` and `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- Active source vocabulary scan found no `TeamForge`, `MultiCA`, `Admin Demo`, demo-safe, placeholder, or fake-data copy in `src`.
- Release placeholder scan passed across `src`, `README.md`, `package.json`, and `docs` excluding prior evidence.
- `git diff --check` passed.

## Preview Captures

- `01-packaged-current-window.png` — packaged app shell, Work Records, `v0.4.1`.
- `02-fabric-window.png` — Agent Fabric health plus Hermes Tasks assignment panel.
- `03-settings-window.png` — Settings account/profile view.
- `04-admin-window.png` — Admin Workspace with workspace overview copy.
- `05-projects-window.png` — Projects screen with repo verification states.
- `06-coworking-window.png` — Co-working surface fails closed behind Cloudflare Access.

## Notes

- No git stashes were present during review.
- Local preview is an authenticated/offline-cache preview; it does not prove live Cloudflare Access or hosted OTA update delivery.
- The renderer build still emits a non-blocking parent `astro/tsconfigs/strict` warning before completing successfully.
- OTA push was not performed in this pass.
