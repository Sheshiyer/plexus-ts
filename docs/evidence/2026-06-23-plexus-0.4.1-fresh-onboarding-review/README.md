# Plexus 0.4.1 Fresh Onboarding Review

Date: 2026-06-23

## Fixes

- Added a persistent `Logout` action to the authenticated top HUD.
- Updated the Settings account sign-out action to say `Log out` and include the logout icon.
- Changed the Thoughtseed Bridge Settings card to a full-width stacked layout so the status copy no longer collapses into one-word lines.
- Disabled OTA actions for unsigned local macOS preview packages, preventing ShipIt signature validation failures from dry-run builds.
- Rebuilt the packaged app after the UI changes.

## Cache Reset

- Moved Electron user data to `/Users/sheshnarayaniyer/Library/Application Support/plexus-ts.backup-20260623-052522`.
- Moved Plexus SQLite state to `/Users/sheshnarayaniyer/.plexus.backup-20260623-052652`.
- No matching Plexus cache directory was found under `~/Library/Caches`.

## Verification

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm exec vite -- build` passed.
- `npm run build:main` passed.
- `npm run build:preload` passed.
- `npm run smoke:thoughtseed-bridge` passed.
- `npm run release:dry-run` passed and regenerated `release/latest-mac.yml`.
- Active source vocabulary scan passed.
- `git diff --check` passed for the edited Settings/logout files.
- Live feed check confirmed `https://plexus-upgrade.thoughtseed.space/plexus/latest-mac.yml` still serves `0.4.0`, so the unsigned local `0.4.1` was not uploaded.
- Local `release/mac-arm64/Plexus.app` is ad-hoc signed by design for dry-run preview; Settings now reports OTA state `disabled` instead of attempting ShipIt.

## Fresh Review Captures

- `02-reset-first-screen.png` — first launch after clearing both app data and `.plexus` state.
- `03-login-entry.png` — unauthenticated Plexus sign-in screen.
- `04-access-login.png` — Cloudflare Access OTP screen.
- `05-post-login-current.png` — authenticated app after the user completed Cloudflare Access; top HUD shows `Logout`.
- `06-settings-after-login.png` — authenticated Settings page with the new top-HUD logout control still available.
- `07-settings-pageup.png` — fresh authenticated onboarding setup block showing completed required steps and skipped optional Paperclip setup.
- `08-settings-bridge.png` — fixed Thoughtseed Bridge settings layout; copy, specs, invite input, and actions render horizontally instead of collapsing into a narrow column.
- `09-ota-disabled-unsigned-local.png` — unsigned local preview after the updater guard; release feed is disabled until a signed package is installed.

## Boundary

Cloudflare Access was completed manually by the logged-in user. The authenticated pass reached the Settings onboarding setup area and the Thoughtseed Bridge card. Bridge credentials are intentionally reset by the cache clear, so the live bridge state is `closed` until a member invite token is redeemed again.
