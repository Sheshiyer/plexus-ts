import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const githubState = vi.hoisted(() => ({
  settings: new Map<string, string | null>([['tf.tokenEnc', 'encrypted-token']]),
  projects: [{
    id: 'project_1',
    name: 'Private Project',
    color: '#56C8B0',
    archived: false,
    createdAt: '2026-07-01T00:00:00.000Z',
  }],
  inserted: [] as Array<Record<string, unknown>>,
  updated: [] as Array<{ id: string; patch: Record<string, unknown> }>,
}));

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: () => 'member-token',
  },
  BrowserWindow: class MockBrowserWindow {},
  session: {
    fromPartition: vi.fn(() => ({ clearStorageData: vi.fn(), clearCache: vi.fn() })),
  },
}));

vi.mock('../../src/db/database.js', () => ({
  getSetting: vi.fn(async (key: string) => githubState.settings.get(key) ?? ''),
  setSetting: vi.fn(async (key: string, value: string) => githubState.settings.set(key, value)),
  listProjects: vi.fn(async () => githubState.projects),
  insertProject: vi.fn(async (project: Record<string, unknown>) => { githubState.inserted.push(project); }),
  updateProject: vi.fn(async (id: string, patch: Record<string, unknown>) => { githubState.updated.push({ id, patch }); }),
  updateEntry: vi.fn(),
  listUnsyncedEntries: vi.fn(async () => []),
}));

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function workerResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: status >= 200 && status < 300, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  githubState.settings = new Map([['tf.tokenEnc', 'encrypted-token']]);
  githubState.projects = [{
    id: 'project_1',
    name: 'Private Project',
    color: '#56C8B0',
    archived: false,
    createdAt: '2026-07-01T00:00:00.000Z',
  }];
  githubState.inserted = [];
  githubState.updated = [];
  vi.stubEnv('PLEXUS_WORKER_BASE_URL', 'https://worker.test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('private GitHub App desktop client', () => {
  it('verifies only a numeric installation repository through the authenticated Worker', async () => {
    const fetchMock = vi.fn(async () => workerResponse({
      status: 'verified',
      repository: {
        id: 8123456789,
        installationId: 4242,
        account: { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' },
        fullName: 'thoughtseed/private-project',
        url: 'https://github.com/thoughtseed/private-project',
        private: true,
      },
      project: { repoVerifiedAt: '2026-07-13T10:00:00.000Z' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { verifyProjectRepo } = await import('../../src/main/teamforge');

    const result = await verifyProjectRepo('project_1', 4242, 8123456789);

    expect(result).toMatchObject({
      ok: true,
      status: 'verified',
      repo: { id: 8123456789, fullName: 'thoughtseed/private-project', private: true },
      project: { githubRepoId: '8123456789', repoEvidenceStatus: 'verified' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://worker.test/v1/projects/project_1/github-repo/verify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer member-token' }),
        body: JSON.stringify({ installationId: 4242, repositoryId: 8123456789 }),
      }),
    );
    expect(fetchMock.mock.calls.flat().join(' ')).not.toContain('api.github.com');
  });

  it.each(['unconfigured', 'pending', 'suspended', 'forbidden'] as const)(
    'preserves the typed %s verification state without a fallback request',
    async (status) => {
      const fetchMock = vi.fn(async () => workerResponse({ status }));
      vi.stubGlobal('fetch', fetchMock);
      const { verifyProjectRepo } = await import('../../src/main/teamforge');

      const result = await verifyProjectRepo('project_1', 42, 99);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(status);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([undefined, 'unexpected-state'])(
    'fails closed when repository verification status is %s',
    async (status) => {
      const fetchMock = vi.fn(async () => workerResponse({
        ...(status === undefined ? {} : { status }),
        repository: {
          id: 99,
          fullName: 'thoughtseed/private-project',
          url: 'https://github.com/thoughtseed/private-project',
          private: true,
        },
      }));
      vi.stubGlobal('fetch', fetchMock);
      const { verifyProjectRepo } = await import('../../src/main/teamforge');

      const result = await verifyProjectRepo('project_1', 42, 99);

      expect(result).toMatchObject({ ok: false, status: 'pending' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([undefined, 'not-a-timestamp'])(
    'fails closed when verified repository timestamp is %s',
    async (repoVerifiedAt) => {
      vi.stubGlobal('fetch', vi.fn(async () => workerResponse({
        status: 'verified',
        repository: {
          id: 99,
          installationId: 42,
          account: { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' },
          fullName: 'thoughtseed/private-project',
          url: 'https://github.com/thoughtseed/private-project',
          private: true,
          ...(repoVerifiedAt === undefined ? {} : { verifiedAt: repoVerifiedAt }),
        },
      })));
      const { verifyProjectRepo } = await import('../../src/main/teamforge');

      const result = await verifyProjectRepo('project_1', 42, 99);

      expect(result).toMatchObject({ ok: false, status: 'pending' });
      expect(result.project).toBeUndefined();
    },
  );

  it.each(['unconfigured', 'pending', 'suspended', 'forbidden'] as const)(
    'keeps GitHub activity sync non-operational in the typed %s state',
    async (status) => {
      const fetchMock = vi.fn(async () => workerResponse({ status, activity: [{ id: 'must-not-be-accepted' }] }));
      vi.stubGlobal('fetch', fetchMock);
      const { syncGitHubActivity } = await import('../../src/main/teamforge');

      const result = await syncGitHubActivity('project_1', '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z');

      expect(result).toMatchObject({ ok: false, status, activity: [], ciEvidence: { items: [], truncated: false, checkedShas: [] } });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([undefined, 'unexpected-state'])(
    'fails closed when GitHub activity status is %s',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn(async () => workerResponse({
        ...(status === undefined ? {} : { status }),
        activity: [{ id: 'must-not-be-accepted' }],
      })));
      const { syncGitHubActivity } = await import('../../src/main/teamforge');

      const result = await syncGitHubActivity('project_1', '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z');

      expect(result).toMatchObject({ ok: false, status: 'pending', activity: [], ciEvidence: { items: [], truncated: false, checkedShas: [] } });
    },
  );

  it('accepts GitHub activity only after an explicit synced Worker response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => workerResponse({
      status: 'synced',
      activity: [{
        id: 'activity_1',
        projectId: 'project_1',
        repoFullName: 'thoughtseed/private-project',
        repoUrl: 'https://github.com/thoughtseed/private-project',
        kind: 'commit',
        title: 'Private change',
        url: 'https://github.com/thoughtseed/private-project/commit/abc',
        occurredAt: '2026-07-13T10:00:00.000Z',
        metadata: {},
      }],
      ciEvidence: {
        items: [
          {
            id: 'github:8123456789:workflow:701',
            externalId: 701,
            projectId: 'project_1',
            repoFullName: 'thoughtseed/private-project',
            evidenceClass: 'ci',
            evidenceType: 'workflow_run',
            name: 'CI',
            status: 'completed',
            conclusion: 'success',
            url: 'https://github.com/thoughtseed/private-project/actions/runs/701',
            headSha: 'a'.repeat(40),
            attempt: 2,
            event: 'pull_request',
            branch: 'codex/private-github-app',
            actor: 'alice',
            occurredAt: '2026-07-01T12:30:00.000Z',
            metadata: { source: 'actions' },
          },
          {
            id: 'github:8123456789:check:702',
            externalId: 702,
            projectId: 'project_1',
            repoFullName: 'thoughtseed/private-project',
            evidenceClass: 'ci',
            evidenceType: 'check_run',
            name: 'malformed check',
            status: 'completed',
            conclusion: 'success',
            url: 'https://github.com/thoughtseed/private-project/checks/702',
            headSha: 'not-a-sha',
            attempt: null,
            event: null,
            branch: null,
            actor: 'github-actions',
            occurredAt: '2026-07-01T12:20:00.000Z',
            metadata: {},
          },
        ],
        truncated: false,
        checkedShas: ['a'.repeat(40), 'not-a-sha'],
      },
    })));
    const { syncGitHubActivity } = await import('../../src/main/teamforge');

    const result = await syncGitHubActivity('project_1', '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z');

    expect(result).toMatchObject({ ok: true, status: 'synced' });
    expect(result.activity).toHaveLength(1);
    expect(result.ciEvidence).toMatchObject({
      truncated: false,
      checkedShas: ['a'.repeat(40)],
      items: [expect.objectContaining({ evidenceClass: 'ci', evidenceType: 'workflow_run', externalId: 701, conclusion: 'success' })],
    });
    expect(result.ciEvidence.items).toHaveLength(1);
    expect(result.activity.map((item) => item.id)).not.toContain(result.ciEvidence.items[0].id);

    const { matchedActivitiesForEntry } = await import('../../src/main/evidence');
    const matches = matchedActivitiesForEntry({
      id: 'entry_1',
      projectId: 'project_1',
      description: 'Employee work',
      startTime: '2026-07-13T09:30:00.000Z',
      endTime: '2026-07-13T10:30:00.000Z',
      durationSeconds: 3600,
      tags: [],
      source: 'manual',
      githubRepoFullName: 'thoughtseed/private-project',
    }, result.activity, new Date('2026-07-13T11:00:00.000Z'));
    expect(matches.map((item) => item.id)).toEqual(['activity_1']);
  });

  it('returns only allowlisted non-secret connection and repository fields', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('/v1/github/connection')) {
        return workerResponse({
          status: 'connected',
          installations: [{ installationId: 9001, status: 'connected', account: { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' } }],
          allowedTargets: [
            { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' },
            { id: 7611727, login: 'Sheshiyer', type: 'User' },
            { id: 47470954, login: 'psychon7', type: 'User' },
          ],
          repositoryCount: 1,
          updatedAt: '2026-07-13T10:00:00.000Z',
          installationToken: 'never-render-this',
          privateKey: 'never-render-this',
          webhookSecret: 'never-render-this',
        });
      }
      return workerResponse({
        status: 'connected',
        repositories: [{
          id: 42,
          installationId: 9001,
          account: { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' },
          fullName: 'thoughtseed/private-project',
          url: 'https://github.com/thoughtseed/private-project',
          private: true,
          installationToken: 'never-render-this',
        }],
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getGitHubConnectionStatus, listGitHubRepositories } = await import('../../src/main/teamforge');

    const connection = await getGitHubConnectionStatus();
    const repositories = await listGitHubRepositories();

    expect(connection).toEqual({
      status: 'connected',
      installations: [{ installationId: 9001, status: 'connected', account: { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' } }],
      allowedTargets: [
        { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' },
        { id: 7611727, login: 'Sheshiyer', type: 'User' },
        { id: 47470954, login: 'psychon7', type: 'User' },
      ],
      repositoryCount: 1,
      updatedAt: '2026-07-13T10:00:00.000Z',
      message: 'The workspace GitHub connection is ready.',
    });
    expect(repositories.repositories).toEqual([{
      id: 42,
      installationId: 9001,
      account: { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' },
      fullName: 'thoughtseed/private-project',
      url: 'https://github.com/thoughtseed/private-project',
      source: 'worker',
      private: true,
      verifiedAt: null,
    }]);
    expect(JSON.stringify({ connection, repositories })).not.toMatch(/installationToken|privateKey|webhookSecret|never-render-this/);
  });

  it('starts installation setup for one exact numeric owner and confirms the returned target', async () => {
    const fetchMock = vi.fn(async () => workerResponse({
      status: 'pending',
      authorizeUrl: 'https://github.com/login/oauth/authorize?client_id=Iv1.test&state=signed',
      target: { id: 47470954, login: 'psychon7', type: 'User' },
    }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const { startGitHubConnection } = await import('../../src/main/teamforge');

    const result = await startGitHubConnection(47470954);

    expect(result).toMatchObject({
      status: 'pending',
      target: { id: 47470954, login: 'psychon7', type: 'User' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://worker.test/v1/github/connect/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ accountId: 47470954 }),
      }),
    );
  });

  it('rejects an invalid installation owner before contacting the Worker', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { startGitHubConnection } = await import('../../src/main/teamforge');

    await expect(startGitHubConnection(999999)).resolves.toMatchObject({ status: 'forbidden' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the Worker returns an unexpected installation-owner policy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => workerResponse({
      status: 'connected',
      installations: [{ installationId: 9009, status: 'connected', account: { id: 999999, login: 'outsider', type: 'User' } }],
      allowedTargets: [{ id: 999999, login: 'outsider', type: 'User' }],
    })));
    const { getGitHubConnectionStatus } = await import('../../src/main/teamforge');

    await expect(getGitHubConnectionStatus()).resolves.toMatchObject({
      status: 'forbidden',
      installations: [],
      allowedTargets: [],
    });
  });

  it('fails closed when a verified actor is not one of the two pinned founder identities', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => workerResponse({
      status: 'verified',
      allowedLogins: ['Sheshiyer', 'psychon7'],
      actor: { id: 999999, login: 'outsider', verifiedAt: '2026-07-13T10:00:00.000Z' },
    })));
    const { getGitHubActorStatus } = await import('../../src/main/teamforge');

    await expect(getGitHubActorStatus()).resolves.toMatchObject({ status: 'forbidden', actor: null });
  });

  it.each([undefined, 'unexpected-state'])(
    'does not list authority-bearing repositories when connection status is %s',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn(async () => workerResponse({
        ...(status === undefined ? {} : { status }),
        repositories: [{
          id: 42,
          fullName: 'thoughtseed/private-project',
          url: 'https://github.com/thoughtseed/private-project',
          private: true,
        }],
      })));
      const { listGitHubRepositories } = await import('../../src/main/teamforge');

      const result = await listGitHubRepositories();

      expect(result).toMatchObject({ status: 'pending', repositories: [] });
    },
  );

  it('does not promote legacy name or timestamp mappings without numeric verified authority', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => workerResponse({
      mappings: [
        {
          id: 'legacy_project',
          name: 'Legacy Name Only',
          status: 'active',
          githubRepoUrl: 'https://github.com/thoughtseed/legacy',
          githubRepoFullName: 'thoughtseed/legacy',
          repoVerifiedAt: '2026-07-13T10:00:00.000Z',
          repoEvidenceStatus: 'verified',
        },
        {
          id: 'numeric_project',
          name: 'Numeric Verified',
          status: 'active',
          githubRepoId: 77,
          githubRepoUrl: 'https://github.com/thoughtseed/numeric',
          githubRepoFullName: 'thoughtseed/numeric',
          repoVerifiedAt: '2026-07-13T10:00:00.000Z',
          repoEvidenceStatus: 'verified',
        },
      ],
    })));
    const { syncProjects } = await import('../../src/main/teamforge');

    const result = await syncProjects();

    expect(result).toMatchObject({ ok: true, count: 2 });
    expect(githubState.inserted).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'legacy_project', repoEvidenceStatus: 'unverified', repoVerifiedAt: undefined, githubRepoId: undefined }),
      expect.objectContaining({ id: 'numeric_project', repoEvidenceStatus: 'verified', repoVerifiedAt: '2026-07-13T10:00:00.000Z', githubRepoId: '77' }),
    ]));
  });

  it('keeps privileged IPC guarded and subprocess environments free of Access JWTs', () => {
    const main = source('src/main/main.ts');
    const teamforge = source('src/main/teamforge.ts');
    const preload = source('src/preload/preload.ts');

    expect(main).toMatch(/guardedHandle\('github:connectionStatus',[\s\S]{0,240}await activeAdminSession\(\)/);
    expect(main).toMatch(/guardedHandle\('github:connectStart',[\s\S]{0,700}await activeAdminSession\(\)/);
    expect(main).toMatch(/guardedHandle\('github:repositories',[\s\S]{0,240}await activeAdminSession\(\)/);
    expect(main).toMatch(/guardedHandle\('project:verifyRepo',[\s\S]{0,900}finiteNumber\(args\[1\],[\s\S]{0,900}finiteNumber\(args\[2\],[\s\S]{0,900}await activeAdminSession\(\)/);
    expect(main).toMatch(/guardedHandle\('github:activitySync',[\s\S]{0,700}await activeMemberSession\(\)/);
    expect(preload).toContain("githubConnectionStatus: () => ipcRenderer.invoke('github:connectionStatus')");
    expect(preload).toContain("githubConnectStart: (accountId) => ipcRenderer.invoke('github:connectStart', accountId)");
    expect(preload).toContain("githubRepositories: () => ipcRenderer.invoke('github:repositories')");
    expect(`${main}\n${teamforge}`).not.toMatch(/accessJwt\s*\?\s*\{\s*CF_ACCESS_JWT/);
    expect(main).toContain('sanitizedChildProcessEnv');
    expect(teamforge).toContain('sanitizedChildProcessEnv');
    expect(teamforge).not.toContain('verifyPublicGitHubRepo');
    expect(teamforge).not.toContain('https://api.github.com/repos/');
  });

  it('removes application credentials from every owned child-process environment', async () => {
    const { sanitizedChildProcessEnv } = await import('../../src/main/child-process-environment');
    const env = sanitizedChildProcessEnv({
      PATH: '/trusted/bin',
      CF_ACCESS_JWT: 'access-jwt',
      GITHUB_APP_PRIVATE_KEY: 'private-key',
      GITHUB_APP_CLIENT_SECRET: 'client-secret',
      GITHUB_WEBHOOK_SECRET: 'webhook-secret',
      GITHUB_TOKEN: 'github-token',
      GH_TOKEN: 'gh-token',
      TF_GITHUB_APP_PRIVATE_KEY: 'tf-private-key',
      TF_GITHUB_APP_CLIENT_SECRET: 'tf-client-secret',
      TF_GITHUB_APP_WEBHOOK_SECRET: 'tf-webhook-secret',
      TF_GITHUB_APP_STATE_SIGNING_SECRET: 'tf-state-signing-secret',
      TF_GITHUB_TOKEN_GLOBAL: 'tf-global-token',
      TF_CREDENTIAL_ENVELOPE_KEY: 'tf-envelope-key',
      TF_INTERNAL_SHARED_SECRET: 'tf-internal-secret',
      TF_WEBHOOK_HMAC_SECRET: 'tf-webhook-hmac-secret',
    }, {
      SAFE_CONTEXT: 'member-123',
      CF_ACCESS_JWT: 'override-must-also-be-removed',
    });

    expect(env).toEqual({ PATH: '/trusted/bin', SAFE_CONTEXT: 'member-123' });
    for (const key of [
      'TF_GITHUB_APP_PRIVATE_KEY',
      'TF_GITHUB_APP_CLIENT_SECRET',
      'TF_GITHUB_APP_WEBHOOK_SECRET',
      'TF_GITHUB_APP_STATE_SIGNING_SECRET',
      'TF_GITHUB_TOKEN_GLOBAL',
      'TF_CREDENTIAL_ENVELOPE_KEY',
      'TF_INTERNAL_SHARED_SECRET',
      'TF_WEBHOOK_HMAC_SECRET',
    ]) {
      expect(source('src/main/child-process-environment.ts'), key).toContain(`'${key}'`);
      expect(env[key], key).toBeUndefined();
    }
    for (const file of ['src/main/main.ts', 'src/main/teamforge.ts', 'src/main/fabric.ts', 'src/main/updates.ts']) {
      expect(source(file), file).toContain('sanitizedChildProcessEnv');
    }
  });

  it('requires numeric exact-verified project bindings at every main-process acceptance gate', async () => {
    const { hasVerifiedGitHubRepository, projectPatchAfterGitHubActivityFailure } = await import('../../src/shared/github-repository-authority');
    const verifiedProject = {
      id: 'project_1',
      name: 'Private Project',
      color: '#56C8B0',
      archived: false,
      createdAt: '2026-07-01T00:00:00.000Z',
      githubRepoId: '42',
      githubRepoUrl: 'https://github.com/thoughtseed/private-project',
      githubRepoFullName: 'thoughtseed/private-project',
      repoVerifiedAt: '2026-07-13T10:00:00.000Z',
      repoEvidenceStatus: 'verified' as const,
      evidenceStatus: 'matched' as const,
    };
    expect(hasVerifiedGitHubRepository(verifiedProject)).toBe(true);
    for (const status of ['suspended', 'forbidden'] as const) {
      const patch = projectPatchAfterGitHubActivityFailure(status);
      expect(patch).toEqual({ repoEvidenceStatus: 'inaccessible', evidenceStatus: 'sync_failed' });
      expect(hasVerifiedGitHubRepository({ ...verifiedProject, ...patch })).toBe(false);
    }
    for (const status of ['pending', 'unconfigured'] as const) {
      const patch = projectPatchAfterGitHubActivityFailure(status);
      expect(patch).toEqual({ repoEvidenceStatus: 'unverified', evidenceStatus: 'sync_failed' });
      expect(hasVerifiedGitHubRepository({ ...verifiedProject, ...patch })).toBe(false);
    }

    const authorityCallsites = [
      'src/main/main.ts',
      'src/main/timer-session.ts',
      'src/main/agent-sessions.ts',
      'src/main/assistant-tools.ts',
      'src/main/evidence.ts',
      'src/main/vault-projects.ts',
      'src/shared/today-snapshot.ts',
      'src/shared/admin-proof-cockpit.ts',
      'src/renderer/components/Timer.tsx',
      'src/renderer/components/AgentSessionFocusRail.tsx',
      'src/renderer/components/AgentSessionsPanel.tsx',
      'src/renderer/components/ProjectManager.tsx',
      'src/renderer/components/TimeEntryList.tsx',
      'src/renderer/components/Settings.tsx',
      'src/renderer/components/IdentityPanel.tsx',
      'src/renderer/components/AssistantPanel.tsx',
    ];
    for (const file of authorityCallsites) {
      const contents = source(file);
      expect(contents, file).toContain('hasVerifiedGitHubRepository');
      expect(contents, file).not.toContain("project.repoEvidenceStatus !== 'inaccessible'");
    }
    for (const file of ['src/renderer/components/ProjectManager.tsx', 'src/renderer/components/TimeEntryList.tsx']) {
      const contents = source(file);
      expect(contents, file).toContain("session?.role === 'admin'");
      expect(contents, file).toMatch(/workspace administrator/i);
    }
    expect(source('src/main/main.ts')).toContain('updateProject(projectId, projectPatchAfterGitHubActivityFailure(result.status))');
    expect(source('src/main/main.ts')).toContain('persistGitHubCiEvidence(projectId, ciEvidence)');
    expect(source('src/renderer/components/AdminProofCockpitPanel.tsx')).toContain('snapshot.releaseHealth.ciEvidenceCount');
  });
});
