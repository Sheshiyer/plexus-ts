# Clio → OmniRoute Model Routing Implementation Plan

<!-- documentation-status: 2026-09-05 -->
> **Historical plan / contract.** Original status, approvals, checkboxes, and
> execution instructions are retained as session history. Consult the
> [plan index](README.md), [current ISA](../../ISA.md), and
> [P6 migration plan](../../.planning/phases/P6-labs-migration-acceptance.md) before selecting work.
> This file does not itself start an execution wave or certify current live acceptance.
<!-- /documentation-status -->

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task with RED/GREEN verification and evidence receipts.

**Goal:** Replace Clio's direct-provider picker with the governed Temperance/OmniRoute lane portfolio already verified on Hermes EC2, while preserving streaming, tool calls, fail-closed identity, OTA rollback, and the existing loopback-only OmniRoute boundary.

**Architecture:** Plexus keeps the Cloudflare Access application token encrypted in the Electron main process and uses it only from a new OmniRoute client. The client calls an Access-protected HTTPS hostname. A small Hermes relay, bound to `127.0.0.1:20130`, validates the Access JWT issuer/audience/signature, confirms the actor through Plexus `/v1/whoami`, allowlists three upstream routes, bounds request bodies, injects the local OmniRoute API key, and streams responses from `127.0.0.1:20128`. Cloudflare Tunnel publishes only the relay. Clio renders the 15 production lanes and portfolio metadata; `te-bench` stays hidden and direct provider credentials disappear from the UI.

**Tech Stack:** Electron, TypeScript, React, Vitest, AI SDK OpenAI-compatible provider, Node 22 HTTP/fetch streams, `jose`, systemd, Cloudflare Access/Tunnel, AWS Systems Manager, OmniRoute 3.8.48.

**Repositories and clean worktrees**

- Plexus: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/.worktrees/plexus-clio-omniroute`
- Hermes: `/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/.worktrees/hermes-clio-omniroute-relay`
- Task ISA: `/Users/sheshnarayaniyer/.Codex/PAI/MEMORY/WORK/20260728-clio-omniroute-model-routing/ISA.md`

The operator's dirty Plexus and thoughtseed-labs checkouts are out of scope and must remain untouched.

---

### Task 1: Recover the deployed OmniRoute portfolio into Hermes mainline

**Files:**

- Add: `ops/omniroute/model-portfolio-policy.json`
- Add: `ops/omniroute/command-code-lanes-ec2.json`
- Add: `ops/omniroute/apply-command-code-lanes.py`
- Add: `ops/omniroute/test_apply_command_code_lanes.py`
- Add: `ops/opencode/omniroute-model-combos.jsonc`
- Add: `ops/opencode/omniroute-spark-mac-overlay.jsonc`
- Add: `scripts/omniroute-model-portfolio.mjs`
- Add: `scripts/omniroute-model-portfolio.test.mjs`
- Modify: `package.json`
- Reference only: commits `1603167`, `311bc36`

**Step 1: Write the recovery contract**

Add a test that asserts:

- schema is `thoughtseed.omniroute.model-portfolio.v1`;
- release boundary is `live-verified`;
- ranker totals are 61 models, 15 lanes, 11 S, 35 A, and 15 B;
- the active lane file exposes exactly the 15 production lanes;
- `te-bench` is not production-selectable;
- every production lane references only verified active canonical models;
- lane strategy and optional judge model remain intact.

**Step 2: Run the test to verify RED**

Run:

```bash
npm run test:omniroute-portfolio
```

Expected: FAIL because the portfolio artifacts are not present on current mainline.

**Step 3: Recover only the authoritative artifacts**

Restore the listed files from commits `1603167` and `311bc36`, retaining their provenance. Do not merge the divergent `codex/runner-access-auth` branch wholesale and do not delete or overwrite newer vault-sync files from main.

**Step 4: Run the portfolio and lane tests**

Run:

```bash
npm run test:omniroute-portfolio
python3 -m unittest ops/omniroute/test_apply_command_code_lanes.py
```

Expected: PASS with 61 ranked models and 15 production lanes.

**Step 5: Commit**

```bash
git add ops/omniroute ops/opencode scripts/omniroute-model-portfolio.mjs scripts/omniroute-model-portfolio.test.mjs package.json
git commit -m "feat(omniroute): recover verified model portfolio"
```

---

### Task 2: Add the fail-closed Hermes Clio relay

**Files:**

- Create: `src/clio-omniroute-relay.ts`
- Create: `src/clio-omniroute-relay.test.ts`
- Create: `ops/ec2/clio-omniroute-relay.env.example`
- Create: `ops/ec2/clio-omniroute-relay.service`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Write relay contract tests**

Cover:

- startup fails when issuer, audience, worker origin, upstream origin, or upstream key path is absent;
- listen host defaults to and permits only loopback;
- missing/invalid JWT returns 401 or 403 before any upstream call;
- JWT verification enforces RS256 signature, issuer, audience, expiry, and key rotation through remote JWKS;
- `/v1/whoami` denial, null session, suspended/inactive member, wrong workspace, disallowed role, or identity mismatch with the verified JWT denies relay access;
- issuer, Plexus API, and OmniRoute origins are canonical and pinned; userinfo, paths, query, fragments, redirects, alternate ports, DNS aliases, and public upstreams are rejected before any network call;
- only `GET /healthz`, `GET /v1/models`, and `POST /v1/chat/completions` are accepted;
- exact raw-target matching rejects query strings, absolute-form URLs, `//`, trailing slash, backslash, encoded separators/dots, double encoding, semicolon parameters, fragments, duplicate `?`, and conflicting `Host`;
- chat bodies over the configured bound return 413 without upstream traffic;
- the upstream `Authorization` header is replaced with the local OmniRoute key;
- Access JWT, cookies, and local key are never forwarded to OmniRoute or reflected in errors;
- only explicitly safe upstream response headers propagate; cookies, authentication challenges, hop-by-hop headers, server metadata, and secret-bearing error bodies do not;
- SSE status, safe headers, chunks, cancellation, bounded buffering, and backpressure propagate;
- membership/header/idle/lifetime timeouts and per-actor/global concurrency limits fail closed;
- client abort, response close, and downstream write failure abort upstream within 250 ms;
- non-stream JSON responses propagate;
- upstream timeouts and failures return bounded, redacted errors.

**Step 2: Run the targeted test to verify RED**

Run:

```bash
node --test src/clio-omniroute-relay.test.ts
```

Expected: FAIL because the relay module does not exist.

**Step 3: Implement the smallest relay**

Use Node built-ins plus `jose`:

- `createRemoteJWKSet(new URL("${TEAM_DOMAIN}/cdn-cgi/access/certs"))`;
- `jwtVerify(token, JWKS, { issuer: TEAM_DOMAIN, audience: POLICY_AUD, algorithms: ["RS256"] })`;
- call `${PLEXUS_API_ORIGIN}/v1/whoami` with the validated assertion;
- require a normalized active member in the intended workspace, an allowed role, and identity consistency with the verified JWT;
- read the OmniRoute key from a dedicated systemd credential or `0640 root:clio-relay` file at request time;
- proxy only to the configured loopback upstream;
- strip hop-by-hop, cookie, Access, and inbound authorization headers;
- stream with `Readable.fromWeb()`/pipeline semantics and abort upstream on client disconnect;
- emit structured receipts containing a validated/generated request ID, route, allowlisted lane, keyed actor HMAC, status, latency, and byte counts only.

No prompt, completion, JWT, email, cookie, API key, or full request body may enter logs.

**Step 4: Add systemd hardening**

The service must:

- bind `127.0.0.1:20130`;
- run as its own unprivileged user;
- use `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=strict`, and `ProtectHome=true`;
- read only its environment and key paths;
- be unable to read OmniRoute's database, WAL, `.env`, or broker token;
- use bounded restart policy and `OnFailure=hermes-alert@%n.service`;
- start after network and OmniRoute;
- never alter the existing OmniRoute bind or its `REQUIRE_API_KEY=true` boundary.

**Step 5: Run tests**

Run:

```bash
npm test -- --test-name-pattern="Clio OmniRoute relay"
npm run test:node
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/clio-omniroute-relay.ts src/clio-omniroute-relay.test.ts ops/ec2/clio-omniroute-relay.env.example ops/ec2/clio-omniroute-relay.service package.json package-lock.json
git commit -m "feat(clio): add authenticated omniroute relay"
```

---

### Task 3: Add a relay deployment and rollback workflow

**Files:**

- Create: `scripts/clio-omniroute-relay-remote.mjs`
- Create: `scripts/clio-omniroute-relay-remote.test.mjs`
- Create: `docs/runbooks/clio-omniroute-relay.md`
- Modify: `package.json`

**Step 1: Write deployment contract tests**

Test dry-run command construction, explicit AWS profile/region/instance resolution, archive allowlist, checksum verification, backup creation, systemd verification, health smoke, and rollback command construction.

The tool must refuse:

- implicit/default AWS identity;
- an instance ID that does not match the discovered tagged instance;
- a dirty or uncommitted release archive;
- missing Cloudflare Access settings;
- missing rollback material;
- deployment without an explicit confirmation token.

**Step 2: Run targeted test to verify RED**

```bash
node --test scripts/clio-omniroute-relay-remote.test.mjs
```

Expected: FAIL because the deployment tool does not exist.

**Step 3: Implement status, deploy, smoke, and rollback**

Expose:

```bash
npm run infra:clio-relay:status -- --profile aws
npm run infra:clio-relay:deploy -- --profile aws --confirm CLIO_RELAY_DEPLOY
npm run infra:clio-relay:rollback -- --profile aws --confirm CLIO_RELAY_ROLLBACK
```

Deployment packages only committed relay/portfolio/systemd artifacts, uploads through SSM, captures the current release and units, installs atomically, daemon-reloads, restarts, and verifies:

- relay listener `127.0.0.1:20130`;
- OmniRoute listeners remain loopback-only;
- anonymous relay request is denied;
- local signed/authenticated request reaches `/v1/models`;
- SSE first-byte and completion probes pass;
- secrets do not appear in journal output.

The workflow is SSM-only: no SSH transport, dirty-tree override, or whole-repository release swap.

**Step 4: Document the Cloudflare side**

The runbook records, without secrets:

- the verified hostname and existing/same Access application audience;
- the Tunnel ingress mapping to `http://127.0.0.1:20130`;
- `originRequest.access.required=true`, team name, and audience;
- required Cloudflare policy and Plexus membership behavior;
- rotation procedure for Access/JWKS and OmniRoute key;
- receipt locations and freshness SLO;
- rollback steps.

Do not invent the hostname or audience. Resolve them from the authenticated Cloudflare account before deployment.

**Step 5: Run tests and commit**

```bash
node --test scripts/clio-omniroute-relay-remote.test.mjs
git add scripts/clio-omniroute-relay-remote.mjs scripts/clio-omniroute-relay-remote.test.mjs docs/runbooks/clio-omniroute-relay.md package.json
git commit -m "feat(clio): add relay deployment lifecycle"
```

---

### Task 4: Define the Plexus OmniRoute catalog contract

**Files:**

- Modify: `src/shared/native-assistant.ts`
- Modify: `src/shared/types.ts`
- Modify: `test/assistant/model-catalog.test.ts`
- Modify: `test/assistant/model-settings.test.ts`
- Modify: `test/assistant/security.test.ts`

**Step 1: Write catalog and migration tests**

Assert:

- provider choices are `auto`, `omniroute`, and `mock`; legacy direct providers migrate to `auto`;
- model IDs represent governed lane IDs, not raw providers;
- the catalog exposes lane label, purpose, strategy, ordered member IDs, optional judge, ranking/release metadata, health, and last verified time;
- exactly 15 production lanes are selectable;
- `te-bench` and unverified raw models cannot become selectable through malformed server data;
- `te-build` is recommended and deterministic mock remains explicit fallback only;
- settings input has no Google/NVIDIA keys or arbitrary local base URL;
- serialized renderer-safe types cannot contain Access JWTs, cookies, provider keys, or the OmniRoute key.

**Step 2: Run targeted tests to verify RED**

```bash
npx vitest run test/assistant/model-catalog.test.ts test/assistant/model-settings.test.ts test/assistant/security.test.ts
```

Expected: FAIL on the old provider-centric contract.

**Step 3: Implement types and validation**

Add strict lane/catalog types and a shared validator/normalizer. Keep the Electron renderer contract metadata-only.

**Step 4: Run tests**

Expected: PASS for shared contracts, with runtime tests still RED.

**Step 5: Commit**

```bash
git add src/shared/native-assistant.ts src/shared/types.ts test/assistant
git commit -m "test(clio): define omniroute lane contract"
```

---

### Task 5: Replace direct Clio providers with the OmniRoute client

**Files:**

- Create: `src/main/assistant-omniroute.ts`
- Create: `src/main/assistant-omniroute.test.ts`
- Modify: `src/main/assistant-models.ts`
- Modify: `src/main/assistant-model-catalog.ts`
- Modify: `src/main/assistant-model-settings.ts`
- Modify: `src/main/teamforge.ts`
- Modify: `src/main/main.ts`
- Modify: `scripts/smoke-assistant-production.mjs`

**Step 1: Write runtime tests**

Cover:

- the client gets the Access JWT through a narrow main-process function and never renderer IPC;
- the relay origin is canonical HTTPS in production and only allows explicit loopback override in development;
- catalog fetch authenticates at the Cloudflare edge with the client-facing
  `Cf-Access-Token` carrier; the relay receives the verified
  `Cf-Access-Jwt-Assertion` origin header from Cloudflare;
- chat uses the selected lane as the OpenAI-compatible model;
- text deltas, tool calls, finish reason, and usage remain compatible with Clio;
- abort/cancel reaches the relay;
- 401/403 clears no credentials silently and returns a sign-in-required state;
- relay offline produces an honest retry/settings suggestion;
- there is no silent fallback to Google, NVIDIA, Ollama, LM Studio, or mock;
- mock activates only when explicitly selected for tests/development;
- logging redacts Access JWTs and response secrets.

**Step 2: Run targeted tests to verify RED**

```bash
npx vitest run src/main/assistant-omniroute.test.ts test/assistant/model-router.test.ts
```

Expected: FAIL because the OmniRoute client does not exist.

**Step 3: Add a narrow authenticated fetch primitive**

In `teamforge.ts`, export a purpose-specific function that returns headers or performs a fetch for an allowlisted canonical relay origin. Do not export the decrypted JWT to preload/renderer and do not broaden generic worker URL settings.

**Step 4: Implement the provider and router migration**

Use `@ai-sdk/openai-compatible` against the relay. Remove direct cloud/local providers from production provider construction and fallback ordering. Preserve the mock provider for deterministic tests. Migrate persisted legacy selections to `auto`/`te-build` once.

**Step 5: Implement catalog discovery**

Fetch `/v1/models`, merge it with the governed portfolio schema, reject incomplete/unverified catalogs, and return honest gateway status.

**Step 6: Run assistant tests and smokes**

```bash
npm run test:assistant
npm run smoke:assistant-production
npm run typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/main src/shared scripts/smoke-assistant-production.mjs test/assistant
git commit -m "feat(clio): route models through omniroute"
```

---

### Task 6: Replace the provider settings UI with Temperance lanes

**Files:**

- Modify: `src/renderer/components/Settings.tsx`
- Modify: `src/renderer/components/Settings.css`
- Modify: `test/renderer/settings-assistant-models.test.tsx`

**Step 1: Write UI tests**

Assert:

- no Google/NVIDIA API key fields or arbitrary localhost provider controls render;
- “Recommended” selects `te-build`;
- all 15 production lanes render with purpose, strategy, ordered members, and health;
- fusion lanes show their judge without exposing credentials;
- ranks are labeled as ranker evidence, not live entitlement;
- gateway offline and sign-in-required states are distinct and actionable;
- `te-bench` and raw model aliases never render as selectable;
- keyboard and screen-reader labels identify lane, strategy, state, and selection.

**Step 2: Run UI test to verify RED**

```bash
npx vitest run test/renderer/settings-assistant-models.test.tsx
```

Expected: FAIL on the old provider menu.

**Step 3: Implement the lane UI**

Keep the existing Settings visual language. Present a compact recommended selector and expandable lane details rather than 61 independent raw model options.

**Step 4: Run renderer and assistant suites**

```bash
npm run test:renderer
npm run test:assistant
npm run lint
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/Settings.tsx src/renderer/components/Settings.css test/renderer/settings-assistant-models.test.tsx
git commit -m "feat(settings): expose temperance model lanes"
```

---

### Task 7: Verify locally and against authenticated infrastructure

**Files:**

- Modify: task ISA evidence rows only
- Create: bounded evidence under each repository's existing evidence convention, if required

**Step 1: Verify identities before mutations**

```bash
aws sts get-caller-identity --profile aws
aws ec2 describe-instances --profile aws --region us-east-1 \
  --filters Name=tag:Name,Values=hermes-runner-01 Name=instance-state-name,Values=running
```

Expected: the intended account and exactly one intended running instance. Stop if either check is ambiguous.

**Step 2: Verify Cloudflare configuration read-only**

Resolve the existing Tunnel, Access application, hostname, team domain, and audience from the authenticated account. Confirm the existing Plexus token can be valid for the relay hostname before changing code or DNS. If it cannot, use the existing Access application's additional hostname capability or route through the existing authenticated Plexus API boundary; do not ship a second user login flow.

The same-audience path is acceptable only when both hostnames are demonstrably covered by the same Access application. Record that application ID/audience relationship without recording tokens.

**Step 3: Run complete local gates**

Hermes:

```bash
npm test
npm run test:omniroute-portfolio
```

Plexus:

```bash
npm run verify:all
```

Expected: PASS.

**Step 4: Deploy relay canary**

Deploy the committed Hermes branch through the tested SSM workflow. Capture before/after unit, listener, anonymous-denial, authenticated-catalog, SSE, tool-call, and journal-redaction receipts. This branch canary is not final production proof: after merge, redeploy the exact Hermes merge SHA and repeat the production smokes before Plexus is allowed to merge.

**Step 5: Run live Clio smoke**

From the Plexus development build:

1. authenticate once with the existing Plexus Access flow;
2. load the 15 lanes;
3. select `te-fast`, send a short prompt, and observe streamed text;
4. select `te-validate`, send a bounded validation prompt, and observe fusion completion;
5. invoke a harmless read-only Clio tool;
6. cancel a stream;
7. stop the relay briefly and verify the UI reports gateway offline without cloud fallback;
8. restore relay and verify recovery.

**Step 6: Update the ISA**

Append exact test output, commit SHAs, SSM command IDs, unit states, HTTP statuses, latency/byte receipts, screenshots, and any honestly unmet criteria.

---

### Task 8: Open PRs, merge cleanly, and cut the OTA release

**Files:**

- Modify: `package.json`
- Modify: release metadata generated by `release:ota:prep`
- Modify: `CHANGELOG.md` or the repository's canonical release notes

**Step 1: Push both branches**

```bash
git push -u origin codex/clio-omniroute-relay
git push -u origin codex/clio-omniroute
```

**Step 2: Open ready PRs**

Hermes PR first, including:

- recovered portfolio provenance;
- relay threat model;
- deployment/rollback evidence;
- EC2 and Cloudflare receipts.

Plexus PR second, including:

- lane UX screenshots;
- migration behavior;
- assistant/renderer/security gates;
- live relay smoke receipts.

**Step 3: Merge in dependency order**

Merge Hermes only after relay canary passes. Redeploy and re-smoke the exact merged Hermes SHA. Merge Plexus only after those merged-SHA production health and authenticated catalog/SSE smokes pass. Rebase/update before merge and require all repository checks.

**Step 4: Prepare patch OTA release**

Use the next unused patch version after re-reading remote tags, GitHub releases/drafts, open release PRs, and the public feed. Draft PR #123 currently reserves `v0.7.5`, so this release is at least `v0.7.6` unless that reservation is explicitly superseded:

```bash
npm version <next-patch> --no-git-tag-version
npm run verify:all
npm run release:ota:prep:full
```

`release:ota:prep` reads `package.json`; it does not accept `--version`. Treat the full local prep as unsigned proof only.

**Step 5: Publish and verify OTA**

Publish through the protected canonical signed/notarized workflow; local `release:ota:prep:full` deliberately disables signing/notarization and is not publication proof. Verify:

- update metadata and artifact URLs return 200;
- hashes/signatures match;
- an installed Plexus upgrades without losing encrypted Access identity or selected lane;
- Clio loads the production portfolio and streams through OmniRoute after restart;
- the previous signed manifest and artifacts remain immutably available;
- feed rollback and manual recovery for already-upgraded clients are both documented and tested.

**Step 6: Close lifecycle receipts**

Record producer, trigger, consumer, receipt, freshness, rollback, commit SHAs, PRs, merged SHAs, release tag, artifact hashes, OTA URL probes, and live Clio smoke in the task ISA and canonical release documentation.
