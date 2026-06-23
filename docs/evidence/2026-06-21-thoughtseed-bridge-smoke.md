# Thoughtseed Bridge Smoke - 2026-06-21

Scope: Plexus v0.4.1 bridge handoff implementation for member-scoped Cambium access.

## Environment

- Bridge API: `https://curious.thoughtseed.space`
- Tenant: `cambium`
- Member: `shesh`
- Email: `thoughtseedlabs@gmail.com`
- Admin credential source: local operator environment only; token value not copied into Plexus.

## App Changes Verified

- Plexus exposes Thoughtseed Bridge IPC in preload and main process.
- Member invite redemption stores the scoped member token with Electron `safeStorage`.
- Renderer Settings has a Thoughtseed Bridge control surface.
- Agent Fabric shows local Paperclip bridge and remote Thoughtseed Bridge as separate cards.
- Bridge failures record retryable `thoughtseed_bridge` handoffs through the app handoff queue.

## Live Bridge Contract Proof

Redacted production API smoke:

- `POST /v1/handoff/members`: ok
- `POST /v1/handoff/invite`: ok
- `POST /v1/handoff/redeem`: redeemed `memberId=shesh`, `tenantId=cambium`
- `POST /v1/bridge/ingest`: signed heartbeat stored
- `POST /v1/bridge/directive`: queued directive `b_shesh_2026-06-21T00:12:56.139Z`
- `GET /v1/bridge/directives/shesh`: returned 1 pending directive
- `POST /v1/bridge/ack`: acked 1 directive
- `POST /v1/handoff/rotate`: replacement token issued
- Old member token after rotation: rejected

## Plexus Secure Storage Proof

Electron redeem smoke:

- Redeemed a fresh invite inside Electron main runtime.
- `safeStorage.isEncryptionAvailable()`: true
- Stored `ts.bridgeTokenEnc`: present and encrypted.
- Plaintext `ts.bridgeToken`: absent.
- Status after redeem: connected.
- Token expiry returned by bridge: `2026-07-21T00:13:28.013Z`
- Heartbeat id: `plexus_1782000808937`
- Directive poll after secure redeem: 0 pending.

## Local Build Proof

- `npm run typecheck`: passed
- `npm run build:main`: passed
- `npm run build:preload`: passed
- `npm run smoke:thoughtseed-bridge`: passed
- `npm exec vite -- build`: passed

Note: Vite emitted the existing parent-workspace warning about missing `astro/tsconfigs/strict`; it did not fail the renderer build.
