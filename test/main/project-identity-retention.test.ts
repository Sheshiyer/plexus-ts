import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../src/shared/types';
import { loadIsolatedAssistantDatabase } from '../assistant/fixtures/database';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: () => 'fixture-member-token',
  },
  BrowserWindow: class MockBrowserWindow {},
  session: {},
}));

let database: typeof import('../../src/db/database');
let cleanup: () => Promise<void>;

function workerResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: status === 200, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function serveProjects(mapping: unknown | Error, summaries: unknown = []) {
  const requested: string[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    requested.push(url.pathname);
    if (url.pathname === '/v1/project-mappings') {
      if (mapping instanceof Error) throw mapping;
      return mapping instanceof Response ? mapping : workerResponse(mapping);
    }
    if (url.pathname === '/v1/projects') return workerResponse(summaries);
    throw new Error(`Unexpected fixture route: ${url.pathname}`);
  });
  return requested;
}

function localProject(id = 'project-local'): Project {
  return { id, name: 'Local project', color: '#56C8B0', archived: false, createdAt: '2026-09-05T00:00:00.000Z' };
}

beforeEach(async () => {
  const loaded = await loadIsolatedAssistantDatabase();
  database = loaded.database;
  cleanup = loaded.cleanup;
  await database.setSetting('tf.tokenEnc', 'fixture-encrypted-token');
  await database.setSetting('tf.workspaceId', 'local-workspace-is-not-evidence');
  vi.stubEnv('PLEXUS_WORKER_BASE_URL', 'https://worker.test');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  await cleanup?.();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('project identity retention through real Worker sync and SQLite', () => {
  it('migrates the previous project schema without inventing identity for existing local rows', async () => {
    await database.insertProject({ ...localProject(), githubRepoId: '123', repoAuthoritySource: 'worker' });
    const db = await database.getDb();
    // Reproduce the prior cache schema, then exercise the real startup migration.
    for (const column of ['client_id', 'workspace_id', 'mapping_source', 'mapping_checked_at']) {
      await new Promise<void>((resolve, reject) => {
        db.run(`ALTER TABLE projects DROP COLUMN ${column}`, (error) => error ? reject(error) : resolve());
      });
    }
    await database.closeDb();
    vi.resetModules();
    const restarted = await import('../../src/db/database');
    try {
      expect(await restarted.getProject('project-local')).toMatchObject({
        name: 'Local project', githubRepoId: '123', repoAuthoritySource: 'worker',
        clientId: null, workspaceId: null, mappingSource: null, mappingCheckedAt: null,
      });
      serveProjects([{ id: 'project-local', clientId: 'client-server', workspaceId: 'workspace-server' }]);
      const { syncProjects } = await import('../../src/main/teamforge');
      expect(await syncProjects()).toEqual({ ok: true, count: 1 });
      expect(await restarted.listProjects()).toEqual([expect.objectContaining({
        clientId: 'client-server', workspaceId: 'workspace-server', mappingSource: 'worker_mapping',
        mappingCheckedAt: expect.any(String), githubRepoId: '123', repoAuthoritySource: 'worker',
      })]);
    } finally {
      await restarted.closeDb();
    }
  });

  it('retains backend identity and mapping evidence through insert, list and database reopen', async () => {
    serveProjects({ projects: [{ project: {
      id: 'project-remote', name: 'Remote project', clientId: 'client-server', workspaceId: 'workspace-server',
    } }] });
    const { syncProjects } = await import('../../src/main/teamforge');
    const before = Date.now();
    expect(await syncProjects()).toEqual({ ok: true, count: 1 });
    const inserted = await database.getProject('project-remote');
    expect(inserted).toMatchObject({ clientId: 'client-server', workspaceId: 'workspace-server', mappingSource: 'worker_mapping' });
    expect(Date.parse(inserted!.mappingCheckedAt!)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(inserted!.mappingCheckedAt!)).toBeLessThanOrEqual(Date.now());
    await database.closeDb();
    vi.resetModules();
    const restarted = await import('../../src/db/database');
    try {
      expect(await restarted.listProjects()).toEqual([inserted]);
    } finally {
      await restarted.closeDb();
    }
  });

  it('refreshes snake-case identity and explicitly clears omitted or null backend fields on an existing row', async () => {
    const { syncProjects } = await import('../../src/main/teamforge');
    serveProjects([{ id: 'project-remote', name: 'Remote', client_id: 'client-before', workspace_id: 'workspace-before' }]);
    expect((await syncProjects()).ok).toBe(true);
    expect(await database.getProject('project-remote')).toMatchObject({ clientId: 'client-before', workspaceId: 'workspace-before' });
    serveProjects([{ id: 'project-remote', name: 'Renamed', clientId: null }]);
    expect((await syncProjects()).ok).toBe(true);
    expect(await database.getProject('project-remote')).toMatchObject({
      name: 'Renamed', clientId: null, workspaceId: null, mappingSource: 'worker_mapping',
    });
  });

  it.each([[], { projects: [] }, { items: [] }, { mappings: [] }].map((mapping) => [mapping]))('does not replace a valid empty mapping response with summaries: %j', async (mapping) => {
    const requested = serveProjects(mapping, [{ id: 'summary-only', name: 'Should not import' }]);
    const { syncProjects } = await import('../../src/main/teamforge');
    expect(await syncProjects()).toEqual({ ok: true, count: 0 });
    expect(await database.listProjects()).toEqual([]);
    expect(requested).toEqual(['/v1/project-mappings']);
  });

  it.each([
    ['network failure', new Error('fixture unavailable')],
    ['HTTP failure', () => workerResponse(null, 503)],
    ['missing list', {}],
    ['invalid list', { projects: null }],
    ['invalid row', { projects: [null] }],
    ['invalid nested project', { projects: [{ project: 'not-a-project' }] }],
  ])('labels fallback rows as summaries after %s', async (_label, fixture) => {
    const mapping = typeof fixture === 'function' ? fixture() : fixture;
    serveProjects(mapping, { summaries: [{ id: 'summary-only', name: 'Summary', clientId: 'client-summary' }] });
    const { syncProjects } = await import('../../src/main/teamforge');
    expect(await syncProjects()).toEqual({ ok: true, count: 1 });
    expect(await database.getProject('summary-only')).toMatchObject({
      clientId: 'client-summary', workspaceId: null, mappingSource: 'worker_summary', mappingCheckedAt: expect.any(String),
    });
  });

  it('downgrades provenance to summary and clears stale identity while preserving unrelated GitHub authority', async () => {
    await database.insertProject({
      ...localProject('project-remote'), clientId: 'old-client', workspaceId: 'old-workspace',
      mappingSource: 'worker_mapping', mappingCheckedAt: '2026-09-01T00:00:00.000Z',
      githubRepoId: '123', githubInstallationId: 456, repoAuthoritySource: 'worker',
      githubRepoUrl: 'https://github.com/thoughtseed-labs/fixture', repoEvidenceStatus: 'verified',
    });
    serveProjects(new Error('fixture unavailable'), [{ id: 'project-remote', name: 'Summary' }]);
    const { syncProjects } = await import('../../src/main/teamforge');
    expect((await syncProjects()).ok).toBe(true);
    expect(await database.getProject('project-remote')).toMatchObject({
      clientId: null, workspaceId: null, mappingSource: 'worker_summary',
      githubRepoId: '123', githubInstallationId: 456, repoAuthoritySource: 'worker', repoEvidenceStatus: 'verified',
    });
  });

  it('rejects malformed summaries without mutating cached identity evidence', async () => {
    await database.insertProject(localProject());
    const before = await database.listProjects();
    serveProjects(new Error('fixture unavailable'), { projects: 'invalid' });
    const { syncProjects } = await import('../../src/main/teamforge');
    expect(await syncProjects()).toMatchObject({ ok: false, count: 0 });
    expect(await database.listProjects()).toEqual(before);
  });

  it('keeps local projects unproven after Worker GitHub verification and vault auto-link enrichment', async () => {
    await database.insertProject(localProject());
    const repository = {
      id: 123, installationId: 456, account: { id: 65741640, login: 'thoughtseed-labs', type: 'Organization' as const },
      fullName: 'thoughtseed-labs/fixture', url: 'https://github.com/thoughtseed-labs/fixture', private: true,
      source: 'worker' as const,
    };
    vi.stubGlobal('fetch', async () => workerResponse({
      status: 'verified', repository, project: { repoVerifiedAt: '2026-09-05T01:00:00.000Z', clientId: 'not-mapping-evidence', workspaceId: 'not-mapping-evidence' },
    }));
    const { verifyProjectRepo } = await import('../../src/main/teamforge');
    const { autoLinkVaultProjectRepositories } = await import('../../src/main/vault-projects');
    expect(await autoLinkVaultProjectRepositories([{
      code: 'fixture', projectId: 'project-local', cachedProjectId: 'project-local', name: 'Local project', status: 'active',
      sourcePath: 'fixture/project.yaml', githubRepoFullName: repository.fullName, githubRepoUrl: repository.url,
    }], [repository], verifyProjectRepo)).toEqual({ autoLinked: 1, failed: 0 });
    expect(await database.getProject('project-local')).toMatchObject({
      clientId: null, workspaceId: null, mappingSource: null, mappingCheckedAt: null,
      repoAuthoritySource: 'worker', repoBindingSource: 'vault_auto', repoEvidenceStatus: 'verified',
    });
  });
});
