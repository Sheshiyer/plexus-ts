#!/usr/bin/env node
/** Joined development proof: actual Cambium HTTP handlers + file SQLite + Hermes runner.
 * Inference is mocked unless --live-inference is explicitly supplied. No deployment occurs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = resolve(fileURLToPath(new URL('..', import.meta.url)));
const siblings = resolve(here, '..');
const cambium = process.env.PLEXUS_GROWTH_CAMBIUM_ROOT ?? join(siblings, 'cambium-employee-growth-20261023');
const hermes = process.env.PLEXUS_GROWTH_HERMES_ROOT ?? join(siblings, 'plexus-phloem-relay-20261023');
const vault = process.env.PLEXUS_GROWTH_VAULT_ROOT ?? resolve(siblings, '..', 'thoughtseed-labs');
const live = process.argv.includes('--live-inference');
if (process.argv.slice(2).some(arg => arg !== '--live-inference')) throw Error('Only --live-inference is supported. Paths use PLEXUS_GROWTH_*_ROOT environment overrides.');
const load = (root, file) => import(pathToFileURL(join(root, file)).href);
const [{ handle }, { d1BridgeStore, d1BridgeExecutionStore }, { d1GrowthStore }, { runRunnerOnce }, { executeGrowthRequest }, { GROWTH_CONTEXT_PROJECTION: projection }] = await Promise.all([
  load(cambium, 'workers/quests/src/handler.ts'), load(cambium, 'workers/quests/src/index.ts'), load(cambium, 'workers/quests/src/growth-workflow.ts'),
  load(hermes, 'src/runner.ts'), load(hermes, 'src/growth-execution.ts'), load(hermes, 'src/growth-context-projection.ts'),
]);
const sandbox = await mkdtemp(join(tmpdir(), 'plexus-growth-joined-'));
const dbPath = join(sandbox, 'authority.sqlite');
const db = new DatabaseSync(dbPath);
const operations = [];
let server;
try {
  const migrations = join(cambium, 'workers/quests/migrations');
  for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) db.exec(await readFile(join(migrations, file), 'utf8'));
  const d1 = { prepare(sql) { const statement = db.prepare(sql); let values = []; return {
    bind(...v) { values = v; return this; }, async first() { return statement.get(...values) ?? null; },
    async all() { return { results: statement.all(...values) }; }, async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
  }; } };
  const kv = new Map();
  function seed(memberId, tenantId, token) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    kv.set(`memtok:${tokenHash}`, memberId); kv.set(`member:${memberId}`, JSON.stringify({ tenantId, tokenHash, status: 'active', tokenExp: Date.now() + 3600000 }));
  }
  const employeeToken = 'local-fixture-employee-only', runnerToken = 'local-fixture-runner-only';
  seed('employee-1', 'cambium', employeeToken); seed('employee-2', 'cambium', 'local-fixture-other-employee');
  seed('foreign-employee', 'foreign-org', 'local-fixture-foreign'); seed('hermes-runner', 'cambium', runnerToken);
  const deps = {
    kv: { async get(k) { return kv.get(k) ?? null; }, async put(k, v) { kv.set(k, v); }, async list(p) { return [...kv.keys()].filter(k => k.startsWith(p)); } },
    bridgeToken: runnerToken, bridgeStore: d1BridgeStore(d1), executionStore: d1BridgeExecutionStore(d1), growthStore: d1GrowthStore(d1),
    growthPolicy: { tenantIds: ['cambium'], runnerMemberId: 'hermes-runner' }, now: () => new Date().toISOString(), uuid: () => crypto.randomUUID(),
  };
  server = createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      const result = await handle({ method: req.method, path: req.url, headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v ?? ''])), ...(body ? { body } : {}) }, deps);
      operations.push({ method: req.method, path: req.url, status: result.status });
      res.writeHead(result.status, { 'content-type': 'application/json' }); res.end(result.body);
    } catch { res.writeHead(500); res.end('{"error":"local_harness_error"}'); }
  });
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  async function call(method, path, body, token = employeeToken) {
    const r = await fetch(`${baseUrl}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, body: await r.json() };
  }
  const ctx = await call('GET', '/v1/bridge/growth/context'); assert.equal(ctx.status, 200, JSON.stringify(ctx.body));
  const intent = { requestId: 'joined-local-employee-growth-1', scope: 'org-growth', role: 'synthesist', objective: '  Prepare an internal launch brief grounded in the supplied growth playbooks. State missing product facts and cite the reference paths.  ', contextRefs: projection.documents.map(d => d.path) };
  const submitted = await call('POST', '/v1/bridge/growth/requests', intent); assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  const id = submitted.body.request.id;
  const replay = await call('POST', '/v1/bridge/growth/requests', intent); assert.equal(replay.body.duplicate, true);
  assert.equal((await call('POST', '/v1/bridge/growth/requests', { ...intent, objective: 'Changed intent' })).status, 409);
  assert.equal((await call('GET', `/v1/bridge/growth/requests/${id}`, undefined, 'local-fixture-other-employee')).status, 404);
  assert.equal((await call('GET', '/v1/bridge/growth/context', undefined, 'local-fixture-foreign')).status, 403);
  assert.equal((await call('POST', '/v1/bridge/growth/requests', { ...intent, requestId: 'unsafe', contextRefs: ['10-people/payroll.md'] })).status, 400);
  assert.equal((await call('POST', '/v1/bridge/executions/claim', { schema: 'thoughtseed.hermes.execution_claim.v1', memberId: 'hermes-runner', directiveId: `${id}-draft`, idempotencyKey: id, executionId: 'exec_denied', runnerId: 'joined-local', hostIdentity: 'local-host' })).status, 403);
  let inferenceCalls = 0;
  const inference = live ? globalThis.fetch : async (url, options) => {
    inferenceCalls++;
    assert.equal(url, 'http://127.0.0.1:20128/v1/chat/completions');
    const input = JSON.parse(options.body); assert.equal(input.tools, undefined);
    const sources = JSON.parse(input.messages[1].content).references;
    assert.equal(JSON.parse(input.messages[1].content).objective, intent.objective);
    assert.equal(sources.length, 4); for (const source of sources) assert.ok(source.content.length <= 3000);
    return Response.json({ choices: [{ message: { content: 'INTERNAL TEST DRAFT: define the product, audience and proof before choosing launch channels. Source: 20-operations/growth/department/execution-map.md. Human review required.' }, finish_reason: 'stop' }] });
  };
  if (live && (!process.env.HERMES_RUNNER_GROWTH_MODEL || !process.env.HERMES_RUNNER_GROWTH_API_KEY)) throw Error('--live-inference requires protected HERMES_RUNNER_GROWTH_MODEL and HERMES_RUNNER_GROWTH_API_KEY; never put keys in command arguments.');
  const config = { baseUrl, tenantId: 'cambium', memberId: 'hermes-runner', memberToken: runnerToken, kid: 'hermes-runner:v1', runnerId: 'joined-local', hostIdentity: 'local-host', agentId: 'hermes', ackDirectives: true, executeDirectives: true, legacyAckWithoutExecution: false, executionStateDir: join(sandbox, 'runner'), sendHeartbeat: false, timeoutMs: 10000 };
  const result = await runRunnerOnce(config, { executor: (directive) => executeGrowthRequest(directive.payload.input, { growthVaultRoot: vault, growthModel: process.env.HERMES_RUNNER_GROWTH_MODEL ?? 'noesis-build', growthApiKey: process.env.HERMES_RUNNER_GROWTH_API_KEY ?? 'local-mock-only' }, { fetch: inference }) });
  assert.equal(result.executed, 1, JSON.stringify(result)); assert.equal(result.acked, 1, JSON.stringify(result));
  const returned = await call('GET', `/v1/bridge/growth/requests/${id}`); assert.equal(returned.body.request.status, 'draft_ready', JSON.stringify(returned.body));
  assert.equal(returned.body.request.result.sources.length, 4); assert.equal(returned.body.request.result.externalAction, 'none');
  const second = await runRunnerOnce(config, { executor: async () => { throw Error('must not execute again'); } }); assert.equal(second.executed, 0);
  assert.equal((await call('GET', `/v1/bridge/growth/requests/${id}`, undefined, 'local-fixture-other-employee')).status, 404);
  const persisted = new DatabaseSync(dbPath, { readOnly: true });
  const row = persisted.prepare('SELECT status,result_json FROM bridge_growth_requests WHERE id=?').get(id); assert.equal(row.status, 'draft_ready'); assert.ok(JSON.parse(row.result_json).content); persisted.close();
  const receipt = { schema: 'thoughtseed.plexus.employee_growth_local_integration.v1', status: 'pass', inference: live ? 'live_loopback_omniroute' : 'mocked', employeeIdentity: 'local_fixture_not_real_employee', authority: 'actual_cambium_handlers_file_sqlite_d1_adapter', transport: 'loopback_http_bearer_authenticated', hermes: 'actual_runner_and_growth_executor', vault: 'actual_committed_local_allowlisted_files_hash_verified', projectionDigest: projection.projectionDigest, contextSourceCommit: projection.sourceCommit, nativeExecuted: result.executed, nativeAcked: result.acked, inferenceCalls: live ? null : inferenceCalls, durableStatus: row.status, checks: ['context', 'submit', 'idempotent_replay', 'changed_intent_denied', 'unsafe_context_denied', 'employee_cannot_claim', 'cross_tenant_denied', 'cross_member_result_hidden', 'runner_poll_claim_execute_outcome_ack', 'file_sqlite_readback', 'second_poll_no_reexecution'], operations, productionVerified: false, desktopUiVerified: false };
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  db.close(); await rm(sandbox, { recursive: true, force: true });
}
