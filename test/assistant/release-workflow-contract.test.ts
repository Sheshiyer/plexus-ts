import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];
const servers: Server[] = [];
const ZIP_BYTES = Buffer.from('signed plexus zip fixture');
const DMG_BYTES = Buffer.from('signed plexus dmg fixture');
const BLOCKMAP_BYTES = Buffer.from('plexus blockmap fixture');

function sha512(bytes: Buffer): string {
  return createHash('sha512').update(bytes).digest('base64');
}

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function fixture(version = '0.5.3', lockVersion = version, rootVersion = lockVersion): string {
  const root = mkdtempSync(path.join(tmpdir(), 'plexus-release-ref-'));
  tempDirs.push(root);
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    version,
    build: { publish: [{ url: 'https://updates.example/plexus' }] },
  }));
  writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({
    version: lockVersion,
    packages: { '': { version: rootVersion } },
  }));
  execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'release-contract@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Release Contract'], { cwd: root });
  execFileSync('git', ['add', 'package.json', 'package-lock.json'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'release fixture'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['tag', `v${version}`], { cwd: root });
  return root;
}

function gitOutput(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function runVerifier(args: string[], cwd = process.cwd()): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const result = await execFileAsync(process.execPath, [
      path.resolve(process.cwd(), 'scripts/verify-release-ref.mjs'),
      ...args,
    ], { cwd });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof failure.code === 'number' ? failure.code : 1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    };
  }
}

function manifest(version = '0.5.3', overrides: { path?: string; sha512?: string } = {}): string {
  const zipName = `Plexus-${version}-mac-arm64.zip`;
  const dmgName = `Plexus-${version}-mac-arm64.dmg`;
  return [
    `version: ${version}`,
    'files:',
    `  - url: ${zipName}`,
    `    sha512: ${sha512(ZIP_BYTES)}`,
    `    size: ${ZIP_BYTES.byteLength}`,
    `  - url: ${dmgName}`,
    `    sha512: ${sha512(DMG_BYTES)}`,
    `    size: ${DMG_BYTES.byteLength}`,
    `path: ${overrides.path ?? zipName}`,
    `sha512: ${overrides.sha512 ?? sha512(ZIP_BYTES)}`,
    "releaseDate: '2026-07-10T00:00:00.000Z'",
    '',
  ].join('\n');
}

async function publicServer(input: {
  body: string;
  zipBody?: Buffer;
  zipLength?: number;
}): Promise<{ baseUrl: string; requests: Array<{ method?: string; url?: string; cacheControl?: string }> }> {
  const requests: Array<{ method?: string; url?: string; cacheControl?: string }> = [];
  const server = createServer((req, res) => {
    requests.push({
      method: req.method,
      url: req.url,
      cacheControl: req.headers['cache-control'],
    });
    if (req.url?.startsWith('/latest-mac.yml')) {
      res.writeHead(200, {
        'Content-Type': 'application/yaml',
        'Content-Length': Buffer.byteLength(input.body),
        'Cache-Control': 'public, max-age=60, must-revalidate',
      });
      res.end(req.method === 'HEAD' ? undefined : input.body);
      return;
    }
    if (req.url?.includes('.blockmap')) {
      res.writeHead(200, {
        'Content-Length': String(BLOCKMAP_BYTES.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      res.end(req.method === 'HEAD' ? undefined : BLOCKMAP_BYTES);
      return;
    }
    if (req.url?.includes('.zip')) {
      const body = input.zipBody ?? ZIP_BYTES;
      res.writeHead(200, {
        'Content-Length': String(input.zipLength ?? body.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }
    if (req.url?.includes('.dmg')) {
      res.writeHead(200, {
        'Content-Length': String(DMG_BYTES.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      res.end(req.method === 'HEAD' ? undefined : DMG_BYTES);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a port.');
  return { baseUrl: `http://127.0.0.1:${address.port}`, requests };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('release reference verifier', () => {
  it('accepts package-lock parity for build-only/manual runs', async () => {
    const result = await runVerifier(['--mode', 'build', '--repo-root', fixture()]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('package and lock versions agree at 0.5.3');
  });

  it('rejects package-lock version drift', async () => {
    const result = await runVerifier(['--mode', 'build', '--repo-root', fixture('0.5.3', '0.5.2')]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('package-lock.json version 0.5.2 does not match package.json 0.5.3');
  });

  it('accepts only an exact push tag newer than the public feed for publication', async () => {
    const root = fixture();
    const sha = gitOutput(root, ['rev-parse', 'HEAD']);
    const result = await runVerifier([
      '--mode', 'publish',
      '--repo-root', root,
      '--event', 'push',
      '--ref', 'refs/tags/v0.5.3',
      '--sha', sha,
      '--main-ref', 'main',
      '--feed-version', '0.5.2',
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('release ref refs/tags/v0.5.3 matches package version');
    expect(result.stdout).toContain(`release commit ${sha} is contained by main`);
    expect(result.stdout).toContain('candidate 0.5.3 is newer than public feed 0.5.2');
  });

  it('rejects manual publication, mismatched tags, and non-monotonic feeds', async () => {
    const root = fixture();
    const sha = gitOutput(root, ['rev-parse', 'HEAD']);
    const manual = await runVerifier([
      '--mode', 'publish', '--repo-root', root, '--event', 'workflow_dispatch', '--ref', 'refs/heads/main', '--feed-version', '0.5.2',
    ]);
    const mismatch = await runVerifier([
      '--mode', 'publish', '--repo-root', root, '--event', 'push', '--ref', 'refs/tags/v0.5.4', '--feed-version', '0.5.2',
    ]);
    const duplicate = await runVerifier([
      '--mode', 'publish', '--repo-root', root, '--event', 'push', '--ref', 'refs/tags/v0.5.3',
      '--sha', sha, '--main-ref', 'main', '--feed-version', '0.5.3',
    ]);

    expect(manual.code).toBe(1);
    expect(manual.stderr).toContain('publication requires a tag push event');
    expect(mismatch.code).toBe(1);
    expect(mismatch.stderr).toContain('does not match package version v0.5.3');
    expect(duplicate.code).toBe(1);
    expect(duplicate.stderr).toContain('must be newer than public feed 0.5.3');
  });

  it('allows exact-current failed-job recovery only after full public byte verification', async () => {
    const root = fixture();
    const sha = gitOutput(root, ['rev-parse', 'HEAD']);
    const body = manifest();
    const manifestPath = path.join(root, 'latest-mac.yml');
    writeFileSync(manifestPath, body);
    const publicFeed = await publicServer({ body });

    const result = await runVerifier([
      '--mode', 'publish', '--repo-root', root,
      '--event', 'push', '--ref', 'refs/tags/v0.5.3', '--sha', sha, '--main-ref', 'main',
      '--feed-version', '0.5.3', '--allow-current-feed', 'true',
      '--manifest', manifestPath, '--feed-url', `${publicFeed.baseUrl}/latest-mac.yml`,
      '--cache-bust', 'resume-126', '--attempts', '1',
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('exactly matches the fully verified public feed');
    expect(publicFeed.requests.map((request) => request.method)).toEqual(['GET', 'GET', 'HEAD', 'GET', 'HEAD']);
  });

  it('rejects an exact version tag whose commit is not contained by main', async () => {
    const root = fixture();
    execFileSync('git', ['switch', '-c', 'off-main'], { cwd: root, stdio: 'ignore' });
    writeFileSync(path.join(root, 'candidate.txt'), 'not merged\n');
    execFileSync('git', ['add', 'candidate.txt'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'off-main candidate'], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['tag', '-f', 'v0.5.3'], { cwd: root, stdio: 'ignore' });
    const sha = gitOutput(root, ['rev-parse', 'HEAD']);

    const result = await runVerifier([
      '--mode', 'publish', '--repo-root', root, '--event', 'push', '--ref', 'refs/tags/v0.5.3',
      '--sha', sha, '--main-ref', 'main', '--feed-version', '0.5.2',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`release commit ${sha} is not contained by main`);
  });

  it('verifies a cache-busted manifest and every referenced immutable artifact', async () => {
    const root = fixture();
    const body = manifest();
    const manifestPath = path.join(root, 'latest-mac.yml');
    writeFileSync(manifestPath, body);
    const publicFeed = await publicServer({ body });

    const result = await runVerifier([
      '--mode', 'public',
      '--repo-root', root,
      '--manifest', manifestPath,
      '--feed-url', `${publicFeed.baseUrl}/latest-mac.yml`,
      '--cache-bust', 'run-123',
      '--attempts', '1',
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(publicFeed.requests.map((request) => request.method)).toEqual(['GET', 'GET', 'HEAD', 'GET', 'HEAD']);
    expect(publicFeed.requests.every((request) => request.url?.includes('release=run-123-1'))).toBe(true);
    expect(publicFeed.requests.every((request) => request.cacheControl === 'no-cache')).toBe(true);
  });

  it('fails public verification when a referenced artifact length is wrong', async () => {
    const root = fixture();
    const body = manifest();
    const manifestPath = path.join(root, 'latest-mac.yml');
    writeFileSync(manifestPath, body);
    const publicFeed = await publicServer({ body, zipLength: ZIP_BYTES.byteLength - 1 });

    const result = await runVerifier([
      '--mode', 'artifacts',
      '--repo-root', root,
      '--manifest', manifestPath,
      '--feed-url', `${publicFeed.baseUrl}/latest-mac.yml`,
      '--cache-bust', 'run-124',
      '--attempts', '1',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`content-length ${ZIP_BYTES.byteLength - 1} does not match manifest size ${ZIP_BYTES.byteLength}`);
  });

  it('fails public verification when an artifact has the right size but the wrong SHA-512', async () => {
    const root = fixture();
    const body = manifest();
    const manifestPath = path.join(root, 'latest-mac.yml');
    writeFileSync(manifestPath, body);
    const corruptedZip = Buffer.from(ZIP_BYTES);
    corruptedZip[0] ^= 0xff;
    const publicFeed = await publicServer({ body, zipBody: corruptedZip });

    const result = await runVerifier([
      '--mode', 'artifacts',
      '--repo-root', root,
      '--manifest', manifestPath,
      '--feed-url', `${publicFeed.baseUrl}/latest-mac.yml`,
      '--cache-bust', 'run-125',
      '--attempts', '1',
    ]);

    expect(corruptedZip.byteLength).toBe(ZIP_BYTES.byteLength);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('SHA-512 does not match latest-mac.yml');
  });

  it('rejects a top-level path that is absent from the manifest files', async () => {
    const root = fixture();
    const manifestPath = path.join(root, 'latest-mac.yml');
    writeFileSync(manifestPath, manifest('0.5.3', { path: 'missing.zip' }));

    const result = await runVerifier([
      '--mode', 'artifacts',
      '--repo-root', root,
      '--manifest', manifestPath,
      '--feed-url', 'https://updates.example/plexus/latest-mac.yml',
      '--attempts', '1',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('top-level path missing.zip is not present in files metadata');
  });

  it('rejects a top-level SHA-512 that differs from its files entry', async () => {
    const root = fixture();
    const manifestPath = path.join(root, 'latest-mac.yml');
    writeFileSync(manifestPath, manifest('0.5.3', { sha512: sha512(Buffer.from('different bytes')) }));

    const result = await runVerifier([
      '--mode', 'artifacts',
      '--repo-root', root,
      '--manifest', manifestPath,
      '--feed-url', 'https://updates.example/plexus/latest-mac.yml',
      '--attempts', '1',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('top-level SHA-512 does not match the files entry for');
  });

  it('rejects absolute or path-bearing artifact references', async () => {
    const root = fixture();
    const zipName = 'Plexus-0.5.3-mac-arm64.zip';
    const unsafeName = `https://attacker.example/${zipName}`;
    const manifestPath = path.join(root, 'latest-mac.yml');
    writeFileSync(manifestPath, manifest().replaceAll(zipName, unsafeName));

    const result = await runVerifier([
      '--mode', 'artifacts',
      '--repo-root', root,
      '--manifest', manifestPath,
      '--feed-url', 'https://updates.example/plexus/latest-mac.yml',
      '--attempts', '1',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('must be a relative artifact filename');
  });
});

describe('release workflow publication contract', () => {
  it('keeps tag code secret-free and delegates authority to a trusted workflow-run chain', () => {
    const candidate = source('.github/workflows/release.yml');
    const publish = source('.github/workflows/publish-ota.yml');

    expect(candidate).toContain('name: Release Candidate');
    expect(candidate).toContain("tags:\n      - 'v*'");
    expect(candidate).toContain('contents: read');
    expect(candidate).toContain('Build unsigned macOS arm64 candidate');
    expect(candidate).toContain('npm run release:dry-run');
    expect(candidate).not.toContain('secrets.');
    expect(candidate).not.toContain('contents: write');
    expect(candidate).toContain('workflow_dispatch:');
    expect(candidate).toContain("github.event_name == 'push'");
    expect(candidate).toContain("github.event_name == 'workflow_dispatch'");
    expect(candidate).toContain('--mode build');
    expect(candidate).toContain('--mode publish');
    expect(candidate).toContain('Manual candidate must run from refs/heads/main.');
    expect(candidate).toContain('Manual candidate must match the current origin/main commit.');

    expect(publish).toContain('workflow_run:');
    expect(publish).toContain('- Release Candidate');
    expect(publish).toContain('github.event.workflow_run.head_repository.full_name == github.repository');
    expect(publish).toContain('ref: main');
    expect(publish).toContain('git merge-base --is-ancestor');
    expect(publish).toContain('must have exactly one stable vX.Y.Z tag');
    expect(publish).toContain('environment: ota-production');
    expect(publish).toContain('group: plexus-ota-release');
    expect(publish).toContain('cancel-in-progress: false');
    expect(publish.indexOf('Download signed macOS artifacts')).toBeLessThan(publish.indexOf('Reverify publication metadata'));
    expect(publish).toContain('--allow-current-feed true');
  });

  it('pins every first-party action to an immutable commit and enables update automation', () => {
    const workflows = [
      source('.github/workflows/ci.yml'),
      source('.github/workflows/release.yml'),
      source('.github/workflows/publish-ota.yml'),
    ].join('\n');
    const dependabot = source('.github/dependabot.yml');
    const actionUses = workflows.match(/uses: actions\/[^\s]+/g) ?? [];

    expect(actionUses.length).toBeGreaterThan(0);
    expect(actionUses.every((entry) => /@[0-9a-f]{40}(?:\s|$)/.test(entry))).toBe(true);
    expect(workflows).toContain('actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4');
    expect(workflows).toContain('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4');
    expect(workflows).toContain('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4');
    expect(workflows).toContain('actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4');
    expect(dependabot).toContain('package-ecosystem: github-actions');
    expect(dependabot).toContain('interval: monthly');
  });

  it('verifies immutable artifacts and GitHub assets before the manifest commit point', () => {
    const workflow = source('.github/workflows/publish-ota.yml');
    const artifactUpload = workflow.indexOf('Upload immutable OTA artifacts to Cloudflare R2');
    const artifactVerify = workflow.indexOf('Verify public immutable OTA artifacts');
    const githubRelease = workflow.indexOf('Ensure GitHub release and verified assets');
    const manifestUpload = workflow.indexOf('Publish OTA manifest to Cloudflare R2');
    const publicVerify = workflow.indexOf('Verify public OTA release');

    expect(artifactUpload).toBeGreaterThan(0);
    expect(artifactVerify).toBeGreaterThan(artifactUpload);
    expect(githubRelease).toBeGreaterThan(artifactVerify);
    expect(manifestUpload).toBeGreaterThan(githubRelease);
    expect(publicVerify).toBeGreaterThan(manifestUpload);
    expect(workflow).toContain('public, max-age=31536000, immutable');
    expect(workflow).toContain('public, max-age=60, must-revalidate');
    expect(workflow).toContain('--draft');
    expect(workflow).toContain("select(.tag_name == \\\"${tag}\\\")");
    expect(workflow).toContain(".digest // empty");
    expect(workflow).toContain('GitHub asset ${name} did not report a SHA-256 digest.');
    expect(workflow).toContain('if [ -z "${remote_digest}" ]; then');
    expect(workflow).toContain("--if-none-match '*'");
    expect(workflow).toContain('Metadata.sha256');
    expect(workflow).toContain('Removing stale draft release');
    expect(workflow.indexOf('created_draft=true')).toBeLessThan(workflow.indexOf('gh release create'));
    expect(workflow).not.toContain('--clobber');
  });

  it('keeps signing and R2 credentials scoped away from install and test steps', () => {
    const candidate = source('.github/workflows/release.yml');
    const workflow = source('.github/workflows/publish-ota.yml');
    const workflowPreamble = workflow.slice(0, workflow.indexOf('jobs:'));
    const awsInstall = workflow.slice(
      workflow.indexOf('- name: Install pinned AWS CLI'),
      workflow.indexOf('- name: Upload immutable OTA artifacts to Cloudflare R2'),
    );

    expect(workflowPreamble).toContain('contents: read');
    expect(workflowPreamble).not.toContain('contents: write');
    expect(candidate).not.toContain('CSC_LINK');
    expect(candidate).not.toContain('R2_SECRET_ACCESS_KEY');
    expect(workflow).toContain('Assert Apple signing secrets');
    expect(workflow).toContain('Build signed macOS arm64 artifacts');
    expect(workflow).toContain('Assert R2 OTA feed secrets');
    expect(workflow).toContain('contents: write');
    expect(awsInstall).toContain('awscli==1.45.45');
    expect(awsInstall).not.toContain('R2_SECRET_ACCESS_KEY');
    expect(awsInstall).not.toContain('AWS_SECRET_ACCESS_KEY');
    expect(workflow).toContain('npm run security:audit:prod');
    expect(workflow).toContain('npm run security:audit:release');
    expect(workflow).toContain('secrets.OTA_CSC_LINK');
    expect(workflow).toContain('secrets.OTA_APPLE_TEAM_ID');
    expect(workflow).toContain('secrets.OTA_R2_ACCOUNT_ID');
    expect(workflow).toContain('secrets.OTA_R2_SECRET_ACCESS_KEY');
    expect(workflow).not.toMatch(/secrets\.(?:CSC_LINK|CSC_KEY_PASSWORD|APPLE_ID|APPLE_APP_SPECIFIC_PASSWORD|APPLE_TEAM_ID|R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET)(?:\s|})/);
  });

  it('runs the release-ref verifier locally without instructing a direct main push', () => {
    const prep = source('scripts/prepare-ota-release.mjs');

    expect(prep).toContain("scripts/verify-release-ref.mjs");
    expect(prep).not.toContain('git push origin main');
    expect(prep).not.toContain('--allow-current-feed');
    expect(prep).toContain('Open and merge a reviewed PR');
    expect(prep).toContain("run('npm', ['run', 'security:audit:release'])");
  });

  it('blocks tagging until the legacy rollback cache metadata passes the current verifier', () => {
    const runbook = source('docs/OTA_RELEASE.md');

    expect(runbook).toContain('Known v0.5.2 rollback metadata prerequisite');
    expect(runbook).toContain('public, max-age=31536000, immutable');
    expect(runbook).toContain('public, max-age=60, must-revalidate');
    expect(runbook).toContain('node scripts/verify-release-ref.mjs');
    expect(runbook).toContain('Do not create `v0.5.3` until this rollback verification exits 0.');
  });
});
