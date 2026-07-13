import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  argvRequestsFounderGitHubSetup,
  founderGitHubSetupIntent,
  isFounderGitHubSetupRequest,
} from '../../src/shared/founder-github-setup';

const helperPath = path.resolve(process.cwd(), 'resources/setup-thoughtseed-github.mjs');

interface FounderSetupHelper {
  environmentForGitHubCli(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
  validateFounderIdentity(
    user: { id: number; login: string },
    membership: { state: string; organization: { id?: number; login: string } },
  ): { id: number; login: string; organization: string };
  verifyFounderWithGitHubCli(run: (command: string, args: string[]) => string): {
    id: number;
    login: string;
    organization: string;
  };
  openPlexusSetup(platform: NodeJS.Platform, run: (command: string, args: string[]) => string): void;
}

async function helper(): Promise<FounderSetupHelper> {
  const source = readFileSync(helperPath, 'utf8').replace(/^#![^\r\n]*(?:\r?\n|$)/, '');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#test-${Date.now()}-${Math.random()}`;
  return import(moduleUrl) as Promise<FounderSetupHelper>;
}

describe('guarded Thoughtseed Labs founder setup', () => {
  it('accepts only the fixed versioned setup request', () => {
    expect(isFounderGitHubSetupRequest('--github-founder-setup')).toBe(true);
    expect(isFounderGitHubSetupRequest('plexus://github/setup/v1')).toBe(true);
    expect(argvRequestsFounderGitHubSetup(['Plexus', 'plexus://github/setup/v1'])).toBe(true);

    for (const unsafe of [
      'plexus://github/setup',
      'plexus://github/setup/v2',
      'plexus://github/setup/v1?token=secret',
      'plexus://user:secret@github/setup/v1',
      'plexus://github:443/setup/v1',
      'https://github/setup/v1',
      '--github-founder-setup=psychon7',
    ]) {
      expect(isFounderGitHubSetupRequest(unsafe)).toBe(false);
    }
  });

  it('exposes only non-secret setup hints to renderer code', () => {
    expect(founderGitHubSetupIntent()).toEqual({
      version: 1,
      organizationLogin: 'thoughtseed-labs',
      allowedLogins: ['Sheshiyer', 'psychon7'],
    });
    expect(JSON.stringify(founderGitHubSetupIntent())).not.toMatch(/token|secret|key|credential|repo/i);
  });

  it('sanitizes token environment variables before invoking gh', async () => {
    const module = await helper();
    expect(module.environmentForGitHubCli({
      PATH: '/usr/bin',
      GH_TOKEN: 'gh-token',
      GITHUB_TOKEN: 'actions-token',
      GH_ENTERPRISE_TOKEN: 'enterprise-token',
      PLEXUS_TF_ACCESS_JWT: 'unrelated-but-never-forwarded-by-plexus-main',
    })).toEqual({
      PATH: '/usr/bin',
    });
  });

  it('requires an allowlisted immutable account and active organization membership', async () => {
    const module = await helper();
    expect(module.validateFounderIdentity(
      { id: 47470954, login: 'psychon7' },
      { state: 'active', organization: { id: 65741640, login: 'thoughtseed-labs' } },
    )).toEqual({ id: 47470954, login: 'psychon7', organization: 'thoughtseed-labs' });

    expect(() => module.validateFounderIdentity(
      { id: 43, login: 'outsider' },
      { state: 'active', organization: { id: 65741640, login: 'thoughtseed-labs' } },
    )).toThrow(/not an allowed/i);
    expect(() => module.validateFounderIdentity(
      { id: 47470954, login: 'psychon7' },
      { state: 'pending', organization: { id: 65741640, login: 'thoughtseed-labs' } },
    )).toThrow(/active membership/i);
    expect(() => module.validateFounderIdentity(
      { id: 7611727, login: 'psychon7' },
      { state: 'active', organization: { id: 65741640, login: 'thoughtseed-labs' } },
    )).toThrow(/pinned public GitHub account id/i);
    expect(() => module.validateFounderIdentity(
      { id: 47470954, login: 'psychon7' },
      { state: 'active', organization: { login: 'thoughtseed-labs' } },
    )).toThrow(/pinned public GitHub organization id/i);
  });

  it('uses read-only gh API preflights and a fixed app protocol', async () => {
    const module = await helper();
    const calls: Array<[string, string[]]> = [];
    const run = vi.fn((command: string, args: string[]) => {
      calls.push([command, args]);
      if (args.join(' ') === 'api user') return JSON.stringify({ id: 7611727, login: 'Sheshiyer' });
      if (args.join(' ') === 'api user/memberships/orgs/thoughtseed-labs') {
        return JSON.stringify({ state: 'active', organization: { id: 65741640, login: 'thoughtseed-labs' } });
      }
      return '';
    });

    expect(module.verifyFounderWithGitHubCli(run)).toEqual({
      id: 7611727,
      login: 'Sheshiyer',
      organization: 'thoughtseed-labs',
    });
    expect(calls).toEqual([
      ['gh', ['--version']],
      ['gh', ['auth', 'status', '--hostname', 'github.com']],
      ['gh', ['api', 'user']],
      ['gh', ['api', 'user/memberships/orgs/thoughtseed-labs']],
    ]);

    const opener = vi.fn(() => '');
    module.openPlexusSetup('darwin', opener);
    expect(opener).toHaveBeenCalledWith('open', ['plexus://github/setup/v1']);
  });

  it('packages the helper and registers only the plexus protocol scheme', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.build.extraResources).toEqual(expect.arrayContaining([{
      from: 'resources/setup-thoughtseed-github.mjs',
      to: 'setup-thoughtseed-github.mjs',
    }, {
      from: 'resources/setup-thoughtseed-github',
      to: 'setup-thoughtseed-github',
    }, {
      from: 'resources/setup-thoughtseed-github.ps1',
      to: 'setup-thoughtseed-github.ps1',
    }]));
    expect(pkg.build.protocols).toEqual([{ name: 'Plexus guarded setup', schemes: ['plexus'] }]);
    const posix = readFileSync(path.resolve(process.cwd(), 'resources/setup-thoughtseed-github'), 'utf8');
    const powershell = readFileSync(path.resolve(process.cwd(), 'resources/setup-thoughtseed-github.ps1'), 'utf8');
    expect(posix).toContain('env -i');
    expect(powershell).toContain('Get-ChildItem Env:');
    expect(`${posix}\n${powershell}`).not.toMatch(/private.?key|webhook.?secret|access.?jwt|member.?token/i);
  });

  it('keeps actor OAuth behind main-process IPC and existing Settings', () => {
    const preload = readFileSync(path.resolve(process.cwd(), 'src/preload/preload.ts'), 'utf8').replace(/\r\n/g, '\n');
    const settings = readFileSync(path.resolve(process.cwd(), 'src/renderer/components/Settings.tsx'), 'utf8').replace(/\r\n/g, '\n');
    const main = readFileSync(path.resolve(process.cwd(), 'src/main/main.ts'), 'utf8').replace(/\r\n/g, '\n');

    expect(main).toContain("guardedHandle('github:actorEnrollStart'");
    expect(main).toContain("guardedHandle('github:actorEnrollStart', undefined, async (): Promise<GitHubActorEnrollStartResult> => {\n  await activeAdminSession()");
    expect(main).toContain("if (protocol !== 'plexus:') return;");
    expect(main).toContain('rejected unsupported Plexus protocol route');
    expect(preload).toContain("ipcRenderer.invoke('github:actorEnrollStart')");
    expect(settings).toContain('Verify founder');
    expect(settings).toContain('GITHUB_ACTOR_POLL_TIMEOUT_MS');
    expect(settings).toContain('GITHUB_ACTOR_POLL_INTERVAL_MS');
    expect(settings).toContain('if (githubActorPollTimer.current) clearTimeout(githubActorPollTimer.current)');
    expect(settings).toContain('const [next, nextActor] = await Promise.all([');
    expect(settings).not.toMatch(/GH_TOKEN|GITHUB_TOKEN|private.?key|webhook.?secret/i);
  });
});
