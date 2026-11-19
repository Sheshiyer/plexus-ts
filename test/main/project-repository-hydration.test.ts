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

const VERIFIED_AT = '2026-09-12T10:00:00.000Z';
const CHECKED_AT = '2026-09-12T11:00:00.000Z';
const binding = {
  githubRepoId: '123',
  githubInstallationId: 456,
  githubRepoOwnerId: 7611727,
  githubRepoOwnerLogin: 'Sheshiyer',
  githubRepoOwnerType: 'User' as const,
  githubRepoUrl: 'https://github.com/Sheshiyer/fixture',
  githubRepoFullName: 'Sheshiyer/fixture',
  repoEvidenceStatus: 'verified' as const,
  repoVerifiedAt: VERIFIED_AT,
  repoAuthoritySource: 'worker' as const,
};

let database: typeof import('../../src/db/database');
let cleanup: () => Promise<void>;

function graph(projectPatch: Record<string, unknown> = {}, marker: unknown = {
  version: 1, status: 'verified', checkedAt: CHECKED_AT,
}) {
  return {
    project: { id: 'project-worker', name: 'Worker project', ...binding, ...projectPatch },
    repositoryVerification: marker,
  };
}

function respond(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

function serve(mapping: unknown | Error, summaries: unknown = []) {
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === '/v1/project-mappings') {
      if (mapping instanceof Error) throw mapping;
      return respond(mapping);
    }
    if (url.pathname === '/v1/projects') return respond(summaries);
    throw new Error(`Unexpected fixture route: ${url.pathname}`);
  });
}

async function sync(mapping: unknown | Error, summaries: unknown = []) {
  serve(mapping, summaries);
  const { syncProjects } = await import('../../src/main/teamforge');
  expect(await syncProjects()).toEqual({ ok: true, count: 1 });
  return database.getProject('project-worker');
}

async function cachedBinding() {
  const project: Project = {
    id: 'project-worker', name: 'Cached project', color: '#56C8B0', archived: false,
    createdAt: VERIFIED_AT, ...binding, repoBindingSource: 'manual', repoBoundAt: VERIFIED_AT,
  };
  await database.insertProject(project);
}

async function expectClearedAuthority(status: string) {
  const db = await database.getDb();
  const row = await new Promise<Record<string, unknown>>((resolve, reject) => {
    db.get('SELECT * FROM projects WHERE id = ?', ['project-worker'], (error, result: Record<string, unknown>) => {
      if (error) reject(error); else resolve(result);
    });
  });
  for (const column of [
    'github_repo_url', 'github_repo_full_name', 'github_repo_id', 'github_installation_id',
    'github_repo_owner_id', 'github_repo_owner_login', 'github_repo_owner_type',
    'repo_verified_at', 'repo_authority_source', 'repo_binding_source', 'repo_bound_at',
  ]) expect(row[column], column).toBeNull();
  expect(row.repo_evidence_status).toBe(status);
}

beforeEach(async () => {
  const loaded = await loadIsolatedAssistantDatabase();
  database = loaded.database;
  cleanup = loaded.cleanup;
  await database.setSetting('tf.tokenEnc', 'fixture-encrypted-token');
  vi.stubEnv('PLEXUS_WORKER_BASE_URL', 'https://worker.test');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  await cleanup?.();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('durable Worker repository verification hydration', () => {
  it('hydrates the full Worker tuple into fresh SQLite and retains it after reopening', async () => {
    const result = await sync([graph()]);
    expect(result).toMatchObject({ ...binding, mappingSource: 'worker_mapping' });
    expect(result?.repoBindingSource).toBeUndefined();
    expect(result?.repoBoundAt).toBeUndefined();
    await database.closeDb();
    vi.resetModules();
    const reopened = await import('../../src/db/database');
    try {
      expect(await reopened.getProject('project-worker')).toEqual(result);
    } finally {
      await reopened.closeDb();
    }
  });

  it.each(['unverified', 'revoked'])('clears cached authority for explicit %s with no URL, preserving work', async (status) => {
    await cachedBinding();
    await database.insertEntry({
      id: 'entry-preserved', projectId: 'project-worker', description: 'Local work',
      startTime: VERIFIED_AT, endTime: CHECKED_AT, durationSeconds: 3600, tags: [], source: 'manual',
    });
    const before = await database.listEntries('2026-09-12', '2026-09-13');
    expect(before).toHaveLength(1);
    await sync([{
      project: { id: 'project-worker', name: 'Worker project' },
      repositoryVerification: { version: 1, status, checkedAt: CHECKED_AT },
    }]);
    await expectClearedAuthority(status === 'revoked' ? 'inaccessible' : 'unverified');
    expect(await database.listEntries('2026-09-12', '2026-09-13')).toEqual(before);
  });

  it.each([
    ['null marker', null],
    ['unsupported version', { version: 2, status: 'verified', checkedAt: CHECKED_AT }],
    ['unknown status', { version: 1, status: 'allowed', checkedAt: CHECKED_AT }],
    ['non-string status', { version: 1, status: { toString: null }, checkedAt: CHECKED_AT }],
    ['missing checkedAt', { version: 1, status: 'verified' }],
    ['invalid checkedAt', { version: 1, status: 'verified', checkedAt: 'not-a-date' }],
    ['date-only checkedAt', { version: 1, status: 'verified', checkedAt: '2026-09-12' }],
    ['unbounded reason', { version: 1, status: 'verified', checkedAt: CHECKED_AT, reason: 'x'.repeat(200) }],
  ])('fails closed for %s instead of retaining cached proof', async (_label, marker) => {
    await cachedBinding();
    await sync([graph({}, marker)]);
    await expectClearedAuthority('unverified');
  });

  it.each([
    ['missing installation', { githubInstallationId: null }],
    ['invalid repository ID', { githubRepoId: 'not-numeric' }],
    ['missing owner ID', { githubRepoOwnerId: null }],
    ['owner login mismatch', { githubRepoOwnerLogin: 'psychon7' }],
    ['owner type mismatch', { githubRepoOwnerType: 'Organization' }],
    ['repository owner mismatch', { githubRepoFullName: 'psychon7/fixture', githubRepoUrl: 'https://github.com/psychon7/fixture' }],
    ['repository URL mismatch', { githubRepoUrl: 'https://github.com/Sheshiyer/other' }],
    ['missing repository URL', { githubRepoUrl: null }],
    ['missing verification time', { repoVerifiedAt: null }],
    ['date-only verification time', { repoVerifiedAt: '2026-09-12' }],
    ['unverified project status', { repoEvidenceStatus: 'unverified' }],
    ['non-Worker authority', { repoAuthoritySource: 'local' }],
  ])('fails closed for a verified marker with %s', async (_label, patch) => {
    await cachedBinding();
    await sync([graph(patch)]);
    await expectClearedAuthority('unverified');
  });

  it.each([true, false])('does not promote a verified summary into a fresh cache (marked: %s)', async (marked) => {
    const payload = marked ? graph() : graph().project;
    const result = await sync(new Error('mapping unavailable'), [payload]);
    expect(result).toMatchObject({ mappingSource: 'worker_summary', repoEvidenceStatus: 'unverified' });
    expect(result?.repoVerifiedAt).toBeUndefined();
    expect(result?.repoAuthoritySource).toBeUndefined();
    expect(result?.githubRepoId).toBeUndefined();
  });

  it.each([true, false])('does not refresh or replace existing proof from a summary (marked: %s)', async (marked) => {
    await cachedBinding();
    const before = await database.getProject('project-worker');
    const summary = graph({
      githubRepoId: '999', githubRepoFullName: 'Sheshiyer/other', githubRepoUrl: 'https://github.com/Sheshiyer/other',
      repoVerifiedAt: CHECKED_AT,
    });
    const result = await sync(new Error('mapping unavailable'), [marked ? summary : summary.project]);
    expect(result).toMatchObject({ ...binding, repoBindingSource: before?.repoBindingSource, repoBoundAt: before?.repoBoundAt });
    expect(result?.mappingSource).toBe('worker_summary');
  });

  it('does not let graph metadata links supply or override the verified project tuple', async () => {
    const payload = {
      ...graph(),
      githubLinks: [{ isPrimary: true, repo: 'psychon7/metadata', url: 'https://github.com/psychon7/metadata', id: 999 }],
    };
    expect(await sync([payload])).toMatchObject(binding);
    await sync([{ ...payload, project: { ...payload.project, githubRepoUrl: null } }]);
    await expectClearedAuthority('unverified');
  });

  it('preserves unmarked mapping compatibility without requiring the new tuple', async () => {
    expect(await sync([{ id: 'project-worker', name: 'Legacy project', ...binding, githubInstallationId: undefined }]))
      .toMatchObject({ githubRepoId: '123', repoEvidenceStatus: 'verified', repoVerifiedAt: VERIFIED_AT });
  });

  it.each(['revoked', 'unverified', 'verified'])('withdraws cached proof from an explicitly marked inactive row (%s)', async (status) => {
    await cachedBinding();
    serve([graph({ status: 'archived' }, { version: 1, status, checkedAt: CHECKED_AT })]);
    const { syncProjects } = await import('../../src/main/teamforge');
    expect(await syncProjects()).toEqual({ ok: true, count: 0 });
    await expectClearedAuthority(status === 'revoked' ? 'inaccessible' : 'unverified');
    expect(await database.getProject('project-worker')).toMatchObject({ name: 'Cached project', archived: false });
  });

  it('fails closed for the affected row without falling back or preventing valid rows from hydrating', async () => {
    await cachedBinding();
    serve([graph({}, { version: 999 }), graph({ id: 'other-project' })]);
    const { syncProjects } = await import('../../src/main/teamforge');
    expect(await syncProjects()).toEqual({ ok: true, count: 2 });
    await expectClearedAuthority('unverified');
    expect(await database.getProject('other-project')).toMatchObject({ ...binding, mappingSource: 'worker_mapping' });
  });
});
