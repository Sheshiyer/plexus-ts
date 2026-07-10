import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];
const TEAM_ID = 'BS6SZR4929';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function fixture(): { app: string; dmg: string; mount: string; shim: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'plexus-signature-'));
  tempDirs.push(root);
  const app = path.join(root, 'release', 'mac-arm64', 'Plexus.app');
  const mountedApp = path.join(root, 'mounted', 'Plexus.app');
  const dmg = path.join(root, 'release', 'Plexus-0.5.3-mac-arm64.dmg');
  const shim = path.join(root, 'command-shim.mjs');
  mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  mkdirSync(path.join(mountedApp, 'Contents', 'MacOS'), { recursive: true });
  writeFileSync(path.join(app, 'Contents', 'MacOS', 'Plexus'), 'signed app fixture');
  writeFileSync(path.join(mountedApp, 'Contents', 'MacOS', 'Plexus'), 'signed mounted fixture');
  writeFileSync(dmg, 'signed dmg fixture');
  writeFileSync(shim, [
    "const [command, ...args] = process.argv.slice(2);",
    "if (command === 'codesign' && args.includes('-dv')) {",
    "  console.error(`TeamIdentifier=${process.env.FAKE_TEAM_ID ?? ''}`);",
    "}",
    "if (command === 'hdiutil' && args[0] === 'attach') {",
    "  const escaped = String(process.env.FAKE_DMG_MOUNT ?? '').replaceAll('&', '&amp;');",
    "  console.log(`<?xml version=\"1.0\"?><plist><array><dict><key>mount-point</key><string>${escaped}</string></dict></array></plist>`);",
    "}",
    "if (process.env.FAKE_FAIL_COMMAND === command) process.exit(17);",
    "process.exit(0);",
    '',
  ].join('\n'));
  return { app, dmg, mount: path.dirname(mountedApp), shim };
}

async function runVerifier(input: ReturnType<typeof fixture>, teamId = TEAM_ID): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const result = await execFileAsync(process.execPath, [
      path.resolve(process.cwd(), 'scripts/verify-macos-release-signature.mjs'),
      '--app', input.app,
      '--dmg', input.dmg,
      '--team-id', teamId,
      '--command-shim', input.shim,
    ], {
      env: { ...process.env, FAKE_DMG_MOUNT: input.mount, FAKE_TEAM_ID: TEAM_ID },
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

describe('signed macOS release verifier', () => {
  it('requires signature, team identity, Gatekeeper, staple, and mounted-DMG app proof', async () => {
    const input = fixture();
    const result = await runVerifier(input);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain(`verified Developer ID TeamIdentifier ${TEAM_ID}`);
    expect(result.stdout).toContain('verified mounted DMG app');
  });

  it('rejects a signed app whose TeamIdentifier is not the expected release team', async () => {
    const result = await runVerifier(fixture(), 'DIFFERENT01');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`TeamIdentifier ${TEAM_ID} does not match expected DIFFERENT01`);
  });

  it('wires post-build verification before signed artifacts are uploaded', () => {
    const pkg = JSON.parse(source('package.json')) as { scripts: Record<string, string> };
    const workflow = source('.github/workflows/publish-ota.yml');
    const notarize = source('scripts/notarize.cjs');
    const verification = workflow.indexOf('Verify signed and notarized macOS artifacts');
    const upload = workflow.indexOf('Upload signed workflow artifacts');

    expect(pkg.scripts['verify:release-signature'])
      .toBe('node scripts/verify-macos-release-signature.mjs');
    expect(workflow).toContain('EXPECTED_APPLE_TEAM_ID: ${{ secrets.OTA_APPLE_TEAM_ID }}');
    expect(workflow).toContain("REQUIRE_NOTARIZATION: 'true'");
    expect(workflow).toContain('npm run verify:release-signature -- --team-id "$EXPECTED_APPLE_TEAM_ID"');
    expect(notarize).toContain("process.env.REQUIRE_NOTARIZATION === 'true'");
    expect(notarize).toContain('Notarization is required, but Apple credentials are missing.');
    expect(verification).toBeGreaterThan(0);
    expect(upload).toBeGreaterThan(verification);
  });

  it('does not grant DYLD injection or disabled library validation entitlements', () => {
    const entitlements = source('scripts/entitlements.mac.plist');

    expect(entitlements).not.toContain('com.apple.security.cs.allow-dyld-environment-variables');
    expect(entitlements).not.toContain('com.apple.security.cs.disable-library-validation');
  });
});
