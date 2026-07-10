# Plexus Thoughtseed Bridge Handoff

Written: 2026-06-21

Purpose: wire Plexus into the live Thoughtseed reporting loop:

`Plexus -> scoped member bridge -> Hermes -> Cambium TG Mini App / configured Telegram topics`

This replaces the retired TeamForge/MultiCA path for this surface. Do not put
the admin `BRIDGE_TOKEN` in Plexus. Plexus only stores a scoped per-member bridge
token issued by the Cambium Worker handoff flow.

**2026-07-10 authority update:** the bridge is the primary member-scoped
reporting port for the Plexus native assistant. The assistant runtime lives in
Plexus/Electron main; Fabric/Paperclip is optional helper/enrichment. Hermes owns
reporting routines and maps audience intent to Cambium/Telegram destinations.
The Workspace Worker/Plexus API remains the member data plane and is a report
fallback only after bridge failure. See
[`architecture/HERMES_REPORTING_CONTRACT.md`](architecture/HERMES_REPORTING_CONTRACT.md).

Target daily event path:

```text
Plexus native assistant -> member-scoped Thoughtseed bridge -> Hermes
Hermes -> Cambium TG Mini App + configured Telegram topics
```

When the bridge/Hermes path is offline, Plexus keeps local queued/failed/retry
state. A successful Workspace Worker fallback remains eligible for bridge retry
and is not Hermes receipt. This document does not by itself prove live
Hermes/Cambium/Telegram delivery.

## Last-verified Infrastructure Boundary (2026-06-21)

| Surface | Current truth |
|---|---|
| Bridge API | `https://curious.thoughtseed.space` |
| Tenant | `cambium` |
| Worker | `cambium-quests` |
| Worker version at last verification | `5b20a5a2-8345-40b7-8a6c-4003b63859c3` |
| Paperclip company at last verification | Thoughtseed Labs, prefix `THO`, id `afa83b3a-1abc-478c-974f-9bfc9b8f6576` |
| Founder routing | Hermes/Cambium-configured; no chat or topic ID is stored in Plexus |

Live checks already passed on 2026-06-21:

- Worker health returns `{"ok":true,"worker":"cambium-quests"}`.
- Authenticated but unsigned bridge ingest fails closed with `401 bad or missing bridge signature`.
- Gate queue for `cambium` is `0`.
- Paperclip Thoughtseed agents are all `running` or `idle`, with no `lastError`.

## Desired Plexus Behavior

Plexus should support four bridge operations:

1. Redeem a handoff invite and store the issued member token securely.
2. Send signed upstream status/evidence messages through the bridge to Hermes.
3. Poll and ack downstream directives for the member.
4. Rotate or revoke local bridge credentials cleanly.

Plexus must fail closed when no token exists, when the token expires, or when the
Worker rejects the signature.

For the native assistant rollout, bridge operations are downstream of the
assistant's local outbox. A daily event should be created and queued locally
before any network send. A successful primary send is a bridge receipt.
Workspace Worker send is allowed only after bridge failure, records degraded
transport, and remains queued for a bridge retry. UI copy and evidence must
distinguish local deterministic proof, fallback delivery, bridge receipt,
Hermes handling, and founder-visible proof.

## Security Rules

- Never store or ship the admin `BRIDGE_TOKEN` in Plexus.
- Store the member token with Electron `safeStorage`, similar to the existing
  Worker token storage in `src/main/teamforge.ts`.
- Keep bridge calls in the main process. Renderer code should call IPC handlers,
  not touch bridge tokens directly.
- Keep assistant model keys, bridge member tokens, invite tokens, HMAC signatures,
  and Worker admin credentials out of renderer state and logs.
- Treat the invite token as sensitive until redeemed.
- Do not log the member token, invite token, HMAC signature, or Authorization header.
- Do not revive TeamForge/MultiCA routes for this integration.
- Do not store Telegram chat/topic IDs or bot credentials in Plexus. Send only
  routing intent such as `audience: founder_review`; Hermes maps the destination.

## Worker API Contract

Base URL:

```text
https://curious.thoughtseed.space
```

### Operator/Admin Endpoints

These require the admin `BRIDGE_TOKEN`. They are for local operator setup only,
not Plexus.

Add or update a member:

```bash
export BRIDGE_TOKEN="$(grep -m1 '^BRIDGE_TOKEN=' "$HOME/.claude/.env" | cut -d= -f2- | tr -d '"')"

curl -sS -X POST https://curious.thoughtseed.space/v1/handoff/members \
  -H "Authorization: Bearer ${BRIDGE_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "memberId": "shesh",
    "tenantId": "cambium",
    "email": "thoughtseedlabs@gmail.com"
  }'
```

Create an invite:

```bash
curl -sS -X POST https://curious.thoughtseed.space/v1/handoff/invite \
  -H "Authorization: Bearer ${BRIDGE_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "memberId": "shesh",
    "linkBase": "https://curious.thoughtseed.space"
  }'
```

List members:

```bash
curl -sS https://curious.thoughtseed.space/v1/handoff/members \
  -H "Authorization: Bearer ${BRIDGE_TOKEN}" | jq
```

Queue a downstream directive for a Plexus member:

```bash
curl -sS -X POST https://curious.thoughtseed.space/v1/bridge/directive \
  -H "Authorization: Bearer ${BRIDGE_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "memberId": "shesh",
    "payload": {
      "type": "status_request",
      "issuedBy": "founder",
      "scope": "full",
      "target": { "memberId": "shesh" }
    }
  }'
```

Read upstream inbox for confirmation:

```bash
curl -sS https://curious.thoughtseed.space/v1/bridge/inbox/cambium \
  -H "Authorization: Bearer ${BRIDGE_TOKEN}" | jq
```

### Plexus Client Endpoints

Redeem invite:

```http
POST /v1/handoff/redeem
Content-Type: application/json

{ "invite": "<invite-token-from-admin-flow>" }
```

Expected response:

```json
{
  "ok": true,
  "memberId": "shesh",
  "tenantId": "cambium",
  "bridgeApiUrl": "https://curious.thoughtseed.space",
  "token": "<member-token>",
  "expiresAt": "2026-07-21T..."
}
```

Poll directives:

```http
GET /v1/bridge/directives/:memberId
Authorization: Bearer <member-token>
```

Ack directives:

```http
POST /v1/bridge/ack
Authorization: Bearer <member-token>
Content-Type: application/json

{ "memberId": "shesh", "ids": ["dir-1"] }
```

Rotate token:

```http
POST /v1/handoff/rotate
Content-Type: application/json

{ "token": "<current-member-token>" }
```

Upstream ingest:

```http
POST /v1/bridge/ingest
Authorization: Bearer <member-token>
Content-Type: application/json

<signed BridgeMessage>
```

## Bridge Message Signing

Every upstream message must include `signature`.

Signature algorithm:

1. Remove the `signature` field from the message.
2. Canonical JSON encode the unsigned message:
   - object keys sorted lexicographically
   - omit fields whose value is `undefined`
   - arrays stay ordered
3. HMAC-SHA256 with the member token.
4. Base64url encode the digest without padding.

Minimal TypeScript helper:

```ts
import { createHmac } from 'node:crypto';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function signBridgeMessage<T extends Record<string, unknown>>(message: T, token: string): T & { signature: string } {
  const { signature: _signature, ...unsigned } = message;
  const signature = createHmac('sha256', token)
    .update(canonicalJson(unsigned))
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { ...message, signature };
}
```

Suggested heartbeat payload:

```ts
const message = signBridgeMessage({
  version: '1.0.0',
  id: `plexus_${Date.now()}`,
  timestamp: new Date().toISOString(),
  direction: 'upstream',
  tenantId: 'cambium',
  memberId,
  payload: {
    type: 'heartbeat',
    lane: 'heartbeat',
    agentStatus: {
      plexus: {
        state: 'idle',
        lastSeen: new Date().toISOString(),
        currentTask: 'connected'
      }
    },
    viability: {
      coherenceScore: 1,
      lastCheck: new Date().toISOString()
    }
  }
}, memberToken);
```

Expected ingest success:

```json
{ "ok": true, "id": "plexus_...", "stored": true }
```

Expected failure for unsigned/tampered messages:

```json
{ "error": "bad or missing bridge signature" }
```

## Native Assistant Daily Event Placement

The assistant daily path is separate from optional helper health:

1. Plexus records a local daily assistant event from bounded local context.
2. Plexus stores the event in the assistant outbox with pending status.
3. Plexus sends a signed `daily_agent_event` through the member-scoped bridge to
   Hermes, using the stable event ID as the bridge message ID.
4. Only when the bridge returns a failure or throws may Plexus send through the
   Workspace Worker daily route. Fallback success records degraded transport and
   leaves the item queued for bridge retry.
5. Bridge receipt, Hermes handling, and founder-visible Cambium/Telegram proof
   are separate evidence levels. A Worker/R2 record alone does not prove them.
6. Paperclip/Fabric can enrich the event when enabled, but Paperclip disabled or
   offline is not a failure of the assistant daily flow.

Do not mark a daily event as Hermes-delivered unless a current smoke captures
the bridge/Hermes receipt. Do not claim founder-visible proof without evidence
from the Cambium TG Mini App or configured Telegram destination.

## Suggested Plexus Files

Keep the reporting bridge client separate from `src/main/teamforge.ts`, whose
historical filename now identifies the Workspace Worker data-plane client:

| File | Work |
|---|---|
| `src/main/thoughtseed-bridge.ts` | Store token, redeem invite, sign messages, poll directives, ack, rotate, status |
| `src/main/main.ts` | IPC handlers: `thoughtseed:bridgeStatus`, `thoughtseed:redeemInvite`, `thoughtseed:sendHeartbeat`, `thoughtseed:pollDirectives`, `thoughtseed:ackDirectives`, `thoughtseed:rotateBridgeToken`, `thoughtseed:disconnectBridge` |
| `src/shared/types.ts` | Shared types for bridge status, directive, redeem response, upstream payload |
| `src/renderer/...` | Add Settings or Agent Fabric controls for connect/status/rotate and a small directive queue view |

Suggested stored settings:

| Key | Value |
|---|---|
| `ts.bridgeApiUrl` | default `https://curious.thoughtseed.space` |
| `ts.bridgeMemberId` | member slug, lowercase kebab |
| `ts.bridgeTenantId` | `cambium` |
| `ts.bridgeTokenEnc` | encrypted member token |
| `ts.bridgeTokenExpiresAt` | ISO timestamp |
| `ts.bridgeLastSeenAt` | ISO timestamp |
| `ts.bridgeLastIngestId` | last upstream message id |

Bridge status shape:

```ts
export interface ThoughtseedBridgeStatus {
  configured: boolean;
  connected: boolean;
  bridgeApiUrl: string;
  tenantId: string;
  memberId: string;
  tokenExpiresAt?: string | null;
  lastSeenAt?: string | null;
  lastError?: string | null;
}
```

## Wiring Flow

1. Add `src/main/thoughtseed-bridge.ts`.
2. Add IPC handlers in `src/main/main.ts`.
3. Add types to `src/shared/types.ts`.
4. Add a Settings/Agent Fabric UI path:
   - paste invite token
   - redeem
   - show connected state
   - send heartbeat
   - poll directives
   - rotate token
   - disconnect
5. Add retryable failure records through the existing app-wide handoff/resilience
   system when bridge calls fail.
6. Keep Workspace Worker data-plane state distinct from reporting transport,
   while exposing both health states when a screen needs them.

## Smoke Test Plan

Run these from the Plexus repo:

```bash
npm run typecheck
npm run build:main
npm run build:preload
```

For the native assistant path, also record a renderer smoke checklist entry for:

- Assistant panel model-unconfigured state.
- Offline Worker state with local event queued.
- Paperclip disabled state.
- Action confirmation before any write-capable assistant tool.
- Optional Helpers showing bridge/Paperclip degradation without blocking the app.

Then run app-level smokes:

1. Redeem an invite in Plexus.
2. Confirm Plexus status shows:
   - `configured: true`
   - `connected: true`
   - `tenantId: cambium`
   - correct `memberId`
   - non-expired `tokenExpiresAt`
3. Send a heartbeat.
4. Operator confirms the heartbeat appears in:

```bash
curl -sS https://curious.thoughtseed.space/v1/bridge/inbox/cambium \
  -H "Authorization: Bearer ${BRIDGE_TOKEN}" | jq '.messages[-1]'
```

5. Operator queues a directive for the member.
6. Plexus polls directives and displays or records it.
7. Plexus acks the directive.
8. Operator confirms pending directives for the member return `count: 0`.
9. Plexus rotates token and stores only the new token.
10. Optional security smoke: old token should return `401`.

## Acceptance Criteria

This handoff is complete when:

- Plexus can redeem a real invite.
- Token is stored only via secure storage.
- Plexus can send one signed upstream heartbeat.
- Operator can read that heartbeat in `/v1/bridge/inbox/cambium`.
- Operator can queue one downstream directive.
- Plexus can poll and ack that directive.
- The directive disappears from pending after ack.
- Token rotation works and old token no longer works.
- `npm run typecheck`, `npm run build:main`, and `npm run build:preload` pass.

## Confirmation To Send Back

When wired, send this block back:

```text
PLEXUS BRIDGE CONFIRMATION

Repo:
Branch:
Commit:
App version:

Member:
- memberId:
- tenantId: cambium
- email:

Invite/redeem:
- invite created:
- invite redeemed:
- token stored with safeStorage:
- token expiresAt:

Upstream smoke:
- heartbeat id:
- ingest response:
- inbox readback confirmed:

Downstream smoke:
- directive id:
- Plexus displayed/recorded directive:
- ack response:
- pending count after ack:

Rotation smoke:
- rotation response:
- old token rejected:
- new token status:

Local verification:
- npm run typecheck:
- npm run build:main:
- npm run build:preload:
- packaged/dev app smoke:

Notes/blockers:
```

## Current Known Gaps After This Handoff

- Commercial Cambium quest X is still open: brief, contract, deposit.
- Less-trusted member hardening remains: email-proof redeem or CF Access on
  `/join`, admin token rotation, rate limits, KV TTL/compaction, audit trail.
- Some historical docs/scripts still mention TeamForge/MultiCA; current reporting
  stays on the Plexus bridge -> Hermes -> Cambium/Telegram path. Fabric/Paperclip
  remains optional enrichment only.
- The local Cambium `quine status` Cloudflare probe expects `CLOUDFLARE_API_TOKEN`
  even though Wrangler OAuth deployment works.
