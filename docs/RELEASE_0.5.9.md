# Plexus v0.5.9

Plexus v0.5.9 is a macOS arm64 patch release for the Clio Today timer, menu-bar lifecycle, shutdown safety, and GitHub repository selection reporting.

## What changed

- The sidebar `TODAY` total now includes the active focus session, so it advances with the main Clio Today timer and freezes, resumes, or clears through the same authoritative state.
- The macOS menu-bar item remains available when the last Plexus window closes. Its Open, Show, Hide, Resume, Stop, and Quit actions use the canonical main-process lifecycle.
- Application shutdown now drains admitted timer/database work, rejects late mutations, and waits for the tracked SQLite handle to close before Electron teardown.
- GitHub connection status now distinguishes `selected` from `all` repository grants and preserves every repository option returned by the Workspace Worker while project operations remain bound to one numeric repository identity.
- Compatible transitive dependency refreshes clear the current production and release audit advisories, including parser and build-chain denial-of-service advisories.

## Activation boundary

This desktop OTA does not deploy the separate Workspace Worker and does not change the user's GitHub App installation grant. The all-repositories option becomes fully live only after the corresponding Worker source is deployed and the user chooses the intended GitHub installation repository scope. Until then, v0.5.9 remains compatible with the existing selected-repository response.

## Distribution and rollback

- Channel: production `latest`
- Platform: macOS arm64
- Feed: `https://plexus-upgrade.thoughtseed.space/plexus`
- Previous known-good release: v0.5.8

The signed v0.5.8 artifacts remain immutable. If v0.5.9 must be rolled back, restore the previously verified v0.5.8 `latest-mac.yml` as an explicit R2 production change; never move the v0.5.9 tag or overwrite its versioned artifacts.
