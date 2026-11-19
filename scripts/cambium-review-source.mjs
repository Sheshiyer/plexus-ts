import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// The review server serves only IDs in the audited snapshot. It never accepts a
// filesystem path from a request and is not imported by the production build.
export function cambiumReviewSource({ sourceRoot, reviewMap }) {
  const byId = new Map(reviewMap.assets.map((asset) => [asset.sourceId, asset]));
  async function verifyMap() {
    const bytes = await readFile(path.join(sourceRoot, 'SOURCE-ASSET-MAP.v1.json'));
    if (sha256(bytes) !== reviewMap.sourceMapSha256) {
      throw new Error('The source map changed after this review. Reconcile the audit before loading these references.');
    }
    const canonical = JSON.parse(bytes.toString('utf8'));
    const canonicalById = new Map(canonical.assets.map((asset) => [asset.sourceId, asset]));
    if (canonicalById.size !== canonical.assets.length
      || byId.size !== reviewMap.assets.length
      || byId.size !== canonicalById.size) throw new Error('Reference IDs are duplicated or incomplete.');
    for (const asset of reviewMap.assets) {
      const source = canonicalById.get(asset.sourceId);
      if (!source || Object.entries(source).some(([key, value]) => JSON.stringify(asset[key]) !== JSON.stringify(value))) {
        throw new Error('Reference metadata does not match the audited source map.');
      }
    }
    if (Object.entries(canonical.counts).some(([key, value]) => reviewMap.counts[key] !== value)) {
      throw new Error('Reference counts do not match the audited source map.');
    }
  }
  return {
    name: 'cambium-reference-review',
    apply: 'serve',
    configResolved(config) {
      if (!['127.0.0.1', 'localhost', '::1'].includes(config.server.host)) {
        throw new Error('The source-reference review must bind to a loopback host. Use npm run review:design.');
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (!pathname.startsWith('/__cambium/')) return next();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET, HEAD');
          res.end();
          return;
        }
        const id = pathname.match(/^\/__cambium\/image\/(CVF-SRC-\d{4})$/)?.[1];
        const asset = id ? byId.get(id) : null;
        if (pathname !== '/__cambium/manifest' && !asset) {
          res.statusCode = 404;
          res.end('Unknown reference');
          return;
        }
        try {
          await verifyMap();
          if (!asset) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(req.method === 'HEAD' ? undefined : JSON.stringify(reviewMap));
            return;
          }
          const root = await realpath(sourceRoot);
          const filename = await realpath(path.join(root, asset.organizedPath));
          if (!filename.startsWith(`${root}${path.sep}`)) throw new Error('Reference path is outside the source library.');
          const bytes = await readFile(filename);
          if (sha256(bytes) !== asset.sha256) throw new Error('Reference bytes changed after this review.');
          const ext = path.extname(filename).toLowerCase();
          if (!['.png', '.svg'].includes(ext)) throw new Error('Unsupported reference type.');
          res.setHeader('Content-Type', ext === '.svg' ? 'image/svg+xml' : 'image/png');
          res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
          res.setHeader('Content-Length', bytes.length);
          res.end(req.method === 'HEAD' ? undefined : bytes);
        } catch (error) {
          res.statusCode = error?.code === 'ENOENT' ? 503 : 409;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: res.statusCode === 503
            ? 'Cambium source library is unavailable. Set CAMBIUM_SOURCE_LIBRARY to the audited source-library folder and restart the review server.'
            : error.message }));
        }
      });
    },
  };
}
