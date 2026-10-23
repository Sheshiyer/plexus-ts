# Employee growth workflow

Status: implemented source and joined local verification; production activation pending.

An employee can ask Clio to prepare a growth deliverable, review a scoped handoff,
follow Hermes status, and read the returned internal draft and source references.

## Employee journey

1. Ask Clio to consult the growth operating model or prepare an internal brief.
2. Clio reads `context.growth` from the authenticated Cambium member bridge.
   The response contains reviewed excerpts, file digests and a source revision.
3. Clio proposes `org.handoff` with an objective, one existing organizational
   role, stable request ID and allowlisted references. The employee confirms the
   exact request. Identity and organizational permission are server owned.
4. Cambium admits `growth.request.draft` to the configured runner, persists it in
   D1, and enforces idempotency and per-member quotas. The staged initial limits
   are three pending requests and ten submissions per UTC day.
5. Hermes claims the request, verifies the pinned context against a versioned
   Git vault snapshot, and generates an internal draft through governed OmniRoute.
6. The fenced execution outcome returns the draft to Cambium. Clio renders
   queued, running, retrying, failed or draft-ready state and sources. Refresh
   reads the requesting member's record; another member receives no result.
7. If an acceptance response is lost, Review same request again creates a fresh
   confirmation with the original stable request ID. The consumed confirmation
   cannot execute twice; the server returns the original admitted request.

## Separate conversation and action paths

Clio chat travels through the protected member relay to hosted Phloem. A shared
Phloem key never reaches the renderer. Legacy desktop lane labels are translated
by the versioned relay compatibility map into governed `noesis-*` combos.
Requested lane, returned model ID and resolved provider are distinct evidence.

Delegation uses the existing member bridge, not the inference URL. Cambium D1
owns admission, claim/outcome records and result custody. Hermes owns execution.
The six roles supply a perspective; they do not grant shell access or turn on
all candidate GTM skill commands. Global native execution can remain disabled
while the explicit growth-only flag permits the bounded command.

## Knowledge boundaries

The initial capability is organization growth, not private client work. Client
project IDs are rejected because no canonical client-project permission resolver
has been admitted for this path. Explicit tenant capability configuration is
required; missing configuration fails closed.

The reviewed projection contains excerpts from Growth README, department
execution-map, organ-map and workflows. It pins source commit and file/excerpt
digests. Inference never receives full vault Markdown, HR/finance documents or
arbitrary paths. Traversal, symlink escape and source drift fail closed.
R2 and Vectorize do not replace Git vault transport. Drafting does not publish,
edit canonical growth policy, send messages, approve campaigns or widen write zones.

## Verification boundary

The joined development harness runs actual Cambium handlers, temporary SQLite
D1 stores, the actual Hermes runner/executor and real reviewed local vault files.
Its default inference and employee identities are explicitly synthetic. Run:

```sh
node scripts/employee-growth-integration.mjs
```

Set PLEXUS_GROWTH_CAMBIUM_ROOT, PLEXUS_GROWTH_HERMES_ROOT and
PLEXUS_GROWTH_VAULT_ROOT for other reviewed checkouts. Live inference mode uses
only a configured loopback OmniRoute endpoint; it does not deploy or bypass auth.

The developer fixture at scripts/employee-growth-review.html renders actual
components with synthetic states and no API traffic. Its explicit Vite review
config is excluded from the production entry point. Browser fixture acceptance
and packaged startup are separate from live employee acceptance.

See [rollout packet](EMPLOYEE_GROWTH_ROLLOUT.md) and the dated JSON receipts in
[evidence](evidence/README.md). Live acceptance remains open in ISA ISC-411–413,
ISC-440 and ISC-442.
