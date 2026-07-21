import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function fixture(): { app: string; shim: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'plexus-sqlite-smoke-'));
  tempDirs.push(root);
  const app = path.join(root, 'release', 'mac-arm64', 'Plexus.app');
  const executable = path.join(app, 'Contents', 'MacOS', 'Plexus');
  const shim = path.join(root, 'app-shim.mjs');
  mkdirSync(path.dirname(executable), { recursive: true });
  writeFileSync(executable, 'packaged executable fixture');
  writeFileSync(shim, [
    "import { writeFileSync } from 'node:fs';",
    "if (!process.argv.some((arg) => arg.startsWith('--user-data-dir='))) { console.error('missing isolated user-data-dir'); process.exit(2); }",
    "if (process.env.FAKE_SKIP_DATABASE !== 'true') writeFileSync(process.env.PLEXUS_DB_PATH, 'sqlite fixture');",
    "console.log('[packaged-sqlite-smoke] database initialized');",
    '',
  ].join('\n'));
  return { app, shim };
}

async function runVerifier(input: ReturnType<typeof fixture>, skipDatabase = false) {
  try {
    const result = await execFileAsync(process.execPath, [
      path.resolve(process.cwd(), 'scripts/verify-packaged-sqlite-bootstrap.mjs'),
      '--app', input.app,
      '--command-shim', input.shim,
    ], {
      env: { ...process.env, FAKE_SKIP_DATABASE: String(skipDatabase) },
    });
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

afterEach(() => {
  for (const root of tempDirs.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('packaged SQLite bootstrap verifier', () => {
  it('requires the packaged app to initialize a non-empty temporary database', async () => {
    const result = await runVerifier(fixture());

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('packaged SQLite bootstrap passed');
  });

  it('fails when the packaged process exits without creating its database', async () => {
    const result = await runVerifier(fixture(), true);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('did not create a non-empty SQLite database');
  });

  it('runs after packaging in both unsigned and signed release builds', () => {
    const pkg = JSON.parse(source('package.json')) as { scripts: Record<string, string> };
    const main = source('src/main/main.ts');
    const rendererSmoke = source('scripts/smoke-packaged-renderer.mjs');

    expect(pkg.scripts['verify:packaged-sqlite'])
      .toBe('node scripts/verify-packaged-sqlite-bootstrap.mjs');
    expect(pkg.scripts['release:mac']).toContain('npm run verify:packaged-sqlite');
    expect(main).toContain("process.env.PLEXUS_PACKAGED_SQLITE_SMOKE === '1'");
    expect(main).toContain('[packaged-sqlite-smoke] database initialized');
    expect(rendererSmoke).toContain("PLEXUS_PACKAGED_RENDERER_SMOKE: '1'");
    expect(rendererSmoke).toContain('RENDERER_PROBE_ATTEMPTS = 2');
    expect(rendererSmoke).toContain('retrying with a fresh process');
    expect(rendererSmoke).toContain("PACKAGED_RENDERER_SMOKE_MARKER = '[packaged-renderer-smoke]'");
    expect(main).toContain("PACKAGED_RENDERER_SMOKE_MARKER = '[packaged-renderer-smoke]'");
    expect(main).toContain('window.webContents.executeJavaScript');
    expect(main).toContain("process.env.PLEXUS_PACKAGED_RENDERER_SMOKE === '1' ? 0 : undefined");
    expect(main).toContain('() => startApiServer(localApiPort)');
    expect(main).toContain('startupGate.runStep');
  });
});
