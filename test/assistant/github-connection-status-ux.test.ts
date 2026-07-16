import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  GitHubConnectionStatus,
  GitHubInstallationTarget,
} from '../../src/shared/types';

const statusModulePath = '../../src/shared/github-connection-status';

type StatusModule = {
  normalizeGitHubConnectionTargets: (raw: unknown) => unknown[] | undefined;
  githubConnectionOwnerRows: (connection: GitHubConnectionStatus | null) => Array<{
    account: GitHubInstallationTarget;
    status: string;
    reason: string;
    installationId?: number;
  }>;
  githubConnectionOwnerCountLabel: (connection: GitHubConnectionStatus | null) => string;
  githubConnectionActionLabel: (target: { status: string; reason: string }) => string;
  githubConnectionReasonGuidance: (target: { account: GitHubInstallationTarget; status: string; reason: string }) => string;
  hasConnectedGitHubInstallation: (connection: GitHubConnectionStatus | null) => boolean;
};

async function statusModule(): Promise<StatusModule | null> {
  return import(statusModulePath).catch(() => null) as Promise<StatusModule | null>;
}

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

const allowedTargets: GitHubInstallationTarget[] = [
  { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' },
  { id: 7611727, login: 'Sheshiyer', type: 'User' },
  { id: 47470954, login: 'psychon7', type: 'User' },
];

function connection(patch: Partial<GitHubConnectionStatus> = {}): GitHubConnectionStatus {
  return {
    status: 'forbidden',
    installations: [],
    allowedTargets,
    repositoryCount: 0,
    ...patch,
  };
}

describe('truthful GitHub connection owner status', () => {
  it('normalizes exactly one reason-bearing target per pinned owner and preserves closed reasons', async () => {
    const module = await statusModule();
    expect(module?.normalizeGitHubConnectionTargets([
      {
        account: allowedTargets[1],
        installationId: 146484001,
        status: 'forbidden',
        reason: 'repository_scope_all',
      },
      {
        account: allowedTargets[0],
        installation_id: 146468777,
        status: 'forbidden',
        reason: 'permissions_incomplete',
      },
      {
        account: allowedTargets[2],
        status: 'unconfigured',
        reason: 'not_connected',
      },
    ])).toEqual([
      {
        account: allowedTargets[1],
        installationId: 146484001,
        status: 'forbidden',
        reason: 'repository_scope_all',
      },
      {
        account: allowedTargets[0],
        installationId: 146468777,
        status: 'forbidden',
        reason: 'permissions_incomplete',
      },
      {
        account: allowedTargets[2],
        status: 'unconfigured',
        reason: 'not_connected',
      },
    ]);
  });

  it('keeps missing additive targets backward-compatible and fails malformed or unknown target state closed', async () => {
    const module = await statusModule();
    expect(module?.normalizeGitHubConnectionTargets(undefined)).toBeUndefined();

    const failClosed = allowedTargets.map((account) => ({
      account,
      status: 'forbidden',
      reason: 'not_connected',
    }));
    expect(module?.normalizeGitHubConnectionTargets([
      { account: allowedTargets[0], status: 'connected', reason: 'future_reason', installationId: 1 },
      { account: allowedTargets[1], status: 'connected', reason: 'connected', installationId: 2 },
      { account: allowedTargets[2], status: 'connected', reason: 'connected', installationId: 3 },
    ])).toEqual(failClosed);
    expect(module?.normalizeGitHubConnectionTargets([
      { account: allowedTargets[0], status: 'connected', reason: 'connected', installationId: 1 },
      { account: allowedTargets[1], status: 'connected', reason: 'connected', installationId: 2 },
    ])).toEqual(failClosed);
  });

  it('reports connected, known, and total owner counts without treating forbidden installs as connected', async () => {
    const module = await statusModule();
    const value = connection({
      installations: [{
        installationId: 146484001,
        account: allowedTargets[1],
        status: 'forbidden',
      }],
    });
    expect(module?.githubConnectionOwnerCountLabel(value)).toBe('0 connected · 1 known · 3 total');
  });

  it('uses status-aware actions and reason-specific recovery guidance', async () => {
    const module = await statusModule();
    expect(module?.githubConnectionActionLabel({ status: 'connected', reason: 'connected' })).toBe('Manage repositories');
    expect(module?.githubConnectionActionLabel({ status: 'forbidden', reason: 'repository_scope_all' })).toBe('Fix repository access');
    expect(module?.githubConnectionActionLabel({ status: 'forbidden', reason: 'permissions_incomplete' })).toBe('Approve permissions');
    expect(module?.githubConnectionActionLabel({ status: 'suspended', reason: 'installation_suspended' })).toBe('Review suspension');
    expect(module?.githubConnectionActionLabel({ status: 'pending', reason: 'oauth_pending' })).toBe('Continue setup');
    expect(module?.githubConnectionActionLabel({ status: 'forbidden', reason: 'installation_hint_mismatch' })).toBe('Repair connection');
    expect(module?.githubConnectionActionLabel({ status: 'unconfigured', reason: 'not_connected' })).toBe('Connect owner');

    expect(module?.githubConnectionReasonGuidance({
      account: allowedTargets[1],
      status: 'forbidden',
      reason: 'repository_scope_all',
    })).toMatch(/Only select repositories/i);
    expect(module?.githubConnectionReasonGuidance({
      account: allowedTargets[0],
      status: 'forbidden',
      reason: 'permissions_incomplete',
    })).toMatch(/required GitHub App permissions/i);
    expect(module?.githubConnectionReasonGuidance({
      account: allowedTargets[0],
      status: 'forbidden',
      reason: 'trust_anchor_missing',
    })).toMatch(/fresh signed installation event.*re-save.*repository selection.*approve.*permissions/i);
    expect(module?.githubConnectionReasonGuidance({
      account: allowedTargets[0],
      status: 'forbidden',
      reason: 'trust_anchor_missing',
    })).not.toMatch(/redeliver/i);
    expect(module?.githubConnectionReasonGuidance({
      account: allowedTargets[0],
      status: 'forbidden',
      reason: 'installation_hint_mismatch',
    })).toMatch(/installation ID does not match/i);
    expect(module?.githubConnectionReasonGuidance({
      account: allowedTargets[0],
      status: 'forbidden',
      reason: 'ambiguous_installation',
    })).toMatch(/more than one installation/i);
  });

  it('gates founder verification on a connected target rather than a merely known installation', async () => {
    const module = await statusModule();
    const forbidden = connection({
      installations: [{ installationId: 146484001, account: allowedTargets[1], status: 'forbidden' }],
    });
    expect(module?.hasConnectedGitHubInstallation(forbidden)).toBe(false);

    const rows = await module?.normalizeGitHubConnectionTargets([
      { account: allowedTargets[0], status: 'connected', reason: 'connected', installationId: 146468777 },
      { account: allowedTargets[1], status: 'forbidden', reason: 'repository_scope_all', installationId: 146484001 },
      { account: allowedTargets[2], status: 'unconfigured', reason: 'not_connected' },
    ]);
    expect(module?.hasConnectedGitHubInstallation(connection({ targets: rows as never }))).toBe(true);
  });

  it('refreshes founder state when owner polling reaches terminal state and preserves authority boundaries', () => {
    const settings = source('src/renderer/components/Settings.tsx');
    const main = source('src/main/main.ts');
    const preload = source('src/preload/preload.ts');

    expect(settings).toContain('onTerminal: async (terminal, next) => {');
    expect(settings).toContain('const nextActor = await window.plexus.githubActorStatus().catch(() => null);');
    expect(settings).toContain('if (nextActor) setGitHubActor(nextActor);');
    expect(settings).toContain("session?.role === 'admin' && githubActor?.status !== 'verified'");
    expect(settings).toContain('disabled={Boolean(githubBusy) || !githubHasActiveInstallation}');
    expect(main).toMatch(/guardedHandle\('github:connectionStatus',[\s\S]{0,240}await activeAdminSession\(\)/);
    expect(preload).toContain("ipcRenderer.invoke('github:connectionStatus')");
    expect(settings).not.toMatch(/GH_TOKEN|GITHUB_TOKEN|private.?key|webhook.?secret|access.?jwt/i);
  });
});
