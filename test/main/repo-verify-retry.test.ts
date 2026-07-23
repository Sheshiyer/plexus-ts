import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Repo verification moved to the worker-authoritative GitHub App flow
 * (numeric installationId/repositoryId), so the old public-GitHub local
 * fallback — and its rate-limit/404 status matrix — is retired. What must
 * survive from the original fix is the persistence bug it addressed: a
 * project stamped 'inaccessible' by a transient failure must become
 * selectable again after a successful retry, which means the retry path has
 * to write the verified outcome back to the project row just like the IPC
 * handler does.
 */
describe('retryHandoff persists repo verification outcomes', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/main/main.ts'), 'utf8');

  it('persists the retried outcome inside the github_repo_verify retry branch', () => {
    const branch = source.slice(
      source.indexOf("retrying.kind === 'github_repo_verify'"),
      source.indexOf("retrying.kind === 'github_activity_sync'"),
    );
    expect(branch).toContain('await verifyProjectRepo(projectId, installationId, repositoryId)');
    expect(branch).toContain('if (result.ok && result.project)');
    expect(branch).toContain('await updateProject(projectId, {');
    expect(branch).toContain('repoEvidenceStatus: result.project.repoEvidenceStatus');
    expect(branch).toContain('repoVerifiedAt: result.project.repoVerifiedAt');
  });

  it('keeps the IPC handler persisting both success and failure outcomes', () => {
    const handler = source.slice(
      source.indexOf("guardedHandle('project:verifyRepo'"),
      source.indexOf("guardedHandle('project:scanVault'"),
    );
    expect(handler).toContain('if (result.ok && result.project)');
    expect(handler).toContain("repoEvidenceStatus: result.status === 'forbidden' || result.status === 'suspended' ? 'inaccessible' : 'unverified'");
  });
});
