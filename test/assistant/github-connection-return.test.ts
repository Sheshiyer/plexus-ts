import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GitHubConnectionStatus, GitHubConnectionState } from '../../src/shared/types';
import {
  argvGitHubConnectionReturnIntent,
  githubConnectionReturnIntent,
  isGitHubConnectionReturnIntent,
  startGitHubConnectionTargetPoll,
  terminalGitHubConnectionStateForTarget,
} from '../../src/shared/github-connection-return';
import { THOUGHTSEED_GITHUB_INSTALLATION_TARGETS } from '../../src/shared/founder-github-setup';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function connectionWith(
  accountId: number,
  status: Extract<GitHubConnectionState, 'connected' | 'suspended' | 'forbidden'>,
): GitHubConnectionStatus {
  const target = THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.find((candidate) => candidate.id === accountId);
  if (!target) throw new Error(`unknown test target ${accountId}`);
  return {
    status: 'connected',
    installations: [{ installationId: accountId + 1, account: { ...target }, status }],
    allowedTargets: THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.map((candidate) => ({ ...candidate })),
    repositoryCount: 0,
  };
}

describe('GitHub connection browser return custody', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts only exact token-free routes for pinned installation owners', () => {
    for (const target of THOUGHTSEED_GITHUB_INSTALLATION_TARGETS) {
      expect(githubConnectionReturnIntent(`plexus://github/connection/v1/${target.id}`)).toEqual({
        version: 1,
        accountId: target.id,
      });
    }

    for (const unsafe of [
      'plexus://github/connection/v1',
      'plexus://github/connection/v2/65741640',
      'plexus://github/connection/v1/65741640/extra',
      'plexus://github/connection/v1/99999999',
      'plexus://github/connection/v1/065741640',
      'plexus://github/connection/v1/%36%35%37%34%31%36%34%30',
      'plexus://github/connection/v1/65741640?',
      'plexus://github/connection/v1/65741640#',
      'PLEXUS://github/connection/v1/65741640',
      'plexus://github/connection/v1/65741640?state=signed-secret',
      'plexus://github/connection/v1/65741640?code=oauth-code',
      'plexus://github/connection/v1/65741640#access-token',
      'plexus://user:secret@github/connection/v1/65741640',
      'plexus://github:443/connection/v1/65741640',
      'https://github/connection/v1/65741640',
    ]) {
      expect(githubConnectionReturnIntent(unsafe), unsafe).toBeNull();
    }
  });

  it('accepts one argv return and rejects ambiguous duplicate returns', () => {
    const first = 'plexus://github/connection/v1/65741640';
    const second = 'plexus://github/connection/v1/7611727';
    expect(argvGitHubConnectionReturnIntent(['Plexus', first])).toEqual({ version: 1, accountId: 65741640 });
    expect(argvGitHubConnectionReturnIntent(['Plexus'])).toBeNull();
    expect(argvGitHubConnectionReturnIntent(['Plexus', first, first])).toBeNull();
    expect(argvGitHubConnectionReturnIntent(['Plexus', first, second])).toBeNull();
  });

  it('requires the exact renderer intent shape without hidden callback material', () => {
    expect(isGitHubConnectionReturnIntent({ version: 1, accountId: 47470954 })).toBe(true);
    expect(isGitHubConnectionReturnIntent({ version: 1, accountId: 47470954, state: 'secret' })).toBe(false);
    expect(isGitHubConnectionReturnIntent({ version: 1, accountId: 47470954, code: 'oauth-code' })).toBe(false);
    expect(isGitHubConnectionReturnIntent({ version: 1, accountId: 47470954, installationId: 42 })).toBe(false);
    expect(isGitHubConnectionReturnIntent({ version: 1, accountId: 99999999 })).toBe(false);
  });

  it('terminates polling only for the requested owner', () => {
    const thoughtseedConnected = connectionWith(65741640, 'connected');
    expect(terminalGitHubConnectionStateForTarget(thoughtseedConnected, 65741640)).toBe('connected');
    expect(terminalGitHubConnectionStateForTarget(thoughtseedConnected, 7611727)).toBeNull();
    expect(terminalGitHubConnectionStateForTarget(connectionWith(7611727, 'suspended'), 7611727)).toBe('suspended');
    expect(terminalGitHubConnectionStateForTarget(connectionWith(47470954, 'forbidden'), 47470954)).toBe('forbidden');
  });

  it('keeps polling past another connected owner until the exact target connects', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-14T10:00:00.000Z') });
    const load = vi.fn()
      .mockResolvedValueOnce(connectionWith(65741640, 'connected'))
      .mockResolvedValueOnce(connectionWith(7611727, 'connected'));
    const onStatus = vi.fn();
    const onTerminal = vi.fn();
    const onTimeout = vi.fn();
    const cancel = startGitHubConnectionTargetPoll({
      accountId: 7611727,
      intervalMs: 100,
      timeoutMs: 1_000,
      load,
      onStatus,
      onTerminal,
      onTimeout,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(onTerminal).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(load).toHaveBeenCalledTimes(2);
    expect(onTerminal).toHaveBeenCalledWith('connected', expect.objectContaining({
      installations: [expect.objectContaining({ account: expect.objectContaining({ id: 7611727 }) })],
    }));
    expect(onTimeout).not.toHaveBeenCalled();
    cancel();
  });

  it('cancels one pending poll and reports a bounded timeout', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-14T10:00:00.000Z') });
    const pendingConnection = connectionWith(65741640, 'connected');
    const cancelledLoad = vi.fn().mockResolvedValue(pendingConnection);
    const cancelledTimeout = vi.fn();
    const cancel = startGitHubConnectionTargetPoll({
      accountId: 47470954,
      intervalMs: 100,
      timeoutMs: 250,
      load: cancelledLoad,
      onStatus: vi.fn(),
      onTerminal: vi.fn(),
      onTimeout: cancelledTimeout,
    });
    await vi.advanceTimersByTimeAsync(0);
    cancel();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(cancelledLoad).toHaveBeenCalledTimes(1);
    expect(cancelledTimeout).not.toHaveBeenCalled();

    const onTimeout = vi.fn();
    startGitHubConnectionTargetPoll({
      accountId: 47470954,
      intervalMs: 100,
      timeoutMs: 250,
      load: vi.fn(() => new Promise<GitHubConnectionStatus>(() => {})),
      onStatus: vi.fn(),
      onTerminal: vi.fn(),
      onTimeout,
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('keeps protocol delivery typed and status authority behind guarded IPC', () => {
    const main = source('src/main/main.ts');
    const preload = source('src/preload/preload.ts');
    const app = source('src/renderer/App.tsx');
    const settings = source('src/renderer/components/Settings.tsx');
    const types = source('src/shared/types.ts');
    const intentType = types.slice(
      types.indexOf('export interface GitHubConnectionReturnIntent'),
      types.indexOf('export interface GitHubRepositoryListResult'),
    );

    expect(main).toContain('argvGitHubConnectionReturnIntent(process.argv)');
    expect(main).toContain('githubConnectionReturnIntent(url)');
    expect(main).toContain('argvGitHubConnectionReturnIntent(argv)');
    expect(main).toContain("mainWindow.webContents.send('github:connectionReturnRequested', intent)");
    expect(main).toContain("guardedHandle('github:connectionReturnIntent'");
    expect(main).toMatch(/guardedHandle\('github:connectionStatus',[\s\S]{0,240}await activeAdminSession\(\)/);
    expect(preload).toContain("ipcRenderer.invoke('github:connectionReturnIntent')");
    expect(preload).toContain("ipcRenderer.on('github:connectionReturnRequested', handler)");
    expect(app).toContain('isGitHubConnectionReturnIntent(intent)');
    expect(app).toContain('sequence: githubConnectionWakeSequenceRef.current');
    expect(settings).toContain('startGitHubConnectionTargetPoll({');
    expect(settings).toContain('githubConnectionPollCancel.current?.()');
    expect(intentType).toContain('version: 1;');
    expect(intentType).toContain('accountId: number;');
    expect(intentType).not.toMatch(/state|code|token|secret|installation/i);
  });
});
