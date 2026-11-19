import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cambiumReviewSource } from './cambium-review-source.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'plexus-reference-test-'));
  const sourceRoot = path.join(dir, 'library');
  await mkdir(sourceRoot);
  const bytes = Buffer.from('test reference bytes');
  const assets = [{ sourceId: 'CVF-SRC-0063', organizedPath: 'reference.png', sha256: digest(bytes) }];
  const counts = { sourceAssets: 1 };
  const map = JSON.stringify({ assets, counts });
  await writeFile(path.join(sourceRoot, 'SOURCE-ASSET-MAP.v1.json'), map);
  await writeFile(path.join(sourceRoot, 'reference.png'), bytes);
  const reviewMap = { sourceMapSha256: digest(map), assets, counts };
  let handle;
  cambiumReviewSource({ sourceRoot, reviewMap }).configureServer({ middlewares: { use(fn) { handle = fn; } } });
  const server = http.createServer((req, res) => handle(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { dir, sourceRoot, bytes, reviewMap, get: (route, options) => fetch(base + route, options) };
}

test('serves the audited map and identical image bytes by allowlisted ID', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await (await f.get('/__cambium/manifest')).json(), f.reviewMap);
  const image = await f.get('/__cambium/image/CVF-SRC-0063');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.equal(image.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), f.bytes);
  assert.equal((await f.get('/__cambium/image/CVF-SRC-0063', { method: 'HEAD' })).status, 200);
});

test('rejects unknown IDs, raw paths and writes', async (t) => {
  const f = await fixture(t);
  for (const route of ['/__cambium/image/CVF-SRC-9999', '/__cambium/image/reference.png', '/__cambium/image/%2e%2e%2freference.png']) {
    assert.equal((await f.get(route)).status, 404);
  }
  assert.equal((await f.get('/__cambium/manifest', { method: 'POST' })).status, 405);
});

test('rejects source map drift instead of silently updating provenance', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.sourceRoot, 'SOURCE-ASSET-MAP.v1.json'), '{}');
  assert.equal((await f.get('/__cambium/manifest')).status, 409);
  assert.equal((await f.get('/__cambium/image/CVF-SRC-0063')).status, 409);
});

test('rejects changed image bytes', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.sourceRoot, 'reference.png'), 'changed');
  assert.equal((await f.get('/__cambium/image/CVF-SRC-0063')).status, 409);
});

test('does not follow a mapped symlink out of the source library', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.dir, 'outside.png'), f.bytes);
  await rm(path.join(f.sourceRoot, 'reference.png'));
  await symlink(path.join(f.dir, 'outside.png'), path.join(f.sourceRoot, 'reference.png'));
  assert.equal((await f.get('/__cambium/image/CVF-SRC-0063')).status, 409);
});

test('reports unavailable source explicitly', async (t) => {
  const f = await fixture(t);
  await rm(path.join(f.sourceRoot, 'SOURCE-ASSET-MAP.v1.json'));
  const response = await f.get('/__cambium/manifest');
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /unavailable/);
});

test('binds review annotations to canonical source records and unique IDs', async (t) => {
  const f = await fixture(t);
  f.reviewMap.assets[0].organizedPath = 'another.png';
  assert.equal((await f.get('/__cambium/manifest')).status, 409);
  f.reviewMap.assets[0].organizedPath = 'reference.png';
  f.reviewMap.assets.push({ ...f.reviewMap.assets[0] });
  assert.equal((await f.get('/__cambium/manifest')).status, 409);
  f.reviewMap.assets.pop();
  f.reviewMap.counts.sourceAssets = 2;
  assert.equal((await f.get('/__cambium/manifest')).status, 409);
});

test('the reference plugin refuses a non-loopback development bind', () => {
  const plugin = cambiumReviewSource({ sourceRoot: '.', reviewMap: { assets: [] } });
  assert.doesNotThrow(() => plugin.configResolved({ server: { host: '127.0.0.1' } }));
  assert.throws(() => plugin.configResolved({ server: { host: '0.0.0.0' } }), /loopback/);
  assert.throws(() => plugin.configResolved({ server: { host: true } }), /loopback/);
});
